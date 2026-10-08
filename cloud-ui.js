(function() {
  'use strict';
  const tool=document.documentElement.dataset.cloudTool;
  const parentPage=document.documentElement.dataset.cloudParent==='true';
  const config=window.XBB_CONFIG||{};
  const accepts=key=>tool==='hanzi'?/^hanzi-(practice|daily-dictation)-/.test(key):/^guwen-(leyuan-(learning-v2|read-v1)$|dictation-handwriting-v1:)/.test(key);
  const guestGateKey=`xbb:guest-parent-ready:${tool}:v1`;
  let challenge=null, challengeLoading=false, gateError='';
  const chineseDigits=['','壹','贰','叁','肆','伍','陆','柒','捌','玖'];
  function guest() {
    const items={};
    for(let i=0;i<localStorage.length;i++) { const key=localStorage.key(i); if(accepts(key)) items[key]=localStorage.getItem(key); }
    return items;
  }
  function validate(payload) {
    if(!payload||typeof payload!=='object'||Array.isArray(payload)) throw new Error('学习记录格式不正确，原始数据已保留');
    for(const [key,value] of Object.entries(payload)) { if(!accepts(key)||typeof value!=='string') throw new Error('学习记录字段不正确'); JSON.parse(value); }
  }
  const cloud=new window.XbbCloudSyncAdapter({
    tool,storage:localStorage,apiBase:config.apiBase??'https://api.xuebabangbang.cn',guest,validate,
    saveGuest(payload) { validate(payload); for(const [key,value] of Object.entries(payload)) localStorage.setItem(key,value); },
    empty:payload=>Object.keys(payload).length===0,
    reload:()=>window.location.reload(),changed:()=>window.location.reload()
  });
  window.XbbCloud=cloud;
  window.XbbStorage={
    getItem(key) { if(!cloud.identity) return localStorage.getItem(key); return Object.hasOwn(cloud.payload||{},key)?cloud.payload[key]:null; },
    setItem(key,value) { if(!accepts(key)) throw new Error('此字段不是学习记录'); if(!cloud.identity) return localStorage.setItem(key,value); cloud.setPayload({...cloud.payload,[key]:value}); }
  };
  const panel=document.createElement('aside');
  panel.className=parentPage?'xbb-cloud':'xbb-parent-entry';
  panel.setAttribute('aria-label',parentPage?'家长记录管理':'家长入口'); document.body.prepend(panel);
  function parentReady() { return cloud.sessionUser?cloud.parentReady:sessionStorage.getItem(guestGateKey)==='true'; }
  async function action(fn) { try { await fn(); } catch(error) { cloud.notify(error.message); } render(); }
  function button(text,fn) { const el=document.createElement('button'); el.type='button'; el.textContent=text; el.addEventListener('click',()=>action(fn)); panel.append(el); }
  function link(text,href) { const el=document.createElement('a');el.href=href;el.textContent=text;panel.append(el); }
  async function prepareChallenge() {
    if(challengeLoading||challenge) return;
    challengeLoading=true;
    try {
      if(cloud.sessionUser) challenge=await cloud.request('/api/v1/parent-challenge');
      else {
        const a=2+Math.floor(Math.random()*8),b=2+Math.floor(Math.random()*8),answer=a*b;
        const choices=[answer,answer+a,answer-a];
        for(let i=choices.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
        challenge={challenge:crypto.randomUUID(),question:`${chineseDigits[a]}×${chineseDigits[b]}=?`,choices,answer};
      }
    } catch(error) { gateError=error.message; }
    finally { challengeLoading=false;render(); }
  }
  async function answerChallenge(answer) {
    if(cloud.sessionUser) {
      const result=await cloud.request('/api/v1/parent-unlock','POST',{challenge:challenge.challenge,answer});
      if(!result.parentReady) throw new Error('答案不正确，请再试一次。');
      cloud.parentReady=true; cloud.verified=true; await cloud.flush();
    } else {
      if(answer!==challenge.answer) throw new Error('答案不正确，请再试一次。');
      sessionStorage.setItem(guestGateKey,'true');
    }
    challenge=null;gateError='';render();
  }
  function render() {
    panel.replaceChildren();
    if(!parentPage) { link('家长入口','parent.html');return; }
    link('返回孩子学习',tool==='hanzi'?'welcome.html':'index.html');
    if(!initialized) { const p=document.createElement('p');p.textContent='正在打开家长页面…';panel.append(p);return; }
    if(!parentReady()) {
      const title=document.createElement('h2');title.textContent='请家长选择计算题的答案';panel.append(title);
      if(challenge) {
        const question=document.createElement('p');question.className='xbb-parent-question';question.setAttribute('aria-label','家长计算题');question.textContent=challenge.question;panel.append(question);
        for(const answer of challenge.choices) button(String(answer),async()=>{try {await answerChallenge(answer);}catch(error){gateError=error.message;render();}});
      } else if(!gateError) { prepareChallenge(); }
      if(gateError) {
        const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=gateError;panel.append(p);
        button('换一道题',async()=>{challenge=null;gateError='';await prepareChallenge();});
      }
      return;
    }
    const status=document.createElement('span');status.setAttribute('role','status');status.textContent=cloud.status;panel.append(status);
    link(cloud.sessionUser?'账号中心':'登录 / 注册',`${config.portalBase??'https://xuebabangbang.cn'}/${cloud.sessionUser?'account':'login'}`);
    if(cloud.identity) {
      const select=document.createElement('select');select.setAttribute('aria-label','当前孩子');
      for(const profile of cloud.profiles) {const option=document.createElement('option');option.value=profile.id;option.textContent=profile.nickname;option.selected=profile.id===cloud.identity.activeProfileId;select.append(option);}
      select.addEventListener('change',()=>action(()=>cloud.switchProfile(select.value)));panel.append(select);
      button('导入本机游客记录',()=>{if(window.confirm('将当前浏览器的游客记录导入选中孩子？游客原始记录会保留；双方有数据时需另行选择。'))return cloud.migrateGuest();});
      button('重试同步',()=>cloud.retry());
    }
    button('导出备份',()=>{
      const url=URL.createObjectURL(new Blob([cloud.exportData()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${tool}-备份.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    if(cloud.conflict) {
      button('保留本机记录',()=>{if(window.confirm('用本机版本更新云端？当前两份记录会另存恢复副本，建议先导出备份。'))return cloud.resolve('local');});
      button('恢复云端记录',()=>{if(window.confirm('恢复云端版本？本机版本会另存恢复副本，建议先导出备份。'))return cloud.resolve('remote');});
    }
    button('退出家长模式',async()=>{
      if(cloud.sessionUser) {await cloud.request('/api/v1/parent-lock','POST',{});cloud.parentReady=false;}
      sessionStorage.removeItem(guestGateKey);challenge=null;render();
    });
  }
  let initialized=false;
  cloud.subscribe(render);
  window.XbbCloudReady=cloud.start().then(()=>{
    if(cloud.sessionUser)sessionStorage.removeItem(guestGateKey);
    initialized=true;render();
  }).catch(error=>{cloud.notify(error.message);throw error;});
  window.addEventListener('online',()=>action(()=>cloud.retry()));
  window.addEventListener('focus',()=>action(()=>cloud.retry()));
  window.addEventListener('storage',event=>{if(event.key===cloud.key)window.location.reload();});
  render();
})();
