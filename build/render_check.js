/* 실제 Canvas 2D로 프레임을 렌더링해 PNG로 저장 + HUD 텍스트 실측 겹침 검사 */
'use strict';
const fs=require('fs');
const path=require('path');
const { createCanvas }=require('@napi-rs/canvas');
new Function(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'))();
const api=globalThis.LUMENFALL;
const CFG=api.CFG;

function mkEnv(){
  const cv=createCanvas(CFG.W,CFG.H);
  return {
    canvas:cv,
    createCanvas:(w,h)=>createCanvas(Math.max(1,w||1),Math.max(1,h||1)),
    storage:api.makeStorage(null),
    vibrate(){}, raf(){ return 0; }, caf(){}
  };
}

/* ---- 실측 텍스트 겹침 검사: ctx.fillText를 후킹해 실제 measureText로 박스 수집 ---- */
function auditHUD(label,setup){
  const env=mkEnv();
  const g=new api.Game(env,{});
  g.view={scale:1,dpr:1,cssW:CFG.W,cssH:CFG.H};
  g.setState('TITLE'); g.startRun('abyss',{seed:5});
  setup(g);
  const ctx=g.ctx;
  const boxes=[];
  const origFill=ctx.fillText.bind(ctx);
  ctx.fillText=function(text,x,y){
    const m=ctx.measureText(text);
    const w=m.width;
    let x0=x;
    if(ctx.textAlign==='right') x0=x-w;
    else if(ctx.textAlign==='center') x0=x-w/2;
    const size=parseFloat((ctx.font.match(/(\d+(?:\.\d+)?)px/)||[0,12])[1]);
    let y0=y;
    if(ctx.textBaseline==='middle') y0=y-size/2;
    else if(ctx.textBaseline==='alphabetic') y0=y-size*0.8;
    boxes.push({text:String(text),x0,x1:x0+w,y0,y1:y0+size,size});
    return origFill(text,x,y);
  };
  /* HUD만 격리해서 후킹한다.
     drawTxts(점수 팝업)는 translate/scale 변환 안에서 그리므로
     변환을 모르는 이 후킹으로는 좌표를 신뢰할 수 없어 검사 대상에서 제외한다. */
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  g.drawHUD(ctx);
  ctx.restore();
  ctx.fillText=origFill;
  g.render(); /* PNG 저장용 전체 렌더 */
  const hud=boxes.filter(b=>b.y0<CFG.HUD_H+46);
  const issues=[];
  for(const b of hud){
    if(b.x0<-0.5||b.x1>CFG.W+0.5)
      issues.push(`화면 밖: "${b.text}" (${b.x0.toFixed(1)}~${b.x1.toFixed(1)})`);
    if(b.size<10)
      issues.push(`글자 너무 작음: "${b.text}" ${b.size}px`);
  }
  for(let i=0;i<hud.length;i++) for(let j=i+1;j<hud.length;j++){
    const a=hud[i],b=hud[j];
    const ox=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);
    const oy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
    if(ox>0.5&&oy>0.5)
      issues.push(`겹침: "${a.text}" ↔ "${b.text}" (가로 ${ox.toFixed(1)}px, 세로 ${oy.toFixed(1)}px)`);
  }
  console.log((issues.length?'FAIL':'PASS')+` — HUD 실측 [${label}] 텍스트 ${hud.length}개`);
  issues.forEach(s=>console.log('    '+s));
  return {ok:issues.length===0,canvas:env.canvas};
}

let fail=0;
/* 1) 최악 조건: 9자리 점수, 목숨6, 폭탄6, 그레이즈 5자리, ABYSS 연습 */
let r=auditHUD('최악값',g=>{
  g.run.score=987654321; g.run.lives=6; g.run.bombs=6;
  g.run.graze=99999; g.run.mult=3; g.mode='practice';
  g.save.hi.abyss=987654321;
});
if(!r.ok) fail++;
fs.writeFileSync(path.join(__dirname,'shot_hud_worst.png'),r.canvas.toBuffer('image/png'));

/* 2) 일반 플레이 + 적 + 탄 + 아이템 */
r=auditHUD('일반 플레이',g=>{
  g.run.score=1890; g.run.lives=3; g.run.bombs=3; g.run.graze=12; g.run.chain=7;
  g.spawnEnemy('drone',80,150,{ty:150,holdT:99,exitVX:0});
  g.spawnEnemy('darter',180,220,{dir:1});
  g.spawnEnemy('weaver',270,180,{vx:60,y0:180,wob:0,itv:1.6,ringN:9});
  g.spawnEnemy('fort',140,300,{ty:300,lifeT:99});
  for(let i=0;i<40;i++) g.fireEB(180,120,i*0.157,110,{c:['pink','gold','violet','red','orange'][i%5],sz:['s','m','l'][i%3]});
  g.spawnItem(0,120,400); g.spawnItem(0,150,430); g.spawnItem(1,220,410);
  g.popup(180,360,'+3,000',null,14);
  for(let i=0;i<12;i++) g.tick(1/60);
});
if(!r.ok) fail++;
fs.writeFileSync(path.join(__dirname,'shot_play.png'),r.canvas.toBuffer('image/png'));

/* 3) 보스전 HUD (이름 + 페이즈 + 체력바 + 체인) */
r=auditHUD('보스전',g=>{
  g.run.score=452300; g.run.graze=871; g.run.chain=14; g.run.lives=2; g.run.bombs=1;
  g.startPractice('final','abyss');
  let guard=0;
  while(guard++<900&&!(g.boss&&g.boss.state==='fight')) g.tick(1/30);
  if(g.boss){ g.boss.hp=g.boss.maxHp*0.42; g.boss.phaseIdx=2; g.boss.phT=12; }
  g.run.chain=14; g.run.chainT=2;
  for(let i=0;i<20;i++) g.fireEB(180,130,i*0.31,120,{c:'violet',sz:'m'});
  g.tick(1/60);
});
if(!r.ok) fail++;
fs.writeFileSync(path.join(__dirname,'shot_boss.png'),r.canvas.toBuffer('image/png'));

console.log(fail===0?'\n렌더 검사: 전부 통과 (PNG 3장 저장)':'\n렌더 검사 실패 '+fail+'건');
process.exitCode=fail?1:0;
