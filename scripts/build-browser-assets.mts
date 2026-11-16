import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
const folder='extension/cbgpu-eduset-contributor';
for(const name of ['background','content','options']) {
 await build({entryPoints:[`${folder}/${name}.ts`],outfile:`${folder}/${name}.js`,bundle:true,format:'iife',platform:'browser',target:'es2020',legalComments:'none'});
}
const source=await readFile('extension/contributor.user.ts','utf8');
const metadata=source.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/)?.[0];
if(!metadata)throw Error('Userscript update metadata is missing');
await mkdir('public/downloads',{recursive:true});
await build({entryPoints:['extension/contributor.user.ts'],outfile:'public/downloads/cbgpu-eduset-contributor.user.js',bundle:true,format:'iife',platform:'browser',target:'es2020',legalComments:'none',banner:{js:metadata}});
console.log('Browser extension and userscript generated from TypeScript.');
