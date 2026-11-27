const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const Core=require('../public/taskboard-core.js');
const Display=require('../public/display-date.js');
const {filesBelow}=require('../scripts/check-site-design.cjs');
const routes=filesBelow('dist').filter(file=>file.endsWith('.html')).map(file=>'/'+file.slice(5).replace(/index\.html$/,''));
const today=Core.sgtToday(),deadline=Core.addDays(today,2),start=Core.addDays(today,-3);
const source='https://ai.zju.edu.cn/2026/1020/c90497a3216866/page.htm';
const payload={version:2,checked_at:'2026-12-31T16:00:00Z',errors:[],sources:[{id:'zju-ai-admissions',name:'浙江大学人工智能学院 · 招生通知',status:'ok',count:1,url:'https://ai.zju.edu.cn/zstz/list1.htm'}],notices:[{id:'standards-notice',title:'浙江大学人工智能学院2027年博士研究生招生简章',url:source,department:'人工智能学院',department_id:'zju-ai',school:'浙江大学',category:'博士招生',topics:['admissions'],source_id:'zju-ai-admissions',published_at:start,excerpt:'博士招生条件与申请办法以官方原文为准。',date_candidates:[{value:deadline+'T20:00',context:'申请日期线索，需要本人核对学校官方通知。',verified:false}]}]};
async function audit(page){
  const result=await page.evaluate(()=>{
    const luminance=rgb=>{const a=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};
    const contrastErrors=[];
    for(const el of document.querySelectorAll('.page-desc,.eyebrow,.notice-meta,.task-footnote,.progress-span,.source-info small,.source-disclaimer,.privacy-caption,.footer,.breadcrumb,.result-count,.task-eyebrow,.candidate-context')){
      if(!el.getBoundingClientRect().height||el.closest('[hidden],dialog:not([open])')||!el.textContent.trim())continue;
      const fg=luminance(getComputedStyle(el).color),bg=luminance('rgb(250, 250, 248)');
      if((Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)<4.5)contrastErrors.push({class:el.className,color:getComputedStyle(el).color});
    }
    const root=getComputedStyle(document.documentElement),body=getComputedStyle(document.body),errors=contrastErrors;
    const sizeNames=['meta','caption','body','lead','section','subtitle','dialog','title','title-mobile'];
    const allowed=sizeNames.map(name=>parseFloat(root.getPropertyValue('--text-'+name))*parseFloat(root.fontSize));
    const families=['--font-body','--font-heading'].map(name=>{const e=document.createElement('span');e.style.fontFamily=`var(${name})`;document.body.append(e);const v=getComputedStyle(e).fontFamily;e.remove();return v;});
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let text;
    while((text=walker.nextNode())){
      const el=text.parentElement;
      if(!text.textContent.trim()||!el||el.closest('script,style,[hidden],dialog:not([open]),option'))continue;
      const style=getComputedStyle(el),box=el.getBoundingClientRect();
      if(!box.width||!box.height||style.visibility!=='visible'||style.fontSize==='0px')continue;
      if(parseFloat(style.fontSize)<11.99)errors.push({kind:'readability',tag:el.tagName,size:style.fontSize});
      const sample={tag:el.tagName,class:el.className,text:text.textContent.trim().slice(0,70),size:style.fontSize,leading:style.lineHeight,weight:style.fontWeight};
      if(!families.includes(style.fontFamily)||!allowed.some(size=>Math.abs(size-parseFloat(style.fontSize))<.1)||!['400','500','600','700','800'].includes(style.fontWeight))errors.push({kind:'type',...sample});
      const leading=parseFloat(style.lineHeight)/parseFloat(style.fontSize);
      if(![1.2,1.35,1.5,1.65,1.8].some(value=>Math.abs(value-leading)<.025))errors.push({kind:'leading',...sample});
      const range=document.createRange();range.selectNodeContents(text);
      for(let parent=el;parent&&parent!==document.body;parent=parent.parentElement){
        const css=getComputedStyle(parent),rect=parent.getBoundingClientRect();
        if(['auto','scroll'].includes(css.overflowX)||['auto','scroll'].includes(css.overflowY))break;
        const clipX=['hidden','clip'].includes(css.overflowX),clipY=['hidden','clip'].includes(css.overflowY);
        if([...range.getClientRects()].some(r=>(clipX&&(r.left<rect.left-2||r.right>rect.right+2))||(clipY&&(r.top<rect.top-2||r.bottom>rect.bottom+2)))){errors.push({kind:'clip',...sample});break;}
      }
    }
    for(const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea')){
      if(el.closest('[hidden],dialog:not([open])')||!el.getBoundingClientRect().width)continue;
      const style=getComputedStyle(el);if(parseFloat(style.fontSize)<13.99||!allowed.some(size=>Math.abs(size-parseFloat(style.fontSize))<.1)||!families.includes(style.fontFamily))errors.push({kind:'control',id:el.id,size:style.fontSize,font:style.fontFamily});
    }
    return {version:root.getPropertyValue('--campus-design-version').trim(),body:{size:body.fontSize,line:body.lineHeight},overflow:document.documentElement.scrollWidth-innerWidth,errors};
  });
  expect(result.version).toBe('1');expect(result.body.size).toBe('16px');expect(parseFloat(result.body.line)).toBeCloseTo(26.4,1);expect(result.overflow).toBeLessThanOrEqual(1);expect(result.errors).toEqual([]);return result;
}
async function perturb(page,selector,token,value,property){
  const result=await page.evaluate(async({selector,token,value,property})=>{
    const el=document.querySelector(selector),root=document.documentElement;
    if(!el)throw Error('Missing consumer '+selector);
    const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const before=getComputedStyle(el)[property],beforeWidth=el.getBoundingClientRect().width,old=root.style.getPropertyValue(token);
    root.style.setProperty(token,value);await settle();
    const after=getComputedStyle(el)[property],afterWidth=el.getBoundingClientRect().width;
    if(old)root.style.setProperty(token,old);else root.style.removeProperty(token);await settle();
    return {selector,token,property,before,after,restored:getComputedStyle(el)[property],beforeWidth,afterWidth,restoredWidth:el.getBoundingClientRect().width};
  },{selector,token,value,property});
  expect(result.after,JSON.stringify(result)).not.toBe(result.before);expect(result.restored).toBe(result.before);
  if(property==='maxWidth'){expect(Math.abs(result.afterWidth-result.beforeWidth)).toBeGreaterThan(.5);expect(result.restoredWidth).toBeCloseTo(result.beforeWidth,1);}
  return result;
}
for(const width of [1440,440,390])test.describe(width+'px device',()=>{
  test.use({viewport:{width,height:width===1440?900:956},deviceScaleFactor:width===1440?1:3,isMobile:width!==1440,hasTouch:width!==1440});
  for(const route of routes)test(`${route} ${width}px: all views and dialogs share real design and date consumers`,async({page},info)=>{
  test.setTimeout(90000);await page.setViewportSize({width,height:width===1440?900:956});await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/mykcs/campus-agent-data/main/data/notices.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload),headers:{'access-control-allow-origin':'*'}}));
  await page.goto(route);
  if(route==='/agent/'){
    await expect(page.locator('#copy-context')).toBeEnabled();
    const expected=['llms.txt','agent/SKILL.md'].map(name=>fs.readFileSync('dist/'+name,'utf8').trimEnd()).join('\n\n---\n\n')+'\n';
    await expect(page.locator('#reader-context')).toHaveValue(expected);
    const measurement=await audit(page),probes=[];
    probes.push(await perturb(page,'.agent-reader h1',width<=700?'--text-title-mobile':'--text-title','31px','fontSize'));
    probes.push(await perturb(page,'.agent-reader h2','--text-section','23px','fontSize'));
    probes.push(await perturb(page,'.agent-reader','--space-unit','.3rem','gap'));
    await page.screenshot({path:info.outputPath('agent-reader.png'),fullPage:true});
    expect(errors).toEqual([]);
    await info.attach('actual-design-consumers',{contentType:'application/json',body:Buffer.from(JSON.stringify({route,width,measurement,probes},null,2))});
    return;
  }
  await expect(page.locator('#resultCount')).toHaveText('1 条');
  await expect(page.locator('.notice-meta')).toContainText(Display.calendar(start));
  await expect(page.locator('#dataAsOf')).toContainText('SGT 2027年1月1日 00:00:00 (UTC+8)');
  await expect(page.locator('#syncTime')).toBeVisible();
  await expect(page.locator('#syncTime')).toContainText('PT 2026年12月31日 08:00:00 (UTC-8)');
  await expect(page.locator('#syncTime')).toContainText('SGT 2027年1月1日 00:00:00 (UTC+8)');
  await expect(page.locator('#syncTime')).toHaveAttribute('datetime',payload.checked_at);
  await expect(page.locator('#syncStatus')).not.toHaveText('公开数据已更新');
  await expect(page.locator('.notice-main-link')).toHaveAttribute('href',source);
  const states=[],probes=[];
  // All navigation controls stay inside the screen; the active view is exposed to assistive tech.
  const navigation=await page.locator('.side-nav').evaluate(nav=>({
    viewport:innerWidth, scrollWidth:nav.scrollWidth, clientWidth:nav.clientWidth,
    items:[...nav.querySelectorAll('button')].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))
  }));
  expect(navigation.scrollWidth).toBeLessThanOrEqual(navigation.clientWidth+1);
  for(const item of navigation.items){expect(item.left).toBeGreaterThanOrEqual(0);expect(item.right).toBeLessThanOrEqual(width+1);if(width<=700)expect(item.height).toBeGreaterThanOrEqual(44);}
  await expect(page.locator('[data-view="feed"]')).toHaveAttribute('aria-current','page');
  await page.locator('[data-view="progress"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#progressView')).toBeVisible();
  await expect(page.locator('[data-view="progress"]')).toHaveAttribute('aria-current','page');
  await page.locator('[data-view="feed"]').click();
  for(const view of ['feed','progress','sources','ask']){
    await page.locator(`[data-view="${view}"]`).click();
    await expect(page.locator('[data-view="'+view+'"]')).toHaveAttribute('aria-current','page');
    states.push({name:view,measurement:await audit(page)});
    probes.push(await perturb(page,'.view:not([hidden]) h1',width<=700?'--text-title-mobile':'--text-title','31px','fontSize'));
    probes.push(await perturb(page,'.view:not([hidden]) .page-desc','--text-caption','17px','fontSize'));
    await page.screenshot({path:info.outputPath(view+'.png'),fullPage:true});
  }
  probes.push(await perturb(page,'.view:not([hidden]) h1','--font-heading','monospace','fontFamily'));
  probes.push(await perturb(page,'.view:not([hidden]) h1','--weight-semibold','500','fontWeight'));
  probes.push(await perturb(page,'.view:not([hidden]) h1','--leading-heading','1.7','lineHeight'));
  probes.push(await perturb(page,'body','--font-body','monospace','fontFamily'));
  probes.push(await perturb(page,'body','--leading-body','2','lineHeight'));
  probes.push(await perturb(page,'.main','--space-unit','.3rem','paddingLeft'));
  probes.push(await perturb(page,'.main','--width-site','17rem','maxWidth'));
  await page.locator('#chatInput').fill('博士招生');await page.locator('#sendButton').click();
  await expect(page.locator('#chatLog')).toContainText('博士');states.push({name:'local-chat-response',measurement:await audit(page)});
  for(const [open,dialog,close]of [['#editTopFocus','#followDialog','#closeFollow'],['#openModelChat','#modelDialog','#closeModel']]){
    await page.locator(open).click();await expect(page.locator(dialog)).toBeVisible();
    states.push({name:dialog,measurement:await audit(page)});
    probes.push(await perturb(page,dialog,'--width-dialog','18rem','maxWidth'));
    await page.screenshot({path:info.outputPath(dialog.slice(1)+'.png'),fullPage:true});await page.locator(close).click();
  }
  await page.locator('[data-view="progress"]').click();
  await expect(page.locator('#progressCount')).toHaveText('0 项');
  await expect(page.locator('#candidateList')).toContainText(Display.calendar(deadline));
  await page.locator('#candidateList .task-link-button').first().click();await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskVerified')).not.toBeChecked();await expect(page.locator('#taskDueDate')).toHaveValue(deadline);
  probes.push(await perturb(page,'#taskDialog','--width-task-dialog','18rem','maxWidth'));
  states.push({name:'task-dialog',measurement:await audit(page)});await page.screenshot({path:info.outputPath('task-dialog.png'),fullPage:true});
  await page.locator('#taskVerified').check();await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#progressCount')).toHaveText('1 项');await expect(page.locator('#todayCount')).toHaveText('1 项');
  await expect(page.locator('.progress-span')).toContainText(Display.calendar(deadline));
  states.push({name:'confirmed-task-and-today',measurement:await audit(page)});await page.screenshot({path:info.outputPath('confirmed-task.png'),fullPage:true});
  const rawTask=await page.evaluate(()=>JSON.parse(localStorage.getItem('campus-agent:tasks:v1'))[0]);expect(rawTask.deadlineDate).toBe(deadline);expect(rawTask.status).toBe('todo');
  await page.locator('#progressList .task-status').selectOption('done');await page.reload();await expect(page.locator('#resultCount')).toHaveText('1 条');await page.locator('[data-view="progress"]').click();await expect(page.locator('#progressList')).toContainText('已完成');
  expect(errors).toEqual([]);
  await info.attach('actual-design-consumers',{contentType:'application/json',body:Buffer.from(JSON.stringify({route,width,states,probes,rawTask},null,2))});
});
});

