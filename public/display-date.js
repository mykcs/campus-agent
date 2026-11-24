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
  // Only complete, offset-aware timestamps have second-level precision.
  // Date-only and minute-only metadata must not be padded into an instant.
  function instant(value){
    const raw=typeof value==="string"?value:"";
    if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(raw))return "时间未确认（秒级）";
    if(calendar(raw.slice(0,10))==="日期待核对")return "时间未确认（秒级）";
    const date=new Date(raw);
    if(!Number.isFinite(date.getTime()))return "时间未确认（秒级）";
    function zone(timeZone,label){
      const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
        timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",
        hourCycle:"h23",timeZoneName:"shortOffset"
      }).formatToParts(date).map(part=>[part.type,part.value]));
      const offset=parts.timeZoneName.replace("GMT","UTC");
      return label+" "+calendar(parts.year+"-"+parts.month+"-"+parts.day)+" "+parts.hour+":"+parts.minute+":"+parts.second+" ("+offset+")";
    }
    return zone("America/Los_Angeles","PT")+" · "+zone("Asia/Singapore","SGT");
  }
  return Object.freeze({calendar,sourceDay,instant});
});
