const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('../web/index.html','utf8');
let pass=0,fail=0;const out=[];
function mk(){const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true});const w=dom.window;w.scrollTo=()=>{};return w;}
function check(name,cond,detail){if(cond){pass++;}else{fail++;console.log('FAIL:',name,detail?'\n'+detail:'');}}
function gen(w,tab,mut){const S=w.DL.defaultState();S.tab=tab;S.common.equip='TestSys';S.common.probe='L12-3';S.common.phys='Dr. X';mut&&mut(S);w.DL.state=S;return w.DL.genReport(tab);}
const w=mk();
// 1 arterial normal
let r=gen(w,'art',S=>{S.hdr.art.ind=['Claudication'];});
check('art normal Rt',r.text.includes('Right lower extremity: no hemodynamically significant (50% or greater) arterial stenosis or occlusion.'),r.text);
check('art normal Lt',r.text.includes('Left lower extremity: no hemodynamically significant'),r.text);
check('art normal grouping',/Right common femoral artery, profunda femoris artery, .*dorsalis/.test(r.text)===false&&r.text.includes('Right common femoral artery, profunda femoris artery'),r.text);
check('art no warnings when complete',r.warnings.length===0,r.warnings.join('|'));
out.push('=== ARTERIAL: normal bilateral ===\n'+r.text);
// 2 arterial example
r=gen(w,'art',S=>{S.hdr.art.ind=['Claudication'];const R=S.seg.art.Rt;R.CFA.psv='110';R.CFA.at='90';R.SFA_M.plaque='calcified';
 Object.assign(R.POPA,{phas:'monophasic',res:'low',up:'prolonged',mods:['dampened'],psv:'40'});Object.assign(R.ATA,{phas:'monophasic',res:'low',up:'prolonged',mods:['dampened']});
 S.lesions.push({side:'Rt',seg:'SFA_D',psvL:'380',psvR:'90',grade:'auto',len:'3'});Object.assign(S.abi,{brR:'130',brL:'128',dpR:'80',ptR:'75',dpL:'135',ptL:'140'});});
check('VR 4.2 >=75%',r.text.includes('velocity ratio 4.2')&&r.text.includes('Right distal superficial femoral artery: 75% or greater diameter stenosis (velocity ratio 4.2).'),r.text);
check('distal damp explained',r.text.includes('dampened monophasic waveforms in the popliteal artery and anterior tibial artery are consistent with the more proximal flow-limiting disease'),r.text);
check('ABI Rt 0.62 PAD',r.text.includes('Right ABI 0.62, consistent with peripheral arterial disease.'),r.text);
check('ABI Lt 1.08 normal',r.text.includes('Left ABI 1.08, within normal range.'),r.text);
check('plaque finding',r.text.includes('mid superficial femoral artery: antegrade, multiphasic, high resistive waveform with rapid upstroke; calcified plaque.'),r.text);
out.push('=== ARTERIAL: Rt SFA stenosis + ABI ===\n'+r.text);
// 3 VR boundaries
for(const [pl,pr,exp] of [[190,100,'less than 50%'],[200,100,'50-74%'],[390,100,'50-74%'],[400,100,'75% or greater']]){
 r=gen(w,'art',S=>{S.lesions.push({side:'Lt',seg:'POPA',psvL:String(pl),psvR:String(pr),grade:'auto'});});
 check(`VR ${pl/pr} -> ${exp}`,r.text.includes(`consistent with ${exp} diameter stenosis`),r.text);}
