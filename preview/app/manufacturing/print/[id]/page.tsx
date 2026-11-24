import EquipmentEntry from '../../EquipmentEntry';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EquipmentEntry kind="print" stage="details" id={id} />;
}
