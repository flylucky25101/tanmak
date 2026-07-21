/* ======================= [10] 탄막 패턴 팩토리 (16종) ======================= */
/* 각 팩토리는 {id, update(g,src,dt)}를 반환. 시간·seed 기반, 프레임률 무관. */

function mkAimedFan(o){
  var t=(o.delay||0.4);
  return { id:'aimedFan', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    var n=o.n||3, rows=o.rows||1;
    var base=g.aimAng(src.x,src.y)+g.rngG.range(-g.diff.jit,g.diff.jit);
    for(var r=0;r<rows;r++){
      for(var i=0;i<n;i++){
        var a=base+(n>1?(o.spread||0.5)*((i/(n-1))-0.5):0);
        g.fireEB(src.x,src.y,a,(o.spd||170)*(1+r*0.14),{c:o.c||'pink',sz:o.sz||'m'});
      }
    }
  }};
}
function mkRing(o){
  var t=(o.delay||0.5), rot=0;
  return { id:'ring', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    var n=g.cnt(o.n||18);
    for(var i=0;i<n;i++) g.fireEB(src.x,src.y,rot+i*TAU/n,o.spd||120,{c:o.c||'gold',sz:o.sz||'m'});
    rot+=(o.rotStep||0.3)+g.rngG.range(-0.02,0.02);
  }};
}
function mkSpiral(o){
  var acc=0, base=o.base||0;
  return { id:'spiral', update:function(g,src,dt){
    acc+=dt*(o.rate||8)*g.diff.den;
    var guard=0;
    while(acc>=1&&guard++<24){
      acc-=1;
      var arms=o.arms||2;
      for(var a=0;a<arms;a++) g.fireEB(src.x,src.y,base+a*TAU/arms,o.spd||125,{c:o.c||'violet',sz:o.sz||'s'});
      base+=(o.stepRad||0.32);
    }
  }};
}
function mkCounterSpiral(o){
  var s1=mkSpiral({rate:o.rate,arms:o.arms,stepRad:o.stepRad,spd:o.spd,c:o.c||'violet',sz:o.sz||'s'});
  var s2=mkSpiral({rate:o.rate,arms:o.arms,stepRad:-(o.stepRad),spd:o.spd,c:o.c2||'pink',sz:o.sz||'s',base:Math.PI/(o.arms||2)});
  return { id:'counterSpiral', update:function(g,src,dt){ s1.update(g,src,dt); s2.update(g,src,dt); } };
}
function mkCurtain(o){
  var t=(o.delay||0.7), gapX=CFG.W/2;
  return { id:'curtain', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    gapX=U.clamp(gapX+g.rngG.range(-(o.drift||52),(o.drift||52)),56,CFG.W-56);
    var half=(o.gapW||92)*g.diff.gap/2;
    var step=o.step||24;
    for(var x=12;x<CFG.W-6;x+=step){
      if(Math.abs(x-gapX)<half) continue;
      g.fireEB(x,-12,Math.PI/2,o.spd||132,{c:o.c||'gold',sz:'s'});
    }
  }};
}
function mkSafeLane(o){
  var t=(o.delay||0.6), ph=g0rand();
  function g0rand(){ return 0; }
  return { id:'safeLane', update:function(g,src,dt){
    ph+=dt*(o.period||0.55);
    t-=dt;
    if(t>0) return;
    t=(o.itv||0.62)*g.diff.itv;
    var laneX=CFG.W/2+Math.sin(ph)*(CFG.W/2-84);
    var half=(o.laneW||96)*g.diff.gap/2;
    var step=o.step||26;
    for(var x=12;x<CFG.W-6;x+=step){
      if(Math.abs(x-laneX)<half) continue;
      g.fireEB(x,-12,Math.PI/2,o.spd||148,{c:'red',sz:'s'});
    }
  }};
}
function mkWaveRing(o){
  var t=(o.delay||0.6);
  return { id:'waveRing', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    var n=g.cnt(o.n||16);
    var base=g.rngG.range(0,TAU);
    for(var i=0;i<n;i++){
      g.fireEB(src.x,src.y,base+i*TAU/n,o.spd||110,
        {c:o.c||'orange',sz:'s',kind:BK.SINE,amp:o.amp||22,freq:o.freq||5,phase:i*0.7});
    }
  }};
}
function mkAccelRain(o){
  var t=(o.delay||0.3);
  return { id:'accelRain', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=(o.itv||0.34)*g.diff.itv;
    var n=g.cnt(o.count||2);
    for(var i=0;i<n;i++){
      var x=g.rngG.range(16,CFG.W-16);
      g.fireEB(x,-12,Math.PI/2,o.v0||42,
        {c:'red',sz:'s',kind:BK.ACC,acc:o.acc||200,vmax:o.vmax||265});
    }
  }};
}
function mkStallVolley(o){
  var t=(o.delay||1.0);
  return { id:'stallVolley', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    var n=g.cnt(o.n||12);
    var base=g.aimAng(src.x,src.y);
    for(var i=0;i<n;i++){
      var a=base+(o.spread||1.5)*((i/(n-1))-0.5);
      g.fireEB(src.x,src.y,a,o.spd||255,
        {c:'violet',sz:'m',kind:BK.STALL,t1:o.t1||0.65,t2:(o.t1||0.65)+(o.wait||0.55),spd2:o.spd2||205});
    }
  }};
}
function mkPredictAim(o){
  var t=(o.delay||0.8);
  return { id:'predictAim', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    var lead=o.lead||0.5;
    var tx=g.player.x+g.player.vx*lead, ty=g.player.y+g.player.vy*lead;
    var base=Math.atan2(ty-src.y,tx-src.x);
    var n=o.n||3;
    for(var i=0;i<n;i++){
      var a=base+(n>1?(o.spread||0.24)*((i/(n-1))-0.5):0);
      g.fireEB(src.x,src.y,a,o.spd||195,{c:'pink',sz:'m'});
    }
  }};
}
function mkCrossfire(o){
  var t=(o.delay||0.5), side=1;
  return { id:'crossfire', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=(o.itv||0.5)*g.diff.itv;
    side=-side;
    var y=g.rngG.range(100,330);
    var x=(side>0)?-6:CFG.W+6;
    var ang=Math.atan2(430,(side>0?1:-1)*(CFG.W*0.85));
    for(var i=0;i<2;i++){
      g.fireEB(x,y,ang+(i-0.5)*0.09,(o.spd||168),{c:'orange',sz:'s'});
    }
  }};
}
function mkSineSnake(o){
  var t=(o.delay||0.4), flip=1;
  return { id:'sineSnake', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=(o.itv||0.22)*g.diff.itv;
    flip=-flip;
    var ports=o.ports||2;
    for(var i=0;i<ports;i++){
      var off=(i-(ports-1)/2)*36;
      g.fireEB(src.x+off,src.y+8,Math.PI/2,o.spd||135,
        {c:'violet',sz:'s',kind:BK.SINE,amp:o.amp||30,freq:o.freq||4.2,phase:flip*i*1.3});
    }
  }};
}
function mkEchoPulse(o){
  var t=(o.delay||0.9), pend=[];
  return { id:'echoPulse', update:function(g,src,dt){
    t-=dt;
    if(t<=0){
      t=o.itv*g.diff.itv;
      pend.push({k:0,t:0,x:src.x,y:src.y,base:g.rngG.range(0,TAU)});
    }
    for(var j=pend.length-1;j>=0;j--){
      var P=pend[j];
      P.t-=dt;
      if(P.t<=0){
        var n=g.cnt(o.n||22);
        for(var i=0;i<n;i++){
          g.fireEB(P.x,P.y,P.base+i*TAU/n+P.k*0.09,(o.spd||118)+P.k*16,{c:'gold',sz:'s'});
        }
        P.k++; P.t=o.ringGap||0.18;
        if(P.k>=(o.rings||3)){ pend[j]=pend[pend.length-1]; pend.pop(); }
      }
    }
  }};
}
function mkTraceMine(o){
  var t=(o.delay||1.2), pend=[];
  return { id:'traceMine', update:function(g,src,dt){
    t-=dt;
    if(t<=0){
      t=o.itv*g.diff.itv;
      var px=U.clamp(g.player.x,30,CFG.W-30), py=U.clamp(g.player.y,140,CFG.H-80);
      pend.push({x:px,y:py,t:o.fuse||0.6});
      g.spawnMark(px,py,o.fuse||0.6);
    }
    for(var j=pend.length-1;j>=0;j--){
      var P=pend[j];
      P.t-=dt;
      if(P.t<=0){
        var n=g.cnt(o.n||8);
        for(var i=0;i<n;i++) g.fireEB(P.x,P.y,i*TAU/n,o.spd||92,{c:'red',sz:'s'});
        pend[j]=pend[pend.length-1]; pend.pop();
      }
    }
  }};
}
function mkLaserSpokes(o){
  var t=(o.delay||1.5);
  return { id:'laserSpokes', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    var n=o.count||4;
    var base=g.aimAng(src.x,src.y)+(o.baseOff||0)+g.rngG.range(-0.15,0.15);
    for(var i=0;i<n;i++){
      g.fireLaser(src.x,src.y,base+i*TAU/n,
        {warn:o.warn||0.6,active:o.active||1.05,w:o.w||14,rotV:o.rotV||0.22});
    }
  }};
}
function mkLaserAimed(o){
  var t=(o.delay||2.0);
  return { id:'laserAimed', update:function(g,src,dt){
    t-=dt;
    if(t>0) return;
    t=o.itv*g.diff.itv;
    g.fireLaser(src.x,src.y,g.aimAng(src.x,src.y),
      {warn:o.warn||0.65,active:o.active||0.9,w:o.w||18,rotV:0});
  }};
}
const PATTERN_FACTORIES={
  aimedFan:function(){ return mkAimedFan({itv:1.6,n:5,spread:0.8,spd:170}); },
  ring:function(){ return mkRing({itv:1.4,n:18,spd:120,rotStep:0.3}); },
  spiral:function(){ return mkSpiral({rate:8,arms:2,stepRad:0.32,spd:125}); },
  counterSpiral:function(){ return mkCounterSpiral({rate:6,arms:2,stepRad:0.3,spd:120}); },
  curtain:function(){ return mkCurtain({itv:1.5,step:24,spd:132,gapW:92,drift:52}); },
  safeLane:function(){ return mkSafeLane({itv:0.62,step:26,spd:148,laneW:96,period:0.55}); },
  waveRing:function(){ return mkWaveRing({itv:2.2,n:16,spd:110,amp:22,freq:5}); },
  accelRain:function(){ return mkAccelRain({itv:0.34,count:2,v0:42,acc:200,vmax:265}); },
  stallVolley:function(){ return mkStallVolley({itv:3.4,n:12,spread:1.5,spd:255,t1:0.65,wait:0.55,spd2:205}); },
  predictAim:function(){ return mkPredictAim({itv:1.5,n:3,lead:0.5,spd:195}); },
  crossfire:function(){ return mkCrossfire({itv:0.5,spd:168}); },
  sineSnake:function(){ return mkSineSnake({itv:0.22,spd:135,amp:30,freq:4.2,ports:2}); },
  echoPulse:function(){ return mkEchoPulse({itv:3.2,rings:3,ringGap:0.18,n:22,spd:118}); },
  traceMine:function(){ return mkTraceMine({itv:2.6,fuse:0.6,n:8,spd:92}); },
  laserSpokes:function(){ return mkLaserSpokes({itv:6,count:4,warn:0.6,active:1.05,rotV:0.22}); },
  laserAimed:function(){ return mkLaserAimed({itv:5,warn:0.65,active:0.9,w:18}); }
};

