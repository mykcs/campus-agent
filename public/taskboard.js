"use strict";
/* Campus Agent personal deadline workspace.
 * The public notice index is not a task list; dates must be confirmed by the user.
 * No school account, hosted database, calendar OAuth or AI call is required.
 */
(function(){
  const Core=window.CampusTaskCore;
  if(!Core)throw Error("CampusTaskCore must load before taskboard.js");
  const STORAGE_KEY="campus-agent:tasks:v1";
  const $=id=>document.getElementById(id);
  let notices=[];
  let tasks=readTasks();

  function element(tag,cls,text){
    const x=document.createElement(tag);
    if(cls)x.className=cls;
    if(text!==undefined&&text!==null)x.textContent=String(text);
    return x;
  }
  function readTasks(){
    try{
      const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
      if(!Array.isArray(data))return [];
      return data.filter(Core.validateTask).slice(0,300);
    }catch{return [];}
  }
  function saveTasks(next){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      tasks=next;
      render();
      return true;
    }catch{
      alert("当前浏览器无法保存任务。请允许网站本地存储，或检查私密浏览设置。");
      return false;
    }
  }
  function officialLink(label,url,cls){
    const a=element("a",cls,label);
    try{
      const u=new URL(url);
      if(u.protocol!=="https:"||!u.hostname.endsWith(".zju.edu.cn"))throw Error();
      a.href=u.href;
    }catch{a.href="https://ai.zju.edu.cn/zstz/list1.htm";}
    a.target="_blank";a.rel="noopener noreferrer";
    return a;
  }
  function countSummary(){
    const today=Core.sgtToday();
    const current=tasks.filter(t=>t.status!=="done");
    const dueNow=current.filter(t=>Core.daysRemaining(t.deadlineDate,today)===0).length;
    const overdue=current.filter(t=>Core.daysRemaining(t.deadlineDate,today)<0).length;
    const soon=current.filter(t=>{
      const d=Core.daysRemaining(t.deadlineDate,today);
      return d!==null&&d>=0&&d<=7;
    }).length;
    const completed=tasks.filter(t=>t.status==="done").length;
    const area=$("todaySummary");area.replaceChildren();
    for(const [count,label,kind] of [
      [dueNow,"今天截止","urgent"],[overdue,"已逾期","overdue"],[soon,"7天内待办","soon"],[completed,"已完成","complete"]
    ]){
      const card=element("div","summary-stat "+kind);
      card.append(element("strong","",count),element("span","",label));
      area.append(card);
    }
  }
  function statusSelect(task){
    const select=element("select","task-status");
    select.setAttribute("aria-label","更改"+task.title+"的完成状态");
    for(const [value,label] of [["todo","未开始"],["doing","进行中"],["done","已完成"]]){
      const option=element("option","",label);
      option.value=value;
      if(task.status===value)option.selected=true;
      select.append(option);
    }
    select.addEventListener("change",()=>{
      saveTasks(tasks.map(x=>x.id===task.id?{
        ...x,status:select.value,
        completedAt:select.value==="done"?(x.completedAt||new Date().toISOString()):null
      }:x));
    });
    return select;
  }
  function taskTitle(task){
    const div=element("div","task-title-col");
    div.append(officialLink(task.title,task.officialUrl,"task-title-link"));
    if(task.notes)div.append(element("span","task-notes",task.notes));
    return div;
  }
  function taskStatusText(task){
    const kind=Core.statusKind(task);
    return element("span","deadline-label "+kind,Core.dueLabel(task));
  }
  function renderToday(){
    const today=Core.sgtToday();
    const upcoming=tasks.filter(t=>{
      const days=Core.daysRemaining(t.deadlineDate,today);
      return (t.status!=="done"&&(days!==null&&days<=7||t.status==="doing"))||
        (t.status==="done"&&t.completedAt&&Core.sgtToday(new Date(t.completedAt))===today);
    });
    upcoming.sort((a,b)=>(a.status==="done"?1:0)-(b.status==="done"?1:0)||
      Core.daysRemaining(a.deadlineDate,today)-Core.daysRemaining(b.deadlineDate,today));
    $("todayCount").textContent=upcoming.length+" 项";
    const area=$("todayTaskBoard");area.replaceChildren();
    if(!upcoming.length){
      const empty=element("div","task-empty");
      empty.append(element("strong","","今天没有紧急待办"));
      empty.append(element("p","","未来7天的未完成任务会出现在这里。尚未核对的日期仍放在下方候选区。"));
      area.append(empty);return;
    }
    for(const task of upcoming){
      const row=element("div","today-task");
      const flag=element("span","today-indicator "+Core.statusKind(task));
      flag.textContent=task.status==="done"?"✓":"•";
      const body=element("div","today-body");
      body.append(taskTitle(task),taskStatusText(task));
      row.append(flag,body,statusSelect(task));
      area.append(row);
    }
  }
  function renderProgress(){
    const area=$("progressList");area.replaceChildren();
    $("progressCount").textContent=tasks.length+" 项";
    if(!tasks.length){
      const empty=element("div","task-empty");
      empty.append(element("strong","","还没有跟踪的申请任务"));
      empty.append(element("p","","选择一条官方通知，核对日期后加入进度。你可以把学校的申请窗口变成时间条来管理。"));
      area.append(empty);return;
    }
    const sorted=[...tasks].sort((a,b)=>(a.status==="done"?1:0)-(b.status==="done"?1:0)||
      a.deadlineDate.localeCompare(b.deadlineDate));
    const today=Core.sgtToday();
    for(const task of sorted){
      const card=element("article","progress-card"+(task.status==="done"?" task-is-done":""));
      const head=element("div","progress-card-head");
      const title=taskTitle(task);
      const meta=element("div","progress-meta");
      meta.append(taskStatusText(task));
      head.append(title,meta);
      const track=element("div","progress-track");
      const fill=element("div","progress-fill "+Core.statusKind(task));
      const start=Core.dateOrdinal(task.publishedAt)>Core.dateOrdinal(task.deadlineDate)?task.deadlineDate:task.publishedAt;
      const pct=Core.elapsedFraction(start,task.deadlineDate,today);
      fill.style.width=pct+"%";
      const marker=element("div","progress-today-marker");
      marker.style.left=pct+"%";
      track.setAttribute("role","img");
      track.setAttribute("aria-label","时间已过去约"+pct+"%，不代表任务完成率");
      track.append(fill,marker);
      const span=element("div","progress-span");
      const display=day=>String(day).replace(/-/g,".");
      span.append(element("span","","公告："+display(start)),
        element("span","","截止："+display(task.deadlineDate)+(task.deadlineTime?" "+task.deadlineTime+" SGT":" · 日期")));
      const action=element("div","progress-actions");
      action.append(statusSelect(task));
      const google=Core.googleCalendarUrl(task);
      if(google){
        const a=element("a","task-calendar-link","加入 Google 日历 ↗");
        a.href=google;a.target="_blank";a.rel="noopener noreferrer";
        a.title="在 Google 日历中添加一次性事件，不会同步任务状态";
        action.append(a);
      }
      const remove=element("button","task-delete","移除");
      remove.type="button";remove.setAttribute("aria-label","移除任务："+task.title);
      remove.addEventListener("click",()=>{
        if(confirm("从此浏览器删除这条任务？不会影响学校公告。")){
          saveTasks(tasks.filter(x=>x.id!==task.id));
        }
      });
      action.append(remove);
      card.append(head,track,span,action);
      area.append(card);
    }
  }
  function renderCandidates(){
    const area=$("candidateList");area.replaceChildren();
    const tracked=new Set(tasks.map(t=>t.noticeId+"|"+t.deadlineDate));
    const candidates=Core.candidateDates(notices,{limit:25}).filter(c=>!tracked.has(c.noticeId+"|"+c.date)).slice(0,8);
    if(!candidates.length){
      const empty=element("div","candidate-empty","最近没有可展示的未来日期候选；这不代表学校没有新的申请截止日。");
      area.append(empty);
      return;
    }
    for(const c of candidates){
      const row=element("div","candidate-row");
      const info=element("div","candidate-main");
      const meta=element("div","candidate-meta");
      meta.append(element("span","candidate-tag","未核对的日期线索"),
        element("span","",c.date.replace(/-/g,".")+(c.time?" "+c.time+" SGT":"")));
      info.append(meta,officialLink(c.title,c.officialUrl,"candidate-title"));
      if(c.context)info.append(element("p","candidate-context",c.context));
      const actions=element("div","candidate-actions");
      actions.append(officialLink("读原文 ↗",c.officialUrl,""));
      const add=element("button","task-link-button","核对并跟踪");
      add.type="button";
      add.addEventListener("click",()=>openDialog({noticeId:c.noticeId,date:c.date,time:c.time}));
      actions.append(add);
      row.append(info,actions);
      area.append(row);
    }
  }
  function render(){
    countSummary();renderToday();renderProgress();renderCandidates();
    $("exportTaskCalendar").disabled=!tasks.length;
    $("exportTaskCalendar").title=tasks.length?"下载一次性 .ics 文件（非自动订阅）":"先核对日期并添加任务";
  }
  function openDialog({noticeId=null,date="",time=""}={}){
    const select=$("taskNoticeSelect");select.replaceChildren();
    if(!notices.length){
      const option=element("option","","没有可用的官方公告");
      option.value="";select.append(option);
      $("taskFormError").textContent="尚未加载可跟踪的官方通知，稍后再试。";
    }else $("taskFormError").textContent="";
    for(const item of notices){
      const option=element("option","",item.title);
      option.value=item.id;
      select.append(option);
    }
    if(noticeId&&notices.some(x=>x.id===noticeId))select.value=noticeId;
    $("taskDueDate").value=date;
    $("taskDueTime").value=time;
    $("taskNotes").value="";
    $("taskVerified").checked=false;
    $("taskDialog").showModal();
  }
  function newTaskFromForm(event){
    event.preventDefault();
    const source=notices.find(n=>n.id===$("taskNoticeSelect").value);
    const date=$("taskDueDate").value;
    const time=$("taskDueTime").value;
    if(!source){$("taskFormError").textContent="请先选择一条官方通知。";return;}
    if(Core.dateOrdinal(date)===null||!Core.validTime(time)){
      $("taskFormError").textContent="请填写有效的日期与时间。";return;
    }
    if(!$("taskVerified").checked){
      $("taskFormError").textContent="请阅读学校原文并确认已核对截止日期。";return;
    }
    const published=Core.dateOrdinal(source.published_at)!==null?source.published_at:Core.sgtToday();
    if(Core.dateOrdinal(date)<Core.dateOrdinal(published)){
      $("taskFormError").textContent="截止日期早于公告发布日期，请核对时间是否正确。";return;
    }
    const newTask={
      id:"task_"+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,""):Math.random().toString(36).slice(2)),
      noticeId:source.id,title:String(source.title).slice(0,220),
      officialUrl:source.url,sourceId:source.source_id||"",
      publishedAt:published,deadlineDate:date,deadlineTime:time,
      notes:$("taskNotes").value.trim().slice(0,300),
      status:"todo",createdAt:new Date().toISOString(),confirmedAt:new Date().toISOString(),completedAt:null
    };
    if(!Core.validateTask(newTask)){
      $("taskFormError").textContent="任务数据无法通过校验，请刷新后重试。";return;
    }
    if(saveTasks([...tasks,newTask])){
      $("taskDialog").close();
      // Keep user's location within the task board.
      document.querySelector("#progressList")?.scrollIntoView({behavior:"smooth",block:"start"});
    }
  }
  function exportICS(){
    if(!tasks.length)return;
    const ics=Core.icsDocument(tasks);
    const blob=new Blob([ics],{type:"text/calendar;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=element("a","");
    a.href=url;a.download="campus-agent-deadlines-"+Core.sgtToday()+".ics";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function bind(){
    $("newProgressTask").addEventListener("click",()=>openDialog());
    $("closeTaskDialog").addEventListener("click",()=>$("taskDialog").close());
    $("cancelTask").addEventListener("click",()=>$("taskDialog").close());
    $("taskForm").addEventListener("submit",newTaskFromForm);
    $("exportTaskCalendar").addEventListener("click",exportICS);
  }
  bind();
  render();
  window.addEventListener("focus",render);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)render();});
  window.CampusTaskBoard={
    setNotices(rows){notices=Array.isArray(rows)?rows.filter(x=>x?.id&&x?.title&&x?.url):[];render();},
    render,openDialog,
    count(){return tasks.length;}
  };
})();
