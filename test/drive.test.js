// Save-to-Drive tests: page (jsdom) -> mocked fetch -> real Code.gs running on an in-memory Sheets mock
const {JSDOM}=require('jsdom');const fs=require('fs');const {makeGas}=require('./gas_mock');
const html=fs.readFileSync(__dirname+'/../web/index.html','utf8');
let pass=0,fail=0;function check(n,c,d){if(c)pass++;else{fail++;console.log('FAIL:',n,d!==undefined?'\n'+d:'');}}
const URL_='https://script.google.com/macros/s/TESTID/exec';
function mk(gas,opts={}){const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://kiseoglee-crypto.github.io/doppler-report-form/',
 beforeParse(w){w.scrollTo=()=>{};w.__confirms=[];w.__answers=opts.answers||[];w.confirm=m=>{w.__confirms.push(m);return w.__answers.length?w.__answers.shift():false;};
  w.__fetches=[];w.fetch=async(u,o)=>{w.__fetches.push({u,o});if(opts.fetchFail)throw new TypeError('Failed to fetch');
   if(o.headers['Content-Type'].indexOf('text/plain')!==0)throw new Error('must be text/plain (no CORS preflight)');
   const out=gas.ctx.doPost({postData:{contents:o.body}}).content;return{ok:true,text:async()=>out};};}});
 return dom.window;}
