import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signOut, updatePassword, updateProfile, verifyBeforeUpdateEmail } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, serverTimestamp, Timestamp, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, authReady, db } from './firebase.js';

const accountMenu = document.querySelector('#accountMenu');
const profileDialog = document.querySelector('#profileDialog');
const adminDialog = document.querySelector('#adminDialog');
const adminUserList = document.querySelector('#adminUserList');
const adminUserSearch = document.querySelector('#adminUserSearch');
const adminUserEmail = document.querySelector('#adminUserEmail');
const adminUserPlan = document.querySelector('#adminUserPlan');
const adminUserDuration = document.querySelector('#adminUserDuration');
const adminUserCustomTag = document.querySelector('#adminUserCustomTag');
const adminUserTokenCredits = document.querySelector('#adminUserTokenCredits');
const adminUserTokenCreditsDuration = document.querySelector('#adminUserTokenCreditsDuration');
const adminButton = document.querySelector('#adminButton');
const ADMIN_EMAILS = new Set(['santhiagocaro05@gmail.com', 'admin@forma.app']);
let PREMIUM_MODELS = ['Nexus-Premium', 'Nexus-SST', 'Nexus-Sonet', 'Nexus-Astra'];

let activeUser = null;
let currentProfile = {};
let adminUsers = [];
let selectedPhoto = null;
let photoPreviewUrl = '';

function renderAdminPremiumModelOptions(models = null) {
  const container = document.querySelector('#adminPremiumModelOptions');
  if (!container) return;
  const previouslySelected = new Set([...container.querySelectorAll('input[name="premiumModels"]:checked')].map(input => input.value));
  const options = Array.isArray(models)
    ? models.filter(model => model?.id && model.enabled !== false && model.tier !== 'free')
    : PREMIUM_MODELS.map(id => ({id, name: id, tier: 'premium'}));
  PREMIUM_MODELS = options.map(model => model.id);
  container.replaceChildren();
  if (!options.length) {
    const empty = document.createElement('span');
    empty.className = 'admin-premium-model-empty';
    empty.textContent = 'No hay modelos Pro o Premium habilitados.';
    container.append(empty);
    return;
  }
  for (const model of options) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'premiumModels';
    checkbox.value = model.id;
    checkbox.checked = previouslySelected.has(model.id);
    const text = document.createElement('span');
    text.textContent = model.name && model.name !== model.id ? `${model.name} · ${model.id}` : model.id;
    label.append(checkbox, text);
    container.append(label);
  }
}

function renderAdminCustomFeatureOptions(features = [], selectedFeatures = []) {
  const container = document.querySelector('#adminCustomFeatureOptions');
  if (!container) return;
  const selected = new Set(selectedFeatures);
  container.replaceChildren();
  for (const feature of features) {
    if (!feature?.id || !feature.label) continue;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'customFeatures';
    checkbox.value = feature.id;
    checkbox.checked = selected.has(feature.id);
    const text = document.createElement('span');
    text.textContent = feature.label;
    label.append(checkbox, text);
    container.append(label);
  }
  if (!container.children.length) {
    const empty = document.createElement('span');
    empty.className = 'admin-premium-model-empty';
    empty.textContent = 'Agrega funciones en Panel admin > Planes para asignarlas.';
    container.append(empty);
  }
}

async function loadAdminPremiumModelOptions() {
  try {
    const snapshot = await getDoc(doc(db, 'appConfig', 'public'));
    const settings = snapshot.exists() ? snapshot.data() : {};
    const models = settings.models;
    renderAdminPremiumModelOptions(Array.isArray(models) ? models : null);
    renderAdminCustomFeatureOptions(Array.isArray(settings.planFeatures) ? settings.planFeatures : []);
  } catch (error) {
    console.warn('No se pudo cargar el catálogo de modelos para los usuarios:', error);
    renderAdminPremiumModelOptions([]);
    renderAdminCustomFeatureOptions([]);
  }
}

function userInitials(name) {
  return String(name || 'Tu cuenta').trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase() || 'U';
}

function isLegacyStoragePhotoURL(value) {
  return typeof value === 'string' && /^https:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//i.test(value);
}

