'use strict';
/* Optional real Chromium check of every page: no script errors, no Content-Security-Policy
   violations and no horizontal page scroll at phone and desktop widths. No hardware access. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pages=['index.html','offline.html','sessions.html','camera-review.html','original_oneport.html'];
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.wasm':'application/wasm'};
(async()=>{const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'missing':data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
  for(const name of pages)for(const width of [390,1365]){
   const page=await browser.newPage({viewport:{width,height:900}}),problems=[];
   page.on('pageerror',e=>problems.push('page error: '+e.message));
   page.on('console',m=>{if(m.type()==='error')problems.push('console error: '+m.text());});
   await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>console.error('CSP violation: '+e.violatedDirective+' '+e.blockedURI)));
   await page.goto(`http://127.0.0.1:${server.address().port}/${name}`);
   assert.ok(await page.$('meta[http-equiv="Content-Security-Policy"]'),name+' declares a CSP');
   await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>{d.open=true;}));await page.waitForTimeout(300);
   const {scroll,inner}=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
   assert.ok(scroll<=inner,`${name} at ${width}px scrolls horizontally (${scroll}px)`);assert.deepEqual(problems,[],name);
   await page.close();
  }
  console.log(`PASS optional real-browser page checks: ${pages.length} pages at 390/1365 px, CSP declared and unviolated, no errors, no horizontal scroll.`);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
