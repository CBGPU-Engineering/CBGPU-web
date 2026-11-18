'use client';
import{useCallback,useEffect,useRef,useState}from'react';
import Link from'next/link';
import{schoolsRequest,type SchoolSummary}from'@/lib/schoolsClient';
import{Button}from'@/components/ui/button';
import{Input}from'@/components/ui/input';
import{InlineFeedback}from'@/components/ui/product-motion';
const PAGE_SIZE=30;
// Official region labels in the current NEIS directory. Selecting one is a normal directory search.
const regions=['서울특별시','부산광역시','대구광역시','인천광역시','전남광주통합특별시(광주)','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전남광주통합특별시(전남)','경상북도','경상남도','제주특별자치도'];
export default function CatalogSchoolPicker({value,onChange,initialId,disabled=false}:{value:SchoolSummary|null;onChange:(school:SchoolSummary|null)=>void;initialId?:string;disabled?:boolean}){
 const[query,setQuery]=useState(''),[items,setItems]=useState<SchoolSummary[]>([]),[total,setTotal]=useState(0),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0),inFlight=useRef<number|null>(null),select=useRef(onChange);select.current=onChange;
 const search=useCallback(async(start=0)=>{
  if(inFlight.current!==null)return;
  const request=++sequence.current;inFlight.current=request;const append=start>0;
  if(append)setLoadingMore(true);else setLoading(true);setError('');
  try{
   const result=await schoolsRequest<{items:SchoolSummary[];total:number}>('schools?'+new URLSearchParams({q:query.trim(),limit:String(PAGE_SIZE),offset:String(start)}),'GET',undefined,true);
   if(request!==sequence.current)return;
   const next=result.items.filter(s=>s.type==='HIGH_SCHOOL');
   setItems(previous=>append?[...previous,...next.filter(item=>!previous.some(old=>old.id===item.id))]:next);setTotal(result.total);setOffset(start+result.items.length);
  }catch{if(request===sequence.current){if(!append)setItems([]);setError('학교 목록을 불러오지 못했어요. 다시 불러와 주세요.');}}
  finally{if(inFlight.current===request)inFlight.current=null;if(request===sequence.current){setLoading(false);setLoadingMore(false);}}
 },[query]);
 useEffect(()=>{sequence.current++;inFlight.current=null;setItems([]);setOffset(0);setTotal(0);setLoading(true);setLoadingMore(false);const timer=setTimeout(()=>void search(),200);return()=>{clearTimeout(timer);sequence.current++;inFlight.current=null}},[search]);
 useEffect(()=>{if(!initialId)return;let live=true;void schoolsRequest<{school:SchoolSummary}>('schools/'+encodeURIComponent(initialId),'GET',undefined,true).then(result=>{if(live&&result.school.id===initialId)select.current(result.school)}).catch(()=>{if(live)setError('선택한 학교를 확인하지 못했어요. 목록에서 다시 선택해 주세요.')});return()=>{live=false}},[initialId]);
 return <section className="space-y-4" aria-label="공식 학교에서 도입 신청">
  <div><h2 className="text-xl font-semibold">학교 목록에서 우리 학교를 선택해 주세요</h2><p className="cb-school-help">검색하지 않아도 전국 학교를 둘러볼 수 있어요. 학교를 선택하면 공식 학교 정보로 운영 신청을 준비하며, 실제 관리는 담당자 승인 후 시작해요.</p></div>
  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]"><label className="cb-school-field"><span>학교 이름 또는 지역 검색</span><Input type="search" value={query} disabled={disabled} onChange={event=>setQuery(event.target.value)} placeholder="검색 없이 아래 목록에서 선택해도 돼요"/></label><label className="cb-school-field"><span>지역으로 둘러보기</span><select className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm" value={regions.includes(query)?query:''} disabled={disabled} onChange={event=>setQuery(event.target.value)}><option value="">전체 지역</option>{regions.map(region=><option key={region} value={region}>{region}</option>)}</select></label></div>
  <InlineFeedback message={error}/>{value&&<p role="status">선택한 학교: <strong>{value.official_name}</strong> · {value.region}</p>}
  <p className="cb-school-help" role="status">{loading?'학교 목록을 불러오고 있어요.':(query.trim()?'검색 결과 ':'전체 ')+total.toLocaleString()+'개 학교 · '+items.length.toLocaleString()+'개 표시'}</p>
  {!loading&&<ul className="cb-school-options">{items.map(school=><li key={school.id}>{school.status==='LISTED'||school.status==='UNCLAIMED'?<button type="button" disabled={disabled} aria-pressed={value?.id===school.id} onClick={()=>onChange(school)}><span><strong>{school.official_name}</strong><small>{school.region} · 운영 도입 신청 가능</small></span></button>:school.status==='APPROVED'?<div className="p-3"><strong>{school.official_name}</strong><p>이미 운영 중인 학교예요. 새로 만들지 않고 이 학교에 가입할 수 있어요.</p><Button asChild variant="outline"><Link href={'/schools/'+encodeURIComponent(school.id)+'/affiliation'}>이 학교 가입하기</Link></Button></div>:<p className="p-3">{school.official_name} · 현재 도입 신청을 받을 수 없어요.</p>}</li>)}</ul>}
  {!loading&&offset<total&&<Button type="button" variant="outline" className="min-h-11 w-full" disabled={disabled||loadingMore} onClick={()=>void search(offset)}>{loadingMore?'다음 학교를 불러오는 중…':'학교 더 보기'}</Button>}
  {!loading&&error&&<Button type="button" variant="outline" disabled={disabled||loadingMore} onClick={()=>void search(offset?offset:0)}>학교 목록 다시 불러오기</Button>}
  {!loading&&!items.length&&!error&&<p>일치하는 학교가 없어요. 다른 검색어를 입력하거나 전체 학교 목록으로 돌아가 보세요.</p>}
  {!loading&&query&&<Button type="button" variant="ghost" disabled={disabled} onClick={()=>setQuery('')}>전체 학교 보기</Button>}
 </section>;
}
