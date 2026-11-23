'use client';
import{manufacturingManagers}from'@/lib/scopedProfiles';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useSchoolResourcePermission } from '@/components/schools/SchoolResourceScope';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PersonSearchSelect } from '@/components/manufacturing/PersonSearchSelect';
import { convertSvgToDxf, convertDwgToDxf } from '@/lib/manufacturing/convertToDxf';
import { ArrowLeft, ShieldAlert, UploadCloud, Target, X, FileBox, RefreshCw } from 'lucide-react';

type CatalogEntry = { id: string; material: 'mdf' | 'acrylic'; thickness_mm: number };
type FileEntry = { file: File; quantity: string; catalogId: string; convertedFrom?: string };

const labelCls = 'text-xs font-semibold   text-muted-foreground mb-1 block';
const cardCls = 'rounded-2xl border border-border/60 bg-card p-6 space-y-5';

export default function NewLaserJobPage() {
  const { user, isApproved, isLoading: authLoading } = useAuth();
  const fabricationPermission = useSchoolResourcePermission('fabrication', isApproved);
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [managers, setManagers] = useState<any[]>([]);
  const [managerId, setManagerId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data, error } = await supabase.from('laser_materials').select('*').order('material').order('thickness_mm');
      if (!error) setCatalog(data || []);
    };
    const fetchManagers = async () => {
      const { data, error } = await manufacturingManagers(supabase,'laser',null);
      setManagers(error?[]:data||[]);if(error)showError('담당자 목록을 확인하지 못했어요.');
    };
    fetchCatalog();
    fetchManagers();
  }, []);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    setConverting(true);
    for (const file of picked) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'dxf') {
        setFileEntries(prev => [...prev, { file, quantity: '1', catalogId: '' }]);
        continue;
      }
      if (ext === 'svg' || ext === 'dwg') {
        try {
          const converted = ext === 'svg' ? await convertSvgToDxf(file) : await convertDwgToDxf(file);
          const newName = file.name.replace(/\.[^.]+$/, '.dxf');
          const convertedFile = new File([converted], newName, { type: 'application/dxf' });
          setFileEntries(prev => [...prev, { file: convertedFile, quantity: '1', catalogId: '', convertedFrom: file.name }]);
        } catch {
          showError(`"${file.name}" 파일을 변환하지 못했어요. 손상됐거나 지원하지 않는 파일일 수 있어요.`);
        }
        continue;
      }
      showError(`"${file.name}"은(는) 지원하지 않는 형식입니다. (.dxf, .svg, .dwg만 가능)`);
    }
    setConverting(false);
  };
  const removeFile = (idx: number) => setFileEntries(prev => prev.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, patch: Partial<FileEntry>) =>
    setFileEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));

  const handleSubmit = async () => {
    if (!user) return;
    if (!await fabricationPermission.verify()) { showError(fabricationPermission.reason || '제작 장비 이용 권한을 확인해 주세요.'); return; }
    if (fileEntries.length === 0) { showError('dxf 파일을 한 개 이상 올려 주세요.'); return; }
    if (fileEntries.some(e => !e.file.name.toLowerCase().endsWith('.dxf'))) { showError('dxf 파일을 선택해 주세요.'); return; }
    if (!purpose.trim()) { showError('사용 목적을 입력해 주세요.'); return; }
    for (const e of fileEntries) {
      if (!e.catalogId) { showError(`"${e.file.name}"의 재질과 두께를 선택해 주세요.`); return; }
      const q = parseInt(e.quantity);
      if (isNaN(q) || q <= 0) { showError(`"${e.file.name}"의 수량을 0보다 크게 입력해 주세요.`); return; }
    }

    setSubmitting(true);

    const rows: Record<string, any>[] = [];
    for (const entry of fileEntries) {
      const cat = catalog.find(c => c.id === entry.catalogId)!;
      const filePath = `${user.id}/laser/${Date.now()}_${entry.file.name}`;
      const { error: uploadError } = await supabase.storage.from('manufacturing').upload(filePath, entry.file);
      if (uploadError) {
        setSubmitting(false);
        showError(`"${entry.file.name}" 파일을 올리지 못했어요. ` + uploadError.message);
        return;
      }
      rows.push({
        user_id: user.id,
        user_email: user.email,
        manager_id: managerId || null,
        purpose: purpose.trim(),
        file_path: filePath,
        file_name: entry.file.name,
        material: cat.material,
        thickness_mm: cat.thickness_mm,
        quantity: parseInt(entry.quantity),
        notes: notes.trim(),
      });
    }

    const { data, error } = await supabase.from('laser_jobs').insert(rows).select('id');

    setSubmitting(false);

    if (error) {
      showError('신청하지 못했어요. ' + error.message);
    } else if (rows.length === 1) {
      showSuccess('레이저 커팅을 신청했어요. 담당자 승인 후 제작을 진행해요.');
      router.push(`/manufacturing/laser/${data[0].id}`);
    } else {
      showSuccess(`파일 ${rows.length}개를 각각 신청했어요. 담당자 승인 후 제작을 진행해요.`);
      router.push('/manufacturing/laser');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="인증 확인 중" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="bg-muted p-8 rounded-full">
          <ShieldAlert className="w-16 h-16 text-muted-foreground" />
        </div>
        <Button onClick={() => router.push('/auth/login')} className="font-semibold px-10 h-12">로그인하기</Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center size-9 rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="cb-page-title">레이저 커팅 신청</h1>
          <p className="cb-page-sub mt-1">MDF · 아크릴</p>
        </div>
      </div>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Target className="size-3.5" /> 사용 목적 *</h2>
        <Input
          placeholder="예: 동아리 전시용 케이스, 개인 프로젝트 부품 등"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          className="h-10"
        />
      </section>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground">설계 파일 * — 여러 개 선택 가능</h2>

        {catalog.length === 0 ? (
          <p className="text-xs text-muted-foreground font-bold opacity-60 border-2 border-dashed border-border/40 rounded-lg py-6 text-center">
            등록된 재질과 두께가 없어요. 담당자에게 문의해 주세요.
          </p>
        ) : (
          <>
            <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-lg py-8 transition-all ${converting ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:border-border/80 hover:bg-muted/10'}`}>
              {converting ? <LoadingSpinner size={28} label="파일 변환 중" /> : (
                <>
                  <UploadCloud className="size-6 opacity-40" />
                  <span className="text-xs font-bold text-muted-foreground">클릭해서 파일 선택 (여러 개 가능)</span>
                  <span className="text-xs text-muted-foreground opacity-50">.dxf 그대로 올리거나, .svg / .dwg를 올리면 dxf로 변환해요</span>
                </>
              )}
              <input type="file" accept=".dxf,.svg,.dwg" multiple disabled={converting} className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>

            {fileEntries.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground opacity-60">파일마다 재질/두께/수량을 각각 정하고, 파일별로 나눠 신청해요.</p>
                {fileEntries.map((entry, i) => (
                  <div key={i} className="rounded-2xl border border-border/50 bg-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold truncate"><FileBox className="size-3.5 shrink-0 opacity-50" /> {entry.file.name}</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="size-3.5" /></button>
                    </div>
                    {entry.convertedFrom && (
                      <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><RefreshCw className="size-2.5" /> {entry.convertedFrom} → dxf 변환됨</p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className={labelCls}>재질 / 두께</label>
                        <Select value={entry.catalogId} onValueChange={v => updateEntry(i, { catalogId: v })}>
                          <SelectTrigger className="h-9 w-full text-xs"><SelectValue placeholder="— 선택 —" /></SelectTrigger>
                          <SelectContent>
                            {catalog.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.material === 'mdf' ? 'MDF' : '아크릴'} {c.thickness_mm}mm</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={labelCls}>수량</label>
                        <Input type="number" min="1" value={entry.quantity} onChange={e => updateEntry(i, { quantity: e.target.value })} className="h-9 text-xs" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground">담당자 지정</h2>
        <div className="flex items-center gap-2">
          <PersonSearchSelect candidates={managers} value={managerId} onChange={setManagerId} placeholder="아무나 (자동 배정) — 이름/학번 검색" />
        </div>

        <div>
          <label className={labelCls}>메모</label>
          <textarea
            rows={3}
            placeholder="원하는 완성 규격 등 요청사항... (모든 파일에 공통 적용)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 resize-y"
          />
        </div>
      </section>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 font-semibold text-xs h-11" onClick={() => router.back()} disabled={submitting}>취소</Button>
        <Button className="flex-1 font-semibold text-xs h-11" onClick={handleSubmit} disabled={submitting || catalog.length === 0}>
          {submitting ? '신청 중…' : fileEntries.length > 1 ? `${fileEntries.length}건 신청하기` : '신청하기'}
        </Button>
      </div>
    </div>
  );
}