function safeProfilePhotoURL(value) {
  if (typeof value !== 'string' || isLegacyStoragePhotoURL(value)) return '';
  return value;
}

function resolveProfile(user, profile = {}) {
  const source = profile || {};
  return {
    displayName: source.displayName || user?.displayName || user?.email?.split('@')[0] || 'Tu cuenta',
    photoURL: safeProfilePhotoURL(source.photoURL || user?.photoURL || ''),
  };
}

function getAccessBadge(profile = {}) {
  const expiry = profile.expiresAt?.toDate?.() || (profile.expiresAt ? new Date(profile.expiresAt) : null);
  if (expiry && expiry.getTime() <= Date.now()) return '';
  const labels = [profile.planType, profile.plan, profile.subscriptionType, profile.accessType];
  const explicit = labels.find(value => typeof value === 'string' && value.trim());
  const normalized = String(explicit || '').trim().toLowerCase();
  const premiumModels = Array.isArray(profile.premiumModels) ? profile.premiumModels.filter(Boolean) : [];
  if (normalized.includes('premium')) return 'Premium';
  if (normalized.includes('estudio')) return 'Estudio';
  if (normalized.includes('alquiler')) return 'Alquiler';
  if (normalized === 'pro') return 'Pro';
  if (premiumModels.length) return 'Premium';
  if (normalized && !['gratis', 'free'].includes(normalized)) return String(explicit).trim().slice(0, 24);
  return '';
}

function expiryDate(profile = {}) {
  return profile.expiresAt?.toDate?.() || (profile.expiresAt ? new Date(profile.expiresAt) : null);
}

function subscriptionCountdown(profile = {}) {
  const expiry = expiryDate(profile);
  if (!expiry || Number.isNaN(expiry.getTime())) {
    return profile.plan && profile.plan !== 'Gratis' ? 'Acceso sin vencimiento' : 'Plan Gratis · sin vencimiento';
  }
  const remaining = expiry.getTime() - Date.now();
  if (remaining <= 0) return 'Suscripción vencida · acceso Gratis';
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  if (days) return `Vence en ${days} ${days === 1 ? 'día' : 'días'}${hours ? ` y ${hours} h` : ''}`;
  const minutes = Math.max(1, Math.floor((remaining % 3600000) / 60000));
  return hours ? `Vence en ${hours} h${minutes ? ` y ${minutes} min` : ''}` : `Vence en ${minutes} min`;
}

function updateSubscriptionCountdown() {
  const label = subscriptionCountdown(currentProfile);
  document.querySelectorAll('[data-user-status]').forEach(node => { node.textContent = label; });
  const accountLabel = document.querySelector('#accountSubscriptionCountdown');
  if (accountLabel) accountLabel.textContent = label;
}

function updateAccountUI(user, profile = {}) {
  const resolved = resolveProfile(user, profile);
  const name = resolved.displayName;
  const photoURL = resolved.photoURL;
  const badge = getAccessBadge(profile);

  document.querySelectorAll('[data-user-name]').forEach(node => { node.textContent = name; });
  document.querySelectorAll('[data-user-status]').forEach(node => { node.textContent = subscriptionCountdown(profile); });
  document.querySelector('#accountName').textContent = name;
  document.querySelector('#accountEmail').textContent = user.email || '';
  const accountCountdown = document.querySelector('#accountSubscriptionCountdown');
  if (accountCountdown) accountCountdown.textContent = subscriptionCountdown(profile);

  const sidebarPlan = document.querySelector('#sidebarPlanLabel');
  if (sidebarPlan) {
    const planLabel = badge || 'Gratis';
    sidebarPlan.textContent = `Plan ${planLabel}`;
    sidebarPlan.classList.remove('is-free', 'is-pro', 'is-estudio', 'is-premium', 'is-alquiler');
    const planClass = planLabel.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    sidebarPlan.classList.add(`is-${planClass}`);
  }

  document.querySelectorAll('[data-user-badge]').forEach(node => {
    node.textContent = badge || '';
    node.hidden = !badge;
    node.classList.toggle('is-free', !badge);
    node.classList.toggle('is-pro', badge === 'Pro');
    node.classList.toggle('is-premium', badge === 'Premium');
    node.classList.toggle('is-estudio', badge === 'Estudio');
    node.classList.toggle('is-alquiler', badge === 'Alquiler');
  });

  document.querySelectorAll('[data-avatar]').forEach(node => {
    node.textContent = userInitials(name);
    node.style.backgroundImage = photoURL ? `url("${photoURL}")` : '';
    node.classList.toggle('has-photo', Boolean(photoURL));
  });

  if (adminButton) {
    const isAdmin = ADMIN_EMAILS.has((user?.email || '').toLowerCase());
    adminButton.hidden = !isAdmin;
  }
}

