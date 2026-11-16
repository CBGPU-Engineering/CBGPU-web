import {contestApiProxy} from '@/lib/contestApiProxy';
export const runtime='nodejs';
export const maxDuration=30;
type Context={params:Promise<{path?:string[]}>};
async function route(request:Request,context:Context){return contestApiProxy(request,(await context.params).path??[])}
export {route as GET,route as POST,route as DELETE,route as OPTIONS};
