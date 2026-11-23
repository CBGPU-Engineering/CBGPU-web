import {supabase} from '@/lib/supabase';
export const PRESENTATION_BUCKET='contest-presentation';
const TYPES:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
export function contestImageError(file:Pick<File,'type'|'size'>){if(!TYPES[file.type])return 'PNG, JPG, WebP 이미지를 선택해 주세요.';if(!file.size||file.size>10*1024*1024)return '내용이 있는 10MB 이하의 이미지로 올려 주세요.';return null;}
export function contestImageUrl(path:string|null|undefined){return path?supabase.storage.from(PRESENTATION_BUCKET).getPublicUrl(path).data.publicUrl:null;}
export async function uploadContestImage(file:File,userId:string){const error=contestImageError(file);if(error)throw Error(error);const path=`${userId}/${crypto.randomUUID()}.${TYPES[file.type]}`;const result=await supabase.storage.from(PRESENTATION_BUCKET).upload(path,file,{upsert:false,contentType:file.type});if(result.error)throw result.error;return {path,url:contestImageUrl(path)!};}
export async function cleanupContestImages(paths:string[]){if(!paths.length)return;try{await supabase.storage.from(PRESENTATION_BUCKET).remove(paths);}catch{/* Saved presentation assets are protected by the database. */}}

export function contestDescriptionSummary(value:string){return value.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,'').replace(/(^|\n)\s{0,3}#{1,6}\s/g,' ').replace(/[*_`~]/g,'').replace(/\s+/g,' ').trim();}
