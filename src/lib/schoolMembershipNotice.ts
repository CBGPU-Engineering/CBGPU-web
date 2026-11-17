import type { SchoolMembership } from "./schoolsClient";
/** Explanation only; resource authorization always remains server-side. */
export function schoolMembershipNotice(
  owner: string,
  memberships: SchoolMembership[],
  status: string,
) {
  if (
    status === "loading" ||
    status === "legacy" ||
    status === "ready" ||
    status === "unavailable"
  )
    return null;
  const own = memberships.filter((member) => member.user_id === owner);
  const target =
    own.find((member) => member.status === "REVERIFICATION_REQUIRED") ||
    own.find((member) => member.status === "PENDING_VERIFICATION") ||
    own.find((member) => member.status === "SUSPENDED");
  if (!target) return null;
  const school = target.school.display_name || target.school.official_name;
  return target.status === "REVERIFICATION_REQUIRED"
    ? {
        text: `${school}의 새 학번 인증이 필요해요. 개인 프로젝트는 계속 사용할 수 있어요.`,
        href:
          "/schools/" + encodeURIComponent(target.school_id) + "/verification",
        label: "학교 소속 재인증",
      }
    : target.status === "PENDING_VERIFICATION"
      ? {
          text: `${school} ${target.membership_type === "TEACHER" ? "교사 소속" : "학교 소속"}을 확인하고 있어요. 승인 전까지 학교 자원은 제한되며 개인 프로젝트는 유지돼요.`,
          href: "/schools",
          label: "소속 확인 상태 보기",
        }
      : {
          text: `${school} 소속 이용이 제한되어 있어요. 학교 관리자에게 확인해주세요.`,
          href: "/schools",
          label: "내 학교 보기",
        };
}
