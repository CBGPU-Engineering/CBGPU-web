export {};
declare global {
 interface Window {
  CBGPUNative?: Record<string, any>;
  cbgpuLockHeld?: boolean;
  cbgpuReleaseAuthLock?: (value?:unknown) => void;
  __documentIdentity?: string | number;
  __nativeCalls?: Array<Record<string,any>>;
  __cbgpuNativeNavigate?: (href:string)=>void;
 }
}
