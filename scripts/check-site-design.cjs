const fs=require('node:fs'),path=require('node:path');
const filesBelow=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesBelow(path.join(dir,entry.name)):[path.join(dir,entry.name)]).sort();
const sharedCss=fs.readFileSync(path.join(__dirname,'../public/styles.css'),'utf8');
const sharedTokens=new Set([...sharedCss.matchAll(/(--[\w-]+)\s*:/g)].map(match=>match[1]));
function styleViolations(css,isOwner=false){
  const errors=[];
  for(const rule of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    const selector=rule[1].trim();
    if(!isOwner&&/--(?:font|text|weight|leading|space|width|dialog-gutter)[\w-]*\s*:/.test(rule[2]))errors.push('Shared roles may only be defined by public/styles.css');
    for(const match of rule[2].matchAll(/(?:^|;)\s*(font-size|font-family|font-weight|line-height|font|max-width|margin(?:-[\w]+)?|padding(?:-[\w]+)?|gap|row-gap|column-gap)\s*:\s*([^;]+)/g)){
      const [,property,raw]=match,value=raw.trim();
      const iconOnly=property==='font-size'&&value==='0'&&['.sync-indicator','.ask-one','.notice-row-actions .task-one'].includes(selector);
      const rootRelative=property==='font-size'&&value==='100%'&&selector===':root';
      const prefix={'font-family':'font-','font-size':'text-','font-weight':'weight-','line-height':'leading-'}[property];
      const role=/^var\((--[\w-]+)\)$/.exec(value);
      if(/font|line-height/.test(property)&&!iconOnly&&!rootRelative&&value!=='inherit'&&(!prefix||!role||!role[1].startsWith('--'+prefix)||!sharedTokens.has(role[1])))errors.push(`${selector} ${property}:${value}`);
      if(/max-width|margin|padding|gap/.test(property)&&/-?[\d.]+(?:px|rem|em|ch|ex|pt|cm|mm|in)\b/.test(value))errors.push(`${selector} ${property}:${value}`);
    }
  }
  return errors;
}
function inspectHtml(html,css,route="index.html"){
  const errors=[];
  if(!/<link\b[^>]*rel="stylesheet"[^>]*href="\/styles.css"/.test(html)||!css.includes('--campus-design-version:1')||!css.includes('font-size:var(--text-body)')||!css.includes('padding:var(--space-'))errors.push('Detached shared stylesheet or actual consumer');
  const isReader=route==='agent/index.html';
  if(isReader){
    if(!/<script src="\/agent\/reader.js" defer><\/script>/.test(html)||/<script src="\/(?:app|taskboard(?:-core)?|display-date)\.js"/.test(html))errors.push('Static reader must not load private application or calendar state');
  }else if(!/<script src="\/display-date.js" defer><\/script>/.test(html))errors.push('Missing shared calendar display boundary');
  const inline=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x=>x[1]).join('\n');
  errors.push(...styleViolations(inline));
  for(const [,style]of html.matchAll(/style="([^"]+)"/g))errors.push(...styleViolations(`inline{${style}}`));
  return errors;
}
function check(){
  const css=fs.readFileSync('public/styles.css','utf8');
  const errors=styleViolations(css,true),htmls=filesBelow('dist').filter(file=>file.endsWith('.html'));
  if(!htmls.length)throw Error('No HTML routes');
  for(const file of htmls)errors.push(...inspectHtml(fs.readFileSync(file,'utf8'),css,path.relative('dist',file).split(path.sep).join('/')).map(error=>file+': '+error));
  for(const file of filesBelow('public').filter(file=>file.endsWith('.css')&&file!=='public/styles.css'))errors.push(...styleViolations(fs.readFileSync(file,'utf8')).map(error=>file+': '+error));
  const app=fs.readFileSync('public/app.js','utf8'),tasks=fs.readFileSync('public/taskboard.js','utf8');
  if(!app.includes('CampusDisplay.sourceDay(value)')||!app.includes('CampusDisplay.instant(value)')||!tasks.includes('CampusDisplay.calendar'))errors.push('A visible date consumer lost the shared formatter');
  if(/toLocaleDateString|new Intl\.DateTimeFormat/.test(app+tasks))errors.push('Date display must use CampusDisplay');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(`Site design: ${htmls.length} HTML route; all source typography/spacing and calendar consumers pass.`);
}
module.exports={styleViolations,inspectHtml,filesBelow,check};
if(require.main===module)check();
