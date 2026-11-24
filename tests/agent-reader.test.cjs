const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "../public", name), "utf8");
test("reader is discoverable and only reads approved static files", () => {
  const home = read("index.html");
  const reader = read("agent/index.html");
  const js = read("agent/reader.js");
  assert.match(home, /rel="help" href="\/agent\/"/);
  assert.match(home, /href="\/agent\/">给 Agent 读/);
  assert.match(reader, /href="\/llms\.txt"/);
  assert.match(reader, /href="\/agent\/SKILL\.md"/);
  assert.match(reader, /readonly/);
  assert.match(reader, /<noscript>/);
  assert.match(js, /\["\/llms\.txt", "\/agent\/SKILL\.md"\]/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie|\/api\//);
  assert.match(read("llms.txt"), /官方原文/);
  assert.match(read("agent/SKILL.md"), /不得推断截止日期/);
});

test("structured index is a deterministic projection of the reviewed directory", () => {
  const { project, render } = require("../scripts/generate-agent-index.cjs");
  const source = read("llms.txt");
  const index = JSON.parse(read("agent/site.json"));
  assert.equal(read("agent/site.json"), render(source));
  assert.deepEqual(Object.keys(index), ["schemaVersion", "title", "description", "links", "readingNotes"]);
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.links.length, 5);
  assert.match(read("agent/index.html"), /href="\/agent\/site\.json"/);
  assert.match(read("index.html"), /type="application\/json" href="\/agent\/site\.json"/);
  assert.throws(() => project(source.replace("https://github.com/mykcs/campus-agent-data", "https://unreviewed.example/path")));
  assert.throws(() => project(source + "\n\n## unexpected\nprivate data"));
});
