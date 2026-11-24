const {test}=require("node:test");
const assert=require("node:assert/strict");
const base={baseUrl:"https://api.moonshot.ai/v1",apiKey:"TEST_ONLY_FAKE_KEY",model:"mock-model",question:"博士申请",notices:[{title:"公开招生通知",url:"https://ai.zju.edu.cn/2026/1020/c90497a3216866/page.htm",excerpt:"官方通知",date_candidates:[{value:"2026-11-25",verified:true}]}]};
async function call(body=base,{method="POST",headers={host:"example.test"},fetcher}={}){
  const {default:handler}=await import("../api/chat.js");
  const prev=global.fetch,received=[];
  global.fetch=async(url,options)=>{
    received.push({url,options});
    return fetcher?fetcher(url,options):new Response(JSON.stringify({choices:[{message:{content:"请核对官方原文"}}]}),{status:200});
  };
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};
  try{await handler({method,headers,body},response);return {...response,received};}finally{global.fetch=prev;}
}
test("legal mock provider, no credential response, original official links",async()=>{
  const r=await call();
  assert.equal(r.statusCode,200);
  assert.equal(r.received.length,1);
  assert.equal(r.received[0].url,"https://api.moonshot.ai/v1/chat/completions");
  assert.equal(r.received[0].options.redirect,"error");
  assert.equal(r.received[0].options.headers.Authorization,"Bearer "+base.apiKey);
  assert.equal(r.headers["Cache-Control"],"no-store");
  assert.ok(!JSON.stringify(r.body).includes(base.apiKey));
  assert.equal(r.body.sources[0].url,base.notices[0].url);
  assert.match(JSON.parse(r.received[0].options.body).messages[0].content,/"verified":false/);
});
test("method, cross-origin, malformed and oversized bodies",async()=>{
  for(const [body,opt,expected] of [[base,{method:"GET"},405],[base,{headers:{host:"example.test",origin:"https://evil.test"}},403],["{",{},400],[[],{},400],[{...base,extra:"a".repeat(46000)},{},413],[base,{headers:{host:"example.test","content-length":"NaN"}},400]]){
    const r=await call(body,opt);assert.equal(r.statusCode,expected);assert.equal(r.received.length,0);
  }
});
test("reject arbitrary proxy hosts, credentials, alternate paths and control characters",async()=>{
  for(const url of ["http://api.moonshot.ai/v1","https://127.0.0.1/v1","https://api.moonshot.ai.evil.test/v1","https://user:pass@api.moonshot.ai/v1","https://api.moonshot.ai:8443/v1","https://api.moonshot.ai/redirect","https://api.moonshot.ai/v1?x=1"]){
    const r=await call({...base,baseUrl:url});assert.equal(r.statusCode,400);assert.equal(r.received.length,0);
  }
  const r=await call({...base,apiKey:"fake\r\nbad"});assert.equal(r.statusCode,400);assert.equal(r.received.length,0);
});
test("malicious source ignored and mock provider failures do not expose key",async()=>{
  const r=await call({...base,notices:[{title:"bad",url:"https://evil.test/"},...base.notices]});
  assert.equal(r.body.sources.length,1);
  for(const code of [401,402,403,429,500]){
    const q=await call(base,{fetcher:()=>new Response(base.apiKey,{status:code})});
    assert.equal(q.statusCode,502);assert.ok(!JSON.stringify(q.body).includes(base.apiKey));assert.ok(q.body.error.includes(String(code)));
  }
  for(const fetcher of [()=>new Response(JSON.stringify({choices:[]}),{status:200}),()=>{throw new DOMException("mock","AbortError");},()=>{throw Error(base.apiKey);}]) {
    const q=await call(base,{fetcher});assert.equal(q.statusCode,502);assert.ok(!JSON.stringify(q.body).includes(base.apiKey));
  }
});
