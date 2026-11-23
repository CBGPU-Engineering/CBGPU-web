'use client';
import '@/components/manufacturing/manufacturing-requests.css';
import {scopedManufacturingFilesEnabled} from '@/lib/manufacturing/fileAccess';
import {useManufacturingDownloader} from '@/lib/manufacturing/useManufacturingFile';
import {useSchoolResourcePermission} from '@/components/schools/SchoolResourceScope';
import{manufacturingProfiles,manufacturingJobSelect,scopedProfilesEnabled,attachManufacturingManagers}from'@/lib/scopedProfiles';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import {queuedPrintJobsForPrinter} from '@/lib/manufacturing/printerQueue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/spinner';
import { PrinterVisual } from '@/components/manufacturing/PrinterVisual';
import { LocateStudentButton } from '@/components/manufacturing/LocateStudentButton';
import { deleteManufacturingFile } from '@/lib/manufacturing/storage';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Printer, Scissors, Plus, Clock, CheckCircle2, XCircle, ShieldAlert,
  Boxes, Play, Square, ExternalLink, Download, Wrench, Undo2, X, Layers, User, PackageCheck,
} from 'lucide-react';

type Tab = 'print' | 'laser' | 'print_manager' | 'laser_manager';

const DURATION_PRESETS = [
  { label: '1시간', hours: 1 },
  { label: '2시간', hours: 2 },
  { label: '4시간', hours: 4 },
  { label: '8시간', hours: 8 },
  { label: '12시간', hours: 12 },
  { label: '24시간', hours: 24 },
];

const PRINT_STATUS_INFO: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
  pending:   { variant: 'warning', icon: <Clock className="size-3" />,        label: '승인 대기' },
  accepted:  { variant: 'default', icon: <Boxes className="size-3" />,        label: '대기열' },
  queued:    { variant: 'default', icon: <Boxes className="size-3" />,        label: '대기열' },
  printing:  { variant: 'success', icon: <Printer className="size-3" />,      label: '프린팅 중' },
  done:      { variant: 'success', icon: <CheckCircle2 className="size-3" />, label: '완료' },
  rejected:  { variant: 'danger',  icon: <XCircle className="size-3" />,      label: '거절됨' },
  canceled:  { variant: 'muted',   icon: <XCircle className="size-3" />,      label: '취소됨' },
};

const LASER_STATUS_INFO: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
  pending:     { variant: 'warning', icon: <Clock className="size-3" />,        label: '승인 대기' },
  accepted:    { variant: 'default', icon: <Boxes className="size-3" />,        label: '대기 중' },
  in_progress: { variant: 'success', icon: <Scissors className="size-3" />,     label: '작업 중' },
  done:        { variant: 'success', icon: <CheckCircle2 className="size-3" />, label: '완료' },
  rejected:    { variant: 'danger',  icon: <XCircle className="size-3" />,      label: '거절됨' },
  canceled:    { variant: 'muted',   icon: <XCircle className="size-3" />,      label: '취소됨' },
};