/* ======================= [11] 보스 정의 ======================= */
function makeMidboss(g){
  var hm=g.diff.hp;
  return {
    id:'octav', name:'경계 파수기 OCTAV', clr:PAL.violet, r:26, kind:'mid',
    phases:[
      { name:'옥타브 산탄', hp:Math.round(1700*hm), time:42, move:'sway',
        mk:function(){ return [
          mkRing({itv:1.25,n:24,spd:118,rotStep:0.33,c:'gold'}),
          mkAimedFan({itv:1.8,n:3,spread:0.5,spd:172,rows:2,c:'pink'})
        ]; } },
      { name:'간극 행진', hp:Math.round(2000*hm), time:46, move:'top',
        mk:function(){ return [
          mkCurtain({itv:1.3,step:24,spd:130,gapW:94,drift:50}),
          mkSpiral({rate:8,arms:2,stepRad:0.42,spd:112})
        ]; } }
    ]
  };
}
function makeFinal(g){
  var hm=g.diff.hp;
  return {
    id:'asterion', name:'프리즘 코어 ASTERION', clr:PAL.cyan, r:28, kind:'final',
    phases:[
      { name:'프리즘 선회', hp:Math.round(2200*hm), time:42, move:'sway',
        mk:function(){ return [
          mkSpiral({rate:13,arms:3,stepRad:0.26,spd:118}),
          mkAimedFan({itv:2.0,n:3,spread:0.42,spd:180,c:'pink'})
        ]; } },
      { name:'굴절 격자', hp:Math.round(2300*hm), time:44, move:'center',
        mk:function(){ return [
          mkLaserSpokes({itv:6.2,count:4,warn:0.62,active:1.05,rotV:0.2}),
          mkCrossfire({itv:0.42,spd:165}),
          mkRing({itv:2.0,n:18,spd:104,rotStep:0.5,c:'gold'})
        ]; } },
      { name:'붕괴 궤도', hp:Math.round(2400*hm), time:46, move:'top',
        mk:function(){ return [
          mkSafeLane({itv:0.6,step:26,spd:142,laneW:100,period:0.5}),
          mkPredictAim({itv:1.4,n:4,lead:0.5,spd:190}),
          mkWaveRing({itv:3.2,n:16,spd:104,amp:20,freq:5})
        ]; } },
      { name:'메아리 심연', hp:Math.round(2500*hm), time:46, move:'sway',
        mk:function(){ return [
          mkEchoPulse({itv:2.8,rings:3,ringGap:0.18,n:26,spd:114}),
          mkStallVolley({itv:3.6,n:15,spread:1.6,spd:250,t1:0.65,wait:0.6,spd2:200}),
          mkTraceMine({itv:2.4,fuse:0.62,n:8,spd:88})
        ]; } },
      { name:'아스테리온 각성', hp:Math.round(3000*hm), time:52, move:'wide',
        mk:function(){ return [
          mkCounterSpiral({rate:11,arms:2,stepRad:0.21,spd:114}),
          mkAimedFan({itv:2.2,n:5,spread:0.9,spd:178,c:'red'}),
          mkLaserAimed({itv:7,warn:0.68,active:0.85,w:18}),
          mkSineSnake({itv:0.45,spd:126,amp:26,freq:4,ports:3})
        ]; } }
    ]
  };
}

