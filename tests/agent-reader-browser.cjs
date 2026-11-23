const {chromium} = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "../public");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const expected = ["llms.txt", "agent/SKILL.md"].map(name => read(name).trimEnd()).join("\n\n---\n\n") + "\n";
const types = {".html":"text/html; charset=utf-8",".css":"text/css",".js":"application/javascript",".txt":"text/plain; charset=utf-8",".md":"text/plain; charset=utf-8",".svg":"image/svg+xml"};
const csp = require("../vercel.json").headers[0].headers.find(h => h.key === "Content-Security-Policy").value;
(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = path.resolve(root, "." + url.pathname + (url.pathname.endsWith("/") ? "index.html" : ""));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end();
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.setHeader("Content-Security-Policy", csp);
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {})});
    for (const [label, viewport, mobile] of [["desktop",{width:1440,height:900},false],["phone",{width:440,height:956},true]]) {
      const ctx = await browser.newContext({viewport,deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile,permissions:["clipboard-read","clipboard-write"]});
      const page = await ctx.newPage();
      const errors=[],requests=[];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => requests.push(request.url()));
      await page.addInitScript(() => {localStorage.setItem("synthetic-private-task","PRIVATE_TASK_TEST");sessionStorage.setItem("synthetic-key","PRIVATE_KEY_TEST");});
      const result = await page.goto(url+"/agent/");
      assert.equal(result.status(),200);
      await page.locator("#copy-context").waitFor();
      await page.waitForFunction(()=>!document.querySelector("#copy-context").disabled);
      assert.equal(await page.locator("textarea").inputValue(), expected);
      await page.locator("#copy-context").click();
      await page.waitForFunction(()=>document.querySelector("#copy-status").textContent.includes("已复制"));
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
      assert.doesNotMatch(await page.locator("textarea").inputValue(),/PRIVATE_TASK_TEST|PRIVATE_KEY_TEST/);
      assert.ok(requests.every(x=>x.startsWith(url+"/")));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[]);
      if (process.env.READER_EVIDENCE_DIR) await page.screenshot({path:path.join(process.env.READER_EVIDENCE_DIR,label+".png"),fullPage:true});
      console.log(label+": 200, exact clipboard, private synthetic state excluded, no overflow/errors");
      await ctx.close();
    }
    const denied = await browser.newContext();
    await denied.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw Error("denied")}}}));
    const fallback = await denied.newPage();
    await fallback.goto(url+"/agent/");
    await fallback.waitForFunction(()=>!document.querySelector("#copy-context").disabled);
    await fallback.locator("#copy-context").click();
    await fallback.waitForFunction(()=>document.querySelector("#copy-status").textContent.includes("手动复制"));
    assert.equal(await fallback.locator("textarea").evaluate(el=>el.selectionEnd-el.selectionStart),expected.length);
    await denied.close();
    const off=await browser.newContext({javaScriptEnabled:false});
    const page=await off.newPage();
    await page.goto(url+"/agent/");
    assert.equal(await page.getByText("可打开上方文本文件手动复制。",{exact:true}).isVisible(),true);
    assert.equal(await page.locator("#copy-context").isVisible(),false);
    assert.equal(await page.getByRole("link",{name:"网站目录 · llms.txt"}).isVisible(),true);
    assert.equal(await page.getByRole("link",{name:"只读阅读规约 · SKILL.md"}).isVisible(),true);
    assert.equal((await page.request.get(url+"/llms.txt")).status(),200);
    assert.equal((await page.request.get(url+"/agent/SKILL.md")).status(),200);
    await off.close();
    console.log("clipboard-denied and no-JavaScript fallbacks PASS");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
