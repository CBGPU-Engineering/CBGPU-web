"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/useAuth";
import { multiSchoolEnabled, schoolsRequest, selectAccountSchool } from "@/lib/schoolsClient";
import {
  RESOURCE_IDS,
  resourceAllowed,
  resourceLeaseActive,
  resourceReason,
  serverTimestamp,
  validResourceContexts,
  type ResourceAccess,
  type ResourceContext,
  type ResourceContexts,
  type SchoolResource,
} from "@/lib/schoolResourceContext";
export type ResourceScope = {
  status: "legacy" | "loading" | "ready" | "none" | "unavailable";
  items: ResourceContext[];
  current: ResourceContext | null;
  access: ResourceAccess | null;
  error: string;
  serverNow: number;
  refresh: () => Promise<void>;
  select: (schoolId: string) => Promise<void>;
  verify: (resource: SchoolResource) => Promise<boolean>;
};
const initial: ResourceScope = {
  status: multiSchoolEnabled ? "loading" : "legacy",
  items: [],
  current: null,
  access: null,
  error: "",
  serverNow: 0,
  refresh: async () => {},
  select: async () => {},
  verify: async () => false,
};
const Context = createContext<ResourceScope>(initial);
export function SchoolResourceScopeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  return (
    <ResourceSession key={user?.id || "anonymous"}>{children}</ResourceSession>
  );
}
type Snapshot = {
  items: ResourceContext[];
  current: ResourceContext | null;
  access: ResourceAccess | null;
  serverTime: number;
  received: number;
};
function ResourceSession({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth(),
    [status, setStatus] = useState<ResourceScope["status"]>(initial.status),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0);
  const generation = useRef(0),
    live = useRef(true),
    selected = useRef(""),
    flight = useRef<{sequence:number;promise:Promise<void>}|null>(null),
    selectionGeneration = useRef(0),
    selectionPending = useRef(false),
    authLoading = useRef(isLoading);
  authLoading.current=isLoading;
  const owner = user?.id;
  const read = useCallback(async (): Promise<Snapshot> => {
    const contexts = validResourceContexts(
      await schoolsRequest<ResourceContexts>(
        "resource-contexts",
        "GET",
        undefined,
        false,
        owner,
      ),
    );
    const serverTime = serverTimestamp(contexts.server_time);
    const current =
      contexts.items.find(
        (item) =>
          item.school_id === contexts.current_school_id &&
          resourceLeaseActive(item.expires_at, serverTime),
      ) || null;
    if (!current)
      return {
        items: contexts.items,
        current: null,
        access: null,
        serverTime,
        received: performance.now(),
      };
    const access = await schoolsRequest<ResourceAccess>(
      "schools/" + encodeURIComponent(current.school_id) + "/resource-access",
      "GET",
      undefined,
      false,
      owner,
    );
    if (
      access.school_id !== current.school_id ||
      access.context_type !== current.type ||
      !access.resources ||
      RESOURCE_IDS.some(
        (id) => id !== "ai" && id !== "central_cpu" && typeof access.resources[id] !== "boolean",
      ) ||
      (access.resources.central_cpu !== undefined && typeof access.resources.central_cpu !== "boolean") ||
      (access.resources.ai !== undefined &&
        typeof access.resources.ai !== "boolean") ||
      (access.expires_at !== null &&
        !Number.isFinite(Date.parse(access.expires_at)))
    )
      throw Error("선택한 학교의 자원 권한을 확인하지 못했어요.");
    return {
      items: contexts.items,
      current,
      access,
      serverTime: serverTimestamp(access.server_time),
      received: performance.now(),
    };
  }, [owner]);
  const refresh = useCallback(async () => {
    if (!multiSchoolEnabled||selectionPending.current) return;
    if (!owner) {
      selected.current = "";
      setSnapshot(null);
      setStatus(authLoading.current ? "loading" : "none");
      return;
    }
    if(flight.current?.sequence===generation.current)return flight.current.promise;
    const seq = ++generation.current;
    const pending=(async()=>{try {
      const next = await read();
      if (!live.current || seq !== generation.current) return;
      selected.current = next.current
        ? next.current.school_id + ":" + next.current.type
        : "";
      setSnapshot(next);
      setStatus(next.current ? "ready" : "none");
      setError("");
    } catch (e) {
      if (live.current && seq === generation.current) {
        selected.current = "";
        setSnapshot(null);
        setStatus("unavailable");
        setError((e as Error).message);
      }
    }
    })();
    flight.current={sequence:seq,promise:pending};
    try{await pending}finally{if(flight.current?.promise===pending)flight.current=null}
  }, [owner, read]);
  useEffect(()=>{if(multiSchoolEnabled&&!owner){setSnapshot(null);setStatus(isLoading?"loading":"none")}},[owner,isLoading]);
  useEffect(() => {
    live.current = true;
    if (!multiSchoolEnabled) return;
    void refresh();
    const sync = (event: Event) => {
      if ((event as CustomEvent).detail?.source !== "resource-scope") {
        if (event.type === "cbgpu-school-changed") {
          selectionGeneration.current++;
          selectionPending.current=!!(event as CustomEvent).detail?.pending;
          generation.current++;
          selected.current = "";
          setSnapshot(null);
          setStatus("loading");
          if((event as CustomEvent).detail?.pending)return;
        }
        void refresh();
      }
    };
    const timer = setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", sync);
    window.addEventListener("cbgpu-school-changed", sync);
    return () => {
      live.current = false;
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("cbgpu-school-changed", sync);
    };
  }, [refresh]);
  useEffect(() => {
    if (
      !multiSchoolEnabled ||
      !(snapshot?.current?.expires_at || snapshot?.access?.expires_at)
    )
      return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [snapshot?.current?.expires_at, snapshot?.access?.expires_at]);
  async function select(schoolId: string) {
    if (!multiSchoolEnabled || !owner)
      throw Error("로그인 후 자원 이용 학교를 선택해주세요.");
    const selection=++selectionGeneration.current;
    selectionPending.current=true;
    generation.current++;
    selected.current = "";
    setSnapshot(null);
    setStatus("loading");
    setError("");
    window.dispatchEvent(new CustomEvent("cbgpu-school-changed",{detail:{school_id:schoolId,source:"resource-scope",pending:true}}));
    try {
      await selectAccountSchool(schoolId, owner);
      if (!live.current||selection!==selectionGeneration.current) return;
      selectionPending.current=false;generation.current++;
      await refresh();
      if (!live.current||selection!==selectionGeneration.current) return;
      window.dispatchEvent(
        new CustomEvent("cbgpu-school-changed", {
          detail: { school_id: schoolId, source: "resource-scope" },
        }),
      );
    } catch (e) {
      if(!live.current||selection!==selectionGeneration.current)throw e;
      selectionPending.current=false;generation.current++;
      await refresh();
      if(live.current&&selection===selectionGeneration.current)window.dispatchEvent(new CustomEvent("cbgpu-school-changed",{detail:{source:"resource-scope"}}));
      throw e;
    }
  }
  async function verify(resource: SchoolResource) {
    if (!multiSchoolEnabled || !owner) return false;
    const seq = generation.current,
      expected = selected.current;
    if (!expected) return false;
    try {
      const next = await read();
      if (!live.current || expected !== selected.current) return false;
      const nextKey = next.current
        ? next.current.school_id + ":" + next.current.type
        : "";
      // Concurrent background refreshes must not cancel an otherwise fresh user action.
      // They also must not let an old response restore a different selection.
      if (seq === generation.current) {
        selected.current = nextKey;
        setSnapshot(next);
        setStatus(next.current ? "ready" : "none");
        setError("");
      }
      return (
        nextKey === expected &&
        resourceAllowed(next.current, next.access, resource, next.serverTime)
      );
    } catch (e) {
      if (live.current && seq === generation.current) {
        selected.current = "";
        setSnapshot(null);
        setStatus("unavailable");
        setError((e as Error).message);
      }
      return false;
    }
  }
  useEffect(()=>{
    if(!snapshot||!multiSchoolEnabled)return;
    const deadlines=[snapshot.current?.expires_at,snapshot.access?.expires_at].filter((value):value is string=>!!value).map(Date.parse);
    if(!deadlines.length)return;
    const serverNow=snapshot.serverTime+Math.max(0,performance.now()-snapshot.received);
    const delay=Math.max(0,Math.min(...deadlines)-serverNow)+1;
    const timer=setTimeout(()=>{setTick(value=>value+1);void refresh()},Math.min(delay,2_147_000_000));
    return()=>clearTimeout(timer);
  },[snapshot,refresh]);
  void tick;
  const serverNow = snapshot
    ? snapshot.serverTime + Math.max(0, performance.now() - snapshot.received)
    : 0;
  const current =
    snapshot?.current &&
    resourceLeaseActive(snapshot.current.expires_at, serverNow) &&
    resourceLeaseActive(snapshot.access?.expires_at ?? null, serverNow)
      ? snapshot.current
      : null;
  const value: ResourceScope = {
    status: status === "ready" && !current ? "none" : status,
    items: (snapshot?.items || []).filter((item) =>
      resourceLeaseActive(item.expires_at, serverNow),
    ),
    current,
    access: current ? snapshot?.access || null : null,
    error,
    serverNow,
    refresh,
    select,
    verify,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSchoolResourceScope = () => useContext(Context);
export function useSchoolResourcePermission(
  resource: SchoolResource,
  legacyAllowed = true,
) {
  const scope = useSchoolResourceScope();
  const enabled = multiSchoolEnabled;
  return {
    enabled,
    allowed: enabled
      ? scope.status === "ready" &&
        resourceAllowed(scope.current, scope.access, resource, scope.serverNow)
      : legacyAllowed,
    status: scope.status,
    reason:
      scope.error ||
      resourceReason(
        scope.access?.reasons[resource] ||
          (!scope.current ? "NO_CONTEXT" : undefined),
      ),
    verify: () =>
      enabled ? scope.verify(resource) : Promise.resolve(legacyAllowed),
  };
}
