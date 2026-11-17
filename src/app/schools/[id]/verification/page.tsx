import SchoolReverification from "@/components/schools/SchoolReverification";
import { SchoolFeatureBoundary } from "@/components/schools/SchoolFeatureBoundary";
import "@/components/schools/schools.css";
export const metadata = {
  title: "School reverification · CBGPU",
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
      <SchoolReverification schoolId={id} />
    </div>
  );
}
