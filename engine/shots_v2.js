const { chromium } = require('playwright');
(async()=>{
  const [,,file,times,out,guide]=process.argv;
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1920,height:1080}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+require('path').resolve(file)+(guide==='1'?'?guide=1':''));
  await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1500);
  for(const t of times.split(',').map(Number)){ await p.evaluate(t=>window.renderAt(t),t); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(100); await p.screenshot({path:`${out}/v2_${t.toFixed(2)}.png`}); }
  if(errs.length) console.log('ERRORS:',errs.slice(0,5).join('\n'));
  await b.close();
})();
