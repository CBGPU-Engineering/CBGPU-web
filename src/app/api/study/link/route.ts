import {requireStudyUser} from '@/lib/studyAuth';
import {WindowRateLimiter} from '@/lib/requestSecurity';
import {verifyStudyStudent} from '@/lib/edusetStudent';
import {sendSchoolStudent} from '@/lib/edusetStudentClient';
import {createStudyLinkHandler} from '@/lib/edusetStudyLink';
export const runtime='nodejs';
const limits=new WindowRateLimiter(120,60_000);
export const POST=createStudyLinkHandler({authorize:async request=>{return (await requireStudyUser(request)).id},verify:token=>verifyStudyStudent(sendSchoolStudent,token),limit:key=>limits.allow(key)});
