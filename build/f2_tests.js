/* ======================= [20] 헤드리스 스텁 & 자체 테스트 ======================= */
function stub2d(){
  var grad={ addColorStop:function(){} };
  var o={ canvas:null, globalAlpha:1, globalCompositeOperation:'source-over',
    fillStyle:'#000', strokeStyle:'#000', lineWidth:1, lineCap:'butt', lineJoin:'miter',
    font:'', textAlign:'left', textBaseline:'alphabetic', shadowBlur:0, shadowColor:'' };
  var fns=['save','restore','beginPath','closePath','moveTo','lineTo','arc','ellipse','rect',
    'fill','stroke','fillRect','strokeRect','clearRect','translate','rotate','scale',
    'setTransform','drawImage','fillText','strokeText','quadraticCurveTo','bezierCurveTo',
    'setLineDash','clip','arcTo'];
  for(var i=0;i<fns.length;i++) o[fns[i]]=function(){};
  o.createLinearGradient=function(){ return grad; };
  o.createRadialGradient=function(){ return grad; };
  o.measureText=function(){ return {width:10}; };
  return o;
}
function stubCanvas(){
  var ctx=stub2d();
  var c={ width:2, height:2, style:{},
    getContext:function(){ return ctx; },
    addEventListener:function(){}, setPointerCapture:function(){} };
  ctx.canvas=c;
  return c;
}
function makeHeadlessEnv(storageBacking){
  if(storageBacking===undefined) storageBacking=null;
  var q=[];
  return {
    canvas:null,
    createCanvas:function(){ return stubCanvas(); },
    storage:makeStorage(storageBacking),
    vibrate:function(){},
    raf:function(cb){ q.push(cb); return q.length; },
    caf:function(){},
    _pump:function(ts){ var cbs=q; q=[]; for(var i=0;i<cbs.length;i++) cbs[i](ts); }
  };
}
function newHG(backing){
  return new Game(makeHeadlessEnv(backing),{headless:true});
}
function steps(g,n,dt){ for(var i=0;i<n;i++) g.tick(dt); }
function simChecksum(g){
  var s=g.run.score*7+g.en.length*131+g.eb.length*13;
  for(var i=0;i<g.eb.length;i++){
    var b=g.eb[i];
    s+=Math.floor(Math.abs(b.x)*3+Math.abs(b.y));
  }
  return s;
}

