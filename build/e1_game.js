/* ======================= [13] 공간 분할 그리드 (플레이어탄 vs 적) ======================= */
function Grid(cell){ this.cell=cell; this.map={}; }
Grid.prototype.clear=function(){ this.map={}; };
Grid.prototype.key=function(x,y){
  return (((x/this.cell)|0)+64)*4096+(((y/this.cell)|0)+64);
};
Grid.prototype.insert=function(idx,x,y){
  var k=this.key(x,y);
  (this.map[k]||(this.map[k]=[])).push(idx);
};
Grid.prototype.query=function(x,y,out){
  out.length=0;
  var cx=(x/this.cell)|0, cy=(y/this.cell)|0;
  for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++){
    var k=(cx+dx+64)*4096+(cy+dy+64);
    var a=this.map[k];
    if(a) for(var i=0;i<a.length;i++) out.push(a[i]);
  }
  return out;
};

/* ======================= [14] 게임 상태 전이 테이블 ======================= */
const ALLOW={
  BOOT:['TITLE','TEST'],
  TITLE:['DIFF','PRACTICE','SETTINGS','HOWTO','TEST'],
  HOWTO:['DIFF','TITLE'],
  DIFF:['GAME','TITLE'],
  PRACTICE:['GAME','TITLE'],
  SETTINGS:['TITLE','PAUSE'],
  GAME:['PAUSE','OVER','RESULT','TITLE','GAME'],
  RESUME:['GAME','PAUSE','TITLE'],
  PAUSE:['RESUME','GAME','SETTINGS','TITLE'],
  OVER:['GAME','TITLE'],
  RESULT:['GAME','TITLE'],
  TEST:['TITLE']
};

