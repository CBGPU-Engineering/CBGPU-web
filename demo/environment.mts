export function demoEnvironment(source: NodeJS.ProcessEnv=process.env): NodeJS.ProcessEnv {
 const port=Number(source.CBGPU_DEMO_PORT||3100),apiPort=Number(source.CBGPU_DEMO_API_PORT||54329);
 if(![port,apiPort].every(value=>Number.isInteger(value)&&value>=1024&&value<=65535)||port===apiPort)throw Error('Use distinct non-system demo ports');
 const directory=source.CBGPU_DEMO_BUILD_DIR||'.next-demo';
 if(!/^\.next-[a-z0-9-]+$/.test(directory))throw Error('Invalid demo build directory');
 const safeKeys=['PATH','HOME','USER','LANG','TMPDIR','TEMP','TMP','SYSTEMROOT','COMSPEC','USERPROFILE','LOCALAPPDATA'];
 return {...Object.fromEntries(safeKeys.filter(key=>source[key]).map(key=>[key,source[key]])),CBGPU_DEMO:'1',NEXT_PUBLIC_CBGPU_DEMO:'1',NEXT_PUBLIC_SUPABASE_URL:`http://localhost:${port}/backend`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'demo-public-key-no-real-access',NEXT_BUILD_DIR:directory,SUPABASE_INTERNAL_URL:`http://127.0.0.1:${apiPort}`,CBGPU_DEMO_API_PORT:String(apiPort),CBGPU_DEMO_PORT:String(port),SUPABASE_SERVICE_ROLE_KEY:'demo-only-not-a-real-key',EDUSET_TOKEN_SECRET:'demo-only-not-for-production',NEXT_TELEMETRY_DISABLED:'1'};
}
