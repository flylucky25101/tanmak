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
      ctx.save();
      ctx.translate(it.x,it.y);
      ctx.rotate(Math.sin(it.t*4)*0.4);
      ctx.drawImage(sp.cv,-sp.hw,-sp.hh);
      ctx.restore();
    }
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
      ctx.translate(e.x,e.y);
      if(e.type==='drone'){
        ctx.rotate(e.t*2);
        ctx.fillStyle=PAL.steel;
        ctx.beginPath();
        ctx.moveTo(0,-e.r); ctx.lineTo(e.r,0); ctx.lineTo(0,e.r); ctx.lineTo(-e.r,0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=PAL.violet; ctx.lineWidth=2; ctx.stroke();
        ctx.rotate(-e.t*2);
        ctx.fillStyle=PAL.red;
        ctx.beginPath(); ctx.arc(0,0,3,0,TAU); ctx.fill();
      }else if(e.type==='darter'){
        var ang=Math.atan2(e.vy,e.vx)+Math.PI/2;
        ctx.rotate(ang);
        ctx.fillStyle='#c9d4f6';
        ctx.beginPath();
        ctx.moveTo(0,-e.r-4); ctx.lineTo(e.r*0.7,e.r); ctx.lineTo(0,e.r*0.5); ctx.lineTo(-e.r*0.7,e.r);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=PAL.orange; ctx.lineWidth=1.6; ctx.stroke();
      }else if(e.type==='weaver'){
        ctx.rotate(Math.sin(e.t*2)*0.3);
        ctx.fillStyle='#5a4d8f';
        ctx.beginPath();
        for(var h=0;h<6;h++){
          var a=h*TAU/6;
          var px=Math.cos(a)*e.r, py=Math.sin(a)*e.r;
          if(h===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=PAL.violet; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle=PAL.orange;
        ctx.beginPath(); ctx.arc(0,0,4,0,TAU); ctx.fill();
      }else if(e.type==='fort'){
        ctx.fillStyle='#3d4468';
        pathRound(ctx,-e.r,-e.r,e.r*2,e.r*2,4); ctx.fill();
        ctx.strokeStyle=PAL.gold; ctx.lineWidth=2;
        pathRound(ctx,-e.r,-e.r,e.r*2,e.r*2,4); ctx.stroke();
        ctx.save();
        ctx.rotate(e.t*0.7);
        ctx.strokeStyle=PAL.gold; ctx.globalAlpha=0.7;
        ctx.strokeRect(-e.r*0.55,-e.r*0.55,e.r*1.1,e.r*1.1);
        ctx.restore();
        ctx.fillStyle=PAL.red;
        ctx.beginPath(); ctx.arc(0,0,5,0,TAU); ctx.fill();
      }
      if(e.hitFlash>0){
        ctx.globalAlpha=Math.min(1,e.hitFlash*9);
        ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.arc(0,0,e.r+2,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
      }
      ctx.restore();
      /* 소형 HP 바(중형 이상) */
      if((e.type==='weaver'||e.type==='fort')&&e.hp<e.mhp){
        var w=e.r*2, f=Math.max(0,e.hp/e.mhp);
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillRect(e.x-w/2,e.y-e.r-8,w,3);
        ctx.fillStyle=PAL.green;
        ctx.fillRect(e.x-w/2,e.y-e.r-8,w*f,3);
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
  drawHUD:function(ctx){
    var r=this.run;
    ctx.fillStyle='rgba(5,8,20,0.72)';
    ctx.fillRect(0,0,CFG.W,CFG.HUD_H);
    ctx.strokeStyle='rgba(83,242,255,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,CFG.HUD_H+0.5); ctx.lineTo(CFG.W,CFG.HUD_H+0.5); ctx.stroke();
    ctx.textBaseline='top';
    ctx.textAlign='left';
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText('SCORE',12,5);
    ctx.font=FONT.n18; ctx.fillStyle=PAL.ink;
    ctx.fillText(U.fmtScore(r.score),12,15);
    ctx.textAlign='right';
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText('HI '+U.fmtScore(Math.max(this.save.hi[this.diffKey]||0,r.score)),CFG.W-58,5);
    ctx.font=FONT.n16;
    ctx.fillStyle=(r.mult>=2)?PAL.gold:PAL.dim;
    ctx.fillText('x'+r.mult.toFixed(2),CFG.W-58,15);
    ctx.textAlign='left';
    ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
    ctx.fillText(this.diff.label+(this.mode==='practice'?' · 연습':''),CFG.W-160,34);
    /* 목숨 */
    var i;
    for(i=0;i<r.lives;i++){
      var lx=14+i*15;
      ctx.fillStyle=PAL.cyan;
      ctx.beginPath();
      ctx.moveTo(lx,36); ctx.lineTo(lx+5,46); ctx.lineTo(lx-5,46);
      ctx.closePath(); ctx.fill();
    }
    /* 폭탄 */
    for(i=0;i<r.bombs;i++){
      var bx=118+i*15;
      ctx.fillStyle=PAL.gold;
      ctx.beginPath();
      ctx.moveTo(bx,35); ctx.lineTo(bx+5,41); ctx.lineTo(bx,47); ctx.lineTo(bx-5,41);
      ctx.closePath(); ctx.fill();
    }
    ctx.font=FONT.n12; ctx.fillStyle=PAL.dim;
    ctx.fillText('G '+r.graze,222,35);
    /* 보스 바 */
    var B=this.boss;
    if(B&&(B.state==='fight'||B.state==='switch'||B.state==='dying')){
      ctx.font=FONT.n13; ctx.fillStyle=PAL.ink;
      ctx.textAlign='left';
      ctx.fillText(B.def.name,12,CFG.HUD_H+6);
      var total=B.def.phases.length;
      for(i=0;i<total-1-B.phaseIdx;i++){
        var px=CFG.W-20-i*13;
        ctx.fillStyle=B.def.clr;
        ctx.beginPath();
        ctx.moveTo(px,CFG.HUD_H+8); ctx.lineTo(px+4,CFG.HUD_H+13);
        ctx.lineTo(px,CFG.HUD_H+18); ctx.lineTo(px-4,CFG.HUD_H+13);
        ctx.closePath(); ctx.fill();
      }
      var f=(B.state==='fight')?U.clamp(B.hp/B.maxHp,0,1):0;
      ctx.fillStyle='rgba(0,0,0,0.55)';
      pathRound(ctx,12,CFG.HUD_H+22,CFG.W-24,7,3); ctx.fill();
      if(f>0){
        ctx.fillStyle=(f>0.5)?PAL.green:(f>0.25?PAL.gold:PAL.red);
        pathRound(ctx,12,CFG.HUD_H+22,(CFG.W-24)*f,7,3); ctx.fill();
      }
      if(B.state==='fight'){
        var ph=B.def.phases[B.phaseIdx];
        var tl=Math.max(0,ph.time-B.phT);
        ctx.font=FONT.n10; ctx.fillStyle=PAL.dim;
        ctx.textAlign='right';
        ctx.fillText(Math.ceil(tl)+'s',CFG.W-12,CFG.HUD_H+6);
        ctx.textAlign='left';
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
