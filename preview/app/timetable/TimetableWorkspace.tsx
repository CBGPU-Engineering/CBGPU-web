'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { schoolLifeRead } from '@/lib/schoolLifeRead';
import { timetableWeekDates } from '@/lib/timetablePresentation';
import { SchoolWorkspace } from '../../components/SchoolWorkspace';
import { Notice } from '../../components/DirectoryFeedback';
import { OptionPicker } from '../../components/OptionPicker';

const weekdays = ['월요일', '화요일', '수요일', '목요일', '금요일'];
const kstWeekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'Asia/Seoul' });

type Lesson = { subject: string; teacher?: string; changed?: boolean };
type Grid = Record<number, Record<number, Lesson>>;
type Choice = { value: string; label: string };
type Timetable = {
  grid: Grid;
  grades: number[];
  classes: number[];
  dates: ReturnType<typeof timetableWeekDates>;
  departments: Choice[];
  departmentRequired: boolean;
  stale: boolean;
};

function numbers(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is number => Number.isInteger(item) && item >= 1 && item <= max))).sort((a, b) => a - b);
}

async function readTimetable(
  schoolId: string, legacy: boolean, grade: number, classNumber: number, department: string, refresh: boolean, signal: AbortSignal,
): Promise<Timetable> {
  const session = legacy ? null : (await supabase.auth.getSession()).data.session;
  if (!legacy && !session) throw Error('Missing school session');
  const params = new URLSearchParams({ grade: String(grade), class: String(classNumber) });
  if (!legacy) params.set('school_id', schoolId);
  if (department) params.set('department', department);
  if (refresh) params.set('refresh', '1');
  const { response, value } = await schoolLifeRead('/api/timetable?' + params, {
    headers: session ? { Authorization: 'Bearer ' + session.access_token } : {},
    signal,
  });
  if (!response.ok || value.error || !legacy && value.school_id !== schoolId || !value.grid || typeof value.grid !== 'object' || Array.isArray(value.grid)) {
    throw Error('Invalid timetable response');
  }
  const grid: Grid = {};
  for (let day = 0; day < 5; day++) {
    grid[day] = {};
    for (let period = 1; period <= 12; period++) {
      const lesson = value.grid[day]?.[period] as Lesson | undefined;
      if (typeof lesson?.subject !== 'string' || !lesson.subject) continue;
      grid[day][period] = {
        subject: lesson.subject,
        teacher: typeof lesson.teacher === 'string' ? lesson.teacher : undefined,
        changed: lesson.changed === true,
      };
    }
  }
  const departments: Choice[] = [];
  if (value.provider === 'neis-sheet') {
    if (!Array.isArray(value.departments) || value.departments.length > 50 || typeof value.selectionRequired !== 'boolean') {
      throw Error('Invalid timetable departments');
    }
    for (const item of value.departments) {
      if (!item || !/^[a-f0-9]{20}$/.test(item.id) || typeof item.label !== 'string' || item.label.length > 300) {
        throw Error('Invalid timetable department');
      }
      departments.push({ value: item.id, label: item.label });
    }
  }
  return {
    grid, departments, departmentRequired: value.provider === 'neis-sheet' && value.selectionRequired,
    grades: numbers(value.grades, 12), classes: numbers(value.classes, 100),
    dates: timetableWeekDates(value.weekStart),
    stale: value.stale === true,
  };
}

function LessonContent({ lesson }: { lesson: Lesson }) {
  return <>
    <strong>{lesson.subject}</strong>
    {lesson.teacher && <span>{lesson.teacher}</span>}
    {lesson.changed && <span className="pv-lesson-changed">변경</span>}
  </>;
}

