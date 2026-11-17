/** The automation browser receives rendering settings, never platform/auth/mail credentials. */
export function browserEnvironment(source:Readonly<Record<string,string|undefined>>=process.env):Record<string,string>{
 const result:Record<string,string>={};
 for(const key of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','TZ','FONTCONFIG_PATH','LD_LIBRARY_PATH']){
  const value=source[key];if(typeof value==='string')result[key]=value;
 }
 return result;
}