// override
r=gen(w,'art',S=>{S.lesions.push({side:'Lt',seg:'POPA',psvL:'190',psvR:'100',grade:'>=75%'});});
check('grade override',r.text.includes('75% or greater diameter stenosis'),r.text);
r=gen(w,'art',S=>{S.lesions.push({side:'Lt',seg:'POPA',psvL:'190',psvR:'',grade:'auto'});});
check('missing ref warns',r.warnings.some(x=>/proximal reference/.test(x)),r.warnings.join('|'));
// 4 occlusion
r=gen(w,'art',S=>{S.hdr.art.side='Left';Object.assign(S.seg.art.Lt.SFA_M,{occ:true,recon:'POPA'});Object.assign(S.seg.art.Lt.POPA,{phas:'monophasic',res:'low',up:'prolonged',mods:['dampened']});});
check('occlusion + recon',r.text.includes('Left mid superficial femoral artery occlusion, with reconstitution at the popliteal artery.'),r.text);
check('unilateral no Right',!/\nRight /.test(r.text),r.text);
check('distal to occl explained',r.text.includes('popliteal artery are consistent with the more proximal'),r.text);
out.push('=== ARTERIAL: Lt SFA occlusion ===\n'+r.text);
// 5 CFA AT
r=gen(w,'art',S=>{S.seg.art.Rt.CFA.at='160';});
check('CFA AT>140 inflow',r.text.includes('suggests proximal (aortoiliac) inflow disease'),r.text);
r=gen(w,'art',S=>{S.seg.art.Rt.CFA.at='140';});
check('CFA AT=140 not inflow',!r.text.includes('inflow disease'),r.text);
// unexplained damp
r=gen(w,'art',S=>{Object.assign(S.seg.art.Rt.PTA,{phas:'monophasic',up:'prolonged'});});
check('unexplained damp',r.text.includes('not directly identified'),r.text);
// 6 ABI classes
for(const [v,exp] of [['1.5','non-compressible'],['1.4','within normal range'],['0.9','within normal range'],['0.89','consistent with peripheral arterial disease'],['0.5','consistent with peripheral arterial disease'],['0.49','severe peripheral arterial disease']]){
 r=gen(w,'art',S=>{S.abi.abiR=v;});check(`ABI ${v} -> ${exp}`,r.text.includes(exp),r.text.split('\n').filter(l=>/ABI/.test(l)).join('|'));}
// 7 venous example
r=gen(w,'ven',S=>{S.hdr.ven.side='Right';S.hdr.ven.ind=['Varicose veins'];S.hdr.ven.pos=['Standing'];const R=S.seg.ven.Rt;
 R.SFJ.rt='2.1';Object.assign(R.GSV_PT,{diam:'7.2',rt:'2.5'});Object.assign(R.GSV_MT,{diam:'6.1',rt:'2.2'});Object.assign(R.GSV_DT,{diam:'5.4',rt:'1.8'});Object.assign(R.GSV_K,{diam:'4.2',rt:'0.2'});
 R.CFV.rt='0.3';R.FV_P.rt='0.4';R.POPV.rt='0.5';R.SPJ.rt='0.1';Object.assign(R.SSV_P,{diam:'3.2',rt:'0.1'});
 S.perfs.push({side:'Rt',group:'calf medial posterior tibial',dist:'12',ref:'from the heel',diam:'4.0',t:'0.9',conn:'posterior arch vein',ulcer:false});
 S.varis.push({side:'Rt',loc:'medial calf',diam:'6',src:'GSV'});S.venx.ceapCR=['C2'];S.venx.ceapSR='s';});