const TESTS=[
{ name:'RNG seed 재현성', fn:function(A){
  var a=new RNG(123), b=new RNG(123);
  for(var i=0;i<100;i++){
    var x=a.next(), y=b.next();
    A.eq(x,y,'시퀀스 불일치 @'+i);
    A.ok(x>=0&&x<1,'범위 이탈');
  }
  var c=new RNG(124);
  A.ok(c.next()!==(new RNG(123)).next(),'다른 seed는 달라야 함');
}},
{ name:'RNG range/int 경계', fn:function(A){
  var r=new RNG(55);
  for(var i=0;i<200;i++){
    var v=r.range(2,5); A.ok(v>=2&&v<5,'range 이탈 '+v);
    var n=r.int(1,3); A.ok(n>=1&&n<=3,'int 이탈 '+n);
  }
}},
{ name:'점수 포맷', fn:function(A){
  A.eq(U.fmtScore(0),'0');
  A.eq(U.fmtScore(1234567),'1,234,567');
  A.eq(U.fmtScore(123456789),'123,456,789');
  A.eq(U.fmtScore(-5),'0','음수는 0');
}},
{ name:'거리/선분 거리 수학', fn:function(A){
  A.eq(U.dist2(0,0,3,4),25);
  A.eq(U.segDist2(0,5,-10,0,10,0),25);
  A.eq(U.segDist2(20,0,-10,0,10,0),100);
  A.eq(U.segDist2(5,0,-10,0,10,0),0);
}},
{ name:'뷰 스케일 0크기 안전', fn:function(A){
  A.eq(computeViewScale(0,0),0.5);
  A.eq(computeViewScale(NaN,100),0.5);
  A.eq(computeViewScale(360,780),1);
}},
{ name:'HUD 메타 정보 겹침 방지', fn:function(A){
  var ctx=stub2d();
  ctx.measureText=function(text){
    var m=/(\d+(?:\.\d+)?)px/.exec(this.font||'10px');
    var px=m?+m[1]:10, units=0;
    for(var i=0;i<text.length;i++) units+=(text.charCodeAt(i)>255)?1:0.62;
    return {width:units*px};
  };
  var cases=[
    {g:0,m:'STANDARD'},
    {g:9876,m:'ABYSS'},
    {g:123456789,m:'STANDARD · 연습'},
    {g:Number.MAX_SAFE_INTEGER,m:'ABYSS · 연습'}
  ];
  for(var i=0;i<cases.length;i++){
    var c=cases[i], L=computeHudMetaLayout(ctx,c.g,c.m);
    A.ok(L.grazeX>=206,'그레이즈가 폭탄 영역 침범');
    A.ok(L.grazeRight+L.gap<=L.modeLeft,'그레이즈/난이도 겹침');
    A.ok(L.modeRight<=CFG.W-12,'난이도가 HUD 우측 경계 침범');
  }
  A.eq(formatHudCount(9999),'9999');
  A.eq(formatHudCount(12345),'12.3K');
  A.eq(formatHudCount(1234567),'1.2M');
}},
{ name:'설정 범위 초과 정제', fn:function(A){
  var s=sanitizeSettings({sfx:5,music:-2,fxq:'weird',vib:0});
  A.eq(s.sfx,1); A.eq(s.music,0); A.eq(s.fxq,'high'); A.eq(s.vib,false);
  var d=sanitizeSettings(null);
  A.eq(d.sfx,DEFAULT_SETTINGS.sfx);
}},
{ name:'localStorage 차단 시 메모리 폴백', fn:function(A){
  var thr={ getItem:function(){ throw new Error('blocked'); },
    setItem:function(){ throw new Error('blocked'); },
    removeItem:function(){ throw new Error('blocked'); } };
  var st=makeStorage(thr);
  A.eq(st.mode(),'mem');
  A.ok(st.set('k',{a:1}),'set 실패');
  A.eq(st.get('k',null).a,1);
  var g=newHG(thr);
  A.ok(g.save.hi.standard===0,'기본 저장값');
  g.setSetting('sfx',0.5);
  A.eq(g.settings.sfx,0.5);
}},
{ name:'손상된 저장 데이터 복구', fn:function(A){
  var bad={ getItem:function(){ return '{oops'; },
    setItem:function(){}, removeItem:function(){} };
  var st=makeStorage(bad);
  var d=loadSaveData(st);
  A.eq(d.hi.standard,0);
  A.eq(d.settings.sfx,DEFAULT_SETTINGS.sfx);
}},
{ name:'큰 delta time 제한', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:1});
  var t0=g.run.time;
  g.tick(5);
  A.ok(g.run.time-t0<=CFG.DT_MAX+1e-9,'dt 미제한: '+(g.run.time-t0));
  g.tick(-3); g.tick(NaN);
  A.ok(isFinite(g.run.time),'비정상 dt에서 상태 손상');
}},
{ name:'오브젝트 풀 재사용', fn:function(A){
  var p=new Pool('t',function(){ return {v:0}; },10);
  var a=[],i;
  for(i=0;i<5;i++) a.push(p.acquire());
  A.eq(p.created,5);
  for(i=0;i<5;i++) p.release(a[i]);
  for(i=0;i<5;i++) A.ok(p.acquire()!==null);
  A.eq(p.created,5,'재사용 안 됨');
  var extra=[];
  for(i=0;i<6;i++) extra.push(p.acquire());
  A.eq(p.created,10);
  A.eq(extra[5],null,'상한 초과 시 null');
}},
{ name:'탄환 상한 준수', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:2}); g.director.events=[];
  for(var i=0;i<2000;i++) g.fireEB(180,300,i*0.01,100,{});
  A.ok(g.eb.length<=g.diff.ebCap,'eb '+g.eb.length+' > cap '+g.diff.ebCap);
  A.ok(g.pool.eb.created<=CFG.POOL.eb,'풀 상한 초과');
}},
{ name:'상태 전이 규칙', fn:function(A){
  var g=newHG();
  A.eq(g.state,'BOOT');
  A.eq(g.setState('PAUSE'),false,'BOOT→PAUSE 금지');
  A.ok(g.setState('TITLE'));
  A.eq(g.setState('GAME'),false,'TITLE→GAME 직행 금지');
  A.ok(g.setState('DIFF'));
  A.ok(g.startRun('standard',{seed:3}));
  A.eq(g.state,'GAME');
  A.ok(g.pause()); A.eq(g.state,'PAUSE');
  A.ok(g.resumeFromPause()); A.eq(g.state,'RESUME');
  steps(g,60,1/60);
  A.eq(g.state,'GAME','RESUME 자동 복귀 실패');
  A.ok(g.quitToTitle()); A.eq(g.state,'TITLE');
}},
{ name:'RAF 루프 중복 방지', fn:function(A){
  var env=makeHeadlessEnv();
  var g=new Game(env,{headless:true});
  A.ok(g.startLoop());
  A.eq(g.startLoop(),false,'두 번째 startLoop 허용됨');
  env._pump(16);
  A.eq(g.tickCount,1,'프레임당 tick 1회여야 함: '+g.tickCount);
  env._pump(32);
  A.eq(g.tickCount,2);
}},
{ name:'seed 고정 시뮬레이션 재현성', fn:function(A){
  var g1=newHG(), g2=newHG();
  g1.startRun('standard',{seed:777});
  g2.startRun('standard',{seed:777});
  var c1=0,c2=0;
  for(var i=0;i<600;i++){
    g1.tick(1/60); g2.tick(1/60);
    c1+=simChecksum(g1); c2+=simChecksum(g2);
  }
  A.ok(c1>0,'시뮬레이션에서 탄/적이 생성되지 않음');
  A.eq(c1,c2,'재현성 실패');
}},
{ name:'그레이즈 1회 판정', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:4}); g.director.events=[];
  steps(g,12,1/60);
  var b=g.fireEB(g.player.x+12,g.player.y,0,0,{sz:'m'});
  A.ok(b,'탄 생성 실패');
  steps(g,30,1/60);
  A.eq(g.run.graze,1,'그레이즈 횟수 '+g.run.graze);
  A.ok(g.run.score>=CFG.GRAZE.score,'그레이즈 점수 미반영');
  steps(g,30,1/60);
  A.eq(g.run.graze,1,'그레이즈 중복 발생');
}},
{ name:'피격 및 무적 시간', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:5}); g.director.events=[];
  steps(g,90,1/60); /* 시작 무적 소진 */
  var b=g.fireEB(g.player.x,g.player.y,0,0,{});
  b.delay=0;
  g.tick(1/60);
  A.eq(g.run.lives,CFG.PLAYER.startLives-1,'피격 미발생');
  A.ok(g.player.invuln>0,'무적 미부여');
  var b2=g.fireEB(g.player.x,g.player.y,0,0,{});
  b2.delay=0;
  steps(g,10,1/60);
  A.eq(g.run.lives,CFG.PLAYER.startLives-1,'무적 중 중복 피격');
}},
{ name:'폭탄: 탄 소거/무적/차감', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:6}); g.director.events=[];
  for(var i=0;i<50;i++) g.fireEB(180,280,i*0.13,90,{});
  A.ok(g.eb.length===50);
  var s0=g.run.score;
  A.ok(g.bomb(),'폭탄 발동 실패');
  A.eq(g.eb.length,0,'탄 미소거');
  A.eq(g.run.bombs,CFG.PLAYER.startBombs-1);
  A.ok(g.player.invuln>=CFG.BOMB.invuln-0.01,'폭탄 무적 미부여');
  A.ok(g.run.score-s0>=50*CFG.BOMB.sparkScore,'소거 점수 미반영');
  A.eq(g.bomb(),false,'쿨다운 중 재발동 허용됨');
}},
{ name:'폭탄 0개 안전 처리', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:7}); g.director.events=[];
  g.run.bombs=0; g.bombCd=0;
  A.eq(g.bomb(),false);
  A.eq(g.run.bombs,0,'음수 폭탄');
}},
{ name:'점수 익스텐드(목숨 +1)', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:8}); g.director.events=[];
  g.run.score=CFG.EXTENDS[0]-1000;
  var l0=g.run.lives;
  g.addScore(2000);
  A.eq(g.run.lives,l0+1,'익스텐드 실패');
  A.eq(g.run.extendIdx,1);
  g.addScore(2000);
  A.eq(g.run.lives,l0+1,'중복 익스텐드');
}},
{ name:'재시작 시 월드 초기화', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:42});
  steps(g,360,1/60);
  A.ok(g.en.length>0||g.eb.length>0,'6초 후에도 개체 없음(타임라인 이상)');
  g.restartRun();
  A.eq(g.state,'GAME');
  A.eq(g.run.score,0); A.eq(g.eb.length,0);
  A.eq(g.en.length,0); A.eq(g.stageT,0);
  A.eq(g.boss,null);
}},
{ name:'보스 페이즈 전환+탄 정리', fn:function(A){
  var g=newHG();
  g.startPractice('mid','standard');
  var guard=0;
  while(guard++<1200&&!(g.boss&&g.boss.state==='fight')) g.tick(1/30);
  A.ok(g.boss&&g.boss.state==='fight','보스 전투 진입 실패');
  A.eq(g.boss.phaseIdx,0);
  g.boss.hp=1;
  g.damageBoss(10);
  g.tick(1/30); /* 페이즈 종료 판정은 다음 프레임 갱신에서 수행 */
  A.eq(g.boss.state,'switch','페이즈 전환 실패');
  A.eq(g.eb.length,0,'전환 시 탄 미정리');
  steps(g,60,1/30);
  A.eq(g.boss.phaseIdx,1,'다음 페이즈 미진입');
  A.eq(g.boss.state,'fight');
}},
{ name:'보스 격파→결과 화면 흐름', fn:function(A){
  var g=newHG();
  g.startPractice('mid','standard');
  var guard=0;
  while(guard++<4000&&g.state==='GAME'){
    if(g.boss&&g.boss.state==='fight'){ g.boss.hp=1; g.damageBoss(10); }
    g.tick(1/30);
  }
  A.eq(g.state,'RESULT','결과 화면 미도달 (state='+g.state+')');
  A.ok(g.run.bonus.boss>0,'보스 보너스 없음');
}},
{ name:'게임 오버→재시작 흐름', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:9}); g.director.events=[];
  steps(g,90,1/60);
  g.run.lives=1;
  var b=g.fireEB(g.player.x,g.player.y,0,0,{}); b.delay=0;
  g.tick(1/60);
  A.eq(g.seq,'death','사망 시퀀스 미진입');
  steps(g,120,1/60);
  A.eq(g.state,'OVER','게임 오버 미도달');
  g.restartRun();
  A.eq(g.state,'GAME');
  A.ok(g.player.alive);
  A.eq(g.run.lives,CFG.PLAYER.startLives);
}},
{ name:'레이저: 경고 중 무해, 활성 시 유효', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:10}); g.director.events=[];
  steps(g,90,1/60);
  var l0=g.run.lives;
  g.fireLaser(0,g.player.y,0,{warn:0.5,active:0.5,w:14});
  steps(g,18,1/60); /* 0.3s: 경고 구간 */
  A.eq(g.run.lives,l0,'경고 중 피격됨');
  steps(g,24,1/60); /* 0.7s: 활성 구간 */
  A.eq(g.run.lives,l0-1,'활성 레이저 피격 미발생');
}},
{ name:'패턴 16종 발사 검증', fn:function(A){
  var keys=[];
  for(var k in PATTERN_FACTORIES) keys.push(k);
  A.ok(keys.length>=16,'패턴 수 부족: '+keys.length);
  for(var i=0;i<keys.length;i++){
    var g=newHG();
    g.startRun('standard',{seed:11}); g.director.events=[];
    var pat=PATTERN_FACTORIES[keys[i]]();
    var src={x:180,y:140};
    var seen=0;
    for(var s=0;s<150;s++){
      g.player.invuln=999;
      pat.update(g,src,1/30);
      g.tick(1/30);
      seen=Math.max(seen,g.eb.length+g.lasers.length);
    }
    A.ok(seen>0,keys[i]+' 패턴이 아무것도 발사하지 않음');
    for(var j=0;j<g.eb.length;j++){
      var b=g.eb[j];
      A.ok(isFinite(b.x)&&isFinite(b.y),keys[i]+' 좌표 비정상');
    }
  }
}},
{ name:'연속 재시작 누수 없음(풀 회수)', fn:function(A){
  var g=newHG();
  for(var r=0;r<3;r++){
    g.startRun(r%2?'abyss':'standard',{seed:100+r});
    steps(g,300,1/30); /* 10초 */
  }
  g.quitToTitle();
  A.eq(g.eb.length,0); A.eq(g.en.length,0);
  A.eq(g.parts.length,0); A.eq(g.items.length,0);
  var pools=['eb','pb','part','item','en','laser'];
  for(var i=0;i<pools.length;i++){
    var p=g.pool[pools[i]];
    A.ok(p.created<=p.max,pools[i]+' 풀 상한 초과');
    A.eq(p.free.length,p.created,pools[i]+' 풀 미회수: free '+p.free.length+' / created '+p.created);
  }
}},
{ name:'최고 점수 저장/불러오기', fn:function(A){
  var mem={};
  var backing={ getItem:function(k){ return (k in mem)?mem[k]:null; },
    setItem:function(k,v){ mem[k]=String(v); },
    removeItem:function(k){ delete mem[k]; } };
  var g=newHG(backing);
  g.startRun('standard',{seed:12}); g.director.events=[];
  g.run.score=98765;
  g._updateHi();
  A.ok(g.run.newRecord,'신기록 플래그 없음');
  var g2=newHG(backing);
  A.eq(g2.save.hi.standard,98765,'저장 후 재로드 실패');
}}
];

