'use client';
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
import { Model3MFViewer } from '@/components/manufacturing/Model3MFViewer';
import { LocateStudentButton } from '@/components/admin/LocateStudentButton';
import { deleteManufacturingFile } from '@/lib/manufacturing/storage';
import {
  ArrowLeft, Download, CheckCircle2, Clock, XCircle, Boxes, Printer, Trash2, PackageCheck,
} from 'lucide-react';

const labelCls = 'text-xs font-black uppercase tracking-widest text-muted-foreground mb-1 block';

const STATUS_INFO: Record<string, { icon: React.ReactNode; variant: any; label: string }> = {
  pending:  { icon: <Clock className="size-4" />,        variant: 'warning', label: "Pending approval" },
  accepted: { icon: <Boxes className="size-4" />,         variant: 'default', label: "Queued" },
  queued:   { icon: <Boxes className="size-4" />,         variant: 'default', label: "Queued" },
  printing: { icon: <Printer className="size-4" />,       variant: 'success', label: "Printing" },
  done:     { icon: <CheckCircle2 className="size-4" />,  variant: 'success', label: "Completed" },
  rejected: { icon: <XCircle className="size-4" />,       variant: 'danger',  label: "Rejected" },
  canceled: { icon: <Trash2 className="size-4" />,        variant: 'muted',   label: "Canceled" },
};

