const puppeteer=require('puppeteer-core');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu']});
 const ctx=b.defaultBrowserContext();await ctx.overridePermissions('file:///workspace/doppler_forms/web/index.html',['clipboard-read','clipboard-write','clipboard-sanitized-write']).catch(e=>console.log('perm',e.message));const url='file:///workspace/doppler_forms/web/index.html';

 const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.setViewport({width:1600,height:1000});
 const t0=Date.now();await p.goto(url);const loadMs=Date.now()-t0;
 const ext=await p.evaluate(()=>[...document.querySelectorAll('script[src],link[href]')].length);
 await p.screenshot({path:'shot_art.png'});
 // abnormal art via clicks
await p.select('select[data-p="seg.art.Rt.SFA_M.plaque"]','calcified');
 await p.click('[data-add="lesions"]');await p.select('select[data-p="lesions.0.seg"]','SFA_D');
 await p.type('input[data-p="lesions.0.psvL"]','300');await p.type('input[data-p="lesions.0.psvR"]','100');await p.keyboard.press('Tab');
 const artTxt=await p.$eval('#report',e=>e.value);
 // copy
 p.on('dialog',d=>{errs.push('unexpected dialog: '+d.message());d.dismiss();});await p.evaluate(()=>window.scrollTo(0,0));const bb=await p.$eval('#btnCopy',e=>{const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});await p.mouse.click(bb[0],bb[1]);await new Promise(r=>setTimeout(r,2000));const toastTxt=await p.$eval('#toast',e=>e.textContent);
 let clip='';try{clip=await p.evaluate(()=>navigator.clipboard.readText());}catch(e){clip='ERR '+e.message;}
 await p.screenshot({path:'shot_art2.png'});
 await p.click('[data-tab="ven"]');await p.screenshot({path:'shot_ven.png',fullPage:false});
 for(const v of ['C2','C3','C4a'])await p.click(`[data-chip="venx.ceapCR"][data-v="${v}"]`);
 await p.select('select[data-p="venx.ceapSR"]','s');
 await p.click('input[data-p="seg.ven.Rt.GSV_PT.rt"]');await p.keyboard.type('2.0');await p.keyboard.press('Tab');await new Promise(r=>setTimeout(r,200));
 const ceapEl=await p.$('[data-ceap="Rt"]');await ceapEl.evaluate(e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,100));await ceapEl.screenshot({path:'shot_ceap.png'});
 const venTxt=await p.$eval('#report',e=>e.value);const ceapOK=venTxt.includes('Right CEAP 2020: C4a,s Ep As Pr (advanced: C2,3,4a,s Ep As Pr GSVa).');
 const ceapLbl=await p.$eval('[data-ceap="Rt"]',e=>e.textContent.includes('auto: As'));
 await p.click('[data-tab="dvt"]');await p.select('select[data-p="seg.dvt.Rt.POPV.comp"]','none');await p.select('select[data-p="seg.dvt.Rt.POPV.thr"]','occlusive');
 await p.screenshot({path:'shot_dvt.png'});
 const dvtTxt=await p.$eval('#report',e=>e.value);
 // timing of regenerate
 const perf=await p.evaluate(()=>{const t=performance.now();for(let i=0;i<50;i++)DL.render();return (performance.now()-t)/50;});
console.log(JSON.stringify({ceapOK,ceapLbl,ceapLine:venTxt.split('\n').filter(l=>/CEAP/.test(l)),loadMs,externalRefs:ext,errors:errs,toast:toastTxt,copyOK:clip===artTxt,clipStart:clip.slice(0,60),renderMs:perf.toFixed(1),
  artHas:artTxt.includes('1. Right distal superficial femoral artery: 50-74% diameter stenosis (velocity ratio 3).')&&artTxt.includes('Right mid superficial femoral artery: antegrade, multiphasic, high resistive waveform with rapid upstroke; calcified plaque.')&&!/Right common femoral artery.*distal superficial femoral artery.*no plaque/.test(artTxt),dvtHas:dvtTxt.includes('Right indeterminate-age occlusive deep vein thrombosis involving the popliteal vein (proximal DVT).')},null,1));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
