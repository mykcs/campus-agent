const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../public");

// The reviewed llms.txt is the one editable directory; only its explicit
// metadata is projected. Never crawl notices, app state or browser storage.
const approved = new Set([
  "https://campus-agent-sigma.vercel.app/",
  "https://campus-agent-sigma.vercel.app/agent/",
  "https://campus-agent-sigma.vercel.app/agent/site.json",
  "https://campus-agent-sigma.vercel.app/agent/SKILL.md",
  "https://github.com/mykcs/campus-agent-data",
]);
function project(markdown) {
  const blocks = markdown.trim().split(/\r?\n\r?\n/);
  assert.equal(blocks.length, 4, "unexpected directory sections");
  const title = /^# (.+)$/.exec(blocks[0]);
  const description = /^> (.+)$/.exec(blocks[1]);
  assert.ok(title && description, "directory title and description required");
  const [linkHeading, ...rows] = blocks[2].split(/\r?\n/);
  const [notesHeading, ...notes] = blocks[3].split(/\r?\n/);
  assert.equal(linkHeading, "## 入口");
  assert.equal(notesHeading, "## 阅读要点");
  const links = rows.map(row => {
    const match = /^- \[([^\]]+)\]\((https:\/\/[^\s)]+)\): (.+)$/.exec(row);
    assert.ok(match, "invalid directory link");
    const [, title, url, description] = match;
    assert.ok(approved.has(url), "unapproved directory link");
    return { title, url, description };
  });
  assert.deepEqual(new Set(links.map(link => link.url)), approved, "missing approved links");
  assert.equal(links.length, approved.size, "duplicate directory link");
  const readingNotes = notes.map(row => {
    const match = /^- (.+)$/.exec(row);
    assert.ok(match, "invalid reading note");
    return match[1];
  });
  assert.ok(readingNotes.length > 0, "reading notes required");
  return { schemaVersion: 1, title: title[1], description: description[1], links, readingNotes };
}
function render(markdown) {
  return JSON.stringify(project(markdown), null, 2) + "\n";
}
if (require.main === module) {
  const expected = render(fs.readFileSync(path.join(root, "llms.txt"), "utf8"));
  const output = path.join(root, "agent/site.json");
  if (process.argv.includes("--check")) {
    assert.equal(fs.readFileSync(output, "utf8"), expected, "run npm run agent:index to update the generated directory");
    console.log("Agent index: same-source JSON and approved link set PASS");
  } else fs.writeFileSync(output, expected);
}
module.exports = { project, render };