check('SFJ+GSV to distal thigh',r.text.includes('Right saphenofemoral junction incompetence with great saphenous vein reflux from the SFJ to the distal thigh (GSV diameter 5.4-7.2 mm).'),r.text);
check('perf pathologic',r.text.includes('Right incompetent (pathologic) calf medial posterior tibial perforator (4 mm, 0.9 s).'),r.text);
check('no deep reflux',r.text.includes('Right no deep venous reflux; deep veins compressible.'),r.text);
check('contralateral CFV',r.text.includes('Contralateral left common femoral vein: compressible; spontaneous, respirophasic flow.'),r.text);
check('CEAP auto',r.text.includes('Right CEAP 2020: C2,s Ep As,p Pr (advanced: C2,s Ep As,p Pr GSVa, CPV).'),r.text);
check('ven no warnings',r.warnings.length===0,r.warnings.join('|'));
r=gen(w,'ven',S=>{S.hdr.ven.side='Left';});check('GSV/SSV diameter warn',r.warnings.some(x=>/GSV diameter not entered/.test(x))&&r.warnings.some(x=>/SSV diameter/.test(x)),r.warnings.join('|'));
out.push('=== VENOUS: Rt SFJ/GSV reflux ===\n'+r.text);
// 8 thresholds
const vt=(seg,t)=>gen(w,'ven',S=>{S.hdr.ven.side='Right';S.seg.ven.Rt[seg].rt=String(t);});
check('GSV 0.5 not reflux',!vt('GSV_MT',0.5).text.includes('reflux present'));
check('GSV 0.6 reflux',vt('GSV_MT',0.6).text.includes('mid thigh: reflux present (0.6 s)'),vt('GSV_MT',0.6).text);
check('FV 1.0 not reflux',!vt('FV_P',1.0).text.includes('deep venous reflux in'));
check('FV 1.1 reflux',vt('FV_P',1.1).text.includes('deep venous reflux in the proximal femoral vein'));
check('PTV 0.6 reflux (other deep 0.5)',gen(w,'ven',S=>{S.hdr.ven.side='Right';S.seg.ven.Rt.PTV.st='ex';S.seg.ven.Rt.PTV.rt='0.6';}).text.includes('deep venous reflux in the posterior tibial veins'));
r=gen(w,'ven',S=>{S.perfs.push({side:'Rt',group:'thigh medial',dist:'',ref:'below the groin',diam:'3.4',t:'0.5',conn:'GSV',ulcer:false});});
check('perf 3.4mm/0.5s incompetent not pathologic',r.text.includes('Right incompetent thigh medial perforator')&&!r.text.includes('pathologic'),r.text);
r=gen(w,'ven',S=>{S.perfs.push({side:'Rt',group:'thigh medial',dist:'',ref:'below the groin',diam:'5',t:'0.4',conn:'GSV',ulcer:false});});
check('perf 0.4s competent',r.text.includes('; competent.')&&!/incompetent/.test(r.text),r.text);
// 9 segmental
r=gen(w,'ven',S=>{S.seg.ven.Lt.GSV_K.rt='1.2';S.seg.ven.Lt.GSV_PC.rt='1.0';});
check('segmental GSV',r.text.includes('Left segmental great saphenous vein reflux at the knee and proximal calf with a competent SFJ.'),r.text);
check('segmental warn',r.warnings.some(x=>/identify the source/.test(x)),r.warnings.join('|'));
// SPJ/SSV
r=gen(w,'ven',S=>{const L=S.seg.ven.Lt;L.SPJ.rt='1.5';Object.assign(L.SSV_P,{rt:'2',diam:'5.5'});Object.assign(L.SSV_M,{rt:'1.2',diam:'4.8'});});
check('SPJ+SSV',r.text.includes('Left saphenopopliteal junction incompetence with small saphenous vein reflux to the mid calf (SSV diameter up to 5.5 mm).'),r.text);
// 10 CFV continuous / pulsatile
r=gen(w,'ven',S=>{S.seg.ven.Rt.CFV.pattern='continuous';});
check('ven central',r.text.includes('Right continuous/non-spontaneous common femoral vein flow suggests more central'),r.text);
r=gen(w,'ven',S=>{S.seg.ven.Rt.CFV.pattern='continuous';S.seg.ven.Rt.GSV_MT.rt='1';S.venx.ceapCR=['C3'];S.venx.ceapSR='s';});
check('CEAP central flow: no auto Po, warns',r.text.includes('Right CEAP 2020: C3,s Ep As Pr (advanced: C3,s Ep As Pr GSVa).')&&r.warnings.some(x=>/add Po/.test(x)),r.text+'\n'+r.warnings.join('|'));
r=gen(w,'ven',S=>{S.seg.ven.Rt.CFV.pattern='pulsatile';S.seg.ven.Lt.CFV.pattern='pulsatile';});
check('pulsatile bilateral',r.text.includes('Pulsatile common femoral vein flow bilaterally'),r.text);
// 11 varicosity unknown
r=gen(w,'ven',S=>{S.varis.push({side:'Lt',loc:'lateral thigh',diam:'5',src:'unknown'});});
check('vari unknown warn+imp',r.warnings.some(x=>/source of reflux not documented/.test(x))&&r.text.includes('Left source of reflux for the lateral thigh varicosities not identified.'),r.text);
// ablated
r=gen(w,'ven',S=>{Object.assign(S.seg.ven.Rt.GSV_PT,{pat:'ablated',treated:true});});
check('ablated',r.text.includes('Right GSV, proximal thigh: treated segment, occluded (post-ablation).'),r.text);
// unilateral w/o contra CFV
r=gen(w,'ven',S=>{S.hdr.ven.side='Right';S.seg.ven.Lt.CFV.st='ne';});
check('contra CFV warn',r.warnings.some(x=>/contralateral/.test(x)),r.warnings.join('|'));
// 12 DVT example
r=gen(w,'dvt',S=>{S.hdr.dvt.side='Left';S.hdr.dvt.ind=['Leg swelling','Elevated D-dimer'];const L=S.seg.dvt.Lt;
 Object.assign(L.FV_D,{comp:'none',thr:'occlusive',echo:'hypoechoic',size:'distended',feat:['smooth margins'],color:'absent'});
 Object.assign(L.POPV,{comp:'none',thr:'occlusive',echo:'hypoechoic',size:'distended',color:'absent'});L.CFV.aug='reduced';});