test('compiled Astro/Tailwind home shell still works offline',async({browser,browserName})=>{
  test.skip(browserName!=='chromium','Chromium offline service-worker integration');
  const context=await browser.newContext({baseURL:'http://127.0.0.1:'+(process.env.CAMPUS_TEST_PORT||8882),serviceWorkers:'allow',viewport:{width:440,height:956},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  try{
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/mykcs/campus-agent-data/main/data/notices.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload),headers:{'access-control-allow-origin':'*'}}));
    await page.goto('/');
    await expect(page.locator('#resultCount')).toHaveText('1 条');
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cached=await page.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.startsWith('campus-agent-shell-'));if(names.length!==1)throw Error('Expected exactly one active shell cache');const cache=await caches.open(names[0]);return (await cache.keys()).map(r=>new URL(r.url).pathname)});
    expect(cached).toContain('/index.html');expect(cached.some(p=>p.startsWith('/_astro/')&&p.endsWith('.css'))).toBe(true);
    expect(cached.some(p=>p.startsWith('/api/'))).toBe(false);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#feedView')).toBeVisible();
    expect(await page.locator('.workspace').evaluate(e=>getComputedStyle(e).display)).toBe('flex');
    expect(await page.locator('.app').evaluate(e=>getComputedStyle(e).display)).toBe('block');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('[data-view="progress"]').click();
    await expect(page.locator('#progressView')).toBeVisible();
    expect(errors).toEqual([]);
  } finally{await context.close();}
});

