import type{MetadataRoute}from'next';
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:'*',allow:'/',disallow:['/api/','/backend/','/auth/','/admin','/manage/','/profile','/messages','/publications','/schools','/contests','/dashboard','/deploy','/server','/notes','/latex','/study','/timetable','/meal','/wakeup','/ai']},sitemap:'https://cbgpu.com/sitemap.xml'}}
