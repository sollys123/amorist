(() => {
  'use strict';
  document.body.classList.add('editor-mode');

  const PREVIEW_KEY = 'amorist-public-preview-v1';
  const PUBLIC_GROUPS = {
    profile: ['amorist-profile-v1'],
    library: ['amorist-game-library-v1','amorist-dashboard-playing-v1'],
    characters: ['amorist-character-book-v1'],
    repos: ['amorist-game-repos-v1'],
    creations: ['amorist-form-answers-v1','amorist-visual-sheets-v1','amorist-workshop-current-v2','amorist-workshop-sheets-v1','amorist-workshop-templates-v1','amorist-oshi-hub-v1'],
    appearance: ['otomeRepoMaker.themeFavorites.v1','otomeRepoMaker.colorStyle.v1','otomeRepoMaker.activePage.v1'],
    activity: ['amorist-timeline-events-v1'],
    index: ['amorist-bangumi-deleted-v1']
  };
  const PUBLIC_DATA_KEYS = [...new Set(Object.values(PUBLIC_GROUPS).flat())];
  const ALWAYS_PUBLISHED_KEYS = ['amorist-timeline-events-v1','amorist-bangumi-deleted-v1'];
  const DATA_URL = './data/amorist-data.json';
  const BANGUMI_DATA_URL = './data/bangumi-games.json';
  const DEFAULT_RAW = {
    'amorist-profile-v1':'{}',
    'amorist-game-library-v1':'[]',
    'amorist-dashboard-playing-v1':'',
    'amorist-character-book-v1':'[]',
    'amorist-game-repos-v1':'{}',
    'amorist-form-answers-v1':'{}',
    'amorist-visual-sheets-v1':'{}',
    'amorist-oshi-hub-v1':'{"version":1,"records":[]}',
    'amorist-workshop-current-v2':'{}',
    'amorist-workshop-sheets-v1':'[]',
    'amorist-workshop-templates-v1':'[]',
    'otomeRepoMaker.themeFavorites.v1':'[]',
    'otomeRepoMaker.colorStyle.v1':'solid',
    'otomeRepoMaker.activePage.v1':'full',
    'amorist-timeline-events-v1':'{"version":1,"events":[]}',
    'amorist-bangumi-deleted-v1':'[]'
  };
  const KNOWN_DATABASES = ['otomeRepoMakerArchives','amorist-image-store-v1','amorist-bangumi-db'];
  // These values describe the editor's transient route/session state, not site content.
  // Everything else under the Amorist/REPO namespaces is retained so new fields cannot
  // silently disappear from a publication made by an older editor build.
  const NON_CONTENT_KEYS = new Set([
    PREVIEW_KEY,
    'amorist-product-view-v1',
    'amorist-product-session-v1',
    'amorist-bangumi-static-version',
    'amorist-bangumi-sort-order',
    'amorist-timeline-migration-version',
    'amorist-timeline-backfill-drafts-v1',
    'amorist-character-birthday-backfill-session-v1',
    'otomeRepoMaker.currentArchiveId'
  ]);
  const REMOVED_FEATURE_KEYS = new Set(['amorist-anime-library-v1','amorist-media-library-v2']);
  const dataModel = window.AmoristDataModel;
  const SKIP = Symbol('skip');
  let projectDirectoryHandle = null;

  const managedKey = key => ['amorist-','amorist.','amoristUi.','otomeRepoMaker.'].some(prefix => String(key).startsWith(prefix));
  const publishableKey = key => {
    const value=String(key);
    return managedKey(value)
      && !NON_CONTENT_KEYS.has(value)
      && !REMOVED_FEATURE_KEYS.has(value)
      && !value.startsWith('amoristUi.')
      && !value.startsWith('amorist-public-tool:');
  };
  const safeParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
  const decodeStorageValue = raw => { try { return {isJson:true,value:JSON.parse(raw)}; } catch { return {isJson:false,value:raw}; } };
  const bytesLabel = bytes => {
    const value=Number(bytes)||0;
    if(value<1024)return `${value} B`;
    if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
    return `${(value/1024/1024).toFixed(2)} MB`;
  };
  const download = (name, value) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if(name==='amorist-data.json')localStorage.setItem(PREVIEW_KEY,text);
    const blob = new Blob([text], { type:'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1800);
  };
  const toast = message => {
    if (typeof window.productToast === 'function') window.productToast(message);
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2800);
  };

  async function seedEditorFromPublishedData() {
    const defaults = new Set(['{}', '[]', '"solid"', '"full"', '"home"', '{"version":1,"events":[]}']);
    const hasMeaningfulLocalData = PUBLIC_DATA_KEYS.some(key => {
      const raw = localStorage.getItem(key);
      return raw !== null && !defaults.has(raw);
    });
    if (hasMeaningfulLocalData) return false;
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache:'no-store' });
      if (!response.ok) return false;
      const payload = await response.json();
      if (payload?.type !== 'amorist-public-data' || !payload.localStorage) return false;
      let changed = false;
      Object.entries(payload.localStorage).forEach(([key,value]) => {
        if (!publishableKey(key)) return;
        const raw = typeof value === 'string' ? value : JSON.stringify(value);
        if (localStorage.getItem(key) !== raw) { localStorage.setItem(key, raw); changed = true; }
      });
      if (!changed) return false;
      localStorage.setItem('amorist-product-view-v1', 'home');
      location.reload();
      return true;
    } catch (error) {
      console.warn('Amorist editor data seed skipped:', error);
      return false;
    }
  }

  function filterPublicValue(value, stats) {
    if (Array.isArray(value)) {
      const result=[];
      value.forEach(item => {
        const filtered=filterPublicValue(item,stats);
        if(filtered!==SKIP)result.push(filtered);
      });
      return result;
    }
    if (value && typeof value === 'object') {
      if (value.visibility === 'private') { stats.privateEntries += 1; return SKIP; }
      stats.publicEntries += 1;
      const next = {};
      Object.entries(value).forEach(([key, item]) => {
        const filtered=filterPublicValue(item,stats);
        if(filtered!==SKIP)next[key]=filtered;
      });
      return next;
    }
    return value;
  }

  function checkedGroups() {
    return [...document.querySelectorAll('[data-public-group]:checked')].map(input => input.dataset.publicGroup);
  }

  function storageKeysForPublication() {
    const keys = new Set();
    checkedGroups().forEach(group => (PUBLIC_GROUPS[group] || []).forEach(key => keys.add(key)));
    ALWAYS_PUBLISHED_KEYS.forEach(key=>keys.add(key));
    // Preserve durable keys introduced by later features even when this list has not
    // been updated yet. Known unchecked groups remain excluded as an explicit choice.
    for(let index=0;index<localStorage.length;index+=1){
      const key=localStorage.key(index);
      if(!publishableKey(key))continue;
      if(PUBLIC_DATA_KEYS.includes(key) && !keys.has(key))continue;
      keys.add(key);
    }
    return [...keys];
  }

  function normalizePublicStorage(values, extraGameRows=[]) {
    const storage={...values};
    const hasGames=Object.prototype.hasOwnProperty.call(storage,'amorist-game-library-v1');
    const gamesRaw=safeParse(hasGames?storage['amorist-game-library-v1']:'[]',[]);
    const games=Array.isArray(gamesRaw)?gamesRaw.map(dataModel.normalizeGameRecord):[];
    const roleRows=[...games,...(Array.isArray(extraGameRows)?extraGameRows:[])];
    if(hasGames)storage['amorist-game-library-v1']=JSON.stringify(games);
    if(Object.prototype.hasOwnProperty.call(storage,'amorist-character-book-v1')){
      const charsRaw=safeParse(storage['amorist-character-book-v1']||'[]',[]);
      if(Array.isArray(charsRaw))storage['amorist-character-book-v1']=JSON.stringify(charsRaw.map(character=>dataModel.normalizeCharacterRecord(character,roleRows)));
    }
    return storage;
  }

  async function bangumiRoleRowsForExport() {
    const cached=window.amoristBangumiDiscovery?.getList?.();
    if(Array.isArray(cached)&&cached.length)return cached;
    try{
      const response=await fetch(`${BANGUMI_DATA_URL}?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)return [];
      const payload=await response.json();
      return Array.isArray(payload)?payload:(Array.isArray(payload?.games)?payload.games:[]);
    }catch{return [];}
  }

  async function inlineImageRefs(value) {
    if (Array.isArray(value)) return Promise.all(value.map(inlineImageRefs));
    if (value && typeof value === 'object') {
      const next = {};
      for (const [key, item] of Object.entries(value)) next[key] = await inlineImageRefs(item);
      return next;
    }
    if (window.amoristImageStore?.isRef(value)) return window.amoristImageStore.inline(value);
    return value;
  }

  async function collectPublicStorage(stats) {
    const values={};
    for (const key of storageKeysForPublication()) {
        const raw = localStorage.getItem(key) ?? DEFAULT_RAW[key] ?? 'null';
        const decoded=decodeStorageValue(raw);
        if(!decoded.isJson){values[key]=raw;continue;}
        const fallback=Array.isArray(decoded.value)?[]:{};
        const filtered=filterPublicValue(decoded.value,stats);
        values[key]=JSON.stringify(filtered===SKIP?fallback:filtered);
    }
    values['amorist-dashboard-playing-v1']=localStorage.getItem('amorist-dashboard-playing-v1')||'';
    const timelineValue=safeParse(values['amorist-timeline-events-v1']||DEFAULT_RAW['amorist-timeline-events-v1'],{version:1,events:[]});
    values['amorist-timeline-events-v1']=JSON.stringify({version:1,events:Array.isArray(timelineValue)?timelineValue:(Array.isArray(timelineValue?.events)?timelineValue.events:[])});
    if(!/^(?:full|long(?:-\d+)?)$/.test(String(values['otomeRepoMaker.activePage.v1']||'')))values['otomeRepoMaker.activePage.v1']='full';
    values['amorist-product-view-v1']='home';
    return normalizePublicStorage(values,await bangumiRoleRowsForExport());
  }

  function validatePublicPayload(payload) {
    if(payload?.type!=='amorist-public-data'||!payload.localStorage||typeof payload.localStorage!=='object')throw new Error('发布数据结构无效');
    Object.entries(payload.localStorage).forEach(([key,raw])=>{
      if(typeof raw!=='string')throw new Error(`发布字段 ${key} 不是有效的存储字符串`);
    });
    const timeline=safeParse(payload.localStorage['amorist-timeline-events-v1']||'',null);
    if(!timeline||(Array.isArray(timeline)?false:!Array.isArray(timeline.events)))throw new Error('时间线数据格式无效，已停止生成');
    if(Object.prototype.hasOwnProperty.call(payload.localStorage,'amorist-game-repos-v1')){
      const repos=safeParse(payload.localStorage['amorist-game-repos-v1'],null);
      if(!repos||Array.isArray(repos)||typeof repos!=='object')throw new Error('游戏 REPO 数据格式无效，已停止生成');
    }
    return payload;
  }

  async function buildPublicPayload({transformImages=inlineImageRefs,stats={publicEntries:0,privateEntries:0}}={}) {
    const rawStorage=await collectPublicStorage(stats);
    const output={};
    for(const [key,raw] of Object.entries(rawStorage)){
      const decoded=decodeStorageValue(raw);
      if(!decoded.isJson){output[key]=raw;continue;}
      output[key]=JSON.stringify(await transformImages(decoded.value,key));
    }
    const profile=safeParse(output['amorist-profile-v1']||'{}',{});
    const titleInput=document.querySelector('#amoristPublicTitle');
    const descriptionInput=document.querySelector('#amoristPublicDescription');
    return validatePublicPayload({
      type:'amorist-public-data',
      schemaVersion:3,
      dataStructureVersion:3,
      exportedAt:new Date().toISOString(),
      site:{
        title:(titleInput?.value||`${profile.name||'Amorist'} · Otome Life Archive`).trim(),
        description:(descriptionInput?.value||profile.bio||'').trim(),
        owner:profile.name||''
      },
      localStorage:output
    });
  }

  async function restorePublicData(file) {
    const payload=JSON.parse(await file.text());
    if(payload?.type!=='amorist-public-data'||!payload.localStorage||typeof payload.localStorage!=='object')throw new Error('不是有效的 Amorist 站点数据文件');
    const incoming={};
    for(const [key,raw] of Object.entries(payload.localStorage)){
      if(!publishableKey(key))continue;
      const parsed=typeof raw==='string'?safeParse(raw,raw):raw;
      incoming[key]=key==='amorist-oshi-hub-v1'&&window.amoristImageStore?JSON.stringify(await window.amoristImageStore.externalize(parsed)):(typeof raw==='string'?raw:JSON.stringify(raw));
    }
    const normalized=normalizePublicStorage(incoming);
    Object.entries(normalized).forEach(([key,raw])=>localStorage.setItem(key,raw));
    localStorage.setItem('amorist-product-view-v1','home');
    toast('站点数据已导入，页面即将刷新');
    setTimeout(()=>location.reload(),800);
  }

  async function validateProjectDirectory(handle) {
    if(!handle||handle.kind!=='directory')throw new Error('请选择 Amorist 项目根目录');
    const requiredFiles=['editor.html','index.html'];
    for(const name of requiredFiles){
      try{await handle.getFileHandle(name);}catch{throw new Error(`所选目录缺少 ${name}，请直接选择外层 amorist 文件夹`);}
    }
    for(const name of ['assets','data']){
      try{await handle.getDirectoryHandle(name);}catch{throw new Error(`所选目录缺少 ${name}/ 文件夹`);}
    }
    return true;
  }

  async function requestHandlePermission(handle,mode='readwrite') {
    if(!handle)return false;
    const options={mode};
    if((await handle.queryPermission?.(options))==='granted')return true;
    return (await handle.requestPermission?.(options))==='granted';
  }

  async function connectProjectFolder() {
    if(!window.showDirectoryPicker)throw new Error('当前浏览器不支持文件夹写入；请使用 Chrome 或 Chromium，并通过 localhost 打开 editor');
    const handle=await window.showDirectoryPicker({mode:'readwrite',startIn:'documents'});
    if(!(await requestHandlePermission(handle)))throw new Error('未获得项目文件夹写入权限');
    await validateProjectDirectory(handle);
    projectDirectoryHandle=handle;
    const status=document.querySelector('#amoristProjectFolderStatus');
    if(status)status.textContent=`已连接：${handle.name}`;
    return handle;
  }

  async function ensureProjectHandle() {
    if(projectDirectoryHandle&&await requestHandlePermission(projectDirectoryHandle)){
      await validateProjectDirectory(projectDirectoryHandle);return projectDirectoryHandle;
    }
    return connectProjectFolder();
  }

  async function getNestedDirectory(root,names,{create=false}={}) {
    let current=root;
    for(const name of names)current=await current.getDirectoryHandle(name,{create});
    return current;
  }

  async function fileExists(directory,name) {
    try{await directory.getFileHandle(name);return true;}catch{return false;}
  }

  async function readTextIfExists(directory,name) {
    try{return await (await directory.getFileHandle(name)).getFile().then(file=>file.text());}catch{return null;}
  }

  async function writeBlob(directory,name,blob) {
    const handle=await directory.getFileHandle(name,{create:true});
    const writable=await handle.createWritable();
    try{await writable.write(blob);await writable.close();}
    catch(error){try{await writable.abort();}catch{}throw error;}
  }

  async function writeText(directory,name,text) {
    return writeBlob(directory,name,new Blob([text],{type:'application/json;charset=utf-8'}));
  }

  async function dataUrlToBlob(value) {
    const response=await fetch(value);
    if(!response.ok)throw new Error('Data URL 无法读取');
    return response.blob();
  }

  async function hashBlob(blob) {
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  }

  const containsAscii = (bytes, text) => {
    const needle=new TextEncoder().encode(text);
    outer:for(let index=0;index<=bytes.length-needle.length;index++){
      for(let offset=0;offset<needle.length;offset++)if(bytes[index+offset]!==needle[offset])continue outer;
      return true;
    }
    return false;
  };

  async function animatedImageExtension(blob) {
    const type=String(blob.type||'').toLowerCase();
    if(type==='image/gif')return 'gif';
    if(type==='image/png'){
      const bytes=new Uint8Array(await blob.arrayBuffer());
      if(containsAscii(bytes,'acTL'))return 'png';
    }
    if(type==='image/webp'){
      const bytes=new Uint8Array(await blob.arrayBuffer());
      if(containsAscii(bytes,'ANIM')||containsAscii(bytes,'ANMF'))return 'webp';
    }
    if(type==='image/svg+xml'){
      const text=await blob.text();
      if(/<(?:animate|animateMotion|animateTransform|set)\b|animation\s*:/i.test(text))return 'svg';
    }
    return '';
  }

  async function blobToWebP(blob) {
    let bitmap;
    try{bitmap=await createImageBitmap(blob);}catch{
      const url=URL.createObjectURL(blob);
      try{bitmap=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片无法解码'));image.src=url;});}
      finally{URL.revokeObjectURL(url);}
    }
    const width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight;
    if(!width||!height)throw new Error('图片尺寸无效');
    const scale=Math.min(1,2000/Math.max(width,height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d',{alpha:true});
    context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close?.();
    return new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('WebP 转换失败')),'image/webp',0.88));
  }

  async function resolveImageReference(value) {
    if(window.amoristImageStore?.isRef(value)){
      const resolved=await window.amoristImageStore.get(value);
      if(!resolved)throw new Error(`IndexedDB 图片缺失：${value}`);
      if(resolved instanceof Blob)return resolved;
      if(typeof resolved==='string'&&/^data:image\//i.test(resolved))return dataUrlToBlob(resolved);
      throw new Error(`IndexedDB 图片格式无法处理：${value}`);
    }
    if(typeof value==='string'&&/^data:image\//i.test(value))return dataUrlToBlob(value);
    return null;
  }

  async function listDirectoryFiles(directory) {
    const names=[];
    for await(const [name,handle] of directory.entries())if(handle.kind==='file')names.push(name);
    return names;
  }

  function makeMediaTransformer(mediaDirectory,stats,manifest) {
    const cache=new Map();
    const referencedFiles=new Set();
    const pathPattern=/^assets\/user-media\/([^?#]+)$/i;
    const transform=async(value,path='root')=>{
      if(Array.isArray(value)){
        const rows=[];for(let index=0;index<value.length;index++)rows.push(await transform(value[index],`${path}[${index}]`));return rows;
      }
      if(value&&typeof value==='object'){
        const next={};for(const [key,item] of Object.entries(value))next[key]=await transform(item,`${path}.${key}`);return next;
      }
      if(typeof value!=='string')return value;
      const relativeMatch=value.match(pathPattern);
      if(relativeMatch){referencedFiles.add(relativeMatch[1]);return value;}
      if(!window.amoristImageStore?.isRef(value)&&!/^data:image\//i.test(value))return value;
      let sourceBlob;
      try{sourceBlob=await resolveImageReference(value);}catch(error){stats.unreadableImages+=1;stats.errors.push(`${path}: ${error.message}`);throw error;}
      const sourceHash=await hashBlob(sourceBlob);
      if(cache.has(sourceHash)){stats.reusedImages+=1;return cache.get(sourceHash);}
      const sourceType=String(sourceBlob.type||'').toLowerCase();
      let outputBlob,extension;
      const animatedExtension=await animatedImageExtension(sourceBlob);
      if(animatedExtension){
        outputBlob=sourceBlob;extension=animatedExtension;stats.preservedAnimatedImages+=1;
      }else{
        outputBlob=await blobToWebP(sourceBlob);extension='webp';
      }
      const filename=`img-${sourceHash.slice(0,24)}.${extension}`;
      const relativePath=`assets/user-media/${filename}`;
      if(await fileExists(mediaDirectory,filename))stats.reusedImages+=1;
      else{await writeBlob(mediaDirectory,filename,outputBlob);stats.newImages+=1;}
      cache.set(sourceHash,relativePath);referencedFiles.add(filename);
      manifest.files[filename]={sourceHash,mime:outputBlob.type||sourceType,bytes:outputBlob.size};
      return relativePath;
    };
    transform.referencedFiles=referencedFiles;
    return transform;
  }

  async function commitPublication(root,payload,manifest,stats) {
    validatePublicPayload(payload);
    const dataDirectory=await getNestedDirectory(root,['data']);
    const jsonText=JSON.stringify(payload,null,2);
    JSON.parse(jsonText);
    stats.jsonBytes=new Blob([jsonText]).size;
    const manifestText=JSON.stringify(manifest,null,2);
    const oldJson=await readTextIfExists(dataDirectory,'amorist-data.json');
    const oldManifest=await readTextIfExists(dataDirectory,'amorist-media-manifest.json');
    await writeText(dataDirectory,'amorist-data.json.tmp',jsonText);
    await writeText(dataDirectory,'amorist-media-manifest.json.tmp',manifestText);
    validatePublicPayload(JSON.parse(await readTextIfExists(dataDirectory,'amorist-data.json.tmp')));
    JSON.parse(await readTextIfExists(dataDirectory,'amorist-media-manifest.json.tmp'));
    try{
      await writeText(dataDirectory,'amorist-media-manifest.json',manifestText);
      await writeText(dataDirectory,'amorist-data.json',jsonText);
    }catch(error){
      try{if(oldJson!==null)await writeText(dataDirectory,'amorist-data.json',oldJson);else await dataDirectory.removeEntry('amorist-data.json');}catch{}
      try{if(oldManifest!==null)await writeText(dataDirectory,'amorist-media-manifest.json',oldManifest);else await dataDirectory.removeEntry('amorist-media-manifest.json');}catch{}
      throw new Error(`发布文件写入失败，已尝试恢复旧文件：${error.message}`);
    }finally{
      try{await dataDirectory.removeEntry('amorist-data.json.tmp');}catch{}
      try{await dataDirectory.removeEntry('amorist-media-manifest.json.tmp');}catch{}
    }
  }

  function renderPublishReport(stats,error='') {
    const host=document.querySelector('#amoristPublishReport');if(!host)return;
    if(error){host.hidden=false;host.innerHTML=`<strong>生成失败</strong><span>${String(error).replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]))}</span>`;return;}
    host.hidden=false;
    host.innerHTML=`<strong>发布数据已生成</strong><dl><div><dt>公开对象</dt><dd>${stats.publicEntries}</dd></div><div><dt>排除 private</dt><dd>${stats.privateEntries}</dd></div><div><dt>新增图片</dt><dd>${stats.newImages}</dd></div><div><dt>复用图片</dt><dd>${stats.reusedImages}</dd></div><div><dt>可能未使用</dt><dd>${stats.unusedImages}</dd></div><div><dt>无法读取</dt><dd>${stats.unreadableImages}</dd></div><div><dt>JSON 大小</dt><dd>${bytesLabel(stats.jsonBytes)}</dd></div></dl>${stats.preservedAnimatedImages?`<p>保留 ${stats.preservedAnimatedImages} 个动态图片原文件，未静态化。</p>`:''}`;
  }

  async function generatePublication() {
    const root=await ensureProjectHandle();
    const mediaDirectory=await getNestedDirectory(root,['assets','user-media'],{create:true});
    const stats={publicEntries:0,privateEntries:0,newImages:0,reusedImages:0,unusedImages:0,unreadableImages:0,preservedAnimatedImages:0,jsonBytes:0,errors:[]};
    const manifest={type:'amorist-media-manifest',schemaVersion:1,generatedAt:new Date().toISOString(),files:{},possiblyUnused:[]};
    const transformer=makeMediaTransformer(mediaDirectory,stats,manifest);
    const payload=await buildPublicPayload({transformImages:(value,key)=>transformer(value,key),stats});
    // Keep the newest publication visible to index.html in this browser while
    // the generated static file is waiting to be deployed.
    localStorage.setItem(PREVIEW_KEY,JSON.stringify(payload));
    const existing=await listDirectoryFiles(mediaDirectory);
    manifest.possiblyUnused=existing.filter(name=>!transformer.referencedFiles.has(name)).sort();
    stats.unusedImages=manifest.possiblyUnused.length;
    if(stats.unreadableImages||stats.errors.length)throw new Error(stats.errors.join('\n')||'存在无法读取的图片');
    await commitPublication(root,payload,manifest,stats);
    renderPublishReport(stats);
    return stats;
  }

  async function openDb(name) {
    return new Promise((resolve,reject)=>{
      try{
        const request=indexedDB.open(name);
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error||new Error(`无法打开 ${name}`));
        request.onblocked=()=>reject(new Error(`${name} 被其他页面占用`));
      }catch(error){reject(error);}
    });
  }

  const requestResult=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const blobToDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});

  async function serializeValue(value,seen=new WeakSet()) {
    if(value instanceof Blob){return {__amoristType:value instanceof File?'File':'Blob',mime:value.type||'',name:value instanceof File?value.name:'',lastModified:value instanceof File?value.lastModified:0,dataUrl:await blobToDataUrl(value)};}
    if(value instanceof ArrayBuffer)return {__amoristType:'ArrayBuffer',bytes:Array.from(new Uint8Array(value))};
    if(ArrayBuffer.isView(value))return {__amoristType:'TypedArray',name:value.constructor.name,bytes:Array.from(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
    if(Array.isArray(value)){const result=[];for(const item of value)result.push(await serializeValue(item,seen));return result;}
    if(value&&typeof value==='object'){
      if(seen.has(value))throw new Error('IndexedDB 数据包含循环引用，无法序列化');seen.add(value);
      const result={};for(const [key,item] of Object.entries(value))result[key]=await serializeValue(item,seen);seen.delete(value);return result;
    }
    return value;
  }

  function dataUrlToBytes(dataUrl) {
    const [,base64='']=String(dataUrl).split(',',2);const binary=atob(base64);const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return bytes;
  }

  async function deserializeValue(value) {
    if(Array.isArray(value)){const result=[];for(const item of value)result.push(await deserializeValue(item));return result;}
    if(value&&typeof value==='object'){
      if(value.__amoristType==='Blob'||value.__amoristType==='File'){
        const bytes=dataUrlToBytes(value.dataUrl);return value.__amoristType==='File'?new File([bytes],value.name||'file',{type:value.mime||'',lastModified:Number(value.lastModified)||Date.now()}):new Blob([bytes],{type:value.mime||''});
      }
      if(value.__amoristType==='ArrayBuffer')return new Uint8Array(value.bytes||[]).buffer;
      if(value.__amoristType==='TypedArray')return new Uint8Array(value.bytes||[]);
      const result={};for(const [key,item] of Object.entries(value))result[key]=await deserializeValue(item);return result;
    }
    return value;
  }

  async function databaseNames() {
    const names=new Set();
    if(typeof indexedDB.databases==='function'){
      try{(await indexedDB.databases()).forEach(info=>{if(info?.name&&(String(info.name).startsWith('amorist-')||String(info.name).startsWith('otomeRepoMaker')))names.add(info.name);});}catch{}
    }
    if(!names.size)KNOWN_DATABASES.forEach(name=>names.add(name));
    return [...names];
  }

  async function exportDatabase(name) {
    let db;
    try{db=await openDb(name);}catch{return null;}
    try{
      const stores={};
      for(const storeName of [...db.objectStoreNames]){
        const tx=db.transaction(storeName,'readonly'),store=tx.objectStore(storeName);
        const valuesRequest=store.getAll(),keysRequest=store.getAllKeys();
        const [values,keys]=await Promise.all([requestResult(valuesRequest),requestResult(keysRequest)]);
        const records=[];for(let index=0;index<values.length;index++)records.push({key:await serializeValue(keys[index]),value:await serializeValue(values[index])});
        stores[storeName]={keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes:[...store.indexNames].map(indexName=>{const index=store.index(indexName);return {name:index.name,keyPath:index.keyPath,unique:index.unique,multiEntry:index.multiEntry};}),records};
      }
      return {name,version:db.version,stores};
    }finally{db.close();}
  }

  async function buildPrivateBackup() {
    const storage={};
    for(let index=0;index<localStorage.length;index+=1){const key=localStorage.key(index);if(key!==PREVIEW_KEY)storage[key]=localStorage.getItem(key);}
    const databases=[];
    for(const name of await databaseNames()){const exported=await exportDatabase(name);if(exported)databases.push(exported);}
    return {type:'amorist-private-backup',formatVersion:2,schemaVersion:2,dataStructureVersion:2,completeLocalStorage:true,exportedAt:new Date().toISOString(),localStorage:storage,indexedDB:{databases}};
  }

  function legacyBackupDatabases(payload) {
    if(Array.isArray(payload?.indexedDB?.databases))return payload.indexedDB.databases;
    const legacy=payload?.indexedDB;if(!legacy?.database||!legacy.stores)return [];
    const stores={};
    Object.entries(legacy.stores).forEach(([name,rows])=>{stores[name]={keyPath:'id',autoIncrement:false,indexes:[],records:(Array.isArray(rows)?rows:[]).map(row=>({key:row?.id,value:row}))};});
    return [{name:legacy.database,version:2,stores}];
  }

  async function ensureStores(databaseBackup) {
    let db=await openDb(databaseBackup.name),missing=Object.keys(databaseBackup.stores||{}).filter(name=>!db.objectStoreNames.contains(name));
    if(!missing.length)return db;
    const nextVersion=Math.max(db.version+1,Number(databaseBackup.version)||1);db.close();
    db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open(databaseBackup.name,nextVersion);
      request.onupgradeneeded=()=>{
        const upgradeDb=request.result;
        missing.forEach(name=>{
          const meta=databaseBackup.stores[name]||{},options={};
          if(meta.keyPath!==null&&meta.keyPath!==undefined)options.keyPath=meta.keyPath;
          if(meta.autoIncrement)options.autoIncrement=true;
          const store=upgradeDb.createObjectStore(name,options);
          (meta.indexes||[]).forEach(index=>{try{store.createIndex(index.name,index.keyPath,{unique:Boolean(index.unique),multiEntry:Boolean(index.multiEntry)});}catch{}});
        });
      };
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error(`${databaseBackup.name} 升级被占用，请关闭其他 Amorist 页面后重试`));
    });
    return db;
  }

  async function restoreDatabase(databaseBackup) {
    const db=await ensureStores(databaseBackup);
    try{
      for(const [storeName,meta] of Object.entries(databaseBackup.stores||{})){
        if(!db.objectStoreNames.contains(storeName))continue;
        const records=[];
        for(const record of (Array.isArray(meta.records)?meta.records:[]))records.push({value:await deserializeValue(record.value),key:await deserializeValue(record.key)});
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);store.clear();
          try{records.forEach(record=>{if(store.keyPath==null&&record.key!==undefined)store.put(record.value,record.key);else store.put(record.value);});}
          catch(error){tx.abort();reject(error);return;}
          tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error(`${storeName} 恢复中止`));
        });
      }
    }finally{db.close();}
  }

  async function restorePrivateBackup(file) {
    const payload=JSON.parse(await file.text());
    if(payload?.type!=='amorist-private-backup'||!payload.localStorage)throw new Error('不是有效的 Amorist 私人备份');
    const safety=await buildPrivateBackup();download(`amorist-pre-restore_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,safety);
    const completeStorage=payload.completeLocalStorage===true||Number(payload.formatVersion)>=2;
    if(completeStorage)localStorage.clear();
    Object.entries(payload.localStorage).forEach(([key,raw])=>{if(completeStorage||managedKey(key))localStorage.setItem(key,typeof raw==='string'?raw:JSON.stringify(raw));});
    for(const database of legacyBackupDatabases(payload))await restoreDatabase(database);
    toast('私人备份已恢复，页面即将刷新');setTimeout(()=>location.reload(),1000);
  }

  function modalMarkup() {
    return `
      <div class="amorist-site-data-backdrop" id="amoristSiteDataBackdrop" hidden>
        <section class="amorist-site-data-panel" role="dialog" aria-modal="true" aria-labelledby="amoristSiteDataTitle">
          <header class="amorist-site-data-head"><div><span class="card-eyebrow">PUBLISH & BACKUP</span><h2 id="amoristSiteDataTitle">站点数据</h2><p>公开发布写入项目文件；私人备份保存浏览器中的完整文字与图片实体。</p></div><button class="product-dialog-close" type="button" id="amoristSiteDataClose" aria-label="关闭">×</button></header>
          <div class="amorist-site-data-content">
            <section class="site-data-section"><h3>公开站信息</h3><label>站点标题<input class="product-input" id="amoristPublicTitle" maxlength="80" placeholder="HARU · Otome Life Archive"></label><label>站点简介<textarea class="product-textarea" id="amoristPublicDescription" maxlength="180" placeholder="我的乙女游戏收藏、游玩记录与创作档案。"></textarea></label></section>
        <section class="site-data-section"><h3>选择公开内容</h3><div class="site-data-check-grid"><label><input type="checkbox" data-public-group="profile" checked> 玩家自介</label><label><input type="checkbox" data-public-group="library" checked> 游戏档案</label><label><input type="checkbox" data-public-group="characters" checked> 角色图鉴</label><label><input type="checkbox" data-public-group="repos" checked> 游戏 REPO</label><label><input type="checkbox" data-public-group="creations" checked> 图表与创作</label><label><input type="checkbox" data-public-group="appearance" checked> 主题偏好</label></div><p class="site-data-hint">任意层级中带有 <code>visibility: "private"</code> 的对象及其图片都会被递归排除。</p></section>
            <section class="site-data-section publish-project-section"><h3>本地一键生成</h3><p class="site-data-hint">第一次连接时请选择外层 <code>amorist/</code> 根目录。图片会写入 <code>assets/user-media/</code>，公开数据会安全覆盖 <code>data/amorist-data.json</code>。</p><div class="site-data-actions"><button class="product-button secondary" type="button" id="amoristConnectFolder">连接项目文件夹</button><button class="product-button rose" type="button" id="amoristGeneratePublish">一键生成发布数据</button></div><span class="site-data-folder-status" id="amoristProjectFolderStatus">尚未连接项目文件夹</span><div class="site-data-report" id="amoristPublishReport" hidden></div></section>
            <section class="site-data-section"><h3>兼容导入与预览</h3><div class="site-data-actions"><button class="product-button secondary" type="button" id="amoristExportPublic">下载单文件 JSON</button><button class="product-button secondary" type="button" id="amoristImportPublic">导入站点数据</button><input type="file" id="amoristPublicFile" accept="application/json,.json" hidden><button class="product-button secondary" type="button" id="amoristPreviewPublic">预览公开站</button></div><p class="site-data-hint">单文件 JSON 仍会内嵌图片，仅用于兼容旧流程；日常发布请使用上方一键生成。</p></section>
            <section class="site-data-section private-backup-section"><h3>私人完整备份</h3><p>包含全部 Amorist / REPO Maker localStorage、浏览器内相关 IndexedDB、Blob / File 图片实体及引用关系。恢复前会自动下载当前状态的安全备份。</p><div class="site-data-actions"><button class="product-button secondary" type="button" id="amoristExportPrivate">导出私人完整备份</button><button class="product-button secondary" type="button" id="amoristImportPrivate">导入并恢复私人备份</button><input type="file" id="amoristPrivateFile" accept="application/json,.json" hidden></div></section>
            <aside class="site-data-publish-note"><strong>不会自动删除旧图片</strong><span>未被本次数据引用的文件只会列入“可能未使用”清单，第一版不会移动或永久删除。</span></aside>
          </div>
        </section>
      </div>`;
  }

  async function installUi() {
    await seedEditorFromPublishedData();
    document.body.insertAdjacentHTML('beforeend',modalMarkup());
    const backdrop=document.querySelector('#amoristSiteDataBackdrop');
    const open=()=>{const profile=safeParse(localStorage.getItem('amorist-profile-v1')||'{}',{});document.querySelector('#amoristPublicTitle').value||=`${profile.name||'Amorist'} · Otome Life Archive`;document.querySelector('#amoristPublicDescription').value||=profile.bio||'';backdrop.hidden=false;document.body.classList.add('site-data-modal-open');};
    const close=()=>{backdrop.hidden=true;document.body.classList.remove('site-data-modal-open');};
    document.querySelector('#amoristSiteDataButton')?.addEventListener('click',open);
    document.querySelector('#amoristSiteDataClose')?.addEventListener('click',close);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop)close();});

    document.querySelector('#amoristConnectFolder').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await connectProjectFolder();toast('项目文件夹已连接');}catch(error){if(error?.name!=='AbortError')alert(`连接失败：${error.message}`);}finally{button.disabled=false;}});
    document.querySelector('#amoristGeneratePublish').addEventListener('click',async event=>{const button=event.currentTarget,old=button.textContent;button.disabled=true;button.textContent='正在生成…';try{const stats=await generatePublication();toast(`发布数据已生成：${stats.newImages} 张新图片`);}catch(error){renderPublishReport(null,error.message||String(error));alert(`生成失败：${error.message||error}`);}finally{button.disabled=false;button.textContent=old;}});

    document.querySelector('#amoristExportPublic').addEventListener('click',async()=>{const stats={publicEntries:0,privateEntries:0};const payload=await buildPublicPayload({stats});download('amorist-data.json',payload);toast('兼容单文件 JSON 已导出');});
    const publicFileInput=document.querySelector('#amoristPublicFile');
    document.querySelector('#amoristImportPublic').addEventListener('click',()=>publicFileInput.click());
    publicFileInput.addEventListener('change',async()=>{const file=publicFileInput.files?.[0];publicFileInput.value='';if(!file)return;if(!confirm('导入站点数据会覆盖同名个性化资料，但不会修改 Bangumi 资料库。是否继续？'))return;try{await restorePublicData(file);}catch(error){alert(`导入失败：${error.message||'站点数据文件无法读取'}`);}});
    document.querySelector('#amoristPreviewPublic').addEventListener('click',async()=>{const stats={publicEntries:0,privateEntries:0};const payload=await buildPublicPayload({stats});localStorage.setItem(PREVIEW_KEY,JSON.stringify(payload));window.open('./index.html?preview=1','_blank','noopener');});

    document.querySelector('#amoristExportPrivate').addEventListener('click',async event=>{const button=event.currentTarget,old=button.textContent;button.disabled=true;button.textContent='正在整理…';try{const payload=await buildPrivateBackup();download(`amorist-private-backup_${new Date().toISOString().slice(0,10)}.json`,payload);toast(`私人完整备份已导出（${payload.indexedDB.databases.length} 个数据库）`);}catch(error){alert(`备份失败：${error.message}`);}finally{button.disabled=false;button.textContent=old;}});
    const privateFileInput=document.querySelector('#amoristPrivateFile');
    document.querySelector('#amoristImportPrivate').addEventListener('click',()=>privateFileInput.click());
    privateFileInput.addEventListener('change',async()=>{const file=privateFileInput.files?.[0];privateFileInput.value='';if(!file)return;if(!confirm('恢复会覆盖同名本地数据。系统会先下载当前状态安全备份，是否继续？'))return;try{await restorePrivateBackup(file);}catch(error){alert(`恢复失败：${error.message}`);}});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUi,{once:true});else installUi();
})();