// Cross-school fixture only: no claim of production MIT/Tsinghua ingestion.
for(const width of [1440,440])test("mixed school follows and dynamic coverage at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:956});
  const failures=[];page.on("pageerror",e=>failures.push(e.message));
  const mix={...payload,checked_at:new Date().toISOString(),
    sources:[...payload.sources,
      {id:"zju-history-aid",name:"历史学院学生资助",url:"https://ls.zju.edu.cn/65208/list.htm",status:"ok"},
      {id:"mit-oge-funding",name:"MIT graduate funding",url:"https://oge.mit.edu/funding/",status:"partial"},
      {id:"tsinghua-cs-public",name:"计算机系公开通知",url:"https://www.cs.tsinghua.edu.cn/",status:"degraded"}],
    notices:[...payload.notices,
      {id:"history-fixture",title:"历史学院助学金 fixture",school:"浙江大学",department:"历史学院",department_id:"zju-history",source_id:"zju-history-aid",url:"https://ls.zju.edu.cn/fixture.htm",topics:["scholarships"],published_at:start,date_candidates:[]},
      {id:"mit-fixture",title:"MIT funding fixture",school:"MIT",department:"Graduate education",department_id:"mit-oge",source_id:"mit-oge-funding",url:"https://oge.mit.edu/funding/fixture/",topics:["scholarships"],published_at:start,date_candidates:[]},
      {id:"thu-fixture",title:"清华奖学金 fixture",school:"清华大学",department:"计算机系",department_id:"tsinghua-cs",source_id:"tsinghua-cs-public",url:"https://www.cs.tsinghua.edu.cn/fixture.htm",topics:["scholarships"],published_at:start,date_candidates:[]},
      {id:"unsafe-fixture",title:"Unsafe fake",source_id:"mit-oge-funding",url:"https://mit.edu.invalid/fixture",topics:["scholarships"],published_at:start}]};
  await page.route("**/mykcs/campus-agent-data/main/data/notices.json*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mix),headers:{"access-control-allow-origin":"*"}}));
  await page.addInitScript(()=>{if(!localStorage.getItem("campus-agent:follows:v1"))localStorage.setItem("campus-agent:follows:v1",JSON.stringify({departments:["zju-ai"],topics:[]}));});
  await page.goto("/");
  await expect(page.locator("#resultCount")).toHaveText("1 条");
  await page.locator("#editTopFocus").click();
  await expect(page.locator('input[name="department"][value="zju-ai"]')).toBeChecked();
  await page.locator('input[name="school"][value="mit"]').check();
  await page.locator('input[name="topic"][value="scholarships"]').check();
  await page.locator("#followForm .primary-button").click();
  await expect(page.locator("#resultCount")).toHaveText("4 条");
  await expect(page.locator('.notice-main-link').filter({hasText:"MIT funding fixture"})).toHaveAttribute("href","https://oge.mit.edu/funding/fixture/");
  await expect(page.locator(".notice-row").filter({hasText:"Unsafe fake"})).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#resultCount")).toHaveText("4 条");
  await page.locator('[data-view="sources"]').click();
  await expect(page.locator(".source-row").filter({hasText:"历史学院学生资助"})).toContainText("已接入");
  await expect(page.locator(".source-row").filter({hasText:"MIT graduate funding"})).toContainText("部分覆盖");
  await expect(page.locator(".source-row").filter({hasText:"计算机系公开通知"})).toContainText("采集异常");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(failures).toEqual([]);
});

