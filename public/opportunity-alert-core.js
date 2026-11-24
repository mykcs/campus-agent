/* Pure planning only: no network, storage, permission prompts or delivery. */
(function(root,factory){
  const api=factory(typeof module==="object"&&module.exports?require("./source-core.js"):root.CampusSources);
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.CampusOpportunityAlerts=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(Sources){
  "use strict";
  const MAX_AGE_MS=6*60*60*1000;
  const time=x=>typeof x==="string"&&x.includes("T")?Date.parse(x):NaN;
  const validSnapshot=s=>s&&s.health?.status==="healthy"&&Array.isArray(s.sources)&&Array.isArray(s.notices)&&Number.isFinite(time(s.checked_at));
  const sourceMap=s=>new Map(Sources.sourceList(s).filter(x=>["ok","partial"].includes(x.status)).map(x=>[x.id,x]));
  const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  function localDay(ms, school){
    const zone=school==="mit"?"America/New_York":"Asia/Singapore";
    const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
    return p.year+"-"+p.month+"-"+p.day;
  }
  // Legacy ZJU AI parse_index obtains published_at only from an explicit
  // date in the listing row; it predates the date_inferred field.
  function explicitDate(n){
    return n.date_inferred===false||(n.date_inferred===undefined&&n.source_id==="zju-ai-admissions"&&new URL(n.url).hostname==="ai.zju.edu.cn");
  }
  function plan({previous,current,preference,seenKeys,nowMs}={}){
    const stop=reason=>({reason,events:[]});
    if(preference?.optIn!==true)return stop("not-opted-in");
    if(!validSnapshot(previous)||!validSnapshot(current))return stop("unhealthy-or-no-baseline");
    if(!Array.isArray(seenKeys)||seenKeys.some(x=>typeof x!=="string"))return stop("no-valid-durable-dedup-ledger");
    const before=time(previous.checked_at),after=time(current.checked_at);
    if(!Number.isFinite(nowMs)||after<=before||after>nowMs||nowMs-after>MAX_AGE_MS)return stop("stale-or-out-of-order");
    const oldSources=sourceMap(previous),newSources=sourceMap(current);
    const seen=new Set([...seenKeys,...Sources.notices(previous).map(n=>n.url)]);
    const follows=Object.fromEntries(["schools","departments","topics"].map(k=>[k,Array.isArray(preference[k])?preference[k].filter(x=>typeof x==="string"):[]]));
    const events=[];
    for(const n of Sources.notices(current)){
      // A newly onboarded source is a baseline, not a mass alert. Do not
      // advertise undated resources, inferred dates, or old backfill.
      if(!oldSources.has(n.source_id)||!newSources.has(n.source_id)||seen.has(n.url))continue;
      if(!day(n.published_at)||!explicitDate(n)||n.published_at<localDay(before,n.school_id)||n.published_at>localDay(after,n.school_id))continue;
      if(!Sources.isFollowed(n,follows,Array.isArray(n.topics)?n.topics:[]))continue;
      seen.add(n.url);
      events.push({key:n.url,kind:"newly-discovered-public-notice",title:n.title.trim().slice(0,180),url:n.url,school:n.school_id,published_at:n.published_at});
    }
    return {reason:"planned-not-sent",events};
  }
  return {plan};
});
