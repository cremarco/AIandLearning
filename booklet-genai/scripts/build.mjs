import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(command,args)=>{
 const p=spawnSync(command,args,{cwd:folder,encoding:'utf8'});
 if(p.error)throw p.error;
 if(p.status!==0||/warning:/i.test(p.stderr))throw new Error(`${command} failed: ${p.stderr}`);
 if(p.stdout)process.stdout.write(p.stdout);
};
run(process.execPath,['scripts/genera.mjs']);
fs.mkdirSync(path.join(folder,'build'),{recursive:true});
run(process.env.BOOKLET_TYPST||'typst',['compile','--ignore-system-fonts','--font-path','assets/fonts','--pdf-standard','ua-1','main.typ','build/Fondamenti_GenAI_Cremaschi.pdf']);
const target=path.resolve(folder,'../public/materials/booklet-genai');
fs.mkdirSync(target,{recursive:true});
for (const filename of ['lettura.html', 'lettura.css', 'lettura.js']) {
 let content = fs.readFileSync(path.join(folder, filename), 'utf8');
 if (filename === 'lettura.html') content = content.replace('href="build/Fondamenti_GenAI_Cremaschi.pdf"', 'href="Fondamenti_GenAI_Cremaschi.pdf"');
 fs.writeFileSync(path.join(target, filename), content);
}
// The cover illustration and italic font are Typst sources, not reader dependencies.
fs.rmSync(path.join(target, 'assets'), { recursive: true, force: true });
for (const relative of [
 'daisyui.css', 'daisyui-LICENSE',
 'fonts/dm-sans-variabile.ttf', 'fonts/sora-variabile.ttf',
 'fonts/dm-sans-licenza.txt', 'fonts/sora-licenza.txt',
 ...fs.readdirSync(path.join(folder, 'assets/screens')).filter(name => name.endsWith('.png')).map(name => `screens/${name}`),
]) {
 const destination = path.join(target, 'assets', relative);
 fs.mkdirSync(path.dirname(destination), { recursive: true });
 fs.copyFileSync(path.join(folder, 'assets', relative), destination);
}
fs.copyFileSync(path.join(folder,'build/Fondamenti_GenAI_Cremaschi.pdf'),path.join(target,'Fondamenti_GenAI_Cremaschi.pdf'));
console.log('Built PDF/UA-1 target and copied the English reading edition to public/materials/booklet-genai.');
