import test from 'node:test';import assert from 'node:assert/strict';
import{schoolNewsSource}from'../src/lib/schoolNewsSource.ts';
const dto={school_id:'school-b',status:'READY',school_name:'학교 B',news_url:'https://school.example.org/rss/notice',calendar_url:'https://school.example.org/calendar.rss',allowed_hosts:['school.example.org']};
test('school news uses exactly reviewed school sources, never CBsh fallback',()=>{
 assert.equal(schoolNewsSource('school-b',dto,'notice','2026-11').url,dto.news_url);
 assert.equal(schoolNewsSource('school-b',dto,'schedule','2026-11').url,dto.calendar_url);
 for(const changed of [{school_id:'cbsh'},{status:'DISABLED'},{news_url:null},{allowed_hosts:null}])assert.throws(()=>schoolNewsSource('school-b',{...dto,...changed},'notice','2026-11'));
});
test('reviewed CBE calendar preserves source path and supplies selected month',()=>{
 const source=schoolNewsSource('school-b',{...dto,calendar_url:'https://school.cbe.go.kr/another-h/M010407/list',allowed_hosts:['school.cbe.go.kr']},'schedule','2027-02');
 assert.equal(source.url,'https://school.cbe.go.kr/another-h/M010407/list?y=2027&m=2');
});
