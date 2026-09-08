const {test} = require('node:test');
const assert = require('node:assert/strict');
const {compare, linesFor, charactersForLine} = require('../dictation.js');
test('punctuation is optional, incorrect characters and missing or extra text are not', () => {
  assert.equal(compare('远上 寒山石径斜,\n', '远上寒山石径斜，').correct, true);
  assert.equal(compare('远上寒山石经斜', '远上寒山石径斜，').correct, false);
  assert.deepEqual(compare('鹅鹅', '鹅鹅鹅，').positions, [3]);
  assert.equal(compare('鹅鹅鹅鹅', '鹅鹅鹅，').extra, 1);
  assert.equal(compare('', '鹅鹅鹅').correct, false);
  assert.equal(compare('鹅鹅鹅abc', '鹅鹅鹅').correct, false);
});
test('full dictation retains every line without the sorting exercise limit', () => {
  const original = Array.from({length:12}, (_, i) => `第${i}句。`).join('\n');
  assert.equal(linesFor({original, lines:[{text:'只有第一句'}]}).length, 12);
  assert.deepEqual(linesFor({original:'鹅鹅鹅，曲项向天歌。白毛浮绿水，红掌拨清波。'}), ['鹅鹅鹅，曲项向天歌。', '白毛浮绿水，红掌拨清波。']);
  assert.deepEqual(linesFor({original:'\n  '}), []);
});
test('screen handwriting presents one Chinese character at a time', () => {
  assert.deepEqual(charactersForLine('鹅鹅鹅，曲项向天歌。'), ['鹅', '鹅', '鹅', '曲', '项', '向', '天', '歌']);
  assert.deepEqual(charactersForLine('  '), []);
});
