import{notebookEdgeAllowed}from'./lib/notebookEdge';
import{trustedInternalServiceUrl}from'./lib/internalServiceUrl';
import { NextRequest, NextResponse } from 'next/server';
import {normalizeWorkspace,workspaceForHost} from './lib/workspaces';
import { WindowRateLimiter } from './lib/requestSecurity';
import{isPublicBrowsingPath}from'./lib/publicPaths';
import {scopedAccountMode} from './lib/deployAccess';
import {manufacturingStorageReadPath} from './lib/manufacturingStoragePath';
import {backendProxyTarget} from './lib/backendProxyTarget';

const publicPages = new Set(['/', '/services', '/contact', '/download', '/privacy']);
const catalogueLimits = new WindowRateLimiter(60, 60_000);
const cataloguePaths = new Set(['/api/wakeup/search', '/api/wakeup/youtube-resolve', '/api/wakeup/spotify/search']);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if(process.env.CBGPU_DEMO==='1'){
    if(!['localhost','127.0.0.1'].includes(request.headers.get('host')?.split(':')[0]||''))return new NextResponse('Local demo only',{status:403});
    if(process.env.CBGPU_DEMO_PUBLIC_ROUTES==='1'&&(path==='/api/public'||path.startsWith('/api/public/')||path==='/api/public-assets'||path.startsWith('/api/public-assets/')))return NextResponse.next();
    if(path==='/api'||path.startsWith('/api/')||path.startsWith('/backend/'))return NextResponse.rewrite(new URL(request.nextUrl.pathname+request.nextUrl.search,'http://127.0.0.1:'+Number(process.env.CBGPU_DEMO_API_PORT||54329)));
    // Loopback-only visual checks can exercise the real desktop frame as well as the app.
    const mode=request.nextUrl.searchParams.get('mode')==='researcher'?'researcher':'student',desktop=request.nextUrl.searchParams.get('demo-frame')==='web';
    const adminPreview=request.nextUrl.searchParams.get('demo-frame')==='admin'&&(path==='/admin'||path.startsWith('/admin/')); // Synthetic loopback only; production does not enter this branch.
    const h=new Headers(request.headers);h.set('x-cbgpu-public-host',adminPreview?'admin.cbgpu.com':desktop?mode+'.cbgpu.com':'app.cbgpu.com');h.set('x-cbgpu-app',adminPreview||desktop?'0':'1');h.set('x-cbgpu-path',path);h.set('x-cbgpu-mode',mode);
    const response=path==='/'?NextResponse.rewrite(new URL('/workspace'+request.nextUrl.search,request.url),{request:{headers:h}}):NextResponse.next({request:{headers:h}});
    response.headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:${Number(process.env.CBGPU_DEMO_PORT||3100)} ws://127.0.0.1:${Number(process.env.CBGPU_DEMO_PORT||3100)}; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'`);
    response.headers.set('X-Robots-Tag','noindex, nofollow');return response;
  }

  const rawHost = (request.headers.get('host')?.split(':')[0] || request.nextUrl.hostname).toLowerCase();
  const forwardedHost=request.headers.get('x-cbgpu-public-host')||'';
  const internalHost=rawHost==='localhost'||rawHost==='127.0.0.1';
  const host=internalHost&&(workspaceForHost(forwardedHost)||['cbgpu.com','app.cbgpu.com','docs.cbgpu.com','arxiv.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(forwardedHost))?forwardedHost:rawHost;
  // Untrusted notebook HTML is available ONLY through the isolated authenticated edge.
  if(host==='notebooks.cbgpu.com')return new NextResponse('Not found',{status:404});
  if(path.startsWith('/__notebook_gateway/')){
    const notebookPath=path.slice('/__notebook_gateway'.length);
    if(process.env.CBGPU_GPU_NOTEBOOKS_ENABLED!=='1'||!notebookEdgeAllowed(request.headers.get('x-cbgpu-note-edge'))||!/^\/notebooks\/[a-f0-9-]{36}\//.test(notebookPath))return new NextResponse('Not found',{status:404});
    try{const target=trustedInternalServiceUrl(process.env.CBGPU_NOTEBOOK_RELAY_URL||'http://127.0.0.1:3557',process.env.CBGPU_INTERNAL_NETWORK_MODE);target.pathname=notebookPath;target.search=request.nextUrl.search;const h=new Headers(request.headers);h.delete('x-cbgpu-note-edge');h.delete('authorization');h.set('x-cbgpu-public-host','notebooks.cbgpu.com');return NextResponse.rewrite(target,{request:{headers:h}})}catch{return new NextResponse('Notebook unavailable',{status:503})}
  }
  if(path==='/v1/gpu/relay'){
    if(process.env.CBGPU_GPU_NOTEBOOKS_ENABLED!=='1'||!['cbgpu.com','www.cbgpu.com'].includes(host))return new NextResponse('Not found',{status:404});
    try{const target=trustedInternalServiceUrl(process.env.CBGPU_NOTEBOOK_RELAY_URL||'http://127.0.0.1:3557',process.env.CBGPU_INTERNAL_NETWORK_MODE);target.pathname=path;target.search='';if(request.nextUrl.search)return new NextResponse('Invalid request',{status:400});const h=new Headers(request.headers);h.delete('cookie');h.delete('authorization');h.delete('x-cbgpu-note-edge');return NextResponse.rewrite(target,{request:{headers:h}})}catch{return new NextResponse('Notebook unavailable',{status:503})}
  }
  const manufacturingHost=['manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(host);
  if((path==='/api/public-assets'||path.startsWith('/api/public-assets/'))&&!['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com'].includes(host))return new NextResponse('Not found',{status:404});
  if(host==='admin.cbgpu.com'&&path==='/'&&['GET','HEAD'].includes(request.method)){const target=request.nextUrl.clone();target.pathname=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'?'/admin/schools':'/admin/gpu';target.search='';return NextResponse.redirect(target,307);}
  if(/^\/manage\/manufacturing(?:\/|$)/.test(path)&&!manufacturingHost&&host!=='admin.cbgpu.com'){
    const userHost=['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com'].includes(host);
    if(userHost&&['GET','HEAD'].includes(request.method)){
      const kind=path.match(/^\/manage\/manufacturing\/(print|laser)(?:\/|$)/)?.[1];
      return NextResponse.redirect(new URL(kind?'https://'+kind+'.cbgpu.com'+path:'https://manufacturing.cbgpu.com/'),307);
    }
    return new NextResponse('Not found',{status:404});
  }
  if(manufacturingHost){
    // Shared logo/theme variants are public assets, not additional portal capabilities.
    const brandAsset=['GET','HEAD'].includes(request.method)&&/^\/brand\/v1\/(?:(?:symbol|horizontal|wordmark)_(?:black|white)\.svg|app_icon_(?:dark|light)\.svg|icon_(?:dark_512|light_(?:180|192|512))\.png|symbol_(?:black|white)\.png|favicon\.ico)$/.test(path);
    const allowed=brandAsset||path==='/'||/^\/(?:manage\/manufacturing|auth|_next|img|backend)(?:\/|$)/.test(path)||path==='/api/manufacturing/access'||path==='/api/manufacturing/file-read'||path==='/api/schools/memberships'||path==='/api/schools/current-school'||path==='/api/schools/resource-contexts'||/^\/api\/schools\/schools\/[-a-zA-Z0-9_]+\/(?:life-sources|resource-access)$/.test(path)||path==='/api/auth/shared-session'||path==='/api/timetable'||/^\/api\/study\/(?:proxy|auth)(?:\/|$)/.test(path)||path==='/favicon.ico';
    if(!allowed)return new NextResponse('Not found',{status:404});
    if(path==='/')return NextResponse.redirect(new URL('https://'+host+'/manage/manufacturing'),307);
  }
  if (host !== 'admin.cbgpu.com' && (/^\/api\/admin(?:\/|$)/.test(path) || path === '/api/study/admin-token' || /^\/api\/files\/admin(?:\/|$)/.test(path))) {
    return NextResponse.json({error:'Not found'},{status:404});
  }
  if ((host === 'cbgpu.com' || host === 'www.cbgpu.com') && ['GET','HEAD'].includes(request.method)) {
    const portal = path.match(/^\/(docs|arxiv)(?:\/|$)/)?.[1];
    if (portal) {
      const target = new URL(`https://${portal}.cbgpu.com`);
      target.pathname = path.slice(portal.length + 1) || '/';
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 308);
    }
  }
  const site = host === 'docs.cbgpu.com' ? 'docs' : host === 'arxiv.cbgpu.com' ? 'arxiv' : '';
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-cbgpu-public-host',host);
  const workspace=workspaceForHost(host), app=host==='app.cbgpu.com'||((host==='cbgpu.com'||host==='www.cbgpu.com')&&request.nextUrl.searchParams.get('native')==='1');
  requestHeaders.set('x-cbgpu-workspace',workspace||'');
  requestHeaders.set('x-cbgpu-app',app?'1':'0');
  const queryMode=request.nextUrl.searchParams.get('mode'),savedMode=request.cookies.get('cbgpu-workspace')?.value;
  requestHeaders.set('x-cbgpu-mode',normalizeWorkspace(queryMode)||normalizeWorkspace(savedMode)||'student');
  requestHeaders.set('x-cbgpu-path', path);
  requestHeaders.set('x-cbgpu-site', site || (path === '/docs' || path.startsWith('/docs/') ? 'docs' : path === '/arxiv' || path.startsWith('/arxiv/') ? 'arxiv' : 'main'));
  if(path.startsWith('/backend/')){
    try{if(['GET','HEAD'].includes(request.method)&&scopedAccountMode()){const file=manufacturingStorageReadPath(path);if(file){const destination=request.nextUrl.clone();destination.protocol='http:';destination.pathname='/api/manufacturing/file-read';destination.search='';destination.searchParams.set('key',file.key);if(file.metadata)destination.searchParams.set('metadata','1');const response=NextResponse.rewrite(destination,{request:{headers:requestHeaders}});response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Robots-Tag','noindex, nofollow');return response}}}catch{return NextResponse.json({error:'File authority unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
    try{const backend=backendProxyTarget(path,request.nextUrl.search,process.env.CBGPU_BACKEND_PROXY_URL,process.env.CBGPU_INTERNAL_NETWORK_MODE);if(backend){const response=NextResponse.rewrite(backend,{request:{headers:requestHeaders}});response.headers.set('X-Robots-Tag','noindex, nofollow');if(!path.startsWith('/backend/storage/'))response.headers.set('Cache-Control','private, no-store');return response;}}
    catch{return NextResponse.json({error:'Backend connection unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
  }
  if (host !== 'admin.cbgpu.com' && (path === '/admin' || path.startsWith('/admin/'))) {
    return new NextResponse('Not found', {status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
  if ((workspace || app || host==='cbgpu.com' || host==='www.cbgpu.com') && path === '/') {
    const url=request.nextUrl.clone();url.protocol='http:';url.pathname='/workspace';
    return NextResponse.rewrite(url,{request:{headers:requestHeaders}});
  }
  if (site && (path === '/robots.txt' || path === '/sitemap.xml')) {
    const url = request.nextUrl.clone(); url.protocol = 'http:'; url.pathname = `/api/public-sites/${path === '/robots.txt' ? 'robots' : 'sitemap'}`; url.search = `?site=${site}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  const passthrough = /^\/(?:api|_next|img|auth|downloads|backend|static|portal)(?:\/|$)/.test(path) || /\.[a-zA-Z0-9]+$/.test(path);
  if (site && !passthrough) {
    if(path===`/${site}`||path.startsWith(`/${site}/`)){const response=NextResponse.next({request:{headers:requestHeaders}});if(path==='/arxiv/submit')response.headers.set('X-Robots-Tag','noindex, follow');return response;}
    // The tunnel terminates HTTPS; local rewrites must use the HTTP origin.
    const url = request.nextUrl.clone(); url.protocol = 'http:';
    if (path !== `/${site}` && !path.startsWith(`/${site}/`)) url.pathname = `/${site}${path === '/' ? '' : path}`;
    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    if (url.pathname === '/arxiv/submit') response.headers.set('X-Robots-Tag', 'noindex, follow');
    return response;
  }
  if (cataloguePaths.has(path) && request.method !== 'OPTIONS') {
    // The production server binds to loopback; Cloudflare supplies this header.
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
    if (!catalogueLimits.allow(ip)) {
      return NextResponse.json({ message: '잠시 후 다시 시도해 주세요.' }, {
        status: 429,
        headers: { 'Retry-After': '60', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      });
    }
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (/^\/api\/arxiv\/papers\/[a-f0-9-]+\/pdf$/.test(path)) { response.headers.set('X-Robots-Tag', 'index, follow'); return response; }
  if (!(process.env.NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1==='1'&&isPublicBrowsingPath(path)) && !publicPages.has(path) && path !== '/docs' && !path.startsWith('/docs/') && path !== '/arxiv' && !path.startsWith('/arxiv/') && path !== '/robots.txt' && path !== '/sitemap.xml') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  if (path === '/arxiv/submit') response.headers.set('X-Robots-Tag', 'noindex, follow');
  return response;
}

export const config = {
  matcher: ['/((?!_next/|img/|downloads/|3d-icons/|favicon.ico).*)'],
};
