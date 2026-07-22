/* LUMENFALL 서비스 워커 — 오프라인 캐시 (선택 사항, index.html 단독으로도 동작) */
'use strict';
var CACHE='lumenfall-678ba5c5a110';
var ASSETS=[
  './','./index.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png',
  './assets/kenney/kenvector_future.ttf','./assets/kenney/background-dark-purple.png',
  './assets/kenney/player-blue.png','./assets/kenney/enemy-drone.png','./assets/kenney/enemy-darter.png',
  './assets/kenney/enemy-weaver.png','./assets/kenney/enemy-fort.png',
  './assets/kenney/boss-octav.png','./assets/kenney/boss-asterion.png',
  './assets/kenney/item-power.png','./assets/kenney/item-bomb.png','./assets/kenney/shield.png',
  './assets/kenney/LICENSE.txt'
];

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
  /* 문서 탐색은 네트워크 우선: 새 배포가 있으면 즉시 받고, 오프라인이면 캐시 사용. */
  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request).then(function(res){
        if(res&&res.ok){
          var clone=res.clone();
          caches.open(CACHE).then(function(c){ c.put('./index.html',clone).catch(function(){}); });
        }
        return res;
      }).catch(function(){ return caches.match('./index.html'); })
    );
    return;
  }
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
