'use client';
import {useAdminLanguage,adminNotice} from '@/components/admin/admin-language';
import AccountSchoolDetails from '@/components/admin/AccountSchoolDetails';
import{accountMatchesSchool,accountSchoolOptions,accountSchoolSearch,accountStudentNumberDisplay,schoolAccountApprovalScope,schoolAccountApprovalState,accountSchools}from'@/lib/adminAccountSchools';
import SchoolAdminHub from'@/components/schools/SchoolAdminHub';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatMemoryLimit } from '@/lib/formatMemoryLimit';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAlert } from '@/lib/alert';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { ShieldAlert, CheckCircle2, XCircle, Clock, Undo2, Server, Container, GitBranch, Globe, School, Lock, Users, HelpCircle, Megaphone, Printer, Scissors, Plus, X, Music, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import { PersonSearchSelect } from '@/components/manufacturing/PersonSearchSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import MaterialsStorage from '@/components/admin/MaterialsStorage';
import {filterAdminGpuReservations,matchesAdminGpuView,adminGpuViews,adminGpuHistoryBefore} from '@/lib/adminGpuReservations';
import { Trash2 } from 'lucide-react';

type AdminTab = 'gpu' | 'server' | 'accounts' | 'manufacture' | 'materials';

export default function AdminPage({sectionOverride}:{sectionOverride?:AdminTab}) {
  const params=useSearchParams(),section=sectionOverride||params.get('section');
  if(process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1'&&!section)return <SchoolAdminHub/>;
  const initialTab:AdminTab=section&&['gpu','server','accounts','manufacture','materials'].includes(section)?section as AdminTab:'gpu';
  const initialReview=params.get('review')==='1';
  return <AdminContent key={initialTab+String(initialReview)} initialTab={initialTab} initialReview={initialReview}/>;
}

function AdminContent({initialTab,initialReview}:{initialTab:AdminTab;initialReview:boolean}) {
  const {t,app}=useAdminLanguage();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { showError, showSuccess, confirm } = useAlert();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [loadErrors, setLoadErrors] = useState<Partial<Record<AdminTab, string>>>({});
  const [needsReviewOnly, setNeedsReviewOnly] = useState(initialReview);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gpuFilter, setGpuFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [schoolFilter,setSchoolFilter]=useState('all');
  const schoolAccountsEnabled=process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1';
  const modernSchoolAccount=(account:any)=>schoolAccountsEnabled&&schoolAccountApprovalScope(account,schoolFilter).kind!=='legacy';
  const accountState=(account:any)=>modernSchoolAccount(account)?schoolAccountApprovalState(account,schoolFilter):account.is_approved===true?'approved':account.is_approved===false?'restricted':'unreviewed';
  const accountStatusBadge=(account:any)=>{const state=accountState(account),personal=modernSchoolAccount(account)&&!account.school_id&&Array.isArray(account.school_affiliations)&&account.school_affiliations.length===0;return <Badge variant={state==='approved'?'success':state==='restricted'?'danger':state==='multiple'?'default':'warning'}>{personal?t('Personal account'):state==='approved'?t('Approved'):state==='restricted'?t('Restricted'):state==='multiple'?t('Select school'):state==='unavailable'?t('School unavailable'):t('Unreviewed')}</Badge>};

  const [rowActions, setRowActions] = useState<Record<string, boolean>>({});
  const activeRowActions = useRef(new Set<string>());
  async function runRowAction(key: string, action: () => Promise<void>) {
    if (activeRowActions.current.has(key)) return;
    activeRowActions.current.add(key); setRowActions(v => ({ ...v, [key]: true }));
    try { await action(); }
    catch (error) { showError(adminNotice(error instanceof Error ? error.message : t("Could not complete the operation. Please try again."))); }
    finally { activeRowActions.current.delete(key); setRowActions(v => ({ ...v, [key]: false })); }
  }
  const resetFilters = () => { setQuery(''); setNeedsReviewOnly(false); setStatusFilter('all'); setGpuFilter('all'); setRoleFilter('all'); setSchoolFilter('all'); setVisibleLimit(30); };
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('default');
  const [density, setDensity] = useState('comfortable');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  useEffect(() => { setPage(1); }, [query, needsReviewOnly, statusFilter, gpuFilter, roleFilter, schoolFilter, visibleLimit, sortOrder]);
  useEffect(() => {
    const handle = () => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    window.addEventListener('admin:search-list', handle);
    return () => window.removeEventListener('admin:search-list', handle);
  }, []);
  const selectTab = (next: AdminTab, reviewOnly = false) => {
    setTab(next);
    router.replace('/admin/'+next+(reviewOnly?'?review=1':''));
    resetFilters();
    setNeedsReviewOnly(reviewOnly);
    setVisibleLimit(30);
  };
  const router = useRouter();


  // ── GPU 예약 ────────────────────────────────────────────────────────────────
  const [reservations, setReservations] = useState<any[]>([]);
  const [gpuLoading, setGpuLoading] = useState(true);
  const [gpuJustFinished, setGpuJustFinished] = useState(false);
  const [gpuHasMore,setGpuHasMore]=useState(false);
  const [gpuLoadingMore,setGpuLoadingMore]=useState(false);
  const gpuReadVersion=useRef(0);
  const [clockNow,setClockNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setClockNow(Date.now()),30000);return()=>clearInterval(timer)},[]);

  const fetchReservations = async () => {
    const version=++gpuReadVersion.current;
    setGpuLoading(true);
    setLoadErrors(v => ({ ...v, gpu: undefined }));
    try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`*, profiles:user_id (full_name, student_id)`)
      .order('created_at', { ascending: false, nullsFirst:false }).order('id',{ascending:false})
      .limit(1000);

    if(version!==gpuReadVersion.current)return;
    if (error) { setLoadErrors(v => ({ ...v, gpu: "Could not load GPU reservations." })); showError(adminNotice("Could not load data.")); }
    else { setReservations(data || []); setGpuHasMore((data?.length||0)===1000); }
    } catch { if(version===gpuReadVersion.current)setLoadErrors(v => ({ ...v, gpu: "Could not load the list. Please try again." })); }
    if(version!==gpuReadVersion.current)return;
    setGpuLoading(false);
    setGpuJustFinished(true);
    setTimeout(() => setGpuJustFinished(false), 600);
  };

  async function loadOlderReservations(){
    if(gpuLoading||gpuLoadingMore||!gpuHasMore)return;
    const version=gpuReadVersion.current,last=reservations.at(-1);if(!last)return;
    setGpuLoadingMore(true);
    try{
      const {data,error}=await supabase.from('reservations').select('*, profiles:user_id (full_name, student_id)').order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).or(adminGpuHistoryBefore(last)).limit(1000);
      if(version!==gpuReadVersion.current)return;
      if(error)throw error;
      setReservations(previous=>[...new Map([...previous,...(data||[])].map(row=>[row.id,row])).values()]);
      setGpuHasMore((data?.length||0)===1000);setLoadErrors(previous=>({...previous,gpu:undefined}));
    }catch{if(version===gpuReadVersion.current)setLoadErrors(previous=>({...previous,gpu:'Could not load older reservations. Your loaded records are still available.'}))}
    finally{setGpuLoadingMore(false)}
  }

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending', gpuId?: number) {
    return runRowAction('gpu:' + id, async () => {
    const observed=reservations.find(row=>row.id===id);
    if(!observed){showError(adminNotice('Reservation no longer loaded. Refresh the list.'));return;}
    if(newStatus==='pending'&&!await confirm({title:t('Return this reservation to pending?'),message:t('This removes its approval. The user may lose GPU access, including an active session. The reservation record is retained.'),confirmLabel:t('Return to pending'),cancelLabel:t('Keep current status')}))return;
    if (newStatus === 'approved' && gpuId === undefined) { showError(adminNotice("A GPU number is required.")); return; }
    if (newStatus === 'approved' && gpuId !== undefined) {
      const target = reservations.find(r => r.id === id);
      if (target) {
        const conflict = reservations.find(r =>
          r.id !== id &&
          r.gpu_id === gpuId &&
          r.status === 'approved' &&
          new Date(r.start_time) < new Date(target.end_time) &&
          new Date(r.end_time) > new Date(target.start_time)
        );
        if (conflict) { showError(adminNotice("Cannot approve: this overlaps an approved reservation.")); return; }
      }
      const { error } = await supabase.rpc('approve_gpu_reservation', { p_reservation_id: id });
      if (error) showError(adminNotice("Could not confirm this change. Refresh the current record before retrying."));
      else { showSuccess(adminNotice("Reservation approved.")); await fetchReservations(); }
      return;
    }
    const { data, error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id).eq('status',observed.status).eq('end_time',observed.end_time).gt('end_time',new Date().toISOString()).select('id');
    if (error || !data?.length) showError(adminNotice("No reservation change was confirmed. Refresh the list before retrying."));
    else { showSuccess(adminNotice(`Status changed to ${newStatus}.`)); await fetchReservations(); }
    });
  }

  // ── CPU 프로젝트 ────────────────────────────────────────────────────────────
  const [cpuProjects, setCpuProjects] = useState<any[]>([]);
  const [cpuLoading, setCpuLoading] = useState(true);
  const [cpuJustFinished, setCpuJustFinished] = useState(false);

  const fetchCpuProjects = async () => {
    setCpuLoading(true);
    setLoadErrors(v => ({ ...v, server: undefined }));
    try {
    const { data, error } = await supabase
      .from('cpu_projects')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) { setLoadErrors(v => ({ ...v, server: "Could not load server projects." })); showError(adminNotice("Could not load server projects.")); }
    else setCpuProjects(data || []);
    } catch { setLoadErrors(v => ({ ...v, server: "Could not load the list. Please try again." })); }
    setCpuLoading(false);
    setCpuJustFinished(true);
    setTimeout(() => setCpuJustFinished(false), 600);
  };

  async function updateCpuStatus(id: string, newStatus: 'approved' | 'rejected' | 'pending') {
    return runRowAction('server:' + id, async () => {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'approved') {
      updates.deploy_requested_at = new Date().toISOString();
    }
    const { error } = await supabase.from('cpu_projects').update(updates).eq('id', id);
    if (error) showError(adminNotice("Could not confirm this change. Refresh the current record before retrying."));
    else { showSuccess(adminNotice(`Status changed to ${newStatus}.`)); await fetchCpuProjects(); }
    });
  }

  // ── 계정(학번/이름 확인) ────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesJustFinished, setProfilesJustFinished] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const fetchProfiles = async () => {
    setProfilesLoading(true);
    setLoadErrors(v => ({ ...v, accounts: undefined }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${session?.access_token || ''}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load accounts.");
      setProfiles(data.profiles || []);
    } catch {
      setLoadErrors(v => ({ ...v, accounts: "Could not load accounts." }));
      showError(adminNotice("Could not load accounts."));
    }
    setProfilesLoading(false);
    setProfilesJustFinished(true);
    setTimeout(() => setProfilesJustFinished(false), 600);
  };

  async function setProfileApproval(id: string, approved: boolean) {
    const account=profiles.find(profile=>profile.id===id);if(account&&modernSchoolAccount(account)){showError(adminNotice('School membership is managed in the authorized school workspace.'));return;}
    return runRowAction('account:' + id, async () => {
    const { error } = await supabase.from('profiles').update({ is_approved: approved }).eq('id', id);
    if (error) showError(adminNotice("Could not confirm this change. Refresh the current record before retrying."));
    else {
      showSuccess(adminNotice(approved ? t("Account approved.") : t("Account marked for identity review.")));
      await fetchProfiles();
    }
    });
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setIsDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showError(adminNotice("Your session expired. Please sign in again.")); return; }

      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showError(adminNotice(body?.message || "Could not delete account")); return; }

      showSuccess(adminNotice("Account deleted."));
      fetchProfiles();
    } catch (err: any) {
      showError(adminNotice(err.message || "Could not delete the account."));
    } finally {
      setIsDeletingUser(false);
      setDeleteTarget(null);
    }
  }

  async function toggleLaserManager(id: string, current: boolean) {
    const { error } = await supabase.from('profiles').update({ is_laser_cut_manager: !current }).eq('id', id);
    if (error) showError(adminNotice("Could not confirm this change. Refresh the current record before retrying."));
    else {
      showSuccess(adminNotice(!current ? t("Laser manager assigned.") : t("Laser manager removed.")));
      fetchProfiles();
      fetchLaserManagers();
    }
  }

  // ── Manufacture: per-printer manager assignment ───────────────────────
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [printerManagers, setPrinterManagers] = useState<any[]>([]);
  const [laserManagers, setLaserManagers] = useState<any[]>([]);
  const [manufactureLoading, setManufactureLoading] = useState(true);
  const [addPrinterManagerSelect, setAddPrinterManagerSelect] = useState<Record<number, string>>({});
  const [addLaserManagerSelect, setAddLaserManagerSelect] = useState('');

  const fetchAllProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, student_id').order('student_id');
    if (!error) setAllProfiles(data || []);
  };

  const fetchPrinters = async () => {
    const { data, error } = await supabase.from('printers').select('*').order('id');
    if (!error) setPrinters(data || []);
  };

  const fetchPrinterManagers = async () => {
    const { data, error } = await supabase
      .from('printer_managers')
      .select('printer_id, user_id, profiles:user_id (full_name, student_id)');
    if (!error) setPrinterManagers(data || []);
  };

  const fetchLaserManagers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, student_id')
      .eq('is_laser_cut_manager', true)
      .order('student_id');
    if (!error) setLaserManagers(data || []);
  };

  const fetchManufactureData = async () => {
    setManufactureLoading(true);
    await Promise.all([fetchAllProfiles(), fetchPrinters(), fetchPrinterManagers(), fetchLaserManagers()]);
    setManufactureLoading(false);
  };

  async function addPrinterManager(printerId: number) {
    const userId = addPrinterManagerSelect[printerId];
    if (!userId) { showError(adminNotice("Select a person to assign.")); return; }
    const { error } = await supabase.from('printer_managers').insert({ printer_id: printerId, user_id: userId });
    if (error) showError(adminNotice("Could not confirm the manager assignment. Refresh the manager list before retrying."));
    else { showSuccess(adminNotice("Manager added.")); setAddPrinterManagerSelect(s => ({ ...s, [printerId]: '' })); fetchPrinterManagers(); }
  }

  async function removePrinterManager(printerId: number, userId: string) {
    const { error } = await supabase.from('printer_managers').delete().eq('printer_id', printerId).eq('user_id', userId);
    if (error) showError(adminNotice("Could not confirm the manager removal. Refresh the manager list before retrying."));
    else { showSuccess(adminNotice("Manager removed.")); fetchPrinterManagers(); }
  }

  async function addLaserManager() {
    if (!addLaserManagerSelect) { showError(adminNotice("Select a person to assign.")); return; }
    await toggleLaserManager(addLaserManagerSelect, false);
    setAddLaserManagerSelect('');
  }

  // ── 기상송 담당자 지정 — is_admin이 아니어도 /admin/wakeup(검토·재생)을 볼
  // 수 있는 권한. 지정 자체는 여기, 진짜 관리자 화면에서만 한다 —
  // /admin/wakeup은 담당자 전용이라 관리자가 거기서 스스로에게 권한을 줄 수 없다.
  const [wakeupManagers, setWakeupManagers] = useState<any[]>([]);
  const [addWakeupManagerSelect, setAddWakeupManagerSelect] = useState('');

  const fetchWakeupManagers = async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, student_id').eq('is_wakeup_manager', true).order('student_id');
    if (!error) setWakeupManagers(data || []);
  };

  async function toggleWakeupManager(id: string, current: boolean) {
    const { error } = await supabase.from('profiles').update({ is_wakeup_manager: !current }).eq('id', id);
    if (error) showError(adminNotice("Could not confirm this change. Refresh the current record before retrying."));
    else { showSuccess(adminNotice(!current ? t("Wake-up music manager assigned.") : t("Wake-up music manager removed."))); fetchWakeupManagers(); }
  }

  async function addWakeupManager() {
    if (!addWakeupManagerSelect) { showError(adminNotice("Select a person to assign.")); return; }
    await toggleWakeupManager(addWakeupManagerSelect, false);
    setAddWakeupManagerSelect('');
  }

  // ── 사이트 공지 배너 ────────────────────────────────────────────────────────
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerSaving, setBannerSaving] = useState(false);

  const fetchBanner = async () => {
    const { data, error } = await supabase.from('site_banner').select('message, is_active').eq('id', 1).maybeSingle();
    if (error) showError(adminNotice("Could not load the announcement."));
    else {
      setBannerMessage(data?.message ?? '');
      setBannerActive(data?.is_active ?? false);
    }
    setBannerLoading(false);
  };

  async function saveBanner(active: boolean) {
    setBannerSaving(true);
    const { error } = await supabase
      .from('site_banner')
      .upsert({ id: 1, message: bannerMessage, is_active: active }, { onConflict: 'id' });
    if (error) showError(adminNotice("Could not confirm the announcement change. Refresh its status before retrying."));
    else {
      setBannerActive(active);
      showSuccess(adminNotice(active ? t("Announcement enabled.") : t("Announcement disabled.")));
    }
    setBannerSaving(false);
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      if(initialTab==='gpu')fetchReservations();
      fetchCpuProjects();
      fetchProfiles();
      fetchBanner();
      fetchManufactureData();
      fetchWakeupManagers();
    }
  }, [authLoading, isAdmin]);

  // ── 공통 UI ─────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label={t("Checking access")} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="bg-destructive/10 p-8 rounded-full ring-8 ring-destructive/5">
          <ShieldAlert className="w-16 h-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="cb-page-title">{t("Access Denied")}</h1>
          <p className="text-muted-foreground text-lg max-w-md font-bold uppercase opacity-70">
             {t("Administrator privileges required.")} </p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="font-black px-10 h-12 uppercase tracking-widest border-2 hover:bg-foreground hover:text-background transition-all">
           {t("Return Home")} </Button>
      </div>
    );
  }

  const pendingCpuCount = cpuProjects.filter(p => p.status === 'pending').length;
  const unreviewedCount = profiles.filter(p => accountState(p)!=='approved').length;
  const pendingGpuCount = reservations.filter(r => r.status === 'pending' && new Date(r.end_time) > new Date()).length;
  const conflictsWithApproved = (target: any) => target.status === 'pending' && reservations.some(r =>
    r.id !== target.id && r.gpu_id === target.gpu_id && r.status === 'approved' &&
    new Date(r.start_time) < new Date(target.end_time) &&
    new Date(r.end_time) > new Date(target.start_time)
  );
  const matchesQuery = (...values: unknown[]) => values.some(value => String(value ?? '').toLocaleLowerCase().includes(deferredQuery.trim().toLocaleLowerCase()));
  const gpuView=needsReviewOnly?'pending':statusFilter;
  const filteredReservations = filterAdminGpuReservations(reservations,{view:gpuView,gpu:gpuFilter,query:deferredQuery,now:clockNow});
  const gpuViewLabels:Record<string,string>={all:'All reservations',pending:'Pending approval',approved:'Approved',active:'In use',upcoming:'Upcoming',ended:'Ended',rejected:'Rejected'};
  const filteredProjects = cpuProjects.filter(p => (!needsReviewOnly || p.status === 'pending') && (statusFilter === 'all' || p.status === statusFilter) && matchesQuery(p.name, p.user_email, p.profiles?.full_name, p.profiles?.student_id));
  const schoolOptions=accountSchoolOptions(profiles);
  const filteredProfiles = profiles.filter(p => accountMatchesSchool(p,schoolFilter) && (!needsReviewOnly || accountState(p)!=='approved') && (statusFilter==='all'||accountState(p)===statusFilter) && (roleFilter==='all'||(['student','teacher','external'].includes(roleFilter)?accountSchools(p).some(school=>(schoolFilter==='all'||school.school_id===schoolFilter)&&school.membership_type===roleFilter.toUpperCase()):roleFilter==='admin'?p.is_admin===true:p.is_laser_cut_manager===true||p.is_wakeup_manager===true)) && matchesQuery(p.full_name,accountStudentNumberDisplay(p,schoolFilter),p.email,...accountSchoolSearch(p)));
  const sortRows = (rows: any[]) => [...rows].sort((a, b) => {
    if (sortOrder === 'name') return String(a.profiles?.full_name || a.full_name || a.name || '').localeCompare(String(b.profiles?.full_name || b.full_name || b.name || ''));
    if (sortOrder === 'oldest' || sortOrder === 'newest') return (Date.parse(a.created_at || '') - Date.parse(b.created_at || '') || 0) * (sortOrder === 'newest' ? -1 : 1);
    if (sortOrder === 'review') return Number(tab==='accounts'?accountState(b)!=='approved':b.status==='pending')-Number(tab==='accounts'?accountState(a)!=='approved':a.status==='pending');
    return 0;
  });
  const resultTotal = tab === 'gpu' ? filteredReservations.length : tab === 'server' ? filteredProjects.length : filteredProfiles.length;
  const pageCount = Math.max(1, Math.ceil(resultTotal / visibleLimit));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * visibleLimit;
  const visibleReservations = sortRows(filteredReservations).slice(offset, offset + visibleLimit);
  const visibleProjects = sortRows(filteredProjects).slice(offset, offset + visibleLimit);
  const visibleProfiles = sortRows(filteredProfiles).slice(offset, offset + visibleLimit);
  const hasList = tab === 'gpu' || tab === 'server' || tab === 'accounts';
  const resultCount = tab === 'gpu' ? filteredReservations.length : tab === 'server' ? filteredProjects.length : filteredProfiles.length;
  const listError = loadErrors[tab];
  const refreshList = async () => { if (tab === 'gpu') await fetchReservations(); else if (tab === 'server') await fetchCpuProjects(); else if (tab === 'accounts') await fetchProfiles(); setLastRefreshed(new Date()); };
  const listLoading = tab === 'gpu' ? gpuLoading : tab === 'server' ? cpuLoading : profilesLoading;

  return (
    <div className="admin-management space-y-10" data-density={density}>
      <section>
        <div className="page-heading">
          <div className="space-y-1">
            <h1 className="cb-page-title">{tab==='gpu'?t('GPU reservations'):tab==='server'?t('Server deployments'):tab==='accounts'?t('Platform accounts'):t('Administration')}</h1>
          </div>

        </div>

        {!hasList&&<div className="mb-8 grid grid-cols-2 xl:grid-cols-4 gap-3" aria-label={t("Review queues")}>
          {([
            ['server', "Pending deployments", pendingCpuCount, cpuLoading],
            ['accounts', "Account access reviews", unreviewedCount, profilesLoading],
          ] as const).filter(([, ,count])=>count!==null||process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1==='1').map(([target, label, count, loading]) => (
            <button key={label} type="button" onClick={() => selectTab(target, count!==null)} className="rounded-2xl border bg-card p-3 sm:p-5 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary">
              <span className="block text-sm text-muted-foreground">{t(label)}</span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">{count===null?t("Open requests"):loading ? t("Checking…") : loadErrors[target] ? t("Needs review") : `${count} ${t('items')}`}</span>
              <span className="mt-2 block text-xs text-muted-foreground">{t("Review list →")}</span>
            </button>
          ))}
        </div>}


        {hasList && <div className="surface admin-list-toolbar mb-5 p-4 sm:p-6 space-y-4">
          {tab==='gpu'&&<><p className="text-sm text-muted-foreground">{t("Chungbuk Science High School · GPU #1–4 · All approvals and reservation history")}</p><div className="flex flex-wrap gap-2" role="group" aria-label={t("Reservation views")}>{adminGpuViews.map(view=><Button key={view} type="button" variant={gpuView===view?'secondary':'outline'} className="min-h-11 gap-2" aria-pressed={gpuView===view} aria-label={t(gpuViewLabels[view])} onClick={()=>{setNeedsReviewOnly(false);setStatusFilter(view);setPage(1)}}>{view==='all'?t('All'):view==='pending'?t('Pending'):t(gpuViewLabels[view])}<span className="tabular-nums">{reservations.filter(row=>matchesAdminGpuView(row,view,clockNow)).length}</span></Button>)}</div>{gpuView!=='all'&&<p role="status" className="text-sm">{t("Showing")} {t(gpuViewLabels[gpuView]||gpuView)}. <Button variant="link" className="min-h-11 px-1" onClick={()=>{setNeedsReviewOnly(false);setStatusFilter('all')}}>{t("Show all reservations")}</Button></p>}</>}
          <div className="flex flex-wrap items-end gap-3">
            <Input type="search" aria-label={t("Search current list")} placeholder={tab === 'server' ? t("Search project name or email") : tab === 'accounts' ? t("Search name, school, student ID or email") : t("Search name, student ID, GPU, purpose or reservation ID")} value={query} onChange={e => { setQuery(e.target.value); setVisibleLimit(30); }} className="h-11 min-w-0 flex-1 basis-full lg:basis-64" />
            {tab!=='gpu'&&<Button variant={needsReviewOnly ? 'secondary' : 'outline'} className="min-h-11" aria-pressed={needsReviewOnly} onClick={() => { setNeedsReviewOnly(v => !v); setStatusFilter('all'); setVisibleLimit(30); }}>{tab === 'accounts' ? t("Needs review only") : t("Pending only")}</Button>}
            {(query || needsReviewOnly || statusFilter !== 'all' || gpuFilter !== 'all' || roleFilter !== 'all' || schoolFilter !== 'all') && <Button variant="ghost" className="min-h-11" onClick={resetFilters}>{t("Clear filters")}</Button>}
            {tab!=='gpu'&&<label className="text-xs font-semibold space-y-2"><span className="block">{t("Status")}</span><Dropdown aria-label={t("Filter by status")} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setNeedsReviewOnly(false); setVisibleLimit(30); }} className="block min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">{t("All statuses")}</option>{tab === 'accounts' ? <><option value="unreviewed">{t("Unreviewed")}</option><option value="approved">{t("Approved")}</option><option value="restricted">{t("Restricted")}</option></> : <><option value="pending">{t("Pending approval")}</option><option value="approved">{t("Approved")}</option><option value="rejected">{t("Rejected")}</option></>}</Dropdown></label>}
            {tab === 'gpu' && <label className="text-xs font-semibold space-y-2"><span className="block">GPU</span><Dropdown aria-label={t("Filter by GPU")} value={gpuFilter} onChange={e => { setGpuFilter(e.target.value); setVisibleLimit(30); }} className="block min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">{t("All GPUs")}</option>{[1,2,3,4].map(id => <option key={id} value={String(id)}>{t("GPU #")}{id}</option>)}</Dropdown></label>}
            {tab==='accounts'&&<label className="min-w-0 max-w-full text-xs font-semibold space-y-2"><span className="block">{t("School")}</span><Dropdown aria-label={t("Filter accounts by school")} value={schoolFilter} disabled={profilesLoading} onChange={event=>{setSchoolFilter(event.target.value);setPage(1)}} className="block min-h-11 w-full max-w-72 rounded-lg border bg-background px-3 text-sm"><option value="all">{t("All schools")}</option>{schoolOptions.map(school=><option key={school.id} value={school.id}>{school.name}</option>)}<option value="none">{t("No school affiliation")}</option>{profiles.some(profile=>accountMatchesSchool(profile,'unavailable'))&&<option value="unavailable">{t("School information unavailable")}</option>}</Dropdown></label>}
            {tab === 'accounts' && <label className="text-xs font-semibold space-y-2"><span className="block">{t("Role")}</span><Dropdown aria-label={t("Filter by role")} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setVisibleLimit(30); }} className="block min-h-11 rounded-lg border bg-background px-3 text-sm"><option value="all">{t("All accounts")}</option><option value="student">{t("Students")}</option><option value="teacher">{t("Teachers")}</option><option value="external">{t("External collaborators")}</option><option value="admin">{t("Platform administrators")}</option><option value="manager">{t("Laser and music managers")}</option></Dropdown></label>}
          <Button type="button" variant="outline" disabled={listLoading} onClick={refreshList} className="min-h-11 gap-2"><RefreshCw className={`size-4 ${listLoading ? 'animate-spin motion-reduce:animate-none' : ''}`} />{listLoading ? t("Loading…") : t("Refresh list")}</Button>
          </div>
          <div className="admin-list-options">
            <label>{t("Sort")}<Dropdown aria-label={t("Sort records")} value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="default">{t("Original order")}</option><option value="review">{t("Needs review first")}</option><option value="name">{t("Name A–Z")}</option><option value="newest">{t("Newest first")}</option><option value="oldest">{t("Oldest first")}</option></Dropdown></label>
            <label>{t("Rows per page")}<Dropdown aria-label={t("Rows per page")} value={visibleLimit} onChange={e => setVisibleLimit(Number(e.target.value))}>{[15,30,60,100].map(n => <option key={n} value={n}>{n}</option>)}</Dropdown></label>
            <label>{t("Density")}<Dropdown aria-label={t("Table density")} value={density} onChange={e => setDensity(e.target.value)}><option value="comfortable">{t("Comfortable")}</option><option value="compact">{t("Compact")}</option></Dropdown></label>
            <div className="admin-list-summary">
            <p role="status" className="text-sm text-foreground">{listError ? t("Could not refresh the list.") : listLoading ? t("Loading records…") : app?`결과 ${resultCount}개 · ${resultCount ? offset + 1 : 0}–${Math.min(resultCount, offset + visibleLimit)}개 표시`:`${resultCount} results · ${resultCount ? offset + 1 : 0}–${Math.min(resultCount, offset + visibleLimit)} shown`}</p>
            {tab === 'server' && <p className="text-xs text-muted-foreground">{t("Search and counts cover the most recent 1,000 loaded records.")}</p>}
            {tab==='gpu'&&<p className="text-sm text-muted-foreground">{reservations.length.toLocaleString()}  {t("loaded")}{gpuHasMore?t(' · Load older records below'):!listLoading&&!listError?t(' · End of history'):''}{t(". Search covers loaded records.")}</p>}
            </div>
          </div>
          {listError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm"><p className="font-semibold">{t(listError)}</p><p className="mt-2 text-muted-foreground">{t("Previously loaded records remain below. Refresh to try again.")}</p></div>}
          {Object.values(rowActions).some(Boolean) && <p role="status" className="text-sm text-primary">{t("Saving changes and refreshing the list…")}</p>}
        </div>}


        {/* ── GPU 예약 탭 ── */}
        {tab === 'gpu' && (
          <div className="border rounded-3xl bg-card overflow-hidden shadow-sm">
            {/* 모바일: 가로 스크롤 없이 바로 승인/거절 — 카드 목록 */}
            <div className="xl:hidden divide-y">
              {gpuLoading || gpuJustFinished ? (
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={gpuJustFinished} size={48} label={t("Loading reservations")} /></div>
              ) : visibleReservations.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">{t("No reservations to display.")}</div>
              ) : (
                visibleReservations.map((res) => {
                  const start = new Date(res.start_time);
                  const end = new Date(res.end_time);
                  const isEnded = matchesAdminGpuView(res,'ended',clockNow);
                  const hasConflict = conflictsWithApproved(res);
                  const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                  return (
                    <article key={res.id} aria-label={t('GPU #')+res.gpu_id+' reservation'} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-sm uppercase tracking-tight truncate">{res.profiles?.full_name || t("Account unavailable")}</span>
                          <span className="text-sm text-muted-foreground font-bold opacity-70">{res.profiles?.student_id || res.user_email}</span>
                        </div>
                        <span className="font-black italic text-primary text-sm shrink-0">{t("GPU #")}{res.gpu_id}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{res.purpose||t('No purpose provided')}</p><details className="text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">{t("Reservation details")}</summary><dl className="space-y-1 break-all"><div><dt>{t("Reservation ID")}</dt><dd>{res.id}</dd></div><div><dt>{t("Requested")}</dt><dd>{res.created_at?new Date(res.created_at).toLocaleString(app?'ko-KR':'en-US'):t('Unavailable')}</dd></div></dl></details>
                      <div className="bg-muted/50 px-3 py-2 rounded-xl border border-border/50 text-sm leading-relaxed">
                        {start.toLocaleString(app?'ko-KR':'en-US', dateOptions)}
                        <span className="opacity-30 mx-1">→</span>
                        {end.toLocaleString(app?'ko-KR':'en-US', dateOptions)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {res.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>{t("Pending")}</Badge>}
                          {hasConflict && <p className="mt-1 text-xs font-bold text-destructive">{t("Conflicts with an approved reservation")}</p>}
                          {res.status === 'approved' && <><Badge variant="success" icon={<CheckCircle2 className="size-3" />}>{t("Approved")}</Badge><p className="mt-1 text-sm text-muted-foreground">{isEnded?t('Ended'):start.getTime()>clockNow?t('Upcoming'):t('In use')}</p></>}
                          {res.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>{t("Rejected")}</Badge>}
                        </div>
                        {isEnded ? (
                          <span className="text-sm font-black uppercase opacity-30">{t("Session Finished")}</span>
                        ) : res.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={hasConflict || rowActions['gpu:' + res.id]} title={hasConflict ? t("Cannot approve overlapping reservations.") : undefined} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase min-h-11 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>{t("Approve")}</Button>
                            <Button size="sm" variant="destructive" className="font-black text-sm uppercase min-h-11 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'rejected')}>{t("Reject")}</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="font-black text-sm uppercase min-h-11 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'pending')}>
                            <Undo2 className="size-3" />  {t("Reset")} </Button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="hidden xl:block overflow-x-auto">
              <Table className="data-table admin-gpu-history-table"><colgroup><col className="w-[27%]"/><col className="w-[11%]"/><col className="w-[27%]"/><col className="w-[15%]"/><col className="w-[20%]"/></colgroup>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-sm tracking-widest py-5 px-6">{t("Applicant")}</TableHead>
                    <TableHead className="font-black uppercase text-sm tracking-widest py-5">{t("GPU Unit")}</TableHead>
                    <TableHead className="font-black uppercase text-sm tracking-widest py-5">{t("Time Frame")}</TableHead>
                    <TableHead className="font-black uppercase text-sm tracking-widest py-5">{t("Status")}</TableHead>
                    <TableHead className="font-black uppercase text-sm tracking-widest py-5 px-6 text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gpuLoading || gpuJustFinished ? (
                    <TableRow><TableCell colSpan={5} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={gpuJustFinished} size={48} label={t("Loading reservations")} /></div></TableCell></TableRow>
                  ) : visibleReservations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">{t("No reservations to display.")}</TableCell></TableRow>
                  ) : (
                    visibleReservations.map((res) => {
                      const start = new Date(res.start_time);
                      const end = new Date(res.end_time);
                      const isEnded = matchesAdminGpuView(res,'ended',clockNow);
                      const hasConflict = conflictsWithApproved(res);
                      const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                      return (
                        <TableRow key={res.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                          <TableCell className="py-5 px-6">
                            <div className="flex flex-col">
                              <span className="font-black text-sm uppercase tracking-tight">{res.profiles?.full_name || t("Account unavailable")}</span>
                              <span className="text-sm text-muted-foreground">{res.profiles?.student_id || res.user_email}</span>
                              <p className="mt-1 max-w-sm whitespace-pre-wrap break-words text-sm text-muted-foreground">{res.purpose||t('No purpose provided')}</p><details className="text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">{t("Reservation details")}</summary><dl className="space-y-1 break-all"><div><dt>{t("Reservation ID")}</dt><dd>{res.id}</dd></div><div><dt>{t("Requested")}</dt><dd>{res.created_at?new Date(res.created_at).toLocaleString(app?'ko-KR':'en-US'):t('Unavailable')}</dd></div></dl></details>
                            </div>
                          </TableCell>
                          <TableCell className="font-black italic text-primary">{t("GPU #")}{res.gpu_id}</TableCell>
                          <TableCell className="text-sm font-bold leading-tight py-5">
                            <div className="bg-muted/50 px-3 py-2 rounded-xl inline-block border border-border/50">
                              {start.toLocaleString(app?'ko-KR':'en-US', dateOptions)} <br/>
                              <span className="opacity-30 mx-1">{t("to")}</span> {end.toLocaleString(app?'ko-KR':'en-US', dateOptions)}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            {res.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>{t("Pending")}</Badge>}
                            {hasConflict && <p className="mt-1 text-xs font-bold text-destructive">{t("Conflicts with an approved reservation")}</p>}
                            {res.status === 'approved' && <><Badge variant="success" icon={<CheckCircle2 className="size-3" />}>{t("Approved")}</Badge><p className="mt-1 text-sm text-muted-foreground">{isEnded?t('Ended'):start.getTime()>clockNow?t('Upcoming'):t('In use')}</p></>}
                            {res.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>{t("Rejected")}</Badge>}
                          </TableCell>
                          <TableCell className="text-right py-5 px-6">
                            <div className="flex flex-wrap justify-end gap-2">
                              {isEnded ? (
                                <span className="text-sm font-black uppercase opacity-30 px-4">{t("Session Finished")}</span>
                              ) : res.status === 'pending' ? (
                                <>
                                  <Button size="sm" disabled={hasConflict || rowActions['gpu:' + res.id]} title={hasConflict ? t("Cannot approve overlapping reservations.") : undefined} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase min-h-11 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" onClick={() => updateStatus(res.id, 'approved', res.gpu_id)}>{t("Approve")}</Button>
                                  <Button size="sm" variant="destructive" className="font-black text-sm uppercase min-h-11 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'rejected')}>{t("Reject")}</Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" className="font-black text-sm uppercase min-h-11 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['gpu:' + res.id]} onClick={() => updateStatus(res.id, 'pending')}>
                                  <Undo2 className="size-3" />  {t("Reset")} </Button>
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
        )}

        {tab==='gpu'&&gpuHasMore&&<div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={gpuLoading||gpuLoadingMore} onClick={()=>void loadOlderReservations()}>{gpuLoadingMore?t('Loading older reservations…'):t('Load older reservations')}</Button><p className="text-sm text-muted-foreground">{t("Adds the next 1,000 records without changing your filters.")}</p></div>}
        {/* ── 서버 배포 탭 ── */}
        {tab === 'server' && (
          <div className="border rounded-3xl bg-card overflow-hidden shadow-sm">
            {/* 모바일: 가로 스크롤 없이 바로 승인/거절 — 카드 목록 */}
            <div className="md:hidden divide-y">
              {cpuLoading || cpuJustFinished ? (
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={cpuJustFinished} size={48} label={t("Loading projects")} /></div>
              ) : visibleProjects.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">{t("No projects to display.")}</div>
              ) : (
                visibleProjects.map((proj) => (
                  <div key={proj.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm uppercase tracking-tight truncate">{(proj.profiles as any)?.full_name || t("Account unavailable")}</span>
                        <span className="text-[10px] text-muted-foreground font-bold opacity-70">{(proj.profiles as any)?.student_id || proj.user_email}</span>
                      </div>
                      {proj.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>{t("Pending")}</Badge>}
                      {proj.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>{t("Approved")}</Badge>}
                      {proj.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>{t("Rejected")}</Badge>}
                    </div>
                    <div className="bg-muted/50 px-3 py-2 rounded-xl border border-border/50 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        {proj.deploy_type === 'docker'
                          ? <Container className="size-3 text-muted-foreground" />
                          : <GitBranch className="size-3 text-muted-foreground" />}
                        <span className="font-black text-sm">{proj.name}</span>
                      </div>
                      <code className="text-[10px] text-muted-foreground opacity-70 block truncate">
                        {proj.deploy_type === 'docker' ? proj.docker_image : proj.git_url?.replace('https://', '')}
                      </code>
                      <div className="flex flex-col gap-1 text-[10px] font-bold text-muted-foreground pt-1">
                        <span>{t("Port:")} {proj.host_port}:{proj.container_port}</span>
                        <span className="flex items-center gap-1">
                          {proj.access_scope === 'private' && <><Lock className="size-2.5" />  {t("Private")}</>}
                          {proj.access_scope === 'school'  && <><School className="size-2.5 text-blue-500" />  {t("School")}</>}
                          {proj.access_scope === 'public'  && <><Globe className="size-2.5 text-green-500" />  {t("Public")}</>}
                        </span>
                        <span>{t("CPU:")} {proj.cpu_limit}  {t("/ Mem:")} {formatMemoryLimit(proj.memory_limit)}</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link href={`/server/${proj.id}`}>
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 transition-all active:scale-95 gap-1.5">
                          <Server className="size-3" />   {t("Details")} </Button>
                      </Link>
                      {proj.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'approved')}>{t("Approve")}</Button>
                          <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'rejected')}>{t("Reject")}</Button>
                        </>
                      )}
                      {(proj.status === 'approved' || proj.status === 'rejected') && (
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'pending')}>
                          <Undo2 className="size-3" />  {t("Reset")} </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table className="data-table">
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6">{t("Applicant")}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">{t("Project")}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">{t("Config")}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">{t("Status")}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6 text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cpuLoading || cpuJustFinished ? (
                    <TableRow><TableCell colSpan={5} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={cpuJustFinished} size={48} label={t("Loading projects")} /></div></TableCell></TableRow>
                  ) : visibleProjects.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">{t("No projects to display.")}</TableCell></TableRow>
                  ) : (
                    visibleProjects.map((proj) => (
                      <TableRow key={proj.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex flex-col">
                            <span className="font-black text-sm uppercase tracking-tight">{(proj.profiles as any)?.full_name || t("Account unavailable")}</span>
                            <span className="text-[10px] text-muted-foreground font-bold opacity-70">{(proj.profiles as any)?.student_id || proj.user_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              {proj.deploy_type === 'docker'
                                ? <Container className="size-3 text-muted-foreground" />
                                : <GitBranch className="size-3 text-muted-foreground" />}
                              <span className="font-black text-sm">{proj.name}</span>
                            </div>
                            <code className="text-[10px] text-muted-foreground opacity-70">
                              {proj.deploy_type === 'docker' ? proj.docker_image : proj.git_url?.replace('https://', '')}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col gap-1 text-[10px] font-bold text-muted-foreground">
                            <span>{t("Port:")} {proj.host_port}:{proj.container_port}</span>
                            <span className="flex items-center gap-1">
                              {proj.access_scope === 'private' && <><Lock className="size-2.5" />  {t("Private")}</>}
                              {proj.access_scope === 'school'  && <><School className="size-2.5 text-blue-500" />  {t("School")}</>}
                              {proj.access_scope === 'public'  && <><Globe className="size-2.5 text-green-500" />  {t("Public")}</>}
                            </span>
                            <span>{t("CPU:")} {proj.cpu_limit}  {t("/ Mem:")} {formatMemoryLimit(proj.memory_limit)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          {proj.status === 'pending'  && <Badge variant="warning" icon={<Clock className="size-3" />}>{t("Pending")}</Badge>}
                          {proj.status === 'approved' && <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>{t("Approved")}</Badge>}
                          {proj.status === 'rejected' && <Badge variant="danger"  icon={<XCircle className="size-3" />}>{t("Rejected")}</Badge>}
                        </TableCell>
                        <TableCell className="text-right py-5 px-6">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Link href={`/server/${proj.id}`}>
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 transition-all active:scale-95 gap-1.5">
                                <Server className="size-3" />   {t("Details")} </Button>
                            </Link>
                            {proj.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'approved')}>{t("Approve")}</Button>
                                <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'rejected')}>{t("Reject")}</Button>
                              </>
                            )}
                            {proj.status === 'approved' && (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'pending')}>
                                <Undo2 className="size-3" />  {t("Reset")} </Button>
                            )}
                            {proj.status === 'rejected' && (
                              <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl border-2 hover:bg-muted transition-all active:scale-95 gap-1.5" disabled={rowActions['server:' + proj.id]} onClick={() => updateCpuStatus(proj.id, 'pending')}>
                                <Undo2 className="size-3" />  {t("Reset")} </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── 계정 탭 ── */}
        {tab === 'accounts' && (
          <div className="border rounded-3xl bg-card overflow-hidden shadow-sm">
            {/* 모바일: 가로 스크롤 없이 바로 승인 — 카드 목록 */}
            <div className="md:hidden divide-y">
              {profilesLoading || profilesJustFinished ? (
                <div className="py-16 flex items-center justify-center"><LoadingSpinner done={profilesJustFinished} size={48} label={t("Loading accounts")} /></div>
              ) : visibleProfiles.length === 0 ? (
                <div className="text-center py-20 font-bold text-muted-foreground opacity-50">{t("No accounts to display.")}</div>
              ) : (
                visibleProfiles.map((p) => (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-black text-sm uppercase tracking-tight truncate">{p.full_name || t("Name not provided")}</span>
                        {p.is_admin && <Badge variant="warning">{t("Admin")}</Badge>}
                        {p.is_laser_cut_manager && <Badge variant="default">{t("Laser manager")}</Badge>}
                      </div>
                      <span className="text-sm font-bold shrink-0">{accountStudentNumberDisplay(p,schoolFilter)}</span>
                    </div>
                    {p.email && <p className="text-xs text-muted-foreground break-all">{p.email}</p>}
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="mb-1 text-xs font-medium text-muted-foreground">{t("School")}</p><AccountSchoolDetails account={p} showStudentNumber={false}/></div>
                    {rowActions['account:' + p.id] && <p role="status" className="text-xs text-primary">{t("Updating account…")}</p>}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        {accountStatusBadge(p)}
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {modernSchoolAccount(p)?<p className="text-sm text-muted-foreground">{t("School membership is managed in the authorized school workspace.")}</p>:<>{p.is_approved !== true && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, true)}>

                             {t("Approve")} </Button>
                        )}
                        {p.is_approved !== false && (
                          <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, false)}>

                             {t("Mark for review")} </Button>
                        )}
                        </>}
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all active:scale-95 gap-1.5" disabled={rowActions['account:' + p.id]} aria-label={`${p.full_name || p.student_id || t("Selected account")} ${t("Delete")}`} onClick={() => setDeleteTarget({ id: p.id, name: p.full_name || p.student_id || "Account unavailable" })}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table className="data-table">
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6">{t("Name")}</TableHead>
                    <TableHead className="min-w-56 font-black uppercase text-[10px] tracking-widest py-5">{t("School")}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">{t("Student ID")}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">{t("Status")}</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-5 px-6 text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profilesLoading || profilesJustFinished ? (
                    <TableRow><TableCell colSpan={5} className="py-16"><div className="flex items-center justify-center"><LoadingSpinner done={profilesJustFinished} size={48} label={t("Loading accounts")} /></div></TableCell></TableRow>
                  ) : visibleProfiles.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 font-bold text-muted-foreground opacity-50">{t("No accounts to display.")}</TableCell></TableRow>
                  ) : (
                    visibleProfiles.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="py-5 px-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm uppercase tracking-tight">{p.full_name || t("Name not provided")}</span>
                            {p.is_admin && <Badge variant="warning">{t("Admin")}</Badge>}
                            {p.is_laser_cut_manager && <Badge variant="default">{t("Laser manager")}</Badge>}
                          </div>
                          {p.email && <p className="mt-2 text-xs text-muted-foreground break-all">{p.email}</p>}
                          {rowActions['account:' + p.id] && <p role="status" className="mt-2 text-xs text-primary">{t("Updating…")}</p>}
                        </TableCell>
                        <TableCell className="min-w-56 max-w-sm whitespace-normal py-5"><AccountSchoolDetails account={p} showStudentNumber={false}/></TableCell>
                        <TableCell className="text-sm font-bold">{accountStudentNumberDisplay(p,schoolFilter)}</TableCell>
                        <TableCell className="py-5">
                          {accountStatusBadge(p)}
                        </TableCell>
                        <TableCell className="text-right py-5 px-6">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {modernSchoolAccount(p)?<p className="text-sm text-muted-foreground">{t("School membership is managed in the authorized school workspace.")}</p>:<>{p.is_approved !== true && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, true)}>

                                 {t("Approve")} </Button>
                            )}
                            {p.is_approved !== false && (
                              <Button size="sm" variant="destructive" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-4 rounded-xl shadow-lg shadow-destructive/20 transition-all active:scale-95" disabled={rowActions['account:' + p.id]} onClick={() => setProfileApproval(p.id, false)}>

                                 {t("Mark for review")} </Button>
                            )}
                            </>}
                        <Button size="sm" variant="outline" className="font-black text-[10px] uppercase min-h-11 md:min-h-8 h-auto px-3 rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all active:scale-95 gap-1.5" disabled={rowActions['account:' + p.id]} aria-label={`${p.full_name || p.student_id || t("Selected account")} ${t("Delete")}`} onClick={() => setDeleteTarget({ id: p.id, name: p.full_name || p.student_id || "Account unavailable" })}>
                              <Trash2 className="size-3" />   {t("Delete")} </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Manufacture tab ── */}
        {tab === 'materials' && <MaterialsStorage />}

        {tab === 'manufacture' && (
          <div className="space-y-8">
            {manufactureLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner size={48} label={t("Loading")} /></div>
            ) : (
              <>
                <div>
                  <h2 className="font-black uppercase text-sm tracking-widest mb-1 flex items-center gap-1.5"><Printer className="size-4" />   {t("3D printer managers")}</h2>
                  <p className="text-xs text-muted-foreground font-bold opacity-60 mb-4">

                     {t("Select a printer and assign its managers. Managers can start and finish jobs and report faults for that printer.")} </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {printers.map(printer => {
                      const assigned = printerManagers.filter(pm => pm.printer_id === printer.id);
                      const assignedIds = new Set(assigned.map(a => a.user_id));
                      const candidates = allProfiles.filter(p => !assignedIds.has(p.id));
                      return (
                        <div key={printer.id} className="border-2 rounded-2xl bg-card p-5 space-y-3">
                          <p className="font-black text-sm uppercase">{printer.name}</p>
                          {assigned.length === 0 ? (
                            <p className="text-xs text-muted-foreground opacity-50">{t("No managers assigned")}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {assigned.map(a => (
                                <span key={a.user_id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                                  {a.profiles?.full_name || t("Account unavailable")} <span className="text-muted-foreground opacity-60">({a.profiles?.student_id || '-'})</span>
                                  <button onClick={() => removePrinterManager(printer.id, a.user_id)} className="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                                    <X className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <PersonSearchSelect
                              language={app?'ko':'en'}
                              candidates={candidates}
                              value={addPrinterManagerSelect[printer.id] || ''}
                              onChange={v => setAddPrinterManagerSelect(s => ({ ...s, [printer.id]: v }))}
                            />
                            <Button size="sm" className="h-9 px-3 font-black text-[10px] uppercase gap-1" onClick={() => addPrinterManager(printer.id)}>
                              <Plus className="size-3.5" />   {t("Add")} </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h2 className="font-black uppercase text-sm tracking-widest mb-3 flex items-center gap-1.5"><Scissors className="size-4" />   {t("Laser cutting managers")}</h2>
                  <div className="border-2 rounded-2xl bg-card p-5 space-y-3 max-w-xl">
                    {laserManagers.length === 0 ? (
                      <p className="text-xs text-muted-foreground opacity-50">{t("No managers assigned")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {laserManagers.map(m => (
                          <span key={m.id} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                            {m.full_name || t("Account unavailable")} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span>
                            <button onClick={() => toggleLaserManager(m.id, true)} className="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <PersonSearchSelect
                              language={app?'ko':'en'}
                        candidates={allProfiles.filter(p => !laserManagers.some(m => m.id === p.id))}
                        value={addLaserManagerSelect}
                        onChange={setAddLaserManagerSelect}
                      />
                      <Button size="sm" className="h-9 px-3 font-black text-[10px] uppercase gap-1" onClick={addLaserManager}>
                        <Plus className="size-3.5" />   {t("Add")} </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {hasList && !listLoading && <nav className="admin-pagination" aria-label={t("Record pages")}><span className="meta">{resultCount}  {t("results · Page")} {currentPage}  {t("of")} {pageCount}</span><div><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t("Previous")}</Button><Button variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t("Next")}</Button></div></nav>}

        <div className="mt-10 border-t pt-8"><h2 className="mb-4 text-lg font-semibold">{t("Service settings")}</h2>
        {/* 자주 사용하지 않는 설정은 필요할 때 펼친다. */}
        <details className="mb-4 rounded-2xl border bg-card p-5 space-y-4">
          <summary className="min-h-11 cursor-pointer font-semibold list-inside">

             {t("Wake-up music managers")} </summary>
          <div className="flex items-center gap-2 sr-only">
            <Music className="size-5 text-primary" />
            <h2 className="font-black uppercase text-sm tracking-widest">{t("Wake-up music managers")}</h2>
          </div>
          <div className="flex gap-2">
            <PersonSearchSelect
                              language={app?'ko':'en'}
              candidates={allProfiles.filter(p => !wakeupManagers.some(m => m.id === p.id))}
              value={addWakeupManagerSelect}
              onChange={setAddWakeupManagerSelect}
            />
            <Button onClick={addWakeupManager}>{t("Add")}</Button>
          </div>
          {wakeupManagers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wakeupManagers.map(m => (
                <span key={m.id} className="flex items-center gap-1 bg-muted rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                  {m.full_name || t("Account unavailable")} <span className="text-muted-foreground opacity-60">({m.student_id || '-'})</span>
                  <button aria-label={`${m.full_name || "User"} Remove manager`} onClick={() => toggleWakeupManager(m.id, true)} className="ml-1 flex items-center justify-center size-11 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </details>

        <details className="mb-8 rounded-2xl border bg-card p-5 space-y-4">
          <summary className="min-h-11 cursor-pointer font-semibold list-inside">{t("Site announcement")} <span className="ml-2 text-sm font-normal text-muted-foreground">{bannerLoading ? t("Checking") : bannerActive ? t("Enabled") : t("Disabled")}</span></summary>
          {bannerLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={40} label={t("Loading announcement")} /></div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-primary" />
                <h2 className="font-black uppercase text-sm tracking-widest">{t("Site announcement")}</h2>
                {bannerActive && (
                  <Badge variant="success" icon={<CheckCircle2 className="size-3" />}>{t("Enabled")}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-medium">

                 {t("When enabled, this announcement appears at the top of the user website for all visitors.")} </p>
              <textarea
                aria-label={t("Announcement message")}
                value={bannerMessage}
                onChange={(e) => setBannerMessage(e.target.value)}
                placeholder={t("For example: Scheduled maintenance on July 10, 03:00–05:00.")}
                rows={3}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest gap-1.5"
                  disabled={bannerSaving || !bannerMessage.trim()}
                  onClick={() => saveBanner(true)}
                >
                  <Megaphone className="size-3.5" />   {t("Save and enable")} </Button>
                <Button
                  variant="outline"
                  className="font-black text-xs uppercase tracking-widest"
                  disabled={bannerSaving || !bannerActive}
                  onClick={() => saveBanner(false)}
                >

                   {t("Disable")} </Button>
              </div>
            </>
          )}
        </details>

        </div>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("Delete this account?")}
        description={app?`${deleteTarget?.name ?? ''} 계정의 이름·학번·프로필 사진이 삭제되고 더 이상 로그인할 수 없어요. 삭제하면 되돌릴 수 없어요.`:`${deleteTarget?.name ?? ''} will lose their name, student ID and profile image and will no longer be able to sign in. This cannot be undone.`}
        confirmLabel={isDeletingUser ? t("Deleting…") : t("Delete account")}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
