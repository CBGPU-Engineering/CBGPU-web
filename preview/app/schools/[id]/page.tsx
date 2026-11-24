import { Detail } from '../../../components/Directory';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Detail kind="schools" id={id} />;
}
