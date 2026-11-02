import test from 'node:test';
import assert from 'node:assert/strict';
import {musicWav} from '../music.mjs';
test('music and transition effects honor mute and cut positions',()=>{
 const mute=musicWav(1,{music:'none',volume:0});assert.equal(mute.length,44+24000*2);assert.ok(mute.subarray(44).every(b=>b===0));
 const fx=musicWav(1,{music:'none',volume:0,sfx:true,cuts:[.5]});assert.ok(fx.subarray(44,44+24000).every(b=>b===0));assert.ok(fx.subarray(44+24000,44+32000).some(b=>b!==0));
});
