/* Display boundary only. Source metadata, confirmed dates, and ICS arithmetic stay unchanged. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.CampusDisplay=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function calendar(value){
    const raw=String(value||"");
    const match=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(raw);
    if(!match)return "日期待核对";
    const [,year,month,day]=match,y=Number(year),m=Number(month),d=Number(day);
    if(y<1||month&&(m<1||m>12))return "日期待核对";
    const leap=y%4===0&&(y%100!==0||y%400===0);
    if(day&&(d<1||d>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1]))return "日期待核对";
    return year+"年"+(month?m+"月":"")+(day?d+"日":"");
  }
  function sourceDay(value){
    const raw=String(value||"");
    return calendar(/^\d{4}-\d{2}-\d{2}T/.test(raw)?raw.slice(0,10):raw);
  }
  function instant(value){
    const raw=String(value||"");
    // Date-only values never enter Date parsing; an instant needs an explicit offset.
    if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw))return "未确认";
    if(calendar(raw.slice(0,10))==="日期待核对")return "未确认";
    const date=new Date(raw);
    if(!Number.isFinite(date.getTime()))return "未确认";
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Singapore",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).map(part=>[part.type,part.value]));
    return calendar(`${parts.year}-${parts.month}-${parts.day}`)+` ${parts.hour}:${parts.minute} SGT (UTC+8)`;
  }
  return Object.freeze({calendar,sourceDay,instant});
});
