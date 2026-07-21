/* LUMENFALL 서비스 워커 — 오프라인 캐시 (선택 사항, index.html 단독으로도 동작) */
'use strict';
var CACHE='lumenfall-v1';
var ASSETS=['./','./index.html','./manifest.webmanifest'];

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS).catch(function(){}); })
      .then(function(){ return self.skipWaiting(); })
  );
});
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k!==CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit) return hit;
      return fetch(e.request).then(function(res){
        try{
          if(res&&res.ok&&e.request.url.indexOf('http')===0){
            var clone=res.clone();
            caches.open(CACHE).then(function(c){ c.put(e.request,clone).catch(function(){}); });
          }
        }catch(err){}
        return res;
      }).catch(function(){
        return caches.match('./index.html');
      });
    })
  );
});
