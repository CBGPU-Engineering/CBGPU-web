'use client';

import {useEffect,useRef,useState} from 'react';
import {saveAiBlob} from '@/lib/aiClient';

export type CsvSeries = {
  column:string;
  count:number;
  points:[number,number][];
};

const number = new Intl.NumberFormat(undefined,{maximumSignificantDigits:5});

export default function CsvChart({series,filename}:{series:CsvSeries[];filename:string}){
  const [column,setColumn]=useState(0);
  const canvas=useRef<HTMLCanvasElement>(null);
  const data=series[column]||series[0];

  useEffect(()=>{
    const element=canvas.current;
    const ctx=element?.getContext('2d');
    if(!element||!ctx||!data?.points.length)return;
    const {width,height}=element;
    const values=data.points.map(([,value])=>value);
    const min=Math.min(...values);
    const max=Math.max(...values);
    const left=108,right=width-30,top=26,bottom=height-56;
    const x=(index:number)=>left+(right-left)*(index-1)/Math.max(data.count-1,1);
    const y=(value:number)=>max===min?(top+bottom)/2:bottom-(bottom-top)*(value-min)/(max-min);
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,width,height);
    ctx.font='20px system-ui';
    ctx.textAlign='right';
    ctx.textBaseline='middle';
    for(const value of new Set([min,min+(max-min)/2,max])){
      ctx.strokeStyle='#e2e8f0';
      ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(right,y(value));ctx.stroke();
      ctx.fillStyle='#334155';
      ctx.fillText(number.format(value),left-10,y(value),left-14);
    }
    ctx.strokeStyle='#2563eb';
    ctx.lineWidth=3;
    ctx.beginPath();
    data.points.forEach(([index,value],i)=>i?ctx.lineTo(x(index),y(value)):ctx.moveTo(x(index),y(value)));
    ctx.stroke();
    ctx.fillStyle='#2563eb';
    for(const [index,value] of data.points){
      ctx.beginPath();ctx.arc(x(index),y(value),3.5,0,2*Math.PI);ctx.fill();
    }
    ctx.fillStyle='#334155';
    ctx.textAlign='center';
    ctx.fillText('1',left,bottom+28);
    if(data.count>1)ctx.fillText(number.format(data.count),right,bottom+28);
  },[data]);

  if(!data)return null;
  return <figure className="chat-csv-chart">
    <figcaption>
      <label>숫자 열 <select value={column} onChange={event=>setColumn(Number(event.target.value))}>
        {series.map((item,index)=><option key={index} value={index}>{item.column||`열 ${index+1}`}</option>)}
      </select></label>
      <button type="button" onClick={()=>canvas.current?.toBlob(blob=>{
        if(blob)saveAiBlob(blob,filename.replace(/\.csv$/i,'')+'-chart.png');
      },'image/png')}>PNG 저장</button>
    </figcaption>
    <canvas ref={canvas} width={720} height={320} role="img" aria-label={data.column+'의 값 분포를 입력 순서대로 그린 그래프'}/>
    <small>가로축은 유효한 값의 입력 순서예요. {number.format(data.count)}개 중 {data.points.length}개를 표시해요.</small>
  </figure>;
}
