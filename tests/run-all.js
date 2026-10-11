'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const tests=['protocol','expansion','legacy','cpd','legacy_panels','vitals','trails','scene','telemetry','catalog','motion','capture','motion_panel','offline_features','offline_model','offline_review','offline_cli','offline_ui','ui','original_radar','original_panel','original_gate','original_tracker','original_dual','original_dual_panel','original_sessions','session_ui'];
for(const name of tests){const r=spawnSync(process.execPath,[path.join(__dirname,name+'.test.js')],{stdio:'inherit'});if(r.error){console.error(r.error);process.exit(1);}if(r.status!==0)process.exit(r.status||1);}
console.log('PASS all 27 deterministic suites. Optional real-browser and hardware checks are not included.');
