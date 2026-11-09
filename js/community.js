/* Nexus Forma · Notificaciones globales, soporte autenticado y confirmaciones. */
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {collection, getDocs} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {auth, authReady, db} from './firebase.js';

const $ = selector => document.querySelector(selector);
const state = {user:null, role:'cliente', localUnread:0, broadcastUnread:0, messages:[],
  broadcasts:[], supportUnread:0, threads:[], activeClient:'', loading:false, poll:null, interval:null};
const adminRole = () => state.role === 'admin';
const staffRole = () => adminRole() || state.role === 'soporte' || state.role === 'atencion';
const escapedTime = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-CO', {dateStyle:'short',timeStyle:'short'});
};

async function api(path, method='GET', payload) {
  if (!state.user) throw new Error('Inicia sesión para utilizar el centro de atención.');
  const token = await state.user.getIdToken();
  const response = await fetch(path, {
    method, cache:'no-store',
    headers:{Authorization:`Bearer ${token}`, ...(payload ? {'Content-Type':'application/json'} : {})},
    ...(payload ? {body:JSON.stringify(payload)} : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `No se pudo completar la solicitud (${response.status}).`);
  return data;
}
function note(message, error=false) {
  const el = $('#nxSupportStatus');
  if (el) {el.textContent=message;el.classList.toggle('error',error);}
}

// Reutilizable para el feedback del cliente y de la bandeja admin.
window.nexusConfirmFeedback = ({title='Esta propuesta', description='Esta acción no se puede deshacer.', subject='propuesta'}={}) => {
  const dialog=$('#nxFeedbackDeleteDialog');
  if (!dialog) return Promise.resolve(false);
  if (dialog.open) dialog.close();
  $('#nxConfirmTitle').textContent=subject==='mensaje'?'¿Eliminar este mensaje?':subject==='aviso'?'¿Retirar este aviso?':'¿Eliminar esta propuesta?';
  $('#nxConfirmDescription').textContent=description;
  $('#nxConfirmPreview').textContent=title;
  return new Promise(resolve => {
    let settled=false;
    const finish = value => {
      if (settled) return;
      settled=true;
      dialog.removeEventListener('close',closed);
      $('#nxConfirmCancel').removeEventListener('click',cancel);
      $('#nxConfirmYes').removeEventListener('click',confirm);
      if(dialog.open) dialog.close();
      resolve(value);
    };
    const closed=()=>finish(false);
    const cancel=()=>finish(false);
    const confirm=()=>finish(true);
    $('#nxConfirmCancel').addEventListener('click',cancel);
    $('#nxConfirmYes').addEventListener('click',confirm);
    dialog.addEventListener('close',closed);
    dialog.showModal();
    $('#nxConfirmCancel').focus();
  });
};

function syncBadges() {
  const unread=state.broadcastUnread+state.localUnread;
  const badge=$('#notificationCount');
  if (badge) {badge.hidden=unread===0;badge.textContent=unread>9?'9+':String(unread);}
  const label=$('#notificationLabel');
  if (label) label.textContent=`${unread} nueva${unread===1?'':'s'}`;
  const support=$('#nxSupportCount');
  if(support) {support.hidden=state.supportUnread===0;support.textContent=state.supportUnread>9?'9+':String(state.supportUnread);}
}
function createEl(tag,klass,text) {
  const el=document.createElement(tag);
  if (klass) el.className=klass;
  if (text!==undefined) el.textContent=text;
  return el;
}
function renderBroadcasts() {
  const root=$('#nxBroadcastList'); if (!root) return;
  root.replaceChildren();
  state.broadcastUnread=state.broadcasts.filter(b=>!b.read).length;
  if(state.broadcasts.length){
    root.append(createEl('div','nx-broadcast-kicker','✦ AVISOS DE NEXUS STUDIOS'));
    for(const item of state.broadcasts){
      const card=createEl('article',`nx-broadcast${item.read?'':' unread'}`);
      const mark=createEl('span','nx-broadcast-icon','✦');
      const body=createEl('div','nx-broadcast-copy');
      body.append(createEl('strong','',item.title),createEl('p','',item.message),createEl('small','',escapedTime(item.createdAt)));
      const action=createEl('button','nx-broadcast-read',item.read?'Leído':'Marcar leído');
      action.type='button';action.disabled=Boolean(item.read);
      action.addEventListener('click',async()=>{
        try {await api('/api/community/announcements/read','POST',{id:item.id});item.read=true;renderBroadcasts();}
        catch(e){action.textContent=e.message;}
      });
      card.append(mark,body,action);root.append(card);
    }
  }
  syncBadges();
}

async function bootstrap() {
  if(!state.user) return;
  const data=await api('/api/community/bootstrap');
  const previousRole=state.role;
  state.role=data.role||'cliente';
  if(previousRole!==state.role){state.activeClient='';state.messages=[];}
  state.broadcasts=Array.isArray(data.announcements)?data.announcements:[];
  state.supportUnread=Number(data.unreadSupport)||0;
  const label=$('#nxSupportRole');
  if(label) label.textContent=({admin:'Administrador',soporte:'Equipo de soporte',atencion:'Atención al cliente'})[state.role]||'Conversación privada';
  $('#nxSupportSidebar').hidden=!staffRole();
  renderBroadcasts();
  if($('#nxSupportDialog').open) await refreshConversation(false);
}

async function loadThreads(selectFirst=false) {
  if(!staffRole()) return;
  const data=await api('/api/community/threads');
  state.threads=Array.isArray(data.threads)?data.threads:[];
  const host=$('#nxSupportThreads');host.replaceChildren();
  if(!state.threads.length) host.append(createEl('div','nx-support-empty','Todavía no hay conversaciones de clientes.'));
  state.threads.forEach(thread=>{
    const button=createEl('button',`nx-support-thread${thread.clientId===state.activeClient?' active':''}`);
    button.type='button';
    button.append(createEl('strong','',thread.name||'Cliente'),
      createEl('small','',thread.preview||'Conversación nueva'));
    if(thread.unread) button.append(createEl('span','nx-support-thread-unread',String(thread.unread)));
    button.addEventListener('click',async()=>{
      state.activeClient=thread.clientId;
      await refreshConversation();
    });
    host.append(button);
  });
  if(selectFirst&&!state.activeClient&&state.threads.length){
    state.activeClient=state.threads[0].clientId;
  }
}
function renderConversation() {
  const host=$('#nxSupportMessages');
  const wasNearBottom=host.scrollHeight-host.scrollTop-host.clientHeight<110;
  const oldScrollTop=host.scrollTop;
  host.replaceChildren();
  if(staffRole()&&!state.activeClient){
    host.append(createEl('div','nx-support-empty','Selecciona una conversación de la bandeja para responder.'));
    $('#nxSupportForm').hidden=true;
    $('#nxSupportConversationHead').textContent='Bandeja de atención · conversaciones privadas';
    return;
  }
  $('#nxSupportForm').hidden=false;
  const selected=state.threads.find(t=>t.clientId===state.activeClient);
  $('#nxSupportConversationHead').textContent=staffRole()
    ? `${selected?.name||'Cliente'} · ${selected?.email||'Conversación privada'}`
    : 'Tu conversación con Nexus Support · Solo tú y el equipo autorizado';
  if(!state.messages.length){
    host.append(createEl('div','nx-support-empty',staffRole()
      ? 'Sin mensajes todavía.'
      : '¡Hola! Cuéntanos en qué podemos ayudarte. Te responderá alguien del equipo de soporte o atención.'));
    return;
  }
  for(const message of state.messages){
    const own=message.authorId===state.user.uid;
    const wrapper=createEl('article',`nx-support-bubble${own?' mine':' theirs'}${message.deleted?' deleted':''}`);
    const who=message.authorRole==='cliente'?'Cliente':message.authorRole==='soporte'?'Soporte':message.authorRole==='atencion'?'Atención al cliente':'Administración';
    wrapper.append(createEl('span','nx-support-message-who',own?'Tú':who));
    wrapper.append(createEl('p','nx-support-message-text',message.deleted?'Mensaje eliminado':message.body));
    const bottom=createEl('div','nx-support-message-bottom');
    bottom.append(createEl('time','',`${escapedTime(message.createdAt)}${message.editedAt?' · Editado':''}`));
    if(!message.deleted&&(own||adminRole())){
      if(own){
        const edit=createEl('button','','Editar');edit.type='button';
        edit.addEventListener('click',()=>editInline(wrapper,message));bottom.append(edit);
      }
      const remove=createEl('button','nx-support-remove','Borrar');remove.type='button';
      remove.addEventListener('click',async()=>{
        if(!(await window.nexusConfirmFeedback({title:message.body.slice(0,140),subject:'mensaje',description:'Este mensaje quedará eliminado para todas las personas de la conversación.'}))) return;
        try{await api(`/api/community/messages/${encodeURIComponent(message.id)}`,'DELETE');await refreshConversation(false);}
        catch(e){note(e.message,true);}
      });
      bottom.append(remove);
    }
    wrapper.append(bottom);host.append(wrapper);
  }
  host.scrollTop=wasNearBottom?host.scrollHeight:oldScrollTop;
}
function editInline(wrapper,message) {
  if(wrapper.querySelector('.nx-support-edit')) return;
  const editor=createEl('div','nx-support-edit');
  const textarea=createEl('textarea');textarea.maxLength=2500;textarea.rows=3;textarea.value=message.body;
  const actions=createEl('div','nx-support-edit-actions');
  const cancel=createEl('button','btn','Cancelar');cancel.type='button';
  const save=createEl('button','btn primary','Guardar');save.type='button';
  cancel.addEventListener('click',()=>editor.remove());
  save.addEventListener('click',async()=>{
    save.disabled=true;
    try {await api(`/api/community/messages/${encodeURIComponent(message.id)}`,'PATCH',{text:textarea.value});await refreshConversation(false);}
    catch(e){note(e.message,true);save.disabled=false;}
  });
  actions.append(cancel,save);editor.append(textarea,actions);
  wrapper.append(editor);textarea.focus();
}
async function refreshConversation(reloadThreads=true) {
  if(!state.user||!$('#nxSupportDialog').open||state.loading || document.querySelector('.nx-support-edit')) return;
  state.loading=true;
  try{
    if(reloadThreads&&staffRole()) await loadThreads(true);
    if(staffRole()&&!state.activeClient){state.messages=[];renderConversation();return;}
    const route='/api/community/messages'+(staffRole()?`?clientId=${encodeURIComponent(state.activeClient)}`:'');
    const result=await api(route);
    state.messages=result.messages||[];
    renderConversation();
  }catch(e){note(e.message,true);}
  finally{state.loading=false;}
}
async function openSupport() {
  if(!state.user){alert('Inicia sesión para utilizar soporte.');return;}
  const dialog=$('#nxSupportDialog');
  if(!dialog.open) dialog.showModal();
  if(!staffRole()) state.activeClient=state.user.uid;
  note('Tus mensajes solo serán visibles para ti y el equipo autorizado.');
  await refreshConversation(true);
  clearInterval(state.interval);
  state.interval=setInterval(()=>refreshConversation(true),9000);
}
function closeSupport() {clearInterval(state.interval);state.interval=null;$('#nxSupportDialog').close();}

// Panel admin (solo se carga si el servidor confirma rol de administrador).
async function loadAdminStaff() {
  if(!adminRole()) return;
  const data=await api('/api/community/roles');
  const host=$('#nxAdminStaffList');host.replaceChildren();
  host.append(createEl('h4','','Equipo con acceso'));
  if(!data.roles.length) host.append(createEl('p','nx-muted','No has asignado cuentas todavía.'));
  data.roles.forEach(item=>{
    const row=createEl('div','nx-staff-person');
    row.append(createEl('strong','',item.email||item.userId),createEl('span','',item.role==='soporte'?'Soporte':'Atención al cliente'));
    host.append(row);
  });
  const select=$('#nxStaffUser');select.replaceChildren();
  const initial=createEl('option','','Elige una cuenta registrada');initial.value='';select.append(initial);
  try {
    const users=await getDocs(collection(db,'users'));
    users.docs.sort((a,b)=>String(a.data().email||'').localeCompare(String(b.data().email||''))).forEach(docSnap=>{
      const entry=docSnap.data();
      const option=createEl('option','',`${entry.displayName||entry.email||'Cuenta'} — ${entry.email||docSnap.id}`);
      option.value=docSnap.id;select.append(option);
    });
  }catch(e){$('#nxRoleStatus').textContent='No fue posible cargar las cuentas de Firebase: '+e.message;}
}
async function loadAdminAnnouncements(){
  if(!adminRole()) return;
  const data=await api('/api/community/announcements');
  const host=$('#nxAdminAnnouncementList');host.replaceChildren();
  if(!data.items.length){host.append(createEl('p','nx-muted','Aún no hay avisos globales.'));return;}
  for(const entry of data.items){
    const card=createEl('div','nx-admin-announcement');
    card.append(createEl('strong','',entry.title),createEl('p','',entry.message),createEl('small','',escapedTime(entry.createdAt)));
    const remove=createEl('button','nx-admin-remove','Eliminar aviso');remove.type='button';
    remove.addEventListener('click',async()=>{
      if(!(await window.nexusConfirmFeedback({title:entry.title,subject:'aviso',description:'Este aviso dejará de aparecer para todas las cuentas.'}))) return;
      try{await api(`/api/community/announcements/${entry.id}`,'DELETE');await Promise.all([loadAdminAnnouncements(),bootstrap()]);}
      catch(e){$('#nxAnnouncementStatus').textContent=e.message;}
    });
    card.append(remove);host.append(card);
  }
}
async function showAdminCommunity(){
  if(!state.user) return;
  if(!adminRole()) {try{await bootstrap();}catch{return;}}
  if(!adminRole()) return;
  await Promise.all([loadAdminStaff(),loadAdminAnnouncements()]);
}

window.addEventListener('nx-local-notifications',event=>{
  state.localUnread=Math.max(0,Number(event.detail?.unread)||0);syncBadges();
});
$('#nxSupportOpen').addEventListener('click',openSupport);
$('#nxSupportClose').addEventListener('click',closeSupport);
$('#nxSupportDialog').addEventListener('close',()=>{clearInterval(state.interval);state.interval=null;});
$('#nxSupportRefresh').addEventListener('click',()=>refreshConversation());
$('#nxSupportForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const input=$('#nxSupportInput'); const text=input.value.trim();
  if(!text||state.loading) return;
  const send=$('#nxSupportSend');send.disabled=true;
  try {
    await api('/api/community/messages','POST',{text, ...(staffRole()?{clientId:state.activeClient}:{})});
    input.value='';note('Mensaje enviado.');await refreshConversation();
  } catch(e){note(e.message,true);}finally{send.disabled=false;}
});
$('#nxAnnouncementForm button').addEventListener('click',async event=>{
  event.preventDefault();
  const title=$('#nxAnnouncementTitle').value.trim(),message=$('#nxAnnouncementMessage').value.trim();
  const status=$('#nxAnnouncementStatus');
  if(!title||!message){status.textContent='Escribe título y mensaje.';return;}
  event.currentTarget.disabled=true;
  try{await api('/api/community/announcements','POST',{title,message});
    $('#nxAnnouncementTitle').value='';$('#nxAnnouncementMessage').value='';status.textContent='Aviso publicado para toda la comunidad.';
    await Promise.all([loadAdminAnnouncements(),bootstrap()]);
  }catch(e){status.textContent=e.message;}finally{event.currentTarget.disabled=false;}
});
$('#nxRoleForm button').addEventListener('click',async event=>{
  event.preventDefault();const userId=$('#nxStaffUser').value,role=$('#nxStaffRole').value,status=$('#nxRoleStatus');
  if(!userId){status.textContent='Selecciona una cuenta registrada.';return;}
  event.currentTarget.disabled=true;
  try{await api('/api/community/roles','POST',{userId,role});status.textContent='Rol actualizado y aplicado en el servidor.';await loadAdminStaff();}
  catch(e){status.textContent=e.message;}finally{event.currentTarget.disabled=false;}
});
$('#nxAdminOpenInbox').addEventListener('click',openSupport);
document.querySelector('[data-admin-tab="community"]').addEventListener('click',showAdminCommunity);

let lastUser='';
authReady.then(()=>onAuthStateChanged(auth,async user=>{
  state.user=user;
  state.activeClient='';state.messages=[];state.broadcasts=[];state.role='cliente';state.supportUnread=0;
  clearInterval(state.poll);state.poll=null;
  if(!user){
    if($('#nxSupportDialog').open) closeSupport();
    $('#nxSupportMessages').replaceChildren();
    state.activeClient='';renderBroadcasts();return;
  }
  lastUser=user.uid;
  try{await bootstrap();}catch(e){console.warn('Nexus Support no pudo conectar:',e.message);}
  state.poll=setInterval(async()=>{
    if(state.user?.uid!==lastUser) return;
    try{await bootstrap();}catch(e){console.debug('Centro de soporte sin conexión:',e.message);}
  },45000);
}));
