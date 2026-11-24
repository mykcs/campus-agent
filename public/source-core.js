/* Pure public-source presentation helpers. No network, account, or storage access. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.CampusSources=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const SCHOOLS=[
    {id:"zju",label:"浙江大学",domain:"zju.edu.cn",icon:"Z"},
    {id:"mit",label:"MIT",domain:"mit.edu",icon:"M"},
    {id:"tsinghua",label:"清华大学",domain:"tsinghua.edu.cn",icon:"T"}
  ];
  const BASE_DEPARTMENTS=[
    {id:"zju-ai",label:"人工智能学院",source:"zju-ai-admissions",desc:"学院招生公告，直接来自官网",school:"zju"},
    {id:"zju-cs",label:"计算机科学与技术学院",source:"zju-cs-search",desc:"学校公开搜索索引 · 部分覆盖",school:"zju"},
    {id:"zju-software",label:"软件学院",source:"zju-software-search",desc:"学校公开搜索索引 · 部分覆盖",school:"zju"},
    {id:"zju-mse",label:"材料科学与工程学院",source:"zju-mse-student",desc:"学院公开学生事务及奖助通知",school:"zju"}
  ];
  const BASE_SOURCES=[
    {id:"zju-ai-admissions",name:"人工智能学院 · 招生通知",url:"https://ai.zju.edu.cn/zstz/list1.htm"},
    {id:"zju-cs-search",name:"计算机学院 · 公开索引",url:"https://s2.zju.edu.cn/search/info.do?words="+encodeURIComponent("计算机科学与技术学院")},
    {id:"zju-software-search",name:"软件学院 · 公开索引",url:"https://s2.zju.edu.cn/search/info.do?words="+encodeURIComponent("软件学院")},
    {id:"zju-scholarships-search",name:"奖学金 · 校级公开搜索",url:"https://s2.zju.edu.cn/search/info.do?words="+encodeURIComponent("奖学金")},
    {id:"zju-mse-student",name:"材料学院 · 学生事务",url:"https://mse.zju.edu.cn/51031/list.htm"}
  ];
  function parseOfficial(value){
    if(typeof value!=="string")return null;
    try{
      const u=new URL(value);
      if(u.username||u.password||u.port)return null;
      const school=SCHOOLS.find(s=>u.hostname===s.domain||u.hostname.endsWith("."+s.domain));
      if(!school)return null;
      // Existing ZJU public index includes legacy HTTP links. Preserve their
      // original authority rather than silently rewriting or losing notices.
      if(u.protocol!=="https:"&&!(school.id==="zju"&&u.protocol==="http:"))return null;
      return {url:u.href,school:school.id};
    }catch{return null;}
  }
  const officialURL=value=>parseOfficial(value)?.url||null;
  const schoolForURL=value=>parseOfficial(value)?.school||null;
  function validId(id,school){
    return typeof id==="string"&&/^(zju|mit|tsinghua|thu)-[a-z0-9][a-z0-9-]{0,79}$/.test(id)&&
      (!school||(id.startsWith(school+"-")||(school==="tsinghua"&&id.startsWith("thu-"))));
  }
  function departmentId(item){
    const school=schoolForURL(item?.url);
    if(!school)return "";
    if(validId(item.department_id,school))return item.department_id;
    return item.source_id==="zju-ai-admissions"&&school==="zju"?"zju-ai":"";
  }
  function notices(snapshot){
    const rows=new Map();
    for(const item of Array.isArray(snapshot?.notices)?snapshot.notices:[]){
      if(!item||typeof item.id!=="string"||!item.id||typeof item.title!=="string"||!item.title.trim())continue;
      const ref=parseOfficial(item.url);
      if(!ref||!validId(item.source_id,ref.school))continue;
      const normalized={...item,url:ref.url,school_id:ref.school,department_id:departmentId(item)};
      const previous=rows.get(ref.url);
      if(!previous)rows.set(ref.url,normalized);
    }
    return [...rows.values()];
  }
  function sourceList(snapshot){
    const rows=new Map(BASE_SOURCES.map(s=>[s.id,{...s,school:"zju",status:"pending"}]));
    for(const source of Array.isArray(snapshot?.sources)?snapshot.sources:[]){
      const ref=parseOfficial(source?.url);
      if(!ref||!validId(source.id,ref.school))continue;
      const status=["ok","partial","error","degraded"].includes(source.status)?source.status:"pending";
      rows.set(source.id,{...source,school:ref.school,url:ref.url,status,
        name:typeof source.name==="string"&&source.name.trim()?source.name.slice(0,150):source.id});
    }
    return [...rows.values()];
  }
  function departmentList(snapshot){
    const rows=new Map(BASE_DEPARTMENTS.map(x=>[x.id,{...x}]));
    const add=(id,label,school,source)=>{
      if(!validId(id,school)||!school||typeof label!=="string"||!label.trim())return;
      if(!rows.has(id))rows.set(id,{id,label:label.slice(0,120),source,school,desc:"已收录的公开来源，范围以来源状态为准"});
    };
    for(const s of sourceList(snapshot)){
      if(s.department_id)add(s.department_id,s.department||s.name,s.school,s.id);
    }
    for(const n of notices(snapshot))add(n.department_id,n.department,n.school_id,n.source_id);
    return [...rows.values()];
  }
  function isFollowed(item,follows,topicIds){
    return (follows.schools||[]).includes(schoolForURL(item.url))||
      (follows.departments||[]).includes(departmentId(item))||
      topicIds.some(t=>(follows.topics||[]).includes(t));
  }
  function statusLabel(status){
    return ({ok:"已接入",partial:"部分覆盖",error:"采集异常",degraded:"采集异常",pending:"待接入"})[status]||"待接入";
  }
  return {SCHOOLS,BASE_DEPARTMENTS,officialURL,schoolForURL,validId,departmentId,notices,sourceList,departmentList,isFollowed,statusLabel};
});
