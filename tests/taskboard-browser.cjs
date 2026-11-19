/* Local Chromium interaction smoke test. Run with: node tests/taskboard-browser.cjs */
const {chromium}=require("/Users/myk/node_modules/playwright");
const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const assert=require("node:assert/strict");
const Core=require("../public/taskboard-core.js");

(async()=>{
  const root=path.resolve(__dirname,"../public");
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,"http://127.0.0.1").pathname;
    const target=path.resolve(root,"."+ (pathname==="/"?"/index.html":pathname));
    if(!target.startsWith(root)){res.writeHead(403);return res.end();}
    res.setHeader("Content-Type",({".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml",".html":"text/html",".webmanifest":"application/manifest+json"}[path.extname(target)]||"text/plain"));
    fs.createReadStream(target).on("error",()=>{res.writeHead(404);res.end()}).pipe(res);
  });
  await new Promise(resolve=>server.listen(8881,"127.0.0.1",resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",args:["--no-first-run"]});
    const today=Core.sgtToday(),deadline=Core.addDays(today,2),start=Core.addDays(today,-3);
    const articleUrl="https://ai.zju.edu.cn/2026/1020/c90497a3216866/page.htm";
    const payload={
      version:2,checked_at:new Date().toISOString(),
      sources:[{id:"zju-ai-admissions",name:"浙江大学人工智能学院 · 招生通知",status:"ok",count:1,url:"https://ai.zju.edu.cn/zstz/list1.htm"}],
      errors:[],
      notices:[{id:"notice_test_1",title:"浙江大学人工智能学院2027年博士研究生招生简章",
        url:articleUrl,department:"人工智能学院",department_id:"zju-ai",school:"浙江大学",
        category:"博士招生",topics:["admissions"],source_id:"zju-ai-admissions",
        published_at:start,excerpt:"博士招生条件与申请办法以官方原文为准。",
        date_candidates:[{value:deadline+"T20:00",context:"研究生网上报名时间可能涉及的日期，仅为线索",verified:false}]}]
    };
    const errors=[];
    const page=await browser.newPage({viewport:{width:1360,height:900},acceptDownloads:true});
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/mykcs/campus-agent-data/main/data/notices.json*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload),headers:{"access-control-allow-origin":"*"}}));
    await page.goto("http://127.0.0.1:8881/");
    await page.waitForFunction(()=>document.querySelector("#resultCount")?.textContent==="1 条");
    // Notice link still points to official website, not internal page.
    assert.equal(await page.locator(".notice-main-link").first().getAttribute("href"),articleUrl);
    await page.locator('[data-view="progress"]').click();
    assert.match(await page.locator("#candidateList").innerText(),/未核对的日期线索/);
    assert.match(await page.locator("#progressList").innerText(),/还没有跟踪/);
    assert.equal(await page.locator("#progressCount").innerText(),"0 项");
    await page.locator("#candidateList .task-link-button").first().click();
    assert.equal(await page.locator("#taskDueDate").inputValue(),deadline);
    assert.equal(await page.locator("#taskVerified").isChecked(),false);
    await page.locator("#taskVerified").check();
    await page.locator("#taskForm button[type=submit]").click();
    assert.equal(await page.locator("#progressCount").innerText(),"1 项");
    assert.match(await page.locator("#progressList").innerText(),/还剩 2 天/);
    assert.equal(await page.locator("#todayCount").innerText(),"1 项");
    const task=await page.evaluate(()=>JSON.parse(localStorage.getItem("campus-agent:tasks:v1"))[0]);
    assert.equal(task.deadlineDate,deadline);
    assert.equal(task.deadlineTime,"20:00");
    assert.equal(task.status,"todo");
    // Export does not create an auto-updating subscription or leak into shared repo.
    const waitDownload=page.waitForEvent("download");
    await page.locator("#exportTaskCalendar").click();
    const download=await waitDownload;
    assert.match(download.suggestedFilename(),/campus-agent-deadlines-.+\.ics/);
    const stream=await download.createReadStream();
    let exportICS="";
    for await(const chunk of stream)exportICS+=chunk.toString();
    assert.match(exportICS,/BEGIN:VEVENT/);
    assert.match(exportICS,/DTSTART:\d{8}T120000Z/);
    assert.match(exportICS,/END:VCALENDAR/);
    const google=await page.locator(".task-calendar-link").getAttribute("href");
    assert.equal(new URL(google).hostname,"calendar.google.com");
    await page.locator("#progressList .task-status").selectOption("done");
    assert.match(await page.locator("#progressList").innerText(),/已完成/);
    await page.reload();
    await page.waitForFunction(()=>document.querySelector("#resultCount")?.textContent==="1 条");
    await page.locator('[data-view="progress"]').click();
    assert.equal(await page.locator("#progressCount").innerText(),"1 项");
    assert.match(await page.locator("#progressList").innerText(),/已完成/);
    await page.screenshot({path:"/tmp/campus-agent-progress-desktop.png",fullPage:true});
    // Mobile layout: no horizontal scroll in 390px viewport.
    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    mobile.on("pageerror",e=>errors.push("mobile: "+e.message));
    await mobile.route("**/mykcs/campus-agent-data/main/data/notices.json*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload),headers:{"access-control-allow-origin":"*"}}));
    await mobile.goto("http://127.0.0.1:8881/");
    await mobile.waitForFunction(()=>document.querySelector("#resultCount")?.textContent==="1 条");
    await mobile.locator('[data-view="progress"]').click();
    const widths=await mobile.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    if(widths.scrollWidth>widths.clientWidth){
      const offenders=await mobile.evaluate(()=>[...document.querySelectorAll("*")].map(e=>({tag:e.tagName,cls:e.className||"",id:e.id||"",left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)})).filter(e=>e.right>document.documentElement.clientWidth+2||e.left < -2).slice(0,25));
      console.log("OVERFLOW OFFENDERS",JSON.stringify(offenders));
    }
    assert.ok(widths.scrollWidth<=widths.clientWidth,JSON.stringify(widths));
    await mobile.screenshot({path:"/tmp/campus-agent-progress-mobile.png",fullPage:true});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:"PASS",tasks:1,deadline,due:"2 days",ics:"downloaded",google:"template",completion:"persists",mobile:widths,errors}));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
