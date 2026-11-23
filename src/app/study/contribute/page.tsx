'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, Puzzle, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

const scopedContributorUi=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'||['1','true'].includes(process.env.NEXT_PUBLIC_CBGPU_ACCOUNT_V2||'');
const VIOLENTMONKEY_ID = 'jinjaccalgkegednnccohejagnlnfdag';
type Browser = 'Brave' | 'Edge' | 'Chrome';
type ContributorDevice = { id: string; name: string; created_at: string; last_used_at: string | null };

function detectBrowser(): Browser {
  const agent = navigator.userAgent;
  if (agent.includes('Edg/')) return 'Edge';
  if ('brave' in navigator) return 'Brave';
  return 'Chrome';
}

function extensionDetailsUrl(browser: Browser): string {
  const scheme = browser === 'Brave' ? 'brave' : browser === 'Edge' ? 'edge' : 'chrome';
  return `${scheme}://extensions/?id=${VIOLENTMONKEY_ID}`;
}

export default function StudyContributorPage() {
  const { user, isApproved, isLoading } = useAuth();
  const owner=useRef(user?.id);owner.current=user?.id;
  const [eligibility,setEligibility]=useState<boolean|null>(null),[eligibilityMessage,setEligibilityMessage]=useState('');
  const canContribute=scopedContributorUi?eligibility===true:isApproved;
  useEffect(()=>{if(!scopedContributorUi)return;let live=true;const expected=user?.id;setEligibility(null);setEligibilityMessage('');
   const check=async()=>{if(!expected||isLoading)return;try{const {data:{session}}=await supabase.auth.getSession();if(!session||session.user.id!==expected)throw Error('CBGPU에 다시 로그인해 주세요.');const response=await fetch('/api/study/contributor/device',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});const body=await response.json();if(!live||expected!==owner.current)return;setEligibility(response.ok&&body.allowed===true);setEligibilityMessage(response.ok?'':body.message||'연결 기여 권한을 확인하지 못했어요.');}catch{if(live&&expected===owner.current){setEligibility(false);setEligibilityMessage('연결 기여 권한을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');}}};
   void check();window.addEventListener('focus',check);return()=>{live=false;window.removeEventListener('focus',check)};
  },[user?.id,isLoading]);
  const { showError, showSuccess, confirm } = useAlert();
  const [devices, setDevices] = useState<ContributorDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [waitingTooLong, setWaitingTooLong] = useState(false);
  const [browser, setBrowser] = useState<Browser>('Chrome');

  useEffect(() => { setBrowser(detectBrowser()); }, []);

  const loadDevices = async () => {
    if (!user) return;
    const expected=user.id;
    const { data, error } = await supabase.from('eduset_contributor_devices')
      .select('id, name, created_at, last_used_at').eq('user_id',expected).is('revoked_at', null).order('created_at', { ascending: false });
    if(expected!==owner.current)return;
    if (error) showError('연결 상태를 확인하지 못했어요. 잠시 후 새로고침해 주세요.');
    else setDevices(data ?? []);
    setDevicesLoading(false);
  };

  useEffect(() => { setDevices([]);setPendingDeviceId(null);setPendingSince(null);setWaitingTooLong(false);setDevicesLoading(!!user);void loadDevices(); }, [user?.id]);

  useEffect(() => {
    if (!pendingDeviceId||!user) return;const expected=user.id;
    const check = async () => {
      const { data } = await supabase.from('eduset_contributor_devices')
        .select('id, name, created_at, last_used_at').eq('user_id',user?.id||'').eq('id', pendingDeviceId).maybeSingle();
      if(expected!==owner.current)return;
      if (data?.last_used_at) {
        await loadDevices();
        setPendingDeviceId(null);
        setPendingSince(null);
        setWaitingTooLong(false);
        setShowGuide(false);
        showSuccess('자동 갱신 연결을 확인했어요.');
      } else if (pendingSince && Date.now() - pendingSince > 90_000) {
        setWaitingTooLong(true);
      }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 4000);
    return () => window.clearInterval(timer);
  }, [pendingDeviceId, pendingSince,user?.id]);

  const connectAndOpen = async () => {
    if(!canContribute||!user)return;const expected=user.id;
    // Open synchronously on the click so popup blockers do not discard the tab
    // while the connection key is being created.
    const studyTab = window.open('about:blank', '_blank');
    if (!studyTab) { showError('새 탭을 열지 못했어요. 팝업 차단을 해제하고 다시 눌러 주세요.'); return; }
    studyTab.opener = null;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if(!session||session.user.id!==expected)throw Error('CBGPU 계정이 바뀌었어요. 다시 확인해 주세요.');
      const res = await fetch('/api/study/contributor/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ name: `${browser} 사용자 스크립트` }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? '연결 키를 발급하지 못했어요. 다시 시도해 주세요.');
      if(expected!==owner.current)throw Error('CBGPU 계정이 바뀌었어요. 다시 확인해 주세요.');
      setPendingDeviceId(body.deviceId);
      setPendingSince(Date.now());
      setWaitingTooLong(false);
      studyTab.location.replace(`https://cbsh.edu-set.com/signin#cbgpu-key=${encodeURIComponent(body.deviceKey)}`);
      await loadDevices();
    } catch (error: any) {
      studyTab.close();
      showError(error.message ?? String(error));
    } finally {
      setCreating(false);
    }
  };

  const copyExtensionSettingsUrl = async () => {
    try {
      await navigator.clipboard.writeText(extensionDetailsUrl(browser));
      showSuccess(`${browser}의 Violentmonkey 상세정보 주소를 복사했어요. 새 탭 주소창에 붙여넣어 주세요.`);
    } catch {
      showError('주소를 복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.');
    }
  };

  const revoke = async (id: string) => {
    const expected=user?.id;if(!expected)return;
    if (!await confirm({ title: '브라우저 연결을 해제할까요?', message: '해제하면 이 브라우저에서는 더 이상 자동 동기화되지 않아요.', confirmLabel: '연결 해제' })) return;
    const {data:{session}}=await supabase.auth.getSession();if(expected!==owner.current||session?.user.id!==expected){showError('CBGPU 계정이 바뀌었어요. 다시 확인해 주세요.');return;}
    const { error } = await supabase.from('eduset_contributor_devices').delete().eq('user_id',expected).eq('id', id);
    if (error) showError(error.message);
    else { showSuccess('기기 연결을 해제했어요.'); await loadDevices(); }
  };

  if (isLoading) return <section className="cb-page-content mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">불러오는 중...</section>;
  if (!user) return <section className="cb-page-content mx-auto max-w-xl px-4 py-12 text-center"><p>먼저 CBGPU에 로그인해 주세요.</p></section>;

  const syncedDevices = devices.filter((device) => device.last_used_at);
  const latestSync = syncedDevices.map((device) => device.last_used_at!).sort().at(-1);
  const guideVisible = showGuide || (!devicesLoading && syncedDevices.length === 0);

  return (
    <section className="cb-page-content mx-auto max-w-xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Puzzle className="size-6 text-primary" /><h1 className="cb-page-title">자습 조회 기여자</h1></div>
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-bold text-amber-800 dark:text-amber-300">
          이 설정은 PC에서 진행해 주세요. 휴대폰에서는 설정할 수 없어요.
        </div>
        <p className="text-sm text-muted-foreground">한 번 연결하면 데스크톱 브라우저에서 자습신청 사이트에 로그인할 때 CBGPU의 연결 정보를 자동으로 갱신해요. 비밀번호는 가져오지 않아요.</p>
      </div>

      {scopedContributorUi&&<p role={eligibilityMessage?'alert':'status'} className="text-sm text-muted-foreground">{eligibilityMessage||(eligibility===null?'기여자 소속을 확인하고 있어요.':'현재 소속이 확인된 충북과학고 학생과 교사만 연결에 기여할 수 있어요. 임시 자습 이용 권한과는 별개예요.')}</p>}
      {devicesLoading ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">연결 상태 확인 중...</div>
      ) : syncedDevices.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-500" /><h2 className="font-semibold">자동 갱신이 연결돼 있어요</h2></div>
          <p className="text-sm">이제 자습 신청 사이트에 로그인하면 CBGPU의 연결 정보를 갱신해요.</p>
          <p className="text-sm text-muted-foreground">마지막 동기화: {latestSync ? new Date(latestSync).toLocaleString('ko-KR') : '확인 중'}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowGuide(true)}>다른 브라우저도 연결하기</Button>
        </div>
      )}

      {guideVisible && (
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-500" /><h2 className="font-semibold">처음 연결은 세 단계로 진행해요</h2></div>
        <div className="rounded-2xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-semibold">1. Violentmonkey 설치하고 허용하기</p>
          <p className="text-sm text-muted-foreground">아래 버튼을 누른 뒤 새 화면에서 <b>Chrome에 추가</b> 또는 <b>Brave에 추가</b>를 누르세요. 확인창이 뜨면 <b>확장 프로그램 추가</b>를 누르세요.</p>
          <Button asChild variant="outline" className="w-full gap-2">
            <a href="https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag" target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Violentmonkey 설치 페이지</a>
          </Button>
          <p className="pt-2 text-sm text-muted-foreground">설치 후 브라우저에서 사용자 스크립트 허용을 직접 켜 주세요.</p>
          <div className="flex gap-2" role="group" aria-label="사용 중인 브라우저">
            {(['Chrome', 'Brave', 'Edge'] as const).map((option) => (
              <Button key={option} type="button" size="sm" variant={browser === option ? 'default' : 'outline'} onClick={() => setBrowser(option)} className="flex-1">
                {option}
              </Button>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={copyExtensionSettingsUrl} className="w-full gap-2"><Settings className="size-4" /> 설정 화면 주소 복사</Button>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>위 버튼으로 설정 주소를 복사하세요.</li>
            <li>새 탭의 맨 위 주소창에 붙여넣고 Enter를 누르세요.</li>
            <li><b>사용자 스크립트 허용</b> 또는 <b>Allow User Scripts</b> 스위치를 켜세요.</li>
          </ol>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer underline">스위치가 안 보이나요?</summary>
            <p className="mt-2">브라우저를 최신 버전으로 업데이트해 주세요. 오래된 버전에서는 확장 프로그램 화면 오른쪽 위의 <b>개발자 모드</b>를 켜야 할 수 있어요.</p>
          </details>
        </div>
        <div className="rounded-2xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-semibold">2. CBGPU 스크립트 설치</p>
          <p className="text-sm text-muted-foreground">새 탭이 열리면 그 화면에서 <b>설치</b>를 누르세요.</p>
          <Button asChild variant="outline" className="w-full gap-2">
            <a href="/downloads/cbgpu-eduset-contributor.user.js" target="_blank" rel="noopener noreferrer"><Puzzle className="size-4" /> CBGPU 스크립트 설치</a>
          </Button>
        </div>
        <div className="rounded-2xl bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-semibold">3. 연결하고 자습신청 로그인</p>
          <p className="text-sm text-muted-foreground">버튼을 누르면 CBGPU가 자동으로 연결되고 자습 신청 사이트가 새 탭에 열려요. 평소처럼 로그인해 주세요. 키를 복사하거나 입력할 필요는 없어요.</p>
          <Button type="button" onClick={connectAndOpen} disabled={creating || !canContribute || (!!pendingDeviceId && !waitingTooLong)} className="w-full gap-2">
            <ExternalLink className="size-4" /> {creating ? '연결 중...' : '연결하고 자습신청 열기'}
          </Button>
          {pendingDeviceId && !waitingTooLong && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-3 animate-spin" /> 자습 신청 사이트의 로그인을 기다리고 있어요. 로그인을 마치면 이 화면이 자동으로 바뀌어요.</p>}
          {pendingDeviceId && waitingTooLong && (
            <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-sm">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> 아직 동기화를 확인하지 못했어요.</p>
              <p>자습신청 사이트에서 로그인을 마쳤는지 확인해 주세요. Violentmonkey의 CBGPU 스크립트 이름에 취소선이 있으면 1단계의 사용자 스크립트 허용 스위치를 다시 확인하세요.</p>
              <p>문제를 고친 뒤 자습신청 탭을 새로고침하면 다시 확인해요.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {devices.length > 0 && (
        <details className="space-y-2 rounded-2xl border border-border/60 p-4">
          <summary className="cursor-pointer text-sm font-bold">연결 관리 · {devices.length}개</summary>
          <div className="mt-3 space-y-2">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm">
              <div><p className="font-bold">{device.name}</p><p className="text-sm text-muted-foreground">마지막 동기화: {device.last_used_at ? new Date(device.last_used_at).toLocaleString('ko-KR') : '아직 없음'}</p></div>
              <Button variant="ghost" size="sm" onClick={() => revoke(device.id)}>연결 해제</Button>
            </div>
          ))}
          </div>
        </details>
      )}
      <Link href="/study" className="block text-center text-sm underline text-muted-foreground">자습신청 조회로 돌아가기</Link>
    </section>
  );
}