check('DVT acute occlusive proximal',r.text.includes('Left acute occlusive deep vein thrombosis involving the distal femoral vein and popliteal vein (proximal DVT).'),r.text);
check('DVT contra',r.text.includes('Contralateral right common femoral vein compressible with respirophasic flow.'),r.text);
check('DVT reduced aug not when thrombus elsewhere',!r.text.includes('cannot be excluded'),r.text);
out.push('=== DVT: Lt acute proximal DVT ===\n'+r.text);
// 13
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.FV_M,{comp:'partial',thr:'non-occlusive',echo:'hyperechoic',size:'contracted',feat:['wall thickening','synechiae/webs','recanalization channels']});});
check('DVT chronic',r.text.includes('Right chronic non-occlusive post-thrombotic (chronic) venous thrombus involving the mid femoral vein (proximal DVT).'),r.text);
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.PTV,{comp:'none',thr:'occlusive',echo:'hypoechoic'});});
check('DVT distal calf',r.text.includes('(distal (calf) DVT)'),r.text);
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.SOV,{comp:'none',thr:'occlusive'});});
check('DVT muscular indeterminate',r.text.includes('Right indeterminate-age occlusive deep vein thrombosis involving the soleal veins (isolated muscular calf vein thrombosis).'),r.text);
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.POPV,{comp:'partial',thr:'non-occlusive',echo:'hypoechoic',feat:['free-floating tail','wall thickening']});Object.assign(S.seg.dvt.Rt.PERV,{comp:'none',thr:'occlusive'});});
check('DVT mixed + tail + extends calf',r.text.includes('mixed acute- and chronic-appearing')&&r.text.includes('proximal DVT extending into the calf veins')&&r.text.includes('free-floating thrombus tail'),r.text);
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.FV_P,{comp:'none'});});
check('DVT comp none w/o thrombus warns',r.warnings.some(x=>/specify thrombus/.test(x)),r.warnings.join('|'));
// 14 normal
r=gen(w,'dvt',S=>{S.hdr.dvt.ind=['Suspected DVT'];});
check('DVT normal both',r.text.includes('Right no evidence of deep vein thrombosis from the common femoral vein through the calf veins.')&&r.text.includes('Left no evidence'),r.text);
out.push('=== DVT: normal bilateral ===\n'+r.text);
// 15 central
r=gen(w,'dvt',S=>{S.seg.dvt.Lt.CFV.pattern='continuous';});
check('DVT central',r.text.includes('Left continuous/non-spontaneous common femoral vein flow suggests more central'),r.text);
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.GSV,{st:'ex',comp:'none',thr:'occlusive',apex:'4'});});
check('SVT',r.text.includes('Right superficial vein thrombosis of the great saphenous vein, thrombus apex 4 cm from the saphenofemoral junction.')&&r.text.includes('Right no evidence of deep vein thrombosis'),r.text);
check('SVT no DVT-equivalence wording',!/DVT[- ]equivalent|treat(ed)? as (a )?DVT|anticoagula|consider(ed)? (as )?deep vein thrombosis/i.test(r.text),r.text);
check('SVT finding apex SFJ',r.text.includes('thrombus apex 4 cm from the saphenofemoral junction'),r.text);
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Lt.SSV,{st:'ex',comp:'none',thr:'occlusive',apex:'2.5'});});
check('SVT SSV -> SPJ',r.text.includes('Left superficial vein thrombosis of the small saphenous vein, thrombus apex 2.5 cm from the saphenopopliteal junction.'),r.text);
r=gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.SFJ,{comp:'none',thr:'occlusive'});});
check('SVT apex missing warns',r.warnings.some(x=>/distance of the thrombus apex to the saphenofemoral junction not entered/.test(x)),r.warnings.join('|'));
check('SFJ thrombus: no auto DVT impression',!/Right .*deep vein thrombosis involving/.test(r.text)&&r.text.includes('Right thrombus at the saphenofemoral junction/proximal great saphenous vein.'),r.text);
out.push('=== DVT: Rt GSV SVT ===\n'+gen(w,'dvt',S=>{Object.assign(S.seg.dvt.Rt.GSV,{st:'ex',comp:'none',thr:'occlusive',apex:'4'});}).text);
// ---- CEAP 2020 ----
const vc=(mut)=>gen(w,'ven',S=>{S.hdr.ven.side='Right';mut(S);});
const ceapLine=t=>(t.split('\n').find(l=>/CEAP 2020/.test(l))||'');
r=vc(S=>{const R=S.seg.ven.Rt;R.SFJ.rt='2';['GSV_PT','GSV_MT','GSV_DT','GSV_K','GSV_PC'].forEach(id=>Object.assign(R[id],{rt:'2',diam:'6'}));
 R.SPJ.rt='1';Object.assign(R.SSV_P,{rt:'1.5',diam:'4'});S.perfs.push({side:'Rt',group:'calf medial posterior tibial',dist:'10',ref:'from the heel',diam:'4',t:'1',conn:'',ulcer:false});
 S.venx.ceapCR=['C4a','C2','C3'];S.venx.ceapSR='s';});
