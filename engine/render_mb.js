// usage: node render_mb.js page.html t0 t1 outdir samples [workerIdx workerCount]
const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{
  const [,,file,t0s,t1s,out,ss,wi='0',wc='1']=process.argv; const t0=+t0s,t1=+t1s,S=+ss,FPS=60,W=+wi,WC=+wc;
  fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1920,height:1080}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.resolve(file)); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1500);
  const n0=Math.round(t0*FPS), n1=Math.round(t1*FPS); let done=0; const st=Date.now();
  for(let f=n0+W; f<n1; f+=WC){
    for(let i=0;i<S;i++){
      const off = S===1?0:(i/(S-1)-0.5)*(0.5/FPS);   // 180° shutter
      const t=Math.max(0,f/FPS+off);
      await p.evaluate(t=>window.renderAt(t),t);
      await p.screenshot({path:`${out}/s_${String((f-n0)*S+i).padStart(7,'0')}.png`});
    }
    if(++done%60===0) console.log(`w${W} ${done} frames ${((Date.now()-st)/done).toFixed(0)}ms/frame`);
  }
  if(errs.length) console.log('ERR',errs.slice(0,3));
  await b.close();
})();
