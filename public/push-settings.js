"use strict";
// Device enrollment is explicit, optional and disabled until the server pilot
// is configured. Existing local task/AI data is never part of these requests.
(function(){
  const $=id=>document.getElementById(id);
  let config=null,registration=null,locked=false;
  const api="/api/alerts";
  function status(text){$("alertStatus").textContent=text;}
  function syncButtons(){
    $("enableAlerts").disabled=locked||!config?.configured||!registration||!window.Notification||!window.PushManager;
    $("disableAlerts").disabled=locked||(!config?.registered&&!registration);
  }
  async function request(body){
    const response=await fetch(api,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",redirect:"error",...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
    const value=await response.json();
    if(!response.ok)throw Error(value?.error==="dispatch-in-progress"?"dispatch-in-progress":value?.error==="invite-required"?"invite-required":value?.error==="endpoint-already-enrolled"?"endpoint-already-enrolled":"unavailable");
    return value;
  }
  function publicKey(value){
    if(typeof value!=="string"||!/^[A-Za-z0-9_-]{87}$/.test(value))throw Error("unavailable");
    const b=atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=");
    return Uint8Array.from(b,c=>c.charCodeAt(0));
  }
  function sameKey(subscription,key){
    const old=subscription.options?.applicationServerKey;
    return old&&new Uint8Array(old).length===key.length&&new Uint8Array(old).every((b,i)=>b===key[i]);
  }
  async function prepare(){
    if(locked)return;
    config=null;registration=null;syncButtons();
    status("正在检查主动提醒服务…");
    try{
      config=await request();
      if("serviceWorker" in navigator)registration=await navigator.serviceWorker.getRegistration();
      if(!config?.configured){status("主动提醒尚未启用；当前关注和任务不受影响。");return;}
      if(!window.Notification||!window.PushManager||!registration){status("当前设备尚不支持订阅。iPhone 请先将网页添加到主屏幕，再从主屏幕打开。");return;}
      if(Notification.permission==="denied"){status("系统通知权限已拒绝，可在系统设置中修改。");return;}
      const sub=await registration.pushManager.getSubscription();
      status(config.registered&&sub?"本设备已订阅；保存新的关注后，可再次更新提醒范围。":"可选择启用试点。尚未确认本设备已订阅。");
    }catch{
      config=null;status("无法核验提醒服务；不会自动申请通知权限。");
      try{if("serviceWorker" in navigator)registration=await navigator.serviceWorker.getRegistration();}catch{}
    }finally{syncButtons();}
  }
  async function enable(){
    if(locked||!config?.configured||!registration||!window.Notification||!window.PushManager)return;
    const invite=$("alertInvite").value.trim();
    if(!invite){status("请输入管理员提供的试点邀请码。");return;}
    const saved=window.CampusPushSettings?.getPreference?.();
    if(!saved||!(saved.schools.length+saved.departments.length+saved.topics.length)){status("先保存至少一项关注，再启用提醒。");return;}
    let key;try{key=publicKey(config.publicKey);}catch{status("服务端试点配置不可用。");return;}
    locked=true;syncButtons();$("alertInvite").value="";
    let created=null;
    try{
      // Directly inside the user's button handler, before any network request.
      const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
      if(permission!=="granted"){status("未获得通知权限；没有上传订阅信息。");return;}
      let subscription=await registration.pushManager.getSubscription();
      if(subscription&&!sameKey(subscription,key)){status("本设备已有其他推送密钥对应的订阅，请先停用再重新启用。");return;}
      if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});created=subscription;}
      const result=await request({action:"subscribe",invite,subscription:subscription.toJSON(),preference:{optIn:true,schools:saved.schools,departments:saved.departments,topics:saved.topics}});
      if(result?.registered!==true)throw Error("unavailable");
      config=result;
      status("服务端已确认试点订阅（有效期30天）。实际送达仍取决于后台检查和设备通知设置。");
    }catch(error){
      // Only clean up a subscription created by this attempt, never replace
      // an existing device's subscription silently.
      if(created)try{await created.unsubscribe();}catch{}
      status(error?.message==="invite-required"?"邀请码未通过验证。":error?.message==="dispatch-in-progress"?"发送正在进行，请稍后重试。":error?.message==="endpoint-already-enrolled"?"此设备已有试点记录，需先撤销旧记录。":"订阅未确认成功，请勿把系统授权视为订阅成功。");
    }finally{locked=false;syncButtons();}
  }
  async function disable(){
    if(locked)return;locked=true;syncButtons();
    let serverRemoved=false,localRemoved=false;
    try{if(config?.registered){const r=await request({action:"revoke"});serverRemoved=r.registered===false;if(serverRemoved)config={...config,registered:false};}}
    catch(error){if(error?.message==="dispatch-in-progress"){status("发送正在进行，请稍后撤销；尚未确认停用。");locked=false;syncButtons();return;}}
    try{const sub=await registration?.pushManager.getSubscription();localRemoved=!sub||await sub.unsubscribe();}catch{}
    status(serverRemoved&&localRemoved?"已确认撤销服务端订阅并停用本机接收。已进入系统队列的通知可能稍后到达。":localRemoved?"本机已停用或没有订阅；服务端删除未确认，请在服务恢复后再核对。":"停用尚未确认，请重试或在系统设置关闭通知。");
    locked=false;syncButtons();
  }
  window.CampusPushSettings={prepare,getPreference:()=>({schools:[...state.follows.schools],departments:[...state.follows.departments],topics:[...state.follows.topics]})};
  $("alertDetails").addEventListener("toggle",()=>{if($("alertDetails").open)prepare();});
  $("enableAlerts").addEventListener("click",enable);
  $("disableAlerts").addEventListener("click",disable);
})();
