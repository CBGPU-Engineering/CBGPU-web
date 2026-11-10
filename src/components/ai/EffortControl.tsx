'use client';
import {Popover} from 'radix-ui';
import {SlidersHorizontal,Check} from 'lucide-react';
const levels=[
 {value:'low',label:'빠르게',description:'간단한 질문에 빠르고 간결하게 답해요.'},
 {value:'medium',label:'균형',description:'속도와 꼼꼼함을 균형 있게 조절해요.'},
 {value:'high',label:'깊게',description:'복잡한 문제를 더 꼼꼼히 검토해요. 시간이 더 걸릴 수 있어요.'},
] as const;
export default function EffortControl({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const index=Math.max(0,levels.findIndex(level=>level.value===value)),selected=levels[index];
 return <Popover.Root><Popover.Trigger asChild><button type="button" className="chat-effort-trigger" aria-label={'노력 정도: '+selected.label}><SlidersHorizontal size={15}/><span>{selected.label}</span></button></Popover.Trigger><Popover.Portal><Popover.Content className="chat-effort-panel" side="top" align="start" sideOffset={12} collisionPadding={12} aria-label="응답 노력 설정"><header><h2>응답 노력</h2><span><Check size={13}/>{selected.label}</span></header><div className="chat-effort-range"><input type="range" min={0} max={2} step={1} value={index} aria-label="노력 정도" aria-valuetext={selected.label} aria-describedby="ai-effort-description" onChange={event=>onChange(levels[Number(event.target.value)].value)} style={{'--effort-progress':`${index*50}%`} as React.CSSProperties}/><div className="chat-effort-labels">{levels.map(level=><button type="button" key={level.value} aria-pressed={value===level.value} onClick={()=>onChange(level.value)}>{level.label}</button>)}</div></div><p id="ai-effort-description">{selected.description}</p><Popover.Arrow className="chat-effort-arrow"/></Popover.Content></Popover.Portal></Popover.Root>;
}
