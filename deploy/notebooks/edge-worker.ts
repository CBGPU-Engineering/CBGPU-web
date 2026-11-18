/** Isolated notebook origin. No CBGPU login endpoint or application assets are served here. */
type Env={CBGPU_NOTEBOOK_EDGE_KEY:string};
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);if(url.hostname!=='notebooks.cbgpu.com'||!/^\/notebooks\/[a-f0-9-]{36}\//.test(url.pathname)||url.username||url.password)return new Response('Not found',{status:404});
 if(!/^[a-f0-9]{64}$/.test(env.CBGPU_NOTEBOOK_EDGE_KEY||''))return new Response('Notebook connection unavailable',{status:503});
 const headers=new Headers(request.headers);headers.delete('authorization');headers.delete('x-cbgpu-public-host');headers.delete('x-cbgpu-note-edge');headers.set('x-cbgpu-note-edge',env.CBGPU_NOTEBOOK_EDGE_KEY);
 // School nodes never receive the domain-wide CBGPU session cookie, even through this edge.
 const cookies=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith('__Secure-cbgpu-notebook=')||v.startsWith('_xsrf='));headers.delete('cookie');if(cookies.length)headers.set('cookie',cookies.join('; '));
 const target=new URL('https://cbgpu.com/__notebook_gateway'+url.pathname+url.search);
 const response=await fetch(new Request(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'}));
 // A successful WebSocket must retain its upgrade handle; headers cannot be wrapped.
 if(response.status===101)return response;
 const out=new Headers(response.headers);out.delete('x-frame-options');out.delete('access-control-allow-origin');out.delete('access-control-allow-credentials');out.set('Content-Security-Policy',"frame-ancestors https://cbgpu.com https://www.cbgpu.com https://app.cbgpu.com https://student.cbgpu.com https://researcher.cbgpu.com https://developer.cbgpu.com; base-uri 'self'; object-src 'none'");out.set('Cache-Control','private, no-store');out.set('Referrer-Policy','no-referrer');out.set('X-Robots-Tag','noindex, nofollow');out.set('X-Content-Type-Options','nosniff');
 return new Response(response.body,{status:response.status,headers:out});
}};
