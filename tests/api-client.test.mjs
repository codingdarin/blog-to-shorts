import test from 'node:test';
import assert from 'node:assert/strict';
import {configureApi,apiFetch,mediaUrl} from '../src/api-client.js';

test('API requests and media carry the tab password only to the configured origin',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return new Response('media',{headers:{'Content-Type':'audio/mpeg'}});});
 configureApi('https://example.trycloudflare.com/','test-password');
 await apiFetch('/api/script',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:'{}'});
 assert.equal(calls[0].url,'https://example.trycloudflare.com/api/script');
 assert.equal(calls[0].options.headers.get('authorization'),'Bearer test-password');
 assert.equal(calls[0].options.headers.get('accept'),'application/x-ndjson');
 assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.redirect,'error');
 const url=await mediaUrl('/api/music/salsa-new-york');
 assert.ok(url.startsWith('blob:'));URL.revokeObjectURL(url);
 assert.equal(calls[1].options.headers.get('authorization'),'Bearer test-password');
 assert.ok(!calls[1].url.includes('password'));
 assert.throws(()=>apiFetch('https://evil.example/api/'),/API/);
 assert.throws(()=>apiFetch('//evil.example/api/'),/API/);
 configureApi();await apiFetch('/api/status');
 assert.equal(calls[2].url,'/api/status');
 assert.equal(calls[2].options.headers.has('authorization'),false);
});

test('invalid remote origins and unsuccessful media are rejected',async t=>{
 for(const base of ['http://evil.example','https://user:pass@example.com','https://example.com/path','https://example.com/?token=test'])assert.throws(()=>configureApi(base),/서버 주소/);
 configureApi();
 t.mock.method(globalThis,'fetch',async()=>new Response('unauthorized',{status:401}));
 await assert.rejects(mediaUrl('/api/video/id'),/미디어/);
});
