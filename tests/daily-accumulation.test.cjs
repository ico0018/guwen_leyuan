const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const context = vm.createContext({gradeOf:id=>({name:id})});
vm.runInContext(app.slice(app.indexOf('  function normalizeCatalogText'),app.indexOf('  function route()')),context);
const read = name => JSON.parse(fs.readFileSync(path.join(root,'content',name),'utf8'));
const manifest=read('manifest.json'), curriculum=read('curriculum.json'), catalog=read('daily-accumulation.json');
const original=context.mergeCurriculumLessons(manifest.lessons,curriculum);
const merged=context.mergeDailyLessons(original,manifest.lessons,catalog);
test('all twelve books resolve complete daily lessons and preserve existing study identities',()=>{
 assert.equal(catalog.books.length,12);
 assert.deepEqual(catalog.books.map(b=>b.items.length),[7,5,7,5,7,5,6,6,5,6,5,4]);
 assert.equal(merged.daily.length,68);
 assert.equal(new Set(merged.daily.map(l=>l.dailyPlacementId)).size,68);
 assert.equal(new Set(merged.lessons.map(l=>l.id)).size,merged.lessons.length);
 for(const old of original) assert.equal(merged.lessons.find(l=>l.id===old.id),old);
 for(const lesson of merged.daily){
  assert.ok(lesson.original && lesson.lines.length);
  assert.equal(lesson.lines.length,lesson.lineTranslations.length);
  assert.ok(lesson.lines.every(l=>l.translation));
  assert.ok(lesson.knowledgePoints.length>=2);
  assert.ok(lesson.dailyPage>0 && lesson.dailyUnit>0);
  assert.ok(lesson.exercises.some(e=>e.type==='order' && e.mode==='characters'));
 }
 const upper5=merged.daily.find(l=>l.dailyBookId==='5-upper' && l.dailyTitle==='游子吟');
 const lower5=merged.daily.find(l=>l.dailyBookId==='5-lower' && l.dailyTitle==='游子吟');
 assert.equal(upper5.id,lower5.id);
 assert.equal(upper5.id,original.find(l=>l.gradeId==='grade5' && l.title==='游子吟').id);
});
test('2026 revised placements follow the checked pages, including cross-grade moves',()=>{
 const titles=id=>merged.daily.filter(l=>l.dailyBookId===id).map(l=>l.dailyTitle);
 assert.deepEqual(Array.from(titles('5-upper')),['惜时诗句（古典部分）','乞巧','游子吟','渔歌子','观书有感·其一']);
 assert.deepEqual(Array.from(titles('6-upper')),['江畔独步寻花','仁义与家国','观书有感·其二','送元二使安西','过故人庄']);
 const find=(book,title)=>merged.daily.find(l=>l.dailyBookId===book && l.dailyTitle===title);
 assert.equal(find('5-upper','游子吟').dailyUnit,6);
 assert.equal(find('6-upper','过故人庄').dailyUnit,6);
 assert.equal(find('2-lower','悯农（其一）').dailyPage,98);
 assert.equal(find('4-upper','黄鹤楼送孟浩然之广陵').dailyPage,86);
 assert.ok(find('4-upper','赠刘景文').original.startsWith('荷尽已无擎雨盖'));
 assert.ok(find('6-upper','江畔独步寻花').original.startsWith('黄师塔前'));
 assert.ok(find('1-upper','画').author.includes('未署名'));
 assert.ok(find('5-lower','凉州词').author.includes('王之涣'));
 for(const b of catalog.books.filter(b=>b.gradeId>='grade4'&&b.semester==='下册')) assert.ok(b.edition.includes('原版下册'));
});
test('new classical groups have one translation and puzzle row per original row',()=>{
 const additions=manifest.lessons.filter(l=>l.workId.startsWith('daily-2026-'));
 assert.equal(additions.length,24);
 for(const lesson of additions){
  const rows=lesson.original.trim().split(/\r?\n/);
  assert.deepEqual(lesson.lines.map(l=>l.text),rows);
  assert.equal(lesson.lineTranslations.length,rows.length);
  const order=lesson.exercises.find(e=>e.type==='order'&&e.mode==='characters');
  assert.deepEqual(order.items.map(i=>i.text),rows);
 }
 const perseverance=additions.find(l=>l.workId==='daily-2026-3-upper-8');
 assert.ok(perseverance.original.includes('锲而不舍，金石可镂'));
 const clothing=additions.find(l=>l.workId==='daily-2026-2-lower-5');
 assert.ok(clothing.original.includes('唯德学，唯才艺，不如人，当自砺。'));
});
test('an unresolved or duplicated placement fails visibly instead of silently dropping content',()=>{
 const book=catalog.books[0];
 assert.throws(()=>context.mergeDailyLessons(original,manifest.lessons,{books:[{...book,items:[{id:'bad',workId:'missing',title:'missing'}]}]}),/正文缺失/);
 assert.throws(()=>context.mergeDailyLessons(original,manifest.lessons,{books:[book,book]}),/位置重复/);
});
