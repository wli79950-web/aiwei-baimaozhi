const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+require('path').resolve(process.argv[2]));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1500);
await (await p.$('#b')).screenshot({path:process.argv[3]});await b.close();})();
