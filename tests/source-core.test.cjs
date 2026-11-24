const {test}=require("node:test"),assert=require("node:assert/strict");
const C=require("../public/source-core.js");
const z={id:"z",title:"ZJU notice",url:"https://ai.zju.edu.cn/a.htm",department_id:"zju-ai",department:"人工智能学院",source_id:"zju-ai-admissions",topics:["admissions"]};
const m={id:"m",title:"MIT notice",url:"https://oge.mit.edu/funding/example/",department_id:"mit-oge",department:"Graduate education",source_id:"mit-oge-funding",topics:["scholarships"]};
const t={id:"t",title:"THU notice",url:"https://www.cs.tsinghua.edu.cn/info/1002/1.htm",department_id:"tsinghua-cs",department:"计算机系",source_id:"tsinghua-cs-public",topics:["scholarships"]};
const h={id:"h",title:"History funding",url:"https://ls.zju.edu.cn/example.htm",department_id:"zju-history",department:"历史学院",source_id:"zju-history-aid",topics:["scholarships"]};
const data={notices:[z,m,t,h,{...m,id:"duplicate"},{...t,id:"bad",url:"https://tsinghua.edu.cn.evil.example/a"}],sources:[
  {id:"zju-history-aid",name:"历史学院 · 学生资助",url:"https://ls.zju.edu.cn/65208/list.htm",status:"ok"},
  {id:"mit-oge-funding",name:"MIT public funding",url:"https://oge.mit.edu/funding/",status:"partial"},
  {id:"tsinghua-cs-public",name:"清华 · 计算机系",url:"https://www.cs.tsinghua.edu.cn/",status:"degraded"},
  {id:"mit-fake",name:"Fake",url:"https://example.com",status:"ok"}]};
test("official host boundary and legacy ZJU URL",()=>{
  for(const u of [z.url,m.url,t.url,"http://www.cs.zju.edu.cn/legacy.htm"])assert.ok(C.officialURL(u));
  for(const u of ["javascript:alert(1)","https://mit.edu.evil.test/a","https://mit.edu@evil.test","https://user:pass@mit.edu/a","https://mit.edu:8443/a","http://mit.edu/a","https://notzju.edu.cn"])assert.equal(C.officialURL(u),null);
});
test("mixed source metadata, pending defaults, and unknown status",()=>{
  const rows=C.sourceList(data);
  assert.equal(rows.find(s=>s.id==="zju-history-aid").status,"ok");
  assert.equal(rows.find(s=>s.id==="mit-oge-funding").status,"partial");
  assert.equal(C.statusLabel(rows.find(s=>s.id==="tsinghua-cs-public").status),"采集异常");
  assert.equal(rows.find(s=>s.id==="zju-ai-admissions").status,"pending");
  assert.ok(!rows.some(s=>s.id==="mit-fake"));
});
test("mixed school department and topic union with canonical deduplication",()=>{
  const rows=C.notices(data);
  assert.equal(rows.length,4);
  const departments=C.departmentList(data);
  for(const id of ["zju-ai","zju-history","mit-oge","tsinghua-cs"])assert.ok(departments.some(d=>d.id===id));
  assert.deepEqual(rows.filter(n=>C.isFollowed(n,{schools:[],departments:["zju-ai","mit-oge"],topics:["scholarships"]},n.topics)).map(n=>n.id),["z","m","t","h"]);
  assert.deepEqual(rows.filter(n=>C.isFollowed(n,{schools:["mit"],departments:[],topics:[]},n.topics)).map(n=>n.id),["m"]);
  assert.equal(C.departmentId({...m,department_id:"zju-ai"}),"");
});
