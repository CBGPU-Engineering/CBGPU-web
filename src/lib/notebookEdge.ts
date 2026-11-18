import{readFileSync,lstatSync}from'node:fs';
import{timingSafeEqual}from'node:crypto';
/** Checked only for the dedicated ingress path; request headers never choose an upstream. */
export function notebookEdgeAllowed(provided:string|null){
 try{const path=process.env.CBGPU_NOTEBOOK_EDGE_KEY_FILE;if(!path?.startsWith('/')||!provided||!/^[a-f0-9]{64}$/.test(provided))return false;const stat=lstatSync(path);if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size!==64)return false;const key=readFileSync(path);return key.length===64&&timingSafeEqual(key,Buffer.from(provided))}catch{return false}
}
