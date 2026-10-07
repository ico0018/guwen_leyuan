const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createSpeechController} = require('../speech.js');

function setup(mode = 'success', supported = true) {
  const recordings = [], spoken = [], status = [];
  let voices = [], voiceListener, cancelCount = 0;
  class Audio {
    constructor(path) { this.path = path; recordings.push(this); }
    pause() { this.paused = true; }
    play() {
      if (mode === 'failed') return Promise.reject(new Error('missing'));
      if (mode === 'delayed') return new Promise((resolve) => { this.resolve = resolve; });
      return Promise.resolve();
    }
  }
  const env = { Audio, setTimeout, clearTimeout,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: supported ? {
      getVoices: () => voices, addEventListener: (_, fn) => { voiceListener = fn; },
      cancel: () => { cancelCount += 1; }, resume() {}, speak: (u) => spoken.push(u)
    } : null
  };
  return { recordings, spoken, status, env, controller: createSpeechController(env, (s) => status.push(s)),
    setVoices(v) { voices = v; voiceListener(); }, get cancelCount() { return cancelCount; } };
}
test('empty audio goes straight to TTS without creating a recording', async () => {
  const s = setup();
  await s.controller.read('鹅，鹅，鹅，\n曲项向天歌。');
  assert.equal(s.recordings.length, 0);
  assert.equal(s.spoken[0].text, '鹅，鹅，鹅，\n曲项向天歌。');
  assert.equal(s.spoken[0].lang, 'zh-CN');
  assert.equal(s.spoken[0].rate, 0.8);
  s.spoken[0].onend();
  assert.equal(s.status.at(-1), 'idle');
});
test('explicit successful audio plays only the configured recording', async () => {
  const s = setup(); await s.controller.read('诗', 'audio/poems/test.mp3');
  assert.equal(s.recordings[0].path, 'audio/poems/test.mp3');
  assert.equal(s.spoken.length, 0);
  assert.equal(s.status.at(-1), 'recording');
  s.recordings[0].onended(); assert.equal(s.status.at(-1), 'idle');
});
test('rejected recording falls back exactly once and pauses failed audio', async () => {
  const s = setup('failed'); await s.controller.read('诗', 'missing.mp3');
  assert.equal(s.spoken.length, 1); assert.equal(s.recordings[0].paused, true);
});
test('error after playback starts falls back to the system voice', async () => {
  const s = setup(); await s.controller.read('诗', 'broken.mp3');
  s.recordings[0].onerror(); assert.equal(s.spoken.length, 1);
});
test('new lesson or character stops the previous recording and TTS', async () => {
  const s = setup(); await s.controller.read('旧诗', 'old.mp3');
  await s.controller.read('鹅');
  assert.equal(s.recordings[0].paused, true); assert.equal(s.cancelCount, 2);
  await s.controller.read('新诗'); assert.equal(s.cancelCount, 3);
});
test('stopping pending recording prevents stale fallback or late playback', async () => {
  const s = setup('delayed'); const pending = s.controller.read('旧诗', 'old.mp3');
  s.controller.stop(); await pending;
  s.recordings[0].resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(s.spoken.length, 0); assert.equal(s.recordings[0].paused, true);
  assert.equal(s.status.at(-1), 'idle');
});
test('late voices prefer zh-CN over other Chinese voices', async () => {
  const s = setup();
  s.setVoices([{lang:'zh-TW', name:'Natural'}, {lang:'zh-CN', name:'普通话'}]);
  await s.controller.read('鹅'); assert.equal(s.spoken[0].voice.lang, 'zh-CN');
});
test('unsupported device returns an actionable status, never loading forever', async () => {
  const s = setup('failed', false); await s.controller.read('诗');
  assert.equal(s.status.at(-1), 'unavailable'); assert.equal(s.recordings.length, 0);
});
test('obsolete TTS end callback cannot reset a newer playback', async () => {
  const s = setup(); await s.controller.read('旧'); const old = s.spoken[0];
  await s.controller.read('新'); old.onend(); assert.equal(s.status.at(-1), 'speaking');
  s.controller.stop();
});
test('stalled audio is bounded and falls back once', async () => {
  const s = setup('delayed'); s.env.setTimeout = (fn) => setTimeout(fn, 5);
  await s.controller.read('诗', 'stalled.mp3'); assert.equal(s.spoken.length, 1);
  s.recordings[0].resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(s.recordings[0].paused, true); assert.equal(s.spoken.length, 1);
});
