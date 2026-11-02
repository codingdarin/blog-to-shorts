import test from 'node:test';
import assert from 'node:assert/strict';
import {titleLines} from '../src/text-layout.js';

test('manual title breaks survive even when one line would fit',()=>{
 assert.deepEqual(titleLines('건설기사\n독학 공부법',s=>s.length,100),['건설기사','독학 공부법']);
 assert.deepEqual(titleLines('건설기사\r\n독학 공부법',s=>s.length,100),['건설기사','독학 공부법']);
});

test('long manual rows stay intact for font shrinking and extra rows lose no words',()=>{
 assert.deepEqual(titleLines('건설기계기술사\n필기 준비\n공부 방법',s=>s.length,4),['건설기계기술사','필기 준비 공부 방법']);
});

test('titles without manual breaks still wrap automatically at word boundaries',()=>{
 assert.deepEqual(titleLines('건설기사 독학 공부법',s=>s.length,7),['건설기사','독학 공부법']);
 assert.deepEqual(titleLines('건설기계기술사',s=>s.length,4),['건설기계기술사']);
});
