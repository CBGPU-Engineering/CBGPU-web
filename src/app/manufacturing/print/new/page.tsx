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
import { Badge } from '@/components/ui/badge';
import { PersonSearchSelect } from '@/components/manufacturing/PersonSearchSelect';
import { convertModelTo3mf } from '@/lib/manufacturing/convertTo3mf';
import { ArrowLeft, ShieldAlert, GraduationCap, Wrench, UploadCloud, Target, X, FileBox, RefreshCw, Printer } from 'lucide-react';

type Mode = 'beginner' | 'advanced';
type FilamentEntry = { id: string; material: string; color: string; stock_count: number };
type FileEntry = { file: File; quantity: string; plateCount: string; filamentId: string; convertedFrom?: string };

const labelCls = 'text-xs font-semibold   text-muted-foreground mb-1 block';
const cardCls = 'rounded-2xl border border-border/60 bg-card p-6 space-y-5';

export default function NewPrintJobPage() {
  const { user, isApproved, isLoading: authLoading } = useAuth();
  const fabricationPermission = useSchoolResourcePermission('fabrication', isApproved);
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('beginner');
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [printers, setPrinters] = useState<any[]>([]);
  const [printerId, setPrinterId] = useState<number | null>(null);
  const [plateBacklog, setPlateBacklog] = useState<Record<number, number>>({});
  const [managers, setManagers] = useState<any[]>([]);
  const [managerId, setManagerId] = useState<string>('');
  const [filaments, setFilaments] = useState<FilamentEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    const fetchPrinters = async () => {
      const { data, error } = await supabase.from('printers').select('*').order('id');
      if (!error) setPrinters(data || []);
    };
    const fetchFilaments = async () => {
      const { data, error } = await supabase.from('print_materials').select('*').order('material').order('color');
      if (!error) setFilaments(data || []);
    };
    const fetchBacklog = async () => {
      const { data, error } = await supabase.rpc('printer_plate_backlog');
      if (!error) {
        const map: Record<number, number> = {};
        for (const row of data || []) map[row.printer_id] = row.plates;
        setPlateBacklog(map);
      }
    };
    fetchPrinters();
    fetchFilaments();
    fetchBacklog();
  }, []);

  // 프린터를 고르면 그 프린터의 담당자만 골라서 지정할 수 있게 다시 불러온다.
  useEffect(() => {
    setManagerId('');setManagers([]);let active=true;
    if (printerId == null) { setManagers([]); return; }
    const fetchManagers = async () => {
      const { data: pm, error: pmError } = await supabase.from('printer_managers').select('user_id').eq('printer_id', printerId);
      if(!active)return;
      if (pmError || !pm || pm.length === 0) { setManagers([]); return; }
      const ids = [...new Set(pm.map(r => r.user_id))];
      const { data, error } = await manufacturingManagers(supabase,'print',ids,printerId);
      if(!active)return;setManagers(error?[]:data||[]);if(error)showError('담당자 목록을 확인하지 못했어요.');
    };
    fetchManagers();return()=>{active=false};
  }, [printerId]);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    setConverting(true);
    for (const file of picked) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === '3mf') {
        setFileEntries(prev => [...prev, { file, quantity: '1', plateCount: '1', filamentId: '' }]);
        continue;
      }
      if (ext === 'stl' || ext === 'obj') {
        try {
          const converted = await convertModelTo3mf(file);
          const newName = file.name.replace(/\.[^.]+$/, '.3mf');
          const convertedFile = new File([converted], newName, { type: 'model/3mf' });
          setFileEntries(prev => [...prev, { file: convertedFile, quantity: '1', plateCount: '1', filamentId: '', convertedFrom: file.name }]);
        } catch {
          showError(`"${file.name}" 파일을 변환하지 못했어요. 손상됐거나 지원하지 않는 파일일 수 있어요.`);
        }
        continue;
      }
      showError(`"${file.name}"은 지원하지 않는 형식이에요. .3mf, .stl, .obj 파일을 선택해 주세요.`);
    }
    setConverting(false);
  };
  const removeFile = (idx: number) => setFileEntries(prev => prev.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, patch: Partial<FileEntry>) =>
    setFileEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));

  const handleSubmit = async () => {
    if (!user) return;
    if (!await fabricationPermission.verify()) { showError(fabricationPermission.reason || '제작 장비 이용 권한을 확인해 주세요.'); return; }
    if (fileEntries.length === 0) { showError('3mf 파일을 한 개 이상 올려 주세요.'); return; }
    if (fileEntries.some(e => !e.file.name.toLowerCase().endsWith('.3mf'))) { showError('3mf 파일을 선택해 주세요.'); return; }
    if (printerId == null) { showError('사용할 프린터를 선택해 주세요.'); return; }
    if (!purpose.trim()) { showError('사용 목적을 입력해 주세요.'); return; }
    for (const e of fileEntries) {
      const q = parseInt(e.quantity);
      if (isNaN(q) || q <= 0) { showError(`"${e.file.name}"의 수량을 0보다 크게 입력해 주세요.`); return; }
      const pc = parseInt(e.plateCount);
      if (isNaN(pc) || pc <= 0) { showError(`"${e.file.name}"의 플레이트 수를 0보다 크게 입력해 주세요.`); return; }
    }

    setSubmitting(true);

    const rows: Record<string, any>[] = [];
    for (const entry of fileEntries) {
      const filament = filaments.find(f => f.id === entry.filamentId);
      const filePath = `${user.id}/print/${Date.now()}_${entry.file.name}`;
      const { error: uploadError } = await supabase.storage.from('manufacturing').upload(filePath, entry.file);
      if (uploadError) {
        setSubmitting(false);
        showError(`"${entry.file.name}" 파일을 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.`);
        return;
      }
      rows.push({
        user_id: user.id,
        user_email: user.email,
        mode,
        manager_id: managerId || null,
        preferred_printer_id: printerId,
        purpose: purpose.trim(),
        quantity: parseInt(entry.quantity),
        plate_count: parseInt(entry.plateCount),
        material: filament?.material ?? null,
        color: filament?.color ?? null,
        file_path: filePath,
        file_name: entry.file.name,
        notes: notes.trim(),
      });
    }

    const { data, error } = await supabase.from('print_jobs').insert(rows).select('id');

    setSubmitting(false);

    if (error) {
      showError('신청을 저장하지 못했어요. 입력 내용을 확인한 뒤 다시 시도해 주세요.');
    } else if (rows.length === 1) {
      showSuccess('3D 프린팅을 신청했어요. 진행 상태는 신청 내역에서 확인해 주세요.');
      router.push(`/manufacturing/print/${data[0].id}`);
    } else {
      showSuccess(`파일 ${rows.length}개를 각각 신청했어요. 진행 상태는 신청 내역에서 확인해 주세요.`);
      router.push('/manufacturing/print');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="로그인 확인 중" />
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
          aria-label="이전 화면"
          onClick={() => router.back()}
          className="flex items-center justify-center size-11 rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="cb-page-title">3D 프린팅 신청</h1>
          <p className="cb-page-sub mt-1">Bambu Lab X1C</p>
        </div>
      </div>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Printer className="size-3.5" /> 사용할 프린터 선택 *</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {printers.map(p => (
            <button
              key={p.id}
              aria-pressed={printerId === p.id}
              onClick={() => setPrinterId(p.id)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 text-center transition-all ${
 printerId === p.id ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-border'
 }`}
            >
              <span className="font-semibold text-sm">{p.name}</span>
              <Badge variant={p.status === 'printing' ? 'success' : p.status === 'maintenance' ? 'danger' : p.status === 'done' ? 'warning' : 'muted'}>
                {p.status === 'printing' ? '사용 중' : p.status === 'maintenance' ? '고장' : p.status === 'done' ? '회수 대기' : '대기'}
              </Badge>
              <span className="text-xs text-muted-foreground opacity-70">대기 중인 플레이트 {plateBacklog[p.id] || 0}개</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">담당자 지정은 이 프린터를 맡고 있는 사람 중에서만 고를 수 있어요.</p>
      </section>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground">모드 선택</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            aria-pressed={mode === 'beginner'}
            onClick={() => setMode('beginner')}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
 mode === 'beginner' ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-border'
 }`}
          >
            <GraduationCap className={`size-5 mt-0.5 ${mode === 'beginner' ? 'text-primary' : ''}`} />
            <div>
              <p className="font-semibold text-sm tracking-tight">초보자</p>
              <p className="text-sm mt-0.5">원본 모델을 올리면 담당자가 슬라이싱해요.</p>
            </div>
          </button>
          <button
            aria-pressed={mode === 'advanced'}
            onClick={() => setMode('advanced')}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
 mode === 'advanced' ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-border'
 }`}
          >
            <Wrench className={`size-5 mt-0.5 ${mode === 'advanced' ? 'text-primary' : ''}`} />
            <div>
              <p className="font-semibold text-sm tracking-tight">고급자</p>
              <p className="text-sm mt-0.5">밤부스튜디오에서 슬라이싱한 파일로 출력을 요청해요.</p>
            </div>
          </button>
        </div>
      </section>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Target className="size-3.5" /> 사용 목적 *</h2>
        <Input
          id="print-purpose"
          aria-label="사용 목적"
          placeholder="예: 동아리 전시용 모형, 개인 프로젝트 부품 등"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          className="h-10"
        />
      </section>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground">
          {mode === 'beginner' ? '모델 파일 *' : '슬라이싱 완료 파일 *'}
        </h2>
        <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-lg py-8 transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${converting ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:border-border/80 hover:bg-muted/10'}`}>
          {converting ? <LoadingSpinner size={28} label="파일 변환 중" /> : (
            <>
              <UploadCloud className="size-6 opacity-40" />
              <span className="text-xs font-bold text-muted-foreground">파일 선택 · 여러 개 가능</span>
              <span className="text-xs text-muted-foreground">.3mf 그대로 올리거나, .stl / .obj를 올리면 3mf로 변환해요</span>
            </>
          )}
          <input aria-label="설계 파일 업로드" type="file" accept=".3mf,.stl,.obj" multiple disabled={converting} className="sr-only" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>

        {fileEntries.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">파일마다 수량과 필라멘트를 정해 주세요. 파일별로 신청돼요.</p>
            {fileEntries.map((entry, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-muted/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold truncate"><FileBox className="size-3.5 shrink-0 opacity-50" /> {entry.file.name}</span>
                  <button type="button" aria-label={`${entry.file.name} 파일 제외`} onClick={() => removeFile(i)} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive shrink-0"><X className="size-3.5" /></button>
                </div>
                {entry.convertedFrom && (
                  <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><RefreshCw className="size-2.5" /> {entry.convertedFrom} → 3mf 변환됨</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className={labelCls}>수량</label>
                    <Input aria-label={`${entry.file.name} 수량`} type="number" min="1" value={entry.quantity} onChange={e => updateEntry(i, { quantity: e.target.value })} className="h-11 text-base" />
                  </div>
                  <div>
                    <label className={labelCls}>플레이트 수</label>
                    <Input aria-label={`${entry.file.name} 플레이트 수`} type="number" min="1" value={entry.plateCount} onChange={e => updateEntry(i, { plateCount: e.target.value })} className="h-11 text-base" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>필라멘트</label>
                    <Select value={entry.filamentId} onValueChange={v => updateEntry(i, { filamentId: v })}>
                      <SelectTrigger aria-label={`${entry.file.name} 필라멘트`} className="h-11 w-full text-base"><SelectValue placeholder="상관없음" /></SelectTrigger>
                      <SelectContent>
                        {filaments.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.material} · {f.color}{f.stock_count === 0 ? ' (품절)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'advanced' && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            고급자는 본인 컴퓨터의 밤부스튜디오로 미리 슬라이싱한 파일을 올려 주세요. 담당자는 올린 파일로 출력을 진행해요.
          </p>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="text-xs font-semibold text-muted-foreground">담당자 지정</h2>
        {printerId == null ? (
          <p className="text-xs text-muted-foreground font-bold opacity-60 border-2 border-dashed border-border/40 rounded-lg py-4 text-center">
            프린터를 먼저 선택하면 그 프린터의 담당자를 고를 수 있어요.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <PersonSearchSelect candidates={managers} value={managerId} onChange={setManagerId} placeholder="이름 또는 학번 검색" />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          &ldquo;아무나&rdquo;를 선택하면 무작위 배정이 아니라, 이 프린터 담당자 중 먼저 수락한 사람에게 배정돼요.
        </p>

        <div>
          <label className={labelCls} htmlFor="print-notes">메모</label>
          <textarea
            id="print-notes"
            rows={3}
            placeholder="서포트 여부 등 요청 사항 · 모든 파일에 공통 적용"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 resize-y"
          />
        </div>
      </section>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 font-semibold text-xs h-11" onClick={() => router.back()} disabled={submitting}>취소</Button>
        <Button className="flex-1 font-semibold text-xs h-11" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '신청 중…' : fileEntries.length > 1 ? `${fileEntries.length}건 신청하기` : '신청하기'}
        </Button>
      </div>
    </div>
  );
}
