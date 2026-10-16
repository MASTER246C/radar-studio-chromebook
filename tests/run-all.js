'use strict';
/* Runs every deterministic suite in this folder: *.test.js and *.test.mjs.
   *.optional.test.js suites need Playwright/Chromium and run separately. */
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const suites=fs.readdirSync(__dirname).filter(name=>/\.test\.m?js$/.test(name)&&!/\.optional\.test\.js$/.test(name)).sort();
const failed=[];
for(const name of suites){
  const r=spawnSync(process.execPath,[path.join(__dirname,name)],{stdio:'inherit'});
  if(r.error)console.error(r.error);
  if(r.error||r.status!==0)failed.push(name);
}
if(failed.length){console.error(`FAIL ${failed.length} of ${suites.length} deterministic suites: ${failed.join(', ')}`);process.exit(1);}
console.log(`PASS all ${suites.length} deterministic suites. Optional real-browser and hardware checks are not included.`);
