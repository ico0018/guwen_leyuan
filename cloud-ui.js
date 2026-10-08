(function() {
  'use strict';
  const tool=document.documentElement.dataset.cloudTool;
  const config=window.XBB_CONFIG||{};
  const accepts=key=>tool==='hanzi'?/^hanzi-(practice|daily-dictation)-/.test(key):/^guwen-(leyuan-(learning-v2|read-v1)$|dictation-handwriting-v1:)/.test(key);
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
  const panel=document.createElement('aside'); panel.className='xbb-cloud'; panel.setAttribute('aria-label','账号与云同步'); document.body.prepend(panel);
  async function action(fn) { try { await fn(); } catch(error) { cloud.notify(error.message); } render(); }
  function button(text,fn) { const el=document.createElement('button'); el.type='button'; el.textContent=text; el.addEventListener('click',()=>action(fn)); panel.append(el); }
  function render() {
    panel.replaceChildren();
    const status=document.createElement('span'); status.setAttribute('role','status'); status.textContent=cloud.status; panel.append(status);
    const link=document.createElement('a'); link.href=`${config.portalBase??'https://xuebabangbang.cn'}/${cloud.identity?'account':'login'}`; link.textContent=cloud.identity?'账号中心':'登录 / 注册'; panel.append(link);
    if(cloud.identity) {
      const select=document.createElement('select'); select.setAttribute('aria-label','当前孩子');
      for(const profile of cloud.profiles) { const option=document.createElement('option'); option.value=profile.id; option.textContent=profile.nickname; option.selected=profile.id===cloud.identity.activeProfileId; select.append(option); }
      select.addEventListener('change',()=>action(()=>cloud.switchProfile(select.value))); panel.append(select);
      button('导入本机游客记录',()=>{ if(window.confirm('将当前浏览器的游客记录导入选中孩子？游客原始记录会保留；双方有数据时需另行选择。')) return cloud.migrateGuest(); });
      button('重试同步',()=>cloud.retry());
    }
    button('导出备份',()=>{
      const url=URL.createObjectURL(new Blob([cloud.exportData()],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download=`${tool}-备份.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    if(cloud.conflict) {
      button('保留本机记录',()=>{ if(window.confirm('用本机版本更新云端？当前两份记录会另存恢复副本，建议先导出备份。')) return cloud.resolve('local'); });
      button('恢复云端记录',()=>{ if(window.confirm('恢复云端版本？本机版本会另存恢复副本，建议先导出备份。')) return cloud.resolve('remote'); });
    }
  }
  cloud.subscribe(render);
  window.XbbCloudReady=cloud.start().catch(error=>{ cloud.notify(error.message); throw error; });
  window.addEventListener('online',()=>action(()=>cloud.retry()));
  window.addEventListener('focus',()=>action(()=>cloud.retry()));
  window.addEventListener('storage',event=>{ if(event.key===cloud.key) window.location.reload(); });
  render();
})();
