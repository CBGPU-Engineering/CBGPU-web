import {redirect} from 'next/navigation';
import {schoolAdminHref} from '@/lib/schoolAdministration';
export const metadata={title:'학교 관리자 · CBGPU',robots:{index:false,follow:false}};
/** Legacy platform URL: school administration now lives on the user-facing host. */
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{section?:string}>}){
 const {id}=await params,{section}=await searchParams;
 redirect('https://cbgpu.com'+schoolAdminHref(id,section));
}
