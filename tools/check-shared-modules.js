'use strict';
/* Verifies that every file pinned in SHARED_MODULES.json matches its SHA-256.
   Usage: node tools/check-shared-modules.js           (verify; exit 1 on mismatch)
          node tools/check-shared-modules.js --update  (rewrite pins after an intended change) */
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),pinFile=path.join(root,'SHARED_MODULES.json');
const pins=JSON.parse(fs.readFileSync(pinFile,'utf8')),update=process.argv.includes('--update'),problems=[];
for(const entry of pins.files){
  const file=path.join(root,entry.path);
  if(!fs.existsSync(file)){problems.push(`missing ${entry.path}`);continue;}
  const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(actual===entry.sha256)continue;
  if(update){console.log(`updated ${entry.path}`);entry.sha256=actual;}else problems.push(`hash mismatch ${entry.path}: pinned ${entry.sha256}, actual ${actual}`);
}
if(update)fs.writeFileSync(pinFile,JSON.stringify(pins,null,2)+'\n');
if(problems.length){console.error(problems.join('\n'));console.error('Shared modules differ from SHARED_MODULES.json. Change them in the canonical repository, copy byte-for-byte, then run with --update in both repositories.');process.exit(1);}
console.log(`PASS ${pins.files.length} shared files match SHARED_MODULES.json`);
