const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const context = vm.createContext({gradeOf: (id) => ({name:id})});
vm.runInContext(app.slice(app.indexOf('  function normalizeCatalogText'), app.indexOf('  function route()')), context);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/manifest.json'), 'utf8'));
const curriculum = JSON.parse(fs.readFileSync(path.join(root, 'content/curriculum.json'), 'utf8'));
const lessons = context.mergeCurriculumLessons(manifest.lessons, curriculum);
test('browser merge resolves all ordered placements and retains supplementary lessons', () => {
  const placements = lessons.filter(l => l.curriculum);
  assert.equal(placements.length, 116);
  assert.equal(placements.filter(l => l.catalogOnly).length, 0);
  assert.equal(lessons.filter(l => l.supplementary).length, 6);
  const expected = curriculum.grades.flatMap(g => g.semesters.flatMap(s => s.items.map(i => i.placementId)));
  assert.deepEqual(Array.from(placements, l => l.id), expected);
  for (const l of placements) {
    assert.ok(l.original && l.lines.length);
    assert.equal(l.lines.length, l.lineTranslations.length);
    assert.equal(l.placementId, l.id);
  }
});
test('same-title same-author poems use stable work identities', () => {
  const lower2 = lessons.find(l => l.id === 'grade2-lower-04');
  const lower3 = lessons.find(l => l.id === 'grade3-lower-01');
  assert.equal(lower2.title, '绝句'); assert.equal(lower3.title, '绝句');
  assert.notEqual(lower2.workId, lower3.workId);
  assert.ok(lower2.original.startsWith('两个黄鹂'));
  assert.ok(lower3.original.startsWith('迟日江山丽'));
});
test('repeated works retain independent URLs and share the original line data', () => {
  for (const title of ['鹿柴', '江上渔者']) {
    const pair = lessons.filter(l => l.title === title);
    assert.equal(pair.length, 2); assert.notEqual(pair[0].id, pair[1].id);
    assert.equal(pair[0].workId, pair[1].workId);
    assert.equal(pair[0].lines, pair[1].lines);
    assert.equal(pair[0].sourceLessonId, pair[1].sourceLessonId);
  }
});
test('legacy catalogs still normalize title brackets and use distinguishing text', () => {
  const catalog = {grades:[{gradeId:'grade1', semesters:[{id:'upper', name:'上册', items:[{title:'咏鹅',author:'[唐] 骆宾王'}]}]}]};
  const merged = context.mergeCurriculumLessons([{id:'old', gradeId:'grade1', title:'《咏鹅》', author:'[唐]骆宾王', original:'鹅，鹅，鹅，'}], catalog);
  assert.equal(merged[0].catalogOnly, false); assert.equal(merged[0].sourceLessonId, 'old');
});
function puzzleContext(placedText) {
  const exercise = {id:'order',mode:'characters',items:[
    {id:'row1',tokens:Array.from('鹅鹅鹅',(text,index)=>({text,id:'expected'+index}))},
    {id:'row2',tokens:[{text:'曲',id:'next'}]}
  ]};
  let completed = false;
  const state = {orderItemIndexes:{},orderFeedback:{},orderPlaced:{}};
  const scope = vm.createContext({state,
    getLessonExercises: () => [exercise],
    getPlaced: () => Array.from(placedText,(text,index)=>({text,id:'shuffled'+index})),
    setOrderComplete: () => {completed=true;}, isOrderComplete: () => false,
    refreshExercises() {}, celebrate() {}, showToast() {}
  });
  vm.runInContext(app.slice(app.indexOf('  function checkPuzzleResult('), app.indexOf('  function checkChoiceResult(')),scope);
  return {scope,state,isCompleted:()=>completed};
}
test('identical characters are interchangeable and advance to the next original row', () => {
  const p = puzzleContext('鹅鹅鹅'); p.scope.checkPuzzleResult({id:'lesson'},'order:row1');
  assert.equal(p.isCompleted(),true); assert.equal(p.state.orderItemIndexes.order,1);
});
test('incorrect character order stays on the current row', () => {
  const p = puzzleContext('鹅曲鹅'); p.scope.checkPuzzleResult({id:'lesson'},'order:row1');
  assert.equal(p.isCompleted(),false); assert.equal(p.state.orderFeedback['order:row1'],'wrong');
});

test('grade three daily accumulation keeps three groups and all ten recitation rows', () => {
  const groups = lessons.filter(l => l.semester === '日积月累');
  assert.deepEqual(Array.from(groups, l => l.id), ['grade3-lesson26', 'grade3-lesson27', 'grade3-lesson28']);
  assert.deepEqual(Array.from(groups, l => l.lines.length), [4, 3, 3]);
  for (const group of groups) {
    assert.equal(group.gradeId, 'grade3');
    assert.equal(group.curriculum, undefined);
    assert.equal(group.supplementary, true);
    assert.equal(group.lines.length, group.lineTranslations.length);
    assert.deepEqual(group.exercises[0].items.map(i => i.text), group.lines.map(l => l.text));
    assert.ok(group.lines.every(l => !/[《》]/.test(l.text)));
  }
  assert.equal(groups[0].lines[3].text, '与人善言，暖于布帛；伤人以言，深于矛戟。');
  assert.equal(groups[2].lines[2].text, '锲而舍之，朽木不折；锲而不舍，金石可镂。');
});