/* ======================= [12] 웨이브 & 스테이지 타임라인 ======================= */
function waveDroneArc(g,side,n,opt){
  opt=opt||{};
  n=g.cnt(n);
  for(var i=0;i<n;i++){
    var f=(n>1)?(i/(n-1)):0.5;
    var x=(side<0)?(40+f*(CFG.W-140)):(CFG.W-40-f*(CFG.W-140));
    g.spawnEnemy('drone',x,-30-i*36,{ty:96+34*Math.sin(f*2.6),holdT:3.4,wob:f*3,
      exitVX:side*60,shotN:opt.shotN||1,predict:!!opt.predict});
  }
}
function waveDarters(g,n){
  n=g.cnt(n);
  for(var i=0;i<n;i++){
    var side=(i%2===0)?-1:1;
    var x=(side<0)?g.rngG.range(20,120):g.rngG.range(CFG.W-120,CFG.W-20);
    g.spawnEnemy('darter',x,-24-i*46,{dir:-side});
  }
}
function waveWeaver(g,y0,dir,opt){
  opt=opt||{};
  g.spawnEnemy('weaver',(dir>0)?-24:CFG.W+24,y0,{vx:dir*(opt.spd||88),y0:y0,wob:g.rngG.range(0,6),
    itv:opt.itv||1.6,ringN:opt.ringN||9});
}
function waveFort(g,x,opt){
  opt=opt||{};
  g.spawnEnemy('fort',x,-40,{ty:opt.ty||150,lifeT:opt.lifeT||16,
    pat:mkAimedFan({itv:1.15,n:5,spread:0.9,spd:150,c:'gold',sz:'m'})});
}
function waveEmitter(g,pat,lifeT,x,y){
  g.spawnEnemy('emitter',(x===undefined)?CFG.W/2:x,(y===undefined)?-20:y,{lifeT:lifeT,pat:pat});
}

