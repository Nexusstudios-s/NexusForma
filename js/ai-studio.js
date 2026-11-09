import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {auth, authReady} from './firebase.js';

/* Las claves API nunca se escriben en Firestore ni se devuelven al navegador.
   /api/admin/ai-keys autentica y cifra los secretos exclusivamente en el servidor. */
const $ = id => document.getElementById(id);
const PROVIDERS = [
  {id:'openrouter',name:'OpenRouter', icon:'◈', example:'liquid/lfm-3-1.7b:free'},
  {id:'openai',name:'OpenAI · ChatGPT', icon:'◎', example:'gpt-4o-mini'},
  {id:'gemini',name:'Google Gemini', icon:'✦', example:'gemini-2.5-flash'},
  {id:'groq',name:'Groq', icon:'⚡', example:'llama-3.3-70b-versatile'},
];
let videoConfig = null;
let pendingVideoId = sessionStorage.getItem('nexus-ai-video-job') || '';
let pollTimeout = null;
let videoObjectUrl = null;
let requestBusy = false;
const defaultVideoConfig = {enabled:false, model:'gemini-omni-1.1-flash',dailyLimit:1,allowedPlans:['pro','premium','studio']};
function message(id, value, ok=false) {
  const node = $(id);
  node.textContent = value;
  node.classList.toggle('is-success',Boolean(ok));
}
async function api(path, payload) {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicia sesión para continuar.');
  const headers = {'Authorization':`Bearer ${await user.getIdToken()}`};
  const opts = {headers};
  if (payload !== undefined) {
    opts.method = 'POST';
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(payload);
  }
  let response;
  try { response = await fetch(path,opts); }
  catch { throw new Error('No se pudo conectar con el servidor. Revisa que server.py esté en ejecución.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `El servidor respondió con error ${response.status}.`);
  return data;
}
async function loadProviderKeys() {
  const container = $('aiProviderGrid');
  try {
    const {providers,canSave} = await api('/api/admin/ai-keys');
    container.replaceChildren();
    for (const provider of PROVIDERS) {
      const status = providers[provider.id] || {configured:false,source:'sin configurar'};
      const card = document.createElement('article');
      card.className='ai-provider-card';
      const h = document.createElement('div'); h.className = 'ai-provider-card-head';
      const icon = document.createElement('span'); icon.className='ai-provider-icon'; icon.textContent=provider.icon;
      const title = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent=provider.name;
      const small = document.createElement('small'); small.textContent=`Modelo de ejemplo: ${provider.example}`;
      title.append(strong,small);
      const state = document.createElement('span');
      state.className=`ai-provider-chip${status.configured?' is-on':''}`;
      state.textContent=status.configured?`✓ ${status.source}`:'Sin clave';
      h.append(icon,title,state);
      const field=document.createElement('div'); field.className='ai-provider-input-line';
      const input=document.createElement('input'); input.type='password'; input.placeholder='Nueva clave API (nunca se mostrará)';
      input.autocomplete='new-password';input.spellcheck=false;input.maxLength=512;input.setAttribute('aria-label',`Clave API de ${provider.name}`);
      const save=document.createElement('button'); save.className='btn'; save.type='button'; save.textContent='Guardar'; save.disabled=!canSave;
      save.addEventListener('click',async()=>{
        if (!input.value.trim()) return message('aiProviderNotice',`Introduce la clave de ${provider.name}.`);
        save.disabled=true;
        try {
          await api('/api/admin/ai-keys',{provider:provider.id,action:'save',key:input.value.trim()});
          input.value='';message('aiProviderNotice',`Clave ${provider.name} guardada de forma cifrada.`,true);
          await loadProviderKeys();
        } catch(error){message('aiProviderNotice',error.message);save.disabled=false;}
      });
      field.append(input,save);
      const footer=document.createElement('div');footer.className='ai-provider-card-foot';
      const note=document.createElement('small');note.textContent=canSave?'Se guarda cifrada solo en el servidor.':'Usa la variable de entorno o configura NEXUS_SECRETS_KEY para guardar aquí.';
      footer.append(note);
      if(status.source==='panel') {
        const remove=document.createElement('button');remove.type='button';remove.className='ai-provider-remove';remove.textContent='Eliminar clave';
        remove.addEventListener('click',async()=>{
          if (!window.confirm(`¿Eliminar la clave guardada de ${provider.name}?`)) return;
          try{await api('/api/admin/ai-keys',{provider:provider.id,action:'delete'});await loadProviderKeys();}
          catch(error){message('aiProviderNotice',error.message);}
        });
        footer.append(remove);
      }
      card.append(h,field,footer);
      container.append(card);
    }
  } catch(error) {
    container.replaceChildren();message('aiProviderNotice',error.message);
  }
}
async function loadVideoSettings() {
  try {
    videoConfig={...defaultVideoConfig,...(await api('/api/ai/video/config'))};
    const cfg=videoConfig;
    $('aiVideoAdminEnabled').checked=cfg.enabled===true;
    $('aiVideoAdminModel').value=cfg.model;
    $('aiVideoAdminLimit').value=String(cfg.dailyLimit);
    for(const node of document.querySelectorAll('[data-ai-video-plan]'))node.checked=(cfg.allowedPlans||[]).includes(node.value);
    $('aiVideoAvailability').textContent=cfg.enabled?'Disponible para planes habilitados':'No disponible · un administrador debe activarlo';
    $('aiVideoGenerate').disabled=!cfg.enabled;
  }catch(error){
    message('aiVideoAdminMessage','No se pudo consultar la configuración del servidor.');
    $('aiVideoAvailability').textContent='Configuración de video no disponible';
    $('aiVideoGenerate').disabled=true;
  }
}
$('aiVideoAdminSave').addEventListener('click',async()=>{
  const dailyLimit=Number($('aiVideoAdminLimit').value);
  const model=$('aiVideoAdminModel').value;
  const enabled=$('aiVideoAdminEnabled').checked;
  const plans=[...document.querySelectorAll('[data-ai-video-plan]:checked')].map(node=>node.value);
  if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>5)return message('aiVideoAdminMessage','El límite debe ser un entero de 1 a 5.');
  if(enabled&&!plans.length)return message('aiVideoAdminMessage','Selecciona al menos un plan autorizado.');
  const save=$('aiVideoAdminSave');save.disabled=true;
  try{
    await api('/api/admin/ai-video-config',{enabled,model,dailyLimit,allowedPlans:plans});
    message('aiVideoAdminMessage','Ajustes de video guardados.',true);await loadVideoSettings();
  }catch(error){message('aiVideoAdminMessage','No se pudo guardar. Comprueba tus permisos de administrador.');}
  finally{save.disabled=false;}
});

function renderVideoState(status) {
  $('aiVideoStatus').textContent=({starting:'Preparando…',pending:'Gemini está creando tu video…',ready:'Video terminado',failed:'No se pudo completar'})[status]||'Sin generación';
}
function videoPollingStopped() {if(pollTimeout)clearTimeout(pollTimeout);pollTimeout=null;}
async function loadGeneratedVideo(videoUrl) {
  if(videoObjectUrl)URL.revokeObjectURL(videoObjectUrl);
  const response=await fetch(videoUrl,{headers:{Authorization:`Bearer ${await auth.currentUser.getIdToken()}`}});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||'No se pudo descargar el MP4.');}
  const blob=await response.blob();
  videoObjectUrl=URL.createObjectURL(blob);
  const player=$('aiVideoGenerated');
  player.src=videoObjectUrl;player.hidden=false;$('aiVideoPlaceholder').hidden=true;
  $('aiVideoDownload').hidden=false;
}
async function checkVideo(jobId) {
  if(!auth.currentUser)return;
  try {
    const result=await api(`/api/ai/video/status/${encodeURIComponent(jobId)}`);
    renderVideoState(result.status);
    if(result.status==='pending'||result.status==='starting'){
      message('aiVideoMessage','Tu generación sigue en proceso. Puedes dejar esta sección abierta.');
      pollTimeout=setTimeout(()=>checkVideo(jobId),9000);
    }else{
      requestBusy=false;$('aiVideoGenerate').disabled=!videoConfig?.enabled;
      sessionStorage.removeItem('nexus-ai-video-job');
      if(result.status==='ready'){
        message('aiVideoMessage','¡Video generado! Ya puedes reproducirlo o descargarlo.',true);
        await loadGeneratedVideo(result.videoUrl);
      }else message('aiVideoMessage',result.error||'Google no pudo completar el video.');
    }
  }catch(error){
    message('aiVideoMessage',error.message+' Reintentaremos consultar el estado.');
    pollTimeout=setTimeout(()=>checkVideo(jobId),12000);
  }
}
$('aiVideoForm').addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(requestBusy)return;
  const prompt=$('aiVideoPrompt').value.trim();
  if(prompt.length<10)return message('aiVideoMessage','Describe tu escena con al menos 10 caracteres.');
  const button=$('aiVideoGenerate');requestBusy=true;button.disabled=true;
  videoPollingStopped(); $('aiVideoGenerated').hidden=true;$('aiVideoPlaceholder').hidden=false;$('aiVideoDownload').hidden=true;
  message('aiVideoMessage','Solicitando generación a Gemini…');
  try{
    const result=await api('/api/ai/video/start',{prompt,aspectRatio:$('aiVideoRatio').value,duration:Number($('aiVideoDuration').value)});
    pendingVideoId=result.id;sessionStorage.setItem('nexus-ai-video-job',result.id);renderVideoState('pending');
    await checkVideo(result.id);
  }catch(error){
    requestBusy=false;button.disabled=!videoConfig?.enabled;
    message('aiVideoMessage',error.message);
  }
});
$('aiVideoDownload').addEventListener('click',()=>{
  if(!videoObjectUrl)return;
  const a=document.createElement('a');a.href=videoObjectUrl;a.download='nexus-forma-video.mp4';
  document.body.append(a);a.click();a.remove();
});
window.addEventListener('beforeunload',()=>{videoPollingStopped();if(videoObjectUrl)URL.revokeObjectURL(videoObjectUrl);});
// Recarga las claves solo cuando el administrador accede a su panel de modelos.
document.querySelectorAll('[data-admin-tab="models"]').forEach(tab=>tab.addEventListener('click',()=>{
  if(!$('adminDialog')?.open)return;
  void loadProviderKeys();void loadVideoSettings();
}));
const admin = $('adminDialog');
if(admin){new MutationObserver(()=>{if(admin.open){void loadVideoSettings();}}).observe(admin,{attributes:true,attributeFilter:['open']});}
await authReady;
onAuthStateChanged(auth,user=>{
  if(!user){videoPollingStopped();return;}
  void loadVideoSettings().then(()=>{
    if(pendingVideoId){requestBusy=true;$('aiVideoGenerate').disabled=true;void checkVideo(pendingVideoId);}
  });
});
