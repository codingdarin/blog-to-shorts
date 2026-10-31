import test from 'node:test';
import assert from 'node:assert/strict';
import {translateEnglish} from '../translation.mjs';
const input={headline:'2026 꽃축제',scenes:Array(4).fill('축제가 열렸어요.')};
test('English translation preserves four ordered scenes and uses English system instruction',async()=>{const out=await translateEnglish(input,async(prompt,schema,system)=>{assert.match(prompt,/Preserve all facts/);assert.match(system,/English/);return {headline:'2026 Flower Festival',scenes:['The festival took place.','Flowers filled the garden.','A cat sculpture stood there.','Growers held a flower market.']};});assert.equal(out.scenes.length,4);});
test('translation rejects malformed or untranslated output',async()=>{await assert.rejects(translateEnglish(input,async()=>input),/영어/);await assert.rejects(translateEnglish({headline:'x',scenes:[]}),/대본/);});
