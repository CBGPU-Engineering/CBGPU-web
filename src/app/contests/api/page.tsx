import AuthGate from '@/components/AuthGate';
import {ContestApiKeys}from'@/components/contests/ContestApiKeys';
export const metadata={title:'대회 API 연동'};
export default function Page(){return <AuthGate><ContestApiKeys/></AuthGate>}
