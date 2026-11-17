import {reserveStudySubmission,releaseStudyPeriod} from '@/lib/studySubmissionStore';
import {savedSchoolToken,rememberSchoolConnection,forgetSchoolConnection} from '@/lib/edusetStudentStore';
import {requireStudyUser,studyScopedMode} from '@/lib/studyAuth';
import {WindowRateLimiter} from '@/lib/requestSecurity';
import {handleStudentStudy,StudyFailure} from '@/lib/edusetStudent';
export const runtime='nodejs';
const limits=new WindowRateLimiter(40,60_000);
import {sendSchoolStudent as send} from '@/lib/edusetStudentClient';
async function handle(request:Request){return handleStudentStudy(request,{authorize:async req=>{return (await requireStudyUser(req)).id},send:async(...args)=>{if(studyScopedMode())await requireStudyUser(request);return send(...args)},limit:key=>limits.allow(key),getConnection:savedSchoolToken,remember:rememberSchoolConnection,disconnect:forgetSchoolConnection,reserveWrite:reserveStudySubmission,releasePeriod:releaseStudyPeriod})}
export const GET=handle;
export const POST=handle;