function buildTimeline(g){
  var E=[]; var t=0;
  function ev(dt,fn){ t+=dt; E.push({t:t,run:fn}); }
  /* ---- SECTOR 01 ---- */
  ev(0.4,function(g){ g.showBanner('SECTOR 01','균열 외곽',2.4,PAL.cyan); });
  ev(1.6,function(g){ g.showBanner('','드래그 이동 · 자동 발사 · FOCUS 저속 · BOMB 폭탄',3.2,PAL.dim); });
  ev(1.0,function(g){ waveDroneArc(g,-1,5); });
  ev(6,function(g){ waveDroneArc(g,1,5); });
  ev(6,function(g){ waveDarters(g,6); });
  ev(6,function(g){ waveWeaver(g,150,1); waveDroneArc(g,1,3); });
  ev(8,function(g){ waveWeaver(g,130,1); waveWeaver(g,200,-1); });
  ev(8,function(g){ waveFort(g,CFG.W/2); waveDarters(g,4); });
  ev(12,function(g){ waveDroneArc(g,-1,4,{shotN:2}); waveDroneArc(g,1,4,{shotN:2}); waveWeaver(g,170,-1); });
  ev(10,function(g){ waveEmitter(g,mkCurtain({itv:1.6,step:26,spd:120,gapW:104,drift:46}),8); });
  ev(10,function(g){ waveFort(g,90,{ty:140}); waveFort(g,CFG.W-90,{ty:140}); });
  ev(12,function(g){ waveDarters(g,10); });
  ev(8,function(g){ waveWeaver(g,140,1,{ringN:11}); waveWeaver(g,210,-1,{ringN:11}); waveDroneArc(g,-1,4); });
  ev(9,function(g){ /* 숨 고르기 */ });
  ev(2,function(g){ g.bossWarning('mid'); });
  ev(2.4,function(g){ g.spawnBoss(makeMidboss(g)); });
  /* ---- SECTOR 02 (중간 보스 격파 후 진행) ---- */
  ev(2,function(g){ g.showBanner('SECTOR 02','코어 회랑',2.4,PAL.violet); });
  ev(2,function(g){ waveWeaver(g,130,1,{ringN:11,itv:1.3}); waveWeaver(g,180,-1,{ringN:11,itv:1.3}); waveWeaver(g,230,1,{ringN:11,itv:1.3}); });
  ev(8,function(g){ waveFort(g,CFG.W/2,{ty:130}); waveDroneArc(g,-1,4,{predict:true}); waveDroneArc(g,1,4,{predict:true}); });
  ev(12,function(g){ waveEmitter(g,mkCrossfire({itv:0.5,spd:165}),10); waveDarters(g,4); });
  ev(12,function(g){ waveEmitter(g,mkAccelRain({itv:0.36,count:2,acc:200,vmax:260}),9); waveDarters(g,6); });
  ev(12,function(g){ waveEmitter(g,mkSafeLane({itv:0.72,step:28,spd:136,laneW:110,period:0.5}),10); waveWeaver(g,170,1,{ringN:10}); });
  ev(12,function(g){ waveDroneArc(g,-1,5,{shotN:2}); waveDarters(g,6); waveFort(g,CFG.W/2,{ty:150,lifeT:12}); });
  ev(14,function(g){ /* 숨 고르기 */ });
  ev(2,function(g){ g.bossWarning('final'); });
  ev(2.6,function(g){ g.spawnBoss(makeFinal(g)); });
  return E;
}
function buildPracticeTimeline(g,which){
  var E=[];
  E.push({t:0.5,run:function(g){ g.showBanner('보스 연습',(which==='mid')?'경계 파수기 OCTAV':'프리즘 코어 ASTERION',2.0,PAL.gold); }});
  E.push({t:1.6,run:function(g){ g.bossWarning(which); }});
  E.push({t:4.0,run:function(g){ g.spawnBoss(which==='mid'?makeMidboss(g):makeFinal(g)); }});
  return E;
}
