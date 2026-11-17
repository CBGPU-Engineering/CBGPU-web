import SchoolLifeSettings from "@/components/schools/SchoolLifeSettings";
import { SchoolFeatureBoundary } from "@/components/schools/SchoolFeatureBoundary";
import "@/components/schools/schools.css";
export const metadata = {
  title: "Reviewed school integrations · CBGPU Admin",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1 !== "1")
    return <SchoolFeatureBoundary />;
  const { id } = await params;
  return (
    <div className="cb-school-page">
      <SchoolLifeSettings schoolId={id} editor />
    </div>
  );
}
