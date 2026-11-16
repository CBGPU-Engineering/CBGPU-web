import test from 'node:test';import assert from 'node:assert/strict';
import {androidRelease,shouldOfferAndroidUpdate} from '../src/lib/appUpdates.ts';
const release=androidRelease({version:'1.0.8',buildNumber:9,downloadUrl:'https://evil.test/app.apk',notes:'Update'});
test('release URLs are owned and versioned; malformed metadata is rejected',()=>{assert.equal(release.downloadUrl,'/downloads/cbgpu.apk?build=9');for(const x of [null,{}, {version:'1.0.8',buildNumber:'9'},{version:'bad',buildNumber:9},{version:'1.0.8',buildNumber:0}])assert.equal(androidRelease(x),null)});
test('only older installed Android builds are offered an update',()=>{assert.equal(shouldOfferAndroidUpdate(release,{platform:'android',buildNumber:8}),true);for(const info of [{platform:'android',buildNumber:9},{platform:'android',buildNumber:10},{platform:'ios',buildNumber:8},{platform:'android',buildNumber:NaN}])assert.equal(shouldOfferAndroidUpdate(release,info),false)});
test('known legacy Android bridges upgrade once; browsers are never prompted',()=>{assert.equal(shouldOfferAndroidUpdate(release,null,true),true);assert.equal(shouldOfferAndroidUpdate(release,null,false),false)});
