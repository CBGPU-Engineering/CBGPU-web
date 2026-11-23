'use client';
import {useAdminLanguage,adminNotice} from '@/components/admin/admin-language';
import{manufacturingProfiles,manufacturingJobSelect,attachManufacturingManagers}from'@/lib/scopedProfiles';
import {scopedManufacturingFilesEnabled} from '@/lib/manufacturing/fileAccess';
import {useManufacturingFile} from '@/lib/manufacturing/useManufacturingFile';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DxfPreview } from '@/components/manufacturing/DxfPreview';
import { LocateStudentButton } from '@/components/admin/LocateStudentButton';
import { deleteManufacturingFile } from '@/lib/manufacturing/storage';
import {
  ArrowLeft, Download, CheckCircle2, Clock, XCircle, Boxes, Scissors, Trash2, PackageCheck,
} from 'lucide-react';

const labelCls = 'text-xs font-black uppercase tracking-widest text-muted-foreground mb-1 block';

const STATUS_INFO: Record<string, { icon: React.ReactNode; variant: any; label: string }> = {
  pending:     { icon: <Clock className="size-4" />,        variant: 'warning', label: "Pending approval" },
  accepted:    { icon: <Boxes className="size-4" />,         variant: 'default', label: "Queued" },
  in_progress: { icon: <Scissors className="size-4" />,      variant: 'success', label: "In progress" },
  done:        { icon: <CheckCircle2 className="size-4" />,  variant: 'success', label: "Completed" },
  rejected:    { icon: <XCircle className="size-4" />,       variant: 'danger',  label: "Rejected" },
  canceled:    { icon: <Trash2 className="size-4" />,        variant: 'muted',   label: "Canceled" },
};

