// In-memory mock of the Apps Script services used by apps_script/Code.gs
const vm=require('vm'),fs=require('fs');
function makeGas(){
 const sheets={};const props={};
 function Sheet(name){this.name=name;this.cells=[];this.frozen=0;this.formats={};}
 Sheet.prototype.getName=function(){return this.name};
 Sheet.prototype.getLastRow=function(){let n=0;this.cells.forEach((r,i)=>{if(r&&r.some(v=>v!==''&&v!=null))n=i+1;});return n;};
 Sheet.prototype.getLastColumn=function(){let n=0;this.cells.forEach(r=>{if(r)r.forEach((v,j)=>{if(v!==''&&v!=null)n=Math.max(n,j+1);});});return n;};
 Sheet.prototype.setFrozenRows=function(n){this.frozen=n};
 Sheet.prototype.getRange=function(r,c,nr=1,nc=1){const sh=this;return{
  getValues(){const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const v=(sh.cells[r-1+i]||[])[c-1+j];row.push(v==null?'':v);}o.push(row);}return o;},
  getDisplayValues(){return this.getValues().map(r=>r.map(String));},
  setValues(v){if(v.length!==nr||v[0].length!==nc)throw new Error('size mismatch '+nr+'x'+nc);for(let i=0;i<nr;i++){sh.cells[r-1+i]=sh.cells[r-1+i]||[];for(let j=0;j<nc;j++)sh.cells[r-1+i][c-1+j]=v[i][j];}return this;},
  setNumberFormat(f){sh.formats[r]=f;return this;}};};
 const ss={getName:()=>'Doppler Report Data',getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=new Sheet(n)),getSheets:()=>Object.values(sheets)};
 const ctx={
  SpreadsheetApp:{getActiveSpreadsheet:()=>ss},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v},deleteProperty:k=>{delete props[k]}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({content:t,setMimeType(){return this;}})},
  Utilities:{getUuid:()=>require('crypto').randomUUID()},
  Logger:{log(){}},console};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../apps_script/Code.gs','utf8'),ctx);
 return{ctx,sheets,props,post:body=>JSON.parse(ctx.doPost({postData:{contents:body}}).content)};
}
module.exports={makeGas};
