import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
const worker = process.argv.includes('--worker');
const base=new URL('../',import.meta.url);
let html=await readFile(new URL('dist/index.html',base),'utf8');
const css=await readFile(new URL('dist/styles.css',base),'utf8');
const model=(await readFile(new URL('dist/quiz-model.mjs',base),'utf8')).replace(/^export /gm,'');
const stripImports=text=>text.replace(/^import .+ from '\.\/[^']+\.mjs';\n/gm,'');
const insightModel=stripImports(await readFile(new URL('dist/interlude-model.mjs',base),'utf8')).replace(/^export /gm,'');
const app=stripImports(await readFile(new URL('dist/app.mjs',base),'utf8'));
html=html.replace('<meta charset="UTF-8">',worker?'<meta charset="UTF-8">':'<meta charset="UTF-8">\n  <meta name="wf-static-preview" content="true">')
  .replace('<link rel="stylesheet" href="/styles.css">',()=>`<style>${css}</style>`)
  .replace('<script type="module" src="/app.mjs"></script>',()=>`<script type="module">${model}\n${insightModel}\n${app}</script>`);
for(const file of (await readdir(new URL('dist/assets/',base))).filter(file=>file.endsWith('.webp')).sort()){
  const image='data:image/webp;base64,'+(await readFile(new URL('dist/assets/'+file,base))).toString('base64');
  html=html.replaceAll('/assets/'+file,image);
}
if(worker){
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const hash=createHash('sha256').update(script).digest('base64');
  const csp=`default-src 'self'; script-src 'self' 'sha256-${hash}' https://challenges.cloudflare.com https://mc.yandex.ru; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://mc.yandex.ru https://*.yandex.ru; connect-src 'self' https://challenges.cloudflare.com https://mc.yandex.ru https://mc.yandex.com; frame-src https://challenges.cloudflare.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  await mkdir(new URL('build/',base),{recursive:true});
  await writeFile(new URL('build/site.mjs',base),`export const html=${JSON.stringify(html)};\nexport const csp=${JSON.stringify(csp)};\n`);
  console.log('Created build/site.mjs. Live Cloudflare build; server verification required.');
}else{
  const pages=process.argv.includes('--pages');
  const target=new URL(pages?'pages/index.html':'preview.html',base);
  if(pages)await mkdir(new URL('pages/',base),{recursive:true});
  await writeFile(target,html);
  if(pages)await writeFile(new URL('pages/.nojekyll',base),'');
  console.log(`Created ${pages?'pages/index.html':'preview.html'}. Explicit design preview; no CAPTCHA verification or external analytics.`);
}