export default function LaserJobDetailPage() {
  const {t,app}=useAdminLanguage();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const managementBase=typeof window!=='undefined'&&['manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(window.location.hostname)?'/manage/manufacturing':'/admin/manufacturing';

  const [jobState,setJobState]=useState<{viewer:string|undefined;id:string;value:any}|null>(null);
  const job=jobState?.viewer===user?.id&&jobState?.id===id?jobState.value:null;
  const [requester, setRequester] = useState<{ full_name: string | null; student_id: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const scopedFiles=scopedManufacturingFilesEnabled(),currentViewer=useRef(user?.id),generation=useRef(0);
  const file=useManufacturingFile(scopedFiles?user?.id:undefined,scopedFiles?job?.file_path:null);
  const previewUrl=scopedFiles?file.url:downloadUrl;

  const fetchJob = async () => {
    const expected=user?.id,request=++generation.current;
    const current=()=>request===generation.current&&expected===currentViewer.current;
    const { data, error } = await supabase.from('laser_jobs').select(manufacturingJobSelect('')).eq('id', id).single().returns<any>();
    if(!current())return;
    if (error) { showError(adminNotice("Request not found.")); router.push(managementBase); return; }
    const labels=await attachManufacturingManagers(supabase,'laser',[data]);if(!current())return;setJobState({viewer:expected,id,value:labels.data[0]});setRequester(null);if(labels.error)showError(adminNotice('Manager display details are unavailable.'));
    setLoading(false);
    if (!scopedFiles&&data.file_path) {
      const { data: signed } = await supabase.storage.from('manufacturing').createSignedUrl(data.file_path, 3600);
      if(current())setDownloadUrl(signed?.signedUrl || null);
    } else {
      setDownloadUrl(null);
    }
    if (data.user_id !== user?.id) {
      const { data: profiles,error:profileError } = await manufacturingProfiles(supabase,'laser',[data.user_id]);
      if(!current())return;setRequester(profiles?.[0]||null);if(profileError)showError(adminNotice('Requester details are unavailable.'));
    }
  };

  useEffect(() => {currentViewer.current=user?.id;if(id&&user)void fetchJob();return()=>{generation.current++;currentViewer.current=undefined};}, [id,user?.id]);

  const handleCancel = async () => {
    const { error } = await supabase.from('laser_jobs').update({ status: 'canceled' }).eq('id', job.id);
    if (error) showError(adminNotice("Could not cancel this request. Refresh its status and try again."));
    else { showSuccess(adminNotice("Request canceled.")); setCancelOpen(false); fetchJob(); }
  };

  const handleMarkDelivered = async () => {
    const { error } = await supabase.from('laser_jobs')
      .update({ delivered_at: new Date().toISOString(), file_path: null, file_name: null })
      .eq('id', job.id);
    if (error) { showError(adminNotice("Could not save this change. Refresh the job status and try again.")); return; }
    await deleteManufacturingFile(job.file_path);
    showSuccess(adminNotice("Marked as delivered."));
    fetchJob();
  };

  if (loading||!job) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label={t("Loading")} />
      </div>
    );
  }

  if (!job) return null;

  const isOwner = user?.id === job.user_id;
  const statusInfo = STATUS_INFO[job.status] || { icon: null, variant: 'default', label: job.status };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl">
      <div>
        <button
          onClick={() => router.push(managementBase)}
          className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6 min-h-11"
        >
          <ArrowLeft className="size-3" />  {t("Back")} </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="cb-page-title">{t("Laser cutting request")}</h1>
              <Badge variant={statusInfo.variant} icon={statusInfo.icon}>{t(statusInfo.label)}</Badge>
              {job.status === 'done' && job.delivered_at && (
                <Badge variant="success" icon={<PackageCheck className="size-3" />}>{t("Delivered")}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-bold opacity-70">{job.file_name || t("No file")}</p>
          </div>

          {isOwner && job.status === 'pending' && (
            <Button variant="destructive" className="font-black text-xs uppercase gap-1.5 h-9" onClick={() => setCancelOpen(true)}>
              <Trash2 className="size-3.5" />   {t("Cancel request")} </Button>
          )}
          {!isOwner && job.status === 'done' && !job.delivered_at && (
            <div className="flex items-center gap-2">
              <LocateStudentButton studentId={requester?.student_id} studentName={requester?.full_name} />
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase gap-1.5 h-9" onClick={handleMarkDelivered}>
                <PackageCheck className="size-3.5" />   {t("Hand delivered")} </Button>
            </div>
          )}
        </div>
      </div>

      {scopedFiles&&file.error&&<div role="alert" className="rounded-xl border p-4 text-sm space-y-2"><p>{t("Current file access could not be verified. The request is preserved; sign in again or check your equipment permissions.")}</p><Button type="button" variant="outline" size="sm" onClick={file.reload}>{t("Retry file access")}</Button></div>}
      {previewUrl && job.file_name?.toLowerCase().endsWith('.dxf') && (
        <DxfPreview src={previewUrl} english={!app} />
      )}

      <div className="border-2 rounded-3xl overflow-hidden bg-card">
        <div className="px-6 py-4 border-b-2 bg-muted/20">
          <p className="font-black uppercase tracking-widest text-xs">{t("Details")}</p>
        </div>
        <div className="p-6 grid gap-5">
          {requester && (
            <div>
              <label className={labelCls}>{t("Requester")}</label>
              <span className="font-bold text-sm">{requester.full_name || t('Unknown')} {requester.student_id ? `(${requester.student_id})` : ''}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t("Material")}</label>
              <span className="font-bold text-sm">{job.material === 'mdf' ? 'MDF' : t("Acrylic")}</span>
            </div>
            <div>
              <label className={labelCls}>{t("Thickness")}</label>
              <span className="font-bold text-sm">{job.thickness_mm ? `${job.thickness_mm}mm` : '—'}</span>
            </div>
            <div>
              <label className={labelCls}>{t("Quantity")}</label>
              <span className="font-bold text-sm">{job.quantity}</span>
            </div>
          </div>
          {job.purpose && (
            <div>
              <label className={labelCls}>{t("Purpose")}</label>
              <p className="text-sm font-bold whitespace-pre-wrap">{job.purpose}</p>
            </div>
          )}
          {job.manager?.full_name && (
            <div>
              <label className={labelCls}>{t("Manager")}</label>
              <span className="font-bold text-sm">{job.manager.full_name} {job.manager.student_id ? `(${job.manager.student_id})` : ''}</span>
            </div>
          )}
          {job.status === 'rejected' && job.reject_reason && (
            <div>
              <label className={labelCls}>{t("Rejection reason")}</label>
              <p className="text-sm font-bold text-destructive whitespace-pre-wrap">{job.reject_reason}</p>
            </div>
          )}
          {(scopedFiles?job.file_path:downloadUrl) && (
            <div>
              <label className={labelCls}>{t("Design file (DXF)")}</label>
              {scopedFiles?<Button type="button" variant="link" className="h-auto p-0 text-sm" disabled={file.downloading||file.loading} onClick={()=>void file.download(job.file_name||'manufacturing-file')}><Download className="size-3.5"/>{file.downloading?t('Downloading…'):job.file_name}</Button>:<a href={downloadUrl||undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                <Download className="size-3.5" /> {job.file_name}
              </a>}
            </div>
          )}
          {job.notes && (
            <div>
              <label className={labelCls}>{t("Notes")}</label>
              <p className="text-sm font-bold whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
            <div>
              <label className={labelCls}>{t("Requested")}</label>
              <span className="text-xs font-bold text-muted-foreground">{new Date(job.created_at).toLocaleString(app?'ko-KR':'en-US')}</span>
            </div>
            {job.completed_at && (
              <div>
                <label className={labelCls}>{t("Completed")}</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.completed_at).toLocaleString(app?'ko-KR':'en-US')}</span>
              </div>
            )}
            {job.delivered_at && (
              <div>
                <label className={labelCls}>{t("Delivered")}</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.delivered_at).toLocaleString(app?'ko-KR':'en-US')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title={t("Cancel request")}
        description={t("This cancels the laser cutting request. This action cannot be undone.")}
        confirmLabel={t("Cancel request")}
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
