export type EquipmentAccess = 'loading' | 'allowed' | 'denied' | 'error' | 'unauthenticated';
export function equipmentAccessView(input: {isLoading: boolean; authTimedOut: boolean; signedIn: boolean; access: EquipmentAccess; permittedDetail: boolean}): 'loading' | 'sign-in' | 'denied' | 'error' | 'allowed' {
  if (input.isLoading) return input.authTimedOut ? 'error' : 'loading';
  if (!input.signedIn || input.access === 'unauthenticated') return 'sign-in';
  if (input.access === 'loading') return 'loading';
  if (input.access === 'error') return 'error';
  if (input.access === 'denied' || !input.permittedDetail) return 'denied';
  return 'allowed';
}
