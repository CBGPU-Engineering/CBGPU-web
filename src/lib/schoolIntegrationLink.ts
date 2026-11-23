/** Public school identifiers only; never accept a URL or a redirect destination. */
export function schoolIntegrationId(value:unknown):string|undefined{return typeof value==='string'&&/^[-A-Za-z0-9_]{1,100}$/.test(value)?value:undefined}
export function schoolIntegrationHref(value?:unknown){const id=schoolIntegrationId(value);return 'https://docs.cbgpu.com/school-integration'+(id?'?catalog_school_id='+encodeURIComponent(id):'')}
export function schoolApplicationHref(value?:unknown){const id=schoolIntegrationId(value);return 'https://cbgpu.com/schools/new'+(id?'?catalog_school_id='+encodeURIComponent(id):'')}
