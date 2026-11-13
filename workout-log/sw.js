const APP_SCOPE='/workout-log/';
const SCOPE_URL=new URL(APP_SCOPE,self.location.origin).href;
const PREFIX=`tahmid-workout:${self.registration.scope}:`;
const CACHE=`${PREFIX}v6`;
const FILES=['./','./index.html','./css/styles.css','./js/icons.js','./js/config.js','./js/app.js?v=reset-enabled','./js/pin.js','./js/db.js','./js/workout.js','./js/export.js','./js/import.js','./js/backup.js','./manifest.webmanifest','./icons/icon.svg','./icons/favicon-16x16.png','./icons/favicon-32x32.png','./icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png'];
const URLS=new Set(FILES.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',e=>e.waitUntil(self.registration.scope===SCOPE_URL?caches.open(CACHE).then(c=>c.addAll(FILES)):Promise.resolve()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(self.registration.scope!==SCOPE_URL||e.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(SCOPE_URL))return;
  // Only the fixed app shell is cached. Public config is safe; cloud data is excluded.
  if(!URLS.has(url.href))return;
  e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return response;}).catch(async()=>await caches.match(e.request)||Response.error()));
});
