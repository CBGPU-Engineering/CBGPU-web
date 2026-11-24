import MealEntry from './MealEntry';

export const metadata = { title: '급식' };

export default function Page() {
  return <section className="pv-page pv-meal">
    <header className="pv-page-header">
      <h1>급식</h1>
      <p>학교의 날짜별 식단을 확인해요.</p>
    </header>
    <MealEntry />
  </section>;
}
