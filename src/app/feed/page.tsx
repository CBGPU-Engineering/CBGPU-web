'use client';

import { useState } from 'react';
import TechNews from '@/components/feed/TechNews';
import Graveyard from '@/components/feed/Graveyard';
import SchoolNews from '@/components/feed/SchoolNews';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';

const TABS = [
  { id: 'school',    label: '🏫 학교 소식',   desc: '우리 학교 공지·학사일정' },
  { id: 'news',      label: '📡 기술 소식',   desc: 'AI · 보안 · 임베디드' },
  { id: 'graveyard', label: '🪦 서비스 종료',   desc: '서비스 장례식' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function FeedPage() {
  const [tab, setTab] = useState<TabId>('school');

  return (
    <section className="cb-page-content mx-auto max-w-3xl min-w-0 space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="cb-page-title">소식</h1>
        <p className="cb-page-sub mt-1">학교 공지부터 기술 소식까지 한곳에서 확인해요.</p>
      </div>

      <SegmentedTabs
        items={TABS.map(t => ({
          value: t.id,
          label: (
            <span className="flex flex-col items-center gap-0.5 text-center">
              <span>{t.label}</span>
              <span className="text-sm font-medium">{t.desc}</span>
            </span>
          ),
        }))}
        value={tab}
        onChange={(v) => setTab(v as TabId)}
      />

      <div className="w-full min-w-0">
        {tab === 'school'    && <SchoolNews />}
        {tab === 'news'      && <TechNews />}
        {tab === 'graveyard' && <Graveyard />}
      </div>
    </section>
  );
}