const tick=()=>new Promise(r=>setTimeout(r,0));
async function save(w){await w.DL.saveToDrive();await tick();return w.document.querySelector('#driveStatus').textContent;}
function fill(w,tab,mut){const S=w.DL.defaultState();S.tab=tab;Object.assign(S.common,{pid:'00012345',age:'67',sex:'M',date:'2026-11-14',equip:'TestSys',probe:'L12-3',sono:'Kim Sonographer',phys:'Dr. Lee Reader'});mut&&mut(S);w.DL.state=S;w.DL.render();}
(async()=>{
 const gas=makeGas();const secret=gas.ctx.setup();
 check('setup creates 3 tabs',['Arterial','Venous','DVT'].every(n=>gas.sheets[n]),Object.keys(gas.sheets));
 check('secret generated (64 hex)',/^[0-9a-f]{64}$/.test(secret),secret);
 // ---- no settings
 let w=mk(gas);fill(w,'art');
 let st=await save(w);check('no URL -> clear failure',/FAILED: Apps Script URL is not set/.test(st),st);
 check('no patient data in localStorage',w.localStorage.length===0);
 // ---- configure via UI
 const d=w.document;d.querySelector('#cfgUrl').value=URL_;d.querySelector('#cfgSecret').value=secret;d.querySelector('#btnCfgSave').click();
 const stored=JSON.parse(w.localStorage.getItem('dopplerDriveCfg'));
 check('localStorage holds only url+secret',w.localStorage.length===1&&Object.keys(stored).sort().join()==='secret,url',JSON.stringify(stored));
 d.querySelector('#btnCfgTest').click();await tick();await tick();
 check('ping ok',/Connected: "Doppler Report Data"/.test(d.querySelector('#driveStatus').textContent),d.querySelector('#driveStatus').textContent);
 // ---- reg no required
 fill(w,'art',S=>{S.common.pid='  ';});st=await save(w);check('reg no required',/Registration No\. is required/.test(st)&&w.__fetches.filter(f=>/"save"/.test(f.o.body)).length===0,st);
 // ---- arterial save
 fill(w,'art',S=>{S.hdr.art.ind=['Claudication'];S.lesions.push({side:'Rt',seg:'SFA_D',psvL:'380',psvR:'90',grade:'auto',len:'3'});Object.assign(S.abi,{brR:'130',brL:'128',dpR:'80',ptR:'75',dpL:'135',ptL:'140'});});
 st=await save(w);check('art saved',/Saved to sheet "Arterial" \(new row 2\)/.test(st),st);
 const A=gas.sheets.Arterial,hdr=A.cells[0],row=A.cells[1],col=k=>row[hdr.indexOf(k)];
 check('fetch is text/plain POST',w.__fetches.every(f=>f.o.method==='POST'&&/^text\/plain/.test(f.o.headers['Content-Type'])));
 check('reg_no leading zeros kept',col('reg_no')==='00012345',col('reg_no'));
 check('exact date, age, sex, type',col('exam_date')==='2026-11-14'&&col('age')==='67'&&col('sex')==='M'&&col('exam_type')==='Arterial');
 check('no name/DOB columns',!hdr.some(h=>/name|dob|birth/i.test(h)),hdr.filter(h=>/name|dob|birth/i.test(h)));
 const allText=row.join('\n');
 check('sonographer/physician names not stored anywhere',!/Kim Sonographer|Lee Reader/.test(allText),allText.match(/.{0,40}(Kim Sonographer|Lee Reader).{0,20}/));
 check('wide Rt/Lt segment columns',hdr.includes('Rt_SFA_M_phas')&&hdr.includes('Lt_DPA_psv')&&col('Rt_CFA_phas')==='multiphasic');
 check('ABI auto columns',col('ABI_Rt')==='0.62'&&col('ABI_Rt_class')==='pad'&&col('ABI_Lt_class')==='normal',[col('ABI_Rt'),col('ABI_Rt_class')]);
 check('lesion auto grade in json',JSON.parse(col('lesions_json'))[0].grade_auto==='>=75%');
 check('impression + report stored',/75% or greater/.test(col('impression_text'))&&/^EXAM: Lower extremity arterial/.test(col('report_text'))&&/Sonographer: \[ \]/.test(col('report_text')));
 const ij=JSON.parse(col('input_json'));check('input_json re-importable',ij.tab==='art'&&ij.seg.Rt.CFA&&ij.common.pid==='00012345'&&!('sono' in ij.common)&&!('phys' in ij.common));
 check('case_uid + saved_at',col('case_uid').length>8&&/^\d{4}-\d\d-\d\dT/.test(col('saved_at')));
 check('patient data still not in localStorage',w.localStorage.length===1&&!/00012345/.test(w.localStorage.getItem('dopplerDriveCfg')));
 // ---- duplicate: cancel/cancel -> not saved
 w.__answers=[false,false];st=await save(w);check('dup cancel',/Save cancelled/.test(st)&&A.getLastRow()===2&&w.__confirms.some(m=>/already exists \(1 row/.test(m)),st+'|'+w.__confirms.join('|'));
 // ---- duplicate: overwrite
 fill(w,'art',S=>{S.hdr.art.ind=['Rest pain'];});w.__answers=[true];st=await save(w);
 check('dup overwrite same row',/overwritten row 2/.test(st)&&A.getLastRow()===2&&A.cells[1][hdr.indexOf('indication')]==='Rest pain',st);
 // ---- duplicate: append
 w.__answers=[false,true];st=await save(w);check('dup append new row',/new row 3/.test(st)&&A.getLastRow()===3,st);
 // ---- server-side guard without mode
 const g=gas.post(JSON.stringify({secret,action:'save',sheet:'Arterial',key:{reg_no:'00012345',exam_date:'2026-11-14',exam_type:'Arterial'},columns:['reg_no','exam_date','exam_type'],values:['00012345','2026-11-14','Arterial']}));
 check('server rejects silent duplicate',g.ok===false&&g.duplicate===true,JSON.stringify(g));
 check('server rejects name column',gas.post(JSON.stringify({secret,action:'save',sheet:'DVT',mode:'append',key:{reg_no:'1',exam_date:'2026-01-01'},columns:['reg_no','exam_date','patient_name'],values:['1','2026-01-01','X']})).ok===false);
 check('server rejects bad secret',gas.post(JSON.stringify({secret:'wrong',action:'ping'})).error==='Invalid secret.');
 check('server rejects unknown sheet',gas.post(JSON.stringify({secret,action:'check',sheet:'Foo',key:{}})).ok===false);
 // ---- venous with CEAP, unilateral
 fill(w,'ven',S=>{S.hdr.ven.side='Right';S.hdr.ven.ind=['Varicose veins'];const R=S.seg.ven.Rt;R.SFJ.rt='2';Object.assign(R.GSV_PT,{rt:'2.5',diam:'7'});S.venx.ceapCR=['C2','C4a'];S.venx.ceapSR='s';});
 st=await save(w);const V=gas.sheets.Venous,vh=V.cells[0],vr=V.cells[1],vc=k=>vr[vh.indexOf(k)];
 check('ven saved',/Saved to sheet "Venous" \(new row 2\)/.test(st),st);
 check('CEAP basic/advanced columns',vc('CEAP_Rt_basic')==='C4a,s Ep As Pr'&&vc('CEAP_Rt_advanced')==='C2,4a,s Ep As Pr GSVa'&&vc('CEAP_Lt_basic')==='',[vc('CEAP_Rt_basic'),vc('CEAP_Rt_advanced')]);
 check('reflux auto per segment',vc('Rt_GSV_PT_reflux_auto')==='Y'&&vc('Rt_GSV_MT_reflux_auto')==='N'&&vc('Rt_GSV_PT_rt')==='2.5');
 check('non-examined side blank except contra CFV',vc('Lt_GSV_PT_rt')===''&&vc('Lt_GSV_PT_pat')===''&&vc('Lt_CFV_pat')==='compressible',[vc('Lt_GSV_PT_pat'),vc('Lt_CFV_pat')]);
 check('ven arrays flattened',vc('venx_ceapCR')==='C2; C4a'&&vc('reflux_maneuver').includes('Valsalva'));
 // ---- dvt
 fill(w,'dvt',S=>{S.hdr.dvt.ind=['Suspected DVT'];Object.assign(S.seg.dvt.Lt.POPV,{comp:'none',thr:'occlusive',echo:'hypoechoic',color:'absent'});});
 st=await save(w);const D=gas.sheets.DVT,dh=D.cells[0],dr=D.cells[1],dc=k=>dr[dh.indexOf(k)];
 check('dvt saved + thrombus auto',/"DVT"/.test(st)&&dc('Lt_POPV_thrombus_auto')==='Y'&&dc('Lt_CFV_thrombus_auto')==='N'&&/deep vein thrombosis/.test(dc('impression_text')),st);
 check('dvt same reg/date but other tab is not a duplicate',w.__confirms.length===5,w.__confirms.length);
 // ---- manual edit: final text stored, names scrubbed
 fill(w,'dvt');w.document.querySelector('#report').value='EDITED Sonographer: Kim Sonographer Dr. Lee Reader';w.document.querySelector('#report').dispatchEvent(new w.Event('input',{bubbles:true}));
 w.__answers=[false,true];st=await save(w);const last=D.cells[D.getLastRow()-1];
 check('manual edited text stored scrubbed',last[dh.indexOf('report_manually_edited')]==='Y'&&last[dh.indexOf('report_text_final')]==='EDITED Sonographer: [ ] [ ]',last[dh.indexOf('report_text_final')]);
 // ---- network failure
 const w2=mk(gas,{fetchFail:true});w2.localStorage.setItem('dopplerDriveCfg',JSON.stringify({url:URL_,secret}));fill(w2,'art');st=await save(w2);
 check('network failure message',/FAILED: Network\/CORS error/.test(st),st);
 // ---- wrong secret surfaced
 const w3=mk(gas);w3.localStorage.setItem('dopplerDriveCfg',JSON.stringify({url:URL_,secret:'bad'}));fill(w3,'art');st=await save(w3);
 check('wrong secret message',/FAILED: Invalid secret/.test(st),st);
 // ---- non-google URL refused
 const w4=mk(gas);w4.localStorage.setItem('dopplerDriveCfg',JSON.stringify({url:'https://evil.example.com/x',secret}));fill(w4,'art');st=await save(w4);
 check('non-Google URL refused',/must start with https:\/\/script\.google\.com/.test(st)&&w4.__fetches.length===0,st);
 // ---- header row for sheet template
 const cols={};for(const t of ['art','ven','dvt']){fill(w,t);cols[w.DL.SHEETNAME[t]]=w.DL.exportRow(t).columns;}
 fs.writeFileSync(__dirname+'/sheet_headers.json',JSON.stringify(cols));
 check('input_json under cell limit',['art','ven','dvt'].every(t=>{fill(w,t);const r=w.DL.exportRow(t);return r.values[r.columns.indexOf('input_json')].length<45000;}));
 console.log(`PASS ${pass}  FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
