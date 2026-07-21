'use strict';

const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const {createPng,createSvg}=require('./icons');

const root=path.resolve(__dirname,'..');
const modules=[
  'a_core.js','b_audio_sprites.js','c_entities.js','d_patterns.js',
  'e1_game.js','e2_render.js','f1_input_ui.js','f2_tests.js'
];
const check=process.argv.includes('--check');
const mismatches=[];

function read(rel){ return fs.readFileSync(path.join(root,rel),'utf8'); }
function same(rel,data){
  const file=path.join(root,rel);
  if(!fs.existsSync(file)) return false;
  const current=fs.readFileSync(file);
  const expected=Buffer.isBuffer(data)?data:Buffer.from(data);
  return current.equals(expected);
}
function output(rel,data){
  if(same(rel,data)) return;
  if(check){ mismatches.push(rel); return; }
  const file=path.join(root,rel);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,data);
  console.log('generated '+rel);
}

const game=modules.map(name=>read(path.join('build',name))).join('');
const index=read('build/head.html')+game+read('build/tail.html');
const icon192=createPng(192), icon512=createPng(512), iconSvg=createSvg();
const fingerprint=crypto.createHash('sha256')
  .update(index).update(read('manifest.webmanifest')).update(icon192).update(icon512)
  .digest('hex').slice(0,12);
const sw=read('sw.js').replace(/var CACHE='[^']+';/,"var CACHE='lumenfall-"+fingerprint+"';");

output('build/game.js',game);
output('index.html',index);
output('assets/icon.svg',iconSvg);
output('assets/icon-192.png',icon192);
output('assets/icon-512.png',icon512);
output('sw.js',sw);

if(check&&mismatches.length){
  console.error('Generated files are out of date: '+mismatches.join(', '));
  console.error('Run: npm run build');
  process.exit(1);
}
console.log(check?'build check: OK':'build: complete');
