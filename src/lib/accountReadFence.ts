/** Reject async account data started before an identity change, including A → B → A. */
export function createAccountReadFence() {
  let owner: string | null = null;
  let generation = 0;
  return {
    setOwner(next: string | null) {
      if (owner === next) return false;
      owner = next;
      generation++;
      return true;
    },
    invalidate() { generation++; },
    lease(expectedOwner: string) {
      const started = generation;
      return () => owner === expectedOwner && started === generation;
    },
  };
}
