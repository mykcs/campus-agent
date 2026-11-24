const BUILD_ASSETS = /* BUILD_ASSETS */ [];
const REVISION = /* BUILD_REVISION */ "development";
const CACHE = "campus-agent-shell-v4:" + REVISION;
const SHELL = ["/", "/index.html", "/styles.css", "/app.js", "/source-core.js", "/push-settings.js", "/display-date.js", "/taskboard-core.js", "/taskboard.js", "/icon.svg", ...BUILD_ASSETS];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("campus-agent-shell-") && k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(()=>caches.match("/index.html")));
    return;
  }
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});


// Push payloads are untrusted data. A click can only navigate to an official
// university URL or the local application, never to an arbitrary target.
function pushOfficialUrl(value){
  try{
    const u=new URL(value);
    if(u.username||u.password||u.port)return null;
    const allowed=["mit.edu","tsinghua.edu.cn","zju.edu.cn"].some(d=>u.hostname===d||u.hostname.endsWith("."+d));
    if(!allowed||u.protocol!=="https:"&&!(u.protocol==="http:"&&(u.hostname==="zju.edu.cn"||u.hostname.endsWith(".zju.edu.cn"))))return null;
    return u.href;
  }catch{return null;}
}
self.addEventListener("push",event=>{
  let payload=null;
  try{payload=event.data?.json();}catch{}
  const url=payload?.version===1?pushOfficialUrl(payload.url):null;
  const tag=typeof payload?.tag==="string"&&/^[a-f0-9]{32}$/.test(payload.tag)?payload.tag:"campus-agent-notice";
  const body=url&&typeof payload.body==="string"?payload.body.slice(0,220):"打开校园信息页面核对新收录通知。";
  event.waitUntil(self.registration.showNotification("Campus Agent · 校园通知",{body,tag,icon:"/icon.svg",data:{url:url||"/"}}));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=pushOfficialUrl(event.notification.data?.url)||new URL("/",self.location.origin).href;
  event.waitUntil(self.clients.openWindow(url));
});
