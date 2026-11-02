import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const base=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fsp.readFile(path.join(base,'model-manifest.json'),'utf8'));
const directory=path.join(base,'models','Qwen2.5-0.5B-Instruct');
async function hash(file){const sha=crypto.createHash('sha256');for await(const data of fs.createReadStream(file))sha.update(data);return sha.digest('hex');}
for(const item of manifest.files){
  const target=path.join(directory,item.file);
  if(fs.existsSync(target) && fs.statSync(target).size===item.bytes && await hash(target)===item.sha256){console.log(`Verified ${item.file}`);continue;}
  await fsp.mkdir(path.dirname(target),{recursive:true});
  console.log(`Downloading ${item.file} (${(item.bytes/1048576).toFixed(1)} MiB)…`);
  const url=`https://huggingface.co/${manifest.model}/resolve/${manifest.revision}/${item.file}`;
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Download failed (${response.status}): ${url}`);
  const temporary=target+'.download';
  await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(temporary));
  if(fs.statSync(temporary).size!==item.bytes || await hash(temporary)!==item.sha256){await fsp.rm(temporary);throw new Error(`Size or SHA-256 mismatch: ${item.file}`);}
  await fsp.rename(temporary,target);
  console.log(`Downloaded and verified ${item.file}`);
}
console.log('Model ready. Start the local server and load it once before the session.');