check('CEAP full: highest first + advanced list (sorted)',r.text.includes('Right CEAP 2020: C4a,s Ep As,p Pr (advanced: C2,3,4a,s Ep As,p Pr GSVa, GSVb, SSV, CPV).'),ceapLine(r.text));
out.push('=== VENOUS: CEAP full ===\n'+r.text);
r=vc(S=>{const R=S.seg.ven.Rt;R.FV_P.rt='1.5';R.POPV.pat='noncompressible';R.GSV_MT.rt='1';Object.assign(R.GSV_PT,{diam:'5'});S.venx.ceapCR=['C3','C6r','C2r'];S.venx.ceapSR='a';S.venx.ceapER='Esi';});
check('CEAP deep reflux+obstruction, recurrent',r.text.includes('Right CEAP 2020: C6r,a Esi As,d Pr,o (advanced: C2r,3,6r,a Esi As,d Pr GSVa, FV; Po POPV).'),ceapLine(r.text));
r=vc(S=>{S.seg.ven.Rt.POPV.pat='noncompressible';S.venx.ceapCR=['C3'];S.venx.ceapSR='s';});
check('CEAP Ep + deep thrombus -> Esi warning',r.warnings.some(x=>/consider Esi/.test(x)),r.warnings.join('|'));
r=vc(S=>{S.venx.ceapCR=['C0'];S.venx.ceapSR='s';S.venx.ceapER='En';});
check('CEAP no pathology -> An Pn, no advanced dup',r.text.includes('Right CEAP 2020: C0,s En An Pn.'),ceapLine(r.text));
r=vc(S=>{S.venx.ceapCR=['C0','C2'];S.venx.ceapSR='s';});
check('CEAP C0+other warns',r.warnings.some(x=>/C0 selected together/.test(x)),r.warnings.join('|'));
r=vc(S=>{S.venx.ceapCR=['C2','C2r'];S.venx.ceapSR='s';});
check('CEAP C2+C2r warns',r.warnings.some(x=>/both C2 and C2r/.test(x)),r.warnings.join('|'));
r=vc(S=>{S.venx.ceapCR=['C2'];});
check('CEAP missing s/a warns',r.warnings.some(x=>/symptomatic \(s\) or asymptomatic/.test(x))&&r.text.includes('Right CEAP 2020: C2 Ep An Pn.'),ceapLine(r.text)+'|'+r.warnings.join('|'));
r=vc(S=>{});
check('CEAP C not selected warns, no line',r.warnings.some(x=>/CEAP clinical class \(C\) not selected/.test(x))&&!/CEAP 2020/.test(r.text),r.text);
r=vc(S=>{S.seg.ven.Rt.GSV_MT.rt='1';S.venx.ceapCR=['C2','C4c'];S.venx.ceapSR='s';S.venx.ceapAR='s,p';S.venx.ceapPR='r';S.venx.ceapPsR='Pr GSVa, TPV';});
check('CEAP manual override A/P/segments',r.text.includes('Right CEAP 2020: C4c,s Ep As,p Pr (advanced: C2,4c,s Ep As,p Pr GSVa, TPV).'),ceapLine(r.text));
r=vc(S=>{S.seg.ven.Rt.GSV_MT.rt='1';S.venx.ceapCR=['C2','C4c'];S.venx.ceapSR='s';S.venx.ceapAR='As,p';S.venx.ceapPR='Pr';});
check('CEAP override accepts prefixed values',r.text.includes('Right CEAP 2020: C4c,s Ep As,p Pr'),ceapLine(r.text));
r=vc(S=>{S.venx.tribR=true;S.seg.ven.Rt.AAGSV.st='ex';S.seg.ven.Rt.AAGSV.rt='1.2';S.venx.ceapCR=['C2'];S.venx.ceapSR='s';});
check('CEAP AASV + SFJ tributary -> NSV',ceapLine(r.text).includes('Pr AASV, NSV'),ceapLine(r.text));
r=vc(S=>{S.seg.ven.Rt.GSV_MT.pat='noncompressible';S.venx.ceapCR=['C2'];S.venx.ceapSR='s';});
check('ven exam superficial thrombus: no DVT wording',r.text.includes('Right non-compressible GSV, mid thigh, suspicious for superficial vein thrombosis.')&&!/DVT evaluation/.test(r.text)&&ceapLine(r.text).includes('Po GSVa'),r.text);
r=vc(S=>{S.seg.ven.Rt.POPV.pat='noncompressible';});
check('ven exam deep thrombus keeps DVT recommendation',r.text.includes('suspicious for deep vein thrombus; dedicated DVT evaluation recommended'),r.text);
for(const [f,exp] of [['basic','Right CEAP 2020: C4a,s Ep As Pr.'],['advanced','Right CEAP 2020: C2,4a,s Ep As Pr GSVa.']]){
 w.DL.CFG.ceapFormat=f;r=vc(S=>{S.seg.ven.Rt.GSV_MT.rt='1';S.venx.ceapCR=['C2','C4a'];S.venx.ceapSR='s';});check('CEAP format '+f,r.text.includes(exp),ceapLine(r.text));}