function runSelfTests(opts){
  opts=opts||{};
  var A={
    ok:function(c,m){ if(!c) throw new Error(m||'assert 실패'); },
    eq:function(a,b,m){ if(a!==b) throw new Error((m||'불일치')+' [실제 '+a+' / 기대 '+b+']'); }
  };
  var results=[], pass=0, fail=0;
  for(var i=0;i<TESTS.length;i++){
    var t=TESTS[i], ok=true, msg='';
    var t0=(typeof performance!=='undefined'&&performance.now)?performance.now():0;
    try{ t.fn(A); }
    catch(e){ ok=false; msg=(e&&e.message)?e.message:String(e); }
    var ms=((typeof performance!=='undefined'&&performance.now)?performance.now():0)-t0;
    results.push({name:t.name,pass:ok,msg:msg,ms:Math.round(ms)});
    if(ok) pass++; else fail++;
    if(opts.log){
      try{ opts.log((ok?'PASS':'FAIL')+' — '+t.name+(ok?'':' :: '+msg)); }catch(e2){}
    }
  }
  return { pass:pass, fail:fail, results:results };
}

/* ======================= [21] 공개 API & 부트 ======================= */
var API={
  version:VERSION,
  CFG:CFG, DIFFS:DIFFS, U:U,
  RNG:RNG, Game:Game, Pool:Pool,
  makeStorage:makeStorage, sanitizeSettings:sanitizeSettings, loadSaveData:loadSaveData,
  computeViewScale:computeViewScale,
  computeHudMetaLayout:computeHudMetaLayout,
  formatHudCount:formatHudCount,
  makeHeadlessEnv:makeHeadlessEnv,
  runSelfTests:runSelfTests,
  PATTERN_FACTORIES:PATTERN_FACTORIES,
  DEFAULT_SETTINGS:DEFAULT_SETTINGS
};
ROOT.LUMENFALL=API;
try{
  if(typeof document!=='undefined'&&document&&document.getElementById&&document.getElementById('cv')){
    bootBrowser();
  }
}catch(e){
  try{ if(ROOT.console) console.error('LUMENFALL 부트 실패:',e); }catch(e2){}
}
})();
