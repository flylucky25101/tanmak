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
