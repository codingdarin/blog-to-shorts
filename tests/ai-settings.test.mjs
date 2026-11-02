import test from 'node:test';
import assert from 'node:assert/strict';
import {safePreferences,readPreferences,savePreferences,defaultVoice} from '../src/ai-settings.js';

test('only provider and model preferences are persisted, never credentials',()=>{
 let saved='';const storage={setItem:(_key,value)=>saved=value,getItem:()=>saved};
 assert.ok(savePreferences(storage,{provider:'openai',models:{openai:'gpt-test'},apiKey:'secret-key',creditsConfirmed:true,history:[{apiKey:'other-key'}]}));
 assert.deepEqual(Object.keys(JSON.parse(saved)),['provider','models']);
 assert.ok(!saved.includes('secret-key')&&!saved.includes('other-key')&&!saved.includes('Confirmed'));
 assert.equal(readPreferences(storage).provider,'openai');
 assert.equal(readPreferences(storage).models.openai,'gpt-test');
});
test('missing or malformed browser storage cannot prevent startup',()=>{
 assert.equal(readPreferences(null).provider,'');
 assert.equal(readPreferences({getItem:()=>'{broken'}).provider,'');
 assert.equal(safePreferences({provider:'gemini',models:{openai:'https://evil.example?a=b'}}).provider,'');
 assert.equal(savePreferences({setItem:()=>{throw Error('blocked');}},{provider:'openai'}),false);
});
test('Roger is selected by name regardless of voice list order',()=>{
 assert.equal(defaultVoice([{id:'other',name:'Alice'},{id:'roger',name:'Roger - Laid-Back, Casual, Resonant'}]),'roger');
 assert.equal(defaultVoice([{id:'other',name:'Alice'}]),'');
});
