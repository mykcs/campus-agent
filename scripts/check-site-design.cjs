const fs=require('node:fs'),path=require('node:path');
const filesBelow=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesBelow(path.join(dir,entry.name)):[path.join(dir,entry.name)]).sort();
function styleViolations(css){
  const errors=[];
  for(const rule of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    const selector=rule[1].trim();
    for(const match of rule[2].matchAll(/(?:^|;)\s*(font-size|font-family|font-weight|line-height|font|max-width|margin(?:-[\w]+)?|padding(?:-[\w]+)?|gap|row-gap|column-gap)\s*:\s*([^;]+)/g)){
      const [,property,raw]=match,value=raw.trim();
      const iconOnly=property==='font-size'&&value==='0'&&['.sync-indicator','.ask-one','.notice-row-actions .task-one'].includes(selector);
      const rootRelative=property==='font-size'&&value==='100%'&&selector===':root';
      if(/font|line-height/.test(property)&&!iconOnly&&!rootRelative&&!value.includes('var(--')&&value!=='inherit')errors.push(`${selector} ${property}:${value}`);
      if(/max-width|margin|padding|gap/.test(property)&&/-?[\d.]+(?:px|rem|em)\b/.test(value))errors.push(`${selector} ${property}:${value}`);
    }
  }
  return errors;
}
function inspectHtml(html,css){
  const errors=[];
  if(!/<link\b[^>]*rel="stylesheet"[^>]*href="\/styles.css"/.test(html)||!css.includes('--campus-design-version:1')||!css.includes('font-size:var(--text-body)')||!css.includes('padding:var(--space-'))errors.push('Detached shared stylesheet or actual consumer');
  if(!/<script src="\/display-date.js" defer><\/script>/.test(html))errors.push('Missing shared calendar display boundary');
  const inline=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x=>x[1]).join('\n');
  errors.push(...styleViolations(inline));
  for(const [,style]of html.matchAll(/style="([^"]+)"/g))errors.push(...styleViolations(`inline{${style}}`));
  return errors;
}
function check(){
  const css=fs.readFileSync('public/styles.css','utf8');
  const errors=styleViolations(css),htmls=filesBelow('public').filter(file=>file.endsWith('.html'));
  if(!htmls.length)throw Error('No HTML routes');
  for(const file of htmls)errors.push(...inspectHtml(fs.readFileSync(file,'utf8'),css).map(error=>file+': '+error));
  for(const file of filesBelow('public').filter(file=>file.endsWith('.css')&&file!=='public/styles.css'))errors.push(...styleViolations(fs.readFileSync(file,'utf8')).map(error=>file+': '+error));
  const app=fs.readFileSync('public/app.js','utf8'),tasks=fs.readFileSync('public/taskboard.js','utf8');
  if(!app.includes('CampusDisplay.sourceDay(value)')||!app.includes('CampusDisplay.instant(value)')||!tasks.includes('CampusDisplay.calendar'))errors.push('A visible date consumer lost the shared formatter');
  if(/toLocaleDateString|new Intl\.DateTimeFormat/.test(app+tasks))errors.push('Date display must use CampusDisplay');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(`Site design: ${htmls.length} HTML route; all source typography/spacing and calendar consumers pass.`);
}
module.exports={styleViolations,inspectHtml,filesBelow,check};
if(require.main===module)check();
