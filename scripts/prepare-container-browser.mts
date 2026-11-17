/** Build-only extraction from the integrity-locked Chromium package; never downloads. */
import {readFile,mkdir,writeFile,chmod} from 'node:fs/promises';
import {brotliDecompressSync} from 'node:zlib';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output||output!=='/opt/cbgpu-browser')throw Error('Use the dedicated container browser directory');
const input=resolve('node_modules/@sparticuz/chromium/bin');
await mkdir(output,{recursive:false});
await writeFile(join(output,'chromium'),brotliDecompressSync(await readFile(join(input,'chromium.br'))));
await chmod(join(output,'chromium'),0o755);
for(const archive of ['al2023.tar.br','swiftshader.tar.br','fonts.tar.br']){
 const bytes=brotliDecompressSync(await readFile(join(input,archive)));
 const names=execFileSync('tar',['-tf','-'],{input:bytes,encoding:'utf8'}).trim().split('\n');
 if(names.some(name=>name.startsWith('/')||name.split('/').includes('..')))throw Error('Invalid packaged browser asset');
 execFileSync('tar',['-xf','-','--no-same-owner','-C',output],{input:bytes});
}

const fonts=join(output,'fonts.conf');
await writeFile(fonts,(await readFile(fonts,'utf8')).replace('<dir>/opt/fonts</dir>','<dir>/opt/cbgpu-browser/fonts</dir>'));

const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const dependency=lock.packages['node_modules/@sparticuz/chromium'];
const archiveHashes=[];
for(const name of ['chromium.br','al2023.tar.br','swiftshader.tar.br','fonts.tar.br'])archiveHashes.push({name,sha256:createHash('sha256').update(await readFile(join(input,name))).digest('hex')});
await writeFile(join(output,'wrapper-LICENSE'),await readFile(resolve('node_modules/@sparticuz/chromium/LICENSE')));
await writeFile(join(output,'asset-manifest.json'),JSON.stringify({version:1,wrapper:'@sparticuz/chromium',wrapper_version:dependency.version,package_integrity:dependency.integrity,executable_sha256:createHash('sha256').update(await readFile(join(output,'chromium'))).digest('hex'),archives:archiveHashes},null,2)+'\n');
