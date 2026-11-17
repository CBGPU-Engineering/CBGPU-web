/** Executed third-party JavaScript cannot be unloaded by removing its script tag. */
const touched=new WeakSet<Document>();
const guarded=new WeakSet<Document>();
const personal=new WeakSet<Document>();
const routes=new WeakMap<Document,string>();
export function markPersonalDocument(){if(typeof document!=='undefined')personal.add(document)}
export function adDocumentHasPersonalState(){return typeof document!=='undefined'&&personal.has(document)}
export function adDocumentHasRun(){return typeof document!=='undefined'&&touched.has(document)}
export function markAdDocument(document:Document){touched.add(document);routes.set(document,document.defaultView?.location.pathname||'')}
export function adDocumentRouteChanged(path:string){return typeof document!=='undefined'&&touched.has(document)&&routes.get(document)!==path}
export function installAdNavigationBoundary(document:Document){
 if(guarded.has(document))return;
 const view=document.defaultView;if(!view)return;guarded.add(document);
 const initial=view.location.pathname+view.location.search;
 const click=(event:MouseEvent)=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const target=event.target instanceof view.Element?event.target.closest('a[href]'):null;
  if(!(target instanceof view.HTMLAnchorElement)||target.target==='_blank'||target.hasAttribute('download'))return;
  const destination=new URL(target.href,view.location.href);
  if(destination.origin!==view.location.origin||destination.pathname+destination.search===view.location.pathname+view.location.search)return;
  // Keep SDK globals in the public document; authentication and subsequent pages start clean.
  event.preventDefault();event.stopImmediatePropagation();view.location.assign(destination.href);
 };
 const pop=()=>{if(view.location.pathname+view.location.search!==initial)view.location.reload()};
 document.addEventListener('click',click,true);view.addEventListener('popstate',pop,true);
 // Keep this guard for the document lifetime, even after the visible unit disappears.
 // Removing a DOM node cannot remove the SDK's already-installed listeners.
}
