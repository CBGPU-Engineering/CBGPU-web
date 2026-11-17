/** Report values are observations, never a forecast or a claim of uplift. */
export const revenueFields=['date','device','requests','impressions','clicks','estimated_revenue','confirmed_revenue'] as const;
export type RevenueField=typeof revenueFields[number];
export type RevenueMapping=Partial<Record<RevenueField,string>>;
// Historical API `device` keys identify supplied banner formats, not physical visitor devices.
export type ReportDevice='MOBILE'|'DESKTOP'|'UNKNOWN';
export type RevenueAttribution={device_basis?:'AD_UNIT_FORMAT';physical_device_revenue?:null;physical_device_reason?:'NO_OFFICIAL_DEVICE_DIMENSION'};
export function adFormatLabel(format:ReportDevice){return format==='MOBILE'?'Mobile banner format':format==='DESKTOP'?'Desktop banner format':'Unmapped banner units'}
export type DeviceMetrics={device:ReportDevice;requests:number|null;impressions:number|null;clicks:number|null;estimated_revenue:number|null;confirmed_revenue:number|null};
export function ratio(numerator:number|null,denominator:number|null,multiplier=1){return numerator===null||denominator===null||denominator<=0?null:numerator/denominator*multiplier}
export function displayMetric(value:number|null|undefined,style:'count'|'money'|'percent'='count',currency='KRW'){if(value===null||value===undefined||!Number.isFinite(value))return 'N/A';return style==='money'?new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(value):style==='percent'?value.toFixed(2)+'%':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value)}
/** Bounded local preview only. The server must independently validate all imported bytes. */
export function csvPreview(text:string,delimiter=','){
 if(new TextEncoder().encode(text).length>512*1024)throw Error('Use a CSV report no larger than 512 KB.');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;const input=text.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const ch=input[i];if(quoted){if(ch==='"'){if(input[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=ch;continue}
 if(closed&&ch!==delimiter&&ch!=='\r'&&ch!=='\n')throw Error('Unexpected characters after a quoted CSV cell.');
 if(ch==='"'){if(cell||closed)throw Error('Invalid CSV quoting.');quoted=true}else if(ch===delimiter){row.push(cell);cell='';closed=false}else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.length))rows.push(row);row=[];cell='';closed=false}else cell+=ch;
 if(rows.length>5001||row.length>64||cell.length>10000)throw Error('The report exceeds preview bounds.');
 }
 if(quoted)throw Error('A quoted CSV cell is not closed.');row.push(cell);if(row.some(v=>v.length))rows.push(row);
 if(rows.length>5001)throw Error('Use at most 5,000 report rows.');
 if(rows.length<2)throw Error('The CSV must contain a header and at least one report row.');
 const headers=rows.shift()!.map(value=>value.trim());if(headers.length>64||headers.some(value=>!value)||new Set(headers).size!==headers.length)throw Error('CSV column names must be nonempty and unique.');
 if(rows.some(value=>value.length!==headers.length))throw Error('CSV rows must match the header width.');
 return{headers,rows:rows.slice(0,5),rowCount:rows.length};
}
export function initialRevenueMapping(headers:string[]):RevenueMapping{const mapping:RevenueMapping={};for(const key of revenueFields)if(headers.includes(key))mapping[key]=key;return mapping}
export type ImportColumns={date?:string;unit_id:string;revenue:string;impressions?:string;clicks?:string;requests?:string};
export type RevenueImport={csv:string;granularity:'DAY'|'PERIOD';period_start:string;period_end:string;currency:'KRW';timezone:'Asia/Seoul'|'UTC';kind:'ESTIMATED'|'CONFIRMED';columns:ImportColumns;format:{delimiter:','|';'|'\t';date_format:'YYYY-MM-DD'|'YYYY.MM.DD'|'YYYY/MM/DD';decimal_separator:'.'|',';group_separator:','|'.'|' '|''}};
export type RevenueDevice=RevenueAttribution&{device:ReportDevice;revenue_krw:string;impressions:string|number|null;clicks:string|number|null;requests:string|number|null;ecpm_krw:string|null;ctr_percent:string|null};
export type RevenuePreview=RevenueAttribution&{preview_hash:string;rows_count:number;period_start:string;period_end:string;kind:'ESTIMATED'|'CONFIRMED';currency:'KRW';devices:RevenueDevice[];warnings:string[];conflicts:number};
export function reportedMetric(value:string|number|null|undefined,style:'count'|'money'|'percent'='count'){if(value===null||value===undefined||value==='')return 'N/A';if(style==='count'&&typeof value==='string'&&/^\d+$/.test(value))return new Intl.NumberFormat('en-US').format(BigInt(value));const number=Number(value);return displayMetric(Number.isFinite(number)?number:null,style)}
export type RevenueDay=RevenueAttribution&{date:string;device:ReportDevice;revenue_krw:string;coverage_verified:boolean};
export type RevenueMonth=RevenueAttribution&{month:string;device:ReportDevice;revenue_krw:string;coverage_verified:boolean};
export type RevenueAnalytics=RevenueAttribution&{kind:'ESTIMATED'|'CONFIRMED';currency:'KRW';timezone:'Asia/Seoul'|'UTC';period_start:string;period_end:string;devices:RevenueDevice[];warnings:string[];reports_count:number;daily?:RevenueDay[];monthly?:RevenueMonth[]};
