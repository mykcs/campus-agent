/* Pure task/ICS utilities. No storage, network, or DOM dependencies. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.CampusTaskCore=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE=/^\d{2}:\d{2}$/;
  const MS_DAY=86400000;
  const SGT="Asia/Singapore";
  const ZONES={"Asia/Singapore":"SGT · UTC+8","America/New_York":"美东 ET · America/New_York","America/Los_Angeles":"美西 PT · America/Los_Angeles","UTC":"UTC"};
  const ROLE_LABELS={open:"报名开始",close:"截止",internal:"院系内部期限",recommendation:"推荐期限",postmark:"邮戳期限",unknown:"类型待核对",legacy:"类型待核对"};
  const formats=new Map();

  function fixedOffset(zone){
    const m=/^UTC([+-])(\d{2}):(\d{2})$/.exec(zone||"");
    if(!m||+m[2]>14||+m[3]>59||(+m[2]===14&&+m[3]!==0))return null;
    return (m[1]==="-"?-1:1)*(+m[2]*60+ +m[3]);
  }
  function normalizeZone(zone){
    if(zone==="SGT")return SGT;
    return typeof zone==="string"&&(Object.hasOwn(ZONES,zone)||fixedOffset(zone)!==null)?zone:null;
  }
  function zoneLabel(zone){return ZONES[zone]||normalizeZone(zone)||"时区待核对";}
  function taskZone(task){return task.deadlineTimezone===undefined?SGT:normalizeZone(task.deadlineTimezone);}
  function civilParts(epoch,zone){
    zone=normalizeZone(zone);
    if(!zone||!Number.isFinite(epoch))return null;
    const offset=fixedOffset(zone);
    if(offset!==null){
      const dt=new Date(epoch+offset*60000);
      return dt.toISOString().slice(0,16);
    }
    let fmt=formats.get(zone);
    if(!fmt){
      fmt=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
      formats.set(zone,fmt);
    }
    const p=Object.fromEntries(fmt.formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));
    return p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute;
  }
  // Match civil time to an instant. Reject nonexistent and repeated DST
  // wall-clock times instead of choosing an undocumented earlier/later instant.
  function deadlineEpoch(day,time,zone=SGT){
    const ordinal=dateOrdinal(day);
    zone=normalizeZone(zone);
    if(ordinal===null||!time||!validTime(time)||!zone)return null;
    const [h,m]=time.split(":").map(Number), target=ordinal*MS_DAY+(h*60+m)*60000;
    const offset=fixedOffset(zone);
    if(offset!==null)return target-offset*60000;
    const offsets=new Set();
    for(const shift of [-36,-12,0,12,36]){
      const probe=target+shift*3600000;
      const wall=civilParts(probe,zone);
      offsets.add(Date.parse(wall+":00Z")-probe);
    }
    const matches=[...offsets].map(o=>target-o).filter(t=>civilParts(t,zone)===day+"T"+time);
    return matches.length===1?matches[0]:null;
  }
  function todayInZone(zone,now=new Date()){
    return civilParts(now.getTime(),zone)?.slice(0,10)||null;
  }
  function taskToday(task,now=new Date()){return todayInZone(taskZone(task),now);}
  function taskDays(task,now=new Date()){return daysRemaining(task.deadlineDate,taskToday(task,now));}
  function timedPast(task,now){
    if(!task.deadlineTime)return false;
    const epoch=deadlineEpoch(task.deadlineDate,task.deadlineTime,taskZone(task));
    return epoch!==null&&epoch<=now.getTime();
  }
  function utcStamp(epoch){return new Date(epoch).toISOString().slice(0,19).replace(/[-:]/g,"")+"Z";}

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
  function dueLabel(task,today,now=new Date()){
    if(task.status==="done")return "已完成";
    const remaining=daysRemaining(task.deadlineDate,today===undefined?taskToday(task,now):today);
    if(remaining===null)return "日期待核实";
    if(remaining<0)return "已逾期 "+(-remaining)+" 天";
    if(remaining===0)return today===undefined&&timedPast(task,now)?"已到截止时间":"今天截止";
    return "还剩 "+remaining+" 天";
  }
  function statusKind(task,today,now=new Date()){
    if(task.status==="done")return "done";
    const remaining=daysRemaining(task.deadlineDate,today===undefined?taskToday(task,now):today);
    if(remaining===null)return "unverified";
    if(remaining<0)return "overdue";
    if(remaining===0)return today===undefined&&timedPast(task,now)?"overdue":"today";
    if(remaining<=7)return "soon";
    return "later";
  }
  function validTime(value){
    if(!value)return true;
    if(typeof value!=="string"||!TIME_RE.test(value))return false;
    const [hour,minute]=value.split(":").map(Number);
    return hour<24&&minute<60;
  }
  function validateTask(data){
    return !!data&&typeof data==="object"&&
      typeof data.id==="string"&&/^[a-z0-9_-]{6,90}$/i.test(data.id)&&
      typeof data.title==="string"&&data.title.trim().length>0&&data.title.length<=220&&
      dateOrdinal(data.deadlineDate)!==null&&
      (data.deadlineTime===undefined||validTime(data.deadlineTime))&&
      taskZone(data)!==null&&(!data.deadlineTime||deadlineEpoch(data.deadlineDate,data.deadlineTime,taskZone(data))!==null)&&
      ["todo","doing","done"].includes(data.status)&&
      typeof data.officialUrl==="string"&&!/[\r\n]/.test(data.officialUrl)&&officialTaskURL(data.officialUrl)&&
      dateOrdinal(data.publishedAt||data.deadlineDate)!==null;
  }
  function officialTaskURL(value){
    try{
      const u=new URL(value),host=u.hostname;
      const zju=host==="zju.edu.cn"||host.endsWith(".zju.edu.cn");
      return !u.username&&!u.password&&!u.port&&
        ((u.protocol==="https:"&&(zju||host==="mit.edu"||host.endsWith(".mit.edu")||host==="tsinghua.edu.cn"||host.endsWith(".tsinghua.edu.cn")))||
        (u.protocol==="http:"&&zju));
    }catch{return false;}
  }
  function stamp(day,time,zone=SGT){
    const normalized=dateOrdinal(day);
    if(normalized===null)throw Error("Invalid date");
    if(!time)return day.replace(/-/g,"");
    if(!validTime(time))throw Error("Invalid time");
    const epoch=deadlineEpoch(day,time,zone);
    if(epoch===null)throw Error("Unresolved local deadline time");
    return utcStamp(epoch);
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
        const start=deadlineEpoch(task.deadlineDate,task.deadlineTime,taskZone(task));
        lines.push("DTSTART:"+utcStamp(start));
        lines.push("DTEND:"+utcStamp(start+30*60000));
      }else{
        lines.push("DTSTART;VALUE=DATE:"+stamp(task.deadlineDate));
        lines.push("DTEND;VALUE=DATE:"+stamp(addDays(task.deadlineDate,1)));
        lines.push("TRANSP:TRANSPARENT");
      }
      lines.push("SUMMARY:"+title);
      lines.push("DESCRIPTION:"+desc);
      if(/^https?:\/\/[^,;\r\n]+$/.test(task.officialUrl))lines.push("URL:"+task.officialUrl);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n")+"\r\n";
  }
  function googleCalendarUrl(task){
    if(!validateTask(task))return null;
    const from=stamp(task.deadlineDate,task.deadlineTime,taskZone(task));
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
    const zone=taskZone(task);
    url.searchParams.set("ctz",Object.hasOwn(ZONES,zone)?zone:"UTC");
    return url.href;
  }
  function candidateDates(notices,{today=sgtToday(),limit=25}={}){
    const now=dateOrdinal(today),out=[],seen=new Set();
    for(const notice of notices){
      if(!notice||notice.personal_list||!officialTaskURL(notice.url))continue;
      const typed=Array.isArray(notice.date_events)&&notice.date_events.length>0;
      const hints=typed?notice.date_events:notice.date_candidates;
      if(!Array.isArray(hints))continue;
      for(const hint of hints.slice(0,40)){
        if(!hint||hint.verified===true||(typed&&hint.verified!==false))continue;
        if(typed){
          try{if(new URL(hint.source_url).href!==new URL(notice.url).href)continue;}catch{continue;}
        }
        const role=typed&&Object.hasOwn(ROLE_LABELS,hint.type)?hint.type:typed?"unknown":"legacy";
        const value=typeof hint.value==="string"?hint.value:"";
        const match=/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(value);
        const date=match&&dateOrdinal(match[1])!==null&&(!match[2]||validTime(match[2]))&&(!typed||hint.resolution==="explicit")?match[1]:"";
        const time=date?(match[2]||""):"",day=dateOrdinal(date);
        if(!typed&&(day===null||now===null||day<now||day>now+366))continue;
        const scope=String(hint.scope_text||"").slice(0,120),context=String(hint.context||"").slice(0,180),raw=String(hint.raw||"").slice(0,100);
        const timezone=typed?normalizeZone(hint.timezone):null;
        // Legacy ZJU hints retain the previous SGT draft default. Other
        // sources and typed evidence without explicit zone require selection.
        const zone=timezone||(!typed&&/^https?:\/\/(?:[^/]+\.)?zju\.edu\.cn(?:\/|$)/i.test(notice.url)?SGT:"");
        const key=JSON.stringify([notice.id,role,date,time,scope,raw,context,timezone]);
        if(seen.has(key))continue;seen.add(key);
        const mayPrefill=!!date&&["close","internal","recommendation","postmark","legacy"].includes(role);
        out.push({noticeId:notice.id,title:notice.title,officialUrl:notice.url,date,time,context,scope,raw,role,roleLabel:ROLE_LABELS[role],zone,reportedTimezone:typed?String(hint.timezone||"").slice(0,40):"",resolution:typed?String(hint.resolution||"unknown"):"legacy",mayPrefill,key,typed,notice,verified:false});
      }
    }
    const rank=c=>c.date&&dateOrdinal(c.date)>=now&&c.mayPrefill?0:!c.date?1:c.date&&dateOrdinal(c.date)>=now?2:3;
    out.sort((a,b)=>rank(a)-rank(b)||a.date.localeCompare(b.date)||String(a.title).localeCompare(String(b.title)));
    return out.slice(0,limit);
  }
  return {dateOrdinal,addDays,sgtToday,daysRemaining,elapsedFraction,dueLabel,statusKind,validTime,validateTask,icsDocument,googleCalendarUrl,candidateDates,ZONES,ROLE_LABELS,normalizeZone,zoneLabel,taskZone,deadlineEpoch,todayInZone,taskToday,taskDays};
});