window.addEventListener('access-profile-updated', event => {
  if (!activeUser) return;
  currentProfile = event.detail && typeof event.detail === 'object' ? event.detail : {};
  updateAccountUI(activeUser, currentProfile);
});

function setProfilePreview(name, photoURL = '') {
  const preview = document.querySelector('#profilePhotoPreview');
  preview.textContent = userInitials(name || 'Tu cuenta');
  const resolvedPhotoURL = safeProfilePhotoURL(photoURL);
  preview.style.backgroundImage = resolvedPhotoURL ? `url("${resolvedPhotoURL}")` : '';
  preview.style.color = resolvedPhotoURL ? 'transparent' : '#32684d';
}

function renderProfileCredits(profile = currentProfile) {
  const amount = Math.max(0, Number(profile.tokenCredits || 0));
  const expiry = expiryDate({expiresAt: profile.tokenCreditsExpiresAt});
  const creditNode = document.querySelector('#profileCreditsSummary');
  if (!creditNode) return;
  creditNode.replaceChildren();
  const total = document.createElement('strong');
  total.textContent = amount.toLocaleString('es-AR');
  const label = document.createElement('span');
  label.textContent = 'créditos disponibles';
  const expiration = document.createElement('small');
  expiration.textContent = expiry && expiry.getTime() > Date.now()
    ? `Vencen el ${expiry.toLocaleDateString('es-AR')}`
    : 'Los créditos se suman a tu cuota al aprobar una compra.';
  creditNode.append(total, label, expiration);
}

async function loadProfilePurchases() {
  const list = document.querySelector('#profilePurchasesList');
  if (!list || !activeUser) return;
  list.replaceChildren();
  const loading = document.createElement('small');
  loading.className = 'profile-purchase-empty';
  loading.textContent = 'Cargando compras…';
  list.append(loading);
  try {
    const snapshot = await getDocs(query(
      collection(db, 'paymentSubmissions'), where('uid', '==', activeUser.uid), limit(20),
    ));
    const purchases = snapshot.docs
      .map(item => ({id: item.id, ...item.data()}))
      .sort((left, right) => (right.createdAt?.toDate?.().getTime?.() || 0) - (left.createdAt?.toDate?.().getTime?.() || 0));
    list.replaceChildren();
    if (!purchases.length) {
      const empty = document.createElement('small');
      empty.className = 'profile-purchase-empty';
      empty.textContent = 'Todavía no tienes compras registradas.';
      list.append(empty);
      return;
    }
    for (const purchase of purchases) {
      const row = document.createElement('article');
      row.className = 'profile-purchase-row';
      const details = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = purchase.purchaseType === 'tokens' ? `${Number(purchase.tokenAmount || 0).toLocaleString('es-AR')} tokens` : purchase.planName || 'Compra';
      const date = document.createElement('small');
      const createdAt = purchase.createdAt?.toDate?.();
      date.textContent = createdAt ? createdAt.toLocaleDateString('es-AR') : 'Fecha pendiente';
      details.append(name, date);
      const state = document.createElement('span');
      state.className = `profile-purchase-status is-${purchase.status || 'pending'}`;
      state.textContent = ({approved: 'Aprobada', rejected: 'Rechazada', pending: 'Pendiente', reviewed: 'Revisada'})[purchase.status] || 'En revisión';
      row.append(details, state);
      list.append(row);
    }
  } catch (error) {
    console.warn('No se pudo cargar el historial de compras:', error);
    list.replaceChildren();
    const failed = document.createElement('small');
    failed.className = 'profile-purchase-empty';
    failed.textContent = error.code === 'permission-denied' ? 'Firestore no permite consultar tus compras.' : 'No se pudo cargar el historial de compras.';
    list.append(failed);
  }
}

