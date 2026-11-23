'use client';
import {Dropdown} from '@/components/ui/dropdown';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import {
  Plus, Trash2, X, Edit3, BarChart3, ArrowLeft, ChevronUp, ChevronDown,
  CheckSquare, Circle, Type, AlignLeft, Star, List, Lock, CheckCircle2, Sparkles,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { requestAi } from '@/lib/requestAi';
import { boundedClientRequest } from '@/lib/boundedClientRequest';

// ─── types ────────────────────────────────────────────────────────────────────
type QType = 'choice' | 'checkbox' | 'text' | 'paragraph' | 'scale' | 'dropdown';
type AnswerValue = string | string[] | number | null;

interface QOption { id: string; text: string }
interface QConfig { min?: number; max?: number; minLabel?: string; maxLabel?: string; showIf?: { questionId: string; value: string } }

interface Question {
  id: string; poll_id: string; order_num: number; type: QType;
  title: string; description: string; required: boolean;
  options: QOption[]; config: QConfig;
}
interface Poll {
  id: string; created_at: string; title: string; description: string;
  ends_at: string | null; is_active: boolean; show_results: boolean; editor_revision: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
const isClosed = (p: Poll) => !p.is_active || (!!p.ends_at && new Date(p.ends_at) < new Date());
const isVisible = (q: Question, ans: Record<string, AnswerValue>) => {
  const si = q.config.showIf;
  if (!si) return true;
  const v = ans[si.questionId];
  return Array.isArray(v) ? v.includes(si.value) : String(v ?? '') === si.value;
};

const Q_TYPES: { id: QType; label: string; icon: any }[] = [
  { id: 'choice',    label: '객관식 (단일)',   icon: Circle },
  { id: 'checkbox',  label: '체크박스 (복수)', icon: CheckSquare },
  { id: 'dropdown',  label: '드롭다운',        icon: List },
  { id: 'text',      label: '단답형',          icon: Type },
  { id: 'paragraph', label: '장문형',          icon: AlignLeft },
  { id: 'scale',     label: '선형 배율',       icon: Star },
];

// ─── QuestionInput ─────────────────────────────────────────────────────────
function QuestionInput({ q, value, onChange }: { q: Question; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const sel = Array.isArray(value) ? value : [];
  switch (q.type) {
    case 'choice':
    case 'dropdown':
      return (
        <div className="space-y-2">
          {q.options.map(o => (
            <label key={o.id}
              className={`relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-2 ${value === o.id ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/30'}`}>
              <Input type="radio" name={q.id} checked={value === o.id} onChange={() => onChange(o.id)} className="sr-only min-h-0 size-px border-0 p-0"/><div aria-hidden="true" className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${value === o.id ? 'border-primary' : 'border-muted-foreground/30'}`}>
                {value === o.id && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm font-medium">{o.text}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {q.options.map(o => {
            const chk = sel.includes(o.id);
            return (
              <label key={o.id}
                className={`relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-2 ${chk ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/30'}`}>
                <Input type="checkbox" checked={chk} onChange={() => onChange(chk ? sel.filter(v => v !== o.id) : [...sel, o.id])} className="sr-only min-h-0 size-px border-0 p-0"/><div aria-hidden="true" className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${chk ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                  {chk && <span className="text-white text-sm font-semibold">✓</span>}
                </div>
                <span className="text-sm font-medium">{o.text}</span>
              </label>
            );
          })}
        </div>
      );
    case 'text':
      return <Input aria-label={q.title || '답변'} value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} placeholder="답변을 입력해 주세요" className="font-medium" />;
    case 'paragraph':
      return <Textarea aria-label={q.title || '답변'} value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} rows={4} placeholder="답변을 입력해 주세요"
        className="resize-none font-medium" />;
    case 'scale': {
      const { min = 1, max = 5, minLabel, maxLabel } = q.config;
      return (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => (
              <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)}
                className={`size-11 rounded-lg border font-semibold text-sm transition-all ${value === n ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-muted/30 border-border/40 hover:bg-muted/60 text-muted-foreground'}`}>{n}</button>
            ))}
          </div>
          {(minLabel || maxLabel) && (
            <div className="flex justify-between text-sm text-muted-foreground font-medium px-1">
              <span>{minLabel}</span><span>{maxLabel}</span>
            </div>
          )}
        </div>
      );
    }
    default: return null;
  }
}