w.DL.CFG.ceapFormat='both';
r=vc(S=>{S.venx.ceapCR=['C4c','C4b','C2'];S.venx.ceapSR='s';});
check('CEAP C4b+C4c -> basic C4b, advanced table order',r.text.includes('Right CEAP 2020: C4b,s Ep An Pn (advanced: C2,4b,4c,s Ep An Pn).'),ceapLine(r.text));
r=vc(S=>{S.venx.ceapCR=['C4a','C4c'];S.venx.ceapSR='a';});
check('CEAP C4a+C4c -> basic C4c',r.text.includes('Right CEAP 2020: C4c,a Ep An Pn (advanced: C4a,4c,a Ep An Pn).'),ceapLine(r.text));
r=vc(S=>{S.venx.ceapCR=['C4b','C5'];S.venx.ceapSR='s';});
check('CEAP C5 above C4b',r.text.includes('Right CEAP 2020: C5,s Ep An Pn (advanced: C4b,5,s Ep An Pn).'),ceapLine(r.text));
check('CEAP tooltip notes local decision',/LOCAL CLINICAL DECISION/.test(w.document.documentElement.innerHTML),'');
r=gen(w,'ven',S=>{S.venx.ceapCR=['C2'];S.venx.ceapSR='s';S.venx.ceapCL=['C1'];S.venx.ceapSL='a';S.seg.ven.Lt.SPJ.rt='1';});
check('CEAP bilateral per limb',r.text.includes('Right CEAP 2020: C2,s Ep An Pn.')&&r.text.includes('Left CEAP 2020: C1,a Ep As Pr (advanced: C1,a Ep As Pr SSV).'),r.text);
// limitations / not visualized / comparison
r=gen(w,'dvt',S=>{S.seg.dvt.Rt.PERV.st='nv';S.hdr.dvt.limits=['Edema'];S.hdr.dvt.priorDate='2026-10-01';S.hdr.dvt.priorChange='Improvement';});
check('limitations line',r.text.includes('LIMITATIONS: Technically limited study due to edema. Right peroneal veins not adequately visualized.'),r.text);
check('comparison line',r.text.includes('COMPARISON: 2026-10-01.')&&r.text.includes('Compared with the prior study of 2026-10-01: improvement.'),r.text);
// 16 UI interaction
const u=mk();const d=u.document;
const ta=()=>d.querySelector('#report').value;
let s=d.querySelector('select[data-p="seg.art.Rt.POPA.phas"]');s.value='monophasic';s.dispatchEvent(new u.Event('change',{bubbles:true}));
s=d.querySelector('select[data-p="seg.art.Rt.POPA.up"]');s.value='prolonged';s.dispatchEvent(new u.Event('change',{bubbles:true}));
check('UI change updates report',ta().includes('Right popliteal artery: antegrade, monophasic, high resistive waveform with prolonged upstroke'),ta());
check('UI row flagged abn',d.querySelector('tr[data-row="Rt.POPA"]').classList.contains('abn'));
d.querySelector('[data-chip="seg.art.Rt.POPA.mods"][data-v="dampened"]').dispatchEvent(new u.MouseEvent('click',{bubbles:true}));
check('UI chip toggles',u.DL.state.seg.art.Rt.POPA.mods.includes('dampened')&&ta().includes('dampened morphology'),ta());
d.querySelector('[data-allnormal="art.Rt"]').dispatchEvent(new u.MouseEvent('click',{bubbles:true}));
{const tb=d.querySelector('[data-tab="ven"]');tb.dispatchEvent(new u.MouseEvent('click',{bubbles:true}));
 const clickC=v=>d.querySelector(`[data-chip="venx.ceapCR"][data-v="${v}"]`).dispatchEvent(new u.MouseEvent('click',{bubbles:true}));
 clickC('C4b');clickC('C2');
 let q=d.querySelector('select[data-p="venx.ceapSR"]');q.value='s';q.dispatchEvent(new u.Event('change',{bubbles:true}));
 q=d.querySelector('input[data-p="seg.ven.Rt.GSV_MT.rt"]');q.value='1.4';q.dispatchEvent(new u.Event('input',{bubbles:true}));q.dispatchEvent(new u.Event('change',{bubbles:true}));u.DL.render();
 check('UI CEAP chips -> report',ta().includes('Right CEAP 2020: C4b,s Ep As Pr (advanced: C2,4b,s Ep As Pr GSVa).'),ta().split('\n').filter(l=>/CEAP/.test(l)).join('|'));
 check('UI CEAP auto preview label',/auto: As/.test(d.querySelector('[data-ceap="Rt"]').textContent),d.querySelector('[data-ceap="Rt"]').textContent);
 clickC('C4b');check('UI CEAP chip untoggle',ta().includes('Right CEAP 2020: C2,s Ep As Pr'),ta());
 q=d.querySelector('input[data-p="venx.ceapAR"]');q.value='s,d';q.dispatchEvent(new u.Event('input',{bubbles:true}));
 check('UI CEAP A override',ta().includes('Right CEAP 2020: C2,s Ep As,d Pr'),ta());
 d.querySelector('[data-tab="art"]').dispatchEvent(new u.MouseEvent('click',{bubbles:true}));}
