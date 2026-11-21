/** Isolated multi-school GPU extension preview. No real environment files or services. */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {demoEnvironment} from '../demo/environment.mts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const name of fs.readdirSync(root))if((name==='.env'||name.startsWith('.env.'))&&name!=='.env.example')throw Error('Use an isolated checkout without '+name);
const env:NodeJS.ProcessEnv={...demoEnvironment({...process.env,CBGPU_DEMO_PORT:process.env.CBGPU_DEMO_PORT||'13900',CBGPU_DEMO_API_PORT:process.env.CBGPU_DEMO_API_PORT||'13901',CBGPU_DEMO_BUILD_DIR:'.next-uicheck'}),NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1:'1',CBGPU_MULTISCHOOL_V1:'1'};
const build=process.argv.includes('--build'),children:ReturnType<typeof spawn>[]=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;process.exitCode=code;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),200).unref()}
if(!build){const api=spawn(process.execPath,['demo/server.cts'],{cwd:root,env,stdio:'inherit'});children.push(api);api.on('exit',code=>stop(code??0));console.log('Synthetic multi-school preview only: http://localhost:'+env.CBGPU_DEMO_PORT)}
const next=spawn(process.execPath,['node_modules/next/dist/bin/next',build?'build':'start',...(build?[]:['--hostname','127.0.0.1','--port',env.CBGPU_DEMO_PORT!])],{cwd:root,env,stdio:'inherit'});children.push(next);next.on('exit',code=>stop(code??0));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
