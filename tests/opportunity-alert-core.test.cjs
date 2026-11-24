const {test}=require("node:test");
const assert=require("node:assert/strict");
const {plan}=require("../public/opportunity-alert-core.js");
const before="2026-11-24T08:00:00Z",after="2026-11-24T10:00:00Z";
const nowMs=Date.parse(after)+1000;
const source={id:"zju-ai-admissions",url:"https://ai.zju.edu.cn/zstz/list1.htm",name:"AI",status:"ok"};
const notice=(id,extra={})=>({id,title:"奖学金 "+id,url:"https://ai.zju.edu.cn/"+id,source_id:source.id,department_id:"zju-ai",published_at:"2026-11-24",date_inferred:false,topics:["scholarships"],...extra});
const snapshot=(checked_at,notices=[],sources=[source],health="healthy")=>({checked_at,notices,sources,health:{status:health}});
const base={previous:snapshot(before,[notice("old")]),current:snapshot(after,[notice("old"),notice("new")]),preference:{optIn:true,schools:["zju"]},seenKeys:[],nowMs};
test("explicit opt-in and first healthy baseline are mandatory",()=>{
  assert.equal(plan({...base,preference:{schools:["zju"]}}).reason,"not-opted-in");
  assert.equal(plan({...base,previous:null}).events.length,0);
  assert.equal(plan({...base,seenKeys:null}).events.length,0);
});
test("only new matched official notices, ledger suppresses replay",()=>{
  const a=plan(base);assert.equal(a.reason,"planned-not-sent");assert.equal(a.events.length,1);
  assert.equal(a.events[0].url,"https://ai.zju.edu.cn/new");
  assert.equal(plan({...base,seenKeys:[a.events[0].key]}).events.length,0);
  assert.equal(plan({...base,preference:{optIn:true,schools:["mit"]}}).events.length,0);
  assert.equal(plan({...base,preference:{optIn:true,topics:["scholarships"]}}).events.length,1);
  assert.equal(plan({...base,preference:{optIn:false,schools:["zju"]}}).events.length,0);
});
test("reject unhealthy, stale and out-of-order snapshots",()=>{
  assert.equal(plan({...base,current:snapshot(after,[notice("new")],[source],"degraded")}).events.length,0);
  assert.equal(plan({...base,nowMs:nowMs+7*3600000}).events.length,0);
  assert.equal(plan({...base,current:snapshot(before,[notice("new")])}).events.length,0);
});
test("no backfill, inferred/unknown dates, untrusted URL or unverified source",()=>{
  const additions=[notice("oldbackfill",{published_at:"2026-11-20"}),notice("inferred",{date_inferred:true}),notice("unknown",{published_at:null}),notice("bad-date",{published_at:"2026-11-31"}),notice("untrusted",{url:"https://evil.example/alert"}),notice("missing-source",{source_id:"zju-unknown"})];
  assert.equal(plan({...base,current:snapshot(after,additions)}).events.length,0);
});
test("no burst from newly added or previously failed sources",()=>{
  const newSource={id:"mit-hst",url:"https://hst.mit.edu/news-events/twihst",status:"partial"};
  const n=notice("mit",{url:"https://hst.mit.edu/new",source_id:"mit-hst",department_id:"mit-hst"});
  assert.equal(plan({...base,current:snapshot(after,[n],[source,newSource]),preference:{optIn:true,schools:["mit"]}}).events.length,0);
  assert.equal(plan({...base,previous:snapshot(before,[],[{...source,status:"error"}])}).events.length,0);
});


test("source-local date boundary and legacy explicit ZJU AI row dates",()=>{
  const midnight=Date.parse("2026-11-24T16:30:00Z");
  const a=snapshot("2026-11-24T15:30:00Z",[notice("old")]);
  const b=snapshot("2026-11-24T16:30:00Z",[notice("legacy-ai",{published_at:"2026-11-25",date_inferred:undefined})]);
  assert.equal(plan({...base,previous:a,current:b,nowMs:midnight+1000}).events.length,1);
});