async function compressProfilePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la foto.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let quality = 0.72;
  let photoURL = canvas.toDataURL('image/jpeg', quality);
  while (photoURL.length > 160_000 && quality > 0.4) {
    quality -= 0.08;
    photoURL = canvas.toDataURL('image/jpeg', quality);
  }
  if (photoURL.length > 160_000) throw new Error('La foto comprimida supera el límite de Firestore.');
  return photoURL;
}

function parseAccessDuration(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const match = value.match(/(\d+)\s*(d(?:ia|ías)?|w(?:eek|eeks)?|m(?:es|eses)?|a(?:ño|ños)?|h(?:ora|oras)?)?/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] || 'd').toLowerCase();
  const msPerDay = 24 * 60 * 60 * 1000;
  if (unit.startsWith('h')) return new Date(Date.now() + amount * 60 * 60 * 1000);
  let days = amount;
  if (unit.startsWith('a')) days = amount * 365;
  else if (unit.startsWith('m')) days = amount * 30;
  else if (unit.startsWith('w')) days = amount * 7;
  return new Date(Date.now() + days * msPerDay);
}

async function openAdminPanel() {
  if (!activeUser) return;
  adminDialog.showModal();
  window.dispatchEvent(new Event('admin-open'));
  await Promise.all([loadAdminUsers(), loadAdminPremiumModelOptions()]);
}

async function loadAdminUsers() {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    adminUsers = snapshot.docs
      .map(item => ({ uid: item.id, ...item.data() }))
      .sort((left, right) => {
        const leftLabel = (left.displayName || left.email || '').toLowerCase();
        const rightLabel = (right.displayName || right.email || '').toLowerCase();
        return leftLabel.localeCompare(rightLabel);
      });
    renderAdminUsers();
  } catch (error) {
    adminUserList.innerHTML = '<span class="history-loading">No se pudo cargar la gestión de usuarios.</span>';
    console.error('No se pudo cargar admin users:', error);
  }
}

