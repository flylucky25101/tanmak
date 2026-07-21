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
