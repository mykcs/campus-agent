const test=require("node:test");
const assert=require("node:assert/strict");
const C=require("../public/taskboard-core.js");

const task={
  id:"task_example_123456789",noticeId:"notice1",
  title:"2027年博士招生材料提交",officialUrl:"https://ai.zju.edu.cn/2026/1020/c90497a3216866/page.htm",
  publishedAt:"2026-11-18",deadlineDate:"2026-11-22",deadlineTime:"",
  notes:"研究生院确认",status:"todo"
};

test("calendar-day math is UTC-stable, incl SGT day boundary",()=>{
  assert.equal(C.dateOrdinal("2026-02-29"),null);
  assert.equal(C.dateOrdinal("2028-02-29")!==null,true);
  assert.equal(C.daysRemaining("2026-11-22","2026-11-20"),2);
  assert.equal(C.daysRemaining("2026-11-19","2026-11-20"),-1);
  assert.equal(C.sgtToday(new Date("2026-11-19T17:30:00Z")),"2026-11-20");
  assert.equal(C.addDays("2026-12-31",1),"2027-01-01");
});
test("elapsed time is not task completion",()=>{
  assert.equal(C.elapsedFraction("2026-11-18","2026-11-22","2026-11-20"),50);
  assert.equal(C.elapsedFraction("2026-11-18","2026-11-22","2026-11-17"),0);
  assert.equal(C.elapsedFraction("2026-11-18","2026-11-22","2026-11-24"),100);
  assert.equal(C.dueLabel(task,"2026-11-20"),"还剩 2 天");
  assert.equal(C.dueLabel(task,"2026-11-22"),"今天截止");
  assert.equal(C.dueLabel(task,"2026-11-25"),"已逾期 3 天");
  assert.equal(C.dueLabel({...task,status:"done"},"2026-11-25"),"已完成");
});
test("candidate extraction is never marked verified or auto-converted",()=>{
  const rows=[{id:"notice1",title:"招生",url:task.officialUrl,date_candidates:[
    {value:"2026-11-18",context:"报名开始"},
    {value:"2026-11-22T20:00",context:"报名结束"},
    {value:"2025-01-02",context:"历史日期"},
  ]}];
  const dates=C.candidateDates(rows,{today:"2026-11-20"});
  assert.equal(dates.length,1);
  assert.equal(dates[0].date,"2026-11-22");
  assert.equal(dates[0].time,"20:00");
  assert.equal(dates[0].verified,false);
});
test("validates task fields before exporting",()=>{
  assert.equal(C.validateTask(task),true);
  assert.equal(C.validateTask({...task,deadlineDate:"2026-02-31"}),false);
  assert.equal(C.validateTask({...task,deadlineTime:"25:00"}),false);
  assert.equal(C.validateTask({...task,status:"reviewed"}),false);
});
test("ICS all-day events conform to end-exclusive RFC5545 and escape text",()=>{
  const calendar=C.icsDocument([{...task,title:"申报,材料;审核\n检查"}],{now:new Date("2026-11-19T09:00:00Z")});
  assert.match(calendar,/BEGIN:VCALENDAR\r\nVERSION:2.0/);
  assert.match(calendar,/BEGIN:VEVENT\r\nUID:task_example_123456789@campus-agent.local/);
  assert.match(calendar,/DTSTART;VALUE=DATE:20261122/);
  assert.match(calendar,/DTEND;VALUE=DATE:20261123/);
  assert.match(calendar,/SUMMARY:截止 · 申报\\,材料\\;审核\\n检查/);
  assert.match(calendar,/END:VCALENDAR\r\n$/);
  assert.ok(calendar.split("\r\n").every(line=>Buffer.byteLength(line,"utf8")<=75));
});
test("SGT time is encoded in UTC without timezone ambiguity",()=>{
  const calendar=C.icsDocument([{...task,deadlineTime:"20:00"}],{now:new Date("2026-11-19T09:00:00Z")});
  assert.match(calendar,/DTSTART:20261122T120000Z/);
  assert.match(calendar,/DTEND:20261122T123000Z/);
});
test("Google Calendar link is add-once, not a bidirectional sync",()=>{
  const link=C.googleCalendarUrl(task);
  const query=new URL(link);
  assert.equal(query.hostname,"calendar.google.com");
  assert.equal(query.searchParams.get("dates"),"20261122/20261123");
  assert.equal(query.searchParams.get("action"),"TEMPLATE");
  assert.match(query.searchParams.get("details"),/学校官方来源|学校原文|官方来源/);
});

