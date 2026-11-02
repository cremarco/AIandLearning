import { launchBrowser } from '../../scripts/browser.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await launchBrowser({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
page.on('console',message=>{if(message.type()==='error')console.log('console:',message.text().slice(0,300));});
page.on('pageerror',error=>console.log('pageerror:',error.message));
page.on('requestfailed',r=>console.log('requestfailed:',r.url(),r.failure()));
await page.goto(process.argv[2] || 'http://127.0.0.1:4176/materials/demo-genai/?device=wasm');
await page.click('#load');
console.log('Load clicked');
await page.waitForFunction(()=>window.__genai?.state.model || document.getElementById('status').classList.contains('error'),{timeout:300000});
console.log(await page.locator('#status').innerText());
if(!await page.evaluate(()=>!!window.__genai.state.model)){await browser.close();process.exit(1);}
await page.click('#analyze');
await page.waitForFunction(()=>window.__genai?.state.logits && !window.__genai?.state.busy,{timeout:300000});
console.log(await page.locator('#status').innerText());
const result=await page.evaluate(()=>{
  const s=window.__genai.state;
  return {loadSeconds:s.loadSeconds,inferSeconds:s.inferSeconds,device:s.device,run:s.run,probabilitySum:s.probabilities.reduce((sum,x)=>sum+x,0)};
});
assert.ok(result.run, 'Inference must produce a usable result.');
assert.ok(Math.abs(result.probabilitySum-1)<1e-10);
await fs.writeFile('demo-genai/captures/real-inference.json',JSON.stringify(result,null,2));
await page.screenshot({path:'demo-genai/captures/real-inference.png',fullPage:true});
console.log(JSON.stringify(result,null,2));
await browser.close();
