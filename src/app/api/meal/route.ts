import{NextRequest,NextResponse}from'next/server';
import{parseMealPage,parseNeisMeals,schoolMealTarget,validMealDate,type MealTarget}from'@/lib/schoolMeal';
import{publicSchoolText}from'@/lib/publicSchoolFetch';
import{schoolLifeAuthorityJson}from'@/lib/schoolLifeAuthority';
import{trustedInternalServiceUrl}from'@/lib/internalServiceUrl';
export const dynamic='force-dynamic';
const legacyUrl='https://school.cbe.go.kr/cbs-h/M01050705/list';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Authorization'}});
export async function GET(req:NextRequest){const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10).replaceAll('-',''),sp=req.nextUrl.searchParams,date=sp.get('date')??today,multi=process.env.CBGPU_MULTISCHOOL_V1==='1',schoolId=sp.get('school_id')??(multi?'':'cbsh');
 if(!validMealDate(date)||!/^[-A-Za-z0-9_]{1,100}$/.test(schoolId)||[...sp.keys()].some(k=>!['date','school_id'].includes(k)))return reply({error:"학교와 급식 날짜를 확인해 주세요."},400);
 let target:MealTarget={schoolId:'cbsh',provider:'SCHOOL_WEBSITE',url:legacyUrl,allowedHosts:['school.cbe.go.kr'],version:0};
 if(!multi&&schoolId!=='cbsh')return reply({meals:[],school_id:schoolId,error:'이 학교의 급식 연결을 준비하고 있어요.',code:'SCHOOL_SOURCE_NOT_CONFIGURED'},409);
 if(multi){const authorization=req.headers.get('authorization');if(!authorization||!/^Bearer [^\s,]{1,8192}$/i.test(authorization))return reply({error:"로그인 후 학교 소속을 확인해 주세요."},401);let endpoint:URL;try{endpoint=trustedInternalServiceUrl(process.env.CBGPU_SCHOOLS_API_URL||'http://127.0.0.1:3546',process.env.CBGPU_INTERNAL_NETWORK_MODE);endpoint.pathname='/v1/schools/'+encodeURIComponent(schoolId)+'/life-sources';endpoint.search='';endpoint.hash=''}catch{return reply({error:'학교 연결 설정을 확인하고 있어요.'},503)}
  let configuration:unknown;try{const response=await fetch(endpoint,{headers:{Authorization:authorization},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)return reply({error:"인증된 학교 소속과 급식 연결을 확인해 주세요.",school_id:schoolId},[401,403].includes(response.status)?response.status:503);configuration=await schoolLifeAuthorityJson(response)}catch{return reply({meals:[],date,today,school_id:schoolId,error:"학교 연결 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",code:'SCHOOL_AUTHORITY_UNAVAILABLE'},503)}
  try{target=schoolMealTarget(schoolId,configuration)}catch{return reply({meals:[],date,today,school_id:schoolId,error:'이 학교의 급식 연결을 준비하고 있어요.',code:'SCHOOL_SOURCE_NOT_CONFIGURED'},409)}
 }
 try{const url=new URL(target.url);if(target.provider==='NEIS'){url.search=new URLSearchParams({Type:'json',pIndex:'1',pSize:'100',ATPT_OFCDC_SC_CODE:target.officeCode!,SD_SCHUL_CODE:target.officialId!,MLSV_YMD:date}).toString()}else url.searchParams.set('ymd',date);const text=await publicSchoolText(url.href,target.allowedHosts),meals=target.provider==='NEIS'?parseNeisMeals(JSON.parse(text),target,date):parseMealPage(text,date);return reply({meals,date,today,school_id:schoolId,source:url.href})}catch{return reply({meals:[],date,today,school_id:schoolId,error:"급식 제공처에서 메뉴를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",code:'MEAL_PROVIDER_ERROR'},502)}
}
