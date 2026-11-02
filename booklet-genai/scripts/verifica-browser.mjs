import {launchBrowser} from '../../scripts/browser.mjs';
import fs from 'node:fs';
const url=process.argv[2]||'http://127.0.0.1:7140/lettura.html';
const browser=await launchBrowser({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 const results=[];
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});
  await page.locator('#size').fill('32');await page.locator('#space').fill('2.3');await page.locator('#spacing').click();
  const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,lang:document.documentElement.lang,sections:document.querySelectorAll('main section').length}));
  results.push(size);if(size.scroll>size.width+1)throw new Error('Horizontal overflow '+JSON.stringify(size));
  await page.locator('#reset').click();await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--reader-size')==='20px',null,{timeout:3000});
 }
 await page.locator('#theme').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark',null,{timeout:3000});
 if(await page.locator('html').getAttribute('data-theme')!=='dark')throw new Error('Theme failed');
 await page.locator('#reset').click();
 if(await page.locator('html').getAttribute('data-theme')!=='light')throw new Error('Reset failed');
 const broken=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>!document.getElementById(h.slice(1))));
 if(broken.length||errors.length)throw new Error(JSON.stringify({broken,errors}));
 const images=await page.locator('main img').evaluateAll(nodes=>nodes.map(n=>({src:n.getAttribute('src'),alt:n.alt})));
 if(images.length!==3||images.some(n=>!n.alt))throw new Error('Missing screenshot or text alternative');
 for(const img of images){const response=await page.request.get(new URL(img.src,url).href);if(!response.ok())throw new Error('Image unavailable: '+img.src);}
 await page.locator('#theme').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark',null,{timeout:3000});
 await page.locator('#reset').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='light',null,{timeout:3000});
 fs.writeFileSync('booklet-genai/build/reading-accessibility-tree.txt',await page.locator('main').ariaSnapshot());
 await page.setViewportSize({width:1280,height:950});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'booklet-genai/build/reading-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#token').evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:'booklet-genai/build/reading-mobile.png'});
 const result={results,errors,broken,themeAndReset:true,keyboardThemeAndReset:true,screenshots:images.length};fs.writeFileSync('booklet-genai/build/reading-check.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close()}
