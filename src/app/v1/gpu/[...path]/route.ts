import{proxyGpuRegistry}from'@/lib/gpuRegistryProxy';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{path:string[]}>}){return proxyGpuRegistry(request,(await context.params).path,true)}
