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
    var k=v.scale*v.dpr;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle=PAL.bg0;
    ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    ctx.setTransform(k,0,0,k,0,0);
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
      /* 회전하는 사각 포획 링 — '주울 수 있는 것'이라는 신호(탄환엔 없음) */
      ctx.save();
      ctx.rotate(it.t*2.2);
      ctx.globalAlpha=0.5+0.25*Math.sin(it.t*6);
      ctx.strokeStyle=bomb?PAL.gold:PAL.green;
      ctx.lineWidth=1.4;
      var rr=bomb?15:12;
      ctx.strokeRect(-rr,-rr,rr*2,rr*2);
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
        ctx.save();
        ctx.rotate(e.t*1.6);
        ctx.strokeStyle=PAL.violet; ctx.lineWidth=2;
        ctx.beginPath();
        for(var d=0;d<3;d++){
          var da=d*TAU/3;
          ctx.moveTo(Math.cos(da)*e.r*0.75,Math.sin(da)*e.r*0.75);
          ctx.lineTo(Math.cos(da)*(e.r+4),Math.sin(da)*(e.r+4));
        }
        ctx.stroke();
        ctx.globalAlpha=0.55;
        ctx.beginPath(); ctx.arc(0,0,e.r+4,0,TAU); ctx.stroke();
        ctx.restore();
        ctx.fillStyle='#2b3566';
        ctx.beginPath();
        for(var h2=0;h2<6;h2++){
          var a2=h2*TAU/6+Math.PI/6;
          var x2=Math.cos(a2)*e.r*0.85, y2=Math.sin(a2)*e.r*0.85;
          if(h2===0) ctx.moveTo(x2,y2); else ctx.lineTo(x2,y2);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=PAL.steel; ctx.lineWidth=1.5; ctx.stroke();
        /* 센서 아이 — 조준 중일 때 붉게 맥동 */
        var pulse=0.6+0.4*Math.sin(e.t*7);
        ctx.fillStyle=PAL.red;
        ctx.globalAlpha=pulse;
        ctx.beginPath(); ctx.ellipse(0,0,4.6,3,0,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
        ctx.fillStyle=PAL.white;
        ctx.beginPath(); ctx.arc(0,0,1.5,0,TAU); ctx.fill();
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
        ctx.strokeStyle=PAL.orange; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle=PAL.red;
        ctx.beginPath(); ctx.ellipse(0,-e.r*0.35,2,3.4,0,0,TAU); ctx.fill();
      }else if(e.type==='weaver'){
        /* 포탑형 부유체: 육각 장갑 + 궤도 노드 3개 + 회전 코어 */
        ctx.save();
        ctx.rotate(Math.sin(e.t*1.5)*0.22);
        ctx.fillStyle='#3d3468';
        ctx.beginPath();
        for(var h=0;h<6;h++){
          var a=h*TAU/6;
          var px=Math.cos(a)*e.r, py=Math.sin(a)*e.r;
          if(h===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=PAL.violet; ctx.lineWidth=2.2; ctx.stroke();
        /* 내부 장갑 라인 */
        ctx.strokeStyle='rgba(176,108,255,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,e.r*0.62,0,TAU); ctx.stroke();
        ctx.restore();
        /* 궤도 노드 */
        for(var nn=0;nn<3;nn++){
          var na=nn*TAU/3+e.t*2.2;
          var nx=Math.cos(na)*(e.r+5), ny=Math.sin(na)*(e.r+5);
          ctx.fillStyle=PAL.orange;
          ctx.beginPath(); ctx.arc(nx,ny,2.6,0,TAU); ctx.fill();
        }
        /* 발사 직전 차징 코어 */
        var chg=U.clamp(1-e.fireT/0.5,0,1);
        ctx.fillStyle=PAL.orange;
        ctx.beginPath(); ctx.arc(0,0,3.2+chg*2.6,0,TAU); ctx.fill();
        ctx.fillStyle=PAL.white;
        ctx.beginPath(); ctx.arc(0,0,1.6+chg*1.2,0,TAU); ctx.fill();
      }else if(e.type==='fort'){
        /* 중장 포대: 장갑판 + 경고 스트라이프 + 회전 포탑 */
        ctx.fillStyle='#333b5e';
        pathRound(ctx,-e.r,-e.r,e.r*2,e.r*2,5); ctx.fill();
        /* 경고 사선 스트라이프 */
        ctx.save();
        ctx.beginPath();
        pathRound(ctx,-e.r,-e.r,e.r*2,e.r*2,5);
        ctx.clip();
        ctx.globalAlpha=0.35; ctx.strokeStyle=PAL.gold; ctx.lineWidth=4;
        ctx.beginPath();
        for(var sx=-e.r*2;sx<e.r*2;sx+=10){
          ctx.moveTo(sx,-e.r); ctx.lineTo(sx+e.r*2,e.r);
        }
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle=PAL.gold; ctx.lineWidth=2.2;
        pathRound(ctx,-e.r,-e.r,e.r*2,e.r*2,5); ctx.stroke();
        /* 모서리 리벳 */
        ctx.fillStyle=PAL.steel;
        var rv=e.r-4.5;
        ctx.beginPath();
        ctx.arc(-rv,-rv,1.8,0,TAU); ctx.arc(rv,-rv,1.8,0,TAU);
        ctx.arc(-rv,rv,1.8,0,TAU); ctx.arc(rv,rv,1.8,0,TAU);
        ctx.fill();
        /* 회전 포탑 */
        ctx.save();
        ctx.rotate(e.t*0.9);
        ctx.fillStyle='#5a6390';
        pathRound(ctx,-e.r*0.42,-e.r*0.42,e.r*0.84,e.r*0.84,3); ctx.fill();
        ctx.strokeStyle=PAL.gold; ctx.lineWidth=1.4; ctx.stroke();
        ctx.fillStyle=PAL.red;
        ctx.fillRect(-1.8,-e.r*0.95,3.6,e.r*0.55);
        ctx.restore();
        ctx.fillStyle=PAL.red;
        ctx.beginPath(); ctx.arc(0,0,4,0,TAU); ctx.fill();
        ctx.fillStyle=PAL.white;
        ctx.beginPath(); ctx.arc(0,0,1.7,0,TAU); ctx.fill();
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
    ctx.fillStyle='rgba(5,8,20,0.8)';
    ctx.fillRect(0,0,CFG.W,H);
    ctx.strokeStyle='rgba(83,242,255,0.28)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,H+0.5); ctx.lineTo(CFG.W,H+0.5); ctx.stroke();
    ctx.textBaseline='top';

    /* ── 1행: SCORE(좌) / HI(우) ── */
    ctx.textAlign='left';
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText('SCORE',10,4);
    ctx.textAlign='right';
    ctx.fillText('HI '+U.fmtScore(Math.max(this.save.hi[this.diffKey]||0,r.score)),CFG.W-10,4);

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
    ctx.fillText(this.diff.label+(this.mode==='practice'?' 연습':''),CFG.W-10,ROW+4);

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

    /* 초반 조작 힌트 */
    if(this.mode==='run'&&this.stageT<6&&this.seq===''){
      ctx.globalAlpha=U.clamp(6-this.stageT,0,1)*0.8;
      ctx.font=FONT.n13; ctx.fillStyle=PAL.dim;
      ctx.textAlign='center';
      ctx.fillText('화면을 드래그해 이동',CFG.W/2,CFG.H-64);
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
