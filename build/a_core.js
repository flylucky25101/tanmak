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
