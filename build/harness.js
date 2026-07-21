/* Node 헤드리스 테스트 하네스 — game.js를 로드해 자체 테스트를 실행 */
'use strict';
const fs=require('fs');
const path=require('path');
const code=fs.readFileSync(path.join(__dirname,'game.js'),'utf8');

/* 브라우저 전역이 없는 상태로 로드 → 부트 가드가 자동 실행을 건너뛰어야 함 */
try{
  new Function(code)();
}catch(e){
  console.error('[하네스] 코드 로드 실패:',e&&e.stack||e);
  process.exit(2);
}
const api=globalThis.LUMENFALL;
if(!api||typeof api.runSelfTests!=='function'){
  console.error('[하네스] LUMENFALL API 없음');
  process.exit(2);
}
console.log('LUMENFALL v'+api.version+' — 자체 테스트 시작\n');
const res=api.runSelfTests({log:msg=>console.log('  '+msg)});
console.log('\n결과: PASS '+res.pass+' / FAIL '+res.fail+' (총 '+res.results.length+')');

/* HTML-JS ID 교차 검증 */
const html=fs.readFileSync(path.join(__dirname,'head.html'),'utf8');
const htmlIds=new Set();
for(const m of html.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);
const jsIds=new Set();
for(const m of code.matchAll(/getElementById\('([^']+)'\)/g)) jsIds.add(m[1]);
for(const m of code.matchAll(/this\.\$\('([^']+)'\)/g)) jsIds.add(m[1]);
for(const m of code.matchAll(/_on\('([^']+)'/g)) jsIds.add(m[1]);
for(const m of code.matchAll(/tog\('([^']+)'/g)) jsIds.add(m[1]);
const screenIds=['scr-boot','scr-title','scr-howto','scr-diff','scr-practice','scr-settings','scr-pause','scr-over','scr-result','scr-test','scr-rotate'];
screenIds.forEach(id=>jsIds.add(id));
let idFail=0;
for(const id of jsIds){
  if(!htmlIds.has(id)){ console.log('  [ID 누락] JS가 참조하는 #'+id+' 가 HTML에 없음'); idFail++; }
}
console.log(idFail===0?'HTML-JS ID 교차 검증: OK ('+jsIds.size+'개 확인)':'HTML-JS ID 교차 검증: 실패 '+idFail+'건');

process.exitCode=(res.fail===0&&idFail===0)?0:1;