function Calendar({
  schoolId, schoolName, studentNumber, legacy,
}: {
  schoolId: string;
  schoolName?: string;
  studentNumber?: string | null;
  legacy: boolean;
}) {
  const initial = schoolId === 'cbsh' && studentNumber?.match(/^([1-3])([1-9])\d{2}$/);
  const [grade, setGrade] = useState(initial ? Number(initial[1]) : 1);
  const [classNumber, setClassNumber] = useState(initial ? Number(initial[2]) : 1);
  const [selectedDay, setSelectedDay] = useState(() => Math.max(0, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(kstWeekday.format(new Date()))));
  const [department, setDepartment] = useState('');
  const [refresh, setRefresh] = useState(false);
  const [request, setRequest] = useState(0);
  const [result, setResult] = useState<{ key: string; value: Timetable | null } | null>(null);
  const [catalog, setCatalog] = useState({ grades: [grade], classes: [classNumber], departments: [] as Choice[] });
  const key = [grade, classNumber, department, request].join(':');

  useEffect(() => {
    const controller = new AbortController();
    void readTimetable(schoolId, legacy, grade, classNumber, department, refresh, controller.signal).then(
      value => {
        if (controller.signal.aborted) return;
        setResult({ key, value });
        setCatalog({
          grades: numbers([...value.grades, grade], 12),
          classes: numbers([...value.classes, classNumber], 100),
          departments: value.departments,
        });
      },
      () => { if (!controller.signal.aborted) setResult({ key, value: null }); },
    );
    return () => controller.abort();
  }, [schoolId, legacy, grade, classNumber, department, refresh, key]);

  const resolved = result?.key === key ? result : null;
  const view = resolved?.value;
  const periods = view ? numbers(Object.values(view.grid).flatMap(day => Object.keys(day).map(Number)), 12) : [];
  const prepareSelection = () => setRefresh(false);
  const reload = () => { setRefresh(true); setRequest(previous => previous + 1); };

  return <>
    {schoolName && <p className="pv-meal-school">{schoolName}</p>}
    <div className="pv-timetable-control">
      <OptionPicker label="학년" value={String(grade)} options={catalog.grades.map(value => ({ value: String(value), label: value + '학년' }))}
        onChange={value => { prepareSelection(); setGrade(Number(value)); }} />
      <OptionPicker label="반" value={String(classNumber)} options={catalog.classes.map(value => ({ value: String(value), label: value + '반' }))}
        onChange={value => { prepareSelection(); setClassNumber(Number(value)); }} />
      {catalog.departments.length > 0 && <OptionPicker label="학과·과정" value={department} options={catalog.departments}
        onChange={value => { prepareSelection(); setDepartment(value); }} />}
      <button type="button" className="pv-quick-trigger" onClick={reload} aria-label="시간표 새로고침"><RefreshCw size={18} aria-hidden="true" /></button>
    </div>
    {!resolved ? <p role="status" className="pv-notice">시간표를 불러오고 있어요.</p>
      : !view ? <Notice title="시간표를 불러오지 못했어요"><button className="pv-primary" type="button" onClick={reload}>다시 불러오기</button></Notice>
      : view.departmentRequired ? <Notice title="학과·과정을 선택해 주세요" />
      : !periods.length ? <Notice title="이번 주에 등록된 시간표가 없어요" />
      : <>
        {view.stale && <p role="status" className="pv-timetable-warning">마지막으로 확인한 시간표예요. 변경 사항은 새로고침해 주세요.</p>}
        <div className="pv-week-table">
          <table aria-label="주간 시간표">
            <thead><tr><th scope="col">교시</th>{weekdays.map((day, index) =>
              <th key={day} scope="col">{day}{view.dates[index] && <small>{view.dates[index].label}</small>}</th>)}</tr></thead>
            <tbody>{periods.map(period => <tr key={period}><th scope="row">{period}교시</th>
              {weekdays.map((_, index) => {
                const lesson = view.grid[index][period];
                return <td key={index}>{lesson ? <LessonContent lesson={lesson} /> : <span>수업 없음</span>}</td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="pv-week-mobile">
          <div role="group" aria-label="요일 선택" className="pv-week-days">
            {weekdays.map((day, index) => <button key={day} type="button" aria-pressed={selectedDay === index} onClick={() => setSelectedDay(index)}>
              {day.slice(0, 1)}{view.dates[index] && <small>{view.dates[index].label}</small>}
            </button>)}
          </div>
          <h2>{weekdays[selectedDay]} 수업</h2>
          {Object.keys(view.grid[selectedDay]).length === 0 ? <Notice title="이 요일에 등록된 수업이 없어요" />
            : <ul className="pv-list">{periods.map(period => {
              const lesson = view.grid[selectedDay][period];
              return lesson && <li className="pv-item" key={period}><span>{period}교시</span><div className="pv-item-body"><LessonContent lesson={lesson} /></div></li>;
            })}</ul>}
        </div>
      </>}
    <p className="pv-meal-legacy"><a href="/timetable">기존 시간표 화면 열기</a></p>
  </>;
}

export default function TimetableWorkspace() {
  return <SchoolWorkspace path="/timetable" label="시간표">
    {school => <Calendar key={school.schoolId + ':' + (school.studentNumber || '')} {...school} />}
  </SchoolWorkspace>;
}
