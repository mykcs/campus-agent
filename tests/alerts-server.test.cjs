const {test}=require("node:test");
const assert=require("node:assert/strict");
const {createECDH,randomBytes}=require("node:crypto");

const origin="https://pilot.example.vercel.app", now=Date.parse("2026-11-24T16:00:00Z");
const secret="synthetic-enrollment-secret-for-test-only", dispatcher="synthetic-dispatch-secret-for-test-only";
const fixtureSub=(endpoint="https://web.push.apple.com/"+ "A".repeat(32))=>{
 const e=createECDH("prime256v1");e.generateKeys();
 return {endpoint,expirationTime:null,keys:{p256dh:e.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}};
};
const source={id:"zju-ai-admissions",name:"ZJU AI",url:"https://ai.zju.edu.cn/zstz/list1.htm",status:"ok"};
const notice=id=>({id,url:"https://ai.zju.edu.cn/"+id,title:"Test notice "+id,source_id:source.id,department_id:"zju-ai",published_at:"2026-11-24",topics:["admissions"]});
function fixture(at,items){
 const attempted_at=new Date(Date.parse(at)-1000).toISOString();
 const data={checked_at:at,sources:[source],notices:items,health:{status:"healthy",assessed_at:attempted_at}};
 const checks={checks:[{status:"healthy",attempted_at,notices:items.length}]};
 return {data,checks};
}
const core=()=>import("../lib/alerts-core.mjs");
const runtime=()=>import("../lib/alerts-runtime.mjs");
function memoryStore(){
 let state={version:1,leaseUntil:0,devices:{}},revision=0;
 return {read:async()=>({etag:revision,state:structuredClone(state)}),write:async(etag,value)=>{
  if(etag!==revision)throw Object.assign(Error("CAS conflict"),{status:409});
  state=structuredClone(value);return {etag:++revision};
 }};
}
async function harness({send}={}){
 const {makeHandler,verifySnapshot}=await core();
 let raw=fixture("2026-11-24T14:00:00Z",[notice("old")]);
 const store=memoryStore(),sent=[];
 const config={origin,publicKey:"test-public-key",enrollSecret:secret,dispatchSecret:dispatcher};
 const handler=makeHandler({config,store,clock:()=>now,loadSnapshot:async()=>verifySnapshot(raw.data,raw.checks,now),send:send|| (async(sub,payload)=>{sent.push({sub,payload});return 201;})});
 const call=async(body,{cookie,method="POST",headers={}}={})=>{
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};
  await handler({method,headers:{host:new URL(origin).host,origin,...(cookie?{cookie}:{}),...headers},body},response);
  return response;
 };
 const enroll=(sub=fixtureSub(),opts={})=>call({action:"subscribe",invite:secret,subscription:sub,preference:{optIn:true,schools:["zju"],departments:[],topics:[]}},opts);
 const dispatch=()=>call({action:"dispatch"},{headers:{authorization:"Bearer "+dispatcher}});
 return {call,enroll,dispatch,store,sent,update(at,items){raw=fixture(at,items);},breakHealth(){raw.checks.checks.at(-1).status="failed";}};
}
const deviceCookie=r=>r.headers["Set-Cookie"]?.split(";")[0];
test("disabled deployment is fail-closed; no store, credentials or external fetch",async()=>{
 const {makeHandler}=await core();
 const h=makeHandler({config:null,store:null,send:()=>{throw Error("never");}});
 for(const method of ["GET","POST"]){
  const res={setHeader(){},end(v){this.body=JSON.parse(v);}};
  await h({method},res);assert.equal(res.statusCode,method==="GET"?200:503);assert.equal(res.body.configured,false);
 }
});
test("explicit invite, same-origin, ownership cookie, duplicate endpoint and private response",async()=>{
 const h=await harness(),sub=fixtureSub();
 assert.equal((await h.call({action:"subscribe",invite:"wrong"})).statusCode,403);
 assert.equal((await h.enroll(sub,{headers:{origin:"https://untrusted.invalid"}})).statusCode,403);
 const r=await h.enroll(sub);
 assert.equal(r.statusCode,200);assert.match(r.headers["Set-Cookie"],/Secure; HttpOnly; SameSite=Strict/);
 assert.equal(r.headers["Cache-Control"],"private, no-store");
 assert.ok(!JSON.stringify(r.body).includes(sub.endpoint));
 assert.equal((await h.call({action:"revoke"})).statusCode,401);
 assert.equal((await h.enroll(sub)).statusCode,409);
 const status=await h.call(undefined,{cookie:deviceCookie(r),method:"GET"});
 assert.equal(status.body.registered,true);
 assert.equal((await h.call({action:"revoke"},{cookie:deviceCookie(r)})).statusCode,200);
 assert.equal((await h.call(undefined,{cookie:deviceCookie(r),method:"GET"})).body.registered,false);
});
test("full enrolled -> new healthy notice -> dispatch -> replay -> revoke lifecycle",async()=>{
 const h=await harness(),r=await h.enroll();
 assert.equal(r.statusCode,200);
 assert.equal((await h.dispatch()).body.planned,0);
 h.update("2026-11-24T15:00:00Z",[notice("old"),notice("new")]);
 assert.equal((await h.call({action:"dispatch"})).statusCode,401);
 const d=await h.dispatch();assert.equal(d.body.acceptedByProvider,1);assert.equal(d.body.deviceDeliveryVerified,false);
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].payload.url,"https://ai.zju.edu.cn/new");
 assert.equal((await h.dispatch()).body.planned,0);assert.equal(h.sent.length,1);
 assert.equal((await h.call({action:"revoke"},{cookie:deviceCookie(r)})).statusCode,200);
 h.update("2026-11-24T15:30:00Z",[notice("new"),notice("later")]);
 assert.equal((await h.dispatch()).body.planned,0);assert.equal(h.sent.length,1);
});
test("concurrent dispatch claims cannot duplicate; revoke waits for in-flight request",async()=>{
 let release,started;const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r);
 let sends=0;const h=await harness({send:async()=>{sends++;started();await gate;return 201;}});
 const r=await h.enroll();h.update("2026-11-24T15:00:00Z",[notice("new")]);
 const pending=h.dispatch();await ready;
 assert.equal((await h.dispatch()).statusCode,409);
 assert.equal((await h.call({action:"revoke"},{cookie:deviceCookie(r)})).statusCode,409);
 release();assert.equal((await pending).body.acceptedByProvider,1);
 assert.equal((await h.call({action:"revoke"},{cookie:deviceCookie(r)})).statusCode,200);
 assert.equal(sends,1);
});
test("expired subscriptions removed; ambiguous sends not retried",async()=>{
 for(const code of [410,500]){
  let attempts=0;const h=await harness({send:async()=>{attempts++;return code;}});
  const r=await h.enroll();h.update("2026-11-24T15:00:00Z",[notice("new")]);
  const d=await h.dispatch();assert.equal(d.body[code===410?"expired":"failedOrUncertain"],1);
  assert.equal((await h.dispatch()).body.planned,0);assert.equal(attempts,1);
  assert.equal((await h.call(undefined,{method:"GET",cookie:deviceCookie(r)})).body.registered,code!==410);
 }
});
test("latest failed/mismatched health receipt prevents dispatch from an old good catalog",async()=>{
 const h=await harness();await h.enroll();h.update("2026-11-24T15:00:00Z",[notice("new")]);h.breakHealth();
 const r=await h.dispatch();assert.equal(r.statusCode,503);assert.equal(h.sent.length,0);
 const {verifySnapshot}=await core();const f=fixture("2026-11-24T15:00:00Z",[notice("new")]);f.checks.checks[0].attempted_at="2026-11-24T14:00:00Z";
 assert.throws(()=>verifySnapshot(f.data,f.checks,now));
});
test("reject untrusted push endpoints, malformed key material and unknown topics",async()=>{
 const {validateSubscription,validatePreference}=await core();
 for(const endpoint of ["http://web.push.apple.com/"+"A".repeat(32),"https://localhost/"+"A".repeat(32),"https://web.push.apple.com.evil.test/"+"A".repeat(32),"https://web.push.apple.com:8443/"+"A".repeat(32),"https://web.push.apple.com/anything?redirect=1","https://user:pass@web.push.apple.com/"+"A".repeat(32)]){
  assert.equal(validateSubscription(fixtureSub(endpoint)),null);
 }
 const sub=fixtureSub();assert.ok(validateSubscription(sub));
 assert.equal(validateSubscription({...sub,keys:{...sub.keys,p256dh:"bad"}}),null);
 assert.equal(validatePreference({optIn:true,schools:["zju"],departments:[],topics:["unknown"]}),null);
});
test("real web-push library encrypts payload and signs request; no network or live credentials",async()=>{
 const {generateVAPIDKeys}=await import("web-push"),{encryptedPush}=await runtime();
 const keys=generateVAPIDKeys(),payload={title:"Synthetic test",body:"Synthetic payload",url:"https://ai.zju.edu.cn/test"};
 const config={...keys,subject:"https://example.test/"};
 const result=await encryptedPush(config,fixtureSub(),payload,async(url,opts)=>{
  assert.ok(url.startsWith("https://web.push.apple.com/"));assert.equal(opts.redirect,"error");assert.equal(opts.method,"POST");
  assert.ok(opts.headers.Authorization||opts.headers.authorization);
  assert.ok(Buffer.isBuffer(opts.body)||opts.body instanceof Uint8Array);
  assert.ok(!Buffer.from(opts.body).includes(Buffer.from("Synthetic payload")));
  return new Response(null,{status:201});
 });
 assert.equal(result,201);
});
test("private Blob adapter always uses private access and CAS, rejects public read",async()=>{
 const {privateStore}=await runtime();let writes=0;
 const fakeUrl="https://test-store.private.blob.vercel-storage.com/campus-alerts/pilot-v1.json", state={version:1,devices:{},leaseUntil:0};
 const store=privateStore({blobToken:"fake-test-token"},{readBlob:async(path,opts)=>{
  assert.equal(opts.access,"private");return {statusCode:200,stream:new Response(JSON.stringify(state)).body,blob:{etag:"before",url:fakeUrl}};
 },writeBlob:async(path,body,opts)=>{
  writes++;assert.equal(opts.access,"private");assert.equal(opts.ifMatch,"before");assert.equal(opts.allowOverwrite,true);return {etag:"after",url:fakeUrl};
 }});
 const old=await store.read();assert.equal(old.etag,"before");assert.equal((await store.write(old.etag,state)).etag,"after");assert.equal(writes,1);
 const wrong=privateStore({blobToken:"fake-test-token"},{readBlob:async()=>({statusCode:200,stream:new Response("{}").body,blob:{etag:"before",url:"https://test-store.public.blob.vercel-storage.com/x"}})});
 await assert.rejects(()=>wrong.read());
});