test("typed evidence retains roles and same-day application scopes, never guesses",()=>{
  const url=task.officialUrl;
  const rows=C.candidateDates([{id:"n1",title:"招生",url,date_candidates:[{value:"2026-11-22"}],date_events:[
    {type:"open",value:"2026-11-22T09:00",resolution:"explicit",verified:false,source_url:url,scope_text:"甲"},
    {type:"close",value:"2026-11-22T20:00",resolution:"explicit",verified:false,source_url:url,scope_text:"甲"},
    {type:"postmark",value:"2026-11-22",resolution:"explicit",verified:false,source_url:url,scope_text:"乙"},
    {type:"close",value:null,raw:"9月10日24:00",resolution:"unresolved_time",verified:false,source_url:url},
    {type:"close",value:"2026-11-22",resolution:"explicit",verified:true,source_url:url},
    {type:"close",value:"2026-11-22",resolution:"explicit",verified:false,source_url:"https://example.com/"}
  ]}],{today:"2026-11-20"});
  assert.equal(rows.length,4);
  assert.equal(new Set(rows.map(r=>r.key)).size,4);
  assert.equal(rows.find(r=>r.role==="open").mayPrefill,false);
  assert.equal(rows.find(r=>r.role==="close"&&r.date).zone,"");
  assert.equal(rows.find(r=>!r.date).mayPrefill,false);
  assert.equal(rows.find(r=>!r.date).raw,"9月10日24:00");
  assert.ok(rows.every(r=>r.verified===false));
});
test("explicit zones convert DST and cross-day deadlines without guessing",()=>{
  const iso=(d,t,z)=>new Date(C.deadlineEpoch(d,t,z)).toISOString();
  assert.equal(iso("2026-07-04","20:00","America/New_York"),"2026-07-05T00:00:00.000Z");
  assert.equal(iso("2026-12-04","20:00","America/New_York"),"2026-12-05T01:00:00.000Z");
  assert.equal(iso("2026-11-22","20:00","UTC-08:00"),"2026-11-23T04:00:00.000Z");
  assert.equal(C.deadlineEpoch("2026-03-08","02:30","America/New_York"),null);
  assert.equal(C.deadlineEpoch("2026-11-01","01:30","America/New_York"),null);
  assert.equal(C.deadlineEpoch("2026-11-22","20:00",""),null);
  const mit={...task,officialUrl:"https://oge.mit.edu/funding/",deadlineDate:"2026-11-22",deadlineTime:"20:00",deadlineTimezone:"America/New_York"};
  assert.equal(C.validateTask(mit),true);
  assert.equal(C.validateTask({...mit,deadlineTimezone:""}),false);
  assert.equal(C.validateTask({...mit,deadlineDate:"2026-11-01",deadlineTime:"01:30"}),false);
  assert.match(C.icsDocument([mit]),/DTSTART:20261123T010000Z/);
  const google=new URL(C.googleCalendarUrl(mit));
  assert.equal(google.searchParams.get("dates"),"20261123T010000Z/20261123T013000Z");
  assert.equal(google.searchParams.get("ctz"),"America/New_York");
  assert.equal(C.taskDays(mit,new Date("2026-11-22T16:01:00Z")),0);
  assert.equal(C.dueLabel(mit,undefined,new Date("2026-11-23T01:01:00Z")),"已到截止时间");
  assert.equal(C.statusKind(mit,undefined,new Date("2026-11-23T01:01:00Z")),"overdue");
  assert.equal(C.dueLabel({...mit,status:"done"},undefined,new Date("2026-11-23T01:01:00Z")),"已完成");
  assert.equal(C.validateTask({...task,officialUrl:"http://www.cs.zju.edu.cn/notice.htm"}),true);
  assert.equal(C.validateTask({...task,officialUrl:"https://mit.edu.evil.test/notice"}),false);
});
