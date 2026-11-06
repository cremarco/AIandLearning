#!/usr/bin/env python3
"""Render a paper's first PDF page and trim blank exterior margins only."""

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('png', type=Path)
    args = parser.parse_args()
    renderer = shutil.which('pdftoppm')
    if not renderer:
        parser.error('Install Poppler (pdftoppm) before rendering paper pages.')
    with tempfile.TemporaryDirectory(prefix='paper-page-') as directory:
        prefix = Path(directory) / 'page'
        subprocess.run([
            renderer, '-f', '1', '-l', '1', '-singlefile', '-scale-to', '2400',
            '-png', str(args.pdf.resolve()), str(prefix),
        ], check=True)
        with Image.open(prefix.with_suffix('.png')) as image:
            page = image.convert('RGB')
        ink = ImageChops.difference(page, Image.new('RGB', page.size, 'white'))
        bounds = ink.convert('L').point(lambda value: 255 if value > 6 else 0).getbbox()
        if not bounds:
            raise ValueError('The first PDF page is blank.')
        left, top, right, bottom = bounds
        # Preserve antialiasing around the outermost printed marks.
        bounds = (max(0, left - 2), max(0, top - 2),
                  min(page.width, right + 2), min(page.height, bottom + 2))
        cropped = page.crop(bounds)
        args.png.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(args.png, optimize=True)
    print(json.dumps({
        'inputFile': args.pdf.name,
        'inputSha256': hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
        'page': 1,
        'render': 'Poppler first page at 2400 px; blank exterior margins trimmed, 2 px antialiasing guard; no retouching or added frame',
        'originalPixels': list(page.size),
        'cropPixels': list(bounds),
        'outputPixels': list(cropped.size),
        'outputSha256': hashlib.sha256(args.png.read_bytes()).hexdigest(),
    }, indent=2))


if __name__ == '__main__':
    main()
