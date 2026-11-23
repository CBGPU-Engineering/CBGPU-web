import {redirect} from 'next/navigation';
import {schoolAdminHref} from '@/lib/schoolAdministration';
/** Existing GPU bookings belong to CBSH; the destination rechecks its school role. */
export default function Page(){redirect('https://cbgpu.com'+schoolAdminHref('cbsh','gpu-reservations'));}
