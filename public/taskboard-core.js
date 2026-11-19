/* Pure task/ICS utilities. No storage, network, or DOM dependencies. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.CampusTaskCore=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE=/^\d{2}:\d{2}$/;
  const MS_DAY=86400000;

  function dateOrdinal(value){
    if(typeof value!=="string"||!DATE_RE.test(value))return null;
    const [y,m,d]=value.split("-").map(Number);
    const t=Date.UTC(y,m-1,d);
    const check=new Date(t);
    if(check.getUTCFullYear()!==y||check.getUTCMonth()+1!==m||check.getUTCDate()!==d)return null;
    return Math.floor(t/MS_DAY);
  }
  function addDays(value,days){
    const ordinal=dateOrdinal(value);
    return ordinal===null?null:new Date((ordinal+days)*MS_DAY).toISOString().slice(0,10);
  }
  function sgtToday(now=new Date()){
    const pieces=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Singapore",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
    const obj=Object.fromEntries(pieces.map(x=>[x.type,x.value]));
    return obj.year+"-"+obj.month+"-"+obj.day;
  }
  function daysRemaining(due,today=sgtToday()){
    const a=dateOrdinal(due),b=dateOrdinal(today);
    return a===null||b===null?null:a-b;
  }
  function elapsedFraction(start,due,today=sgtToday()){
    const a=dateOrdinal(start),b=dateOrdinal(due),t=dateOrdinal(today);
    if(a===null||b===null||t===null)return 0;
    if(b<=a)return t>=b?100:0;
    return Math.max(0,Math.min(100,Math.round(((t-a)/(b-a))*100)));
  }
  function dueLabel(task,today=sgtToday()){
    if(task.status==="done")return "已完成";
    const remaining=daysRemaining(task.deadlineDate,today);
    if(remaining===null)return "日期待核实";
    if(remaining<0)return "已逾期 "+(-remaining)+" 天";
    if(remaining===0)return "今天截止";
    return "还剩 "+remaining+" 天";
  }
  function statusKind(task,today=sgtToday()){
    if(task.status==="done")return "done";
    const remaining=daysRemaining(task.deadlineDate,today);
    if(remaining===null)return "unverified";
    if(remaining<0)return "overdue";
    if(remaining===0)return "today";
    if(remaining<=7)return "soon";
    return "later";
  }
  function validTime(value){
    if(!value)return true;
    if(!TIME_RE.test(value))return false;
    const [hour,minute]=value.split(":").map(Number);
    return hour<24&&minute<60;
  }
  function validateTask(data){
    return !!data&&typeof data==="object"&&
      typeof data.id==="string"&&/^[a-z0-9_-]{6,90}$/i.test(data.id)&&
      typeof data.title==="string"&&data.title.trim().length>0&&data.title.length<=220&&
      dateOrdinal(data.deadlineDate)!==null&&
      (data.deadlineTime===undefined||validTime(data.deadlineTime))&&
      ["todo","doing","done"].includes(data.status)&&
      typeof data.officialUrl==="string"&&/^https:\/\/[^/]+/.test(data.officialUrl)&&
      dateOrdinal(data.publishedAt||data.deadlineDate)!==null;
  }
  function stamp(day,time){
    const normalized=dateOrdinal(day);
    if(normalized===null)throw Error("Invalid date");
    if(!time)return day.replace(/-/g,"");
    if(!validTime(time))throw Error("Invalid time");
    const [h,m]=time.split(":").map(Number);
    // SGT is UTC+08 all year; generate RFC5545 UTC timestamp.
    const epoch=(normalized*MS_DAY)+(h-8)*3600000+m*60000;
    const dt=new Date(epoch);
    return dt.toISOString().slice(0,19).replace(/[-:]/g,"")+"Z";
  }
  function escapeText(value){
    return String(value??"").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
  }
  function fold(line){
    // RFC5545 line folding counts UTF-8 octets, not JavaScript code units.
    const enc=new TextEncoder();
    let lines=[""],width=0;
    for(const char of line){
      const bytes=enc.encode(char).length;
      if(width+bytes>73){
        lines.push(" ");
        width=1;
      }
      lines[lines.length-1]+=char;
      width+=bytes;
    }
    return lines.join("\r\n");
  }
  function icsDocument(tasks,{now=new Date()}={}){
    const valid=tasks.filter(validateTask);
    const generated=now.toISOString().slice(0,19).replace(/[-:]/g,"")+"Z";
    const lines=[
      "BEGIN:VCALENDAR","VERSION:2.0",
      "PRODID:-//Campus Agent//Task Calendar 0.1//ZH",
      "CALSCALE:GREGORIAN","METHOD:PUBLISH",
      "X-WR-CALNAME:Campus Agent 已确认截止日"
    ];
    for(const task of valid){
      const title=escapeText("截止 · "+task.title);
      const desc=escapeText("个人已核对的日期；最终以学校官方通知为准。"+(task.officialUrl?"\n官方原文："+task.officialUrl:"")+
        (task.notes?"\n备注："+String(task.notes).slice(0,300):""));
      lines.push("BEGIN:VEVENT");
      lines.push("UID:"+task.id+"@campus-agent.local");
      lines.push("DTSTAMP:"+generated);
      if(task.deadlineTime){
        lines.push("DTSTART:"+stamp(task.deadlineDate,task.deadlineTime));
        const start=dateOrdinal(task.deadlineDate)*MS_DAY+
          (Number(task.deadlineTime.slice(0,2))-8)*3600000+Number(task.deadlineTime.slice(3))*60000;
        lines.push("DTEND:"+new Date(start+30*60000).toISOString().slice(0,19).replace(/[-:]/g,"")+"Z");
      }else{
        lines.push("DTSTART;VALUE=DATE:"+stamp(task.deadlineDate));
        lines.push("DTEND;VALUE=DATE:"+stamp(addDays(task.deadlineDate,1)));
        lines.push("TRANSP:TRANSPARENT");
      }
      lines.push("SUMMARY:"+title);
      lines.push("DESCRIPTION:"+desc);
      if(/^https:\/\/[^,;\r\n]+$/.test(task.officialUrl))lines.push("URL:"+task.officialUrl);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n")+"\r\n";
  }
  function googleCalendarUrl(task){
    if(!validateTask(task))return null;
    const from=stamp(task.deadlineDate,task.deadlineTime);
    let to;
    if(task.deadlineTime){
      const start=Date.parse(from.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,"$1-$2-$3T$4:$5:$6Z"));
      to=new Date(start+30*60000).toISOString().slice(0,19).replace(/[-:]/g,"")+"Z";
    }else to=stamp(addDays(task.deadlineDate,1));
    const url=new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action","TEMPLATE");
    url.searchParams.set("text","截止 · "+task.title);
    url.searchParams.set("dates",from+"/"+to);
    url.searchParams.set("details","Campus Agent 个人核对的截止日。请确认官方来源：\n"+task.officialUrl);
    url.searchParams.set("ctz","Asia/Singapore");
    return url.href;
  }
  function candidateDates(notices,{today=sgtToday(),limit=25}={}){
    const now=dateOrdinal(today);
    const out=[];
    const seen=new Set();
    for(const notice of notices){
      if(!Array.isArray(notice.date_candidates))continue;
      for(const hint of notice.date_candidates){
        const date=String(hint?.value||"").slice(0,10);
        const day=dateOrdinal(date);
        if(day===null||now===null||day<now||day>now+366)continue;
        const key=notice.id+"|"+date;
        if(seen.has(key))continue;
        seen.add(key);
        out.push({
          noticeId:notice.id, title:notice.title, officialUrl:notice.url,
          date, time:/T(\d{2}:\d{2})/.exec(hint.value||"")?.[1]||"",
          context:String(hint.context||"").slice(0,180),
          notice, verified:false
        });
      }
    }
    out.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
    return out.slice(0,limit);
  }
  return {dateOrdinal,addDays,sgtToday,daysRemaining,elapsedFraction,dueLabel,statusKind,validTime,validateTask,icsDocument,googleCalendarUrl,candidateDates};
});
