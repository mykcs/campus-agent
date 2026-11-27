const {test}=require("node:test"),assert=require("node:assert/strict");
const B=require("../public/backup-core.js");
const task={id:"task_123456",noticeId:"public1",title:"公开测试",officialUrl:"https://ai.zju.edu.cn/test.htm",publishedAt:"2026-11-20",deadlineDate:"2026-11-30",deadlineTime:"",status:"done",notes:"private synthetic note",completedAt:"2026-11-25T16:00:00Z",createdAt:"2026-11-20T12:00:00Z",confirmedAt:"2026-11-20T12:00:00Z"};
const typed={...task,id:"task_789123",deadlineTimezone:"America/New_York",deadlineTime:"20:00",evidenceRole:"postmark",evidenceKey:"test",evidenceScope:"synthetic scope",status:"todo",completedAt:null,startIsTracking:false};
const follows={departments:["zju-ai"],schools:["mit"],topics:["scholarships"]};
const doc=(tasks=[task,typed],f=follows)=>B.document(tasks,f,{now:new Date("2026-11-27T12:00:00Z")});
function store(initial={}){
 const m=new Map(Object.entries(initial));return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
}
test("legacy and typed task roundtrip, exact completion/zone, no unrelated storage",()=>{
 const s=store({[B.TASK_KEY]:JSON.stringify([task,typed]),[B.FOLLOWS_KEY]:JSON.stringify(follows),model:"SECRET_NOT_EXPORTED"});
 const data=B.read(s),serialized=JSON.stringify(doc(data.tasks,data.follows)),parsed=B.parse(serialized);
 assert.deepEqual(parsed.tasks,[task,typed]);assert.deepEqual(parsed.follows,follows);
 assert.ok(!serialized.includes("SECRET_NOT_EXPORTED"));
});
test("merge is idempotent, conflict preserves current and unions follows",()=>{
 const current={tasks:[task],follows},other=doc([{...task,status:"doing"},typed],{schools:["tsinghua"],departments:[],topics:["teaching"]});
 const p=B.preview(current,other);assert.equal(p.added,1);assert.equal(p.conflicts,1);assert.equal(p.tasks[0].status,"done");
 assert.deepEqual(p.follows.schools,["mit","tsinghua"]);
 assert.equal(B.preview(p,other).added,0);
 assert.equal(B.preview(current,other,"replace").tasks[0].status,"doing");
});
test("reject malformed, unknown schema, secret fields, hostile URL, invalid DST, duplicate IDs",()=>{
 const good=doc();
 for(const b of ["{",JSON.stringify({...good,version:2}),JSON.stringify({...good,apiKey:"forbidden"}),JSON.stringify({...good,tasks:[{...task,apiKey:"forbidden"}]}),JSON.stringify({...good,tasks:[{...task,officialUrl:"https://mit.edu.evil.example/a"}]}),JSON.stringify({...good,tasks:[{...typed,deadlineDate:"2026-11-01",deadlineTime:"01:30"}]}),JSON.stringify({...good,tasks:[task,task]}),JSON.stringify({...good,follows:{...follows,schools:["evil"]}})])assert.throws(()=>B.parse(b));
 assert.throws(()=>B.parse("x".repeat(B.MAX_BYTES+1)));
});
test("explicit confirmation, recheck preview snapshot, and rollback on second write",()=>{
 const initial={[B.TASK_KEY]:JSON.stringify([task]),[B.FOLLOWS_KEY]:JSON.stringify(follows)};
 const s=store(initial),observed=B.read(s),p=B.preview(observed,doc());
 assert.throws(()=>B.apply(s,observed,p),/confirmation/);
 s.setItem(B.TASK_KEY,"[]");assert.throws(()=>B.apply(s,observed,p,{confirmed:true}),/local-state-changed/);
 s.setItem(B.TASK_KEY,initial[B.TASK_KEY]);
 let fail=true;const original=s.setItem;s.setItem=(k,v)=>{if(k===B.FOLLOWS_KEY&&fail){fail=false;throw Error("quota");}original(k,v);};
 assert.throws(()=>B.apply(s,observed,p,{confirmed:true}),/rolled-back/);
 assert.equal(s.getItem(B.TASK_KEY),initial[B.TASK_KEY]);assert.equal(s.getItem(B.FOLLOWS_KEY),initial[B.FOLLOWS_KEY]);
 B.apply(s,observed,p,{confirmed:true});assert.equal(B.read(s).tasks.length,2);
});
