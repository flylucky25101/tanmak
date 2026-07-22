'use strict';
/* ============================================================
   LUMENFALL (루멘폴) — 세로형 초고난이도 탄막 슈팅
   완전 오프라인 · 외부 리소스 없음 · 순수 JS + Canvas 2D
   ============================================================ */
(function(){
const ROOT=(typeof globalThis!=='undefined')?globalThis:window;
const VERSION='1.0.0';
const SAVE_KEY='lumenfall.v1';

/* ======================= [1] 설정/상수 ======================= */
const CFG={
  W:360, H:780, HUD_H:64, DPR_MAX:2, DT_MAX:1/30,
  HITSTOP:{ kill:0.045, big:0.075, hit:0.11, phase:0.12, factor:0.18, max:0.14 },
  CHAIN:{ window:2.4, showAt:3 },
  PLAYER:{ speed:300, focusMul:0.42, hitR:3, grazeR:16, fireInt:0.085,
    respawnInvuln:3.0, hitClearR:150, startLives:3, maxLives:6,
    startBombs:3, maxBombs:6, refillBombs:3, minY:88, maxYPad:20, size:13 },
  SHOT:{ spd:940, dmg:6, fdmg:5.5, r:4 },
  BOMB:{ invuln:2.6, cooldown:0.8, dmg:230, bossDmg:180, sparkScore:10 },
  GRAZE:{ score:40, mult:0.012 },
  MULT:{ max:3.0, kill:0.02, hitKeep:0.6 },
  EXTENDS:[250000,700000,1500000],
  ITEM:{ gemBase:100, fall:96, magnetR:70, magnetV:430, lineY:230, collectR:26 },
  POOL:{ eb:1300, pb:170, part:520, item:90, en:48, laser:12, txt:44 },
  PART_HIGH:360, PART_LOW:130,
  CULL:44, EB_LIFE:13,
  BOSS_Y:128,
  BONUS:{ clear:100000, life:30000, bomb:10000, phaseKill:15000, phasePerSec:350,
    phaseTimeout:3000, midboss:40000, midbossTimeout:8000, finalboss:80000, finalTimeout:20000 }
};

const DIFFS={
  standard:{ key:'standard', label:'STANDARD', desc:'패턴 학습용 — 그래도 어렵다',
    spd:1.0, den:1.0, hp:1.0, itv:1.0, gap:1.0, jit:0.05, ebCap:560 },
  abyss:{ key:'abyss', label:'ABYSS', desc:'심연 난이도 — 진짜 루멘폴',
    spd:1.16, den:1.4, hp:1.3, itv:0.78, gap:0.74, jit:0.015, ebCap:900 }
};

const PAL={
  bg0:'#04050e', bg1:'#0a0f2a', ink:'#e9edff', dim:'#8b93c9',
  cyan:'#53f2ff', blue:'#4f9dff', pink:'#ff54d7', red:'#ff3b5f',
  orange:'#ff9e3d', gold:'#ffd35a', violet:'#b06cff', green:'#57ffa0',
  white:'#ffffff', steel:'#8fa3d9'
};
/* 적 탄환 색: 의미 체계 — pink=조준탄, gold/orange=고정·링, violet=나선, red=고속/위험 */
const EBC={ pink:'#ff54d7', orange:'#ff9e3d', gold:'#ffd35a', violet:'#b06cff', red:'#ff3b5f' };
const EB_SZ={ s:{hit:3,vis:5,glow:11}, m:{hit:4.5,vis:7,glow:15}, l:{hit:7,vis:11,glow:22} };

/* ======================= [2] 유틸리티 ======================= */
const TAU=Math.PI*2;
const U={
  clamp:function(v,a,b){ return v<a?a:(v>b?b:v); },
  lerp:function(a,b,t){ return a+(b-a)*t; },
  dist2:function(ax,ay,bx,by){ var dx=ax-bx,dy=ay-by; return dx*dx+dy*dy; },
  segDist2:function(px,py,x1,y1,x2,y2){
    var vx=x2-x1, vy=y2-y1; var L2=vx*vx+vy*vy;
    var t=L2>0?((px-x1)*vx+(py-y1)*vy)/L2:0;
    t=t<0?0:(t>1?1:t);
    var cx=x1+vx*t, cy=y1+vy*t;
    return U.dist2(px,py,cx,cy);
  },
  easeOut:function(t){ var u=1-U.clamp(t,0,1); return 1-u*u*u; },
  easeIn:function(t){ t=U.clamp(t,0,1); return t*t*t; },
  fmtScore:function(n){
    n=Math.floor(Math.max(0,+n||0)); var s=String(n), o='';
    for(var i=0;i<s.length;i++){ if(i>0&&(s.length-i)%3===0)o+=','; o+=s[i]; }
    return o;
  },
  fmtTime:function(sec){
    sec=Math.max(0,Math.floor(sec));
    var m=Math.floor(sec/60), s=sec%60;
    return m+':'+(s<10?'0':'')+s;
  }
};
function computeViewScale(w,h){
  if(!isFinite(w)||!isFinite(h)||w<=2||h<=2) return 0.5;
  return Math.max(0.2,Math.min(w/CFG.W,h/CFG.H));
}
function computeViewportTransform(w,h){
  w=isFinite(w)&&w>2?w:CFG.W;
  h=isFinite(h)&&h>2?h:CFG.H;
  return {cssW:w,cssH:h,scaleX:w/CFG.W,scaleY:h/CFG.H};
}

/* ======================= [3] seed 기반 난수 ======================= */
function RNG(seed){ this.s=(seed>>>0)||1; }
RNG.prototype.next=function(){
  var t=this.s+=0x6D2B79F5;
  t=Math.imul(t^t>>>15,t|1);
  t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296;
};
RNG.prototype.range=function(a,b){ return a+(b-a)*this.next(); };
RNG.prototype.int=function(a,b){ return a+Math.floor(this.next()*(b-a+1)); };
RNG.prototype.pick=function(arr){ return arr[Math.floor(this.next()*arr.length)%arr.length]; };
RNG.prototype.sign=function(){ return this.next()<0.5?-1:1; };

/* ======================= [4] 저장소 (localStorage 실패 안전) ======================= */
function makeStorage(backing){
  var mode='mem', ls=null; var mem={};
  if(backing===undefined){
    try{
      ls=ROOT.localStorage;
      if(ls){ ls.setItem('__lf_probe','1'); ls.removeItem('__lf_probe'); mode='ls'; }
    }catch(e){ ls=null; mode='mem'; }
  }else if(backing){
    try{ backing.setItem('__lf_probe','1'); backing.removeItem('__lf_probe'); ls=backing; mode='ls'; }
    catch(e){ mode='mem'; }
  }
  return {
    mode:function(){ return mode; },
    get:function(key,def){
      var raw=null;
      try{ raw=(mode==='ls')?ls.getItem(key):((key in mem)?mem[key]:null); }
      catch(e){ mode='mem'; raw=(key in mem)?mem[key]:null; }
      if(raw===null||raw===undefined) return def;
      try{ return JSON.parse(raw); }catch(e){ return def; }
    },
    set:function(key,val){
      var raw;
      try{ raw=JSON.stringify(val); }catch(e){ return false; }
      if(mode==='ls'){ try{ ls.setItem(key,raw); return true; }catch(e){ mode='mem'; } }
      mem[key]=raw; return true;
    },
    remove:function(key){
      try{ if(mode==='ls') ls.removeItem(key); }catch(e){}
      delete mem[key];
    }
  };
}

const DEFAULT_SETTINGS={ sfx:0.8, music:0.55, vib:true, fxq:'high',
  reduceFlash:false, reduceShake:false, hcBullets:false, showHitbox:false };
function sanitizeSettings(s){
  var d={}; for(var k in DEFAULT_SETTINGS) d[k]=DEFAULT_SETTINGS[k];
  if(!s||typeof s!=='object') return d;
  if('sfx' in s && isFinite(+s.sfx)) d.sfx=U.clamp(+s.sfx,0,1);
  if('music' in s && isFinite(+s.music)) d.music=U.clamp(+s.music,0,1);
  if('vib' in s) d.vib=!!s.vib;
  d.fxq=(s.fxq==='low')?'low':'high';
  if('reduceFlash' in s) d.reduceFlash=!!s.reduceFlash;
  if('reduceShake' in s) d.reduceShake=!!s.reduceShake;
  if('hcBullets' in s) d.hcBullets=!!s.hcBullets;
  if('showHitbox' in s) d.showHitbox=!!s.showHitbox;
  return d;
}
function loadSaveData(storage){
  var raw=storage.get(SAVE_KEY,null);
  var d={ v:1, hi:{standard:0,abyss:0}, settings:sanitizeSettings(null), seenHowto:false };
  if(raw&&typeof raw==='object'){
    if(raw.hi&&typeof raw.hi==='object'){
      if(isFinite(+raw.hi.standard)) d.hi.standard=Math.max(0,Math.floor(+raw.hi.standard));
      if(isFinite(+raw.hi.abyss)) d.hi.abyss=Math.max(0,Math.floor(+raw.hi.abyss));
    }
    d.settings=sanitizeSettings(raw.settings);
    d.seenHowto=!!raw.seenHowto;
  }
  return d;
}
function persistSave(storage,save){
  storage.set(SAVE_KEY,{ v:1, hi:save.hi, settings:save.settings, seenHowto:save.seenHowto });
}
/* ======================= [5] 오디오 관리자 (Web Audio 절차 생성) ======================= */
function AudioMgr(getSettings){
  this.getS=getSettings;
  this.ctx=null; this.ok=false;
  this.master=null; this.sfxG=null; this.musG=null;
  this.noiseBuf=null; this.last={};
  this.musicMode=null; this.nextNote=0; this.step=0;
}
AudioMgr.prototype={
  init:function(){
    if(this.ctx) return;
    try{
      var AC=ROOT.AudioContext||ROOT.webkitAudioContext;
      if(!AC) return;
      var ctx=new AC();
      this.ctx=ctx;
      this.master=ctx.createGain(); this.master.gain.value=0.9;
      this.master.connect(ctx.destination);
      this.sfxG=ctx.createGain(); this.sfxG.connect(this.master);
      this.musG=ctx.createGain(); this.musG.connect(this.master);
      var len=Math.floor(ctx.sampleRate*0.5);
      var buf=ctx.createBuffer(1,len,ctx.sampleRate);
      var d=buf.getChannelData(0); var x=987654321;
      for(var i=0;i<len;i++){ x=(x*1103515245+12345)&0x7fffffff; d[i]=(x/0x7fffffff)*2-1; }
      this.noiseBuf=buf;
      this.ok=true;
      this.applyVol();
    }catch(e){ this.ctx=null; this.ok=false; }
  },
  unlock:function(){
    if(this.ok&&this.ctx.state==='suspended'){ this.ctx.resume().catch(function(){}); }
  },
  suspend:function(){
    if(this.ok&&this.ctx.state==='running'){ this.ctx.suspend().catch(function(){}); }
  },
  applyVol:function(){
    if(!this.ok) return;
    var s=this.getS();
    this.sfxG.gain.value=s.sfx*s.sfx;
    this.musG.gain.value=s.music*s.music*0.85;
  },
  tone:function(o){
    if(!this.ok) return;
    var c=this.ctx;
    var t0=(o.time!==undefined)?o.time:c.currentTime;
    try{
      var osc=c.createOscillator(); var g=c.createGain();
      osc.type=o.type||'sine';
      osc.frequency.setValueAtTime(Math.max(1,o.f0),t0);
      if(o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1,o.f1),t0+o.t);
      var v=(o.v||0.2);
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(v,t0+(o.a||0.008));
      g.gain.exponentialRampToValueAtTime(0.0001,t0+o.t);
      osc.connect(g); g.connect(o.mus?this.musG:this.sfxG);
      osc.start(t0); osc.stop(t0+o.t+0.03);
    }catch(e){}
  },
  noise:function(o){
    if(!this.ok||!this.noiseBuf) return;
    var c=this.ctx;
    var t0=(o.time!==undefined)?o.time:c.currentTime;
    try{
      var src=c.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
      var g=c.createGain(); var f=null;
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(o.v||0.2,t0+(o.a||0.005));
      g.gain.exponentialRampToValueAtTime(0.0001,t0+o.t);
      if(o.fq){
        f=c.createBiquadFilter(); f.type=o.ft||'lowpass';
        f.frequency.setValueAtTime(o.fq,t0);
        if(o.fq1) f.frequency.exponentialRampToValueAtTime(Math.max(20,o.fq1),t0+o.t);
        src.connect(f); f.connect(g);
      }else src.connect(g);
      g.connect(o.mus?this.musG:this.sfxG);
      src.start(t0); src.stop(t0+o.t+0.03);
    }catch(e){}
  },
  sfx:function(name){
    if(!this.ok) return;
    var now=this.ctx.currentTime;
    var gap=(name==='shot')?0.05:(name==='graze'||name==='ehit'||name==='item')?0.045:0.02;
    if(this.last[name]&&(now-this.last[name])<gap) return;
    this.last[name]=now;
    switch(name){
      case 'menu':  this.tone({f0:660,f1:920,t:0.06,type:'square',v:0.12}); break;
      case 'back':  this.tone({f0:440,f1:320,t:0.07,type:'square',v:0.1}); break;
      case 'deny':  this.tone({f0:200,f1:150,t:0.09,type:'square',v:0.12}); break;
      case 'shot':  this.tone({f0:1250,f1:880,t:0.045,type:'square',v:0.035}); break;
      case 'ehit':  this.noise({t:0.04,v:0.09,fq:2400,fq1:900}); break;
      case 'edie':
        this.tone({f0:330,f1:70,t:0.22,type:'sawtooth',v:0.2});
        this.noise({t:0.16,v:0.16,fq:1800,fq1:200}); break;
      case 'graze': this.tone({f0:1900,f1:2500,t:0.045,type:'sine',v:0.08}); break;
      case 'item':  this.tone({f0:1568,f1:1976,t:0.06,type:'triangle',v:0.08}); break;
      case 'bomb':
        this.tone({f0:96,f1:36,t:0.7,type:'sine',v:0.55});
        this.noise({t:0.5,v:0.3,fq:3000,fq1:120});
        this.tone({f0:700,f1:120,t:0.4,type:'sawtooth',v:0.18}); break;
      case 'phit':
        this.noise({t:0.3,v:0.35,fq:2600,fq1:150});
        this.tone({f0:520,f1:60,t:0.45,type:'sawtooth',v:0.35}); break;
      case 'warn':
        this.tone({f0:880,f1:440,t:0.26,type:'square',v:0.2});
        this.tone({f0:880,f1:440,t:0.26,type:'square',v:0.2,time:now+0.32}); break;
      case 'phase':
        this.tone({f0:523,f1:1046,t:0.16,type:'triangle',v:0.2});
        this.tone({f0:784,f1:1568,t:0.18,type:'triangle',v:0.14,time:now+0.09}); break;
      case 'bossdie':
        this.noise({t:0.9,v:0.4,fq:2400,fq1:60});
        this.tone({f0:220,f1:28,t:1.0,type:'sawtooth',v:0.4});
        this.tone({f0:430,f1:52,t:0.8,type:'square',v:0.22,time:now+0.12}); break;
      case 'extend':
        this.tone({f0:880,f1:880,t:0.1,type:'triangle',v:0.22});
        this.tone({f0:1174,f1:1174,t:0.24,type:'triangle',v:0.22,time:now+0.11}); break;
      case 'over':{
        var seq=[392,330,262,196];
        for(var i=0;i<seq.length;i++) this.tone({f0:seq[i],f1:seq[i]*0.98,t:0.3,type:'triangle',v:0.2,time:now+i*0.28});
        break;
      }
      case 'clear':{
        var sq=[523,659,784,1046,1318];
        for(var j=0;j<sq.length;j++) this.tone({f0:sq[j],f1:sq[j],t:0.28,type:'triangle',v:0.18,time:now+j*0.11});
        break;
      }
    }
  },
  startMusic:function(mode){ this.musicMode=mode; this.step=0;
    if(this.ok) this.nextNote=this.ctx.currentTime+0.06; },
  stopMusic:function(){ this.musicMode=null; },
  update:function(){
    if(!this.ok||!this.musicMode) return;
    var c=this.ctx;
    if(c.state!=='running') return;
    var boss=(this.musicMode==='boss');
    var bpm=boss?138:112;
    var spb=60/bpm/4;
    if(this.nextNote<c.currentTime-0.5) this.nextNote=c.currentTime+0.05;
    var guard=0;
    while(this.nextNote<c.currentTime+0.18&&guard++<12){
      this._sched(this.nextNote,boss);
      this.nextNote+=spb;
      this.step=(this.step+1)%64;
    }
  },
  _sched:function(t,boss){
    var st=this.step;
    var bassSeq=boss?[0,0,3,0,5,3,7,5]:[0,0,5,0,3,0,7,5];
    var arpSeq=boss?[0,3,7,12,10,7,3,0]:[0,7,12,7,3,10,7,0];
    if(st%4===0){
      this.tone({f0:130,f1:40,t:0.09,type:'sine',v:boss?0.5:0.4,mus:true,time:t});
      var semiB=bassSeq[(st/4)%8];
      this.tone({f0:55*Math.pow(2,semiB/12),t:0.24,type:'triangle',v:0.26,mus:true,time:t});
    }
    if(boss||st%2===0){
      var semiA=arpSeq[st%8]+(st>=32?12:0);
      this.tone({f0:220*Math.pow(2,semiA/12),t:0.09,type:'square',v:boss?0.06:0.05,mus:true,time:t});
    }
    if(boss&&st%8===4) this.noise({t:0.05,v:0.045,fq:6000,ft:'highpass',mus:true,time:t});
  }
};

/* ======================= [6] 스프라이트 공장 (오프스크린 사전 렌더) ======================= */
function pathRoundSp(ctx,x,y,w,h,r){
  if(r>w/2) r=w/2; if(r>h/2) r=h/2;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
function SpriteKit(createCanvas){
  this.cc=createCanvas;
  this.cache={};
}
SpriteKit.prototype={
  _mk:function(w,h,draw){
    var cv=this.cc(w,h); cv.width=w; cv.height=h;
    var ctx=cv.getContext('2d');
    if(ctx) draw(ctx,w,h);
    return { cv:cv, hw:w/2, hh:h/2 };
  },
  bullet:function(color,sz,hc){
    var key='b_'+color+'_'+sz+'_'+(hc?1:0);
    if(this.cache[key]) return this.cache[key];
    var S=EB_SZ[sz]||EB_SZ.m;
    var col=EBC[color]||EBC.pink;
    var side=S.glow*2+4;
    var sp=this._mk(side,side,function(ctx,w,h){
      var c=w/2;
      if(hc){
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(c,c,S.vis+3,0,TAU); ctx.fill();
        ctx.fillStyle='#000000'; ctx.beginPath(); ctx.arc(c,c,S.vis+1.4,0,TAU); ctx.fill();
        ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(c,c,S.vis,0,TAU); ctx.fill();
        ctx.fillStyle=col; ctx.globalAlpha=0.55;
        ctx.beginPath(); ctx.arc(c,c,S.vis*0.5,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
      }else{
        var g=ctx.createRadialGradient(c,c,S.vis*0.3,c,c,S.glow);
        g.addColorStop(0,col); g.addColorStop(0.55,col); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.globalAlpha=0.5; ctx.fillStyle=g;
        ctx.beginPath(); ctx.arc(c,c,S.glow,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
        ctx.strokeStyle=col; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(c,c,S.vis+1.2,0,TAU); ctx.stroke();
        var g2=ctx.createRadialGradient(c,c-S.vis*0.25,0.5,c,c,S.vis);
        g2.addColorStop(0,'#ffffff'); g2.addColorStop(0.65,'#ffffff'); g2.addColorStop(1,col);
        ctx.fillStyle=g2;
        ctx.beginPath(); ctx.arc(c,c,S.vis,0,TAU); ctx.fill();
      }
    });
    sp.hit=S.hit;
    this.cache[key]=sp;
    return sp;
  },
  pshot:function(){
    var key='pshot';
    if(this.cache[key]) return this.cache[key];
    var sp=this._mk(14,26,function(ctx,w,h){
      var g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'rgba(83,242,255,0)');
      g.addColorStop(0.35,'rgba(83,242,255,0.85)');
      g.addColorStop(1,'rgba(83,242,255,0.15)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.moveTo(w/2,1); ctx.lineTo(w-3,h*0.45); ctx.lineTo(w/2,h-2); ctx.lineTo(3,h*0.45);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffffff';
      ctx.beginPath();
      ctx.moveTo(w/2,4); ctx.lineTo(w/2+3,h*0.42); ctx.lineTo(w/2,h*0.7); ctx.lineTo(w/2-3,h*0.42);
      ctx.closePath(); ctx.fill();
    });
    this.cache[key]=sp;
    return sp;
  },
  /* 아이템은 '탄환처럼 보이지 않는 것'이 최우선.
     - 탄환: 원형 + 발광 그라디언트 + 흰 코어
     - 아이템: 각진 상자/사각 프레임 + 무광 솔리드 + 검은 테두리 + 글자 라벨 */
  item:function(type){
    var key='it_'+type;
    if(this.cache[key]) return this.cache[key];
    var bomb=(type===1);
    var col=bomb?PAL.gold:PAL.green;
    var side=bomb?42:36;
    var sp=this._mk(side,side,function(ctx,w,h){
      var c=w/2;
      var box=bomb?14:11;
      /* 바깥 검은 아웃라인 — 배경/탄환과 분리 */
      ctx.fillStyle='rgba(0,0,0,0.85)';
      ctx.beginPath();
      if(bomb){
        ctx.moveTo(c,c-box-4); ctx.lineTo(c+box+4,c-box*0.48);
        ctx.lineTo(c+box+4,c+box*0.48); ctx.lineTo(c,c+box+4);
        ctx.lineTo(c-box-4,c+box*0.48); ctx.lineTo(c-box-4,c-box*0.48);
      }else{
        ctx.moveTo(c,c-box-4); ctx.lineTo(c+box+4,c);
        ctx.lineTo(c,c+box+4); ctx.lineTo(c-box-4,c);
      }
      ctx.closePath();
      ctx.fill();
      /* 본체: 무광 솔리드 사각 */
      ctx.fillStyle=col;
      ctx.beginPath();
      if(bomb){
        ctx.moveTo(c,c-box-1); ctx.lineTo(c+box+1,c-box*0.42);
        ctx.lineTo(c+box+1,c+box*0.42); ctx.lineTo(c,c+box+1);
        ctx.lineTo(c-box-1,c+box*0.42); ctx.lineTo(c-box-1,c-box*0.42);
      }else{
        ctx.moveTo(c,c-box-1); ctx.lineTo(c+box+1,c);
        ctx.lineTo(c,c+box+1); ctx.lineTo(c-box-1,c);
      }
      ctx.closePath();
      ctx.fill();
      /* 안쪽 어두운 판 — 글자 대비 확보 */
      ctx.fillStyle=bomb?'#3a2a00':'#04331d';
      ctx.beginPath();
      if(bomb){
        ctx.moveTo(c,c-box+3); ctx.lineTo(c+box-3,c-box*0.30);
        ctx.lineTo(c+box-3,c+box*0.30); ctx.lineTo(c,c+box-3);
        ctx.lineTo(c-box+3,c+box*0.30); ctx.lineTo(c-box+3,c-box*0.30);
      }else{
        ctx.moveTo(c,c-box+3); ctx.lineTo(c+box-3,c);
        ctx.lineTo(c,c+box-3); ctx.lineTo(c-box+3,c);
      }
      ctx.closePath();
      ctx.fill();
      /* 모서리 마커(픽업 느낌) */
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.6; ctx.lineCap='round';
      var e=box+0.5, n=box*0.45;
      ctx.beginPath();
      ctx.moveTo(c-e,c-e+n); ctx.lineTo(c-e,c-e); ctx.lineTo(c-e+n,c-e);
      ctx.moveTo(c+e-n,c-e); ctx.lineTo(c+e,c-e); ctx.lineTo(c+e,c-e+n);
      ctx.moveTo(c+e,c+e-n); ctx.lineTo(c+e,c+e); ctx.lineTo(c+e-n,c+e);
      ctx.moveTo(c-e+n,c+e); ctx.lineTo(c-e,c+e); ctx.lineTo(c-e,c+e-n);
      ctx.stroke();
      /* 라벨 */
      ctx.fillStyle=col;
      ctx.font='900 '+(bomb?12:8)+'px system-ui,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(bomb?'BOMB':'PWR',c,c+0.5);
    });
    this.cache[key]=sp;
    return sp;
  }
};
/* ======================= [7] 오브젝트 풀 ======================= */
function Pool(name,factory,max){
  this.name=name; this.factory=factory; this.max=max;
  this.free=[]; this.created=0;
}
Pool.prototype.acquire=function(){
  if(this.free.length) return this.free.pop();
  if(this.created>=this.max) return null;
  this.created++;
  return this.factory();
};
Pool.prototype.release=function(o){
  if(this.free.length<this.max) this.free.push(o);
};

/* 탄환 이동 종류 */
const BK={ LIN:0, ACC:1, STALL:2, SINE:3, CURVE:4 };
/* 파티클 종류 */
const PK={ DOT:0, SPARK:1, RING:2, FLAME:3, MARK:4, SHARD:5, FLASH:6 };

function newEB(){ return { x:0,y:0,vx:0,vy:0,ang:0,spd:0,acc:0,vmax:0,cur:0,
  t1:0,t2:0,spd2:0,reaimed:0,bx:0,by:0,amp:0,freq:0,phase:0,angV:0,
  t:0,life:0,delay:0,grazed:false,r:4,spr:null,kind:0,color:'pink',sz:'m' }; }
function newPB(){ return { x:0,y:0,vx:0,vy:0,dmg:6,r:4,t:0 }; }
function newPart(){ return { x:0,y:0,vx:0,vy:0,t:0,life:0.4,size:2,color:'#fff',kind:0,
  drag:0,grow:0,a:1,rot:0,rotV:0,grav:0 }; }
function newTxt(){ return { x:0,y:0,vy:-40,t:0,life:0.8,text:'',color:'#fff',size:14,pop:1 }; }
function newItem(){ return { x:0,y:0,vx:0,vy:0,type:0,t:0 }; }
function newLaser(){ return { x:0,y:0,ang:0,len:900,w:14,warn:0.6,active:1.0,fade:0.25,t:0,rotV:0,color:'#ff3b5f' }; }
function newEnemy(){ return { type:'drone',x:0,y:0,vx:0,vy:0,hp:1,mhp:1,t:0,r:10,
  fireT:0,phase:0,state:0,hitFlash:0,p:null,pat:null,dead:false,
  kbx:0,kby:0,squash:0 }; }

/* ======================= [8] 탄환/파티클/아이템/레이저 갱신 ======================= */
function updateEBs(g,dt){
  var arr=g.eb;
  for(var i=arr.length-1;i>=0;i--){
    var b=arr[i];
    b.t+=dt;
    if(b.delay>0) b.delay-=dt;
    switch(b.kind){
      case BK.LIN:
        b.x+=b.vx*dt; b.y+=b.vy*dt; break;
      case BK.ACC:
        b.cur=Math.min(b.vmax,b.cur+b.acc*dt);
        b.x+=Math.cos(b.ang)*b.cur*dt; b.y+=Math.sin(b.ang)*b.cur*dt; break;
      case BK.STALL:
        if(b.t<b.t1){
          var k=1-(b.t/b.t1);
          b.x+=Math.cos(b.ang)*b.spd*k*dt; b.y+=Math.sin(b.ang)*b.spd*k*dt;
        }else if(b.t>=b.t2){
          if(!b.reaimed){
            b.reaimed=1; b.cur=0;
            b.ang=Math.atan2(g.player.y-b.y,g.player.x-b.x);
          }
          b.cur=Math.min(b.spd2,b.cur+560*dt);
          b.x+=Math.cos(b.ang)*b.cur*dt; b.y+=Math.sin(b.ang)*b.cur*dt;
        }
        break;
      case BK.SINE:{
        b.bx+=Math.cos(b.ang)*b.spd*dt; b.by+=Math.sin(b.ang)*b.spd*dt;
        var off=Math.sin(b.t*b.freq+b.phase)*b.amp;
        var nx=-Math.sin(b.ang), ny=Math.cos(b.ang);
        b.x=b.bx+nx*off; b.y=b.by+ny*off;
        break;
      }
      case BK.CURVE:
        b.ang+=b.angV*dt;
        b.x+=Math.cos(b.ang)*b.spd*dt; b.y+=Math.sin(b.ang)*b.spd*dt;
        break;
    }
    if(b.t>b.life||b.x<-CFG.CULL||b.x>CFG.W+CFG.CULL||b.y<-CFG.CULL-40||b.y>CFG.H+CFG.CULL){
      g.releaseEB(i);
    }
  }
}
function updatePBs(g,dt){
  var arr=g.pb;
  for(var i=arr.length-1;i>=0;i--){
    var b=arr[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.t+=dt;
    if(b.y<-30||b.t>1.5||b.x<-20||b.x>CFG.W+20){
      g.pool.pb.release(b);
      arr[i]=arr[arr.length-1]; arr.pop();
    }
  }
}
function updateParts(g,dt){
  var arr=g.parts;
  for(var i=arr.length-1;i>=0;i--){
    var p=arr[i];
    p.t+=dt;
    if(p.t>=p.life){
      g.pool.part.release(p);
      arr[i]=arr[arr.length-1]; arr.pop();
      continue;
    }
    if(p.drag>0){ var d=1-p.drag*dt; if(d<0)d=0; p.vx*=d; p.vy*=d; }
    if(p.grav>0) p.vy+=p.grav*dt;
    if(p.rotV!==0) p.rot+=p.rotV*dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt;
  }
}
function updateTxts(g,dt){
  var arr=g.txts;
  for(var i=arr.length-1;i>=0;i--){
    var p=arr[i];
    p.t+=dt;
    if(p.t>=p.life){
      g.pool.txt.release(p);
      arr[i]=arr[arr.length-1]; arr.pop();
      continue;
    }
    p.y+=p.vy*dt;
    p.vy*=(1-2.2*dt);
  }
}
function updateItems(g,dt){
  var arr=g.items;
  var P=g.player;
  for(var i=arr.length-1;i>=0;i--){
    var it=arr[i];
    it.t+=dt;
    var d2=U.dist2(it.x,it.y,P.x,P.y);
    var magnet=(P.alive&&(P.y<CFG.ITEM.lineY||d2<CFG.ITEM.magnetR*CFG.ITEM.magnetR));
    if(magnet){
      var ang=Math.atan2(P.y-it.y,P.x-it.x);
      it.x+=Math.cos(ang)*CFG.ITEM.magnetV*dt;
      it.y+=Math.sin(ang)*CFG.ITEM.magnetV*dt;
    }else{
      if(it.t<0.4){ it.x+=it.vx*dt; it.y+=it.vy*dt; it.vx*=(1-3*dt); it.vy+=300*dt; }
      else it.y+=CFG.ITEM.fall*dt;
    }
    if(P.alive&&U.dist2(it.x,it.y,P.x,P.y)<CFG.ITEM.collectR*CFG.ITEM.collectR){
      g.collectItem(it);
      g.pool.item.release(it);
      arr[i]=arr[arr.length-1]; arr.pop();
      continue;
    }
    if(it.y>CFG.H+30){
      g.pool.item.release(it);
      arr[i]=arr[arr.length-1]; arr.pop();
    }
  }
}
function updateLasers(g,dt){
  var arr=g.lasers;
  for(var i=arr.length-1;i>=0;i--){
    var L=arr[i];
    L.t+=dt;
    if(L.t>L.warn&&L.t<L.warn+L.active) L.ang+=L.rotV*dt;
    if(L.t>=L.warn+L.active+L.fade){
      g.pool.laser.release(L);
      arr[i]=arr[arr.length-1]; arr.pop();
    }
  }
}
function laserState(L){
  if(L.t<L.warn) return 0;        /* 경고 */
  if(L.t<L.warn+L.active) return 1; /* 활성 */
  return 2;                        /* 소멸 */
}

/* ======================= [9] 적 AI ======================= */
/* p(스폰 옵션): 타입별 파라미터. 모든 발사는 g.diff 배율 및 seed 난수를 사용 */
const ENEMY_AI={
  drone:function(g,e,dt){
    var p=e.p;
    if(e.state===0){
      e.y+=150*dt;
      if(e.y>=p.ty){ e.y=p.ty; e.state=1; e.fireT=0.55; }
      if(e.t>4) e.state=2;
    }else if(e.state===1){
      e.x+=Math.sin(e.t*2.1+p.wob)*18*dt;
      e.fireT-=dt;
      if(e.fireT<=0&&e.y>0){
        e.fireT=1.15*g.diff.itv;
        var aim=g.aimAng(e.x,e.y)+g.rngG.range(-g.diff.jit,g.diff.jit);
        if(p.predict){
          var tx=g.player.x+g.player.vx*0.5, ty2=g.player.y+g.player.vy*0.5;
          aim=Math.atan2(ty2-e.y,tx-e.x);
        }
        var n=p.shotN||1;
        for(var i=0;i<n;i++){
          var a=aim+(n>1?0.22*((i/(n-1))-0.5)*2:0);
          g.fireEB(e.x,e.y+6,a,150,{c:'pink',sz:'s'});
        }
        e.phase++;
      }
      if(e.t>p.holdT+1.2) e.state=2;
    }else{
      e.vy=Math.min(280,e.vy+400*dt);
      e.y+=e.vy*dt; e.x+=p.exitVX*dt;
      if(e.y>CFG.H+40||e.x<-50||e.x>CFG.W+50) e.dead=true;
    }
  },
  darter:function(g,e,dt){
    var p=e.p;
    e.vy=240; e.vx=p.dir*130+Math.sin(e.t*3)*30;
    e.x+=e.vx*dt; e.y+=e.vy*dt;
    if(!e.phase&&e.y>200){
      e.phase=1;
      g.fireEB(e.x,e.y,g.aimAng(e.x,e.y)+g.rngG.range(-g.diff.jit,g.diff.jit),205,{c:'red',sz:'s'});
    }
    if(e.y>CFG.H+40||e.x<-60||e.x>CFG.W+60) e.dead=true;
  },
  weaver:function(g,e,dt){
    var p=e.p;
    e.x+=p.vx*dt;
    e.y=p.y0+Math.sin(e.t*1.8+p.wob)*46;
    e.fireT-=dt;
    if(e.fireT<=0&&e.x>20&&e.x<CFG.W-20){
      e.fireT=(p.itv||1.6)*g.diff.itv;
      var n=g.cnt(p.ringN||9);
      var base=g.rngG.range(0,TAU);
      for(var i=0;i<n;i++){
        g.fireEB(e.x,e.y,base+i*TAU/n,122,{c:'orange',sz:'s'});
      }
      e.phase++;
    }
    if((p.vx>0&&e.x>CFG.W+40)||(p.vx<0&&e.x<-40)) e.dead=true;
  },
  fort:function(g,e,dt){
    var p=e.p;
    if(e.state===0){
      e.y+=90*dt;
      if(e.y>=p.ty){ e.y=p.ty; e.state=1; }
    }else if(e.state===1){
      e.x+=Math.sin(e.t*0.8)*10*dt;
      if(e.pat) e.pat.update(g,e,dt);
      e.fireT-=dt;
      if(e.fireT<=0){
        e.fireT=3.6*g.diff.itv;
        var n=g.cnt(12);
        for(var i=0;i<n;i++) g.fireEB(e.x,e.y,i*TAU/n+g.rngG.range(0,0.3),108,{c:'gold',sz:'m'});
      }
      if(e.t>p.lifeT) e.state=2;
    }else{
      e.y+=Math.min(220,60+e.t*40)*dt;
      if(e.y>CFG.H+50) e.dead=true;
    }
  },
  emitter:function(g,e,dt){
    if(e.pat) e.pat.update(g,e,dt);
    if(e.t>e.p.lifeT) e.dead=true;
  }
};
/* 작은 화면(360px 폭)에서 실루엣이 확실히 읽히도록 크기를 확보한다 */
const ENEMY_STATS={
  drone:{ hp:22, r:12, score:300 },
  darter:{ hp:15, r:9.5, score:260 },
  weaver:{ hp:44, r:15.5, score:800 },
  fort:{ hp:170, r:23, score:3000 },
  emitter:{ hp:999999, r:0, score:0 }
};
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
/* ======================= [16] 렌더러 ======================= */
function pathRound(ctx,x,y,w,h,r){
  if(r>w/2) r=w/2; if(r>h/2) r=h/2;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
const FONT={
  n10:'600 10px system-ui,sans-serif',
  n12:'600 12px system-ui,sans-serif',
  n13:'600 13px system-ui,sans-serif',
  n14:'700 14px system-ui,sans-serif',
  n16:'700 16px system-ui,sans-serif',
  n18:'800 18px system-ui,sans-serif',
  n22:'800 22px system-ui,sans-serif',
  n26:'800 26px system-ui,sans-serif'
};
Object.assign(Game.prototype,{
  render:function(){
    var ctx=this.ctx, v=this.view||{scale:1,dpr:1};
    var kx=(v.scaleX||v.scale||1)*v.dpr;
    var ky=(v.scaleY||v.scale||1)*v.dpr;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle=PAL.bg0;
    ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    ctx.setTransform(kx,0,0,ky,0,0);
    this.drawBG(ctx);
    var inGameView=(this.runActive&&(this.state==='GAME'||this.state==='RESUME'||this.state==='PAUSE'||this.state==='OVER'||this.state==='RESULT'));
    if(inGameView){
      ctx.save();
      if(this.fx.shakeT>0&&!this.settings.reduceShake){
        var m=this.fx.shakeAmp*(this.fx.shakeT/0.22);
        ctx.translate(this.rngF.range(-m,m),this.rngF.range(-m,m));
      }
      this.drawItems(ctx);
      this.drawEnemies(ctx);
      this.drawBoss(ctx);
      this.drawPBs(ctx);
      this.drawPlayer(ctx);
      this.drawEBs(ctx);
      this.drawLasers(ctx);
      this.drawParts(ctx);
      this.drawTxts(ctx);
      ctx.restore();
      this.drawHUD(ctx);
    }
    this.drawBanner(ctx);
    if(this.fx.flashT>0){
      ctx.globalAlpha=this.fx.flashA*(this.fx.flashT/0.25);
      ctx.fillStyle='#9fd8ff';
      ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.globalAlpha=1;
    }
    if(this.fx.warnT>0){
      var wa=(this.settings.reduceFlash?0.1:0.2)*(0.6+0.4*Math.sin(this.bgT*10));
      ctx.globalAlpha=Math.max(0,wa*Math.min(1,this.fx.warnT));
      ctx.fillStyle=PAL.red;
      ctx.fillRect(0,0,CFG.W,6); ctx.fillRect(0,CFG.H-6,CFG.W,6);
      ctx.fillRect(0,0,6,CFG.H); ctx.fillRect(CFG.W-6,0,6,CFG.H);
      ctx.globalAlpha=1;
    }
    if(this.state==='RESUME'){
      ctx.fillStyle='rgba(3,4,12,0.55)';
      ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.fillStyle=PAL.cyan; ctx.font=FONT.n26;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('READY',CFG.W/2,CFG.H/2-10);
      ctx.fillStyle=PAL.dim; ctx.font=FONT.n13;
      ctx.fillText('곧 재개됩니다',CFG.W/2,CFG.H/2+18);
    }
  },
  drawBG:function(ctx){
    if(!this._bgGrad){
      var g=ctx.createLinearGradient(0,0,0,CFG.H);
      g.addColorStop(0,'#070a1e'); g.addColorStop(0.5,PAL.bg0); g.addColorStop(1,'#060714');
      this._bgGrad=g;
    }
    ctx.fillStyle=this._bgGrad;
    ctx.fillRect(0,0,CFG.W,CFG.H);
    /* 저대비 그리드 */
    ctx.globalAlpha=0.045;
    ctx.strokeStyle=PAL.cyan; ctx.lineWidth=1;
    ctx.beginPath();
    for(var x=20;x<CFG.W;x+=45){ ctx.moveTo(x,0); ctx.lineTo(x,CFG.H); }
    var oy=(this.bgT*26)%60;
    for(var y=-60+oy;y<CFG.H;y+=60){ ctx.moveTo(0,y); ctx.lineTo(CFG.W,y); }
    ctx.stroke();
    ctx.globalAlpha=1;
    /* 별 */
    var st=this._bgStars;
    for(var i=0;i<st.length;i++){
      var s=st[i];
      var yy=(s.y+this.bgT*s.v)%CFG.H;
      ctx.globalAlpha=s.a*0.7;
      ctx.fillStyle=(i%7===0)?PAL.cyan:PAL.ink;
      ctx.fillRect(s.x,yy,s.s,s.s);
    }
    ctx.globalAlpha=1;
    /* 보스전 틴트 */
    if(this.boss){
      ctx.globalAlpha=0.05;
      ctx.fillStyle=this.boss.def.clr;
      ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.globalAlpha=1;
    }
  },
  drawItems:function(ctx){
    for(var i=0;i<this.items.length;i++){
      var it=this.items[i];
      var sp=this.sprites.item(it.type);
      var bomb=(it.type===1);
      ctx.save();
      ctx.translate(it.x,it.y);
      /* Long pickup beacon stays readable through dense bullets. */
      ctx.globalAlpha=0.34+0.14*Math.sin(it.t*6);
      ctx.strokeStyle=bomb?PAL.gold:PAL.green;
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(0,-21); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5,-29); ctx.lineTo(0,-24); ctx.lineTo(5,-29);
      ctx.moveTo(-5,29); ctx.lineTo(0,34); ctx.lineTo(5,29); ctx.stroke();
      /* 회전하는 사각 포획 링 — '주울 수 있는 것'이라는 신호(탄환엔 없음) */
      ctx.save();
      ctx.rotate(it.t*2.2);
      ctx.globalAlpha=0.5+0.25*Math.sin(it.t*6);
      ctx.strokeStyle=bomb?PAL.gold:PAL.green;
      ctx.lineWidth=1.4;
      var rr=bomb?20:17;
      ctx.beginPath();
      if(bomb){
        ctx.moveTo(0,-rr); ctx.lineTo(rr,-rr*0.48); ctx.lineTo(rr,rr*0.48);
        ctx.lineTo(0,rr); ctx.lineTo(-rr,rr*0.48); ctx.lineTo(-rr,-rr*0.48);
      }else{
        ctx.moveTo(0,-rr); ctx.lineTo(rr,0); ctx.lineTo(0,rr); ctx.lineTo(-rr,0);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      /* 본체는 회전하지 않음 — 글자(P/B)가 항상 읽혀야 하므로 상하 바운스만 */
      ctx.globalAlpha=1;
      ctx.translate(0,Math.sin(it.t*5)*1.5);
      ctx.drawImage(sp.cv,-sp.hw,-sp.hh);
      ctx.restore();
    }
    ctx.globalAlpha=1;
  },
  drawEnemies:function(ctx){
    for(var i=0;i<this.en.length;i++){
      var e=this.en[i];
      if(e.type==='emitter'){
        if(this.debug){
          ctx.strokeStyle=PAL.dim; ctx.globalAlpha=0.4;
          ctx.strokeRect(e.x-4,e.y-4,8,8); ctx.globalAlpha=1;
        }
        continue;
      }
      ctx.save();
      /* 넉백 + 피격 스쿼시(시각 전용) */
      ctx.translate(e.x+e.kbx,e.y+e.kby);
      if(e.squash>0){
        var sq=e.squash*0.22;
        ctx.scale(1+sq,1-sq);
      }
      if(e.type==='drone'){
        /* 정찰 드론: 회전 링 + 육각 코어 + 단안 센서 */
        var dp=0.65+0.35*Math.sin(e.t*7);
        ctx.globalAlpha=0.26;
        ctx.fillStyle=PAL.violet;
        ctx.beginPath(); ctx.ellipse(0,1,e.r+6,e.r+4,0,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
        ctx.beginPath();
        ctx.moveTo(0,e.r+6);
        ctx.lineTo(e.r*0.38,e.r*0.18); ctx.lineTo(e.r+5,e.r*0.55);
        ctx.lineTo(e.r*0.62,-e.r*0.38); ctx.lineTo(e.r*0.30,-e.r*0.82);
        ctx.lineTo(0,-e.r*0.48);
        ctx.lineTo(-e.r*0.30,-e.r*0.82); ctx.lineTo(-e.r*0.62,-e.r*0.38);
        ctx.lineTo(-e.r-5,e.r*0.55); ctx.lineTo(-e.r*0.38,e.r*0.18);
        ctx.closePath();
        ctx.fillStyle='#46517c'; ctx.fill();
        ctx.strokeStyle='#080b1b'; ctx.lineWidth=4; ctx.stroke();
        ctx.strokeStyle=PAL.violet; ctx.lineWidth=1.5; ctx.stroke();
        /* 센서 아이 — 조준 중일 때 붉게 맥동 */
        ctx.fillStyle=PAL.red;
        ctx.globalAlpha=dp;
        ctx.beginPath(); ctx.ellipse(0,e.r*0.18,3.2,5.2,0,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
        ctx.fillStyle=PAL.orange;
        ctx.fillRect(-e.r*0.48,-e.r*0.75,2.5,4.5);
        ctx.fillRect(e.r*0.48-2.5,-e.r*0.75,2.5,4.5);
      }else if(e.type==='darter'){
        /* 돌격기: 후퇴익 + 엔진 화염 */
        var ang=Math.atan2(e.vy,e.vx)+Math.PI/2;
        ctx.rotate(ang);
        ctx.globalAlpha=0.75;
        ctx.fillStyle=PAL.orange;
        ctx.beginPath();
        ctx.moveTo(-2.4,e.r*0.7); ctx.lineTo(0,e.r+7+Math.sin(e.t*30)*2.5); ctx.lineTo(2.4,e.r*0.7);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha=1;
        ctx.fillStyle='#aeb9e0';
        ctx.beginPath();
        ctx.moveTo(0,-e.r-5);
        ctx.lineTo(e.r*0.5,-e.r*0.1);
        ctx.lineTo(e.r*1.05,e.r*0.85);
        ctx.lineTo(e.r*0.3,e.r*0.5);
        ctx.lineTo(0,e.r*0.75);
        ctx.lineTo(-e.r*0.3,e.r*0.5);
        ctx.lineTo(-e.r*1.05,e.r*0.85);
        ctx.lineTo(-e.r*0.5,-e.r*0.1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#080b1b'; ctx.lineWidth=4; ctx.stroke();
        ctx.strokeStyle=PAL.orange; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle=PAL.red;
        ctx.beginPath(); ctx.ellipse(0,-e.r*0.35,2,3.4,0,0,TAU); ctx.fill();
      }else if(e.type==='weaver'){
        /* 포탑형 부유체: 육각 장갑 + 궤도 노드 3개 + 회전 코어 */
        ctx.rotate(Math.sin(e.t*1.5)*0.09);
        ctx.beginPath();
        ctx.moveTo(0,e.r+7);
        ctx.lineTo(e.r*0.34,e.r*0.28); ctx.lineTo(e.r+7,e.r*0.18);
        ctx.lineTo(e.r*0.62,-e.r*0.54); ctx.lineTo(e.r*0.24,-e.r*0.72);
        ctx.lineTo(0,-e.r*0.38);
        ctx.lineTo(-e.r*0.24,-e.r*0.72); ctx.lineTo(-e.r*0.62,-e.r*0.54);
        ctx.lineTo(-e.r-7,e.r*0.18); ctx.lineTo(-e.r*0.34,e.r*0.28);
        ctx.closePath();
        ctx.fillStyle='#4b3d78'; ctx.fill();
        ctx.strokeStyle='#080b1b'; ctx.lineWidth=5; ctx.stroke();
        ctx.strokeStyle=PAL.violet; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle='#7784ad';
        ctx.beginPath(); ctx.ellipse(-e.r*0.68,0,3.8,7.5,0,0,TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(e.r*0.68,0,3.8,7.5,0,0,TAU); ctx.fill();
        /* 궤도 노드 */
        ctx.fillStyle=PAL.orange;
        ctx.beginPath(); ctx.arc(-e.r*0.68,-4,2.2,0,TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(e.r*0.68,-4,2.2,0,TAU); ctx.fill();
        /* 발사 직전 차징 코어 */
        var chg=U.clamp(1-e.fireT/0.5,0,1);
        ctx.fillStyle=PAL.orange;
        ctx.beginPath(); ctx.ellipse(0,e.r*0.12,3.2+chg*1.4,5.2+chg*2,0,0,TAU); ctx.fill();
        ctx.fillStyle=PAL.white;
        ctx.beginPath(); ctx.ellipse(0,e.r*0.25,1.4+chg,2.2+chg,0,0,TAU); ctx.fill();
      }else if(e.type==='fort'){
        /* 중장 포대: 장갑판 + 경고 스트라이프 + 회전 포탑 */
        ctx.beginPath();
        ctx.moveTo(0,e.r+8);
        ctx.lineTo(e.r*0.36,e.r*0.42); ctx.lineTo(e.r+8,e.r*0.22);
        ctx.lineTo(e.r*0.76,-e.r*0.58); ctx.lineTo(e.r*0.28,-e.r*0.78);
        ctx.lineTo(0,-e.r*0.40);
        ctx.lineTo(-e.r*0.28,-e.r*0.78); ctx.lineTo(-e.r*0.76,-e.r*0.58);
        ctx.lineTo(-e.r-8,e.r*0.22); ctx.lineTo(-e.r*0.36,e.r*0.42);
        ctx.closePath();
        ctx.fillStyle='#343c5f'; ctx.fill();
        ctx.strokeStyle='#070a18'; ctx.lineWidth=6; ctx.stroke();
        ctx.strokeStyle=PAL.gold; ctx.lineWidth=2.2; ctx.stroke();
        ctx.strokeStyle='rgba(255,209,102,0.42)'; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(-e.r*0.78,-e.r*0.25); ctx.lineTo(-e.r*0.28,e.r*0.25);
        ctx.moveTo(e.r*0.78,-e.r*0.25); ctx.lineTo(e.r*0.28,e.r*0.25); ctx.stroke();
        for(var fn=-1;fn<=1;fn+=2){
          ctx.fillStyle='#747eaa';
          ctx.beginPath(); ctx.ellipse(fn*e.r*0.67,-e.r*0.12,5,8,0,0,TAU); ctx.fill();
          ctx.fillStyle=PAL.orange;
          ctx.beginPath(); ctx.arc(fn*e.r*0.67,-e.r*0.35,2.5,0,TAU); ctx.fill();
        }
        /* 경고 사선 스트라이프 */
        /* 모서리 리벳 */
        /* 회전 포탑 */
        ctx.fillStyle=PAL.red;
        ctx.beginPath(); ctx.ellipse(0,e.r*0.18,4.6,7.5,0,0,TAU); ctx.fill();
        ctx.fillStyle=PAL.white;
        ctx.beginPath(); ctx.ellipse(0,e.r*0.30,1.8,3,0,0,TAU); ctx.fill();
      }
      if(e.hitFlash>0){
        ctx.globalAlpha=Math.min(1,e.hitFlash*10);
        ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.arc(0,0,e.r+2.5,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
      }
      ctx.restore();
      /* 소형 HP 바(중형 이상) */
      if((e.type==='weaver'||e.type==='fort')&&e.hp<e.mhp){
        var w=e.r*2, f=Math.max(0,e.hp/e.mhp);
        var bx=e.x+e.kbx-w/2, by=e.y+e.kby-e.r-9;
        ctx.fillStyle='rgba(0,0,0,0.65)';
        ctx.fillRect(bx-1,by-1,w+2,5);
        ctx.fillStyle=(f>0.35)?PAL.green:PAL.red;
        ctx.fillRect(bx,by,w*f,3);
      }
    }
  },
  drawBoss:function(ctx){
    var B=this.boss;
    if(!B) return;
    var alpha=(B.state==='enter')?U.easeOut(B.t/1.4):1;
    if(B.state==='dying') alpha=Math.max(0,1-B.dieT/1.8);
    ctx.save();
    ctx.translate(B.x,B.y);
    ctx.globalAlpha=alpha;
    var clr=B.def.clr;
    if(B.def.id==='octav'){
      ctx.rotate(B.t*0.5);
      ctx.strokeStyle=clr; ctx.lineWidth=3;
      ctx.beginPath();
      for(var i=0;i<8;i++){
        var a=i*TAU/8;
        var px=Math.cos(a)*B.r, py=Math.sin(a)*B.r;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle='rgba(176,108,255,0.16)'; ctx.fill();
      for(var j=0;j<4;j++){
        var a2=j*TAU/4+B.t;
        ctx.fillStyle=PAL.steel;
        ctx.beginPath(); ctx.arc(Math.cos(a2)*B.r*0.72,Math.sin(a2)*B.r*0.72,5,0,TAU); ctx.fill();
      }
      ctx.rotate(-B.t*0.5);
      ctx.fillStyle=clr;
      ctx.beginPath(); ctx.arc(0,0,11,0,TAU); ctx.fill();
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(0,0,5,0,TAU); ctx.fill();
    }else{
      var pc=[PAL.cyan,PAL.gold,PAL.violet,PAL.red,PAL.pink][Math.min(4,B.phaseIdx)];
      ctx.save();
      ctx.rotate(B.t*0.6);
      ctx.strokeStyle=pc; ctx.lineWidth=2.5;
      ctx.beginPath();
      ctx.moveTo(0,-B.r); ctx.lineTo(B.r*0.87,B.r*0.5); ctx.lineTo(-B.r*0.87,B.r*0.5);
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.rotate(-B.t*0.6);
      ctx.strokeStyle=PAL.ink; ctx.globalAlpha=alpha*0.7; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(0,B.r); ctx.lineTo(B.r*0.87,-B.r*0.5); ctx.lineTo(-B.r*0.87,-B.r*0.5);
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha=alpha;
      for(var s=0;s<6;s++){
        var a3=s*TAU/6+B.t*1.2;
        var sx=Math.cos(a3)*(B.r+13), sy=Math.sin(a3)*(B.r+13);
        ctx.fillStyle=pc;
        ctx.beginPath();
        ctx.moveTo(sx,sy-5); ctx.lineTo(sx+4,sy); ctx.lineTo(sx,sy+5); ctx.lineTo(sx-4,sy);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle='rgba(83,242,255,0.14)';
      ctx.beginPath(); ctx.arc(0,0,B.r*0.8,0,TAU); ctx.fill();
      ctx.fillStyle=pc;
      ctx.beginPath(); ctx.arc(0,0,12,0,TAU); ctx.fill();
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(0,0,5.5,0,TAU); ctx.fill();
    }
    if(B.state==='switch'){
      ctx.strokeStyle='#ffffff';
      ctx.globalAlpha=0.6*(1-B.swT/1.5);
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,0,B.r+8+B.swT*60,0,TAU); ctx.stroke();
    }
    /* 피격 플래시 — 보스에 탄이 박히는 감각 */
    if(B.flash>0){
      ctx.globalAlpha=Math.min(0.85,B.flash*12);
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(0,0,B.r*0.9,0,TAU); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha=1;
  },
  drawPBs:function(ctx){
    var sp=this.sprites.pshot();
    ctx.globalAlpha=0.9;
    for(var i=0;i<this.pb.length;i++){
      var b=this.pb[i];
      ctx.drawImage(sp.cv,b.x-sp.hw,b.y-sp.hh);
    }
    ctx.globalAlpha=1;
  },
  drawPlayer:function(ctx){
    var P=this.player;
    if(!P.alive) return;
    var blink=(P.invuln>0&&Math.floor(this.bgT*16)%2===0);
    ctx.save();
    ctx.translate(P.x,P.y);
    ctx.globalAlpha=blink?0.4:1;
    ctx.rotate(P.tilt);
    ctx.fillStyle='#dfe9ff';
    ctx.beginPath();
    ctx.moveTo(0,-15); ctx.lineTo(9,4); ctx.lineTo(4,9); ctx.lineTo(0,6);
    ctx.lineTo(-4,9); ctx.lineTo(-9,4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle=PAL.cyan; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=PAL.cyan;
    ctx.beginPath(); ctx.arc(0,-2,3.5,0,TAU); ctx.fill();
    ctx.rotate(-P.tilt);
    if(P.focus||this.settings.showHitbox){
      ctx.globalAlpha=0.85;
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(0,0,9,0,TAU); ctx.stroke();
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(0,0,CFG.PLAYER.hitR,0,TAU); ctx.fill();
      ctx.strokeStyle=PAL.pink; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(0,0,CFG.PLAYER.hitR+1.3,0,TAU); ctx.stroke();
    }
    if(P.focus){
      ctx.globalAlpha=0.1;
      ctx.fillStyle=PAL.cyan;
      ctx.beginPath(); ctx.arc(0,0,24,0,TAU); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha=1;
  },
  drawEBs:function(ctx){
    var hc=this.settings.hcBullets;
    for(var i=0;i<this.eb.length;i++){
      var b=this.eb[i];
      var sp=this.sprites.bullet(b.color,b.sz,hc);
      if(b.delay>0){
        ctx.globalAlpha=U.clamp(1-b.delay*6,0.25,1);
        ctx.drawImage(sp.cv,b.x-sp.hw,b.y-sp.hh);
        ctx.globalAlpha=1;
      }else{
        ctx.drawImage(sp.cv,b.x-sp.hw,b.y-sp.hh);
      }
    }
  },
  drawLasers:function(ctx){
    for(var i=0;i<this.lasers.length;i++){
      var L=this.lasers[i];
      var st=laserState(L);
      var x2=L.x+Math.cos(L.ang)*L.len, y2=L.y+Math.sin(L.ang)*L.len;
      if(st===0){
        var p=L.t/L.warn;
        ctx.save();
        ctx.globalAlpha=0.25+0.35*Math.sin(p*22);
        ctx.strokeStyle=L.color; ctx.lineWidth=2;
        ctx.setLineDash([7,7]);
        ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha=0.14;
        ctx.lineWidth=L.w;
        ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.restore();
      }else if(st===1){
        ctx.save();
        ctx.globalAlpha=0.35;
        ctx.strokeStyle=L.color; ctx.lineWidth=L.w+8;
        ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.globalAlpha=0.9;
        ctx.lineWidth=L.w*0.6;
        ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.globalAlpha=1;
        ctx.strokeStyle='#ffffff'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.restore();
      }else{
        var f=1-(L.t-L.warn-L.active)/L.fade;
        ctx.save();
        ctx.globalAlpha=Math.max(0,f*0.5);
        ctx.strokeStyle=L.color; ctx.lineWidth=Math.max(1,L.w*0.4*f);
        ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.restore();
      }
    }
  },
  drawParts:function(ctx){
    for(var i=0;i<this.parts.length;i++){
      var p=this.parts[i];
      var f=1-p.t/p.life;
      if(p.kind===PK.RING){
        ctx.globalAlpha=p.a*f;
        ctx.strokeStyle=p.color; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size+p.grow*p.t,0,TAU); ctx.stroke();
      }else if(p.kind===PK.MARK){
        var pr=p.size*(0.4+0.6*f);
        ctx.globalAlpha=0.5+0.4*Math.sin(p.t*24);
        ctx.strokeStyle=p.color; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(p.x,p.y,pr,0,TAU); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x-pr-5,p.y); ctx.lineTo(p.x-pr+3,p.y);
        ctx.moveTo(p.x+pr-3,p.y); ctx.lineTo(p.x+pr+5,p.y);
        ctx.moveTo(p.x,p.y-pr-5); ctx.lineTo(p.x,p.y-pr+3);
        ctx.moveTo(p.x,p.y+pr-3); ctx.lineTo(p.x,p.y+pr+5);
        ctx.stroke();
      }else if(p.kind===PK.FLASH){
        var fr=p.size*(0.45+0.75*(1-f));
        ctx.globalAlpha=p.a*f*f;
        ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,fr,0,TAU); ctx.fill();
        ctx.globalAlpha=p.a*f;
        ctx.fillStyle=PAL.white;
        ctx.beginPath(); ctx.arc(p.x,p.y,fr*0.42,0,TAU); ctx.fill();
      }else if(p.kind===PK.SHARD){
        ctx.save();
        ctx.globalAlpha=p.a*Math.min(1,f*2.2);
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle=p.color;
        ctx.beginPath();
        ctx.moveTo(0,-p.size); ctx.lineTo(p.size*0.62,p.size*0.5); ctx.lineTo(-p.size*0.5,p.size*0.7);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=PAL.orange; ctx.lineWidth=1; ctx.stroke();
        ctx.restore();
      }else if(p.kind===PK.SPARK){
        ctx.globalAlpha=p.a*f;
        ctx.strokeStyle=p.color; ctx.lineWidth=p.size*0.8;
        ctx.beginPath();
        ctx.moveTo(p.x,p.y);
        ctx.lineTo(p.x-p.vx*0.03,p.y-p.vy*0.03);
        ctx.stroke();
      }else{
        ctx.globalAlpha=p.a*f;
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
      }
    }
    ctx.globalAlpha=1;
  },
  /* 목숨 아이콘 = 플레이어 기체 미니어처 (무엇을 뜻하는지 즉시 읽히도록) */
  _iconShip:function(ctx,x,y,s,color){
    ctx.save();
    ctx.translate(x,y); ctx.scale(s,s);
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(0,-6); ctx.lineTo(4.2,2); ctx.lineTo(1.8,4); ctx.lineTo(0,2.6);
    ctx.lineTo(-1.8,4); ctx.lineTo(-4.2,2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  /* 폭탄 아이콘 = 둥근 폭탄 본체 + 심지 + 불꽃 */
  _iconBomb:function(ctx,x,y,s,color){
    ctx.save();
    ctx.translate(x,y); ctx.scale(s,s);
    ctx.fillStyle=color;
    ctx.beginPath(); ctx.arc(0,1.4,4.6,0,TAU); ctx.fill();
    ctx.fillRect(-1.3,-4.6,2.6,2.4);
    ctx.strokeStyle=color; ctx.lineWidth=1.3; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(0.6,-4.4); ctx.quadraticCurveTo(3.4,-6.4,2.4,-8.2);
    ctx.stroke();
    ctx.fillStyle=PAL.white;
    ctx.beginPath(); ctx.arc(2.2,-8.8,1.5,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(1.6,2.6,1.7,0,TAU); ctx.fill();
    ctx.restore();
  },
  drawHUD:function(ctx){
    var r=this.run, i;
    var H=CFG.HUD_H;
    var safeTop=(this.view&&this.view.safeTop)||0;
    ctx.save(); ctx.translate(0,safeTop);
    /* 풀 글라스 콕핏 패널: 성운 그라디언트 + 절단 모서리 + 항법 눈금 */
    var hg=ctx.createLinearGradient(0,0,CFG.W,H);
    hg.addColorStop(0,'rgba(4,14,36,0.97)');
    hg.addColorStop(0.55,'rgba(7,10,30,0.94)');
    hg.addColorStop(1,'rgba(24,8,42,0.95)');
    ctx.fillStyle=hg;
    ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(CFG.W,0); ctx.lineTo(CFG.W,H-9);
    ctx.lineTo(CFG.W-9,H); ctx.lineTo(9,H); ctx.lineTo(0,H-9); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=0.13; ctx.fillStyle=PAL.cyan;
    for(var hs=0;hs<6;hs++) ctx.fillRect(18+hs*67,8+(hs%2)*20,1.2,1.2);
    ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(83,242,255,0.42)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,H-0.5); ctx.lineTo(92,H-0.5);
    ctx.moveTo(112,H-0.5); ctx.lineTo(248,H-0.5); ctx.moveTo(268,H-0.5); ctx.lineTo(CFG.W,H-0.5); ctx.stroke();
    ctx.strokeStyle='rgba(176,108,255,0.26)';
    ctx.beginPath(); ctx.moveTo(0,34.5); ctx.lineTo(CFG.W,34.5); ctx.stroke();
    ctx.fillStyle='rgba(83,242,255,0.045)';
    pathRound(ctx,6,36,158,23,5); ctx.fill();
    ctx.fillStyle='rgba(176,108,255,0.055)';
    pathRound(ctx,168,36,186,23,5); ctx.fill();
    ctx.strokeStyle='rgba(139,147,201,0.16)';
    ctx.beginPath(); ctx.moveTo(82,39); ctx.lineTo(82,57); ctx.moveTo(165,39); ctx.lineTo(165,57); ctx.moveTo(272,39); ctx.lineTo(272,57); ctx.stroke();
    ctx.textBaseline='top';

    /* ── 1행: SCORE(좌) / HI(우) ── */
    ctx.textAlign='left';
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText('SCORE //',10,4);
    ctx.textAlign='right';
    ctx.fillText('HI // '+U.fmtScore(Math.max(this.save.hi[this.diffKey]||0,r.score)),CFG.W-10,4);

    /* ── 2행: 점수값(좌) / 배율(우) ── */
    ctx.textAlign='left';
    ctx.font=FONT.n18; ctx.fillStyle=PAL.ink;
    ctx.fillText(U.fmtScore(r.score),10,14);
    ctx.textAlign='right';
    ctx.font=FONT.n16;
    ctx.fillStyle=(r.mult>=2)?PAL.gold:(r.mult>1.3?PAL.cyan:PAL.dim);
    ctx.fillText('×'+r.mult.toFixed(2),CFG.W-10,15);

    /* ── 3행: 목숨 / 폭탄 / 그레이즈 / 난이도 (겹침 없는 고정 그리드) ── */
    var ROW=37;
    ctx.textAlign='left';
    /* 목숨: 기체 아이콘 + LIFE×N */
    this._iconShip(ctx,17,ROW+8,1.15,r.lives>0?PAL.cyan:PAL.dim);
    ctx.font=FONT.n14;
    ctx.fillStyle=(r.lives<=1)?PAL.red:PAL.ink;
    ctx.fillText('×'+r.lives,26,ROW+1);
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText('LIFE',48,ROW+4);
    /* 폭탄: 폭탄 아이콘 + BOMB×N */
    this._iconBomb(ctx,95,ROW+8,1.1,r.bombs>0?PAL.gold:PAL.dim);
    ctx.font=FONT.n14;
    ctx.fillStyle=(r.bombs>0)?PAL.ink:PAL.dim;
    ctx.fillText('×'+r.bombs,104,ROW+1);
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText('BOMB',126,ROW+4);
    /* 그레이즈 */
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText('GRAZE',174,ROW+4);
    ctx.font=FONT.n14; ctx.fillStyle=PAL.cyan;
    ctx.fillText(String(r.graze),216,ROW+1);
    /* 난이도(우측 정렬, PAUSE 버튼과 겹치지 않도록 3행에 배치) */
    ctx.textAlign='right';
    ctx.font=FONT.n10;
    ctx.fillStyle=(this.diffKey==='abyss')?PAL.pink:PAL.dim;
    ctx.fillText(this.diff.label+(this.mode==='practice'?' // P':''),CFG.W-10,ROW+4);

    /* ── 체인 콤보 (3 이상일 때만, 보스바와 겹치지 않게 화면 좌측 중단) ── */
    if(r.chain>=CFG.CHAIN.showAt){
      var cf=U.clamp(r.chainT/CFG.CHAIN.window,0,1);
      var cy=this.boss?H+46:H+16;
      ctx.textAlign='left';
      ctx.globalAlpha=0.55+0.45*cf;
      ctx.font=FONT.n16; ctx.fillStyle=(r.chain>=10)?PAL.gold:PAL.cyan;
      ctx.fillText(r.chain+' CHAIN',10,cy);
      ctx.fillStyle='rgba(83,242,255,0.28)';
      ctx.fillRect(10,cy+18,64*cf,2);
      ctx.globalAlpha=1;
    }

    /* ── 보스 정보 바 ── */
    var B=this.boss;
    if(B&&(B.state==='fight'||B.state==='switch'||B.state==='dying')){
      ctx.textAlign='left';
      ctx.font=FONT.n13; ctx.fillStyle=PAL.ink;
      ctx.fillText(B.def.name,10,H+5);
      /* 남은 페이즈 핍 */
      var total=B.def.phases.length;
      for(i=0;i<total;i++){
        var px=CFG.W-16-i*12;
        var done=(i<B.phaseIdx);
        ctx.fillStyle=done?'rgba(139,147,201,0.35)':B.def.clr;
        ctx.beginPath();
        ctx.moveTo(px,H+7); ctx.lineTo(px+3.5,H+11.5);
        ctx.lineTo(px,H+16); ctx.lineTo(px-3.5,H+11.5);
        ctx.closePath(); ctx.fill();
      }
      var barY=H+21, barW=CFG.W-20;
      var f=(B.state==='fight')?U.clamp(B.hp/B.maxHp,0,1):0;
      var gf=(B.state==='fight')?U.clamp(B.ghost/B.maxHp,0,1):0;
      ctx.fillStyle='rgba(0,0,0,0.6)';
      pathRound(ctx,10,barY,barW,8,4); ctx.fill();
      /* 고스트(최근 피해) 잔상 */
      if(gf>f){
        ctx.fillStyle='rgba(255,255,255,0.5)';
        pathRound(ctx,10,barY,barW*gf,8,4); ctx.fill();
      }
      if(f>0){
        ctx.fillStyle=(f>0.5)?PAL.green:(f>0.25?PAL.gold:PAL.red);
        pathRound(ctx,10,barY,barW*f,8,4); ctx.fill();
        if(f<0.25){
          ctx.globalAlpha=0.25+0.25*Math.sin(this.bgT*11);
          ctx.fillStyle=PAL.white;
          pathRound(ctx,10,barY,barW*f,8,4); ctx.fill();
          ctx.globalAlpha=1;
        }
      }
      if(B.state==='fight'){
        var ph=B.def.phases[B.phaseIdx];
        var tl=Math.max(0,ph.time-B.phT);
        ctx.font=FONT.n10;
        ctx.fillStyle=(tl<10)?PAL.red:PAL.dim;
        ctx.textAlign='right';
        ctx.fillText(Math.ceil(tl)+'s',CFG.W-10,H+33);
        ctx.textAlign='left';
        ctx.fillStyle=PAL.dim;
        ctx.fillText('PHASE '+(B.phaseIdx+1)+'/'+total+' · '+ph.name,10,H+33);
      }
    }

    ctx.restore();
    /* 초반 조작 힌트 */
    if(this.mode==='run'&&this.stageT<6&&this.seq===''){
      ctx.globalAlpha=U.clamp(6-this.stageT,0,1)*0.8;
      ctx.font=FONT.n13; ctx.fillStyle=PAL.dim;
      ctx.textAlign='center';
      ctx.fillText('좌측 스틱 이동 · 우측 FOCUS / BOMB',CFG.W/2,CFG.H-150);
      ctx.globalAlpha=1;
    }
  },
  drawTxts:function(ctx){
    if(!this.txts.length) return;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for(var i=0;i<this.txts.length;i++){
      var p=this.txts[i];
      var f=p.t/p.life;
      var sc=(f<0.16)?(0.6+2.5*f):1;
      ctx.save();
      ctx.globalAlpha=(f>0.6)?U.clamp((1-f)/0.4,0,1):1;
      ctx.translate(p.x,p.y);
      ctx.scale(sc,sc);
      ctx.font='800 '+p.size+'px system-ui,sans-serif';
      ctx.lineWidth=3; ctx.strokeStyle='rgba(2,4,12,0.9)';
      ctx.strokeText(p.text,0,0);
      ctx.fillStyle=p.color;
      ctx.fillText(p.text,0,0);
      ctx.restore();
    }
    ctx.globalAlpha=1;
  },
  drawBanner:function(ctx){
    var b=this.banner;
    if(b.t>=b.life) return;
    var a=1;
    if(b.t<0.2) a=b.t/0.2;
    else if(b.t>b.life-0.35) a=Math.max(0,(b.life-b.t)/0.35);
    ctx.save();
    ctx.globalAlpha=a;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(b.main){
      if(b.main==='WARNING'){
        ctx.fillStyle='rgba(255,59,95,0.14)';
        ctx.fillRect(0,264,CFG.W,64);
      }
      ctx.font=FONT.n22;
      ctx.fillStyle=b.color;
      ctx.fillText(b.main,CFG.W/2,288);
    }
    if(b.sub){
      ctx.font=FONT.n14;
      ctx.fillStyle=b.main?PAL.ink:b.color;
      ctx.fillText(b.sub,CFG.W/2,b.main?316:296);
    }
    ctx.restore();
  }
});
/* ======================= [17] 입력 관리자 ======================= */
function normalizeStick(dx,dy,maxR,dead){
  maxR=Math.max(1,+maxR||1); dead=U.clamp(+dead||0,0,0.9);
  var len=Math.sqrt(dx*dx+dy*dy), clamped=Math.min(maxR,len);
  if(len<0.0001) return {x:0,y:0,px:0,py:0};
  var nx=dx/len, ny=dy/len, raw=clamped/maxR;
  var mag=raw<=dead?0:(raw-dead)/(1-dead);
  return {x:nx*mag,y:ny*mag,px:nx*clamped,py:ny*clamped};
}
function InputMgr(game,canvas,els){
  this.game=game; this.canvas=canvas; this.els=els;
  this.kX=1; this.kY=1;
  this.movePointer=null; this.lx=0; this.ly=0;
  this.stickPointer=null; this.stickX=0; this.stickY=0;
  this.accX=0; this.accY=0;
  this.keys={};
  this.focusTouch=false;
  this._bind();
}
InputMgr.prototype={
  _bind:function(){
    var self=this, g=this.game, cv=this.canvas;
    function pd(e){ if(e.cancelable) e.preventDefault(); }
    cv.addEventListener('pointerdown',function(e){
      pd(e); g.audioGesture();
      if(e.pointerType==='touch') return;
      if(self.movePointer===null){
        self.movePointer=e.pointerId;
        self.lx=e.clientX; self.ly=e.clientY;
        try{ cv.setPointerCapture(e.pointerId); }catch(err){}
      }
    },{passive:false});
    cv.addEventListener('pointermove',function(e){
      if(e.pointerId!==self.movePointer) return;
      pd(e);
      self.accX+=(e.clientX-self.lx)*self.kX;
      self.accY+=(e.clientY-self.ly)*self.kY;
      self.lx=e.clientX; self.ly=e.clientY;
    },{passive:false});
    function upCancel(e){
      if(e.pointerId===self.movePointer) self.movePointer=null;
    }
    cv.addEventListener('pointerup',upCancel);
    cv.addEventListener('pointercancel',function(e){ upCancel(e); self.focusTouch=false; });
    cv.addEventListener('lostpointercapture',upCancel);
    /* 모바일 가상 방향 스틱 */
    var stick=this.els.stick, knob=this.els.stickKnob;
    function resetStick(){
      self.stickPointer=null; self.stickX=0; self.stickY=0;
      if(knob) knob.style.transform='translate3d(0,0,0)';
      if(stick) stick.classList.remove('on');
    }
    function moveStick(e){
      if(!stick||!knob) return;
      var rect=stick.getBoundingClientRect();
      var S=normalizeStick(e.clientX-(rect.left+rect.width/2),e.clientY-(rect.top+rect.height/2),rect.width*0.31,0.12);
      self.stickX=S.x; self.stickY=S.y;
      knob.style.transform='translate3d('+S.px.toFixed(1)+'px,'+S.py.toFixed(1)+'px,0)';
    }
    if(stick){
      stick.addEventListener('pointerdown',function(e){
        pd(e); e.stopPropagation(); g.audioGesture();
        if(self.stickPointer!==null) return;
        self.stickPointer=e.pointerId; stick.classList.add('on');
        try{ stick.setPointerCapture(e.pointerId); }catch(err){}
        moveStick(e);
      },{passive:false});
      stick.addEventListener('pointermove',function(e){
        if(e.pointerId!==self.stickPointer) return;
        pd(e); moveStick(e);
      },{passive:false});
      var offStick=function(e){ if(e.pointerId===self.stickPointer) resetStick(); };
      stick.addEventListener('pointerup',offStick);
      stick.addEventListener('pointercancel',offStick);
      stick.addEventListener('lostpointercapture',offStick);
    }
    /* FOCUS 버튼 */
    var bf=this.els.focus;
    if(bf){
      bf.addEventListener('pointerdown',function(e){
        pd(e); e.stopPropagation(); g.audioGesture();
        self.focusTouch=true; bf.classList.add('on');
        try{ bf.setPointerCapture(e.pointerId); }catch(err){}
      },{passive:false});
      var offF=function(e){ self.focusTouch=false; bf.classList.remove('on'); };
      bf.addEventListener('pointerup',offF);
      bf.addEventListener('pointercancel',offF);
      bf.addEventListener('lostpointercapture',offF);
    }
    /* BOMB 버튼 */
    var bb=this.els.bomb;
    if(bb){
      bb.addEventListener('pointerdown',function(e){
        pd(e); e.stopPropagation(); g.audioGesture();
        bb.classList.add('on');
        var ok=g.bomb();
        if(!ok){ bb.classList.add('deny'); setTimeout(function(){ bb.classList.remove('deny'); },220); }
      },{passive:false});
      var offB=function(){ bb.classList.remove('on'); };
      bb.addEventListener('pointerup',offB);
      bb.addEventListener('pointercancel',offB);
      bb.addEventListener('lostpointercapture',offB);
    }
    /* PAUSE 버튼 */
    var bp=this.els.pause;
    if(bp){
      bp.addEventListener('pointerdown',function(e){
        pd(e); e.stopPropagation(); g.audioGesture();
        g.togglePause();
      },{passive:false});
    }
    /* 키보드 */
    /* Shift 조합 시 'a'↔'A' 불일치로 키가 눌린 채 남는 것을 막기 위해
       한 글자 키는 항상 소문자로 정규화해 기록한다 */
    function normKey(e){ var k=e.key; return (k&&k.length===1)?k.toLowerCase():k; }
    ROOT.addEventListener('keydown',function(e){
      var k=normKey(e);
      self.keys[k]=true;
      if(k==='ArrowLeft'||k==='ArrowRight'||k==='ArrowUp'||k==='ArrowDown'||k===' ')
        { if(e.cancelable) e.preventDefault(); }
      if(e.repeat) return;
      g.audioGesture();
      if(k===' '||k==='x'){ if(g.state==='GAME') g.bomb(); }
      else if(k==='p'){ g.togglePause(); }
      else if(k==='Escape'){ if(self.onEscape) self.onEscape(); }
      else if(k==='Enter'){ if(self.onEnter) self.onEnter(); }
    });
    ROOT.addEventListener('keyup',function(e){ self.keys[normKey(e)]=false; });
    ROOT.addEventListener('blur',function(){ self.releaseAll(); });
  },
  releaseAll:function(){
    this.movePointer=null;
    this.stickPointer=null; this.stickX=0; this.stickY=0;
    this.focusTouch=false;
    this.accX=0; this.accY=0;
    this.keys={};
    if(this.els.focus) this.els.focus.classList.remove('on');
    if(this.els.bomb) this.els.bomb.classList.remove('on');
    if(this.els.stick) this.els.stick.classList.remove('on');
    if(this.els.stickKnob) this.els.stickKnob.style.transform='translate3d(0,0,0)';
  },
  consumeMove:function(){
    var r={dx:this.accX,dy:this.accY};
    this.accX=0; this.accY=0;
    return r;
  },
  axisX:function(){
    var v=0;
    if(this.keys.ArrowLeft||this.keys.a) v-=1;
    if(this.keys.ArrowRight||this.keys.d) v+=1;
    return U.clamp(v+this.stickX,-1,1);
  },
  axisY:function(){
    var v=0;
    if(this.keys.ArrowUp||this.keys.w) v-=1;
    if(this.keys.ArrowDown||this.keys.s) v+=1;
    return U.clamp(v+this.stickY,-1,1);
  },
  isFocus:function(){ return this.focusTouch||!!this.keys.Shift; }
};

/* ======================= [18] UI 관리자 (DOM 메뉴) ======================= */
function UIMgr(game){
  this.g=game;
  this.settingsFrom='TITLE';
  this.howtoNext='TITLE';
  this._resetArmed=false;
  var self=this;
  this.$=function(id){ return document.getElementById(id); };
  this.screens={ BOOT:'scr-boot', TITLE:'scr-title', HOWTO:'scr-howto', DIFF:'scr-diff',
    PRACTICE:'scr-practice', SETTINGS:'scr-settings', PAUSE:'scr-pause',
    OVER:'scr-over', RESULT:'scr-result', TEST:'scr-test' };
  game.onState=function(s,prev){ self.sync(s,prev); };
  game.onHud=function(){ self.updateBombBadge(); };
  this._bind();
  this.refreshSettingsUI();
  this.updateBombBadge();
}
UIMgr.prototype={
  _on:function(id,fn){
    var el=this.$(id);
    if(el) el.addEventListener('click',fn);
    return el;
  },
  _bind:function(){
    var g=this.g, self=this;
    function sfx(){ g.audioGesture(); g.audio.sfx('menu'); }
    this._on('t-start',function(){ sfx();
      if(!g.save.seenHowto){ self.howtoNext='DIFF'; g.setState('HOWTO'); }
      else g.setState('DIFF');
    });
    this._on('t-practice',function(){ sfx(); g.setState('PRACTICE'); });
    this._on('t-howto',function(){ sfx(); self.howtoNext='TITLE'; g.setState('HOWTO'); });
    this._on('t-settings',function(){ sfx(); self.settingsFrom='TITLE'; g.setState('SETTINGS'); });
    this._on('hw-start',function(){ sfx(); g.markHowtoSeen();
      g.setState(self.howtoNext==='DIFF'?'DIFF':'TITLE'); });
    this._on('d-std',function(){ sfx(); g.startRun('standard'); });
    this._on('d-aby',function(){ sfx(); g.startRun('abyss'); });
    this._on('d-back',function(){ g.audio.sfx('back'); g.setState('TITLE'); });
    this._on('pr-diff',function(){ sfx();
      self.prDiff=(self.prDiff==='abyss')?'standard':'abyss';
      self.$('pr-diff').textContent='난이도: '+DIFFS[self.prDiff].label;
    });
    this._on('pr-mid',function(){ sfx(); g.startPractice('mid',self.prDiff||'standard'); });
    this._on('pr-fin',function(){ sfx(); g.startPractice('final',self.prDiff||'standard'); });
    this._on('pr-back',function(){ g.audio.sfx('back'); g.setState('TITLE'); });
    this._on('pa-resume',function(){ sfx(); g.resumeFromPause(); });
    this._on('pa-restart',function(){ sfx(); g.restartRun(); });
    this._on('pa-settings',function(){ sfx(); self.settingsFrom='PAUSE'; g.setState('SETTINGS'); });
    this._on('pa-title',function(){ g.audio.sfx('back'); g.quitToTitle(); });
    this._on('ov-retry',function(){ sfx(); g.restartRun(); });
    this._on('ov-title',function(){ g.audio.sfx('back'); g.quitToTitle(); });
    this._on('rs-retry',function(){ sfx(); g.restartRun(); });
    this._on('rs-quit',function(){ g.audio.sfx('back'); g.quitToTitle(); });
    this._on('ts-back',function(){ g.setState('TITLE'); });
    this._on('st-back',function(){ g.audio.sfx('back');
      g.setState(self.settingsFrom==='PAUSE'?'PAUSE':'TITLE'); });
    /* 설정 컨트롤 */
    var rs=this.$('rng-sfx');
    if(rs) rs.addEventListener('input',function(){
      g.setSetting('sfx',(+rs.value||0)/100); g.audio.sfx('menu'); });
    var rm=this.$('rng-music');
    if(rm) rm.addEventListener('input',function(){ g.setSetting('music',(+rm.value||0)/100); });
    function tog(id,key){
      self._on(id,function(){
        g.audioGesture();
        g.setSetting(key,!g.settings[key]);
        g.audio.sfx('menu');
        self.refreshSettingsUI();
      });
    }
    tog('tg-vib','vib'); tog('tg-flash','reduceFlash'); tog('tg-shake','reduceShake');
    tog('tg-hc','hcBullets'); tog('tg-hb','showHitbox');
    this._on('tg-fxq',function(){
      g.audioGesture();
      g.setSetting('fxq',g.settings.fxq==='high'?'low':'high');
      g.autoLow=false;
      g.audio.sfx('menu');
      self.refreshSettingsUI();
    });
    var fsBtn=this.$('st-full');
    if(fsBtn){
      var de=document.documentElement;
      if(!de.requestFullscreen) fsBtn.style.display='none';
      else fsBtn.addEventListener('click',function(){
        try{
          if(document.fullscreenElement) document.exitFullscreen().catch(function(){});
          else de.requestFullscreen().catch(function(){});
        }catch(e){}
      });
    }
    this._on('st-reset',function(){
      var btn=self.$('st-reset');
      if(!self._resetArmed){
        self._resetArmed=true;
        btn.textContent='한 번 더 누르면 초기화됩니다';
        setTimeout(function(){ self._resetArmed=false; btn.textContent='저장 데이터 초기화'; },3000);
      }else{
        self._resetArmed=false;
        g.resetSaveData();
        btn.textContent='초기화 완료';
        setTimeout(function(){ btn.textContent='저장 데이터 초기화'; },1500);
        self.refreshSettingsUI();
        self.refreshTitle();
      }
    });
  },
  handleEnter:function(){
    var g=this.g;
    if(g.state==='TITLE'){ var b=this.$('t-start'); if(b) b.click(); }
    else if(g.state==='HOWTO'){ var h=this.$('hw-start'); if(h) h.click(); }
    else if(g.state==='DIFF') g.startRun(g.diffKey||'standard');
    else if(g.state==='OVER'||g.state==='RESULT') g.restartRun();
    else if(g.state==='PAUSE') g.resumeFromPause();
  },
  handleEscape:function(){
    var g=this.g;
    if(g.state==='GAME'||g.state==='RESUME') g.togglePause();
    else if(g.state==='PAUSE') g.resumeFromPause();
    else if(g.state==='SETTINGS'){ var b=this.$('st-back'); if(b) b.click(); }
    else if(g.state==='DIFF'||g.state==='PRACTICE'||g.state==='HOWTO') g.setState('TITLE');
  },
  sync:function(s,prev){
    var body=document.body;
    if(s==='GAME'||s==='RESUME') body.classList.add('playing');
    else body.classList.remove('playing');
    for(var st in this.screens){
      var el=this.$(this.screens[st]);
      if(el) el.classList.toggle('hidden',st!==s);
    }
    if(s==='TITLE') this.refreshTitle();
    else if(s==='DIFF') this.refreshDiff();
    else if(s==='SETTINGS') this.refreshSettingsUI();
    else if(s==='OVER') this.fillOver();
    else if(s==='RESULT') this.fillResult();
    this.updateBombBadge();
  },
  refreshTitle:function(){
    var g=this.g;
    var a=this.$('hi-std'), b=this.$('hi-aby');
    if(a) a.textContent='STANDARD 최고 '+U.fmtScore(g.save.hi.standard);
    if(b) b.textContent='ABYSS 최고 '+U.fmtScore(g.save.hi.abyss);
  },
  refreshDiff:function(){
    var g=this.g;
    var a=this.$('d-hi-std'), b=this.$('d-hi-aby');
    if(a) a.textContent='최고 '+U.fmtScore(g.save.hi.standard);
    if(b) b.textContent='최고 '+U.fmtScore(g.save.hi.abyss);
  },
  refreshSettingsUI:function(){
    var g=this.g, self=this;
    var rs=this.$('rng-sfx'); if(rs) rs.value=Math.round(g.settings.sfx*100);
    var rm=this.$('rng-music'); if(rm) rm.value=Math.round(g.settings.music*100);
    function set(id,on,onTxt,offTxt){
      var el=self.$(id);
      if(el){ el.textContent=on?(onTxt||'켬'):(offTxt||'끔'); el.classList.toggle('tog-on',!!on); }
    }
    set('tg-vib',g.settings.vib);
    set('tg-fxq',g.settings.fxq==='high','높음','낮음');
    set('tg-flash',g.settings.reduceFlash);
    set('tg-shake',g.settings.reduceShake);
    set('tg-hc',g.settings.hcBullets);
    set('tg-hb',g.settings.showHitbox);
  },
  updateBombBadge:function(){
    var el=this.$('bombN');
    if(el) el.textContent=String(this.g.run.bombs);
    var bb=this.$('btnBomb');
    if(bb) bb.classList.toggle('empty',this.g.run.bombs<=0);
  },
  fillOver:function(){
    var g=this.g;
    var s=this.$('ov-score'), h=this.$('ov-hi'), n=this.$('ov-new');
    if(s) s.textContent=U.fmtScore(g.run.score);
    if(h) h.textContent='최고 기록 '+U.fmtScore(g.save.hi[g.diffKey]||0);
    if(n) n.classList.toggle('hidden',!g.run.newRecord);
  },
  fillResult:function(){
    var g=this.g, r=g.run;
    var t=this.$('rs-title-text');
    if(t) t.textContent=(g.mode==='practice')?'연습 종료':'균열 봉인 완료';
    var rank='C';
    if(r.deaths===0) rank='S';
    else if(r.deaths<=1) rank='A';
    else if(r.deaths<=3) rank='B';
    var rows=[
      ['보스 보너스',U.fmtScore(r.bonus.boss)],
      ['클리어 보너스',U.fmtScore(r.bonus.clear)],
      ['잔기 보너스',U.fmtScore(r.bonus.life)],
      ['폭탄 보너스',U.fmtScore(r.bonus.bomb)],
      ['그레이즈',String(r.graze)],
      ['최대 배율','x'+r.multPeak.toFixed(2)],
      ['피격','×'+r.deaths],
      ['플레이 시간',U.fmtTime(r.time)],
      ['최종 스코어',U.fmtScore(r.score)],
      ['랭크',(g.mode==='practice')?'—':rank]
    ];
    var el=this.$('rs-lines');
    if(el){
      var html='';
      for(var i=0;i<rows.length;i++){
        html+='<div class="rrow'+(i>=rows.length-2?' big':'')+'"><span>'+rows[i][0]+
          '</span><span>'+rows[i][1]+'</span></div>';
      }
      el.innerHTML=html;
    }
    var n=this.$('rs-new');
    if(n) n.classList.toggle('hidden',!r.newRecord);
  },
  showTests:function(res){
    var sum=this.$('test-sum'), list=this.$('test-list');
    if(sum) sum.textContent='PASS '+res.pass+' / FAIL '+res.fail+' (총 '+res.results.length+')';
    if(list){
      var html='';
      for(var i=0;i<res.results.length;i++){
        var t=res.results[i];
        html+='<div class="trow '+(t.pass?'tp':'tf')+'">'+
          (t.pass?'PASS':'FAIL')+' — '+t.name+
          (t.pass?'':(' : '+String(t.msg).replace(/</g,'&lt;')))+'</div>';
      }
      list.innerHTML=html;
    }
    this.g.setState('TEST');
  }
};

/* ======================= [19] 브라우저 부트스트랩 ======================= */
function bootBrowser(){
  if(ROOT.__LF_BOOTED) return;
  ROOT.__LF_BOOTED=true;
  var canvas=document.getElementById('cv');
  var app=document.getElementById('app');
  var env={
    canvas:canvas,
    createCanvas:function(w,h){
      var c=document.createElement('canvas');
      c.width=w||2; c.height=h||2;
      return c;
    },
    storage:makeStorage(),
    vibrate:function(p){ try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} },
    raf:function(cb){ return ROOT.requestAnimationFrame(cb); },
    caf:function(id){ ROOT.cancelAnimationFrame(id); }
  };
  var game=new Game(env,{});
  ROOT.LUMENFALL.game=game;
  /* URL 파라미터 */
  var qp={};
  try{
    var usp=new URLSearchParams(ROOT.location.search);
    usp.forEach(function(v,k){ qp[k]=v; });
  }catch(e){}
  if(qp.seed!==undefined){ var sv=parseInt(qp.seed,10); if(isFinite(sv)) game.urlSeed=(sv>>>0)||1; }
  if(qp.debug==='1') game.debug=true;
  if(qp.quality==='low') game.settings.fxq='low';
  var ui=new UIMgr(game);
  var input=new InputMgr(game,canvas,{
    stick:document.getElementById('stickZone'),
    stickKnob:document.getElementById('stickKnob'),
    focus:document.getElementById('btnFocus'),
    bomb:document.getElementById('btnBomb'),
    pause:document.getElementById('btnPause')
  });
  game.input=input;
  input.onEnter=function(){ ui.handleEnter(); };
  input.onEscape=function(){ ui.handleEscape(); };
  /* 리사이즈 */
  var rotateEl=document.getElementById('scr-rotate');
  function checkOrient(){
    var w=ROOT.innerWidth, h=ROOT.innerHeight;
    /* 데스크톱 가로 창은 제외: 모바일 가로(높이가 낮음)에서만 안내 */
    var land=(w>h*1.12&&h<560);
    if(rotateEl) rotateEl.classList.toggle('hidden',!land);
    if(land&&(game.state==='GAME'||game.state==='RESUME')) game.pause();
  }
  function resize(){
    var rect=app?app.getBoundingClientRect():{width:ROOT.innerWidth,height:ROOT.innerHeight};
    var fit=computeViewportTransform(rect.width,rect.height);
    var cw=Math.max(2,Math.round(fit.cssW)), ch=Math.max(2,Math.round(fit.cssH));
    canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
    var dpr=Math.min(ROOT.devicePixelRatio||1,CFG.DPR_MAX);
    if(cw*dpr>1500) dpr=Math.max(1,1500/cw);
    canvas.width=Math.max(2,Math.round(cw*dpr));
    canvas.height=Math.max(2,Math.round(ch*dpr));
    var safeTop=0, safeBottom=0;
    try{
      var probe=document.createElement('div');
      probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding-top:var(--sat);padding-bottom:var(--sab)';
      document.body.appendChild(probe);
      var pcs=ROOT.getComputedStyle(probe);
      safeTop=parseFloat(pcs.paddingTop)||0; safeBottom=parseFloat(pcs.paddingBottom)||0;
      document.body.removeChild(probe);
    }catch(e){}
    game.view={scaleX:fit.scaleX,scaleY:fit.scaleY,dpr:dpr,cssW:cw,cssH:ch,
      safeTop:safeTop/fit.scaleY,safeBottom:safeBottom/fit.scaleY};
    input.kX=CFG.W/cw; input.kY=CFG.H/ch;
    checkOrient();
  }
  var resizePending=false;
  function queueResize(){
    if(resizePending) return;
    resizePending=true;
    ROOT.requestAnimationFrame(function(){ resizePending=false; resize(); });
  }
  ROOT.addEventListener('resize',queueResize);
  ROOT.addEventListener('orientationchange',queueResize);
  if(ROOT.visualViewport) ROOT.visualViewport.addEventListener('resize',queueResize);
  resize();
  /* 가시성 */
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){
      input.releaseAll();
      if(game.state==='GAME'||game.state==='RESUME') game.pause();
      game.audio.suspend();
    }else{
      game.audio.unlock();
    }
  });
  document.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  ROOT.addEventListener('pointerdown',function(){ game.audioGesture(); },{passive:true});
  /* 디버그 오버레이 */
  var dbg=document.getElementById('dbg');
  if(game.debug&&dbg){
    dbg.classList.remove('hidden');
    setInterval(function(){
      dbg.textContent=
        'FPS '+(1000/Math.max(1,game._emaMs)).toFixed(0)+
        ' | ms '+game._emaMs.toFixed(1)+
        ' | eb '+game.eb.length+' pb '+game.pb.length+
        ' | fx '+game.parts.length+' en '+game.en.length+
        ' | st '+game.state+(game.autoLow?' lowFX':'')+
        '\nseed '+game.seed+' | t '+game.stageT.toFixed(1)+
        ' | pool eb '+game.pool.eb.created+'/'+CFG.POOL.eb;
    },250);
  }
  /* 서비스 워커(선택) */
  try{
    if('serviceWorker' in navigator&&
       (ROOT.location.protocol==='https:'||ROOT.location.hostname==='localhost'||ROOT.location.hostname==='127.0.0.1')){
      navigator.serviceWorker.register('./sw.js').catch(function(){});
    }
  }catch(e){}
  /* 시작 */
  game.startLoop();
  if(qp.test==='1'){
    setTimeout(function(){
      var res=runSelfTests({});
      try{ if(ROOT.console) console.log('[LUMENFALL 자체 테스트] PASS '+res.pass+' FAIL '+res.fail); }catch(e){}
      ui.showTests(res);
    },80);
  }else{
    game.setState('TITLE');
  }
}
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
{ name:'Galaxy S23·iPhone 16 화면 채움 변환', fn:function(A){
  var s23=computeViewportTransform(360,780);
  A.eq(s23.cssW,360); A.eq(s23.cssH,780); A.eq(s23.scaleX,1); A.eq(s23.scaleY,1);
  var ip16=computeViewportTransform(393,852);
  A.eq(ip16.cssW,393); A.eq(ip16.cssH,852);
  A.ok(Math.abs(ip16.scaleX-393/360)<1e-9);
  A.ok(Math.abs(ip16.scaleY-852/780)<1e-9);
}},
{ name:'가상 스틱 데드존·대각선 정규화', fn:function(A){
  var z=normalizeStick(2,1,40,0.12); A.eq(z.x,0); A.eq(z.y,0);
  var r=normalizeStick(100,0,40,0.12); A.eq(r.x,1); A.eq(r.y,0); A.eq(r.px,40);
  var d=normalizeStick(40,40,40,0.12);
  A.ok(Math.abs(Math.sqrt(d.x*d.x+d.y*d.y)-1)<1e-9,'대각선 축 크기 오류');
  A.ok(Math.abs(d.px-d.py)<1e-9,'대각선 노브 좌표 오류');
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
  A.eq(g.txts.length,0);
  var pools=['eb','pb','part','item','en','laser','txt'];
  for(var i=0;i<pools.length;i++){
    var p=g.pool[pools[i]];
    A.ok(p.created<=p.max,pools[i]+' 풀 상한 초과');
    A.eq(p.free.length,p.created,pools[i]+' 풀 미회수: free '+p.free.length+' / created '+p.created);
  }
}},
{ name:'적 스폰 파라미터 누락/오염 방어', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:30}); g.director.events=[];
  /* 파라미터를 전혀 주지 않아도 NaN 좌표가 되면 안 된다 */
  var e=g.spawnEnemy('drone',80,150,{ty:150,holdT:99});
  steps(g,30,1/60);
  A.ok(isFinite(e.x)&&isFinite(e.y),'파라미터 누락 시 좌표가 NaN이 됨 (x='+e.x+')');
  /* 완전히 빈 파라미터 */
  var e2=g.spawnEnemy('weaver',100,180);
  steps(g,30,1/60);
  A.ok(isFinite(e2.x)&&isFinite(e2.y),'빈 파라미터에서 좌표 NaN');
  /* 오염된 값 */
  var e3=g.spawnEnemy('drone',NaN,undefined,{ty:'가나다',holdT:null,wob:{},exitVX:NaN});
  steps(g,30,1/60);
  A.ok(isFinite(e3.x)&&isFinite(e3.y),'오염 파라미터에서 좌표 NaN');
  /* 알 수 없는 타입도 게임을 멈추지 않아야 한다 */
  var e4=g.spawnEnemy('존재하지않는적',180,200,{});
  A.ok(e4!==null&&isFinite(e4.x),'알 수 없는 타입 처리 실패');
  steps(g,60,1/60);
  A.ok(g.state==='GAME','비정상 스폰 후 게임이 중단됨');
}},
{ name:'비정상 좌표 적 자동 제거', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:31}); g.director.events=[];
  var e=g.spawnEnemy('drone',80,150,{ty:150,holdT:99,wob:0,exitVX:0});
  A.eq(g.en.length,1);
  e.x=NaN; /* 외부 요인으로 좌표가 깨진 상황 모의 */
  steps(g,3,1/60);
  A.eq(g.en.length,0,'NaN 좌표 적이 제거되지 않음(잡을 수 없는 유령 적)');
}},
{ name:'HUD 3행 요소 겹침 없음(최악값 기준)', fn:function(A){
  /* 실제 렌더 코드와 동일한 좌표/폰트로 텍스트 폭을 측정해 구간 충돌을 검사.
     최악 조건: 점수 9자리, 목숨 6, 폭탄 6, 그레이즈 5자리, ABYSS 연습 */
  var W=CFG.W, ROW=37;
  function tw(text,px,weight){
    /* 보수적 폭 추정. 한글/CJK는 전각이므로 1.05em으로 크게 잡는다
       (헤드리스 캔버스에는 한글 폰트가 없어 실측이 0에 가깝게 나오므로 여기서 보정) */
    var w=0;
    for(var i=0;i<text.length;i++){
      var c=text.charCodeAt(i);
      w+=(c>0x2E80)?px*1.05:px*(weight>=800?0.62:0.58);
    }
    return w;
  }
  var segs=[];
  function add(name,x0,x1,row){ segs.push({name:name,x0:x0,x1:x1,row:row}); }
  /* 1행 */
  add('SCORE라벨',10,10+tw('SCORE',10),1);
  var hiTxt='HI // '+U.fmtScore(999999999);
  add('HI',W-10-tw(hiTxt,10),W-10,1);
  /* 2행 */
  var scTxt=U.fmtScore(999999999);
  add('점수값',10,10+tw(scTxt,18,800),2);
  var mlTxt='×3.00';
  add('배율',W-10-tw(mlTxt,16,800),W-10,2);
  /* 3행 */
  add('목숨아이콘',9,25,3);
  add('목숨수',26,26+tw('×6',14,800),3);
  add('LIFE',48,48+tw('LIFE',10),3);
  add('폭탄아이콘',87,103,3);
  add('폭탄수',104,104+tw('×6',14,800),3);
  add('BOMB',126,126+tw('BOMB',10),3);
  add('GRAZE라벨',174,174+tw('GRAZE',10),3);
  add('GRAZE값',216,216+tw('99999',14,800),3);
  var dfTxt='ABYSS // P';
  add('난이도',W-10-tw(dfTxt,10),W-10,3);
  /* 보스 정보행(4행): 보스명/페이즈핍, 페이즈라벨/타이머 — 한글 포함 최장 케이스 */
  var longestBoss='프리즘 코어 ASTERION';
  add('보스명',10,10+tw(longestBoss,13),4);
  add('페이즈핍',W-16-5*12-4,W-10,4);
  var longestPhase='PHASE 5/5 · 아스테리온 각성';
  add('페이즈라벨',10,10+tw(longestPhase,10),5);
  add('타이머',W-10-tw('52s',10),W-10,5);
  for(var i=0;i<segs.length;i++){
    var s=segs[i];
    A.ok(s.x0>=0&&s.x1<=W,s.name+' 화면 밖으로 벗어남 ('+Math.round(s.x0)+'~'+Math.round(s.x1)+')');
    for(var j=i+1;j<segs.length;j++){
      var t=segs[j];
      if(s.row!==t.row) continue;
      var overlap=(s.x0<t.x1&&t.x0<s.x1);
      A.ok(!overlap,s.row+'행 겹침: '+s.name+'('+Math.round(s.x0)+'~'+Math.round(s.x1)+
        ') ↔ '+t.name+'('+Math.round(t.x0)+'~'+Math.round(t.x1)+')');
    }
  }
}},
{ name:'HUD 높이 안에 3행이 들어감', fn:function(A){
  /* 3행 시작 37 + 텍스트 높이 14 + 여유 = HUD_H 이내 */
  A.ok(37+14+2<=CFG.HUD_H,'3행이 HUD 영역(높이 '+CFG.HUD_H+')을 넘침');
  A.ok(CFG.PLAYER.minY>CFG.HUD_H,'플레이어가 HUD 뒤로 들어갈 수 있음');
}},
{ name:'히트스톱: 발동/상한/자동 해제', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:20}); g.director.events=[];
  A.eq(g.hitstop,0);
  g.addHitstop(CFG.HITSTOP.kill);
  A.ok(g.hitstop>0,'히트스톱 미발동');
  g.addHitstop(999);
  A.ok(g.hitstop<=CFG.HITSTOP.max,'히트스톱 상한 초과: '+g.hitstop);
  /* 히트스톱 중에는 게임 시간이 느려져야 한다 */
  var t0=g.run.time;
  g.tick(1/60);
  var slowed=g.run.time-t0;
  A.ok(slowed<1/60,'히트스톱 중 시간이 느려지지 않음');
  steps(g,30,1/60);
  A.eq(g.hitstop,0,'히트스톱이 해제되지 않음');
  var t1=g.run.time;
  g.tick(1/60);
  A.ok(Math.abs((g.run.time-t1)-1/60)<1e-9,'해제 후 정상 속도 복귀 실패');
}},
{ name:'체인 콤보 증가/시간 초과 리셋/피격 리셋', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:21}); g.director.events=[];
  var e1=g.spawnEnemy('drone',180,200,{ty:200,holdT:99,exitVX:0});
  g.killEnemy(e1);
  A.eq(g.run.chain,1);
  var e2=g.spawnEnemy('drone',180,200,{ty:200,holdT:99,exitVX:0});
  g.killEnemy(e2);
  A.eq(g.run.chain,2);
  A.eq(g.run.chainBest,2);
  /* 윈도우 경과 후 리셋 */
  steps(g,Math.ceil((CFG.CHAIN.window+0.3)*60),1/60);
  A.eq(g.run.chain,0,'체인이 시간 초과로 리셋되지 않음');
  var e3=g.spawnEnemy('drone',180,200,{ty:200,holdT:99,exitVX:0});
  g.killEnemy(e3);
  A.eq(g.run.chain,1);
  g.player.invuln=0;
  var b=g.fireEB(g.player.x,g.player.y,0,0,{}); b.delay=0;
  g.tick(1/60);
  A.eq(g.run.chain,0,'피격 시 체인이 끊기지 않음');
}},
{ name:'점수 팝업 풀 상한/회수', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:22}); g.director.events=[];
  for(var i=0;i<300;i++) g.popup(180,300,'+100',null,12);
  A.ok(g.txts.length<=CFG.POOL.txt,'팝업 상한 초과: '+g.txts.length);
  steps(g,120,1/60);
  A.eq(g.txts.length,0,'팝업이 회수되지 않음');
  A.eq(g.pool.txt.free.length,g.pool.txt.created,'팝업 풀 미회수');
}},
{ name:'넉백은 시각 전용(판정 궤적 불변)', fn:function(A){
  /* 같은 seed로 두 번 시뮬레이션: 한쪽만 넉백을 강제로 주입한다.
     넉백이 순수 시각 효과라면 두 궤적(e.x,e.y)이 완전히 같아야 한다. */
  function traj(applyKb){
    var g=newHG();
    g.startRun('standard',{seed:23}); g.director.events=[];
    var e=g.spawnEnemy('fort',180,200,{ty:200,lifeT:99});
    var out=[];
    for(var i=0;i<90;i++){
      if(applyKb&&i%7===0){ e.kbx+=3; e.kby+=4; e.squash=1; }
      g.tick(1/60);
      out.push(e.x,e.y);
    }
    return {t:out,e:e};
  }
  var a=traj(false), b=traj(true);
  for(var i=0;i<a.t.length;i++){
    A.eq(b.t[i],a.t[i],'넉백이 실제 판정 좌표에 영향을 줌 @'+i);
  }
  /* 감쇠: 추가 피격이 없으면 0으로 수렴해야 한다 */
  var g2=newHG();
  g2.startRun('standard',{seed:23}); g2.director.events=[];
  var e2=g2.spawnEnemy('fort',180,200,{ty:200,lifeT:99});
  g2.damageEnemy(e2,1,180,210);
  A.ok(e2.kby!==0,'넉백 미적용');
  for(var k=0;k<60;k++){
    for(var j=g2.pb.length-1;j>=0;j--){ g2.pool.pb.release(g2.pb[j]); g2.pb.pop(); }
    g2.tick(1/60);
  }
  A.ok(Math.abs(e2.kbx)<0.1&&Math.abs(e2.kby)<0.1,
    '넉백이 감쇠하지 않음 (kbx='+e2.kbx.toFixed(3)+', kby='+e2.kby.toFixed(3)+')');
}},
{ name:'보스 고스트 HP바가 실제 HP를 따라감', fn:function(A){
  var g=newHG();
  g.startPractice('mid','standard');
  var guard=0;
  while(guard++<1200&&!(g.boss&&g.boss.state==='fight')) g.tick(1/30);
  A.ok(g.boss&&g.boss.state==='fight','보스 전투 진입 실패');
  var B=g.boss;
  A.eq(B.ghost,B.maxHp,'고스트 초기값 오류');
  B.hp=B.maxHp*0.4;
  g.tick(1/60);
  A.ok(B.ghost>B.hp,'고스트가 즉시 따라붙음(잔상 효과 없음)');
  steps(g,240,1/60);
  A.ok(B.ghost<=B.hp+1,'고스트가 실제 HP까지 내려오지 않음: '+B.ghost+' vs '+B.hp);
}},
{ name:'파티클 상한 준수(파편·플래시 포함)', fn:function(A){
  var g=newHG();
  g.startRun('standard',{seed:24}); g.director.events=[];
  for(var i=0;i<200;i++){
    g.spawnShards(180,300,20,200);
    g.spawnImpact(180,300);
    g.spawnFlash(180,300,20,'#fff');
  }
  A.ok(g.parts.length<=CFG.POOL.part,'파티클 풀 상한 초과: '+g.parts.length);
  A.ok(g.pool.part.created<=CFG.POOL.part,'파티클 생성 상한 초과');
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
  computeViewportTransform:computeViewportTransform,
  normalizeStick:normalizeStick,
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
