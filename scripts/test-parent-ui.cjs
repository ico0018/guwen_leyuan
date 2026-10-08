const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../cloud-ui.js'),'utf8');
function storage() { const map=new Map(); return {get length(){return map.size},key:i=>[...map.keys()][i],getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}; }
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.attributes={};this._text='';}
  append(...children){this.children.push(...children)}
  prepend(child){this.children.unshift(child)}
  replaceChildren(...children){this.children=children;this._text=''}
  setAttribute(key,value){this.attributes[key]=value}
  addEventListener(event,fn){this.listeners[event]=fn}
  set textContent(value){this._text=String(value)}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join(' ')}
}
const collect=(element,tag)=>[...(element.tag===tag?[element]:[]),...element.children.flatMap(child=>collect(child,tag))];
async function boot({parent=false,signed=false,ready=false,session=storage(),tool='hanzi'}={}) {
  const body=new Element('body');const local=storage();const calls=[];
  class Adapter {
    constructor(options){this.options=options;this.identity=null;this.sessionUser=null;this.parentReady=false;this.verified=true;this.status='云同步已完成';this.listeners=[];this.profiles=[];this.conflict={payload:{remote:true}};}
    subscribe(fn){this.listeners.push(fn)}
    notify(status){if(status)this.status=status;this.listeners.forEach(fn=>fn())}
    async start(){this.sessionUser=signed?{id:'parent'}:null;this.identity=signed?{user:this.sessionUser,activeProfileId:'child'}:null;this.parentReady=ready;this.profiles=signed?[{id:'child',nickname:'Nora'}]:[];this.notify()}
    async request(url,method,body){calls.push({url,method,body});if(url.endsWith('parent-challenge'))return {challenge:'signed',question:'贰×捌=?',choices:[14,16,18]};if(url.endsWith('parent-unlock')){if(body.answer!==16)throw Object.assign(new Error('请求失败 (400)'),{status:400});return {parentReady:true}};return {}}
    async flush(){}
    async retry(){this.notify()}
    exportData(){return '{}'}
  }
  const randomMath=Object.create(Math);randomMath.random=()=>0;
  const window={XbbCloudSyncAdapter:Adapter,XBB_CONFIG:{apiBase:'http://localhost:8320',portalBase:'http://localhost:8320'},location:{reload(){}},addEventListener(){},confirm(){return false}};
  const context=vm.createContext({window,document:{body,documentElement:{dataset:{cloudTool:tool,cloudParent:String(parent)}},createElement:tag=>new Element(tag)},localStorage:local,sessionStorage:session,crypto:{randomUUID:()=>Math.random().toString()},Math:randomMath,URL,Blob,setTimeout,console});
  vm.runInContext(source,context);await window.XbbCloudReady;await new Promise(setImmediate);
  const panel=body.children[0];return {panel,window,calls,session,buttons:()=>collect(panel,'button'),text:()=>panel.textContent};
}
test('student view has only parent entry, no status, backup, import, retry or conflict controls',async()=>{
  for(const tool of ['hanzi','guwen']) {const app=await boot({signed:true,ready:true,tool});assert.equal(app.buttons().length,0);assert.equal(app.text(),'家长入口');assert.equal(collect(app.panel,'a')[0].href,'parent.html');assert.equal(collect(app.panel,'span').length,0);}
});
test('parent records remain hidden until one of three Chinese arithmetic answers is correct',async()=>{
  const app=await boot({parent:true,signed:true});assert.match(app.text(),/贰×捌=\?/);assert.deepEqual(app.buttons().map(button=>button.textContent),['14','16','18']);assert.doesNotMatch(app.text(),/导出备份|重试同步|导入本机/);
  await app.buttons().find(button=>button.textContent==='14').listeners.click();assert.match(app.text(),/答案不正确或题目已过期，请换一道题/);assert.doesNotMatch(app.text(),/导出备份/);
  await app.buttons().find(button=>button.textContent==='16').listeners.click();assert.match(app.text(),/导出备份|导入本机游客记录|恢复云端记录/);
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls.filter(call=>call.url.endsWith('parent-unlock')).at(-1).body)),{challenge:'signed',answer:16});
});
test('existing signed session grant bypasses the question and expires only on explicit parent exit',async()=>{
  const app=await boot({parent:true,signed:true,ready:true});assert.match(app.text(),/导出备份/);assert.equal(app.calls.filter(call=>call.url.endsWith('parent-challenge')).length,0);
  await app.buttons().find(button=>button.textContent==='退出家长模式').listeners.click();await new Promise(setImmediate);
  assert.equal(app.window.XbbCloud.parentReady,false);assert.ok(app.calls.some(call=>call.url.endsWith('parent-lock')));assert.doesNotMatch(app.text(),/导出备份/);
});
test('guest arithmetic grant survives refresh and clears on exit; it never creates a PIN',async()=>{
  const app=await boot({parent:true});assert.match(app.text(),/贰×贰=\?/);await app.buttons().find(button=>button.textContent==='4').listeners.click();assert.match(app.text(),/导出备份/);
  const refreshed=await boot({parent:true,session:app.session});assert.match(refreshed.text(),/导出备份/);assert.doesNotMatch(refreshed.text(),/PIN|密码/);
  await refreshed.buttons().find(button=>button.textContent==='退出家长模式').listeners.click();assert.doesNotMatch(refreshed.text(),/导出备份/);
});
