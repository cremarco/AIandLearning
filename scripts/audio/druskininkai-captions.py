"""Align the approved Lithuanian scripts locally with Whisper; never call a hosted API."""
import argparse
import hashlib
import html
import importlib.metadata
import json
import math
from pathlib import Path
import re
import textwrap
import time

ROOT = Path(__file__).resolve().parents[2]
LESSONS = [{"lesson": "druskininkai-lt", "source": "data/druskininkai/narration", "directory": "druskininkai"}]
MODEL_CACHE = Path.home() / ".cache/whisper"


def read(path):
    return json.loads(path.read_text())


def save(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def sha(value):
    return hashlib.sha256(value).hexdigest()


def compact(text):
    return re.sub(r"\s+", "", text)


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}"


def cues_from_words(words, duration):
    # VTT has millisecond precision; rounding must never extend beyond the MP3.
    duration = math.floor(duration * 1000) / 1000
    groups, group = [], []
    for word in words:
        candidate = "".join(w["word"] for w in group + [word]).strip()
        lines = textwrap.wrap(candidate, width=42, break_long_words=False, break_on_hyphens=False)
        if group and (len(lines) > 2 or word["end"] - group[0]["start"] > 6
                      or word["start"] - group[-1]["end"] > .6
                      or (re.search(r"[.!?]$", group[-1]["word"]) and len(candidate) > 38)):
            groups.append(group)
            group = []
        group.append(word)
    if group:
        groups.append(group)
    cues = []
    for index, group in enumerate(groups):
        start = group[0]["start"]
        next_start = groups[index + 1][0]["start"] if index + 1 < len(groups) else duration
        end = min(next_start, duration, max(start + .7, group[-1]["end"] + .12))
        text = " ".join("".join(w["word"] for w in group).split())
        lines = textwrap.wrap(text, width=42, break_long_words=False, break_on_hyphens=False)
        if not 0 <= start < end <= duration or len(lines) > 2 or any(len(line) > 42 for line in lines):
            raise ValueError(f"Invalid caption: {start}–{end}, {text}")
        cues.append({"start": round(start, 3), "end": round(end, 3), "text": "\n".join(lines)})
    return cues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lesson", required=True, choices=[lesson["lesson"] for lesson in LESSONS])
    parser.add_argument("--slides", help="Comma-separated slide numbers; default: all selected recordings")
    parser.add_argument("--model", default="medium", choices=["base", "small", "medium", "large-v3"])
    parser.add_argument("--model-cache", type=Path, default=MODEL_CACHE)
    parser.add_argument("--threads", type=int, default=6)
    parser.add_argument("--regenerate", action="store_true")
    args = parser.parse_args()
    specification = next(lesson for lesson in LESSONS if lesson["lesson"] == args.lesson)
    source = ROOT / specification["source"]
    output = ROOT / "data/druskininkai/narration/captions"
    # Loading a local checkpoint prevents silent model downloads in the build workflow.
    checkpoint = args.model_cache / (args.model + ".pt")
    if not checkpoint.is_file():
        parser.error(f"Download the Whisper {args.model} model first: {checkpoint}")
    selection = read(source / "audio-approved.json")
    notes = read(source / "speaker-notes-original.json")
    lesson = read(source / "lesson.json")
    wanted = {int(number) for number in args.slides.split(",")} if args.slides else None
    jobs = [slide for slide in lesson["slides"] if slide["alias"] in selection["clips"]
            and (wanted is None or slide["lessonSlide"] in wanted)]
    if not jobs or (wanted and wanted != {slide["lessonSlide"] for slide in jobs}):
        parser.error("Every selected slide must have an approved recording")
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / "manifest.json"
    manifest = read(manifest_path) if manifest_path.exists() else {
        "version": 1, "lesson": selection["lesson"], "languageCode": "lt",
        "audioSelectionSource": str((source / "audio-approved.json").relative_to(ROOT)),
        "textSource": str((source / "speaker-notes-original.json").relative_to(ROOT)),
        "method": "Local Whisper forced alignment of the approved script using stable-ts",
        "sources": ["https://github.com/openai/whisper", "https://github.com/jianfch/stable-ts"],
        "clips": {},
    }
    import torch
    import stable_whisper
    torch.set_num_threads(args.threads)
    model = None
    for slide in jobs:
        alias = slide["alias"]
        clip = selection["clips"][alias]
        audio_path = ROOT / clip["source"]
        if sha(audio_path.read_bytes()) != clip["sha256"]:
            raise ValueError(f"{alias}: approved audio hash mismatch")
        text = " ".join(notes[alias].split())
        text_sha = sha(notes[alias].encode())
        existing = manifest["clips"].get(alias)
        name = Path(clip["source"]).stem
        words_path = output / (name + ".words.json")
        vtt_path = output / (name + ".vtt")
        if (existing and not args.regenerate and existing["audioSha256"] == clip["sha256"]
                and existing["textSha256"] == text_sha and existing["model"] == args.model
                and vtt_path.is_file() and sha(vtt_path.read_bytes()) == existing["sha256"]
                and words_path.is_file() and sha(words_path.read_bytes()) == existing["wordsSha256"]):
            print(f"Slide {slide['lessonSlide']}: existing captions verified", flush=True)
            continue
        if model is None:
            print(f"Loading local Whisper {args.model} on CPU ({args.threads} threads)", flush=True)
            model = stable_whisper.load_model(str(checkpoint), device="cpu")
        started = time.monotonic()
        print(f"Slide {slide['lessonSlide']}: aligning {clip['durationSeconds']:.1f}s", flush=True)
        profiles = [
            {"token_step": 200, "fast_mode": False},
            {"token_step": 100, "fast_mode": False},
            {"token_step": 60, "fast_mode": False},
            # Accurate scripts can need different attention heads, rather than smaller windows.
            {"token_step": 200, "fast_mode": True, "dynamic_heads": "8,3"},
        ]
        for alignment_options in profiles:
            token_step = alignment_options["token_step"]
            result = model.align(str(audio_path), text, language="lt", verbose=None, stream=False,
                                 regroup=False, failure_threshold=.1, **alignment_options)
            words = [] if result is None else [
                {"word": word.word, "start": word.start, "end": word.end}
                for segment in result.segments for word in segment.words]
            if not words or compact("".join(word["word"] for word in words)) != compact(text):
                print(f"Slide {slide['lessonSlide']}: retry with the next alignment profile (incomplete text)", flush=True)
                continue
            instant = int(sum(word["start"] >= word["end"] for word in words))
            if instant / len(words) > .08:
                print(f"Slide {slide['lessonSlide']}: retry with the next alignment profile ({instant}/{len(words)} words without duration)", flush=True)
                continue
            try:
                cues = cues_from_words(words, clip["durationSeconds"])
            except ValueError as error:
                print(f"Slide {slide['lessonSlide']}: retry with the next alignment profile ({error})", flush=True)
                continue
            break
        else:
            raise ValueError(f"{alias}: no complete, well-timed alignment after retries")
        if compact("".join(cue["text"] for cue in cues)) != compact(text):
            raise ValueError(f"{alias}: captions do not preserve the complete approved script")
        save(words_path, {"alias": alias, "words": words, "cues": cues})
        vtt = "WEBVTT\n\n" + "\n\n".join(
            f"{index}\n{timestamp(cue['start'])} --> {timestamp(cue['end'])}\n{html.escape(cue['text'], quote=False)}"
            for index, cue in enumerate(cues, 1)) + "\n"
        vtt_path.write_text(vtt)
        manifest["clips"][alias] = {
            "source": str(vtt_path.relative_to(ROOT)),
            "web": "/captions/" + specification["directory"] + "/" + vtt_path.name,
            "sha256": sha(vtt_path.read_bytes()), "audioSha256": clip["sha256"],
            "textSha256": text_sha, "model": args.model,
            "whisperVersion": importlib.metadata.version("openai-whisper"),
            "stableTsVersion": importlib.metadata.version("stable-ts"),
            "alignmentTokenStep": token_step, "alignmentOptions": alignment_options,
            "wordsSource": str(words_path.relative_to(ROOT)), "wordsSha256": sha(words_path.read_bytes()),
            "cueCount": len(cues), "wordCount": len(words), "zeroDurationWords": instant,
            "durationSeconds": clip["durationSeconds"],
        }
        # Keep the source lesson order even after a partial regeneration.
        manifest["clips"] = {key: manifest["clips"][key] for key in selection["clips"] if key in manifest["clips"]}
        save(manifest_path, manifest)
        print(f"Slide {slide['lessonSlide']}: {len(cues)} cues, {len(words)} words, {time.monotonic() - started:.1f}s processing", flush=True)


if __name__ == "__main__":
    main()
