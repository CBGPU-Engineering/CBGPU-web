export type AndroidRelease={version:string;buildNumber:number;notes:string;downloadUrl:string};
export function androidRelease(value:unknown):AndroidRelease|null{
 if(!value||typeof value!=='object')return null;
 const x=value as Record<string,unknown>;
 if(typeof x.version!=='string'||!/^\d+\.\d+\.\d+$/.test(x.version)||!Number.isSafeInteger(x.buildNumber)||Number(x.buildNumber)<9)return null;
 return {version:x.version,buildNumber:Number(x.buildNumber),notes:typeof x.notes==='string'?x.notes.slice(0,1000):'',downloadUrl:'/downloads/cbgpu.apk?build='+x.buildNumber};
}
export function shouldOfferAndroidUpdate(release:AndroidRelease,installed:{platform:string;buildNumber:number}|null,legacyAndroid=false){
 if(installed)return installed.platform==='android'&&Number.isSafeInteger(installed.buildNumber)&&installed.buildNumber>0&&installed.buildNumber<release.buildNumber;
 // All shipped bridge versions without getAppInfo predate Android build 9.
 return legacyAndroid&&release.buildNumber>=9;
}
