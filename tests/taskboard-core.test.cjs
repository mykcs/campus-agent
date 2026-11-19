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