export default function PrintJobDetailPage() {
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
    const { data, error } = await supabase.from('print_jobs').select(manufacturingJobSelect(', preferred_printer:preferred_printer_id(name)')).eq('id', id).single().returns<any>();
    if(!current())return;
    if (error) { showError("Request not found."); router.push(managementBase); return; }
    const labels=await attachManufacturingManagers(supabase,'print',[data]);if(!current())return;setJobState({viewer:expected,id,value:labels.data[0]});setRequester(null);if(labels.error)showError('Manager display details are unavailable.');
    setLoading(false);
    if (!scopedFiles&&data.file_path) {
      const { data: signed } = await supabase.storage.from('manufacturing').createSignedUrl(data.file_path, 3600);
      if(current())setDownloadUrl(signed?.signedUrl || null);
    } else {
      setDownloadUrl(null);
    }
    if (data.user_id !== user?.id) {
      const { data: profiles,error:profileError } = await manufacturingProfiles(supabase,'print',[data.user_id]);
      if(!current())return;setRequester(profiles?.[0]||null);if(profileError)showError('Requester details are unavailable.');
    }
  };

  useEffect(() => {currentViewer.current=user?.id;if(id&&user)void fetchJob();return()=>{generation.current++;currentViewer.current=undefined};}, [id,user?.id]);

  const handleCancel = async () => {
    const { error } = await supabase.from('print_jobs').update({ status: 'canceled' }).eq('id', job.id);
    if (error) showError("Could not cancel this request. Refresh its status and try again.");
    else { showSuccess("Request canceled."); setCancelOpen(false); fetchJob(); }
  };

  const handleMarkDelivered = async () => {
    const { error } = await supabase.from('print_jobs')
      .update({ delivered_at: new Date().toISOString(), file_path: null, file_name: null })
      .eq('id', job.id);
    if (error) { showError("Could not save this change. Refresh the job status and try again."); return; }
    await deleteManufacturingFile(job.file_path);
    showSuccess("Marked as delivered.");
    fetchJob();
  };

  if (loading||!job) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="Loading" />
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
          <ArrowLeft className="size-3" /> Back
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="cb-page-title">3D print request</h1>
              <Badge variant={statusInfo.variant} icon={statusInfo.icon}>{statusInfo.label}</Badge>
              {job.status === 'done' && job.delivered_at && (
                <Badge variant="success" icon={<PackageCheck className="size-3" />}>Delivered</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-bold opacity-70">{job.file_name || "No file"}</p>
          </div>

          {isOwner && job.status === 'pending' && (
            <Button variant="destructive" className="font-black text-xs uppercase gap-1.5 h-9" onClick={() => setCancelOpen(true)}>
              <Trash2 className="size-3.5" />  Cancel request
            </Button>
          )}
          {!isOwner && job.status === 'done' && !job.delivered_at && (
            <div className="flex items-center gap-2">
              <LocateStudentButton studentId={requester?.student_id} studentName={requester?.full_name} />
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase gap-1.5 h-9" onClick={handleMarkDelivered}>
                <PackageCheck className="size-3.5" />  Hand delivered
              </Button>
            </div>
          )}
        </div>
      </div>

      {scopedFiles&&file.error&&<div role="alert" className="rounded-xl border p-4 text-sm space-y-2"><p>Current file access could not be verified. The request is preserved; sign in again or check your equipment permissions.</p><Button type="button" variant="outline" size="sm" onClick={file.reload}>Retry file access</Button></div>}
      {previewUrl && job.file_name?.toLowerCase().endsWith('.3mf') && (
        <Model3MFViewer src={previewUrl} english />
      )}

      <div className="border-2 rounded-3xl overflow-hidden bg-card">
        <div className="px-6 py-4 border-b-2 bg-muted/20">
          <p className="font-black uppercase tracking-widest text-xs">Details</p>
        </div>
        <div className="p-6 grid gap-5">
          {requester && (
            <div>
              <label className={labelCls}>Requester</label>
              <span className="font-bold text-sm">{requester.full_name || 'Unknown'} {requester.student_id ? `(${requester.student_id})` : ''}</span>
            </div>
          )}
          <div>
            <label className={labelCls}>Mode</label>
            <span className="font-bold text-sm">{job.mode === 'beginner' ? "Beginner (manager prepares slicing)" : "Advanced (requester provides a sliced file)"}</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Quantity</label>
              <span className="font-bold text-sm">{job.quantity}</span>
            </div>
            <div>
              <label className={labelCls}>Plates</label>
              <span className="font-bold text-sm">
                {job.plate_count} files{job.plate_count > 1 && job.status === 'printing' ? ` (${job.plates_completed} completed)` : ''}
              </span>
            </div>
            <div>
              <label className={labelCls}>Material</label>
              <span className="font-bold text-sm">{job.material || "Any"}</span>
            </div>
            <div>
              <label className={labelCls}>Color</label>
              <span className="font-bold text-sm">{job.color || "Any"}</span>
            </div>
          </div>
          {job.purpose && (
            <div>
              <label className={labelCls}>Purpose</label>
              <p className="text-sm font-bold whitespace-pre-wrap">{job.purpose}</p>
            </div>
          )}
          {job.preferred_printer?.name && (
            <div>
              <label className={labelCls}>Preferred printer</label>
              <span className="font-bold text-sm">{job.preferred_printer.name}</span>
            </div>
          )}
          {job.manager?.full_name && (
            <div>
              <label className={labelCls}>Manager</label>
              <span className="font-bold text-sm">{job.manager.full_name} {job.manager.student_id ? `(${job.manager.student_id})` : ''}</span>
            </div>
          )}
          {job.status === 'rejected' && job.reject_reason && (
            <div>
              <label className={labelCls}>Rejection reason</label>
              <p className="text-sm font-bold text-destructive whitespace-pre-wrap">{job.reject_reason}</p>
            </div>
          )}
          {(scopedFiles?job.file_path:downloadUrl) && (
            <div>
              <label className={labelCls}>Model file</label>
              {scopedFiles?<Button type="button" variant="link" className="h-auto p-0 text-sm" disabled={file.downloading||file.loading} onClick={()=>void file.download(job.file_name||'manufacturing-file')}><Download className="size-3.5"/>{file.downloading?'Downloading…':job.file_name}</Button>:<a href={downloadUrl||undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                <Download className="size-3.5" /> {job.file_name}
              </a>}
            </div>
          )}
          {job.notes && (
            <div>
              <label className={labelCls}>Notes</label>
              <p className="text-sm font-bold whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
          {job.printer_id && (
            <div>
              <label className={labelCls}>Printer</label>
              <span className="font-bold text-sm">Printer {job.printer_id}</span>
            </div>
          )}
          {job.estimated_end_at && job.status === 'printing' && (
            <div>
              <label className={labelCls}>Estimated finish</label>
              <span className="font-bold text-sm">{new Date(job.estimated_end_at).toLocaleString('en-US')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
            <div>
              <label className={labelCls}>Requested</label>
              <span className="text-xs font-bold text-muted-foreground">{new Date(job.created_at).toLocaleString('en-US')}</span>
            </div>
            {job.completed_at && (
              <div>
                <label className={labelCls}>Completed</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.completed_at).toLocaleString('en-US')}</span>
              </div>
            )}
            {job.collected_at && (
              <div>
                <label className={labelCls}>Collected</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.collected_at).toLocaleString('en-US')}</span>
              </div>
            )}
            {job.delivered_at && (
              <div>
                <label className={labelCls}>Delivered</label>
                <span className="text-xs font-bold text-muted-foreground">{new Date(job.delivered_at).toLocaleString('en-US')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel request"
        description="This cancels the 3D print request. This action cannot be undone."
        confirmLabel="Cancel request"
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
