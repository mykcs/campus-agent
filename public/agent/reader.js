"use strict";
const copy = document.getElementById("copy-context");
const status = document.getElementById("copy-status");
const context = document.getElementById("reader-context");
async function loadContext() {
  status.textContent = "正在读取网站目录…";
  try {
    const texts = await Promise.all(["/llms.txt", "/agent/SKILL.md"].map(async url => {
      const response = await fetch(url, { credentials: "same-origin", cache: "no-cache" });
      if (!response.ok || response.redirected) throw new Error("Reader file unavailable");
      const text = await response.text();
      if (!text.startsWith("# ")) throw new Error("Unexpected reader file");
      return text.trimEnd();
    }));
    context.value = texts.join("\n\n---\n\n") + "\n";
    status.textContent = "上下文已就绪。";
    document.getElementById("copy-tools").hidden = false;
    copy.disabled = false;
  } catch {
    status.textContent = "无法读取上下文，请打开上方文本文件手动复制。";
  }
}
copy.addEventListener("click", async () => {
  if (!context.value) return;
  try {
    await navigator.clipboard.writeText(context.value);
    status.textContent = "已复制阅读上下文。";
  } catch {
    context.focus();
    context.select();
    status.textContent = "无法访问剪贴板，已选中文本，请手动复制。";
  }
});
loadContext();
