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
