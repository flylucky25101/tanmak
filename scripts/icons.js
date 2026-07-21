'use strict';

const zlib=require('zlib');

function crc32(buf){
  let c=0xffffffff;
  for(const b of buf){
    c^=b;
    for(let i=0;i<8;i++) c=(c>>>1)^((c&1)?0xedb88320:0);
  }
  return (c^0xffffffff)>>>0;
}

function chunk(type,data){
  const name=Buffer.from(type,'ascii');
  const out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0);
  name.copy(out,4);
  data.copy(out,8);
  out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);
  return out;
}

function clamp(v){ return v<0?0:(v>1?1:v); }
function smooth(edge0,edge1,x){
  const t=clamp((x-edge0)/(edge1-edge0));
  return t*t*(3-2*t);
}
function blend(rgb,color,a){
  rgb[0]=Math.round(rgb[0]*(1-a)+color[0]*a);
  rgb[1]=Math.round(rgb[1]*(1-a)+color[1]*a);
  rgb[2]=Math.round(rgb[2]*(1-a)+color[2]*a);
}
function diamondAlpha(x,y,cx,cy,r,feather){
  return 1-smooth(r-feather,r+feather,Math.abs(x-cx)+Math.abs(y-cy));
}

function createPng(size){
  const rgba=Buffer.alloc(size*size*4);
  for(let py=0;py<size;py++){
    for(let px=0;px<size;px++){
      const x=(px+0.5)/size*2-1, y=(py+0.5)/size*2-1;
      const radial=clamp(1-Math.sqrt(x*x+y*y));
      const rgb=[4+Math.round(radial*4),5+Math.round(radial*10),14+Math.round(radial*24)];
      const glow=Math.exp(-(x*x+y*y)/0.20)*0.22;
      blend(rgb,[83,242,255],glow);

      const ringDist=Math.abs(Math.sqrt(x*x+y*y)-0.47);
      blend(rgb,[176,108,255],(1-smooth(0.018,0.055,ringDist))*0.72);

      const core=diamondAlpha(x,y,0,0,0.34,0.012);
      blend(rgb,[83,242,255],core*0.96);
      const inner=diamondAlpha(x,y,0,0,0.20,0.012);
      blend(rgb,[8,15,38],inner*0.94);
      const light=diamondAlpha(x,y,0,-0.02,0.105,0.009);
      blend(rgb,[233,237,255],light*0.94);

      const spear=1-smooth(0.025,0.055,Math.abs(x)+Math.max(0,Math.abs(y+0.03)-0.31)*0.3);
      const vertical=smooth(0.42,0.12,Math.abs(y+0.03));
      blend(rgb,[83,242,255],spear*vertical*0.85);

      const gold=[255,211,90];
      blend(rgb,gold,diamondAlpha(x,y,-0.34,-0.38,0.075,0.012));
      blend(rgb,gold,diamondAlpha(x,y,0,-0.49,0.075,0.012));
      blend(rgb,gold,diamondAlpha(x,y,0.34,-0.38,0.075,0.012));

      const i=(py*size+px)*4;
      rgba[i]=rgb[0]; rgba[i+1]=rgb[1]; rgba[i+2]=rgb[2]; rgba[i+3]=255;
    }
  }

  const scan=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++){
    const row=y*(size*4+1);
    scan[row]=0;
    rgba.copy(scan,row+1,y*size*4,(y+1)*size*4);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr),
    chunk('IDAT',zlib.deflateSync(scan,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
}

function createSvg(){
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="LUMENFALL 아이콘">
  <defs>
    <radialGradient id="bg"><stop stop-color="#0c2140"/><stop offset="1" stop-color="#04050e"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="120" fill="none" stroke="#b06cff" stroke-width="12" opacity=".72"/>
  <g filter="url(#glow)">
    <path d="M256 169 343 256 256 343 169 256Z" fill="#53f2ff"/>
    <path d="M256 205 307 256 256 307 205 256Z" fill="#081026"/>
    <path d="M256 229 283 256 256 283 229 256Z" fill="#e9edff"/>
  </g>
  <g fill="#ffd35a">
    <path d="m169 139 19 19-19 19-19-19Z"/>
    <path d="m256 111 19 19-19 19-19-19Z"/>
    <path d="m343 139 19 19-19 19-19-19Z"/>
  </g>
</svg>
`;
}

module.exports={createPng,createSvg};