function renderAdminUsers(filterText = '') {
  const search = String(filterText || adminUserSearch?.value || '').trim().toLowerCase();
  const users = !search ? adminUsers : adminUsers.filter(item => {
    const email = (item.email || '').toLowerCase();
    const name = (item.displayName || '').toLowerCase();
    return email.includes(search) || name.includes(search);
  });

  const userCount = document.querySelector('#adminUserCount');
  userCount.textContent = `${users.length} ${users.length === 1 ? 'cuenta' : 'cuentas'}`;
  adminUserList.replaceChildren();
  if (!users.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-user-empty';
    empty.textContent = 'No se encontraron cuentas.';
    adminUserList.append(empty);
    return;
  }

  for (const user of users) {
    const label = getAccessBadge(user) || 'Gratis';
    const isSelected = (adminUserEmail.value || '').toLowerCase() === (user.email || '').toLowerCase();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-user-item${isSelected ? ' active' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'admin-user-avatar';
    avatar.textContent = userInitials(user.displayName || user.email || 'Usuario');
    const copy = document.createElement('span');
    copy.className = 'admin-user-copy';
    const name = document.createElement('strong');
    name.textContent = user.displayName || user.email || 'Usuario';
    const email = document.createElement('small');
    email.textContent = user.email || 'Sin correo';
    copy.append(name, email);
    const credits = Math.max(0, Number(user.tokenCredits || 0));
    if (credits) {
      const creditNote = document.createElement('small');
      creditNote.className = 'admin-user-credit-note';
      creditNote.textContent = `${credits.toLocaleString('es-AR')} tokens extra`;
      copy.append(creditNote);
    }
    const badge = document.createElement('span');
    badge.className = 'user-role-badge';
    if (label === 'Premium') badge.classList.add('is-premium');
    if (label === 'Estudio') badge.classList.add('is-estudio');
    if (label === 'Alquiler') badge.classList.add('is-alquiler');
    badge.textContent = label;
    button.append(avatar, copy, badge);
    if (user.customTag) {
      const tag = document.createElement('span');
      tag.className = 'admin-user-custom-tag';
      tag.textContent = user.customTag;
      button.append(tag);
    }
    button.addEventListener('click', () => {
      const selected = user;
      if (!selected) return;
      adminUserEmail.value = selected.email || '';
      adminUserPlan.value = getAccessBadge(selected) || 'Gratis';
      adminUserPlan.dispatchEvent(new Event('change'));
      adminUserCustomTag.value = String(selected.customTag || '').slice(0, 32);
      const creditsExpiry = selected.tokenCreditsExpiresAt?.toDate?.() || (selected.tokenCreditsExpiresAt ? new Date(selected.tokenCreditsExpiresAt) : null);
      const activeCredits = Boolean(creditsExpiry && creditsExpiry.getTime() > Date.now());
      adminUserTokenCredits.value = activeCredits ? String(Math.max(0, Number(selected.tokenCredits) || 0)) : '0';
      const creditsDays = activeCredits
        ? Math.max(1, Math.ceil((creditsExpiry.getTime() - Date.now()) / 86400000))
        : 30;
      adminUserTokenCreditsDuration.value = `${creditsDays} días`;
      const premiumMap = Array.isArray(selected.premiumModels) ? selected.premiumModels : [];
      document.querySelectorAll('input[name="premiumModels"]').forEach(input => {
        input.checked = premiumMap.includes(input.value);
      });
      const customFeatureMap = Array.isArray(selected.customFeatures) ? selected.customFeatures : [];
      document.querySelectorAll('input[name="customFeatures"]').forEach(input => {
        input.checked = customFeatureMap.includes(input.value);
      });
      const expiry = selected.expiresAt?.toDate?.() || (selected.expiresAt ? new Date(selected.expiresAt) : null);
      const remainingDays = expiry ? Math.max(1, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null;
      adminUserDuration.value = remainingDays ? `${remainingDays} días` : '30 días';
      renderAdminUsers();
    });
    adminUserList.append(button);
  }
}

const signOutDialog = document.querySelector('#signOutDialog');
const confirmSignOutButton = document.querySelector('#confirmSignOut');

const signOutUser = async () => {
  try {
    await signOut(auth);
    location.replace('login.html');
    return true;
  } catch {
    const toast = document.querySelector('#toast');
    toast.textContent = 'No se pudo cerrar la sesión. Inténtalo otra vez.';
    toast.classList.add('show');
    return false;
  }
};

const requestSignOut = () => {
  accountMenu.hidden = true;
  if (!signOutDialog.open) signOutDialog.showModal();
};

document.querySelector('#signOutButton').addEventListener('click', requestSignOut);
document.querySelector('#sidebarSignOut').addEventListener('click', requestSignOut);
document.querySelector('#cancelSignOut').addEventListener('click', () => signOutDialog.close());
confirmSignOutButton.addEventListener('click', async () => {
  confirmSignOutButton.disabled = true;
  confirmSignOutButton.textContent = 'Cerrando…';
  const signedOut = await signOutUser();
  if (!signedOut) {
    confirmSignOutButton.disabled = false;
    confirmSignOutButton.textContent = 'Cerrar sesión';
  }
});
signOutDialog.addEventListener('click', event => {
  if (event.target === signOutDialog) signOutDialog.close();
});
document.querySelector('#headerAccountButton').addEventListener('click', () => { accountMenu.hidden = !accountMenu.hidden; });
document.addEventListener('click', event => { if (!event.target.closest('.top-actions')) accountMenu.hidden = true; });

document.querySelector('#adminButton')?.addEventListener('click', openAdminPanel);
window.addEventListener('model-config-updated', event => {
  if (Array.isArray(event.detail?.models)) renderAdminPremiumModelOptions(event.detail.models);
  if (Array.isArray(event.detail?.planFeatures)) renderAdminCustomFeatureOptions(event.detail.planFeatures);
});
document.querySelector('#closeAdmin')?.addEventListener('click', () => adminDialog.close());
adminDialog?.addEventListener('click', event => { if (event.target === adminDialog) adminDialog.close(); });
document.querySelector('#refreshUsers')?.addEventListener('click', loadAdminUsers);
adminUserSearch?.addEventListener('input', event => renderAdminUsers(event.target.value));
adminUserPlan?.addEventListener('change', () => {
  document.querySelector('#adminCustomFeaturesFieldset').hidden = adminUserPlan.value !== 'Personalizado';
});

document.querySelector('#adminForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!document.querySelector('[data-admin-view="users"].active')) return;
  const email = adminUserEmail.value.trim();
  if (!email) {
    adminUserEmail.focus();
    return;
  }

  const selectedUser = adminUsers.find(user => (user.email || '').toLowerCase() === email.toLowerCase());
  if (!selectedUser) {
    adminUserEmail.focus();
    return;
  }

  const planValue = adminUserPlan.value;
  const planId = ({ Gratis: 'free', Pro: 'pro', Estudio: 'studio', Premium: 'premium', Alquiler: 'rental', Personalizado: 'custom-plan' })[planValue] || 'free';
  const planTokenLimit = ({ Gratis: 500000, Pro: 2000000, Estudio: 5000000, Premium: 1500000, Alquiler: 2000000, Personalizado: 500000 })[planValue] || 0;
  const tokenCredits = Number.parseInt(adminUserTokenCredits.value || '0', 10);
  if (!Number.isInteger(tokenCredits) || tokenCredits < 0 || tokenCredits > 50_000_000) {
    adminUserTokenCredits.focus();
    return;
  }
  const tokenCreditsExpiry = tokenCredits > 0 ? parseAccessDuration(adminUserTokenCreditsDuration.value) : null;
  if (tokenCredits > 0 && !tokenCreditsExpiry) {
    adminUserTokenCreditsDuration.focus();
    return;
  }
  const customTag = adminUserCustomTag.value.trim().slice(0, 32);
  const selectedModels = [...document.querySelectorAll('input[name="premiumModels"]:checked')].map(node => node.value);
  const durationValue = adminUserDuration.value.trim();
  const expiresAt = parseAccessDuration(durationValue);
  const premiumModels = planValue === 'Premium'
    ? (selectedModels.length ? selectedModels : PREMIUM_MODELS)
    : ['Alquiler', 'Personalizado'].includes(planValue) ? selectedModels : [];
  const customFeatures = planValue === 'Personalizado'
    ? [...document.querySelectorAll('input[name="customFeatures"]:checked')].map(node => node.value)
    : [];

  const update = {
    displayName: selectedUser.displayName || selectedUser.email?.split('@')[0] || 'Usuario',
    email: selectedUser.email || email,
    photoURL: selectedUser.photoURL || '',
    avatarPath: selectedUser.avatarPath || '',
    plan: planValue,
    planId,
    planType: planValue,
    subscriptionType: planValue,
    premiumModels,
    planTokenLimit,
    customFeatures,
    customTag,
    tokenCredits,
    tokenCreditsExpiresAt: tokenCreditsExpiry ? Timestamp.fromDate(tokenCreditsExpiry) : null,
    admin: Boolean(selectedUser.admin),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    updatedAt: serverTimestamp(),
    updatedBy: activeUser?.email || 'admin'
  };

  await setDoc(doc(db, 'users', selectedUser.uid), update, { merge: true });
  const toast = document.querySelector('#toast');
  toast.textContent = 'Acceso actualizado para este usuario.';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);

  await loadAdminUsers();
  if (activeUser && selectedUser.uid === activeUser.uid) {
    currentProfile = { ...currentProfile, ...update };
    updateAccountUI(activeUser, currentProfile);
  }
});