check('UI all normal resets',ta().includes('Right lower extremity: no hemodynamically significant'),ta());
const pin=d.querySelector('input[data-p="seg.art.Rt.CFA.psv"]');pin.value='105';pin.dispatchEvent(new u.Event('input',{bubbles:true}));
check('UI live input',ta().includes('Right PSV (cm/s): CFA 105.'),ta());
d.querySelector('[data-tab="dvt"]').dispatchEvent(new u.MouseEvent('click',{bubbles:true}));
check('UI tab switch',ta().startsWith('EXAM: Lower extremity venous duplex ultrasound for deep vein thrombosis'),ta().slice(0,100));
s=d.querySelector('select[data-p="hdr.dvt.side"]');s.value='Left';s.dispatchEvent(new u.Event('change',{bubbles:true}));
check('UI contralateral row shown',[...d.querySelectorAll('.side.show tr[data-row^="Rt."]')].map(e=>e.dataset.row).join()==='Rt.CFV',[...d.querySelectorAll('.side.show tr[data-row^="Rt."]')].map(e=>e.dataset.row).join());
s=d.querySelector('select[data-p="seg.dvt.Lt.POPV.comp"]');s.value='none';s.dispatchEvent(new u.Event('change',{bubbles:true}));
s=d.querySelector('select[data-p="seg.dvt.Lt.POPV.thr"]');s.value='occlusive';s.dispatchEvent(new u.Event('change',{bubbles:true}));
check('UI occlusive auto color absent',u.DL.state.seg.dvt.Lt.POPV.color==='absent'&&ta().includes('no color flow'),ta());
check('UI thrombus fields revealed',!!d.querySelector('select[data-p="seg.dvt.Lt.POPV.echo"]'));
d.querySelector('[data-tab="ven"]').dispatchEvent(new u.MouseEvent('click',{bubbles:true}));
d.querySelector('[data-add="perfs"]').dispatchEvent(new u.MouseEvent('click',{bubbles:true}));
check('UI add perforator row',u.DL.state.perfs.length===1&&!!d.querySelector('select[data-p="perfs.0.group"]'));
d.querySelector('#report').value+='x';d.querySelector('#report').dispatchEvent(new u.Event('input',{bubbles:true}));
check('UI manual edit pauses',!d.querySelector('#manualNote').classList.contains('hide'));
fs.writeFileSync('test_outputs.txt',out.join('\n\n')+'\n');
console.log(`PASS ${pass}  FAIL ${fail}`);process.exit(fail?1:0);
