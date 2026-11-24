import TimetableEntry from './TimetableEntry';

export const metadata = { title: '시간표' };

export default function Page() {
  return <section className="pv-page pv-timetable">
    <header className="pv-page-header">
      <h1>시간표</h1>
      <p>학년과 반을 선택해 한 주 수업을 확인해요.</p>
    </header>
    <TimetableEntry />
  </section>;
}
