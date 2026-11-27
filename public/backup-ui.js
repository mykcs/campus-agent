"use strict";
(function(){
  const C=window.CampusBackup,$=id=>document.getElementById(id);
  let observed=null,incoming=null,plan=null,loading=false,loadId=0;
  function feedback(msg){$("backupFeedback").textContent=msg;}
  const mode=()=>$("backupMode").value;
  function update(){
    $("applyBackup").disabled=true;plan=null;
    if(!observed||!incoming)return;
    try{
      plan=C.preview(observed,incoming,mode());
      $("backupPreview").textContent="备份 "+incoming.tasks.length+" 项；合并新增 "+plan.added+" 项，相同 "+plan.identical+" 项，ID 冲突 "+plan.conflicts+" 项。"+(plan.mode==="merge"?"冲突保留本机记录。":"替换模式将删除本机独有 "+plan.removed+" 项并采用备份关注。")+" 导入后共 "+plan.tasks.length+" 项任务。";
      $("applyBackup").disabled=!$("backupConfirmed").checked||loading;
    }catch{feedback("无法生成安全的导入预览（格式或容量不符合要求）。");}
  }
  $("exportBackup").addEventListener("click",()=>{
    try{
      const raw=C.read(localStorage),out=C.document(raw.tasks,raw.follows);
      const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)+"\n"],{type:"application/json"}));
      const a=document.createElement("a");a.href=url;a.download="campus-agent-backup-"+out.exportedAt.slice(0,10)+".json";
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
      $("backupNotice").textContent="已生成本地备份。文件含你的任务与备注，请私人保存。";
    }catch{$("backupNotice").textContent="备份失败：本地数据格式不兼容或存储不可用，未修改原数据。";}
  });
  $("openBackup").addEventListener("click",()=>{
    $("backupForm").reset();observed=null;incoming=null;plan=null;loading=false;loadId++;
    $("backupPreview").textContent="选择备份文件后先预览。";feedback("");update();$("backupDialog").showModal();
  });
  $("closeBackup").addEventListener("click",()=>$("backupDialog").close());
  $("backupFile").addEventListener("change",async()=>{
    const id=++loadId;incoming=null;observed=null;plan=null;$("backupConfirmed").checked=false;$("applyBackup").disabled=true;
    const file=$("backupFile").files?.[0];if(!file)return;
    loading=true;feedback("");$("backupPreview").textContent="正在校验本地文件…";
    try{
      if(file.size>C.MAX_BYTES)throw Error("file-too-large");
      const candidate=C.parse(await file.text());
      if(id!==loadId)return;
      incoming=candidate;observed=C.read(localStorage);
      feedback("");
    }catch{if(id!==loadId)return;incoming=null;observed=null;$("backupPreview").textContent="文件无效、不支持或超出容量。原任务与关注没有改变。";}
    finally{if(id===loadId){loading=false;update();}}
  });
  $("backupMode").addEventListener("change",()=>{$("backupConfirmed").checked=false;update();});
  $("backupConfirmed").addEventListener("change",update);
  $("backupForm").addEventListener("submit",ev=>{
    ev.preventDefault();if(!plan||!observed||!$("backupConfirmed").checked||loading)return;
    try{C.apply(localStorage,observed,plan,{confirmed:true});location.reload();}
    catch(e){feedback(e.message==="local-state-changed"?"本机数据在预览后变化，请重新选择文件。":e.message==="write-failed-rollback-uncertain"?"写入失败且恢复未确认，请检查本地存储。":"导入失败，原数据未被替换或已回滚。");}
  });
})();
