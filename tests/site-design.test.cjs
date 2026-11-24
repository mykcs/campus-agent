const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Display=require('../public/display-date.js');
const {styleViolations,inspectHtml}=require('../scripts/check-site-design.cjs');
test('calendar display keeps precision and the SGT year boundary without changing source dates',()=>{
  for(const zone of ['UTC','Pacific/Honolulu','Asia/Singapore']){
    process.env.TZ=zone;
    assert.equal(Display.calendar('2026-06-07'),'2026年6月7日');
    assert.equal(Display.calendar('2026-06'),'2026年6月');
    assert.equal(Display.calendar('2026'),'2026年');
    assert.equal(Display.calendar('2024-02-29'),'2024年2月29日');
    assert.equal(Display.instant('2026-12-31T16:00:00Z'),'2027年1月1日 00:00 SGT (UTC+8)');
    assert.equal(Display.instant('2026-12-31T15:59:00Z'),'2026年12月31日 23:59 SGT (UTC+8)');
  }
  for(const bad of ['2026-02-29','2026-13-01','2026-06-31','06/07/2026','',undefined])assert.equal(Display.calendar(bad),'日期待核对');
  for(const bad of ['2026-06-07','2026-06-07T01:00:00','2026-02-29T12:00:00Z','2026-06-31T00:00:00+08:00','garbage'])assert.equal(Display.instant(bad),'未确认');
  assert.equal(Display.sourceDay('2026-06-07T01:30:00Z'),'2026年6月7日');
});
test('guard rejects detached routes and raw mixed expressions while keeping the narrow accessible icon treatment',()=>{
  const html=fs.readFileSync('public/index.html','utf8'),css=fs.readFileSync('public/styles.css','utf8');
  assert.deepEqual(inspectHtml(html,css),[]);
  assert.ok(inspectHtml(html.replace('/styles.css','/isolated.css'),css).length);
  assert.ok(inspectHtml(html,':root{--campus-design-version:1}').length);
  for(const bad of ['.article{font-size:9px}','.article{line-height:1.123}','.article{padding:calc(var(--space-4) + 17px)}','.article{margin:var(--space-4) -7px}','.article{max-width:999px}','.article{font-size:0}','.article{font-size:calc(var(--text-body) + 9px)}','.article{max-width:77ch}','.article{font-size:var(--text-missing)}',':root{--text-body:8px}'])assert.ok(styleViolations(bad).length,bad);
  assert.deepEqual(styleViolations('.article{font-size:var(--text-body);padding:var(--space-16)}.ask-one{font-size:0}'),[]);
});

test('reader route shares design without loading the private application',()=>{
  const css=fs.readFileSync('public/styles.css','utf8'),html=fs.readFileSync('public/agent/index.html','utf8');
  assert.deepEqual(inspectHtml(html,css,'agent/index.html'),[]);
  assert.ok(inspectHtml(html,css).length);
  assert.ok(inspectHtml(html.replace('/agent/reader.js','/app.js'),css,'agent/index.html').length);
  assert.ok(inspectHtml(html.replace('/styles.css','/isolated.css'),css,'agent/index.html').length);
});