document.querySelector('#editProfileButton').addEventListener('click', () => {
  if (!activeUser) return;
  accountMenu.hidden = true;
  selectedPhoto = null;
  document.querySelector('#profilePhotoInput').value = '';
  const profileName = currentProfile.displayName || activeUser.displayName || activeUser.email?.split('@')[0] || '';
  const profilePhoto = safeProfilePhotoURL(currentProfile.photoURL || activeUser.photoURL || '');
  document.querySelector('#profileNameInput').value = profileName;
  document.querySelector('#newEmailInput').value = activeUser.email || '';
  document.querySelectorAll('#emailCurrentPassword, #currentPasswordInput, #newPasswordInput, #confirmPasswordInput').forEach(input => { input.value = ''; });
  setProfilePreview(profileName, profilePhoto);
  renderProfileCredits();
  loadProfilePurchases();
  document.querySelector('#profileFeedback').textContent = '';
  document.querySelector('#securityFeedback').textContent = '';
  document.querySelector('#securityFeedback').classList.remove('is-success');
  profileDialog.showModal();
});
document.querySelector('#closeProfile').addEventListener('click', () => profileDialog.close());
profileDialog.addEventListener('click', event => { if (event.target === profileDialog) profileDialog.close(); });
document.querySelector('#chooseProfilePhoto').addEventListener('click', () => document.querySelector('#profilePhotoInput').click());
document.querySelector('#profilePhotoInput').addEventListener('change', event => {
  const file = event.currentTarget.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    event.currentTarget.value = '';
    selectedPhoto = null;
    document.querySelector('#profileFeedback').textContent = 'Elige JPG, PNG o WebP de hasta 5 MB.';
    return;
  }
  selectedPhoto = file;
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = URL.createObjectURL(file);
  setProfilePreview(document.querySelector('#profileNameInput').value, photoPreviewUrl);
  document.querySelector('#profileFeedback').textContent = '';
});
document.querySelector('#profileNameInput').addEventListener('input', event => {
  if (!selectedPhoto) setProfilePreview(event.currentTarget.value, currentProfile.photoURL || activeUser?.photoURL || '');
});

