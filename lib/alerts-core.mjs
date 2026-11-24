// Bounded, invite-only pilot. This module has no ambient credentials or
// network side effects. The caller supplies a private compare-and-swap store,
// a fixed public snapshot loader and an encrypted push transport.
import {createHash,randomBytes,timingSafeEqual,createECDH,ECDH} from "node:crypto";
import Sources from "../public/source-core.js";
import Alerts from "../public/opportunity-alert-core.js";
const MAX_DEVICES=3,MAX_SEEN=1800,MAX_AGE=6*3600000,LEASE=90000,EXPIRY=30*86400000;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const COOKIE="__Host-campus-alert-device";
const TOPICS=new Set(["scholarships","admissions","teaching"]);
const bad=(status,code)=>Object.assign(new Error(code),{status,code});
const sha=x=>createHash("sha256").update(x).digest("hex");
const secureEqual=(a,b)=>typeof a==="string"&&typeof b==="string"&&b.length>=32&&timingSafeEqual(Buffer.from(sha(a)),Buffer.from(sha(b)));
const bodyOf=req=>{
  const raw=typeof req.body==="string"?req.body:JSON.stringify(req.body);
  if(typeof raw!=="string"||Buffer.byteLength(raw)>12000)throw bad(400,"invalid-request");
  let v;try{v=JSON.parse(raw);}catch{throw bad(400,"invalid-request");}
  if(!v||typeof v!=="object"||Array.isArray(v))throw bad(400,"invalid-request");
  return v;
};
function cookieToken(req){
  const value=String(req.headers?.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
  return TOKEN.test(value||"")?value:null;
}
const cookie=(value,maxAge)=>COOKIE+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+maxAge;
const bytes=(v,len)=>{
  if(typeof v!=="string"||!/^[A-Za-z0-9_-]+$/.test(v))return null;
  const b=Buffer.from(v,"base64url");return b.length===len&&b.toString("base64url")===v?b:null;
};
export function validateSubscription(value){
  try{
    if(!value||typeof value.endpoint!=="string"||value.endpoint.length>2100)return null;
    const u=new URL(value.endpoint);
    if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash)return null;
    // Only reviewed browser push-service hosts and endpoint shapes.
    const pathOK=(
      u.hostname==="web.push.apple.com"&&/^\/[A-Za-z0-9_-]{20,2000}$/.test(u.pathname)||
      u.hostname==="fcm.googleapis.com"&&/^\/fcm\/send\/[A-Za-z0-9_:\-]{20,2000}$/.test(u.pathname)||
      u.hostname==="updates.push.services.mozilla.com"&&/^\/wpush\/v2\/[A-Za-z0-9_-]{20,2000}$/.test(u.pathname)
    );
    if(!pathOK)return null;
    const pub=bytes(value.keys?.p256dh,65),auth=bytes(value.keys?.auth,16);
    if(!pub||pub[0]!==4||!auth)return null;
    ECDH.convertKey(pub,"prime256v1");
    const expiry=value.expirationTime;
    if(expiry!==undefined&&expiry!==null&&(!Number.isFinite(expiry)||expiry<=0))return null;
    return {endpoint:u.href,expirationTime:expiry??null,keys:{p256dh:pub.toString("base64url"),auth:auth.toString("base64url")}};
  }catch{return null;}
}
export function validatePreference(p){
  if(!p||p.optIn!==true)return null;
  const schoolIds=new Set(Sources.SCHOOLS.map(s=>s.id));
  const out={optIn:true};
  for(const [field,ok] of [["schools",x=>schoolIds.has(x)],["departments",x=>Sources.validId(x)],["topics",x=>TOPICS.has(x)]]){
    if(!Array.isArray(p[field])||p[field].length>50||p[field].some(x=>typeof x!=="string"||!ok(x)))return null;
    out[field]=[...new Set(p[field])];
  }
  return out.schools.length+out.departments.length+out.topics.length?out:null;
}
export function verifySnapshot(snapshot,history,now){
  const latest=Array.isArray(history?.checks)?history.checks.at(-1):null;
  const ts=Date.parse(snapshot?.checked_at),attempt=Date.parse(latest?.attempted_at);
  if(!snapshot||snapshot.health?.status!=="healthy"||latest?.status!=="healthy"||
     latest.attempted_at!==snapshot.health.assessed_at||!Number.isFinite(ts)||!Number.isFinite(attempt)||
     attempt>ts||ts>now||now-ts>MAX_AGE||!Array.isArray(snapshot.notices)||!Array.isArray(snapshot.sources)||
     snapshot.notices.length>600||snapshot.sources.length>100||latest.notices!==snapshot.notices.length||
     snapshot.sources.some(s=>!["ok","partial"].includes(s?.status)))throw bad(503,"public-data-not-healthy");
  const sources=Sources.sourceList(snapshot).filter(s=>["ok","partial"].includes(s.status));
  const ids=new Set(sources.map(s=>s.id));
  if(sources.length!==snapshot.sources.length)throw bad(503,"public-data-not-healthy");
  const notices=Sources.notices(snapshot);
  if(notices.length!==snapshot.notices.length||notices.some(n=>!ids.has(n.source_id)||n.url.length>500))throw bad(503,"public-data-not-healthy");
  // Baselines contain public link metadata only, not article bodies or people.
  return {checked_at:snapshot.checked_at,health:{status:"healthy"},sources:sources.map(({id,url,status})=>({id,url,status})),
    notices:notices.map(({id,url,title,source_id,department_id,published_at,date_inferred,topics})=>({
      id,url,title:title.slice(0,180),source_id,department_id,published_at,date_inferred,topics:Array.isArray(topics)?topics.filter(x=>TOPICS.has(x)):[]})
    )};
}
function deviceList(state,now){
  if(!state||state.version!==1||!state.devices||typeof state.devices!=="object"||Array.isArray(state.devices)||
     Object.keys(state.devices).length>MAX_DEVICES)throw bad(503,"private-store-invalid");
  // Corrupt or unexpected records are not silently treated as empty consent.
  for(const [key,row] of Object.entries(state.devices)){
    if(!/^[0-9a-f]{64}$/.test(key)||!row||!validateSubscription(row.subscription)||!validatePreference(row.preference)||
       !Number.isFinite(row.expiresAt)||!Array.isArray(row.seen)||row.seen.length>MAX_SEEN||
       !row.baseline||!Array.isArray(row.baseline.notices))throw bad(503,"private-store-invalid");
  }
  return Object.fromEntries(Object.entries(state.devices).filter(([,row])=>row.expiresAt>now&&(row.subscription.expirationTime===null||row.subscription.expirationTime>now)));
}
function busy(state,now){return Number.isFinite(state.leaseUntil)&&state.leaseUntil>now;}
function compactSeen(row,baseline){
  const seen=[...new Set([...row.seen,...baseline.notices.map(n=>n.url)])];
  return seen.length<=MAX_SEEN?seen:null;
}
function payloadFor(events){
  const n=events[0];
  return {version:1,title:"Campus Agent · 新收录通知",body:events.length===1?n.title:n.title+"（另有 "+(events.length-1)+" 条匹配通知）",url:n.url,tag:sha(n.url).slice(0,32)};
}
export function makeHandler({config,store,loadSnapshot,send,clock=Date.now}){
  function reply(res,status,body,setCookie){
    res.statusCode=status;
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    if(setCookie)res.setHeader("Set-Cookie",setCookie);
    res.end(JSON.stringify(body));
  }
  return async function handler(req,res){
    try{
      if(!["GET","POST"].includes(req.method))return reply(res,405,{error:"method-not-allowed"});
      if(!config)return reply(res,req.method==="GET"?200:503,{configured:false,error:"pilot-not-configured"});
      if(req.headers?.host!==new URL(config.origin).host)return reply(res,403,{error:"wrong-host"});
      const token=cookieToken(req),key=token?sha(token):null;
      const now=clock();
      if(req.method==="GET"){
        if(!key)return reply(res,200,{configured:true,registered:false,publicKey:config.publicKey});
        const read=await store.read();const active=deviceList(read.state,now);
        return reply(res,200,{configured:true,registered:Object.hasOwn(active,key),publicKey:config.publicKey});
      }
      const input=bodyOf(req),action=input.action;
      const dispatch=action==="dispatch";
      if(dispatch){
        if(!secureEqual(req.headers?.authorization,"Bearer "+config.dispatchSecret))return reply(res,401,{error:"unauthorized-dispatch"});
      }else if(req.headers?.origin!==config.origin)return reply(res,403,{error:"same-origin-required"});
      if(!["subscribe","revoke","dispatch"].includes(action))return reply(res,400,{error:"unknown-action"});
      if(action==="subscribe"){
        if(!secureEqual(input.invite,config.enrollSecret))return reply(res,403,{error:"invite-required"});
        const subscription=validateSubscription(input.subscription),preference=validatePreference(input.preference);
        if(!subscription||!preference||subscription.expirationTime!==null&&subscription.expirationTime<=now)return reply(res,400,{error:"invalid-subscription-or-preference"});
        const baseline=await loadSnapshot();
        const read=await store.read();
        if(busy(read.state,clock()))return reply(res,409,{error:"dispatch-in-progress"});
        const devices=deviceList(read.state,clock());
        const duplicate=Object.entries(devices).find(([other,row])=>row.subscription.endpoint===subscription.endpoint&&other!==key);
        if(duplicate)return reply(res,409,{error:"endpoint-already-enrolled"});
        if(!Object.hasOwn(devices,key||"")&&Object.keys(devices).length>=MAX_DEVICES)return reply(res,409,{error:"pilot-capacity"});
        const deviceToken=token||randomBytes(32).toString("base64url");
        const deviceKey=sha(deviceToken),existing=devices[deviceKey];
        const row={subscription,preference,baseline,expiresAt:now+EXPIRY,seen:existing?.seen||[]};
        row.seen=compactSeen(row,baseline);
        if(!row.seen)return reply(res,409,{error:"ledger-full"});
        devices[deviceKey]=row;
        await store.write(read.etag,{version:1,leaseUntil:0,devices});
        return reply(res,200,{configured:true,registered:true,publicKey:config.publicKey},cookie(deviceToken,30*86400));
      }
      if(action==="revoke"){
        if(!key)return reply(res,401,{error:"device-ownership-required"});
        const read=await store.read();
        if(busy(read.state,clock()))return reply(res,409,{error:"dispatch-in-progress"});
        const devices=deviceList(read.state,clock());
        delete devices[key];
        await store.write(read.etag,{version:1,leaseUntil:0,devices});
        return reply(res,200,{registered:false},cookie("",0));
      }
      // Sender sees a fixed public snapshot, never a client-supplied payload.
      const current=await loadSnapshot();
      const read=await store.read();
      if(busy(read.state,clock()))return reply(res,409,{error:"dispatch-in-progress"});
      const devices=deviceList(read.state,clock()),batch=[];
      let paused=0;
      for(const [k,row] of Object.entries(devices)){
        const result=Alerts.plan({previous:row.baseline,current,preference:row.preference,seenKeys:row.seen,nowMs:clock()});
        if(result.reason!=="planned-not-sent")continue;
        const seen=compactSeen(row,current);
        if(!seen){paused++;continue;}
        if(result.events.length)batch.push({key:k,subscription:row.subscription,payload:payloadFor(result.events)});
        row.baseline=current;row.seen=seen;
      }
      // Atomic claim before network: concurrent/stale workers cannot send the
      // same claimed events twice. Ambiguous failures are not blindly retried.
      const leaseUntil=clock()+LEASE;
      const claimed=await store.write(read.etag,{version:1,leaseUntil,devices});
      const counts={planned:batch.length,acceptedByProvider:0,failedOrUncertain:0,expired:0,paused};
      for(const item of batch){
        if(clock()+7000>=leaseUntil){counts.failedOrUncertain++;continue;}
        try{
          const status=await send(item.subscription,item.payload);
          if(status===404||status===410){delete devices[item.key];counts.expired++;}
          else if(status>=200&&status<300)counts.acceptedByProvider++;
          else counts.failedOrUncertain++;
        }catch{counts.failedOrUncertain++;}
      }
      // A confirmed revoke cannot race with a claimed send; mutations return
      // 409 while the lease is active. Already accepted pushes may arrive late.
      await store.write(claimed.etag,{version:1,leaseUntil:0,devices});
      return reply(res,200,{...counts,deviceDeliveryVerified:false});
    }catch(error){
      // Never expose SDK error text, request payload, endpoint or credentials.
      return reply(res,error?.status===409?409:error?.status===400?400:503,{error:error?.status===400?error.code:error?.status===409?"private-store-conflict":"alerts-unavailable"});
    }
  };
}
export function readConfig(env){
  if(env.CAMPUS_ALERTS_ENABLED!=="true")return null;
  const c={origin:env.CAMPUS_ALERT_ORIGIN,publicKey:env.CAMPUS_ALERT_VAPID_PUBLIC_KEY,privateKey:env.CAMPUS_ALERT_VAPID_PRIVATE_KEY,
    subject:env.CAMPUS_ALERT_VAPID_SUBJECT,blobToken:env.CAMPUS_ALERT_BLOB_TOKEN,enrollSecret:env.CAMPUS_ALERT_ENROLL_SECRET,dispatchSecret:env.CAMPUS_ALERT_DISPATCH_SECRET};
  try{
    const u=new URL(c.origin);
    if(u.origin!==c.origin||u.protocol!=="https:"||u.username||u.password||u.port||!u.hostname.endsWith(".vercel.app")||
       ![c.enrollSecret,c.dispatchSecret,c.blobToken].every(x=>typeof x==="string"&&x.length>=32)||
       c.enrollSecret===c.dispatchSecret||!bytes(c.publicKey,65)||!bytes(c.privateKey,32)||
       typeof c.subject!=="string"||!(/^(mailto:|https:\/\/)/.test(c.subject)))return null;
    const ec=createECDH("prime256v1");ec.setPrivateKey(bytes(c.privateKey,32));
    if(ec.getPublicKey().toString("base64url")!==c.publicKey)return null;
    return c;
  }catch{return null;}
}
