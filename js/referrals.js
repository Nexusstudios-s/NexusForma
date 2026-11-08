import {onAuthStateChanged, sendEmailVerification} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {auth, authReady} from './firebase.js';

/* Nexus Rewards: no entrega premios desde el navegador. Todos los bonos se validan
   y acreditan exclusivamente en /api/referrals/claim mediante Firebase Auth + SQLite. */
const $ = id => document.getElementById(id);
const digits = value => Number(value || 0).toLocaleString('es-CO');
const CODE_RE = /^NX-[A-HJ-NP-Z2-9]{8}$/;
let identity = null;
let myReferral = null;
let adminReferral = null;
let loading = false;
const pendingKey = 'nexus-referral-new-uid';
const invitedKey = 'nexus-referral-code';
function setNotice(id, message, success = false) {
  const node = $(id);
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('success', success);
}
function inviteLink(code) {
  const url = new URL('login.html', window.location.href);
  url.searchParams.set('ref', code);
  return url.href;
}
async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = $('referralLink');
    if (!input) return false;
    const previous = input.value;
    input.value = text;
    input.focus();
    input.select();
    const copied = document.execCommand('copy');
    input.value = previous;
    return copied;
  }
}
async function api(url, data) {
  if (!auth.currentUser) throw new Error('Inicia sesión para ver tus invitaciones.');
  const init = {headers: {'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`}};
  if (data !== undefined) {
    init.method = 'POST';
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(data);
  }
  let response;
  try { response = await fetch(url, init); }
  catch { throw new Error('No se pudo conectar con el servidor. Comprueba tu conexión.'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}
function setReferralUI(payload) {
  myReferral = payload;
  const {code, settings, account} = payload;
  $('referralPersonalCode').textContent = code;
  $('referralLink').value = inviteLink(code);
  $('referralInviterTokens').textContent = digits(settings.inviterTokens);
  $('referralGuestTokens').textContent = digits(settings.guestTokens);
  $('referralWelcomeReward').textContent = `+${digits(settings.guestTokens)}`;
  $('referralInviteCount').textContent = digits(account.invitedCount);
  $('referralBonusBalance').textContent = digits(account.bonusBalance);
  $('referralRedeemOpen').hidden = !settings.enabled || !account.canRedeem;
  $('referralProgramState').textContent = settings.enabled ? 'Programa activo' : 'Temporalmente pausado';
  $('referralRules').textContent = `Una invitación por cuenta nueva. Válida durante ${settings.claimWindowDays} días desde el registro. ${settings.requireVerifiedEmail ? 'Requiere correo verificado. ' : ''}Los bonos no se renuevan y solo pueden utilizarse una vez.`;
  for (const id of ['referralShareButton','referralCopyLink','referralCopyCode']) $(id).disabled = !settings.enabled;
  $('referralVerifyInfo').hidden = !settings.requireVerifiedEmail || account.verifiedEmail;
}
async function loadMe() {
  if (!identity || loading) return;
  loading = true;
  try { setReferralUI(await api('/api/referrals/me')); }
  catch (error) {
    $('referralPersonalCode').textContent = 'No disponible';
    $('referralLink').value = 'No se pudo conectar';
    $('referralProgramState').textContent = error.message;
  } finally { loading = false; }
}
function openWelcome() {
  if (!identity || !myReferral || !myReferral.account.canRedeem || !myReferral.settings.enabled) return;
  const stored = sessionStorage.getItem(invitedKey) || '';
  if (CODE_RE.test(stored)) $('referralClaimCode').value = stored;
  setNotice('referralClaimStatus', '');
  $('referralClaimSubmit').disabled = false;
  $('referralClaimSubmit').textContent = 'Activar mi regalo  ↗';
  $('referralSkip').textContent = 'Continuar sin código por ahora';
  const dialog = $('referralWelcomeDialog');
  if (!dialog.open) dialog.showModal();
}
function closeWelcome() {
  $('referralWelcomeDialog').close();
}
$('referralWelcomeDialog').addEventListener('click', event => {
  if (event.target === $('referralWelcomeDialog')) closeWelcome();
});
$('referralClose').addEventListener('click', closeWelcome);
$('referralSkip').addEventListener('click', closeWelcome);
$('referralRedeemOpen').addEventListener('click', openWelcome);
$('referralCopyCode').addEventListener('click', async () => {
  if (!myReferral) return;
  const copied = await copyText(myReferral.code);
  const button = $('referralCopyCode');
  button.textContent = copied ? '✓' : '×';
  setTimeout(() => {button.textContent = '⧉';}, 1400);
});
$('referralCopyLink').addEventListener('click', async () => {
  const copied = await copyText($('referralLink').value);
  $('referralCopyLink').textContent = copied ? '¡Copiado!' : 'Error';
  setTimeout(() => {$('referralCopyLink').textContent = 'Copiar';}, 1600);
});
$('referralShareButton').addEventListener('click', async () => {
  if (!myReferral) return;
  const url = inviteLink(myReferral.code);
  try {
    if (navigator.share) await navigator.share({title:'Te invito a Nexus Forma',text:`Únete a Nexus Forma con mi código ${myReferral.code} y reclama tus tokens de bienvenida.`,url});
    else {
      await copyText(url);
      $('referralShareButton').textContent = '✓ Enlace copiado';
      setTimeout(() => {$('referralShareButton').textContent = '↗   Compartir invitación';},1800);
    }
  } catch (error) { if (error.name !== 'AbortError') setNotice('referralProgramState','No se pudo compartir el enlace.'); }
});
$('referralClaimCode').addEventListener('input', event => {
  let value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'');
  if (/^NX(?!-)/.test(value)) value = `NX-${value.slice(2)}`;
  event.target.value = value.slice(0,11);
  setNotice('referralClaimStatus','');
});
$('referralClaimForm').addEventListener('submit', async event => {
  event.preventDefault();
  const code = $('referralClaimCode').value.trim().toUpperCase();
  if (!CODE_RE.test(code)) return setNotice('referralClaimStatus','Revisa el código. Debe tener el formato NX-XXXXXXXX.');
  const button = $('referralClaimSubmit');
  button.disabled = true;
  button.textContent = 'Validando tu invitación…';
  setNotice('referralClaimStatus','');
  let redeemed = false;
  try {
    const result = await api('/api/referrals/claim', {code});
    redeemed = true;
    sessionStorage.removeItem(invitedKey);
    sessionStorage.removeItem(pendingKey);
    setNotice('referralClaimStatus', `¡Activado! Tú ganaste ${digits(result.guestTokens)} tokens y tu amigo ${digits(result.inviterTokens)}.`, true);
    $('referralSkip').textContent = 'Continuar a Nexus Forma →';
    await loadMe();
    window.dispatchEvent(new CustomEvent('referral-claimed', {detail:result}));
  } catch (error) {
    setNotice('referralClaimStatus',error.message);
  } finally {
    button.disabled = redeemed;
    button.textContent = redeemed ? '✓ Regalo activado' : 'Activar mi regalo  ↗';
  }
});
$('referralResendVerify').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await sendEmailVerification(auth.currentUser);
    setNotice('referralClaimStatus','Te enviamos un enlace de verificación a tu correo. Revisa también spam.',true);
  } catch (error) {
    setNotice('referralClaimStatus',error.code === 'auth/too-many-requests' ? 'Demasiados intentos. Inténtalo más tarde.' : 'No se pudo enviar el correo de verificación.');
  } finally {button.disabled = false;}
});
$('referralCheckVerified').addEventListener('click', async () => {
  try {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    await loadMe();
    setNotice('referralClaimStatus',myReferral?.account.verifiedEmail ? 'Correo verificado. Ya puedes activar el código.' : 'Tu correo aún no aparece verificado. Abre el enlace que recibiste.', Boolean(myReferral?.account.verifiedEmail));
  } catch {setNotice('referralClaimStatus','No se pudo comprobar la verificación. Intenta otra vez.');}
});
function showAdmin(data) {
  adminReferral = data;
  const {settings,stats} = data;
  $('refAdminEnabled').checked = settings.enabled;
  $('refAdminVerified').checked = settings.requireVerifiedEmail;
  $('refAdminInviter').value = settings.inviterTokens;
  $('refAdminGuest').value = settings.guestTokens;
  $('refAdminMax').value = settings.maxClaimsPerInviter;
  $('refAdminDays').value = settings.claimWindowDays;
  $('refAdminCodes').textContent = digits(stats.issuedCodes);
  $('refAdminClaims').textContent = digits(stats.redeemed);
  $('refAdminTotal').textContent = digits(stats.inviterTokens + stats.guestTokens);
  const history = $('refAdminHistory');
  history.replaceChildren();
  if (!stats.recent.length) {
    const label = document.createElement('p');
    label.className = 'history-loading';
    label.textContent = 'Todavía no hay canjes. Aparecerán aquí cuando se validen.';
    history.append(label);
  }
  for (const entry of stats.recent) {
    const row = document.createElement('div');
    row.className = 'referral-history-item';
    const title = document.createElement('strong'); title.textContent = entry.code;
    const detail = document.createElement('span');
    detail.textContent = `Invitador +${digits(entry.inviterTokens)} · Invitado +${digits(entry.guestTokens)}`;
    const date = document.createElement('small');
    date.textContent = new Date(entry.createdAt).toLocaleDateString('es-CO');
    row.append(title, detail, date);
    history.append(row);
  }
}
async function loadAdmin() {
  if (!identity) return;
  try {showAdmin(await api('/api/admin/referrals'));}
  catch(error) {setNotice('refAdminMessage',error.message);}
}
$('refAdminSave').addEventListener('click', async event => {
  const payload = {
    enabled:$('refAdminEnabled').checked,
    requireVerifiedEmail:$('refAdminVerified').checked,
    inviterTokens:Number($('refAdminInviter').value),
    guestTokens:Number($('refAdminGuest').value),
    maxClaimsPerInviter:Number($('refAdminMax').value),
    claimWindowDays:Number($('refAdminDays').value),
  };
  if (![...$('referralAdminForm').querySelectorAll('input')].every(input => input.reportValidity()) || Object.values(payload).some(value => typeof value === 'number' && !Number.isInteger(value))) return;
  const button = $('refAdminSave'); button.disabled = true;
  setNotice('refAdminMessage','Guardando configuración…');
  try {
    showAdmin(await api('/api/admin/referrals', payload));
    setNotice('refAdminMessage','Cambios guardados. Solo se aplicarán a los próximos canjes.',true);
    await loadMe();
  } catch(error) {setNotice('refAdminMessage',error.message);} finally {button.disabled = false;}
});
for (const button of document.querySelectorAll('[data-admin-tab="referrals"]')) {
  button.addEventListener('click', loadAdmin);
}
window.addEventListener('admin-open', () => {
  // La carga se hace al abrir la pestaña para evitar peticiones innecesarias.
});

// No mostramos el modal en inicios de sesión de cuentas antiguas.
authReady.then(() => onAuthStateChanged(auth, async user => {
  identity = user;
  if (!user) return;
  await loadMe();
  const pending = sessionStorage.getItem(pendingKey);
  if (pending === user.uid && myReferral) {
    sessionStorage.removeItem(pendingKey);
    openWelcome();
  }
}));
