/* 전체 런 스모크 시뮬레이션: 타임라인 전 구간 + 보스 5페이즈 + 클리어까지 */
'use strict';
const fs=require('fs');
const path=require('path');
new Function(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'))();
const api=globalThis.LUMENFALL;

function fullRun(diff,seed,assist){
  const g=new api.Game(api.makeHeadlessEnv(),{headless:true});
  g.startRun(diff,{seed:seed});
  let maxEb=0,maxParts=0,maxEn=0,midSeen=false,finalSeen=false,err=null;
  let ticks=0;
  const MAX=60*60*14; /* 시뮬 14분 상한 */
  try{
    while(g.state==='GAME'&&ticks<MAX){
      g.player.invuln=999; /* 갓모드: 로직 전 구간 통과 목적 */
      if(assist&&g.boss&&g.boss.state==='fight'){ g.damageBoss(40); }
      g.tick(1/60); ticks++;
      if(g.eb.length>maxEb)maxEb=g.eb.length;
      if(g.parts.length>maxParts)maxParts=g.parts.length;
      if(g.en.length>maxEn)maxEn=g.en.length;
      if(g.boss){
        if(g.boss.def.kind==='mid')midSeen=true;
        if(g.boss.def.kind==='final')finalSeen=true;
      }
    }
  }catch(e){ err=e; }
  return {diff,seed,ticks,simMin:(ticks/3600).toFixed(1),state:g.state,
    maxEb,maxParts,maxEn,midSeen,finalSeen,
    score:g.run.score,cap:g.diff.ebCap,
    poolEb:g.pool.eb.created,err:err?(err.stack||String(err)):null};
}

let fail=0;
for(const [diff,seed,assist] of [['standard',777,true],['abyss',424242,true],['abyss',31337,false]]){
  const r=fullRun(diff,seed,assist);
  const okState=assist?(r.state==='RESULT'):(r.state==='RESULT'||r.state==='GAME');
  const ok= !r.err && okState && r.midSeen && r.finalSeen===assist|| (!assist&&!r.err&&r.midSeen);
  console.log((ok?'PASS':'FAIL')+' — '+r.diff+' seed='+r.seed+(assist?' (보스 격파 보조)':' (방치)')+
    '\n    시뮬 '+r.simMin+'분, 종료 상태 '+r.state+', 중간보스 '+r.midSeen+', 최종보스 '+r.finalSeen+
    '\n    최대 동시 탄 '+r.maxEb+'/'+r.cap+', 최대 파티클 '+r.maxParts+', 최대 적 '+r.maxEn+
    ', 점수 '+r.score+', eb풀 '+r.poolEb);
  if(r.err){ console.log('    오류: '+r.err); }
  if(!ok) fail++;
}
console.log(fail===0?'\n스모크: 전부 통과':'\n스모크 실패 '+fail+'건');
process.exitCode=fail?1:0;
