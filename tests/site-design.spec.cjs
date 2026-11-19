const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const Core=require('../public/taskboard-core.js');
const Display=require('../public/display-date.js');
const {filesBelow}=require('../scripts/check-site-design.cjs');
const routes=filesBelow('public').filter(file=>file.endsWith('.html')).map(file=>'/'+file.slice(7).replace(/index\.html$/,''));
const today=Core.sgtToday(),deadline=Core.addDays(today,2),start=Core.addDays(today,-3);
const source='https://ai.zju.edu.cn/2026/1020/c90497a3216866/page.htm';
const payload={version:2,checked_at:'2026-12-31T16:00:00Z',errors:[],sources:[{id:'zju-ai-admissions',name:'浙江大学人工智能学院 · 招生通知',status:'ok',count:1,url:'https://ai.zju.edu.cn/zstz/list1.htm'}],notices:[{id:'standards-notice',title:'浙江大学人工智能学院2027年博士研究生招生简章',url:source,department:'人工智能学院',department_id:'zju-ai',school:'浙江大学',category:'博士招生',topics:['admissions'],source_id:'zju-ai-admissions',published_at:start,excerpt:'博士招生条件与申请办法以官方原文为准。',date_candidates:[{value:deadline+'T20:00',context:'申请日期线索，需要本人核对学校官方通知。',verified:false}]}]};
async function audit(page){
  const result=await page.evaluate(()=>{
    const root=getComputedStyle(document.documentElement),body=getComputedStyle(document.body),errors=[];
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
for(const route of routes)for(const width of [1440,440,390])test(`${route} ${width}px: all views and dialogs share real design and date consumers`,async({page},info)=>{
  test.setTimeout(90000);await page.setViewportSize({width,height:956});await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/mykcs/campus-agent-data/main/data/notices.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload),headers:{'access-control-allow-origin':'*'}}));
  await page.goto(route);await expect(page.locator('#resultCount')).toHaveText('1 条');
  await expect(page.locator('.notice-meta')).toContainText(Display.calendar(start));
  await expect(page.locator('#dataAsOf')).toContainText('2027年1月1日 00:00 SGT (UTC+8)');
  await expect(page.locator('.notice-main-link')).toHaveAttribute('href',source);
  const states=[],probes=[];
  for(const view of ['feed','progress','sources','ask']){
    await page.locator(`[data-view="${view}"]`).click();
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