// ─── ResultChart ──────────────────────────────────────────────────────────────
function ResultChart({ q, allAnswers }: { q: Question; allAnswers: { question_id: string; value: any }[] }) {
  const qAnswers = allAnswers.filter(a => a.question_id === q.id).map(a => a.value);
  const total = qAnswers.length;

  if (q.type === 'text' || q.type === 'paragraph') {
    const texts = qAnswers.filter(Boolean).map(v => typeof v === 'string' ? v : JSON.stringify(v));
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-muted-foreground">{total}개 응답</p>
        {texts.slice(0, 20).map((t, i) => (
          <p key={i} className="text-sm bg-muted/30 border border-border/30 rounded-lg px-3 py-2 font-medium">{t}</p>
        ))}
        {texts.length > 20 && <p className="text-sm text-muted-foreground">+{texts.length - 20}개 더...</p>}
      </div>
    );
  }

  if (q.type === 'scale') {
    const nums = qAnswers.map(Number).filter(n => !isNaN(n));
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '-';
    const { min = 1, max = 5 } = q.config;
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">{total}개 응답 · 평균 <span className="text-primary">{avg}</span></p>
        <div className="flex gap-2">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => {
            const cnt = nums.filter(v => v === n).length;
            const pct = total ? Math.round(cnt / total * 100) : 0;
            return (
              <div key={n} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-muted rounded-full h-20 flex items-end overflow-hidden">
                  <div className="w-full bg-primary rounded-full transition-all duration-700" style={{ height: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">{n}</span>
                <span className="text-sm text-muted-foreground/60">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // choice / checkbox / dropdown
  const countMap: Record<string, number> = {};
  qAnswers.forEach(v => {
    const ids = Array.isArray(v) ? v : [v];
    ids.forEach(id => { if (id) countMap[String(id)] = (countMap[String(id)] ?? 0) + 1; });
  });
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-muted-foreground">{total}개 응답</p>
      {q.options.map(o => {
        const cnt = countMap[o.id] ?? 0;
        const pct = total ? Math.round(cnt / total * 100) : 0;
        return (
          <div key={o.id} className="space-y-1">
            <div className="flex justify-between text-sm font-bold">
              <span>{o.text}</span>
              <span className="text-muted-foreground">{cnt}명 ({pct}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── QuestionBuilder ──────────────────────────────────────────────────────────
function QuestionBuilder({ q, idx, total, prevQs, onChange, onDelete, onMove }: {
  q: Question; idx: number; total: number; prevQs: Question[];
  onChange: (q: Question) => void; onDelete: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(true);
  const addOption  = () => onChange({ ...q, options: [...q.options, { id: uid(), text: '' }] });
  const delOption  = (id: string) => onChange({ ...q, options: q.options.filter(o => o.id !== id) });
  const setOptText = (id: string, text: string) => onChange({ ...q, options: q.options.map(o => o.id === id ? { ...o, text } : o) });
  const hasOptions = ['choice', 'checkbox', 'dropdown'].includes(q.type);
  const isScale    = q.type === 'scale';

  const Icon = Q_TYPES.find(t => t.id === q.type)?.icon ?? Circle;

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden bg-card">
      <div className="flex items-center gap-2 p-3">
        <div className="flex shrink-0 gap-0.5">
          <button type="button" aria-label="질문 위로 이동" onClick={e => { e.stopPropagation(); onMove(-1); }} disabled={idx === 0} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp className="size-3" /></button>
          <button type="button" aria-label="질문 아래로 이동" onClick={e => { e.stopPropagation(); onMove(1); }} disabled={idx === total - 1} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown className="size-3" /></button>
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"><Icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground font-semibold shrink-0">{idx + 1}.</span>
        <span className="text-sm font-bold flex-1 truncate">{q.title || '(제목 없음)'}</span>
        {q.required && <span className="text-sm text-destructive font-semibold">필수</span>}</button>
        <button type="button" aria-label="질문 삭제" onClick={e => { e.stopPropagation(); onDelete(); }} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="size-3.5" /></button>
      </div>

      {open && (
        <div className="border-t border-border/30 p-4 space-y-3">
          {/* type selector */}
          <div className="flex gap-1 flex-wrap">
            {Q_TYPES.map(t => (
              <button key={t.id} onClick={() => onChange({ ...q, type: t.id, config: t.id === 'scale' ? { min: 1, max: 5, minLabel: '매우 낮음', maxLabel: '매우 높음' } : {} })}
                className={`min-h-11 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1 ${q.type === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                <t.icon className="size-2.5" />{t.label}
              </button>
            ))}
          </div>

          <Input aria-label="질문 제목" value={q.title} onChange={e => onChange({ ...q, title: e.target.value })} placeholder="질문 제목 *" className="font-bold" />
          <Input aria-label="질문 설명" value={q.description} onChange={e => onChange({ ...q, description: e.target.value })} placeholder="질문 설명 (선택)" className="md:text-sm text-muted-foreground" />

          {/* options */}
          {hasOptions && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-muted-foreground">선택지</p>
              {q.options.map((o, i) => (
                <div key={o.id} className="flex gap-2">
                  <Input aria-label="선택지" value={o.text} onChange={e => setOptText(o.id, e.target.value)} placeholder={`선택지 ${i + 1}`} className="md:text-sm" />
                  {q.options.length > 1 && <Button variant="ghost" size="icon" aria-label={`선택지 ${i + 1} 삭제`} className="size-11 shrink-0" onClick={() => delOption(o.id)}><X className="size-3" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption} className="w-full font-semibold text-sm gap-1.5"><Plus className="size-3" />선택지 추가</Button>
            </div>
          )}

          {/* scale config */}
          {isScale && (
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-sm font-semibold text-muted-foreground mb-1">최솟값</p><Input aria-label="최솟값" type="number" value={q.config.min ?? 1} onChange={e => onChange({ ...q, config: { ...q.config, min: +e.target.value } })} className="md:text-sm" /></div>
              <div><p className="text-sm font-semibold text-muted-foreground mb-1">최댓값</p><Input aria-label="최댓값" type="number" value={q.config.max ?? 5} onChange={e => onChange({ ...q, config: { ...q.config, max: +e.target.value } })} className="md:text-sm" /></div>
              <div><p className="text-sm font-semibold text-muted-foreground mb-1">최솟값 라벨</p><Input aria-label="최솟값 라벨" value={q.config.minLabel ?? ''} onChange={e => onChange({ ...q, config: { ...q.config, minLabel: e.target.value } })} className="md:text-sm" /></div>
              <div><p className="text-sm font-semibold text-muted-foreground mb-1">최댓값 라벨</p><Input aria-label="최댓값 라벨" value={q.config.maxLabel ?? ''} onChange={e => onChange({ ...q, config: { ...q.config, maxLabel: e.target.value } })} className="md:text-sm" /></div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {/* conditional show */}
            {prevQs.filter(p => ['choice','checkbox','dropdown'].includes(p.type) && p.options.length).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground font-semibold">표시 조건:</span>
                <Dropdown aria-label="표시 조건 질문" className="min-h-11 text-sm bg-muted border border-border/50 rounded-lg px-2 py-1 font-medium"
                  value={q.config.showIf?.questionId ?? ''}
                  onChange={e => onChange({ ...q, config: { ...q.config, showIf: e.target.value ? { questionId: e.target.value, value: '' } : undefined } })}>
                  <option value="">항상 표시</option>
                  {prevQs.filter(p => ['choice','checkbox','dropdown'].includes(p.type)).map(p => (
                    <option key={p.id} value={p.id}>{p.title || '(제목 없음)'}</option>
                  ))}
                </Dropdown>
                {q.config.showIf?.questionId && (
                  <Dropdown aria-label="표시 조건 답변" className="min-h-11 text-sm bg-muted border border-border/50 rounded-lg px-2 py-1 font-medium"
                    value={q.config.showIf.value}
                    onChange={e => onChange({ ...q, config: { ...q.config, showIf: { ...q.config.showIf!, value: e.target.value } } })}>
                    <option value="">선택지 선택</option>
                    {prevQs.find(p => p.id === q.config.showIf?.questionId)?.options.map(o => (
                      <option key={o.id} value={o.id}>{o.text}</option>
                    ))}
                  </Dropdown>
                )}
              </div>
            )}
            <label className="relative ml-auto flex min-h-11 cursor-pointer items-center gap-2 rounded-md focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-2">
              <Input type="checkbox" role="switch" aria-label={`${idx + 1}번 질문 필수 응답`} checked={q.required} onChange={event => onChange({ ...q, required: event.target.checked })} className="sr-only size-px min-h-0 border-0 p-0" />
              <span aria-hidden="true" className={`relative h-4 w-8 shrink-0 rounded-full transition-all ${q.required ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${q.required ? 'left-4' : 'left-0.5'}`} />
              </span>
              <span className="text-sm font-semibold text-muted-foreground">필수</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PollBuilder ──────────────────────────────────────────────────────────────
function PollBuilder({ poll, onSaved, onBack }: { poll?: Poll; onSaved: () => void; onBack: () => void }) {
  const { showError, showSuccess } = useAlert();
  const [title, setTitle]   = useState(poll?.title ?? '');
  const [desc, setDesc]     = useState(poll?.description ?? '');
  const [endsAt, setEndsAt] = useState(poll?.ends_at?.slice(0, 16) ?? '');
  const [showRes, setShowRes] = useState(poll?.show_results ?? true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [questionsLoaded, setQuestionsLoaded] = useState(!poll);
  const [questionLoadError, setQuestionLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!poll) return;
    let live = true;
    const controller = new AbortController();
    setQuestionsLoaded(false); setQuestionLoadError(false);
    void boundedClientRequest(signal => supabase.from('poll_questions').select('*').eq('poll_id', poll.id).order('order_num').abortSignal(signal), controller.signal)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) throw error;
        setQuestions((data ?? []).map(q => ({ ...q, options: q.options ?? [], config: q.config ?? {} })));
        setQuestionsLoaded(true);
      }).catch(() => { if (live) setQuestionLoadError(true); });
    return () => { live = false; controller.abort(); };
  }, [poll, loadAttempt]);

  const addQ = (type: QType) => {
    const opts = ['choice','checkbox','dropdown'].includes(type) ? [{ id: uid(), text: '' }, { id: uid(), text: '' }] : [];
    const cfg: QConfig = type === 'scale' ? { min: 1, max: 5, minLabel: '매우 낮음', maxLabel: '매우 높음' } : {};
    setQuestions(qs => [...qs, { id: uid(), poll_id: poll?.id ?? '', order_num: qs.length, type, title: '', description: '', required: false, options: opts, config: cfg }]);
  };

  const moveQ = (idx: number, dir: -1 | 1) => {
    setQuestions(qs => {
      const next = [...qs];
      const tmp = next[idx]; next[idx] = next[idx + dir]; next[idx + dir] = tmp;
      return next.map((q, i) => ({ ...q, order_num: i }));
    });
  };

  const save = async () => {
    if (savingRef.current || !questionsLoaded) return;
    if (!title.trim()) { showError('제목을 입력해 주세요.'); return; }
    savingRef.current = true; setSaving(true);
    try {
      const { data, error } = await boundedClientRequest(signal => supabase.rpc('cbgpu_save_poll', {
        p_poll_id: poll?.id ?? null,
        p_expected_revision: poll?.editor_revision ?? null,
        p_poll: { title, description: desc, ends_at: endsAt || null, show_results: showRes },
        p_questions: questions.map((q, i) => ({ id: q.id, order_num: i, type: q.type, title: q.title, description: q.description, required: q.required, options: q.options, config: q.config })),
      }).abortSignal(signal), undefined, 30_000);
      if (error) throw error;
      if (!data?.id) throw new Error('POLL_RESULT_UNCONFIRMED');
      showSuccess('저장했어요.');
      onSaved();
    } catch (error) {
      const reason = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
      if (reason.includes('POLL_ANSWERED_QUESTION_REMOVAL') || reason.includes('POLL_ANSWERED_QUESTION_TYPE')) {
        showError('답변이 있는 질문은 삭제하거나 유형을 바꿀 수 없어요. 질문을 원래대로 돌린 뒤 저장해 주세요.');
      } else if (reason.includes('POLL_ANSWERED_OPTION_REMOVAL')) {
        showError('답변에 쓰인 선택지는 삭제할 수 없어요. 기존 선택지를 유지한 뒤 저장해 주세요.');
      } else if (reason.includes('POLL_INVALID_OPTIONS')) {
        showError('선택지가 중복되거나 올바르지 않아요. 선택지를 다시 확인한 뒤 저장해 주세요.');
      } else if (reason.includes('POLL_INVALID_CONDITION')) {
        showError('표시 조건에 연결된 질문을 찾지 못했어요. 질문의 표시 조건을 다시 선택한 뒤 저장해 주세요.');
      } else if (reason.includes('POLL_EDIT_CONFLICT')) {
        showError('다른 곳에서 투표를 수정했어요. 작성한 내용을 따로 복사한 뒤 목록에서 투표를 다시 열어 주세요.');
      } else {
        showError('저장 결과를 확인하지 못했어요. 작성한 내용은 그대로 있어요. 목록에서 저장 여부를 확인한 뒤 다시 시도해 주세요.');
      }
    } finally { savingRef.current = false; setSaving(false); }
  };

  return (
    <fieldset disabled={saving} className="space-y-5 max-w-2xl mx-auto min-w-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="투표 목록으로 돌아가기" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <h2 className="font-semibold text-xl tracking-tight">{poll ? '투표 편집' : '새 투표 만들기'}</h2>
      </div>
      <div className="space-y-3 p-5 border border-border/50 rounded-2xl bg-card">
        <div className="space-y-2"><label htmlFor="poll-title" className="text-sm font-medium">투표 제목 *</label><Input id="poll-title" aria-label="투표 제목" value={title} onChange={e => setTitle(e.target.value)} placeholder="투표 제목을 입력해 주세요" className="text-lg font-semibold" /></div>
        <div className="space-y-2"><label htmlFor="poll-description" className="text-sm font-medium">설명 (선택)</label><Input id="poll-description" aria-label="투표 설명" value={desc} onChange={e => setDesc(e.target.value)} placeholder="투표에 필요한 안내를 적어 주세요" className="font-medium" /></div>
        <div className="flex gap-3 flex-wrap">
          <div><p className="text-sm font-semibold text-muted-foreground mb-1">마감일</p><Input aria-label="마감일" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="md:text-sm" /></div>
          <label className="relative mt-5 flex min-h-11 cursor-pointer items-center gap-2 rounded-md focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-2">
            <Input type="checkbox" role="switch" aria-label="결과 공개" checked={showRes} onChange={event => setShowRes(event.target.checked)} className="sr-only size-px min-h-0 border-0 p-0" />
            <span aria-hidden="true" className={`relative h-4 w-8 shrink-0 rounded-full transition-all ${showRes ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${showRes ? 'left-4' : 'left-0.5'}`} />
            </span>
            <span className="text-sm font-semibold text-muted-foreground">결과 공개</span>
          </label>
        </div>
      </div>

      {!questionsLoaded && <div role={questionLoadError ? 'alert' : 'status'} className="space-y-2 text-sm text-muted-foreground"><p>{questionLoadError ? '질문을 불러오지 못했어요. 질문을 확인한 뒤 저장할 수 있어요.' : '질문을 불러오고 있어요.'}</p>{questionLoadError && <Button variant="outline" onClick={() => setLoadAttempt(value => value + 1)}>질문 다시 불러오기</Button>}</div>}
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionBuilder key={q.id} q={q} idx={i} total={questions.length}
            prevQs={questions.slice(0, i)}
            onChange={nq => setQuestions(qs => qs.map(x => x.id === nq.id ? nq : x))}
            onDelete={() => setQuestions(qs => qs.filter(x => x.id !== q.id))}
            onMove={dir => moveQ(i, dir)} />
        ))}
      </div>

      <div className="p-4 border-2 border-dashed border-border/40 rounded-2xl">
        <p className="text-sm font-semibold text-muted-foreground mb-3 text-center">질문 추가</p>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {Q_TYPES.map(t => (
            <button key={t.id} disabled={!questionsLoaded} onClick={() => addQ(t.id)}
              className="min-h-11 px-3 py-2 bg-muted hover:bg-muted/70 rounded-lg text-sm font-semibold text-muted-foreground transition-all flex items-center gap-1.5">
              <t.icon className="size-3" />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack} className="font-semibold text-sm">취소</Button>
        <Button onClick={save} disabled={saving || !questionsLoaded} className="font-semibold text-sm">{saving ? '저장 중...' : '저장하기'}</Button>
      </div>
    </fieldset>
  );
}

// ─── PollForm ─────────────────────────────────────────────────────────────────
function PollForm({ poll, questions, onSubmitted, onBack, notice }: { poll: Poll; questions: Question[]; onSubmitted: () => void; onBack: () => void; notice?: string }) {
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const actor = useRef(user?.id); actor.current = user?.id;
  const closed = isClosed(poll);

  const visibleQs = questions.filter(q => isVisible(q, answers));

  const submit = async () => {
    if (submittingRef.current || !user || closed) return;
    for (const q of visibleQs) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
      if (empty) { showError(`"${q.title || '질문'}"에 답변해 주세요.`); return; }
    }
    const owner = user.id;
    submittingRef.current = true; setSubmitting(true);
    try {
      const { data, error } = await boundedClientRequest(async signal => {
        const { data: { session } } = await supabase.auth.getSession();
        if (signal.aborted || actor.current !== owner || session?.user.id !== owner) throw new Error('POLL_AUTH_REQUIRED');
        return supabase.rpc('cbgpu_submit_poll', { p_poll_id: poll.id, p_expected_revision: poll.editor_revision ?? null, p_answers: { ...answers } }).abortSignal(signal);
      }, undefined, 30_000);
      if (error) throw error;
      if (data?.submitted !== true || data.poll_id !== poll.id || !data.id) throw new Error('POLL_RESPONSE_UNCONFIRMED');
      if (actor.current !== owner) return;
      showSuccess('제출했어요.');
      onSubmitted();
    } catch (error) {
      if (actor.current !== owner) return;
      const reason = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
      if (reason.includes('POLL_CLOSED')) showError('투표가 마감됐어요. 목록에서 마감 상태와 내 응답을 확인해 주세요.');
      else if (reason.includes('POLL_EDIT_CONFLICT')) showError('질문이 변경됐어요. 작성한 답변을 따로 복사한 뒤 투표를 다시 열어 주세요.');
      else if (reason.includes('POLL_REQUIRED_ANSWER') || reason.includes('POLL_INVALID_ANSWER')) showError('필수 항목과 선택 가능한 값을 확인한 뒤 다시 제출해 주세요. 작성한 답변은 그대로 있어요.');
      else if (reason.includes('POLL_RESPONSE_ALREADY_RECORDED')) showError('이미 등록된 답변이 있어요. 작성한 내용은 그대로 있으니 목록의 내 응답 확인으로 등록된 응답을 확인해 주세요.');
      else showError('제출 결과를 확인하지 못했어요. 작성한 답변은 그대로 있어요. 목록의 내 응답 확인으로 저장 여부를 확인해 주세요.');
    } finally { submittingRef.current = false; setSubmitting(false); }
  };

  return (
    <fieldset disabled={submitting} className="space-y-5 max-w-2xl mx-auto min-w-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="투표 목록으로 돌아가기" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <div>
          <h2 className="font-semibold text-xl tracking-tight">{poll.title}</h2>
          {poll.description && <p className="text-sm text-muted-foreground mt-0.5">{poll.description}</p>}
          {poll.ends_at && <p className="text-sm text-muted-foreground font-medium mt-0.5">마감: {fmtDate(poll.ends_at)}</p>}
        </div>
      </div>

      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      <div className="space-y-4">
        {visibleQs.map((q, i) => (
          <div key={q.id} className="p-5 border border-border/50 rounded-2xl bg-card space-y-3">
            <div>
              <p className="font-semibold text-sm leading-snug">
                {i + 1}. {q.title}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </p>
              {q.description && <p className="text-sm text-muted-foreground mt-0.5">{q.description}</p>}
            </div>
            {!closed && <QuestionInput q={q} value={answers[q.id] ?? null} onChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} />}
            {closed && <p className="text-sm text-muted-foreground">마감된 투표예요.</p>}
          </div>
        ))}
      </div>

      {!closed && (
        <Button onClick={submit} disabled={submitting} className="w-full font-semibold h-12">
          {submitting ? '제출 중...' : '제출하기'}
        </Button>
      )}
    </fieldset>
  );
}

// ─── PollResults ──────────────────────────────────────────────────────────────
function PollResults({ poll, questions, onBack }: { poll: Poll; questions: Question[]; onBack: () => void }) {
  const { isAdmin } = useAuth();
  const canViewResults = poll.show_results || isAdmin;
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [resCount,   setResCount]   = useState(0);
  const [insight, setInsight] = useState('');
  const insightKeyRef = useRef('');

  useEffect(() => {
    setInsight('');
    if (!canViewResults) return;
    let active = true;
    (async () => {
      const { data: responses } = await supabase.from('poll_responses').select('id').eq('poll_id', poll.id);
      if (!active) return;
      setResCount(responses?.length ?? 0);
      if (!responses?.length) return;
      const ids = responses.map(r => r.id);
      const { data: answers } = await supabase.from('poll_answers').select('question_id, value').in('response_id', ids);
      if (active) setAllAnswers(answers ?? []);
    })();
    return () => { active = false; };
  }, [poll.id, canViewResults]);

  useEffect(() => {
    if (!canViewResults || resCount < 3 || allAnswers.length === 0) return;
    const key = `poll-insight:${poll.id}:${resCount}:${allAnswers.length}`;
    if (insightKeyRef.current === key) return;
    insightKeyRef.current = key;
    let cached: string | null = null;
    try { cached = sessionStorage.getItem(key); } catch { /* Optional summaries do not require browser storage. */ }
    if (cached) { setInsight(cached); return; }
    const lines = questions.map(q => {
      const values = allAnswers.filter(answer => answer.question_id === q.id).map(answer => answer.value);
      if (q.type === 'text' || q.type === 'paragraph') return `${q.title}: 서술형 응답 ${values.length}개`;
      if (q.type === 'scale') {
        const nums = values.map(Number).filter(Number.isFinite);
        const average = nums.length ? (nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1) : '응답 없음';
        return `${q.title}: 평균 ${average}, 응답 ${nums.length}개`;
      }
      return `${q.title}: ${q.options.map(option => {
        const count = values.filter(value => Array.isArray(value) ? value.includes(option.id) : value === option.id).length;
        return `${option.text} ${count}명`;
      }).join(', ')}`;
    });
    let cancelled = false;
    requestAi('poll_insight', `총 응답자 ${resCount}명\n${lines.join('\n')}`).then(text => {
      if (cancelled) return;
      setInsight(text);
      try { sessionStorage.setItem(key, text); } catch { /* The visible summary remains usable when storage is unavailable. */ }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [allAnswers, poll.id, questions, resCount, canViewResults]);

  if (!canViewResults) return <div className="space-y-4"><Button variant="outline" onClick={onBack}>투표 목록으로 돌아가기</Button><p role="status" className="text-sm text-muted-foreground">결과를 공개하지 않는 투표예요. 목록에서 내 응답의 등록 여부를 확인할 수 있어요.</p></div>;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="투표 목록으로 돌아가기" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <div>
          <h2 className="font-semibold text-xl tracking-tight">{poll.title} — 결과</h2>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">총 {resCount}명 응답</p>
        </div>
      </div>
      {insight && <p className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed" aria-label="AI 결과 요약"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /><span>{insight} <span className="text-sm text-muted-foreground">AI가 집계만 보고 만든 요약이에요. 정확한 수치는 아래에서 확인해 주세요.</span></span></p>}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="p-5 border border-border/50 rounded-2xl bg-card space-y-3">
            <p className="font-semibold text-sm">{i + 1}. {q.title}</p>
            <ResultChart q={q} allAnswers={allAnswers} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
type View = { type: 'list' } | { type: 'form'; poll: Poll; questions: Question[]; notice?: string } | { type: 'results'; poll: Poll; questions: Question[] } | { type: 'builder'; poll?: Poll };

export default function PollsPage() { const { user } = useAuth(); return <PollsSession key={user?.id || 'anonymous'} />; }
function PollsSession() {
  const { user, isAdmin } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [polls,  setPolls]  = useState<Poll[]>([]);
  const [myResponses, setMyResponses] = useState<string[]>([]); // poll_ids I've answered
  const [view,   setView]   = useState<View>({ type: 'list' });
  const [loading, setLoading] = useState(true);
  const [justFinished, setJustFinished] = useState(false);
  const [tab,    setTab]    = useState<'active' | 'closed'>('active');
  const [dbMissing, setDbMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const responseCheck = useRef(false);
  const [checkingResponse, setCheckingResponse] = useState(false);
  const currentActor = useRef(user?.id); currentActor.current = user?.id;

  const loadPolls = useCallback(async () => {
    setLoading(true); setLoadError('');
    const { data, error } = await supabase.from('polls').select('*').order('created_at', { ascending: false }).limit(500);
    if (error?.message?.includes('does not exist')) { setDbMissing(true); setLoading(false); return; }
    if (error) { setLoadError('투표를 불러오지 못했어요. 연결을 확인한 뒤 다시 불러와 주세요.'); setLoading(false); return; }
    setPolls((data ?? []) as Poll[]);
    if (user) {
      const { data: resps } = await supabase.from('poll_responses').select('poll_id').eq('user_id', user.id);
      setMyResponses((resps ?? []).map(r => r.poll_id));
    }
    setLoading(false);
    setJustFinished(true);
    setTimeout(() => setJustFinished(false), 600);
  }, [user]);

  useEffect(() => { loadPolls(); }, [loadPolls]);

  const openPoll = async (poll: Poll) => {
    if (!poll.show_results && !isAdmin && (myResponses.includes(poll.id) || isClosed(poll))) {
      showError(myResponses.includes(poll.id) ? '결과를 공개하지 않는 투표예요. 내 응답 확인으로 등록 여부를 확인해 주세요.' : '결과를 공개하지 않는 투표예요. 목록에서 다른 투표를 확인해 주세요.');
      return;
    }
    const { data: qs } = await supabase.from('poll_questions').select('*').eq('poll_id', poll.id).order('order_num');
    const questions = (qs ?? []).map(q => ({ ...q, options: q.options ?? [], config: q.config ?? {} })) as Question[];
    if (myResponses.includes(poll.id) || isClosed(poll)) {
      setView({ type: 'results', poll, questions });
    } else {
      setView({ type: 'form', poll, questions });
    }
  };

  const checkMyResponse = async (poll: Poll) => {
    const owner = user?.id;
    if (!owner || responseCheck.current) return;
    responseCheck.current = true; setCheckingResponse(true);
    try {
      const result = await boundedClientRequest(async signal => {
        const { data: { session } } = await supabase.auth.getSession();
        if (signal.aborted || currentActor.current !== owner || session?.user.id !== owner) throw new Error('Account changed');
        const response = await supabase.from('poll_responses').select('id').eq('poll_id', poll.id).eq('user_id', owner).abortSignal(signal).maybeSingle();
        if (response.error || !response.data) throw new Error('Response unavailable');
        const recorded = await supabase.from('poll_answers').select('id').eq('response_id', response.data.id).limit(1).abortSignal(signal);
        if (recorded.error) throw recorded.error;
        const questions = await supabase.from('poll_questions').select('*').eq('poll_id', poll.id).order('order_num').abortSignal(signal);
        if (questions.error) throw questions.error;
        return { answered: !!recorded.data?.length, questions: (questions.data ?? []).map(q => ({ ...q, options: q.options ?? [], config: q.config ?? {} })) as Question[] };
      });
      if (currentActor.current !== owner) return;
      if (!result.answered && !isClosed(poll)) setView({ type: 'form', poll, questions: result.questions, notice: '등록된 답변이 없어요. 답변을 작성해 제출하거나, 표시된 질문이 없으면 그대로 제출할 수 있어요.' });
      else if (poll.show_results) setView({ type: 'results', poll, questions: result.questions });
      else showSuccess('내 응답이 등록돼 있어요.');
    } catch { if (currentActor.current === owner) showError('내 응답을 확인하지 못했어요. 연결을 확인한 뒤 다시 확인해 주세요.'); }
    finally { responseCheck.current = false; setCheckingResponse(false); }
  };

  const closePoll = async (pollId: string) => {
    const { error } = await supabase.from('polls').update({ is_active: false }).eq('id', pollId);
    if (error) { showError('투표를 마감하지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
    showSuccess('마감했어요.'); loadPolls();
  };

  const deletePoll = async (pollId: string) => {
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) { showError('투표를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
    showSuccess('삭제했어요.'); loadPolls();
  };

  if (dbMissing) return (
    <section className="cb-page-content px-4 py-16 flex flex-col items-center gap-5 text-center max-w-lg mx-auto">
      <p className="text-4xl">⚠️</p>
      <h1 className="cb-page-title">투표를 준비하고 있어요</h1>
      <p className="text-sm text-muted-foreground">투표 정보를 확인하지 못했어요. 잠시 후 다시 확인하거나 관리자에게 알려 주세요.</p><Button variant="outline" onClick={() => { setDbMissing(false); void loadPolls(); }}>다시 확인하기</Button>
    </section>
  );

  // ── sub-views ──
  if (view.type === 'builder') return (
    <section className="cb-page-content py-4">
      <PollBuilder poll={view.poll} onSaved={() => { loadPolls(); setView({ type: 'list' }); }} onBack={() => setView({ type: 'list' })} />
    </section>
  );
  if (view.type === 'form') return (
    <section className="cb-page-content py-4">
      <PollForm poll={view.poll} questions={view.questions} notice={view.notice}
        onSubmitted={() => { loadPolls(); setView(view.poll.show_results || isAdmin ? { type: 'results', poll: view.poll, questions: view.questions } : { type: 'list' }); }}
        onBack={() => { setView({ type: 'list' }); void loadPolls(); }} />
    </section>
  );
  if (view.type === 'results') return (
    <section className="cb-page-content py-4">
      <PollResults poll={view.poll} questions={view.questions} onBack={() => setView({ type: 'list' })} />
    </section>
  );

  // ── list ──
  const shown = polls.filter(p => tab === 'active' ? (p.is_active && (!p.ends_at || new Date(p.ends_at) >= new Date())) : isClosed(p));

  return (
    <section className="cb-page-content py-4 space-y-6 max-w-2xl mx-auto">
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="투표를 삭제할까요?"
        description="투표와 모든 응답이 삭제돼요. 되돌릴 수 없어요."
        onConfirm={() => { deletePoll(confirmDeleteId!); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cb-page-title">투표</h1>
          <p className="cb-page-sub mt-1">학교 행사 · 대회 · 설문</p>
        </div>
        {isAdmin && <Button onClick={() => setView({ type: 'builder' })} className="font-semibold gap-2"><Plus className="size-4" />투표 만들기</Button>}
      </div>

      <SegmentedTabs
        items={(['active', 'closed'] as const).map(t => ({
          value: t,
          label: `${t === 'active' ? '진행 중' : '마감'} (${polls.filter(p => t === 'active' ? (p.is_active && (!p.ends_at || new Date(p.ends_at) >= new Date())) : isClosed(p)).length})`,
        }))}
        value={tab}
        onChange={(v) => setTab(v as 'active' | 'closed')}
      />

      {loading || justFinished ? <div className="py-16 flex items-center justify-center"><LoadingSpinner done={justFinished} size={56} label="투표 불러오는 중" /></div>
      : loadError ? <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-5"><p className="text-sm">{loadError}</p><Button variant="outline" onClick={() => void loadPolls()}>투표 다시 불러오기</Button></div> : shown.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed rounded-2xl text-muted-foreground font-medium">
          {tab === 'active' ? '아직 진행 중인 투표가 없어요.' : '아직 마감된 투표가 없어요.'}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((poll, i) => {
            const voted   = myResponses.includes(poll.id);
            const closed  = isClosed(poll);
            return (
              <div
                key={poll.id}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="p-4 border border-border/50 rounded-2xl bg-card hover:bg-muted/20 tilt-3d transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                onClick={() => openPoll(poll)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm leading-tight">{poll.title}</h3>
                      {voted  && <Badge variant="success" icon={<CheckCircle2 className="size-2.5" />}>참여완료</Badge>}
                      {closed && <Badge variant="muted" icon={<Lock className="size-2.5" />}>마감</Badge>}
                    </div>
                    {poll.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{poll.description}</p>}
                    {poll.ends_at && <p className="text-sm text-muted-foreground mt-1">~{fmtDate(poll.ends_at)}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {(voted || closed) && (poll.show_results || isAdmin) && (
                      <Button variant="ghost" size="icon" aria-label="투표 결과 보기" className="size-11" onClick={() => openPoll(poll)}><BarChart3 className="size-3.5" /></Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" aria-label="투표 수정" className="size-11" onClick={() => setView({ type: 'builder', poll })}><Edit3 className="size-3.5" /></Button>
                        {poll.is_active && !closed && <Button variant="ghost" size="icon" aria-label="투표 마감" className="size-11 text-amber-600 dark:text-amber-400" onClick={() => closePoll(poll.id)}><Lock className="size-3.5" /></Button>}
                        <Button variant="ghost" size="icon" aria-label="투표 삭제" className="size-11 text-destructive" onClick={() => setConfirmDeleteId(poll.id)}><Trash2 className="size-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>
                {voted && <div className="mt-3" onClick={event => event.stopPropagation()}><Button variant="outline" size="sm" disabled={checkingResponse} onClick={() => void checkMyResponse(poll)}>{checkingResponse ? '확인 중…' : '내 응답 확인'}</Button></div>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
