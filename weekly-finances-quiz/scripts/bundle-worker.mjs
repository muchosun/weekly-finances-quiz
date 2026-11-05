import { build } from 'esbuild';
import { builtinModules } from 'node:module';
import { mkdir,readFile,writeFile } from 'node:fs/promises';

await mkdir('build',{recursive:true});
const result=await build({entryPoints:['worker.mjs'],outfile:'build/worker-bundle.mjs',bundle:true,platform:'node',target:'es2022',format:'esm',minify:true,metafile:true,alias:{'node-fetch':'./payments/worker-fetch.mjs'}});
// CJS packages require Node built-ins. Make those imports explicit for Workers.
const builtins=[...new Set(result.metafile.outputs['build/worker-bundle.mjs'].imports.filter(x=>x.kind==='require-call').map(x=>x.path))];
if(builtins.some(x=>!builtinModules.includes(x)&&!builtinModules.includes(x.replace(/^node:/,''))))throw new Error('Unexpected external require');
const imports=builtins.map((name,i)=>`import node${i} from ${JSON.stringify('node:'+name.replace(/^node:/,''))};`).join('\n');
const mapping=builtins.map((name,i)=>`${JSON.stringify(name)}:node${i}`).join(',');
const banner=`${imports}\nconst require=name=>{const modules={${mapping}};if(Object.hasOwn(modules,name))return modules[name];throw new Error('Unsupported module');};\n`;
await writeFile('build/worker-bundle.mjs',banner+await readFile('build/worker-bundle.mjs','utf8'));
await writeFile('build/worker-metafile.json',JSON.stringify(result.metafile));
console.log(JSON.stringify({bundle:'build/worker-bundle.mjs',bytes:(await readFile('build/worker-bundle.mjs')).length,builtins}));
