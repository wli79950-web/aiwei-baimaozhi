const { chromium } = require('playwright');
(async()=>{
  const [,,file,outdir,scale]=process.argv;
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:Number(scale||1)});
  await p.goto('file://'+require('path').resolve(file)); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(2500);
  await p.evaluate(()=>document.fonts.ready);
  const ids=await p.$$eval('section.frame',s=>s.map(x=>x.id));
  for(const id of ids){ await (await p.$('#'+id)).screenshot({path:`${outdir}/${id}.png`}); console.log(id); }
  await b.close();
})();
