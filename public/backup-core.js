/* Local-only versioned backup. No network or model credentials. */
(function(root,factory){
  const common=typeof module==="object"&&module.exports;
  const api=factory(common?require("./taskboard-core.js"):root.CampusTaskCore,common?require("./source-core.js"):root.CampusSources);
  if(common)module.exports=api;if(root)root.CampusBackup=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(Task,Sources){
  "use strict";
  const TASK_KEY="campus-agent:tasks:v1",FOLLOWS_KEY="campus-agent:follows:v1";
  const FORMAT="campus-agent-local-backup",MAX_BYTES=2*1024*1024,MAX_TASKS=300;
  const DEFAULT_FOLLOWS={schools:[],departments:["zju-ai"],topics:[]};
  const TOPICS=Sources.TOPIC_IDS||["scholarships","admissions","teaching"];
  const fields={id:90,title:220,officialUrl:2048,noticeId:160,sourceId:100,publishedAt:10,deadlineDate:10,deadlineTime:5,
    deadlineTimezone:60,evidenceKey:1500,evidenceRole:30,evidenceScope:120,notes:300,status:10,createdAt:40,confirmedAt:40,completedAt:40};
  const plain=o=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
  const invalid=message=>{throw Error(message);};
  function cleanTask(row){
    if(!plain(row)||!Task.validateTask(row)||!Sources.officialURL(row.officialUrl))invalid("invalid-task");
    const out={};
    for(const key of Object.keys(row)){
      if(key==="startIsTracking"){if(typeof row[key]!=="boolean")invalid("invalid-task");out[key]=row[key];continue;}
      if(!Object.hasOwn(fields,key))invalid("unsupported-task-field");
      const value=row[key];
      if(key==="completedAt"&&value===null){out[key]=null;continue;}
      if(typeof value!=="string"||value.length>fields[key])invalid("invalid-task-field");
      if(["createdAt","confirmedAt","completedAt"].includes(key)&&!Number.isFinite(Date.parse(value)))invalid("invalid-task-timestamp");
      if(key==="evidenceRole"&&Task.ROLE_LABELS&&!Object.hasOwn(Task.ROLE_LABELS,value))invalid("invalid-evidence-role");
      out[key]=value;
    }
    if(!Task.validateTask(out))invalid("invalid-task");
    return out;
  }
  function cleanTasks(rows){
    if(!Array.isArray(rows)||rows.length>MAX_TASKS)invalid("invalid-task-count");
    const seen=new Set();
    return rows.map(row=>{const v=cleanTask(row);if(seen.has(v.id))invalid("duplicate-task-id");seen.add(v.id);return v;});
  }
  function cleanFollows(f){
    if(!plain(f)||Object.keys(f).some(k=>!["schools","departments","topics"].includes(k)))invalid("invalid-follows");
    const ids=Object.fromEntries([["schools",Sources.SCHOOLS.map(s=>s.id)],["topics",TOPICS]]);
    const result={};
    for(const k of ["schools","departments","topics"]){
      const v=k==="schools"&&f[k]===undefined?[]:f[k];
      if(!Array.isArray(v)||v.length>120||v.some(x=>typeof x!=="string"||(k==="departments"?!Sources.validId(x):!ids[k].includes(x))))invalid("invalid-follows");
      result[k]=[...new Set(v)];
    }
    return result;
  }
  function document(tasks,follows,{now=new Date()}={}){
    return {format:FORMAT,version:1,exportedAt:now.toISOString(),tasks:cleanTasks(tasks),follows:cleanFollows(follows)};
  }
  function parse(text){
    if(typeof text!=="string"||new TextEncoder().encode(text).byteLength>MAX_BYTES)invalid("file-too-large");
    let v;try{v=JSON.parse(text);}catch{invalid("invalid-json");}
    if(!plain(v)||v.format!==FORMAT||v.version!==1||Object.keys(v).some(k=>!["format","version","exportedAt","tasks","follows"].includes(k))||typeof v.exportedAt!=="string"||!Number.isFinite(Date.parse(v.exportedAt)))invalid("unsupported-backup");
    return {format:FORMAT,version:1,exportedAt:v.exportedAt,tasks:cleanTasks(v.tasks),follows:cleanFollows(v.follows)};
  }
  function read(storage){
    const taskRaw=storage.getItem(TASK_KEY),followRaw=storage.getItem(FOLLOWS_KEY);
    return {taskRaw,followRaw,tasks:cleanTasks(taskRaw===null?[]:JSON.parse(taskRaw)),follows:cleanFollows(followRaw===null?DEFAULT_FOLLOWS:JSON.parse(followRaw))};
  }
  function canonical(o){return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]])));}
  function preview(current,incoming,mode="merge"){
    if(!["merge","replace"].includes(mode))invalid("invalid-mode");
    const a=cleanTasks(current.tasks),b=cleanTasks(incoming.tasks),f=cleanFollows(current.follows),g=cleanFollows(incoming.follows);
    const existing=new Map(a.map(x=>[x.id,x]));
    let added=0,identical=0,conflicts=0;
    for(const row of b){
      if(!existing.has(row.id)){added++;existing.set(row.id,row);}
      else if(canonical(existing.get(row.id))===canonical(row))identical++;
      else conflicts++;
    }
    const tasks=mode==="replace"?b:[...existing.values()];
    const follows=mode==="replace"?g:cleanFollows(Object.fromEntries(Object.keys(f).map(k=>[k,[...new Set([...f[k],...g[k]])]])));
    if(tasks.length>MAX_TASKS)invalid("task-limit");
    return {tasks,follows,added,identical,conflicts,mode,removed:mode==="replace"?a.filter(x=>!b.some(y=>y.id===x.id)).length:0};
  }
  function apply(storage,observed,plan,{confirmed=false}={}){
    if(!confirmed)invalid("confirmation-required");
    const before=read(storage);
    if(before.taskRaw!==observed.taskRaw||before.followRaw!==observed.followRaw)invalid("local-state-changed");
    const tasks=cleanTasks(plan.tasks),follows=cleanFollows(plan.follows);
    try{
      storage.setItem(TASK_KEY,JSON.stringify(tasks));storage.setItem(FOLLOWS_KEY,JSON.stringify(follows));
    }catch{
      // Restore original values, including absent keys. If restoration itself
      // fails, report that uncertain state instead of pretending atomicity.
      let rollback=true;
      for(const [key,value] of [[TASK_KEY,before.taskRaw],[FOLLOWS_KEY,before.followRaw]]){
        try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{rollback=false;}
      }
      invalid(rollback?"write-failed-rolled-back":"write-failed-rollback-uncertain");
    }
  }
  return {FORMAT,MAX_BYTES,TASK_KEY,FOLLOWS_KEY,document,parse,read,preview,apply};
});