function setSecurityFeedback(message, isError = true) {
  const feedback = document.querySelector('#securityFeedback');
  feedback.textContent = message;
  feedback.classList.toggle('is-success', !isError);
}

function hasPasswordProvider() {
  return activeUser?.providerData?.some(provider => provider.providerId === 'password') || false;
}

async function reauthenticatePasswordUser(password) {
  if (!hasPasswordProvider()) return;
  if (!password) throw new Error('Ingresa tu contraseña actual para continuar.');
  const credential = EmailAuthProvider.credential(activeUser.email, password);
  await reauthenticateWithCredential(activeUser, credential);
}

function authChangeError(error, fallback) {
  if (error instanceof Error && !error.code) return error.message;
  if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') return 'La contraseña actual no es correcta.';
  if (error.code === 'auth/requires-recent-login') return 'Por seguridad, cierra sesión e inicia sesión de nuevo antes de cambiar este dato.';
  if (error.code === 'auth/email-already-in-use') return 'Ese correo ya está asociado a otra cuenta.';
  if (error.code === 'auth/invalid-email') return 'Escribe un correo válido.';
  if (error.code === 'auth/weak-password') return 'La contraseña nueva debe tener al menos 8 caracteres.';
  return fallback;
}

document.querySelector('#changeEmailButton').addEventListener('click', async event => {
  const button = event.currentTarget;
  const newEmail = document.querySelector('#newEmailInput').value.trim();
  const currentPassword = document.querySelector('#emailCurrentPassword').value;
  if (!activeUser || !newEmail) return setSecurityFeedback('Escribe el nuevo correo.');
  if (newEmail.toLowerCase() === activeUser.email?.toLowerCase()) return setSecurityFeedback('Ese ya es el correo de esta cuenta.');
  button.disabled = true;
  setSecurityFeedback('');
  try {
    await reauthenticatePasswordUser(currentPassword);
    await verifyBeforeUpdateEmail(activeUser, newEmail);
    document.querySelector('#emailCurrentPassword').value = '';
    setSecurityFeedback('Te enviamos un enlace para verificar el nuevo correo. El cambio se aplicará después de confirmarlo.', false);
  } catch (error) {
    setSecurityFeedback(authChangeError(error, 'No se pudo iniciar el cambio de correo. Inténtalo otra vez.'));
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#changePasswordButton').addEventListener('click', async event => {
  const button = event.currentTarget;
  const currentPassword = document.querySelector('#currentPasswordInput').value;
  const newPassword = document.querySelector('#newPasswordInput').value;
  const confirmation = document.querySelector('#confirmPasswordInput').value;
  if (!activeUser) return;
  if (!hasPasswordProvider()) return setSecurityFeedback('Esta cuenta inicia sesión con Google. Cambia la contraseña desde tu cuenta de Google.');
  if (newPassword.length < 8) return setSecurityFeedback('La contraseña nueva debe tener al menos 8 caracteres.');
  if (newPassword !== confirmation) return setSecurityFeedback('Las contraseñas nuevas no coinciden.');
  button.disabled = true;
  setSecurityFeedback('');
  try {
    await reauthenticatePasswordUser(currentPassword);
    await updatePassword(activeUser, newPassword);
    document.querySelectorAll('#currentPasswordInput, #newPasswordInput, #confirmPasswordInput').forEach(input => { input.value = ''; });
    setSecurityFeedback('Contraseña actualizada. No se guarda ni se descarga en archivos.', false);
  } catch (error) {
    setSecurityFeedback(authChangeError(error, 'No se pudo cambiar la contraseña. Inténtalo otra vez.'));
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#profileForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!activeUser) return;
  const displayName = document.querySelector('#profileNameInput').value.trim();
  const feedback = document.querySelector('#profileFeedback');
  const saveButton = document.querySelector('#saveProfile');
  if (!displayName) { feedback.textContent = 'Escribe un nombre para tu perfil.'; return; }
  saveButton.disabled = true; saveButton.textContent = 'Guardando…'; feedback.textContent = '';

  try {
    const userRef = doc(db, 'users', activeUser.uid);
    const existing = await getDoc(userRef);
    const previousProfile = existing.exists() ? existing.data() : {};
    let photoURL = safeProfilePhotoURL(previousProfile.photoURL || currentProfile.photoURL || activeUser.photoURL || '');
    if (selectedPhoto) photoURL = await compressProfilePhoto(selectedPhoto);

    const nextProfile = {
      displayName,
      photoURL,
      avatarPath: '',
      email: activeUser.email || '',
      updatedAt: serverTimestamp(),
      ...(!existing.exists() ? { createdAt: serverTimestamp() } : {})
    };

    await setDoc(userRef, nextProfile, { merge: true });
    await updateProfile(activeUser, { displayName });

    currentProfile = { ...previousProfile, ...nextProfile, displayName, photoURL, avatarPath: '', email: activeUser.email || '' };
    updateAccountUI(activeUser, currentProfile);
    profileDialog.close();

    const toast = document.querySelector('#toast');
    toast.textContent = 'Perfil actualizado.';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  } catch (error) {
    feedback.textContent = error.code === 'permission-denied'
      ? 'Firestore bloqueó el guardado. Revisa las reglas de Firestore.'
      : 'No se pudo guardar el perfil. Revisa la conexión y la configuración de Firebase.';
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Guardar cambios';
  }
});

authReady.then(() => onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace('login.html');
    return;
  }

  activeUser = user;
  let profile = {};
  try {
    const userRef = doc(db, 'users', user.uid);
    const profileSnapshot = await getDoc(userRef);
    if (profileSnapshot.exists()) {
      profile = profileSnapshot.data();
      currentProfile = profile;
    } else {
      profile = {
        displayName: user.displayName || '',
        photoURL: safeProfilePhotoURL(user.photoURL || ''),
        avatarPath: '',
        email: user.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      currentProfile = profile;
      await setDoc(userRef, profile);
    }
    const profilePhotoNeedsMigration = isLegacyStoragePhotoURL(profile.photoURL) || Boolean(profile.avatarPath);
    if (profilePhotoNeedsMigration) {
      profile = { ...profile, photoURL: safeProfilePhotoURL(profile.photoURL), avatarPath: '' };
      currentProfile = profile;
      await setDoc(userRef, {photoURL: profile.photoURL, avatarPath: '', updatedAt: serverTimestamp()}, {merge: true});
    }
    if (isLegacyStoragePhotoURL(user.photoURL)) {
      try { await updateProfile(user, {photoURL: null}); }
      catch (error) { console.warn('No se pudo limpiar el avatar antiguo de Firebase Auth:', error); }
    }
    if (user.email && profile.email !== user.email) {
      await setDoc(userRef, { email: user.email, updatedAt: serverTimestamp() }, { merge: true });
      profile = { ...profile, email: user.email };
      currentProfile = profile;
    }
  } catch {
    // Ignorar y seguir con la sesión actual.
  }

  updateAccountUI(user, currentProfile || profile);
})).catch(() => location.replace('login.html?error=firebase'));

window.setInterval(updateSubscriptionCountdown, 60000);
