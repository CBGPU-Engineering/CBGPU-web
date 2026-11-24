'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Moon, Sun, Sunrise, Utensils } from 'lucide-react';
import { SchoolWorkspace } from '../../components/SchoolWorkspace';
import { fetchSchoolMeal, type SchoolMealResult } from '@/lib/mealClient';
import { Notice } from '../../components/DirectoryFeedback';

const dayFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long',
});
const keyFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});
const mealIcons = { 조식: Sunrise, 중식: Sun, 석식: Moon };

type MealRead = { date: string; data: SchoolMealResult | null };

function MealMenu({ schoolId, schoolName }: { schoolId: string; schoolName?: string }) {
  const [day, setDay] = useState(() => new Date());
  const [retry, setRetry] = useState(0);
  const [read, setRead] = useState<MealRead | null>(null);
  const dayKey = keyFormat.format(day).replaceAll('-', '');
  useEffect(() => {
    const controller = new AbortController();
    void fetchSchoolMeal(dayKey, schoolId, controller.signal).then(
      data => { if (!controller.signal.aborted) setRead({ date: dayKey, data: data.date === dayKey ? data : null }); },
      () => { if (!controller.signal.aborted) setRead({ date: dayKey, data: null }); },
    );
    return () => controller.abort();
  }, [dayKey, schoolId, retry]);

  const result = read?.date === dayKey ? read : null;
  const move = (distance: number) => {
    setRead(null);
    setDay(previous => new Date(previous.getTime() + distance * 86_400_000));
  };

  return <>
    {schoolName && <p className="pv-meal-school">{schoolName}</p>}
    <div className="pv-day-navigation">
      <button type="button" aria-label="이전 날짜" onClick={() => move(-1)}><ChevronLeft size={21} aria-hidden="true" /></button>
      <h2 aria-live="polite">{dayFormat.format(day)}</h2>
      <button type="button" aria-label="다음 날짜" onClick={() => move(1)}><ChevronRight size={21} aria-hidden="true" /></button>
    </div>
    {!result ? <p role="status" className="pv-notice">식단을 불러오고 있어요.</p>
      : !result.data ? <Notice title="식단을 불러오지 못했어요">
        <button className="pv-primary" type="button" onClick={() => { setRead(null); setRetry(value => value + 1); }}>다시 불러오기</button>
      </Notice>
      : result.data.meals.length === 0 ? <Notice title="이 날짜에 등록된 급식이 없어요">
        {result.data.note && <p>{result.data.note}</p>}
      </Notice>
      : <div className="pv-meal-grid">
        {result.data.meals.map((meal, index) => {
          const Icon = Object.hasOwn(mealIcons, meal.type) ? mealIcons[meal.type as keyof typeof mealIcons] : Utensils;
          return <section key={meal.type + index} className="pv-meal-period">
            <h3><Icon size={22} aria-hidden="true" /> {meal.type}</h3>
            <ul>{meal.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
            {meal.calories && <p>{meal.calories}</p>}
          </section>;
        })}
      </div>}
    <p className="pv-meal-legacy"><a href="/meal">기존 급식 화면 열기</a></p>
  </>;
}

export default function MealWorkspace() {
  return <SchoolWorkspace path="/meal" label="급식">
    {({ schoolId, schoolName }) => <MealMenu schoolId={schoolId} schoolName={schoolName} />}
  </SchoolWorkspace>;
}
