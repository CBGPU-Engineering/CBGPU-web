/** Build-only: retain the reviewed HTTP/WS entry point alongside Next's traced runtime. */
import {copyFile,cp,mkdir,readFile,lstat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {build} from 'esbuild';
const destination=resolve('.next/standalone');
if(!(await lstat(join(destination,'server.js'))).isFile())throw Error('Build the standalone Next release first');
for(const relative of ['scripts/serve.mts','src/lib/notebookUpgrade.ts','src/lib/notebookEdge.ts','src/lib/internalServiceUrl.ts','src/lib/requestSecurity.ts']){
 const source=resolve(relative);if(!(await lstat(source)).isFile())throw Error('Container server sources must be regular files');
 const target=join(destination,relative);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
}
// Next's config loader deliberately resolves these aliases dynamically, outside its standalone trace.
for(const dependency of ['webpack','@babel/runtime']){const relative='node_modules/next/dist/compiled/'+dependency;await cp(resolve(relative),join(destination,relative),{recursive:true});}
// Generated build artifact, not an independently maintained JavaScript configuration.
await build({entryPoints:[resolve('next.config.ts')],outfile:join(destination,'next.config.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',logLevel:'silent'});
const metadata=JSON.parse(await readFile(join(destination,'.next/required-server-files.json'),'utf8'));
if(metadata.config.distDir!=='.next')throw Error('Portable container expects the standard .next build directory');
console.log('Prepared traced container HTTP/WebSocket transport and generated Next configuration');
