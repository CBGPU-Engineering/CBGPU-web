/** Private fabrication capabilities must pass current identity and file policy at ingress. */
export function manufacturingStorageReadPath(path:string):{key:string;metadata:boolean}|null{
 if(path.length>8192)throw Error('Invalid storage path');
 const decoded=decodeURIComponent(path);
 const match=decoded.match(/^\/backend\/storage\/v1\/object\/(info\/)?(?:(?:authenticated|public|sign)\/)?manufacturing\/(.+)$/)||decoded.match(/^\/backend\/storage\/v1\/render\/image\/(?:(?:authenticated|public|sign)\/)?manufacturing\/(.+)$/);
 if(!match)return null;
 const key=match.length===3?match[2]:match[1];
 if(!key||key.length>2048||/[\\\u0000-\u001f\u007f]/.test(key)||key.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Invalid storage path');
 return{key,metadata:decoded.startsWith('/backend/storage/v1/object/info/')};
}