/* ======================= [15] Game 본체 ======================= */
function Game(env,opts){
  opts=opts||{};
  this.env=env;
  this.headless=!!opts.headless;
  this.canvas=env.canvas||null;
  this.ctx=this.canvas?this.canvas.getContext('2d'):null;
  this.storage=env.storage;
  this.save=loadSaveData(this.storage);
  this.settings=this.save.settings;
  var self=this;
  this.audio=new AudioMgr(function(){ return self.settings; });
  this._audioInit=false;
  this.sprites=new SpriteKit(env.createCanvas);
  this.pool={
    eb:new Pool('eb',newEB,CFG.POOL.eb),
    pb:new Pool('pb',newPB,CFG.POOL.pb),
    part:new Pool('part',newPart,CFG.POOL.part),
    item:new Pool('item',newItem,CFG.POOL.item),
    en:new Pool('en',newEnemy,CFG.POOL.en),
    laser:new Pool('laser',newLaser,CFG.POOL.laser),
    txt:new Pool('txt',newTxt,CFG.POOL.txt)
  };
  this.eb=[]; this.pb=[]; this.parts=[]; this.items=[]; this.en=[]; this.lasers=[]; this.txts=[];
  this.hitstop=0;
  this.grid=new Grid(80); this._q=[];
  this.player={ x:CFG.W/2,y:CFG.H-140,vx:0,vy:0,alive:true,invuln:0,fireT:0,focus:false,tilt:0 };
  this.diffKey='abyss'; this.diff=DIFFS.abyss;
  this.mode='run'; this.practiceWhich=null;
  this.state='BOOT'; this.stateT=0; this.onState=null; this.onHud=null;
  this.seq=''; this.seqT=0;
  this.run=this._freshRun();
  this.boss=null;
  this.director={events:[],idx:0,t:0,hold:false};
  this.rngG=new RNG(1); this.rngF=new RNG(2);
  this.seed=1; this.urlSeed=null;
  this.stageT=0; this.bgT=0;
  this.banner={main:'',sub:'',t:99,life:0,color:PAL.ink};
  this.fx={shakeT:0,shakeAmp:0,flashT:0,flashA:0,warnT:0};
  this.bombCd=0;
  this.tickCount=0;
  this._loopRunning=false; this._rafId=0; this._lastTs=-1;
  this.autoLow=false; this._emaMs=16; this._slowT=0; this._fastT=0;
  this.debug=false; this.runActive=false;
  this._bgStars=this._makeStars();
  this._clearFwT=0;
}
Game.prototype={
  /* ---------- 공통 ---------- */
  _freshRun:function(){
    return { score:0, lives:CFG.PLAYER.startLives, bombs:CFG.PLAYER.startBombs,
      graze:0, mult:1, multPeak:1, extendIdx:0, kills:0, deaths:0, bombsUsed:0,
      time:0, newRecord:false, bombDrops:0,
      chain:0, chainT:0, chainBest:0,
      bonus:{clear:0,life:0,bomb:0,boss:0} };
  },
  _makeStars:function(){
    var r=new RNG(9001), a=[];
    for(var i=0;i<90;i++) a.push({x:r.range(0,CFG.W),y:r.range(0,CFG.H),
      s:r.range(0.6,2.0),v:r.range(12,55),a:r.range(0.2,0.6)});
    return a;
  },
  cnt:function(n){ return Math.max(1,Math.round(n*this.diff.den)); },
  aimAng:function(x,y){ return Math.atan2(this.player.y-y,this.player.x-x); },
  partCap:function(){ return (this.settings.fxq==='low'||this.autoLow)?CFG.PART_LOW:CFG.PART_HIGH; },
  vibe:function(p){ if(this.settings.vib){ try{ this.env.vibrate(p); }catch(e){} } },
  audioGesture:function(){
    if(!this._audioInit){ this._audioInit=true; this.audio.init(); this.audio.applyVol(); }
    this.audio.unlock();
  },
  setSetting:function(k,v){
    var s={}; for(var key in this.settings) s[key]=this.settings[key];
    s[k]=v;
    this.settings=sanitizeSettings(s);
    this.save.settings=this.settings;
    this.audio.applyVol();
    persistSave(this.storage,this.save);
  },
  markHowtoSeen:function(){ this.save.seenHowto=true; persistSave(this.storage,this.save); },
  resetSaveData:function(){
    this.storage.remove(SAVE_KEY);
    this.save=loadSaveData(this.storage);
    this.settings=this.save.settings;
    this.audio.applyVol();
  },

  /* ---------- 루프 ---------- */
  startLoop:function(){
    if(this._loopRunning) return false;
    this._loopRunning=true;
    var self=this;
    this._lastTs=-1;
    var frame=function(ts){
      self._rafId=self.env.raf(frame);
      var dt=0;
      if(self._lastTs>=0) dt=(ts-self._lastTs)/1000;
      self._lastTs=ts;
      var raw=dt*1000;
      self._emaMs=self._emaMs*0.95+Math.min(60,raw)*0.05;
      if(self.settings.fxq==='high'){
        if(self._emaMs>19){ self._slowT+=dt; self._fastT=0; if(self._slowT>2.5) self.autoLow=true; }
        else if(self._emaMs<14){ self._fastT+=dt; self._slowT=0; if(self._fastT>6) self.autoLow=false; }
      }
      self.tick(dt);
    };
    this._rafId=this.env.raf(frame);
    return true;
  },
  tick:function(dt){
    if(!isFinite(dt)||dt<0) dt=0;
    if(dt>CFG.DT_MAX) dt=CFG.DT_MAX;
    this.tickCount++;
    this.bgT+=dt;
    this.audio.update();
    /* 히트스톱: 임팩트 순간 게임 시간만 잠깐 늦춘다(연출용 bgT는 정상 진행) */
    if(this.hitstop>0){
      this.hitstop-=dt;
      if(this.hitstop<0) this.hitstop=0;
      dt*=CFG.HITSTOP.factor;
    }
    this.update(dt);
    if(!this.headless&&this.ctx){
      try{ this.render(); }catch(e){ if(this.debug&&ROOT.console) console.error(e); }
    }
  },

  /* ---------- 상태 ---------- */
  setState:function(s,force){
    if(!force&&s!==this.state){
      var al=ALLOW[this.state];
      if(!al||al.indexOf(s)<0) return false;
    }
    var prev=this.state;
    this.state=s; this.stateT=0;
    if(this.onState){ try{ this.onState(s,prev); }catch(e){} }
    return true;
  },
  update:function(dt){
    this.stateT+=dt;
    if(this.state==='GAME') this.sim(dt);
    else if(this.state==='RESUME'){ if(this.stateT>=0.9) this.setState('GAME'); }
  },

  /* ---------- 런 시작/종료 ---------- */
  _initRun:function(seedOpt){
    var seed;
    if(seedOpt!==undefined&&seedOpt!==null) seed=(+seedOpt>>>0)||1;
    else if(this.urlSeed!==null) seed=this.urlSeed;
    else seed=((Date.now()>>>0)^Math.floor((this._runCounter=(this._runCounter||0)+1)*2654435761))>>>0;
    this.seed=seed;
    this.rngG=new RNG(seed);
    this.rngF=new RNG((seed^0x9e3779b9)>>>0);
    this.clearWorld();
    this.run=this._freshRun();
    var P=this.player;
    P.x=CFG.W/2; P.y=CFG.H-140; P.vx=0; P.vy=0;
    P.alive=true; P.invuln=1.2; P.fireT=0.2; P.focus=false; P.tilt=0;
    this.boss=null; this.seq=''; this.seqT=0; this.stageT=0;
    this.banner={main:'',sub:'',t:99,life:0,color:PAL.ink};
    this.fx={shakeT:0,shakeAmp:0,flashT:0,flashA:0,warnT:0};
    this.bombCd=0; this._clearFwT=0;
    this.runActive=true;
    if(this.onHud){ try{ this.onHud(); }catch(e){} }
  },
  startRun:function(diffKey,opts){
    opts=opts||{};
    this.diffKey=DIFFS[diffKey]?diffKey:'standard';
    this.diff=DIFFS[this.diffKey];
    this.mode='run'; this.practiceWhich=null;
    this._initRun(opts.seed);
    this.director={events:buildTimeline(this),idx:0,t:0,hold:false};
    this.audio.startMusic('stage');
    return this.setState('GAME',true);
  },
  startPractice:function(which,diffKey){
    this.diffKey=DIFFS[diffKey]?diffKey:'standard';
    this.diff=DIFFS[this.diffKey];
    this.mode='practice';
    this.practiceWhich=(which==='final')?'final':'mid';
    this._initRun();
    this.director={events:buildPracticeTimeline(this,this.practiceWhich),idx:0,t:0,hold:false};
    this.audio.startMusic('stage');
    return this.setState('GAME',true);
  },
  restartRun:function(){
    if(this.mode==='practice') return this.startPractice(this.practiceWhich,this.diffKey);
    return this.startRun(this.diffKey,{seed:this.urlSeed!==null?this.urlSeed:undefined});
  },
  quitToTitle:function(){
    this.clearWorld(); this.boss=null; this.seq=''; this.runActive=false;
    this.audio.stopMusic();
    return this.setState('TITLE',true);
  },
  pause:function(){
    if((this.state==='GAME'&&this.seq==='')||this.state==='RESUME') return this.setState('PAUSE');
    return false;
  },
  resumeFromPause:function(){
    if(this.state==='PAUSE') return this.setState('RESUME');
    return false;
  },
  togglePause:function(){
    if(this.state==='GAME'&&this.seq==='') return this.pause();
    if(this.state==='PAUSE') return this.resumeFromPause();
    if(this.state==='RESUME') return this.setState('PAUSE');
    return false;
  },
  clearWorld:function(){
    var i;
    for(i=this.eb.length-1;i>=0;i--) this.pool.eb.release(this.eb[i]);
    for(i=this.pb.length-1;i>=0;i--) this.pool.pb.release(this.pb[i]);
    for(i=this.parts.length-1;i>=0;i--) this.pool.part.release(this.parts[i]);
    for(i=this.items.length-1;i>=0;i--) this.pool.item.release(this.items[i]);
    for(i=this.en.length-1;i>=0;i--) this.pool.en.release(this.en[i]);
    for(i=this.lasers.length-1;i>=0;i--) this.pool.laser.release(this.lasers[i]);
    for(i=this.txts.length-1;i>=0;i--) this.pool.txt.release(this.txts[i]);
    this.eb.length=0; this.pb.length=0; this.parts.length=0;
    this.items.length=0; this.en.length=0; this.lasers.length=0; this.txts.length=0;
    this.hitstop=0;
  },

  /* ---------- 시뮬레이션 ---------- */
  sim:function(dt){
    this.run.time+=dt;
    if(this.seq===''){
      this.stageT+=dt;
      this.updateDirector(dt);
    }
    if(this.seq!=='death') this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    updateEBs(this,dt);
    updatePBs(this,dt);
    updateLasers(this,dt);
    updateItems(this,dt);
    updateParts(this,dt);
    updateTxts(this,dt);
    if(this.run.chain>0){
      this.run.chainT-=dt;
      if(this.run.chainT<=0) this.run.chain=0;
    }
    if(this.seq==='') this.collide();
    var fx=this.fx;
    if(fx.shakeT>0) fx.shakeT-=dt;
    if(fx.flashT>0) fx.flashT-=dt;
    if(fx.warnT>0) fx.warnT-=dt;
    this.banner.t+=dt;
    if(this.seq==='death'){
      this.seqT+=dt;
      if(this.seqT>=1.5) this.finishRunToOver();
    }else if(this.seq==='clear'){
      this.seqT+=dt;
      this._clearFwT-=dt;
      if(this._clearFwT<=0){
        this._clearFwT=0.3;
        this.spawnBurst(this.rngF.range(40,CFG.W-40),this.rngF.range(80,360),
          this.rngF.pick([PAL.cyan,PAL.gold,PAL.pink]),10,180);
      }
      if(this.seqT>=2.8) this.finishRunToResult();
    }
  },
  updateDirector:function(dt){
    var D=this.director;
    if(D.hold) return;
    D.t+=dt;
    var guard=0;
    while(D.idx<D.events.length&&D.events[D.idx].t<=D.t&&guard++<20){
      try{ D.events[D.idx].run(this); }catch(e){ if(this.debug&&ROOT.console) console.error(e); }
      D.idx++;
    }
  },

  /* ---------- 플레이어 ---------- */
  updatePlayer:function(dt){
    var P=this.player;
    if(!P.alive) return;
    var inp=this.input;
    var mv=inp?inp.consumeMove():{dx:0,dy:0};
    var ax=inp?inp.axisX():0, ay=inp?inp.axisY():0;
    P.focus=inp?inp.isFocus():false;
    var spd=CFG.PLAYER.speed*(P.focus?CFG.PLAYER.focusMul:1);
    var tm=P.focus?0.55:1;
    var ox=P.x, oy=P.y;
    P.x=U.clamp(P.x+mv.dx*tm+ax*spd*dt,12,CFG.W-12);
    var safePlayTop=Math.max(CFG.PLAYER.minY,((this.view&&this.view.safeTop)||0)+CFG.HUD_H+10);
    P.y=U.clamp(P.y+mv.dy*tm+ay*spd*dt,safePlayTop,CFG.H-CFG.PLAYER.maxYPad);
    if(dt>0){
      P.vx=U.lerp(P.vx,(P.x-ox)/dt,0.35);
      P.vy=U.lerp(P.vy,(P.y-oy)/dt,0.35);
    }
    P.tilt=U.clamp(P.vx*0.0012,-0.32,0.32);
    if(P.invuln>0) P.invuln-=dt;
    this.bombCd=Math.max(0,this.bombCd-dt);
    P.fireT-=dt;
    var guard=0;
    while(P.fireT<=0&&guard++<6){ P.fireT+=CFG.PLAYER.fireInt; this.firePlayer(); }
    if(this.parts.length<this.partCap()&&this.rngF.next()<0.5)
      this.spawnFlame(P.x,P.y+12);
  },
  firePlayer:function(){
    var P=this.player;
    if(P.focus){
      for(var i=0;i<4;i++){
        var off=[-7,-2.5,2.5,7][i];
        this.firePB(P.x+off,P.y-10,0,-CFG.SHOT.spd,CFG.SHOT.fdmg);
      }
    }else{
      for(var j=0;j<3;j++){
        var a=-Math.PI/2+[-0.12,0,0.12][j];
        this.firePB(P.x,P.y-10,Math.cos(a)*CFG.SHOT.spd,Math.sin(a)*CFG.SHOT.spd,CFG.SHOT.dmg);
      }
    }
    /* 머즐 플래시 — 발사 반동 느낌 */
    if(this.parts.length<this.partCap()-8) this.spawnFlash(P.x,P.y-13,P.focus?7:9,PAL.cyan);
    this.audio.sfx('shot');
  },
  firePB:function(x,y,vx,vy,dmg){
    var b=this.pool.pb.acquire();
    if(!b) return;
    b.x=x; b.y=y; b.vx=vx; b.vy=vy; b.dmg=dmg; b.r=CFG.SHOT.r; b.t=0;
    this.pb.push(b);
  },

  /* ---------- 탄환/레이저 발사 ---------- */
  fireEB:function(x,y,ang,spd,o){
    o=o||{};
    if(this.eb.length>=this.diff.ebCap) return null;
    var b=this.pool.eb.acquire();
    if(!b) return null;
    var sz=o.sz||'m';
    b.x=x; b.y=y; b.ang=ang;
    b.spd=spd*this.diff.spd;
    b.kind=(o.kind===undefined)?BK.LIN:o.kind;
    b.vx=Math.cos(ang)*b.spd; b.vy=Math.sin(ang)*b.spd;
    b.acc=(o.acc||0)*this.diff.spd;
    b.vmax=(o.vmax!==undefined)?o.vmax*this.diff.spd:b.spd;
    b.cur=(b.kind===BK.ACC)?b.spd:0;
    b.t1=o.t1||0; b.t2=o.t2||0;
    b.spd2=(o.spd2||0)*this.diff.spd;
    b.reaimed=0;
    b.bx=x; b.by=y;
    b.amp=o.amp||0; b.freq=o.freq||0; b.phase=o.phase||0;
    b.angV=o.angV||0;
    b.t=0; b.life=o.life||CFG.EB_LIFE; b.delay=0.1;
    b.grazed=false;
    b.r=(EB_SZ[sz]||EB_SZ.m).hit;
    b.color=o.c||'pink'; b.sz=sz;
    this.eb.push(b);
    return b;
  },
  releaseEB:function(i){
    var arr=this.eb;
    this.pool.eb.release(arr[i]);
    arr[i]=arr[arr.length-1]; arr.pop();
  },
  fireLaser:function(x,y,ang,o){
    o=o||{};
    var L=this.pool.laser.acquire();
    if(!L) return null;
    L.x=x; L.y=y; L.ang=ang; L.len=980;
    L.w=o.w||14;
    L.warn=Math.max(0.3,o.warn||0.6);
    L.active=o.active||1.0; L.fade=0.25;
    L.t=0; L.rotV=o.rotV||0; L.color=PAL.red;
    this.lasers.push(L);
    return L;
  },
  clearBulletsToSparks:function(scorePer){
    var n=this.eb.length;
    var cap=this.partCap();
    for(var i=n-1;i>=0;i--){
      var b=this.eb[i];
      if(this.parts.length<cap) this.spawnSpark(b.x,b.y,PAL.cyan);
      this.releaseEB(i);
    }
    if(scorePer>0&&n>0) this.addScore(scorePer*n);
    for(var j=0;j<this.lasers.length;j++){
      var L=this.lasers[j];
      if(L.t<L.warn+L.active) L.t=L.warn+L.active;
    }
    return n;
  },
  softClearEnemies:function(){
    for(var i=this.en.length-1;i>=0;i--){
      var e=this.en[i];
      if(e.type!=='emitter'&&this.parts.length<this.partCap())
        this.spawnSpark(e.x,e.y,PAL.dim);
      this.pool.en.release(e);
      this.en[i]=this.en[this.en.length-1]; this.en.pop();
    }
  },

  /* ---------- 적 ---------- */
  /* 스폰 파라미터 정규화 — 값이 빠지거나 잘못 들어와도 NaN으로 번지지 않게 한다.
     (NaN 좌표는 화면에서 사라지고 충돌 판정도 모두 false가 되어 잡을 수 없는 적이 된다) */
  _normEnemyParams:function(type,p){
    var s=p||{};
    var n=function(v,d){ v=+v; return isFinite(v)?v:d; };
    var o={
      ty:n(s.ty,120), holdT:n(s.holdT,3.4), wob:n(s.wob,0), exitVX:n(s.exitVX,0),
      shotN:Math.max(1,Math.round(n(s.shotN,1))), predict:!!s.predict,
      dir:n(s.dir,1), vx:n(s.vx,80), y0:n(s.y0,150),
      itv:Math.max(0.05,n(s.itv,1.6)), ringN:Math.max(1,Math.round(n(s.ringN,9))),
      lifeT:n(s.lifeT,16), pat:(s.pat&&typeof s.pat.update==='function')?s.pat:null
    };
    return o;
  },
  spawnEnemy:function(type,x,y,p){
    if(!ENEMY_STATS[type]) type='drone';
    x=+x; y=+y;
    if(!isFinite(x)) x=CFG.W/2;
    if(!isFinite(y)) y=-30;
    var e=this.pool.en.acquire();
    if(!e) return null;
    var st=ENEMY_STATS[type];
    e.type=type; e.x=x; e.y=y; e.vx=0; e.vy=0;
    e.hp=Math.round(st.hp*this.diff.hp); e.mhp=e.hp;
    e.t=0; e.r=st.r; e.fireT=0.4; e.phase=0; e.state=0;
    e.hitFlash=0; e.dead=false;
    e.kbx=0; e.kby=0; e.squash=0;
    e.p=this._normEnemyParams(type,p);
    e.pat=e.p.pat;
    this.en.push(e);
    return e;
  },
  updateEnemies:function(dt){
    var arr=this.en;
    for(var i=arr.length-1;i>=0;i--){
      var e=arr[i];
      e.t+=dt;
      if(e.hitFlash>0) e.hitFlash-=dt;
      /* 넉백/스쿼시는 시각 전용 — 실제 판정 좌표에는 영향 없음 */
      if(e.kbx!==0||e.kby!==0){
        var kd=1-10*dt; if(kd<0) kd=0;
        e.kbx*=kd; e.kby*=kd;
        if(Math.abs(e.kbx)<0.05) e.kbx=0;
        if(Math.abs(e.kby)<0.05) e.kby=0;
      }
      if(e.squash>0){ e.squash-=dt*6; if(e.squash<0) e.squash=0; }
      var ai=ENEMY_AI[e.type];
      if(ai) ai(this,e,dt);
      /* 좌표가 비정상이 되면(어떤 경로로든) 화면에서 사라진 채 남지 않도록 즉시 제거 */
      if(!isFinite(e.x)||!isFinite(e.y)){
        if(this.debug&&ROOT.console) console.warn('비정상 좌표 적 제거:',e.type);
        e.dead=true;
      }
      if(e.dead){
        this.pool.en.release(e);
        arr[i]=arr[arr.length-1]; arr.pop();
      }
    }
  },
  damageEnemy:function(e,dmg,ix,iy){
    if(e.type==='emitter'||e.dead) return;
    e.hp-=dmg; e.hitFlash=0.09;
    e.squash=1;
    /* 넉백: 피격 방향으로 살짝 밀림(시각 전용) */
    e.kby=Math.min(6,e.kby+2.2);
    e.kbx+=(this.rngF.next()-0.5)*1.6;
    if(ix!==undefined&&this.parts.length<this.partCap()) this.spawnImpact(ix,iy);
    this.audio.sfx('ehit');
    if(e.hp<=0) this.killEnemy(e);
  },
  killEnemy:function(e){
    if(e.dead) return;
    e.dead=true;
    var st=ENEMY_STATS[e.type];
    var gained=Math.floor(st.score*this.run.mult);
    this.addScore(gained);
    this.run.kills++;
    this.run.mult=Math.min(CFG.MULT.max,this.run.mult+CFG.MULT.kill);
    this.run.multPeak=Math.max(this.run.multPeak,this.run.mult);
    /* 체인 콤보 */
    this.run.chain++;
    this.run.chainT=CFG.CHAIN.window;
    this.run.chainBest=Math.max(this.run.chainBest,this.run.chain);
    this.dropsFor(e);
    var big=(e.type==='fort'||e.type==='weaver');
    var low=(this.settings.fxq==='low'||this.autoLow);
    /* 타격감: 히트스톱 + 파편 + 충격파 링 + 점수 팝업 */
    this.addHitstop(big?CFG.HITSTOP.big:CFG.HITSTOP.kill);
    this.spawnBurst(e.x,e.y,PAL.orange,low?6:(big?18:11),big?230:180);
    this.spawnShards(e.x,e.y,big?(low?4:8):(low?2:5),big?150:110);
    this.spawnRing(e.x,e.y,big?PAL.gold:PAL.orange,big?12:7,
      {grow:big?150:95,life:big?0.34:0.26,a:0.9});
    this.spawnFlash(e.x,e.y,big?26:16,big?PAL.gold:PAL.orange);
    this.popup(e.x,e.y-e.r,'+'+U.fmtScore(gained),big?PAL.gold:PAL.ink,big?15:12);
    if(big){
      this.fx.shakeT=this.settings.reduceShake?0:0.13;
      this.fx.shakeAmp=3.2;
      this.vibe(18);
    }
    this.audio.sfx('edie');
  },
  addHitstop:function(s){
    this.hitstop=Math.min(CFG.HITSTOP.max,Math.max(this.hitstop,s));
  },
  dropsFor:function(e){
    var n=0, bombIt=false;
    if(e.type==='drone') n=1;
    else if(e.type==='darter') n=(this.rngG.next()<0.5)?1:0;
    else if(e.type==='weaver') n=2;
    else if(e.type==='fort'){
      n=4;
      if(this.run.bombDrops<3&&this.rngG.next()<0.5){ bombIt=true; this.run.bombDrops++; }
    }
    for(var i=0;i<n;i++) this.spawnItem(0,e.x,e.y);
    if(bombIt) this.spawnItem(1,e.x,e.y);
  },
  spawnItem:function(type,x,y){
    var it=this.pool.item.acquire();
    if(!it) return;
    it.type=type; it.x=x; it.y=y; it.t=0;
    it.vx=this.rngG.range(-70,70); it.vy=this.rngG.range(-150,-60);
    this.items.push(it);
  },
  collectItem:function(it){
    if(it.type===1){
      if(this.run.bombs<CFG.PLAYER.maxBombs){ this.run.bombs++; if(this.onHud){try{this.onHud();}catch(e){}} }
      else this.addScore(5000);
      this.audio.sfx('extend');
      this.popup(it.x,it.y-14,'BOMB +1',PAL.gold,15);
      this.spawnFlash(it.x,it.y,22,PAL.gold);
      this.vibe(15);
    }else{
      var v=Math.floor(CFG.ITEM.gemBase*this.run.mult);
      this.addScore(v);
      this.popup(it.x,it.y-10,'+'+v,PAL.green,11);
      this.audio.sfx('item');
    }
  },

  /* ---------- 보스 ---------- */
  bossWarning:function(kind){
    this.showBanner('WARNING','거대 반응 접근 중',2.2,PAL.red);
    this.fx.warnT=2.2;
    this.audio.sfx('warn');
    this.audio.startMusic('boss');
    this.vibe([30,40,30]);
  },
  spawnBoss:function(def){
    this.softClearEnemies();
    this.clearBulletsToSparks(0);
    this.director.hold=true;
    this.boss={ def:def, phaseIdx:0, hp:1, maxHp:1, ghost:1, flash:0, pats:[],
      x:CFG.W/2, y:-70, t:0, phT:0, r:def.r,
      state:'enter', swT:0, dieT:0, killedLast:false, nextIdx:0 };
  },
  _startPhase:function(i){
    var B=this.boss;
    if(!B) return;
    var ph=B.def.phases[i];
    B.phaseIdx=i; B.hp=ph.hp; B.maxHp=ph.hp; B.ghost=ph.hp;
    B.pats=ph.mk(); B.phT=0; B.state='fight';
    this.showBanner('',ph.name,1.8,PAL.gold);
    if(i>0) this.audio.sfx('phase');
  },
  updateBoss:function(dt){
    var B=this.boss;
    if(!B) return;
    B.t+=dt;
    if(B.flash>0) B.flash-=dt;
    /* 고스트 바: 최근 입힌 피해량이 흰 잔상으로 뒤따라 줄어든다 */
    if(B.ghost>B.hp) B.ghost=Math.max(B.hp,B.ghost-B.maxHp*0.85*dt-dt*30);
    if(B.state==='enter'){
      B.x=CFG.W/2;
      B.y=U.lerp(-70,CFG.BOSS_Y,U.easeOut(B.t/1.4));
      if(B.t>=1.4) this._startPhase(0);
      return;
    }
    if(B.state==='fight'){
      B.phT+=dt;
      var ph=B.def.phases[B.phaseIdx];
      var tx=CFG.W/2, ty=CFG.BOSS_Y;
      if(ph.move==='sway'){ tx=CFG.W/2+Math.sin(B.phT*0.55)*72; ty=CFG.BOSS_Y+Math.sin(B.phT*1.3)*9; }
      else if(ph.move==='center'){ tx=CFG.W/2+Math.sin(B.phT*0.4)*28; }
      else if(ph.move==='top'){ tx=CFG.W/2+Math.sin(B.phT*0.35)*40; ty=100; }
      else if(ph.move==='wide'){ tx=CFG.W/2+Math.sin(B.phT*0.5)*96; ty=CFG.BOSS_Y+Math.sin(B.phT*0.9)*12; }
      var k=Math.min(1,3*dt);
      B.x+=(tx-B.x)*k; B.y+=(ty-B.y)*k;
      if(B.phT>0.5){
        for(var p=0;p<B.pats.length;p++){
          try{ B.pats[p].update(this,B,dt); }catch(e){ if(this.debug&&ROOT.console) console.error(e); }
        }
      }
      if(B.hp<=0) this._endPhase(true);
      else if(B.phT>ph.time) this._endPhase(false);
      return;
    }
    if(B.state==='switch'){
      B.swT+=dt;
      B.y+=(CFG.BOSS_Y-B.y)*Math.min(1,2*dt);
      if(B.swT>=1.5) this._startPhase(B.nextIdx);
      return;
    }
    if(B.state==='dying'){
      B.dieT+=dt;
      this.fx.shakeT=0.1; this.fx.shakeAmp=3;
      if(this.parts.length<this.partCap()&&(B.dieT%0.2)<dt*1.5){
        this.spawnBurst(B.x+this.rngF.range(-30,30),B.y+this.rngF.range(-24,24),
          this.rngF.pick([PAL.gold,PAL.cyan,PAL.pink]),10,200);
      }
      if(B.dieT>=1.8) this._bossGone(B.killedLast);
      return;
    }
  },
  damageBoss:function(dmg,ix,iy){
    var B=this.boss;
    if(!B||B.state!=='fight') return;
    B.hp-=dmg;
    B.flash=0.06;
    this.addScore(8);
    if(ix!==undefined&&this.parts.length<this.partCap()) this.spawnImpact(ix,iy);
    this.audio.sfx('ehit');
  },
  _endPhase:function(killed){
    var B=this.boss;
    var ph=B.def.phases[B.phaseIdx];
    var left=Math.max(0,ph.time-B.phT);
    var bonus=killed?(CFG.BONUS.phaseKill+Math.floor(left)*CFG.BONUS.phasePerSec):CFG.BONUS.phaseTimeout;
    this.addScore(bonus);
    this.showBanner('','페이즈 보너스 +'+U.fmtScore(bonus),1.4,PAL.cyan);
    this.clearBulletsToSparks(5);
    /* 페이즈 격파 임팩트: 히트스톱 + 충격파 3중 + 파편 */
    this.addHitstop(CFG.HITSTOP.phase);
    this.spawnRing(B.x,B.y,PAL.white,10);
    this.spawnRing(B.x,B.y,B.def.clr,26);
    this.spawnFlash(B.x,B.y,52,B.def.clr);
    this.spawnShards(B.x,B.y,(this.settings.fxq==='low'||this.autoLow)?6:14,240);
    this.popup(B.x,B.y-B.r-10,'PHASE BREAK',PAL.gold,17);
    this.fx.shakeT=this.settings.reduceShake?0:0.26;
    this.fx.shakeAmp=5.5;
    this.audio.sfx('phase');
    this.vibe(30);
    if(B.phaseIdx>=B.def.phases.length-1){
      B.killedLast=killed;
      B.state='dying'; B.dieT=0;
      this.audio.sfx('bossdie');
      this.vibe([40,60,90]);
    }else{
      B.nextIdx=B.phaseIdx+1;
      B.state='switch'; B.swT=0;
      this.spawnRing(B.x,B.y,B.def.clr,60);
    }
  },
  _bossGone:function(killed){
    var B=this.boss;
    var kind=B?B.def.kind:'mid';
    var bx=B?B.x:CFG.W/2, by=B?B.y:CFG.BOSS_Y;
    this.boss=null;
    if(this.mode==='practice'){
      this.run.bonus.boss=killed?
        (kind==='final'?CFG.BONUS.finalboss:CFG.BONUS.midboss):
        (kind==='final'?CFG.BONUS.finalTimeout:CFG.BONUS.midbossTimeout);
      this.addScore(this.run.bonus.boss);
      this.beginClearSeq();
      return;
    }
    if(kind==='mid'){
      var bo=killed?CFG.BONUS.midboss:CFG.BONUS.midbossTimeout;
      this.addScore(bo);
      this.showBanner('','격파 보너스 +'+U.fmtScore(bo),1.6,PAL.gold);
      this.spawnItem(1,bx,by);
      for(var i=0;i<6;i++) this.spawnItem(0,bx,by);
      this.director.hold=false;
      this.audio.startMusic('stage');
    }else{
      this.run.bonus.boss=killed?CFG.BONUS.finalboss:CFG.BONUS.finalTimeout;
      this.addScore(this.run.bonus.boss);
      this.beginClearSeq();
    }
  },

  /* ---------- 충돌 ---------- */
  collide:function(){
    var P=this.player;
    var i,b,d2,rr;
    /* 적탄 vs 플레이어 (그레이즈 포함) */
    if(P.alive){
      var hit=false;
      for(i=this.eb.length-1;i>=0;i--){
        b=this.eb[i];
        if(b.delay>0) continue;
        d2=U.dist2(b.x,b.y,P.x,P.y);
        rr=b.r+CFG.PLAYER.hitR;
        if(d2<rr*rr){
          if(P.invuln<=0&&!hit){ hit=true; this.onPlayerHit(); break; }
        }else if(!b.grazed){
          var gr=b.r+CFG.PLAYER.grazeR;
          if(d2<gr*gr){ b.grazed=true; this.addGraze(b); }
        }
      }
      if(!hit&&P.invuln<=0){
        for(i=0;i<this.lasers.length;i++){
          var L=this.lasers[i];
          if(laserState(L)!==1) continue;
          var x2=L.x+Math.cos(L.ang)*L.len, y2=L.y+Math.sin(L.ang)*L.len;
          var lr=L.w/2+CFG.PLAYER.hitR;
          if(U.segDist2(P.x,P.y,L.x,L.y,x2,y2)<lr*lr){ hit=true; this.onPlayerHit(); break; }
        }
      }
      if(!hit&&P.invuln<=0){
        for(i=0;i<this.en.length;i++){
          var e=this.en[i];
          if(e.type==='emitter') continue;
          var er=e.r*0.7+CFG.PLAYER.hitR+3;
          if(U.dist2(e.x,e.y,P.x,P.y)<er*er){ hit=true; this.onPlayerHit(); break; }
        }
      }
      if(!hit&&P.invuln<=0&&this.boss&&(this.boss.state==='fight')){
        var br=this.boss.r*0.75+CFG.PLAYER.hitR;
        if(U.dist2(this.boss.x,this.boss.y,P.x,P.y)<br*br) this.onPlayerHit();
      }
    }
    /* 플레이어탄 vs 적/보스 */
    var useGrid=this.en.length>10;
    if(useGrid){
      this.grid.clear();
      for(i=0;i<this.en.length;i++){
        var en=this.en[i];
        if(en.type!=='emitter') this.grid.insert(i,en.x,en.y);
      }
    }
    for(i=this.pb.length-1;i>=0;i--){
      b=this.pb[i];
      var consumed=false;
      if(useGrid){
        var q=this.grid.query(b.x,b.y,this._q);
        for(var j=0;j<q.length;j++){
          var e2=this.en[q[j]];
          if(!e2||e2.dead) continue;
          rr=e2.r+b.r;
          if(U.dist2(e2.x,e2.y,b.x,b.y)<rr*rr){
            this.damageEnemy(e2,b.dmg,b.x,b.y); consumed=true; break;
          }
        }
      }else{
        for(var j2=0;j2<this.en.length;j2++){
          var e3=this.en[j2];
          if(e3.type==='emitter'||e3.dead) continue;
          rr=e3.r+b.r;
          if(U.dist2(e3.x,e3.y,b.x,b.y)<rr*rr){
            this.damageEnemy(e3,b.dmg,b.x,b.y); consumed=true; break;
          }
        }
      }
      if(!consumed&&this.boss&&this.boss.state==='fight'){
        rr=this.boss.r+b.r;
        if(U.dist2(this.boss.x,this.boss.y,b.x,b.y)<rr*rr){
          this.damageBoss(b.dmg,b.x,b.y); consumed=true;
        }
      }
      if(consumed){
        this.pool.pb.release(b);
        this.pb[i]=this.pb[this.pb.length-1]; this.pb.pop();
      }
    }
  },

  /* ---------- 피격/폭탄/점수 ---------- */
  onPlayerHit:function(){
    var P=this.player;
    if(!P.alive||P.invuln>0||this.seq!=='') return;
    this.run.lives--;
    this.run.deaths++;
    this.run.mult=Math.max(1,this.run.mult*CFG.MULT.hitKeep);
    /* 주변 탄 정리(부활 안전) */
    var r2=CFG.PLAYER.hitClearR*CFG.PLAYER.hitClearR;
    for(var i=this.eb.length-1;i>=0;i--){
      var b=this.eb[i];
      if(U.dist2(b.x,b.y,P.x,P.y)<r2){
        if(this.parts.length<this.partCap()) this.spawnSpark(b.x,b.y,PAL.pink);
        this.releaseEB(i);
      }
    }
    var lowq=(this.settings.fxq==='low'||this.autoLow);
    this.spawnBurst(P.x,P.y,PAL.red,lowq?8:18,220);
    this.spawnShards(P.x,P.y,lowq?4:9,190);
    this.spawnRing(P.x,P.y,PAL.red,14,{grow:260,life:0.42});
    this.spawnFlash(P.x,P.y,36,PAL.red);
    this.addHitstop(CFG.HITSTOP.hit);
    this.run.chain=0;
    this.fx.shakeT=this.settings.reduceShake?0:0.28;
    this.fx.shakeAmp=6;
    this.fx.flashT=0.16; this.fx.flashA=this.settings.reduceFlash?0.08:0.2;
    this.audio.sfx('phit');
    this.vibe(60);
    if(this.run.lives<=0){
      this.beginDeathSeq();
    }else{
      this.run.bombs=Math.max(this.run.bombs,CFG.PLAYER.refillBombs);
      P.invuln=CFG.PLAYER.respawnInvuln;
    }
    if(this.onHud){ try{ this.onHud(); }catch(e){} }
  },
  bomb:function(){
    if(this.state!=='GAME'||this.seq!==''||!this.player.alive) return false;
    if(this.bombCd>0) return false;
    if(this.run.bombs<=0){ this.audio.sfx('deny'); return false; }
    this.run.bombs--; this.run.bombsUsed++;
    this.bombCd=CFG.BOMB.cooldown;
    this.player.invuln=Math.max(this.player.invuln,CFG.BOMB.invuln);
    var n=this.clearBulletsToSparks(CFG.BOMB.sparkScore);
    for(var i=this.en.length-1;i>=0;i--) this.damageEnemy(this.en[i],CFG.BOMB.dmg);
    if(this.boss) this.damageBoss(CFG.BOMB.bossDmg);
    this.spawnRing(this.player.x,this.player.y,PAL.cyan,30);
    this.spawnRing(this.player.x,this.player.y,PAL.white,12);
    this.spawnBurst(this.player.x,this.player.y,PAL.cyan,(this.settings.fxq==='low'||this.autoLow)?12:26,320);
    this.spawnFlash(this.player.x,this.player.y,64,PAL.cyan);
    this.addHitstop(CFG.HITSTOP.big);
    if(n>0) this.popup(this.player.x,this.player.y-40,'CANCEL '+n,PAL.cyan,15);
    this.fx.flashT=0.25; this.fx.flashA=this.settings.reduceFlash?0.1:0.22;
    this.fx.shakeT=this.settings.reduceShake?0:0.3;
    this.fx.shakeAmp=6;
    this.audio.sfx('bomb');
    this.vibe(40);
    if(this.onHud){ try{ this.onHud(); }catch(e){} }
    return true;
  },
  addGraze:function(b){
    this.run.graze++;
    this.addScore(CFG.GRAZE.score);
    this.run.mult=Math.min(CFG.MULT.max,this.run.mult+CFG.GRAZE.mult);
    this.run.multPeak=Math.max(this.run.multPeak,this.run.mult);
    if(this.parts.length<this.partCap()) this.spawnSpark(b.x,b.y,PAL.cyan);
    this.audio.sfx('graze');
  },
  addScore:function(n){
    if(!isFinite(n)||n<=0) return;
    this.run.score+=Math.floor(n);
    while(this.run.extendIdx<CFG.EXTENDS.length&&this.run.score>=CFG.EXTENDS[this.run.extendIdx]){
      this.run.extendIdx++;
      if(this.run.lives<CFG.PLAYER.maxLives){
        this.run.lives++;
        this.showBanner('EXTEND!','목숨 +1',1.6,PAL.green);
        this.audio.sfx('extend');
        this.vibe([20,30,20]);
        if(this.onHud){ try{ this.onHud(); }catch(e){} }
      }
    }
  },

  /* ---------- 시퀀스/종료 ---------- */
  beginDeathSeq:function(){
    this.seq='death'; this.seqT=0;
    this.player.alive=false;
    this.spawnBurst(this.player.x,this.player.y,PAL.cyan,20,260);
    this.spawnRing(this.player.x,this.player.y,PAL.red,20);
  },
  beginClearSeq:function(){
    if(this.seq==='clear') return;
    this.seq='clear'; this.seqT=0;
    this.player.invuln=99;
    this.clearBulletsToSparks(10);
    this.softClearEnemies();
    if(this.mode==='run'){
      var r=this.run;
      r.bonus.clear=CFG.BONUS.clear;
      r.bonus.life=r.lives*CFG.BONUS.life;
      r.bonus.bomb=r.bombs*CFG.BONUS.bomb;
      this.addScore(r.bonus.clear+r.bonus.life+r.bonus.bomb);
      this.showBanner('MISSION COMPLETE','균열 봉인 완료',2.6,PAL.cyan);
    }else{
      this.showBanner('연습 종료','수고했다, 조율사',2.2,PAL.gold);
    }
    this.audio.stopMusic();
    this.audio.sfx('clear');
  },
  _updateHi:function(){
    if(this.mode!=='run') return;
    var cur=this.save.hi[this.diffKey]||0;
    if(this.run.score>cur){
      this.save.hi[this.diffKey]=this.run.score;
      this.run.newRecord=true;
      persistSave(this.storage,this.save);
    }
  },
  finishRunToOver:function(){
    this.seq=''; this.seqT=0;
    this._updateHi();
    this.audio.stopMusic();
    this.audio.sfx('over');
    this.setState('OVER');
  },
  finishRunToResult:function(){
    this.seq=''; this.seqT=0;
    this._updateHi();
    this.setState('RESULT');
  },

  /* ---------- 파티클/연출 ---------- */
  spawnBurst:function(x,y,color,n,spd){
    var cap=this.partCap();
    for(var i=0;i<n;i++){
      if(this.parts.length>=cap) return;
      var p=this.pool.part.acquire();
      if(!p) return;
      var a=this.rngF.range(0,TAU), v=this.rngF.range(spd*0.3,spd);
      p.x=x; p.y=y; p.vx=Math.cos(a)*v; p.vy=Math.sin(a)*v;
      p.t=0; p.life=this.rngF.range(0.25,0.6);
      p.size=this.rngF.range(1.5,3.5); p.color=color;
      p.kind=PK.SPARK; p.drag=2.4; p.grow=0; p.a=1;
      this.parts.push(p);
    }
  },
  spawnSpark:function(x,y,color){
    var p=this.pool.part.acquire();
    if(!p) return;
    var a=this.rngF.range(0,TAU), v=this.rngF.range(30,90);
    p.x=x; p.y=y; p.vx=Math.cos(a)*v; p.vy=Math.sin(a)*v;
    p.t=0; p.life=0.3; p.size=2; p.color=color;
    p.kind=PK.DOT; p.drag=1.5; p.grow=0; p.a=0.9;
    this.parts.push(p);
  },
  /* 충격파 링. grow/life를 이벤트 규모에 맞춰 조절한다
     (작은 적에 거대한 링이 퍼지면 화면만 어지럽고 타격감이 오히려 흐려진다) */
  spawnRing:function(x,y,color,size,opt){
    var p=this.pool.part.acquire();
    if(!p) return;
    opt=opt||{};
    p.x=x; p.y=y; p.vx=0; p.vy=0;
    p.t=0; p.life=opt.life||0.5; p.size=size; p.color=color;
    p.kind=PK.RING; p.drag=0; p.grow=(opt.grow!==undefined)?opt.grow:380; p.a=opt.a||0.8;
    p.rot=0; p.rotV=0; p.grav=0;
    this.parts.push(p);
  },
  spawnFlame:function(x,y){
    var p=this.pool.part.acquire();
    if(!p) return;
    p.x=x+this.rngF.range(-2,2); p.y=y;
    p.vx=this.rngF.range(-12,12); p.vy=this.rngF.range(60,120);
    p.t=0; p.life=0.22; p.size=this.rngF.range(1.5,3); p.color=PAL.cyan;
    p.kind=PK.FLAME; p.drag=0; p.grow=0; p.a=0.7;
    this.parts.push(p);
  },
  /* 피격 임팩트: 위로 튀는 방향성 스파크 — '맞았다'는 즉각 신호 */
  spawnImpact:function(x,y){
    var n=(this.settings.fxq==='low'||this.autoLow)?2:4;
    for(var i=0;i<n;i++){
      var p=this.pool.part.acquire();
      if(!p) return;
      var a=-Math.PI/2+this.rngF.range(-1.15,1.15);
      var v=this.rngF.range(90,210);
      p.x=x; p.y=y; p.vx=Math.cos(a)*v; p.vy=Math.sin(a)*v;
      p.t=0; p.life=this.rngF.range(0.12,0.24);
      p.size=this.rngF.range(1.6,2.8); p.color=PAL.white;
      p.kind=PK.SPARK; p.drag=3.2; p.grow=0; p.a=1; p.rot=0; p.rotV=0; p.grav=0;
      this.parts.push(p);
    }
    var f=this.pool.part.acquire();
    if(f){
      f.x=x; f.y=y; f.vx=0; f.vy=0;
      f.t=0; f.life=0.1; f.size=9; f.color=PAL.white;
      f.kind=PK.FLASH; f.drag=0; f.grow=0; f.a=0.85; f.rot=0; f.rotV=0; f.grav=0;
      this.parts.push(f);
    }
  },
  /* 파편: 회전하며 중력에 떨어지는 조각 — 파괴의 무게감 */
  spawnShards:function(x,y,n,spd){
    var cap=this.partCap();
    for(var i=0;i<n;i++){
      if(this.parts.length>=cap) return;
      var p=this.pool.part.acquire();
      if(!p) return;
      var a=this.rngF.range(0,TAU), v=this.rngF.range(spd*0.35,spd);
      p.x=x; p.y=y; p.vx=Math.cos(a)*v; p.vy=Math.sin(a)*v-40;
      p.t=0; p.life=this.rngF.range(0.45,0.85);
      p.size=this.rngF.range(2.5,5.5); p.color=PAL.steel;
      p.kind=PK.SHARD; p.drag=0.7; p.grow=0; p.a=1;
      p.rot=this.rngF.range(0,TAU); p.rotV=this.rngF.range(-9,9); p.grav=260;
      this.parts.push(p);
    }
  },
  spawnFlash:function(x,y,size,color){
    var p=this.pool.part.acquire();
    if(!p) return;
    p.x=x; p.y=y; p.vx=0; p.vy=0;
    p.t=0; p.life=0.14; p.size=size; p.color=color||PAL.white;
    p.kind=PK.FLASH; p.drag=0; p.grow=0; p.a=0.9; p.rot=0; p.rotV=0; p.grav=0;
    this.parts.push(p);
  },
  /* 플로팅 점수 팝업 */
  popup:function(x,y,text,color,size){
    if(this.txts.length>=CFG.POOL.txt) return;
    var p=this.pool.txt.acquire();
    if(!p) return;
    p.x=U.clamp(x,26,CFG.W-26); p.y=y;
    p.vy=-52; p.t=0; p.life=0.75;
    p.text=text; p.color=color||PAL.ink; p.size=size||12; p.pop=1;
    this.txts.push(p);
  },
  spawnMark:function(x,y,life){
    var p=this.pool.part.acquire();
    if(!p) return;
    p.x=x; p.y=y; p.vx=0; p.vy=0;
    p.t=0; p.life=life; p.size=26; p.color=PAL.red;
    p.kind=PK.MARK; p.drag=0; p.grow=0; p.a=1;
    this.parts.push(p);
  },
  showBanner:function(main,sub,life,color){
    this.banner.main=main; this.banner.sub=sub;
    this.banner.t=0; this.banner.life=life||2;
    this.banner.color=color||PAL.ink;
  }
};
