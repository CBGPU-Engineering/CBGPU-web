import test from'node:test';import assert from'node:assert/strict';
import{blankScaleAnswer,pollScaleRange,pollScaleNumber,pollScaleSummary}from'../src/lib/pollScale.ts';
test('default scale and bounded preview preserve all small values and both large endpoints',()=>{
 const defaults=pollScaleRange();assert.ok(defaults.valid);assert.deepEqual(defaults.preview,[1,2,3,4,5]);
 for(const config of[{min:0,max:6},{min:1,max:100},{min:-Number.MAX_SAFE_INTEGER,max:Number.MAX_SAFE_INTEGER}]){const range=pollScaleRange(config);assert.ok(range.valid);assert.equal(range.preview.length,7);assert.equal(range.preview[0],config.min);assert.equal(range.preview[6],config.max);assert.equal(new Set(range.preview).size,7);assert.ok(range.preview.every(Number.isSafeInteger))}
 const one=pollScaleRange({min:0,max:0});assert.ok(one.valid);assert.deepEqual(one.preview,[0]);
});
test('invalid legacy bounds never produce a range or allocate its length',()=>{
 for(const config of[{min:NaN,max:5},{min:1,max:Infinity},{min:1,max:Number.MAX_SAFE_INTEGER+1},{min:2,max:1},{min:1.5,max:5},{min:null,max:5},{min:'1',max:5},'broken',[]])assert.equal(pollScaleRange(config).valid,false);
});
test('null and empty answers are excluded from scale averages and distributions; zero is valid',()=>{
 const range=pollScaleRange({min:0,max:5});
 const five=pollScaleSummary([null,5],range);assert.equal(five.average,'5.0');assert.equal(five.count,1);assert.equal(five.blank,1);assert.deepEqual(five.distribution,[{value:5,count:1}]);
 const zero=pollScaleSummary([null,0],range);assert.equal(zero.average,'0.0');assert.equal(zero.count,1);assert.equal(zero.blank,1);assert.deepEqual(zero.distribution,[{value:0,count:1}]);
 const mixed=pollScaleSummary([null,undefined,'','  ',false,[],{},Infinity,NaN,1.5,6,0,'5'],range);assert.equal(mixed.count,2);assert.equal(mixed.blank,4);assert.equal(mixed.invalid,7);assert.equal(mixed.average,'2.5');
 assert.equal(blankScaleAnswer(0),false);assert.equal(pollScaleNumber(0,range),0);
});
test('averages remain exact to one decimal even when integer sums exceed safe-number precision',()=>{
 const range=pollScaleRange({min:-Number.MAX_SAFE_INTEGER,max:Number.MAX_SAFE_INTEGER});
 assert.equal(pollScaleSummary([-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,1],range).average,'0.3');
 assert.equal(pollScaleSummary([-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,-1],range).average,'-0.3');
 assert.equal(pollScaleSummary([Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER-1],range).average,'9007199254740990.5');
 assert.equal(pollScaleSummary([null,''],range).average,'-');
 assert.equal(pollScaleNumber('9007199254740991.1',range),null);
 assert.equal(pollScaleNumber('0',range),0);
});