export default function ManufacturingPage({view='print'}:{view?:'print'|'laser'}) {
  const { user, isAdmin, is3DPrintManager, managedPrinterIds, isLaserCutManager, isLoading: authLoading } = useAuth();
  const freshFileDownload=useManufacturingDownloader(user?.id);
  const fabrication=useSchoolResourcePermission('fabrication',true),scopedRequests=scopedManufacturingFilesEnabled();
  const canCreateRequest=!scopedRequests||fabrication.enabled&&fabrication.allowed;
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const tab = view as Tab;
  async function newRequest(kind:'print'|'laser'){if(scopedRequests){try{if(!fabrication.enabled||!await fabrication.verify()){showError('이전 신청은 볼 수 있어요. 새 신청에는 현재 학교의 제작 장비 이용 권한이 필요해요.');return;}}catch{showError('제작 장비 이용 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');return;}}router.push('/manufacturing/'+kind+'/new');}

  // ── 3D printing (requester) ───────────────────────────────────────────
  const [printers, setPrinters] = useState<any[]>([]);
  const [myPrintJobs, setMyPrintJobs] = useState<any[]>([]);
  const [printLoading, setPrintLoading] = useState(true);

  const fetchPrinters = async () => {
    const { data, error } = await supabase.from('printers').select('*').order('id');
    if (!error) setPrinters(data || []);
  };

  const fetchMyPrintJobs = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('print_jobs')
      .select(manufacturingJobSelect())
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) {const labels=await attachManufacturingManagers(supabase,'print',data||[]);setMyPrintJobs(labels.data);if(labels.error)showError('담당자 표시 정보를 확인하지 못했어요.');}
  };

  const [printQueueLength, setPrintQueueLength] = useState<number | null>(null);
  const fetchPrintQueueLength = async () => {
    const { data, error } = await supabase.rpc('print_queue_length');
    if (!error) setPrintQueueLength(data);
  };

  const [plateBacklog, setPlateBacklog] = useState<Record<number, number>>({});
  const fetchPlateBacklog = async () => {
    const { data, error } = await supabase.rpc('printer_plate_backlog');
    if (!error) {
      const map: Record<number, number> = {};
      for (const row of data || []) map[row.printer_id] = row.plates;
      setPlateBacklog(map);
    }
  };

  const loadPrintTab = async () => {
    setPrintLoading(true);
    await Promise.all([fetchPrinters(), fetchMyPrintJobs(), fetchPrintQueueLength(), fetchPlateBacklog()]);
    setPrintLoading(false);
  };

  // ── Laser cutting (requester) ─────────────────────────────────────────
  const [myLaserJobs, setMyLaserJobs] = useState<any[]>([]);
  const [laserLoading, setLaserLoading] = useState(true);

  const [laserQueueLength, setLaserQueueLength] = useState<number | null>(null);

  const fetchMyLaserJobs = async () => {
    if (!user) return;
    setLaserLoading(true);
    const [{ data, error }, { data: qlen, error: qlenError }] = await Promise.all([
      supabase.from('laser_jobs').select(manufacturingJobSelect()).eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.rpc('laser_queue_length'),
    ]);
    if (!error) {const labels=await attachManufacturingManagers(supabase,'laser',data||[]);setMyLaserJobs(labels.data);if(labels.error)showError('담당자 표시 정보를 확인하지 못했어요.');}
    if (!qlenError) setLaserQueueLength(qlen);
    setLaserLoading(false);
  };

  // ── 3D manager ─────────────────────────────────────────────────────────
  const [allPrintJobs, setAllPrintJobs] = useState<any[]>([]);
  const [managerPrintLoading, setManagerPrintLoading] = useState(true);
  const [queueDialogPrinter, setQueueDialogPrinter] = useState<any | null>(null);
  const [queueJobId, setQueueJobId] = useState('');
  const [startingPrint,setStartingPrint]=useState(false);
  const [queueHours, setQueueHours] = useState(4);

  async function downloadFile(path: string,name?:string) {
    if(scopedManufacturingFilesEnabled()){try{await freshFileDownload(path,name)}catch(error){showError(error instanceof Error?error.message:'파일을 내려받을 권한을 확인하지 못했어요.')}return;}
    const { data, error } = await supabase.storage.from('manufacturing').createSignedUrl(path, 3600);
    if (error || !data) { showError('파일을 내려받을 링크를 만들지 못했어요. 다시 시도해 주세요.'); return; }
    window.open(data.signedUrl, '_blank');
  }

  // print_jobs/laser_jobs.user_id references auth.users, not profiles, so PostgREST can't
  // embed the requester's profile automatically (unlike manager_id, which references profiles
  // directly) — fetch it separately and key it by user_id for lookup in the tables below.
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, { full_name: string | null; student_id: string | null }>>({});

  async function fetchRequesterProfiles(userIds: string[], kind: 'print'|'laser') {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return;
    const { data,error } = await manufacturingProfiles(supabase,kind,uniqueIds);
    if(error){setRequesterProfiles({});showError('신청자 표시 정보를 확인하지 못했어요.');return;}
    setRequesterProfiles(prev => {
      const next:Record<string,{full_name:string|null;student_id:string|null}> = scopedProfilesEnabled()?{}:{ ...prev };
      for (const p of data || []) next[p.id] = { full_name: p.full_name, student_id: p.student_id };
      return next;
    });
  }

  function requesterLabel(job: any): string {
    const p = requesterProfiles[job.user_id];
    if (!p) return job.user_email;
    return `${p.full_name || 'Unknown'} (${p.student_id || '-'})`;
  }

  const fetchAllPrintJobs = async () => {
    setManagerPrintLoading(true);
    const { data, error } = await supabase
      .from('print_jobs')
      .select(manufacturingJobSelect())
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error) {
      const labels=await attachManufacturingManagers(supabase,'print',data||[]);setAllPrintJobs(labels.data);if(labels.error)showError('담당자 표시 정보를 확인하지 못했어요.');
      fetchRequesterProfiles((data || []).map((j:any) => j.user_id),'print');
    }
    setManagerPrintLoading(false);
  };

  const loadPrintManagerTab = async () => {
    await Promise.all([fetchPrinters(), fetchAllPrintJobs(), fetchFilamentCatalog(), fetchPlateBacklog()]);
  };

  // ── Filament catalog (managed by 3D managers) ─────────────────────────────
  const [filamentCatalog, setFilamentCatalog] = useState<any[]>([]);
  const [newFilamentMaterial, setNewFilamentMaterial] = useState('');
  const [newFilamentColor, setNewFilamentColor] = useState('');
  const [newFilamentStock, setNewFilamentStock] = useState('1');

  const fetchFilamentCatalog = async () => {
    const { data, error } = await supabase.from('print_materials').select('*').order('material').order('color');
    if (!error) setFilamentCatalog(data || []);
  };

  async function addFilamentEntry() {
    if (!newFilamentMaterial.trim()) { showError('재질을 입력해 주세요.'); return; }
    if (!newFilamentColor.trim()) { showError('색상을 입력해 주세요.'); return; }
    const stock = parseInt(newFilamentStock);
    if (isNaN(stock) || stock < 0) { showError('재고 수량을 확인해 주세요.'); return; }
    const { error } = await supabase.from('print_materials').insert({ material: newFilamentMaterial.trim(), color: newFilamentColor.trim(), stock_count: stock });
    if (error) showError(error.code === '23505' ? '이미 등록된 재질과 색상이에요.' : '항목을 추가하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.');
    else { showSuccess('필라멘트를 등록했어요.'); setNewFilamentMaterial(''); setNewFilamentColor(''); setNewFilamentStock('1'); fetchFilamentCatalog(); }
  }

  async function adjustFilamentStock(id: string, delta: number) {
    const f = filamentCatalog.find(x => x.id === id);
    if (!f) return;
    const next = Math.max(0, f.stock_count + delta);
    const { error } = await supabase.from('print_materials').update({ stock_count: next }).eq('id', id);
    if (error) showError('재고를 저장하지 못했어요. 현재 수량을 확인하고 다시 시도해 주세요.');
    else fetchFilamentCatalog();
  }

  async function removeFilamentEntry(id: string) {
    const { error } = await supabase.from('print_materials').delete().eq('id', id);
    if (error) showError('삭제하지 못했어요. 목록을 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('필라멘트를 삭제했어요.'); fetchFilamentCatalog(); }
  }

  async function updatePrintJobStatus(id: string, status: string) {
    const updates: Record<string, any> = { status };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    // Claim the job for whoever accepts it, if the requester didn't pick a specific manager.
    if (status === 'accepted') {
      const job = allPrintJobs.find(j => j.id === id);
      if (job && !job.manager_id && user) updates.manager_id = user.id;
    }
    const { error } = await supabase.from('print_jobs').update(updates).eq('id', id);
    if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('상태를 변경했어요.'); fetchAllPrintJobs(); }
  }

  async function rejectPrintJob(id: string, reason: string) {
    const { error } = await supabase.from('print_jobs').update({ status: 'rejected', reject_reason: reason || null }).eq('id', id);
    if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('신청을 거절했어요.'); fetchAllPrintJobs(); }
  }

  async function markPrintDelivered(job: any) {
    const { error } = await supabase.from('print_jobs')
      .update({ delivered_at: new Date().toISOString(), file_path: null, file_name: null })
      .eq('id', job.id);
    if (error) { showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.'); return; }
    await deleteManufacturingFile(job.file_path);
    showSuccess('전달 완료로 표시했어요.');
    fetchAllPrintJobs();
  }

  const openQueueDialog = (printer: any) => {
    setQueueDialogPrinter(printer);
    setQueueJobId('');
    setQueueHours(4);
  };

  async function startPrint() {
    if(startingPrint)return;
    const job=queuedPrintJobsForPrinter(allPrintJobs,queueDialogPrinter?.id).find(item=>item.id===queueJobId);
    if(!queueDialogPrinter||!job){showError("이 프린터로 신청한 대기 작업을 선택해 주세요.");return}
    if(!Number.isFinite(queueHours)||queueHours<=0){showError("예상 시간을 0보다 크게 입력해 주세요.");return}
    setStartingPrint(true);
    try{const {error}=await supabase.rpc('start_print_job',{p_job_id:job.id,p_printer_id:queueDialogPrinter.id,p_hours:queueHours});
      if(error){showError('인쇄 시작을 기록하지 못했어요. 대기열 상태를 확인해 주세요.');setQueueJobId('');await loadPrintManagerTab();return}
      showSuccess("작업을 인쇄 중으로 기록했어요.");setQueueDialogPrinter(null);await loadPrintManagerTab();
    }finally{setStartingPrint(false)}
  }

  // A job's plates print one at a time on the physical bed, so a multi-plate job is completed
  // plate by plate rather than all at once. Completing the last plate finishes the whole job.
  // Before actually applying the completion, we ask whether any filament spool ran out during
  // this plate, so stock_count can be decremented right away instead of drifting out of date.
  const [plateCompleteTarget, setPlateCompleteTarget] = useState<{ printer: any; job: any } | null>(null);
  const [usedUpFilamentIds, setUsedUpFilamentIds] = useState<string[]>([]);

  function openPlateComplete(printer: any, job: any) {
    setPlateCompleteTarget({ printer, job });
    setUsedUpFilamentIds([]);
  }

  function toggleUsedUpFilament(id: string) {
    setUsedUpFilamentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function confirmPlateComplete() {
    if (!plateCompleteTarget) return;
    const { printer, job } = plateCompleteTarget;

    for (const filamentId of usedUpFilamentIds) {
      const f = filamentCatalog.find(x => x.id === filamentId);
      if (f) await supabase.from('print_materials').update({ stock_count: Math.max(0, f.stock_count - 1) }).eq('id', filamentId);
    }
    if (usedUpFilamentIds.length > 0) fetchFilamentCatalog();

    const newCompleted = (job.plates_completed || 0) + 1;

    if (newCompleted >= job.plate_count) {
      await supabase.from('print_jobs').update({
        plates_completed: newCompleted,
        status: 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', job.id);
      // The printer stays occupied (status 'done') until someone actually collects the part —
      // it isn't really free just because printing stopped.
      const { error } = await supabase.from('printers').update({
        status: 'done',
        estimated_end_at: null,
      }).eq('id', printer.id);
      if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
      else showSuccess('프린터를 인쇄 완료로 표시했어요. 출력물을 회수한 뒤 회수 완료를 선택해 주세요.');
    } else {
      const { error } = await supabase.from('print_jobs').update({ plates_completed: newCompleted }).eq('id', job.id);
      if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
      else showSuccess(`${newCompleted}개 플레이트를 완료로 기록했어요.`);
    }

    setPlateCompleteTarget(null);
    loadPrintManagerTab();
  }

  async function collectPrint(printer: any) {
    if (printer.current_job_id) {
      await supabase.from('print_jobs').update({ collected_at: new Date().toISOString() }).eq('id', printer.current_job_id);
    }
    const { error } = await supabase.from('printers').update({
      status: 'idle',
      current_job_id: null,
      started_at: null,
      estimated_end_at: null,
    }).eq('id', printer.id);
    if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('프린터를 사용 가능으로 표시했어요.'); loadPrintManagerTab(); }
  }

  async function markPrinterBroken(printer: any) {
    // If a job was actually printing (not just finished and awaiting pickup), don't mark it
    // done — send it back to the queue instead.
    if (printer.current_job_id && printer.status === 'printing') {
      await supabase.from('print_jobs').update({
        status: 'accepted',
        printer_id: null,
        started_at: null,
        estimated_end_at: null,
      }).eq('id', printer.current_job_id);
    }
    const { error } = await supabase.from('printers').update({
      status: 'maintenance',
      current_job_id: null,
      started_at: null,
      estimated_end_at: null,
    }).eq('id', printer.id);
    if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('프린터를 고장으로 표시했어요.'); loadPrintManagerTab(); }
  }

  async function repairPrinter(printer: any) {
    const { error } = await supabase.from('printers').update({ status: 'idle' }).eq('id', printer.id);
    if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('프린터를 사용 가능으로 표시했어요.'); loadPrintManagerTab(); }
  }

  // ── Laser manager ──────────────────────────────────────────────────────
  const [allLaserJobs, setAllLaserJobs] = useState<any[]>([]);
  const [managerLaserLoading, setManagerLaserLoading] = useState(true);

  const fetchAllLaserJobs = async () => {
    setManagerLaserLoading(true);
    const { data, error } = await supabase
      .from('laser_jobs')
      .select(manufacturingJobSelect())
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error) {
      const labels=await attachManufacturingManagers(supabase,'laser',data||[]);setAllLaserJobs(labels.data);if(labels.error)showError('담당자 표시 정보를 확인하지 못했어요.');
      fetchRequesterProfiles((data || []).map((j:any) => j.user_id),'laser');
    }
    setManagerLaserLoading(false);
  };

  async function updateLaserJobStatus(id: string, status: string) {
    const updates: Record<string, any> = { status };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    if (status === 'accepted') {
      const job = allLaserJobs.find(j => j.id === id);
      if (job && !job.manager_id && user) updates.manager_id = user.id;
    }
    const { error } = await supabase.from('laser_jobs').update(updates).eq('id', id);
    if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('상태를 변경했어요.'); fetchAllLaserJobs(); }
  }

  async function rejectLaserJob(id: string, reason: string) {
    const { error } = await supabase.from('laser_jobs').update({ status: 'rejected', reject_reason: reason || null }).eq('id', id);
    if (error) showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('신청을 거절했어요.'); fetchAllLaserJobs(); }
  }

  async function markLaserDelivered(job: any) {
    const { error } = await supabase.from('laser_jobs')
      .update({ delivered_at: new Date().toISOString(), file_path: null, file_name: null })
      .eq('id', job.id);
    if (error) { showError('변경 내용을 저장하지 못했어요. 상태를 새로 확인하고 다시 시도해 주세요.'); return; }
    await deleteManufacturingFile(job.file_path);
    showSuccess('전달 완료로 표시했어요.');
    fetchAllLaserJobs();
  }

  // ── Laser materials catalog (managed by laser managers) ──────────────────
  const [laserCatalog, setLaserCatalog] = useState<any[]>([]);
  const [newCatalogMaterial, setNewCatalogMaterial] = useState<'mdf' | 'acrylic'>('mdf');
  const [newCatalogThickness, setNewCatalogThickness] = useState('3');

  const fetchLaserCatalog = async () => {
    const { data, error } = await supabase.from('laser_materials').select('*').order('material').order('thickness_mm');
    if (!error) setLaserCatalog(data || []);
  };

  async function addLaserCatalogEntry() {
    const thicknessNum = parseFloat(newCatalogThickness);
    if (isNaN(thicknessNum) || thicknessNum <= 0) { showError('두께를 0보다 크게 입력해 주세요.'); return; }
    const { error } = await supabase.from('laser_materials').insert({ material: newCatalogMaterial, thickness_mm: thicknessNum });
    if (error) showError(error.code === '23505' ? '이미 등록된 재질과 색상이에요.' : '항목을 추가하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.');
    else { showSuccess('재질을 등록했어요.'); fetchLaserCatalog(); }
  }

  async function removeLaserCatalogEntry(id: string) {
    const { error } = await supabase.from('laser_materials').delete().eq('id', id);
    if (error) showError('삭제하지 못했어요. 목록을 새로 확인하고 다시 시도해 주세요.');
    else { showSuccess('재질을 삭제했어요.'); fetchLaserCatalog(); }
  }

  // ── Reject dialog (shared by both manager tabs) ──────────────────────────
  const [rejectTarget, setRejectTarget] = useState<{ type: 'print' | 'laser'; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  function openReject(type: 'print' | 'laser', id: string) {
    setRejectTarget({ type, id });
    setRejectReason('');
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (rejectTarget.type === 'print') await rejectPrintJob(rejectTarget.id, rejectReason.trim());
    else await rejectLaserJob(rejectTarget.id, rejectReason.trim());
    setRejectTarget(null);
  }

  useEffect(() => {
    if (!user) return;
    if (tab === 'print') loadPrintTab();
    if (tab === 'laser') fetchMyLaserJobs();
    if (tab === 'print_manager' && is3DPrintManager) loadPrintManagerTab();
    if (tab === 'laser_manager' && isLaserCutManager) { fetchAllLaserJobs(); fetchLaserCatalog(); }
  }, [tab, user]);

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
        <div className="space-y-2">
          <h1 className="cb-page-title">로그인해 주세요</h1>
          <p className="cb-page-sub mt-1">
            로그인하면 내 제작 신청을 확인할 수 있어요.
          </p>
        </div>
        <Button onClick={() => router.push('/auth/login')} className="font-black px-10 h-12 uppercase tracking-widest">
          로그인하기
        </Button>
      </div>
    );
  }

  // FIFO is independent for each requested printer.
  const idleJobsForQueue=queuedPrintJobsForPrinter(allPrintJobs,queueDialogPrinter?.id);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {scopedRequests&&!canCreateRequest&&(tab==='print'||tab==='laser')&&<p role="status" className="rounded-xl border p-4 text-sm text-muted-foreground">이전 신청은 볼 수 있어요. 새 신청에는 현재 학교의 제작 장비 이용 권한이 필요해요.</p>}
      {/* ── 3D printing (requester) ── */}
      {tab === 'print' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-black uppercase text-sm tracking-widest">프린터 현황 (Bambu Lab X1C)</h2>
              {printQueueLength !== null && printQueueLength > 0 && (
                <Badge variant="warning" icon={<Clock className="size-3" />}>대기열 {printQueueLength}건</Badge>
              )}
            </div>
            <Button onClick={() => void newRequest('print')} disabled={!canCreateRequest} className="font-black text-xs uppercase gap-1.5 h-9">
              <Plus className="size-3.5" /> 신청하기
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {printers.map(p => (
              <Card key={p.id} data-printer-id={p.id} className="p-4 rounded-2xl space-y-2">
                <PrinterVisual status={p.status} />
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">{p.name}</span>
                  {p.status === 'printing'
                    ? <Badge variant="success" icon={<Printer className="size-3" />}>사용 중</Badge>
                    : p.status === 'done'
                      ? <Badge variant="warning" icon={<CheckCircle2 className="size-3" />}>회수 대기</Badge>
                      : p.status === 'maintenance'
                        ? <Badge variant="danger">고장</Badge>
                        : <Badge variant="muted">대기</Badge>}
                </div>
                {p.status === 'printing' && p.estimated_end_at && (
                  <p className="text-xs text-muted-foreground font-bold">
                    {formatDistanceToNow(new Date(p.estimated_end_at), { locale: ko, addSuffix: true })} 완료 예정
                  </p>
                )}
                <p className="text-xs text-muted-foreground opacity-70">대기 중인 플레이트 {plateBacklog[p.id] || 0}개</p>
              </Card>
            ))}
          </div>

          <h2 className="font-black uppercase text-sm tracking-widest">내 신청 내역</h2>
          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <Table className="cb-manufacturing-requests">
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6">파일</TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4">모드</TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4">상태</TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6">신청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printLoading ? (
                    <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                  ) : myPrintJobs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground">아직 신청 내역이 없어요.</TableCell></TableRow>
                  ) : (
                    myPrintJobs.map(j => {
                      const info = PRINT_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                      return (
                        <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0 cursor-pointer align-top" onClick={() => router.push(`/manufacturing/print/${j.id}`)}>
                          <TableCell data-label="파일" className="py-4 px-6">
                            <div className="flex flex-col gap-0.5">
                              <Link href={`/manufacturing/print/${j.id}`} onClick={event=>event.stopPropagation()} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{j.file_name || '—'}</Link>
                              {j.manager?.full_name && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> {j.manager.full_name}</span>}
                              {j.status === 'rejected' && j.reject_reason && <span className="text-xs text-destructive font-bold">거절 사유: {j.reject_reason}</span>}
                            </div>
                          </TableCell>
                          <TableCell data-label="모드" className="py-4"><span className="text-xs font-black uppercase">{j.mode === 'beginner' ? '초보자' : '고급자'}</span></TableCell>
                          <TableCell data-label="상태" className="py-4"><Badge variant={info.variant} icon={info.icon}>{info.label}</Badge></TableCell>
                          <TableCell data-label="신청일" className="py-4 px-6 text-xs text-muted-foreground font-bold">{new Date(j.created_at).toLocaleString('ko-KR')}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ── Laser cutting (requester) ── */}
      {tab === 'laser' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-black uppercase text-sm tracking-widest">내 신청 내역</h2>
              {laserQueueLength !== null && laserQueueLength > 0 && (
                <Badge variant="warning" icon={<Clock className="size-3" />}>대기열 {laserQueueLength}건</Badge>
              )}
            </div>
            <Button onClick={() => void newRequest('laser')} disabled={!canCreateRequest} className="font-black text-xs uppercase gap-1.5 h-9">
              <Plus className="size-3.5" /> 신청하기
            </Button>
          </div>
          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <Table className="cb-manufacturing-requests">
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6">파일</TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4">재질</TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4">상태</TableHead>
                    <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6">신청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laserLoading ? (
                    <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                  ) : myLaserJobs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground">아직 신청 내역이 없어요.</TableCell></TableRow>
                  ) : (
                    myLaserJobs.map(j => {
                      const info = LASER_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                      return (
                        <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0 cursor-pointer align-top" onClick={() => router.push(`/manufacturing/laser/${j.id}`)}>
                          <TableCell data-label="파일" className="py-4 px-6">
                            <div className="flex flex-col gap-0.5">
                              <Link href={`/manufacturing/laser/${j.id}`} onClick={event=>event.stopPropagation()} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{j.file_name || '—'}</Link>
                              {j.manager?.full_name && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> {j.manager.full_name}</span>}
                              {j.status === 'rejected' && j.reject_reason && <span className="text-xs text-destructive font-bold">거절 사유: {j.reject_reason}</span>}
                            </div>
                          </TableCell>
                          <TableCell data-label="재질" className="py-4 text-xs font-black uppercase">{j.material === 'mdf' ? 'MDF' : '아크릴'}{j.thickness_mm ? ` · ${j.thickness_mm}mm` : ''}</TableCell>
                          <TableCell data-label="상태" className="py-4"><Badge variant={info.variant} icon={info.icon}>{info.label}</Badge></TableCell>
                          <TableCell data-label="신청일" className="py-4 px-6 text-xs text-muted-foreground font-bold">{new Date(j.created_at).toLocaleString('ko-KR')}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D manager ── */}
      {tab === 'print_manager' && is3DPrintManager && (
        <div className="space-y-8">
          <Card className="p-6 rounded-2xl space-y-3">
            <h2 className="font-black uppercase text-xs tracking-widest flex items-center gap-1.5"><Layers className="size-4" /> 필라멘트 카탈로그</h2>
            <p className="text-xs text-muted-foreground font-bold opacity-70">
              보유한 필라멘트만 등록해 주세요. 신청자는 등록된 조합을 고르거나 &ldquo;상관없음&rdquo;을 선택할 수 있어요.
            </p>
            {filamentCatalog.length === 0 ? (
              <p className="text-xs text-muted-foreground">등록된 필라멘트가 없어요.</p>
            ) : (
              <div className="space-y-1.5">
                {filamentCatalog.map(f => (
                  <div key={f.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 ${f.stock_count === 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                    <span className="text-xs font-bold">
                      {f.material} · {f.color}{f.stock_count === 0 && <span className="text-destructive ml-1.5">품절</span>}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => adjustFilamentStock(f.id, -1)} className="flex items-center justify-center size-6 rounded-full hover:bg-muted transition-colors font-black text-sm">−</button>
                      <span className="text-xs font-black w-6 text-center">{f.stock_count}</span>
                      <button onClick={() => adjustFilamentStock(f.id, 1)} className="flex items-center justify-center size-6 rounded-full hover:bg-muted transition-colors font-black text-sm">+</button>
                      <button onClick={() => removeFilamentEntry(f.id)} className="ml-1 flex items-center justify-center size-6 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <X className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input value={newFilamentMaterial} onChange={e => setNewFilamentMaterial(e.target.value)} className="h-9 w-28 text-xs" placeholder="재질 (예: PLA Basic)" />
              <Input value={newFilamentColor} onChange={e => setNewFilamentColor(e.target.value)} className="h-9 w-28 text-xs" placeholder="색상 (예: 블랙)" />
              <Input type="number" min="0" value={newFilamentStock} onChange={e => setNewFilamentStock(e.target.value)} className="h-9 w-16 text-xs" placeholder="재고" />
              <Button size="sm" className="h-9 px-3 font-black text-xs uppercase gap-1" onClick={addFilamentEntry}>
                <Plus className="size-3.5" /> 추가
              </Button>
            </div>
          </Card>

          <div>
            <h2 id="printer-queues" className="font-black uppercase text-sm tracking-widest mb-3">프린터 대기열</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {printers.map(p => {
                const isMine = managedPrinterIds.includes(p.id);
                return (
                  <Card key={p.id} data-printer-id={p.id} className="p-4 rounded-2xl space-y-3">
                    <PrinterVisual status={p.status} />
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">{p.name}</span>
                      {p.status === 'printing'
                        ? <Badge variant="success" icon={<Printer className="size-3" />}>사용 중</Badge>
                        : p.status === 'done'
                          ? <Badge variant="warning" icon={<CheckCircle2 className="size-3" />}>회수 대기</Badge>
                          : p.status === 'maintenance'
                            ? <Badge variant="danger">고장</Badge>
                            : <Badge variant="muted">대기</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground opacity-70">대기 중인 플레이트 {plateBacklog[p.id] || 0}개</p>

                    {!isMine ? (
                      <p className="text-xs text-muted-foreground font-bold opacity-50 text-center py-1">담당 프린터가 아니에요</p>
                    ) : p.status === 'maintenance' ? (
                      <Button size="sm" variant="outline" className="w-full font-black text-xs uppercase gap-1.5" onClick={() => repairPrinter(p)}>
                        <Undo2 className="size-3" /> 사용 가능으로 표시
                      </Button>
                    ) : p.status === 'done' ? (
                      <>
                        <p className="text-xs text-muted-foreground font-bold">인쇄를 마쳤어요. 출력물을 회수해 주세요.</p>
                        <Button size="sm" className="w-full font-black text-xs uppercase gap-1.5" onClick={() => collectPrint(p)}>
                          <CheckCircle2 className="size-3" /> 회수 완료
                        </Button>
                        <Button size="sm" variant="destructive" className="w-full font-black text-xs uppercase gap-1.5" onClick={() => markPrinterBroken(p)}>
                          <Wrench className="size-3" /> 고장으로 표시
                        </Button>
                      </>
                    ) : p.status === 'printing' ? (
                      <>
                        {p.estimated_end_at && (
                          <p className="text-xs text-muted-foreground font-bold">
                            {formatDistanceToNow(new Date(p.estimated_end_at), { locale: ko, addSuffix: true })} 완료 예정
                          </p>
                        )}
                        {(() => {
                          const job = allPrintJobs.find(j => j.id === p.current_job_id);
                          if (!job) return null;
                          if (job.plate_count > 1) {
                            return (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-bold text-center">플레이트 {job.plates_completed}/{job.plate_count} 완료</p>
                                <div className="grid grid-cols-4 gap-1">
                                  {Array.from({ length: job.plate_count }, (_, idx) => {
                                    const plateNum = idx + 1;
                                    const done = plateNum <= job.plates_completed;
                                    const isNext = plateNum === job.plates_completed + 1;
                                    return (
                                      <Button
                                        key={plateNum}
                                        size="sm"
                                        variant={done ? 'outline' : 'default'}
                                        disabled={!isNext}
                                        className="text-xs font-black px-0"
                                        onClick={() => openPlateComplete(p, job)}
                                      >
                                        {done ? <CheckCircle2 className="size-3" /> : plateNum}
                                      </Button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <Button size="sm" variant="outline" className="w-full font-black text-xs uppercase gap-1.5" onClick={() => openPlateComplete(p, job)}>
                              <Square className="size-3" /> 출력 완료
                            </Button>
                          );
                        })()}
                        <Button size="sm" variant="destructive" className="w-full font-black text-xs uppercase gap-1.5" onClick={() => markPrinterBroken(p)}>
                          <Wrench className="size-3" /> 고장으로 표시
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="w-full font-black text-xs uppercase gap-1.5"
                          disabled={queuedPrintJobsForPrinter(allPrintJobs,p.id).length === 0}
                          onClick={() => openQueueDialog(p)}
                        >
                          <Play className="size-3" /> 인쇄 시작
                        </Button>
                        <Button size="sm" variant="destructive" className="w-full font-black text-xs uppercase gap-1.5" onClick={() => markPrinterBroken(p)}>
                          <Wrench className="size-3" /> 고장으로 표시
                        </Button>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-black uppercase text-sm tracking-widest mb-3">전체 신청 목록</h2>
            <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <Table className="cb-manufacturing-requests">
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6">신청자</TableHead>
                      <TableHead className="font-black uppercase text-xs tracking-widest py-4">모드/파일</TableHead>
                      <TableHead className="font-black uppercase text-xs tracking-widest py-4">상태</TableHead>
                      <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6 text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managerPrintLoading ? (
                      <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                    ) : allPrintJobs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground">아직 신청 내역이 없어요.</TableCell></TableRow>
                    ) : (
                      allPrintJobs.map(j => {
                        const info = PRINT_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                        return (
                          <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0 align-top">
                            <TableCell data-label="신청자" className="py-4 px-6 text-xs font-bold">{requesterLabel(j)}</TableCell>
                            <TableCell data-label="모드/파일" className="py-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black uppercase">{j.mode === 'beginner' ? '초보자' : '고급자'} · {j.quantity}개 · 플레이트 {j.plate_count}개{j.material ? ` · ${j.material}` : ''}{j.color ? ` · ${j.color}` : ''}</span>
                                {j.preferred_printer_id && <span className="text-xs text-muted-foreground">희망 프린터: {printers.find(p => p.id === j.preferred_printer_id)?.name || `#${j.preferred_printer_id}`}</span>}
                                {j.purpose && <span className="text-xs font-bold text-muted-foreground">{j.purpose}</span>}
                                {j.manager?.full_name && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> 담당: {j.manager.full_name}</span>}
                                <Link href={`/manufacturing/print/${j.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                  상세 보기 <ExternalLink className="size-3" />
                                </Link>
                                {j.file_path && (
                                  <button onClick={() => downloadFile(j.file_path,j.file_name)} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                                    <Download className="size-3" /> {j.file_name}{j.mode === 'advanced' ? ' (슬라이싱 완료 — 출력용)' : ' (슬라이싱 필요)'}
                                  </button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell data-label="상태" className="py-4">
                              <Badge variant={info.variant} icon={info.icon}>{info.label}</Badge>
                              {j.status === 'done' && j.delivered_at && (
                                <div className="mt-1"><Badge variant="success" icon={<PackageCheck className="size-3" />}>전달 완료</Badge></div>
                              )}
                            </TableCell>
                            <TableCell data-label="작업" className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-2 flex-wrap">
                                {j.status === 'pending' && (
                                  <>
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase h-8 px-3 rounded-xl" onClick={() => updatePrintJobStatus(j.id, 'accepted')}>수락</Button>
                                    <Button size="sm" variant="destructive" className="font-black text-xs uppercase h-8 px-3 rounded-xl" onClick={() => openReject('print', j.id)}>거절</Button>
                                  </>
                                )}
                                {['accepted','queued','printing'].includes(j.status)&&<Button asChild size="sm" variant="outline"><Link href="#printer-queues">프린터 대기열</Link></Button>}
                                {j.status === 'done' && !j.delivered_at && (
                                  <>
                                    <LocateStudentButton studentId={requesterProfiles[j.user_id]?.student_id} studentName={requesterProfiles[j.user_id]?.full_name} />
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase h-8 px-3 rounded-xl gap-1" onClick={() => markPrintDelivered(j)}>
                                      <PackageCheck className="size-3.5" /> 전달 완료
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Laser manager ── */}
      {tab === 'laser_manager' && isLaserCutManager && (
        <div className="space-y-8">
          <Card className="p-6 rounded-2xl space-y-3">
            <h2 className="font-black uppercase text-xs tracking-widest flex items-center gap-1.5"><Layers className="size-4" /> 재질 카탈로그</h2>
            <p className="text-xs text-muted-foreground font-bold opacity-70">
              사용 가능한 재질과 두께만 등록해 주세요. 신청자는 등록된 조합만 고를 수 있어요. 재고 수량은 관리하지 않아요.
            </p>
            {laserCatalog.length === 0 ? (
              <p className="text-xs text-muted-foreground">등록된 재질이 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {laserCatalog.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                    {c.material === 'mdf' ? 'MDF' : '아크릴'} {c.thickness_mm}mm
                    <button onClick={() => removeLaserCatalogEntry(c.id)} className="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select value={newCatalogMaterial} onValueChange={v => setNewCatalogMaterial(v as 'mdf' | 'acrylic')}>
                <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mdf">MDF</SelectItem>
                  <SelectItem value="acrylic">아크릴</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" step="0.5" min="0" value={newCatalogThickness} onChange={e => setNewCatalogThickness(e.target.value)} className="h-9 w-28 text-xs" placeholder="두께(mm)" />
              <Button size="sm" className="h-9 px-3 font-black text-xs uppercase gap-1" onClick={addLaserCatalogEntry}>
                <Plus className="size-3.5" /> 추가
              </Button>
            </div>
          </Card>

          <div className="border-2 rounded-3xl bg-card overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <Table className="cb-manufacturing-requests">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6">신청자</TableHead>
                  <TableHead className="font-black uppercase text-xs tracking-widest py-4">재질/파일</TableHead>
                  <TableHead className="font-black uppercase text-xs tracking-widest py-4">상태</TableHead>
                  <TableHead className="font-black uppercase text-xs tracking-widest py-4 px-6 text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managerLaserLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-16"><div className="flex justify-center"><LoadingSpinner size={40} label="불러오는 중" /></div></TableCell></TableRow>
                ) : allLaserJobs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16 font-bold text-muted-foreground">아직 신청 내역이 없어요.</TableCell></TableRow>
                ) : (
                  allLaserJobs.map(j => {
                    const info = LASER_STATUS_INFO[j.status] || { variant: 'default', icon: null, label: j.status };
                    return (
                      <TableRow key={j.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell data-label="신청자" className="py-4 px-6 text-xs font-bold">{requesterLabel(j)}</TableCell>
                        <TableCell data-label="재질/파일" className="py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black uppercase">{j.material === 'mdf' ? 'MDF' : '아크릴'}{j.thickness_mm ? ` · ${j.thickness_mm}mm` : ''} × {j.quantity}</span>
                            {j.purpose && <span className="text-xs font-bold text-muted-foreground">{j.purpose}</span>}
                            {j.manager?.full_name && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-2.5" /> 담당: {j.manager.full_name}</span>}
                            <Link href={`/manufacturing/laser/${j.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                              {j.file_name || '파일 보기'} <ExternalLink className="size-3" />
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell data-label="상태" className="py-4">
                          <Badge variant={info.variant} icon={info.icon}>{info.label}</Badge>
                          {j.status === 'done' && j.delivered_at && (
                            <div className="mt-1"><Badge variant="success" icon={<PackageCheck className="size-3" />}>전달 완료</Badge></div>
                          )}
                        </TableCell>
                        <TableCell data-label="작업" className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {j.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase h-8 px-3 rounded-xl" onClick={() => updateLaserJobStatus(j.id, 'accepted')}>수락</Button>
                                <Button size="sm" variant="destructive" className="font-black text-xs uppercase h-8 px-3 rounded-xl" onClick={() => openReject('laser', j.id)}>거절</Button>
                              </>
                            )}
                            {j.status === 'accepted' && (
                              <Button size="sm" variant="outline" className="font-black text-xs uppercase h-8 px-3 rounded-xl" onClick={() => updateLaserJobStatus(j.id, 'in_progress')}>작업 시작</Button>
                            )}
                            {j.status === 'in_progress' && (
                              <Button size="sm" className="font-black text-xs uppercase h-8 px-3 rounded-xl" onClick={() => updateLaserJobStatus(j.id, 'done')}>완료</Button>
                            )}
                            {j.status === 'done' && !j.delivered_at && (
                              <>
                                <LocateStudentButton studentId={requesterProfiles[j.user_id]?.student_id} studentName={requesterProfiles[j.user_id]?.full_name} />
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase h-8 px-3 rounded-xl gap-1" onClick={() => markLaserDelivered(j)}>
                                  <PackageCheck className="size-3.5" /> 전달 완료
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </div>
        </div>
      )}

      {/* ── Plate complete dialog ── */}
      <Dialog open={!!plateCompleteTarget} onOpenChange={o => !o && setPlateCompleteTarget(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">완료 처리</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">이번 작업에서 다 쓴 필라멘트 롤을 선택해 주세요. 여러 개를 고를 수 있어요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 max-h-56 overflow-y-auto py-2">
            {filamentCatalog.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">등록된 필라멘트가 없어요.</p>
            ) : (
              filamentCatalog.map(f => (
                <label key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={usedUpFilamentIds.includes(f.id)}
                    onChange={() => toggleUsedUpFilament(f.id)}
                    className="size-4"
                  />
                  {f.material} · {f.color} <span className="text-muted-foreground opacity-60">(재고 {f.stock_count})</span>
                </label>
              ))
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-xs" onClick={() => setPlateCompleteTarget(null)}>취소</Button>
            <Button className="font-black uppercase text-xs" onClick={confirmPlateComplete}>완료 처리</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Start print dialog ── */}
      <Dialog open={!!queueDialogPrinter} onOpenChange={o => !o && setQueueDialogPrinter(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">{queueDialogPrinter?.name} 인쇄 시작</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">대기 작업을 선택하고 예상 소요 시간을 입력해 주세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">작업 선택</label>
              <Select value={queueJobId} onValueChange={setQueueJobId}>
                <SelectTrigger aria-label="인쇄 대기 작업" className="h-10 w-full text-sm"><SelectValue placeholder="— 선택 —" /></SelectTrigger>
                <SelectContent>
                  {idleJobsForQueue.map(j => (
                    <SelectItem key={j.id} value={j.id}>{requesterLabel(j)} · {j.file_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">예상 소요 시간</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {DURATION_PRESETS.map(p => (
                  <button
                    key={p.hours}
                    type="button"
                    onClick={() => setQueueHours(p.hours)}
                    className={`px-2 py-2 rounded-xl border text-xs font-black transition-all active:scale-95 ${
                      queueHours === p.hours ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={queueHours}
                  onChange={e => setQueueHours(Math.max(0, Number(e.target.value)))}
                  className="h-10 pr-14 font-bold"
                  placeholder="직접 입력"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black uppercase text-muted-foreground">시간</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-xs" onClick={() => setQueueDialogPrinter(null)}>취소</Button>
            <Button className="font-black uppercase text-xs" onClick={startPrint} disabled={startingPrint||!queueJobId}>시작</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject reason dialog ── */}
      <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter italic text-xl">신청 거절</DialogTitle>
            <DialogDescription className="text-xs font-bold opacity-60">신청자에게 표시할 거절 사유를 남겨 주세요. 선택 사항이에요.</DialogDescription>
          </DialogHeader>
          <textarea
            rows={3}
            placeholder="예: 예상 인쇄 시간이 길어 현재 처리하기 어려워요."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 resize-y"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-black uppercase text-xs" onClick={() => setRejectTarget(null)}>취소</Button>
            <Button variant="destructive" className="font-black uppercase text-xs" onClick={confirmReject}>거절하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