// Regression: a provider switch cannot inherit a previous provider's key.
test('BYOK key is bound to the configured endpoint',async({page})=>{
  await page.route('**/mykcs/campus-agent-data/main/data/notices.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload),headers:{'access-control-allow-origin':'*'}}));
  await page.goto('/');
  await page.locator('[data-view="ask"]').click();
  await page.locator('#openModelChat').click();
  await page.locator('#modelInput').fill('mock-model');
  await page.locator('#apiKeyInput').fill('TEST_ONLY_FAKE_KEY');
  await page.locator('#modelForm button[type="submit"]').click();
  await expect(page.locator('#modelDialog')).not.toBeVisible();
  await page.locator('#openModelChat').click();
  await page.locator('#providerSelect').selectOption('deepseek');
  await page.locator('#apiKeyInput').fill('');
  await page.locator('#modelForm button[type="submit"]').click();
  await expect(page.locator('#modelDialog')).toBeVisible();
  await expect(page.locator('#modelFeedback')).toContainText('Key');
  const saved=await page.evaluate(()=>JSON.stringify({...localStorage}));
  expect(saved).not.toContain('TEST_ONLY_FAKE_KEY');
});


for(const width of [1440,440])test("confirmed date roles, missing timezone and distinct same-day tasks "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:956});
  const mitUrl="https://oge.mit.edu/funding/fixture/";
  const thuUrl="https://www.cs.tsinghua.edu.cn/fixture.htm";
  const ev=(url,type,value,raw,scope,zone=null,resolution="explicit")=>({source_url:url,type,value,raw,scope_text:scope,timezone:zone,resolution,verified:false});
  const fixture={...payload,checked_at:new Date().toISOString(),notices:[
    {...payload.notices[0],date_events:[ev(source,"close",deadline+"T20:00",deadline,"春季申请"),ev(source,"postmark",deadline,deadline,"材料邮戳","SGT"),ev(source,"open",deadline+"T09:00",deadline,"秋季申请")]},
    {id:"mit-evidence",title:"MIT deadline fixture",school:"MIT",department:"Graduate education",department_id:"mit-oge",source_id:"mit-oge-funding",url:mitUrl,topics:["scholarships"],published_at:start,date_events:[ev(mitUrl,"close",deadline+"T20:00",deadline,"Funding",null)]},
    {id:"thu-evidence",title:"清华日期 fixture",school:"清华大学",department:"计算机系",department_id:"tsinghua-cs",source_id:"tsinghua-cs-public",url:thuUrl,topics:["admissions"],published_at:start,date_events:[ev(thuUrl,"close",null,"9月10日24:00","申请","SGT","unresolved_time")]}
  ]};
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/mykcs/campus-agent-data/main/data/notices.json*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture),headers:{"access-control-allow-origin":"*"}}));
  await page.goto("/");
  await expect(page.locator("#resultCount")).toHaveText("1 条");
  await page.locator('[data-view="progress"]').click();
  await expect(page.locator("#progressCount")).toHaveText("0 项");
  await expect(page.locator("#candidateList")).toContainText("邮戳期限");
  await expect(page.locator("#candidateList")).toContainText("9月10日24:00");
  const candidate=text=>page.locator(".candidate-row").filter({hasText:text});
  await candidate("秋季申请").locator("button").click();
  await expect(page.locator("#taskDueDate")).toHaveValue("");
  await page.locator("#cancelTask").click();
  await candidate("清华日期 fixture").locator("button").click();
  await expect(page.locator("#taskDueDate")).toHaveValue("");
  await page.locator("#cancelTask").click();
  await candidate("MIT deadline fixture").locator("button").click();
  await expect(page.locator("#taskZone")).toHaveValue("");
  await expect(page.locator("#taskVerified")).not.toBeChecked();
  await page.locator("#taskZone").selectOption("America/New_York");
  await page.locator("#taskVerified").check();
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator("#progressCount")).toHaveText("1 项");
  const mitTask=await page.evaluate(()=>JSON.parse(localStorage.getItem("campus-agent:tasks:v1"))[0]);
  expect(mitTask.deadlineTimezone).toBe("America/New_York");
  const google=new URL(await page.locator(".task-calendar-link").first().getAttribute("href"));
  expect(google.searchParams.get("ctz")).toBe("America/New_York");
  await candidate("春季申请").locator("button").click();
  await page.locator("#taskZone").selectOption("Asia/Singapore");
  await page.locator("#taskVerified").check();
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator("#progressCount")).toHaveText("2 项");
  await candidate("材料邮戳").locator("button").click();
  await expect(page.locator("#taskDueDate")).toHaveValue(deadline);
  await expect(page.locator("#taskDueTime")).toHaveValue("");
  await expect(page.locator("#taskZone")).toHaveValue("Asia/Singapore");
  await expect(page.locator("#taskVerified")).not.toBeChecked();
  await page.locator("#taskVerified").check();
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator("#progressCount")).toHaveText("3 项");
  const allTasks=await page.evaluate(()=>JSON.parse(localStorage.getItem("campus-agent:tasks:v1")));
  expect(allTasks[2].deadlineTime).toBe("");
  expect(allTasks[2].evidenceRole).toBe("postmark");
  expect(allTasks[1].evidenceRole).toBe("close");
  expect(new Set(allTasks.map(t=>t.id)).size).toBe(3);
  await page.reload();
  await page.locator('[data-view="progress"]').click();
  await expect(page.locator("#progressCount")).toHaveText("3 项");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
