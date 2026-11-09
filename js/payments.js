import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, authReady, db } from './firebase.js';

const $ = (selector, root = document) => root.querySelector(selector);
const ADMIN_EMAILS = new Set(['santhiagocaro05@gmail.com', 'admin@forma.app']);
const MODEL_IDS = ['Nexus-Premium', 'Nexus-SST', 'Nexus-Sonet', 'Nexus-Astra'];
const MODEL_DEFAULTS = [
  { id: 'Nexus-St', name: 'Nexus-St', providerModel: 'nvidia/nemotron-3.5-lightning:free', tier: 'free', tokenLimit: 0, imageUrl: '', description: '', vision: false, audio: false, enabled: true },
  { id: 'Nexus-Pro', name: 'Nexus-Pro', providerModel: 'nvidia/nemotron-3.5-super-vl:free', tier: 'free', tokenLimit: 0, imageUrl: '', description: '', vision: true, audio: false, enabled: true },
  { id: 'Nexus-Basic', name: 'Nexus-Basic', providerModel: 'liquid/lfm-3-1.7b:free', tier: 'free', tokenLimit: 0, imageUrl: '', description: '', vision: false, audio: false, enabled: true },
  { id: 'Nexus-Premium', name: 'Nexus-Premium', providerModel: 'nvidia/nemotron-3-ultra-550b-a55b:free', tier: 'premium', tokenLimit: 0, imageUrl: '', description: '', enabled: true },
  { id: 'Nexus-SST', name: 'Nexus-SST', providerModel: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', tier: 'premium', tokenLimit: 0, imageUrl: '', description: '', vision: true, audio: true, enabled: true },
  { id: 'Nexus-Sonet', name: 'Nexus-Sonet', providerModel: 'google/gemma-4-31b-it:free', tier: 'premium', tokenLimit: 0, imageUrl: '', description: '', enabled: true },
  { id: 'Nexus-Astra', name: 'Nexus-Astra', providerModel: 'xingchen-agi/xing4.0-29b-a4b:free', tier: 'premium', tokenLimit: 0, imageUrl: '', description: '', enabled: true },
];
const METHOD_NAMES = { paypal: 'PayPal', nequi: 'Nequi', bancolombia: 'Bancolombia' };
const METHOD_DEFAULTS = Object.fromEntries(Object.entries(METHOD_NAMES).map(([id, name]) => [id, {
  id, name, enabled: false, accountName: '', identifier: '', instructions: '', iconUrl: '', iconData: '',
}]));
const PLAN_FEATURE_OPTIONS = [
  { id: 'create', label: 'Crear imágenes' },
  { id: 'edit', label: 'Editar fotos' },
  { id: 'video', label: 'Editar vídeos' },
  { id: 'chat', label: 'Chat IA' },
  { id: 'history', label: 'Historial de conversaciones' },
];
const CORE_PLAN_FEATURES = PLAN_FEATURE_OPTIONS.map(feature => feature.id);
const PLAN_DEFAULTS = [
  { id: 'free', name: 'Gratis', description: 'Empieza a crear sin tarjeta.', price: '0', currency: 'USD', durationDays: 30, monthlyTokens: 500000, badge: 'Siempre', periodLabel: 'siempre', benefits: ['500.000 tokens por ciclo mensual', 'Retoque de foto y recorte local', 'Historial del chat por 5 días', 'Modelos gratis de Nexus'], features: CORE_PLAN_FEATURES, enabled: true, featured: false, backgroundColor: '', backgroundImage: '' },
  { id: 'pro', name: 'Pro', description: 'Más capacidad para trabajar a diario.', price: '90', currency: 'USD', durationDays: 365, monthlyTokens: 2000000, badge: '12 meses', periodLabel: 'año', benefits: ['2.000.000 tokens, se renuevan cada año', 'Modelos premium incluidos', 'Exportación de alta resolución', 'Historial ampliado'], features: CORE_PLAN_FEATURES, enabled: true, featured: true, backgroundColor: '', backgroundImage: '' },
  { id: 'studio', name: 'Estudio', description: 'Un espacio compartido para crear en equipo.', price: '24', currency: 'USD', durationDays: 30, monthlyTokens: 5000000, badge: '30 días', periodLabel: 'mes', benefits: ['5.000.000 tokens por ciclo mensual', 'Modelos premium incluidos', 'Hasta 5 miembros', 'Tokens compartidos por equipo'], features: CORE_PLAN_FEATURES, enabled: true, featured: false, backgroundColor: '', backgroundImage: '' },
  { id: 'premium', name: 'Premium', description: 'Acceso a todos los modelos premium por un periodo fijo.', price: '19', currency: 'USD', durationDays: 30, monthlyTokens: 1500000, badge: '30 días', periodLabel: '30 días', benefits: ['1.500.000 tokens por ciclo', 'Nexus-Premium, SST, Sonet y Astra', 'Ideal para uso intensivo', 'Se puede renovar fácilmente'], features: CORE_PLAN_FEATURES, enabled: true, featured: false, backgroundColor: '', backgroundImage: '' },
  { id: 'rental', name: 'Alquiler', description: 'Compra solo los modelos que quieras por días o por temporada.', price: '6', currency: 'USD', durationDays: 7, monthlyTokens: 2000000, badge: 'Alquiler', periodLabel: '7 días', benefits: ['2.000.000 tokens por cada modelo seleccionado', 'Modelos premium a la carta', 'Sin suscripción anual', 'Flexible y sin permanencia'], features: CORE_PLAN_FEATURES, enabled: true, featured: false, backgroundColor: '', backgroundImage: '' },
  { id: 'model-pack', name: 'Modelos premium', description: 'Acceso por días a los modelos que elijas.', price: '39', currency: 'USD', durationDays: 90, monthlyTokens: 2000000, badge: '90 días', periodLabel: '90 días', benefits: ['2.000.000 tokens para cada modelo', 'Elige Nexus-Premium, SST, Sonet y Astra', 'Flexibilidad total', 'Se renueva al comprar de nuevo'], features: CORE_PLAN_FEATURES, enabled: true, featured: false, backgroundColor: '', backgroundImage: '' },
  { id: 'custom-plan', name: 'Personalizado', description: 'Combina lo que necesitas y recibe una propuesta a medida.', price: '', currency: 'USD', durationDays: 30, monthlyTokens: 500000, badge: 'A tu medida', periodLabel: 'según tu selección', benefits: ['Elige funciones de distintos planes', 'Añade modelos premium a tu solicitud', 'Propón duración y tokens por ciclo', 'El equipo revisa cada solicitud'], features: CORE_PLAN_FEATURES, enabled: true, featured: true, backgroundColor: '', backgroundImage: '' },
];
const TOKEN_PACKAGE_DEFAULTS = [];
const DEFAULT_WEB_CUSTOMIZATION = {
  enabled: true,
  backgroundMode: 'none',
  backgroundUrl: '',
  backgroundVideo: '',
  seasonalEffect: 'none',
  siteName: 'Nexus Forma',
  brandNameEffect: 'shimmer',
  brandMarkEnabled: true,
  brandMarkUrl: '',
  faviconUrl: 'assets/NXF.png',
  chatLogoUrl: '',
  notificationSoundUrl: '',
  decorations: [],
};
const SETTINGS_REF = doc(db, 'appConfig', 'public');
const LOGIN_BRANDING_REF = doc(db, 'appConfig', 'loginBranding');
const DEFAULT_LOGIN_BRANDING = {
  faviconUrl: 'assets/NXF.png',
  panelMode: 'none',
  panelUrl: '',
  panelVideo: '',
  panelData: '',
  pageMode: 'none',
  pageUrl: '',
  pageVideo: '',
  pageData: '',
  pageLinkedToPanel: false,
};

let activeUser = null;
let userProfile = {};
let currentSettings = { models: MODEL_DEFAULTS, paymentMethods: METHOD_DEFAULTS, plans: PLAN_DEFAULTS, planFeatures: PLAN_FEATURE_OPTIONS, comparisonRows: [], tokenPackages: TOKEN_PACKAGE_DEFAULTS, webCustomization: DEFAULT_WEB_CUSTOMIZATION };
let currentLoginBranding = { ...DEFAULT_LOGIN_BRANDING };
let currentPurchase = null;
let adminPayments = [];
let selectedPayment = null;
let adminFeedbackItems = [];
let selectedFeedback = null;
let notificationUnsubscribe = null;
let profileUnsubscribe = null;

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3000);
}

function normalizeSettings(data = {}) {
  const savedModels = Array.isArray(data.models) ? data.models : [];
  const modelMap = new Map(savedModels.map(model => [model.id, model]));
  const models = MODEL_DEFAULTS.map(model => ({ ...model, ...(modelMap.get(model.id) || {}) }));
  for (const model of savedModels) {
    if (!model?.id || MODEL_DEFAULTS.some(item => item.id === model.id)) continue;
    models.push({
      id: model.id, name: model.name || model.id, providerModel: model.providerModel || '', provider: model.provider || 'openrouter',
      tier: model.tier || 'free', tokenLimit: Number(model.tokenLimit) || 0,
      imageUrl: model.imageUrl || '', description: model.description || '', vision: model.vision === true,
      audio: model.audio === true, enabled: model.enabled !== false,
    });
  }
  const rawMethods = Array.isArray(data.paymentMethods)
    ? Object.fromEntries(data.paymentMethods.filter(method => method?.id).map(method => [method.id, method]))
    : data.paymentMethods || {};
  const paymentMethods = {};
  for (const id of new Set([...Object.keys(METHOD_DEFAULTS), ...Object.keys(rawMethods)])) {
    paymentMethods[id] = {
      ...(METHOD_DEFAULTS[id] || { id, name: id, enabled: false, accountName: '', identifier: '', instructions: '', iconUrl: '', iconData: '' }),
      ...(rawMethods[id] || {}),
      id,
      name: rawMethods[id]?.name || METHOD_DEFAULTS[id]?.name || id,
    };
  }
  const planFeatureMap = new Map(PLAN_FEATURE_OPTIONS.map(feature => [feature.id, feature]));
  if (Array.isArray(data.planFeatures)) {
    for (const feature of data.planFeatures) {
      if (!feature || !/^custom-[a-z0-9][a-z0-9-]{0,47}$/.test(feature.id || '') || typeof feature.label !== 'string') continue;
      const label = feature.label.trim().slice(0, 64);
      if (label) planFeatureMap.set(feature.id, {id: feature.id, label});
    }
  }
  const planFeatures = [...planFeatureMap.values()];
  const planFeatureIds = new Set(planFeatures.map(feature => feature.id));
  const savedPlans = Array.isArray(data.plans) ? data.plans : [];
  const planMap = new Map(savedPlans.map(plan => [plan.id, plan]));
  const plans = PLAN_DEFAULTS.map(plan => {
    const savedPlan = planMap.get(plan.id) || {};
    return {
      ...plan,
      ...savedPlan,
      discountPercent: Math.max(0, Math.min(90, Number.parseInt(savedPlan.discountPercent, 10) || 0)),
      backgroundImage: safeHttpsUrl(savedPlan.backgroundImage || ''),
      backgroundVideo: safeHttpsUrl(savedPlan.backgroundVideo || ''),
      features: Array.isArray(savedPlan.features)
        ? savedPlan.features.filter(feature => planFeatureIds.has(feature))
        : plan.features,
    };
  });
  for (const savedPlan of savedPlans) {
    if (!savedPlan?.id || PLAN_DEFAULTS.some(plan => plan.id === savedPlan.id)) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(savedPlan.id)) continue;
    plans.push({
      id: savedPlan.id,
      name: String(savedPlan.name || 'Nuevo plan').slice(0, 60),
      description: String(savedPlan.description || '').slice(0, 220),
      price: String(savedPlan.price ?? ''),
      currency: ['USD', 'COP', 'ARS'].includes(savedPlan.currency) ? savedPlan.currency : 'ARS',
      durationDays: Math.max(1, Math.min(3650, Number.parseInt(savedPlan.durationDays, 10) || 30)),
      monthlyTokens: Math.max(0, Math.min(100_000_000, Number.parseInt(savedPlan.monthlyTokens, 10) || 0)),
      badge: String(savedPlan.badge || '').slice(0, 40),
      periodLabel: String(savedPlan.periodLabel || '').slice(0, 40),
      benefits: Array.isArray(savedPlan.benefits) ? savedPlan.benefits.filter(item => typeof item === 'string').slice(0, 12) : [],
      features: Array.isArray(savedPlan.features) ? savedPlan.features.filter(feature => planFeatureIds.has(feature)) : CORE_PLAN_FEATURES,
      enabled: savedPlan.enabled === true,
      featured: savedPlan.featured === true,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(savedPlan.backgroundColor || '') ? savedPlan.backgroundColor : '',
      backgroundImage: safeHttpsUrl(savedPlan.backgroundImage || ''),
      backgroundVideo: safeHttpsUrl(savedPlan.backgroundVideo || ''),
      discountPercent: Math.max(0, Math.min(90, Number.parseInt(savedPlan.discountPercent, 10) || 0)),
    });
  }
  const planIds = new Set(plans.map(plan => plan.id));
  const comparisonRows = (Array.isArray(data.comparisonRows) ? data.comparisonRows : [])
    .filter(row => row && typeof row.label === 'string' && row.label.trim())
    .slice(0, 20)
    .map((row, index) => {
      const values = {};
      if (row.values && typeof row.values === 'object' && !Array.isArray(row.values)) {
        for (const planId of planIds) {
          if (typeof row.values[planId] === 'string') values[planId] = row.values[planId].slice(0, 160);
        }
      }
      return {
        id: String(row.id || `comparison-${index + 1}`).slice(0, 64),
        label: row.label.trim().slice(0, 60),
        values,
      };
    });
  const savedTokenPackages = Array.isArray(data.tokenPackages) ? data.tokenPackages : TOKEN_PACKAGE_DEFAULTS;
  const tokenPackages = savedTokenPackages
    .filter(item => item && /^[a-z0-9][a-z0-9-]{0,47}$/.test(item.id || ''))
    .map(item => ({
      id: item.id,
      name: String(item.name || 'Paquete de tokens').slice(0, 60),
      description: String(item.description || '').slice(0, 180),
      tokenAmount: Math.max(1000, Math.min(50_000_000, Number.parseInt(item.tokenAmount, 10) || 1000)),
      price: String(item.price ?? ''),
      currency: ['ARS', 'USD', 'COP'].includes(item.currency) ? item.currency : 'ARS',
      enabled: item.enabled === true,
      backgroundImage: safeHttpsUrl(item.backgroundImage || ''),
      backgroundVideo: safeHttpsUrl(item.backgroundVideo || ''),
    }));
  const savedCustomization = data.webCustomization || data.personalization || {};
  return { models, paymentMethods, plans, planFeatures, comparisonRows, tokenPackages, webCustomization: normalizeWebCustomization(savedCustomization) };
}

function paidModelIds() {
  const configured = currentSettings.models
    .filter(model => model.enabled !== false && model.tier !== 'free')
    .map(model => model.id);
  return configured.length ? configured : MODEL_IDS;
}

function activeProductId(profile = {}) {
  const expiry = profile.expiresAt?.toDate?.() || (profile.expiresAt ? new Date(profile.expiresAt) : null);
  if (expiry && expiry.getTime() <= Date.now()) return 'free';
  if (profile.planId) return profile.planId;
  return ({ Gratis: 'free', Pro: 'pro', Estudio: 'studio', Premium: 'premium', Alquiler: 'rental' })[profile.plan] || 'free';
}

function updatePlanCards(profile = {}) {
  const activeId = activeProductId(profile);
  document.querySelectorAll('[data-plan-card]').forEach(card => {
    const acquired = card.dataset.planCard === activeId;
    card.classList.toggle('is-acquired', acquired);
    const badge = card.querySelector('.plan-acquired-state');
    if (badge) badge.hidden = !acquired;
    const purchaseButton = card.querySelector('[data-buy-plan]');
    const currentButton = card.querySelector('#currentPlan');
    if (purchaseButton) {
      purchaseButton.disabled = acquired;
      purchaseButton.textContent = acquired ? 'Adquirido' : 'Enviar comprobante';
    }
    if (currentButton) currentButton.textContent = acquired ? 'Plan actual' : 'Gratis';
  });
}

function effectivePlanPrice(plan) {
  const price = Math.max(0, Number(plan.price) || 0);
  const discount = Math.max(0, Math.min(90, Number(plan.discountPercent) || 0));
  return Number((price * (100 - discount) / 100).toFixed(2));
}

function formatPlanPrice(plan, price = effectivePlanPrice(plan)) {
  const currencyPrefix = plan.currency === 'USD' ? '$' : plan.currency === 'COP' ? 'COP $' : plan.currency === 'ARS' ? 'ARS $' : `${plan.currency} `;
  return `${currencyPrefix}${price.toLocaleString('es-AR', {minimumFractionDigits: Number.isInteger(price) ? 0 : 2, maximumFractionDigits: 2})}`;
}

function initializePlanCardMotion() {
  const supportsPointerMotion = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!supportsPointerMotion || prefersReducedMotion) return;

  document.querySelectorAll('.plan').forEach(card => {
    card.addEventListener('pointermove', event => {
      const bounds = card.getBoundingClientRect();
      const horizontal = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const vertical = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      const rotateX = (0.5 - vertical) * 7;
      const rotateY = (horizontal - 0.5) * 8;
      card.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
}

function safeHttpsUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function normalizeWebCustomization(data = {}) {
  const decorations = Array.isArray(data.decorations) ? data.decorations : [];
  return {
    enabled: data.enabled !== false,
    backgroundMode: ['none', 'image', 'video'].includes(data.backgroundMode) ? data.backgroundMode : 'none',
    backgroundUrl: safeHttpsUrl(data.backgroundUrl || data.imageUrl || ''),
    backgroundVideo: safeHttpsUrl(data.backgroundVideo || data.videoUrl || ''),
    seasonalEffect: ['none', 'snow', 'halloween'].includes(data.seasonalEffect) ? data.seasonalEffect : 'none',
    siteName: String(data.siteName || DEFAULT_WEB_CUSTOMIZATION.siteName).trim().slice(0, 40),
    brandNameEffect: ['none', 'gradient', 'shimmer', 'glow'].includes(data.brandNameEffect) ? data.brandNameEffect : 'shimmer',
    brandMarkEnabled: data.brandMarkEnabled !== false,
    brandMarkUrl: safeHttpsUrl(data.brandMarkUrl || ''),
    faviconUrl: safeHttpsUrl(data.faviconUrl || '') || 'assets/NXF.png',
    chatLogoUrl: safeHttpsUrl(data.chatLogoUrl || ''),
    notificationSoundUrl: safeHttpsUrl(data.notificationSoundUrl || ''),
    decorations: decorations
      .map((item, index) => {
        const imageUrl = safeHttpsUrl(item?.imageUrl || item?.url || item?.src || '');
        if (!imageUrl) return null;
        return {
          id: item?.id || `decoration-${index}-${Date.now()}`,
          imageUrl,
          title: String(item?.title || `Decoración ${index + 1}`).slice(0, 40),
        };
      })
      .filter(Boolean)
      .slice(0, 12),
  };
}

function normalizeLoginBranding(data = {}) {
  const validData = value => typeof value === 'string'
    && value.length <= 700000
    && /^data:(?:image\/webp|video\/webm);base64,[A-Za-z0-9+/=]+$/.test(value)
    ? value
    : '';
  const legacyMode = ['none', 'image', 'video'].includes(data.backgroundMode) ? data.backgroundMode : 'none';
  const legacyTarget = ['visual', 'page', 'both'].includes(data.backgroundTarget) ? data.backgroundTarget : 'both';
  const legacyData = validData(data.backgroundData);
  const legacyPanel = legacyTarget === 'visual' || legacyTarget === 'both';
  const legacyPage = legacyTarget === 'page' || legacyTarget === 'both';
  const duplicateLegacyData = !legacyData || !legacyPanel || !legacyPage || legacyData.length * 2 <= 700000;
  const panelMode = ['none', 'image', 'video'].includes(data.panelMode) ? data.panelMode : (legacyPanel ? legacyMode : 'none');
  const pageMode = ['none', 'image', 'video'].includes(data.pageMode) ? data.pageMode : (legacyPage ? legacyMode : 'none');
  const panelData = validData(data.panelData) || (legacyPanel ? legacyData : '');
  const pageLinkedToPanel = data.pageLinkedToPanel === true || Boolean(legacyData && legacyPanel && legacyPage && !duplicateLegacyData && !data.pageData);
  const pageData = validData(data.pageData) || (legacyPage && duplicateLegacyData ? legacyData : '');
  return {
    faviconUrl: safeHttpsUrl(data.faviconUrl || '') || 'assets/NXF.png',
    panelMode,
    panelUrl: safeHttpsUrl(data.panelUrl || (legacyPanel ? data.backgroundUrl : '') || ''),
    panelVideo: safeHttpsUrl(data.panelVideo || (legacyPanel ? data.backgroundVideo : '') || ''),
    panelData,
    pageMode,
    pageUrl: safeHttpsUrl(data.pageUrl || (legacyPage ? data.backgroundUrl : '') || ''),
    pageVideo: safeHttpsUrl(data.pageVideo || (legacyPage ? data.backgroundVideo : '') || ''),
    pageData,
    pageLinkedToPanel,
  };
}

function youtubeVideoEmbedUrl(value) {
  const safeValue = safeHttpsUrl(value);
  if (!safeValue) return '';
  const match = safeValue.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!match) return safeValue;
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}&controls=0&rel=0`;
}

function applyWebCustomization() {
  const config = currentSettings.webCustomization || DEFAULT_WEB_CUSTOMIZATION;
  const siteName = config.siteName || DEFAULT_WEB_CUSTOMIZATION.siteName;
  document.querySelectorAll('[data-brand-name]').forEach(node => {
    node.textContent = siteName;
    node.classList.remove('brand-effect-none', 'brand-effect-gradient', 'brand-effect-shimmer', 'brand-effect-glow');
    node.classList.add(`brand-effect-${config.brandNameEffect || 'shimmer'}`);
  });
  document.title = `${siteName} — Estudio creativo con IA`;
  document.querySelectorAll('[data-brand-mark]').forEach(mark => {
    mark.hidden = config.brandMarkEnabled === false;
    const defaultIcon = mark.querySelector('[data-brand-default-icon]');
    let customIcon = mark.querySelector('.site-brand-image');
    if (config.brandMarkUrl) {
      if (!customIcon) {
        customIcon = document.createElement('img');
        customIcon.className = 'site-brand-image';
        customIcon.alt = '';
        mark.append(customIcon);
      }
      customIcon.src = config.brandMarkUrl;
      if (defaultIcon) defaultIcon.hidden = true;
    } else {
      customIcon?.remove();
      if (defaultIcon) defaultIcon.hidden = false;
    }
  });
  const favicon = document.querySelector('#siteFavicon');
  if (favicon) favicon.href = currentLoginBranding.faviconUrl || config.faviconUrl || 'assets/NXF.png';
  window.dispatchEvent(new CustomEvent('web-customization-updated', {detail: config}));
  const media = document.getElementById('siteBackgroundMedia') || document.createElement('div');
  media.id = 'siteBackgroundMedia';
  media.className = 'site-background-media';
  if (!media.parentElement) document.body.appendChild(media);

  const season = document.getElementById('siteSeasonOverlay') || document.createElement('div');
  season.id = 'siteSeasonOverlay';
  season.className = 'site-season-overlay';
  if (!season.parentElement) document.body.appendChild(season);

  const decorations = document.getElementById('siteDecorationLayer') || document.createElement('div');
  decorations.id = 'siteDecorationLayer';
  decorations.className = 'site-decoration-layer';
  if (!decorations.parentElement) document.body.appendChild(decorations);

  const enabled = config.enabled !== false;
  const backgroundMode = config.backgroundMode || 'none';
  const decorationItems = Array.isArray(config.decorations) ? config.decorations : [];

  media.classList.remove('is-image', 'is-video');
  media.style.backgroundImage = '';
  media.innerHTML = '';
  media.style.display = 'none';

  if (enabled && backgroundMode === 'image' && config.backgroundUrl) {
    media.classList.add('is-image');
    media.style.backgroundImage = `url("${config.backgroundUrl}")`;
    media.style.display = 'block';
  }

  if (enabled && backgroundMode === 'video') {
    const videoUrl = youtubeVideoEmbedUrl(config.backgroundVideo || config.backgroundUrl || '');
    if (videoUrl) {
      media.classList.add('is-video');
      media.style.display = 'block';
      const isYoutube = /youtube\.com|youtu\.be/.test(videoUrl);
      if (isYoutube) {
        const iframe = document.createElement('iframe');
        iframe.src = videoUrl;
        iframe.title = 'Fondo de video';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        media.appendChild(iframe);
      } else {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        media.appendChild(video);
      }
    }
  }

  const effect = ['none', 'snow', 'halloween'].includes(config.seasonalEffect) ? config.seasonalEffect : 'none';
  season.classList.remove('active', 'snow', 'halloween');
  season.removeAttribute('aria-hidden');
  season.replaceChildren();
  if (enabled && effect !== 'none') {
    season.classList.add('active', effect);
    const particleCount = effect === 'snow' ? 26 : 18;
    const glyph = effect === 'snow' ? '❄' : '🎃';
    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'particle';
      particle.textContent = glyph;
      particle.style.setProperty('--left', `${(index * 100 / particleCount) + (Math.random() * 8 - 4)}%`);
      particle.style.setProperty('--size', `${(Math.random() * 1.4 + 0.8).toFixed(2)}rem`);
      particle.style.setProperty('--duration', `${(Math.random() * 12 + 9).toFixed(2)}s`);
      particle.style.setProperty('--delay', `${(Math.random() * -12).toFixed(2)}s`);
      season.appendChild(particle);
    }
  }

  decorations.replaceChildren();
  if (enabled && decorationItems.length) {
    decorationItems.forEach((item, index) => {
      const node = document.createElement('div');
      node.className = 'site-decoration-item';
      const left = 4 + (index % 4) * 22;
      const top = 8 + Math.floor(index / 4) * 26;
      node.style.left = `${left}%`;
      node.style.top = `${top}%`;
      const image = document.createElement('img');
      image.src = item.imageUrl;
      image.alt = item.title || `Decoración ${index + 1}`;
      image.loading = 'lazy';
      node.appendChild(image);
      decorations.appendChild(node);
    });
  }
}

function setAdminTab(tab) {
  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    const selected = button.dataset.adminTab === tab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('[data-admin-view]').forEach(view => {
    const selected = view.dataset.adminView === tab;
    view.classList.toggle('active', selected);
    view.hidden = !selected;
  });
  if (tab === 'payments') loadAdminPayments();
  if (tab === 'feedback') loadAdminFeedback();
}

function compressLoginBackgroundImage(file, maxCharacters = 640000) {
  return new Promise((resolve, reject) => {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      reject(new Error('Elige JPG, PNG o WebP de hasta 15 MB.'));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      let scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      while (scale >= 0.2) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) break;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
          const data = canvas.toDataURL('image/webp', quality);
          if (data.startsWith('data:image/webp;base64,') && data.length <= maxCharacters) {
            URL.revokeObjectURL(objectUrl);
            resolve(data);
            return;
          }
        }
        scale *= 0.75;
      }
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo comprimir la imagen para guardarla en Firestore.'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo abrir la imagen seleccionada.'));
    };
    image.src = objectUrl;
  });
}

function compressLoginBackgroundVideo(file, maxCharacters = 650000) {
  return new Promise((resolve, reject) => {
    if (!file || !['video/mp4', 'video/webm'].includes(file.type) || file.size > 50 * 1024 * 1024) {
      reject(new Error('Elige un MP4 o WebM de hasta 50 MB.'));
      return;
    }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      reject(new Error('Este navegador no puede comprimir video. Prueba Chrome o Edge.'));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.append(video);
    const cleanup = stream => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      stream?.getTracks().forEach(track => track.stop());
      URL.revokeObjectURL(objectUrl);
    };
    video.addEventListener('loadeddata', async () => {
      if (!Number.isFinite(video.duration) || !video.videoWidth || !video.videoHeight) {
        cleanup();
        reject(new Error('No se pudo leer la duración o el tamaño del video.'));
        return;
      }
      const duration = Math.min(6, video.duration);
      const maxBlobBytes = Math.max(0, Math.floor((maxCharacters - 64) * 0.75));
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.floor(video.videoWidth * scale / 2) * 2);
      canvas.height = Math.max(2, Math.floor(video.videoHeight * scale / 2) * 2);
      const context = canvas.getContext('2d');
      const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!context || !mimeType) {
        cleanup();
        reject(new Error('Este navegador no admite comprimir video WebM.'));
        return;
      }
      const stream = canvas.captureStream(20);
      const recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond: 220000});
      const chunks = [];
      const recording = new Promise((resolveRecording, rejectRecording) => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => rejectRecording(new Error('No se pudo comprimir el video.'));
        recorder.onstop = () => resolveRecording(new Blob(chunks, {type: 'video/webm'}));
      });
      let frameTimer = 0;
      const draw = () => {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (video.currentTime >= duration || video.ended) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        frameTimer = setTimeout(draw, 50);
      };
      try {
        recorder.start(250);
        await video.play();
        draw();
        const blob = await recording;
        if (blob.size > maxBlobBytes) throw new Error('El video comprimido supera el espacio disponible en Firestore. Reduce la duración o el tamaño del otro fondo.');
        const reader = new FileReader();
        const data = await new Promise((resolveData, rejectData) => {
          reader.onload = () => resolveData(String(reader.result || ''));
          reader.onerror = () => rejectData(new Error('No se pudo preparar el video.'));
          reader.readAsDataURL(blob);
        });
        if (data.length > maxCharacters) throw new Error('El video comprimido supera el espacio disponible en Firestore. Reduce la duración o el tamaño del otro fondo.');
        clearTimeout(frameTimer);
        cleanup(stream);
        resolve(data);
      } catch (error) {
        clearTimeout(frameTimer);
        if (recorder.state !== 'inactive') recorder.stop();
        cleanup(stream);
        reject(error);
      }
    }, {once: true});
    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('No se pudo abrir el video seleccionado.'));
    }, {once: true});
    video.src = objectUrl;
    video.load();
  });
}

function renderWebCustomizationSettings() {
  const container = $('#adminWebCustomizationConfig');
  if (!container) return;
  const config = currentSettings.webCustomization || DEFAULT_WEB_CUSTOMIZATION;
  container.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'admin-customization-panel';
  panel.innerHTML = `
    <div class="admin-customization-grid">
      <label class="admin-customization-field">
        Personalización activa
        <select id="webCustomizationEnabled">
          <option value="true" ${config.enabled !== false ? 'selected' : ''}>Activada</option>
          <option value="false" ${config.enabled === false ? 'selected' : ''}>Desactivada</option>
        </select>
      </label>
      <label class="admin-customization-field">
        Tipo de fondo
        <select id="webCustomizationBackgroundMode">
          <option value="none" ${config.backgroundMode === 'none' ? 'selected' : ''}>Sin fondo</option>
          <option value="image" ${config.backgroundMode === 'image' ? 'selected' : ''}>Imagen</option>
          <option value="video" ${config.backgroundMode === 'video' ? 'selected' : ''}>Video</option>
        </select>
      </label>
      <label class="admin-customization-field">
        Enlace de imagen de fondo
        <input id="webCustomizationBackgroundUrl" type="url" value="${(config.backgroundUrl || '').replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">
        Enlace de video (YouTube o .mp4)
        <input id="webCustomizationVideoUrl" type="url" value="${(config.backgroundVideo || '').replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">
        Efecto estacional
        <select id="webCustomizationSeasonalEffect">
          <option value="none" ${config.seasonalEffect === 'none' ? 'selected' : ''}>Ninguno</option>
          <option value="snow" ${config.seasonalEffect === 'snow' ? 'selected' : ''}>Nieve</option>
          <option value="halloween" ${config.seasonalEffect === 'halloween' ? 'selected' : ''}>Calabazas</option>
        </select>
      </label>
      <label class="admin-customization-field">Nombre de la web
        <input id="webCustomizationSiteName" maxlength="40" value="${config.siteName.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" placeholder="Nexus Forma">
      </label>
      <label class="admin-customization-field">Efecto del nombre
        <select id="webCustomizationBrandEffect">
          <option value="none" ${config.brandNameEffect === 'none' ? 'selected' : ''}>Sin efecto</option>
          <option value="gradient" ${config.brandNameEffect === 'gradient' ? 'selected' : ''}>Degradado</option>
          <option value="shimmer" ${config.brandNameEffect === 'shimmer' ? 'selected' : ''}>Brillo animado</option>
          <option value="glow" ${config.brandNameEffect === 'glow' ? 'selected' : ''}>Resplandor</option>
        </select>
      </label>
      <label class="admin-customization-field">Mostrar icono de marca
        <select id="webCustomizationBrandMarkEnabled">
          <option value="true" ${config.brandMarkEnabled ? 'selected' : ''}>Sí</option>
          <option value="false" ${!config.brandMarkEnabled ? 'selected' : ''}>No</option>
        </select>
      </label>
      <label class="admin-customization-field">Icono de marca (URL)
        <input id="webCustomizationBrandMarkUrl" type="url" value="${config.brandMarkUrl.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">Favicon (URL, vacío usa assets/NXF.png)
        <input id="webCustomizationFaviconUrl" type="url" value="${config.faviconUrl === 'assets/NXF.png' ? '' : config.faviconUrl.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <div class="admin-customization-section-title"><strong>Fondo del panel visual</strong><small>Independiente del fondo de toda la página.</small></div>
      <label class="admin-customization-field">Tipo de fondo del panel
        <select id="loginPanelBackgroundMode">
          <option value="none" ${currentLoginBranding.panelMode === 'none' ? 'selected' : ''}>Sin fondo personalizado</option>
          <option value="image" ${currentLoginBranding.panelMode === 'image' ? 'selected' : ''}>Foto</option>
          <option value="video" ${currentLoginBranding.panelMode === 'video' ? 'selected' : ''}>Video</option>
        </select>
      </label>
      <label class="admin-customization-field">Foto del panel por URL
        <input id="loginPanelBackgroundUrl" type="url" value="${currentLoginBranding.panelUrl.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">Video del panel por URL (YouTube o MP4/WebM)
        <input id="loginPanelBackgroundVideo" type="url" value="${currentLoginBranding.panelVideo.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">Subir fondo del panel desde el equipo
        <input id="loginPanelBackgroundFile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm">
      </label>
      <small class="admin-customization-upload-status" id="loginPanelBackgroundStatus">${currentLoginBranding.pageLinkedToPanel ? 'Recurso compartido con el fondo de página (configuración anterior).' : currentLoginBranding.panelData ? (currentLoginBranding.panelData.startsWith('data:video/') ? 'Video local listo · primeros 6 segundos · WebM' : 'Foto local lista · comprimida como WebP') : 'Imagen WebP o video WebM corto. El espacio se comparte con el fondo de página por el límite de Firestore.'}</small>
      <div class="admin-customization-section-title"><strong>Fondo de toda la página</strong><small>Puedes usar un video aquí y una foto distinta en el panel.</small></div>
      <label class="admin-customization-field">Tipo de fondo de página
        <select id="loginPageBackgroundMode">
          <option value="none" ${currentLoginBranding.pageMode === 'none' ? 'selected' : ''}>Sin fondo personalizado</option>
          <option value="image" ${currentLoginBranding.pageMode === 'image' ? 'selected' : ''}>Foto</option>
          <option value="video" ${currentLoginBranding.pageMode === 'video' ? 'selected' : ''}>Video</option>
        </select>
      </label>
      <label class="admin-customization-field">Foto de página por URL
        <input id="loginPageBackgroundUrl" type="url" value="${currentLoginBranding.pageUrl.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">Video de página por URL (YouTube o MP4/WebM)
        <input id="loginPageBackgroundVideo" type="url" value="${currentLoginBranding.pageVideo.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">Subir fondo de página desde el equipo
        <input id="loginPageBackgroundFile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm">
      </label>
      <small class="admin-customization-upload-status" id="loginPageBackgroundStatus">${currentLoginBranding.pageLinkedToPanel ? 'Usa el mismo recurso del panel (configuración anterior).' : currentLoginBranding.pageData ? (currentLoginBranding.pageData.startsWith('data:video/') ? 'Video local listo · primeros 6 segundos · WebM' : 'Foto local lista · comprimida como WebP') : 'Imagen WebP o video WebM corto. El espacio se comparte con el fondo del panel por el límite de Firestore.'}</small>
      <label class="admin-customization-field">Logo del asistente en el chat (URL)
        <input id="webCustomizationChatLogoUrl" type="url" value="${config.chatLogoUrl.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <label class="admin-customization-field">Sonido de notificación (URL MP3/MP4 o YouTube)
        <input id="webCustomizationNotificationSoundUrl" type="url" value="${config.notificationSoundUrl.replace(/"/g, '&quot;')}" placeholder="https://...">
      </label>
      <button class="btn admin-sound-preview" id="previewNotificationSound" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg>Probar sonido</button>
    </div>
    <div class="admin-customization-decorations">
      <div class="admin-customization-head">
        <h4>Decoraciones</h4>
        <button class="btn" id="addWebDecoration" type="button">Agregar imagen</button>
      </div>
      <div class="admin-decoration-adder">
        <input id="webDecorationAdder" type="url" placeholder="https://ejemplo.com/imagen.jpg">
        <button class="btn primary" id="confirmWebDecoration" type="button">Añadir</button>
      </div>
      <div id="webDecorationList" class="admin-decoration-list"></div>
    </div>
  `;
  container.append(panel);

  for (const surface of ['panel', 'page']) {
    const mode = document.getElementById(`login${surface === 'panel' ? 'Panel' : 'Page'}BackgroundMode`);
    const imageUrl = document.getElementById(`login${surface === 'panel' ? 'Panel' : 'Page'}BackgroundUrl`);
    const videoUrl = document.getElementById(`login${surface === 'panel' ? 'Panel' : 'Page'}BackgroundVideo`);
    const fileInput = document.getElementById(`login${surface === 'panel' ? 'Panel' : 'Page'}BackgroundFile`);
    const status = document.getElementById(`login${surface === 'panel' ? 'Panel' : 'Page'}BackgroundStatus`);
    const dataField = `${surface}Data`;
    mode?.addEventListener('change', () => {
      if (surface === 'page') currentLoginBranding.pageLinkedToPanel = false;
      else if (currentLoginBranding.pageLinkedToPanel) currentLoginBranding.pageMode = mode.value;
    });
    imageUrl?.addEventListener('input', () => {
      if (imageUrl.value.trim()) {
        currentLoginBranding[dataField] = '';
        if (surface === 'page') currentLoginBranding.pageLinkedToPanel = false;
        else if (currentLoginBranding.pageLinkedToPanel) currentLoginBranding.pageUrl = imageUrl.value.trim();
      }
    });
    videoUrl?.addEventListener('input', () => {
      if (videoUrl.value.trim()) {
        currentLoginBranding[dataField] = '';
        if (surface === 'page') currentLoginBranding.pageLinkedToPanel = false;
        else if (currentLoginBranding.pageLinkedToPanel) currentLoginBranding.pageVideo = videoUrl.value.trim();
      }
    });
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      status.textContent = 'Comprimiendo archivo en este navegador…';
      fileInput.disabled = true;
      try {
        const isImage = file.type.startsWith('image/');
        const otherData = surface === 'panel' ? currentLoginBranding.pageData : currentLoginBranding.panelData;
        const linkedData = surface === 'panel' && currentLoginBranding.pageLinkedToPanel ? 0 : otherData.length;
        const dataBudget = Math.max(0, 700000 - linkedData);
        const backgroundData = isImage
          ? await compressLoginBackgroundImage(file, Math.min(640000, dataBudget))
          : await compressLoginBackgroundVideo(file, Math.min(650000, dataBudget));
        currentLoginBranding[`${surface}Mode`] = isImage ? 'image' : 'video';
        currentLoginBranding[`${surface}Url`] = '';
        currentLoginBranding[`${surface}Video`] = '';
        currentLoginBranding[dataField] = backgroundData;
        if (surface === 'page') currentLoginBranding.pageLinkedToPanel = false;
        else if (currentLoginBranding.pageLinkedToPanel) {
          currentLoginBranding.pageMode = currentLoginBranding.panelMode;
          currentLoginBranding.pageUrl = '';
          currentLoginBranding.pageVideo = '';
        }
        mode.value = currentLoginBranding[`${surface}Mode`];
        imageUrl.value = '';
        videoUrl.value = '';
        status.textContent = isImage
          ? `Foto lista · WebP · ${(backgroundData.length / 1024).toFixed(0)} KB`
          : `Video listo · WebM · ${(backgroundData.length / 1024).toFixed(0)} KB`;
      } catch (error) {
        status.textContent = error.message || 'No se pudo preparar el archivo.';
      } finally {
        fileInput.disabled = false;
      }
    });
  }

  const decorationList = document.getElementById('webDecorationList');
  const addDecorationButton = document.getElementById('addWebDecoration');
  const confirmDecorationButton = document.getElementById('confirmWebDecoration');
  const input = document.getElementById('webDecorationAdder');
  document.getElementById('previewNotificationSound')?.addEventListener('click', () => {
    playNotificationSound(document.getElementById('webCustomizationNotificationSoundUrl')?.value || '');
  });

  const renderDecorationList = () => {
    const list = document.getElementById('webDecorationList');
    if (!list) return;
    list.replaceChildren();
    if (!currentSettings.webCustomization.decorations.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-decoration-placeholder';
      empty.textContent = 'Todavía no hay decoraciones. Añade enlaces para previsualizar la web.';
      list.appendChild(empty);
      return;
    }
    for (const [index, item] of currentSettings.webCustomization.decorations.entries()) {
      const card = document.createElement('article');
      card.className = 'admin-decoration-item';
      card.draggable = true;
      card.dataset.index = String(index);
      card.addEventListener('dragstart', event => { event.dataTransfer?.setData('text/plain', String(index)); });
      card.addEventListener('dragover', event => event.preventDefault());
      card.addEventListener('drop', event => {
        event.preventDefault();
        const original = Number(event.dataTransfer?.getData('text/plain') ?? index);
        if (Number.isNaN(original) || original === index) return;
        const items = [...currentSettings.webCustomization.decorations];
        const [moved] = items.splice(original, 1);
        items.splice(index, 0, moved);
        currentSettings.webCustomization.decorations = items;
        renderWebCustomizationSettings();
      });

      const image = document.createElement('img');
      image.src = item.imageUrl;
      image.alt = item.title || `Decoración ${index + 1}`;
      image.loading = 'lazy';

      const text = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = item.title || `Decoración ${index + 1}`;
      const small = document.createElement('span');
      small.textContent = 'Arrastra para ordenar';
      text.append(strong, small);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'admin-decoration-remove';
      remove.title = 'Eliminar';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        currentSettings.webCustomization.decorations.splice(index, 1);
        renderWebCustomizationSettings();
      });

      card.append(image, text, remove);
      list.appendChild(card);
    }
  };

  addDecorationButton?.addEventListener('click', () => {
    input?.focus();
  });
  confirmDecorationButton?.addEventListener('click', () => {
    const value = (input?.value || '').trim();
    const imageUrl = safeHttpsUrl(value);
    if (!imageUrl) {
      toast('Pega una URL válida para la decoración.');
      return;
    }
    currentSettings.webCustomization.decorations = [
      ...(currentSettings.webCustomization.decorations || []),
      { id: `decoration-${Date.now()}`, imageUrl, title: `Decoración ${currentSettings.webCustomization.decorations.length + 1}` },
    ];
    input.value = '';
    renderWebCustomizationSettings();
  });

  renderDecorationList();
}

function readWebCustomizationSettings() {
  const enabled = document.getElementById('webCustomizationEnabled')?.value === 'true';
  const mode = document.getElementById('webCustomizationBackgroundMode')?.value || 'none';
  const seasonalEffect = document.getElementById('webCustomizationSeasonalEffect')?.value || 'none';
  const backgroundUrl = safeHttpsUrl(document.getElementById('webCustomizationBackgroundUrl')?.value || '');
  const backgroundVideo = safeHttpsUrl(document.getElementById('webCustomizationVideoUrl')?.value || '');
  return {
    enabled,
    backgroundMode: ['none', 'image', 'video'].includes(mode) ? mode : 'none',
    backgroundUrl,
    backgroundVideo,
    seasonalEffect: ['none', 'snow', 'halloween'].includes(seasonalEffect) ? seasonalEffect : 'none',
    siteName: (document.getElementById('webCustomizationSiteName')?.value || 'Nexus Forma').trim().slice(0, 40) || 'Nexus Forma',
    brandNameEffect: document.getElementById('webCustomizationBrandEffect')?.value || 'shimmer',
    brandMarkEnabled: document.getElementById('webCustomizationBrandMarkEnabled')?.value !== 'false',
    brandMarkUrl: safeHttpsUrl(document.getElementById('webCustomizationBrandMarkUrl')?.value || ''),
    faviconUrl: safeHttpsUrl(document.getElementById('webCustomizationFaviconUrl')?.value || '') || 'assets/NXF.png',
    chatLogoUrl: safeHttpsUrl(document.getElementById('webCustomizationChatLogoUrl')?.value || ''),
    notificationSoundUrl: safeHttpsUrl(document.getElementById('webCustomizationNotificationSoundUrl')?.value || ''),
    decorations: Array.isArray(currentSettings.webCustomization?.decorations) ? currentSettings.webCustomization.decorations : [],
  };
}

function readLoginBrandingSettings(faviconUrl) {
  const panelMode = document.getElementById('loginPanelBackgroundMode')?.value || 'none';
  const panelUrl = safeHttpsUrl(document.getElementById('loginPanelBackgroundUrl')?.value || '');
  const panelVideo = safeHttpsUrl(document.getElementById('loginPanelBackgroundVideo')?.value || '');
  const pageMode = document.getElementById('loginPageBackgroundMode')?.value || 'none';
  const pageUrl = safeHttpsUrl(document.getElementById('loginPageBackgroundUrl')?.value || '');
  const pageVideo = safeHttpsUrl(document.getElementById('loginPageBackgroundVideo')?.value || '');
  let panelData = currentLoginBranding.panelData || '';
  let pageData = currentLoginBranding.pageData || '';
  const pageLinkedToPanel = currentLoginBranding.pageLinkedToPanel === true;
  if ((panelMode === 'image' && panelUrl) || (panelMode === 'video' && panelVideo)) panelData = '';
  if ((pageMode === 'image' && pageUrl) || (pageMode === 'video' && pageVideo) || pageLinkedToPanel) pageData = '';
  return normalizeLoginBranding({
    faviconUrl: safeHttpsUrl(faviconUrl || '') || 'assets/NXF.png',
    panelMode,
    panelUrl,
    panelVideo,
    panelData,
    pageMode: pageLinkedToPanel ? panelMode : pageMode,
    pageUrl: pageLinkedToPanel ? panelUrl : pageUrl,
    pageVideo: pageLinkedToPanel ? panelVideo : pageVideo,
    pageData,
    pageLinkedToPanel,
  });
}

function renderModelSettings() {
  const container = $('#adminModelsConfig');
  container.replaceChildren();
  for (const model of currentSettings.models) {
    const row = document.createElement('article');
    row.className = 'admin-model-row';
    row.dataset.modelId = model.id;
    const preview = document.createElement('div');
    preview.className = 'admin-model-preview';
    const image = document.createElement('img');
    image.alt = '';
    image.hidden = true;
    const fallback = document.createElement('span');
    fallback.textContent = model.name.slice(0, 1);
    preview.append(image, fallback);
    const content = document.createElement('div');
    content.className = 'admin-model-fields';
    const heading = document.createElement('div');
    heading.className = 'admin-model-heading';
    const title = document.createElement('strong');
    title.textContent = model.id;
    const tier = document.createElement('span');
    tier.className = `model-tier${model.tier === 'premium' ? ' is-premium' : model.tier === 'pro' ? ' is-pro' : ''}`;
    tier.textContent = ({free: 'Gratis', pro: 'Pro', premium: 'Premium'})[model.tier] || 'Gratis';
    heading.append(title, tier);
    if (!MODEL_DEFAULTS.some(item => item.id === model.id)) {
      const removeModel = document.createElement('button');
      removeModel.type = 'button';
      removeModel.className = 'admin-item-remove';
      removeModel.setAttribute('aria-label', `Eliminar ${model.id}`);
      removeModel.title = 'Eliminar modelo personalizado';
      removeModel.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
      removeModel.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar ${model.id} del catálogo? Los usuarios que lo tengan asignado perderán acceso.`)) return;
        row.remove();
      });
      heading.append(removeModel);
    }
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nombre visible';
    const nameInput = document.createElement('input');
    nameInput.className = 'profile-name-input';
    nameInput.dataset.modelField = 'name';
    nameInput.value = model.name;
    nameLabel.append(nameInput);
    let idLabel = null;
    if (!MODEL_DEFAULTS.some(item => item.id === model.id)) {
      idLabel = document.createElement('label');
      idLabel.textContent = 'ID público del modelo';
      const idInput = document.createElement('input');
      idInput.className = 'profile-name-input';
      idInput.dataset.modelField = 'id';
      idInput.maxLength = 54;
      idInput.placeholder = 'Nexus-Day';
      idInput.value = model.id;
      idInput.addEventListener('input', () => { title.textContent = idInput.value.trim() || model.id; });
      idLabel.append(idInput);
    }
    const providerLabel = document.createElement('label');
    providerLabel.textContent = 'Proveedor de IA';
    const providerSelect = document.createElement('select');
    providerSelect.className = 'profile-name-input';
    providerSelect.dataset.modelField = 'provider';
    for (const [value, label] of [['openrouter','OpenRouter'], ['openai','OpenAI · ChatGPT'], ['gemini','Google · Gemini'], ['groq','Groq']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; providerSelect.append(option);
    }
    providerSelect.value = ['openrouter','openai','gemini','groq'].includes(model.provider) ? model.provider : 'openrouter';
    providerLabel.append(providerSelect);
    const providerModelLabel = document.createElement('label');
    providerModelLabel.textContent = 'Identificador del modelo en ese proveedor';
    const providerInput = document.createElement('input');
    providerInput.className = 'profile-name-input';
    providerInput.dataset.modelField = 'providerModel';
    providerInput.placeholder = 'Ej. gpt-4o-mini, gemini-2.5-flash o llama-3.3-70b-versatile';
    providerInput.value = model.providerModel || '';
    providerModelLabel.append(providerInput);
    const providerHelp = document.createElement('small');
    providerHelp.className = 'admin-model-help';
    providerHelp.textContent = 'OpenRouter: liquid/lfm-3-1.7b:free · OpenAI: gpt-4o-mini · Gemini: gemini-2.5-flash · Groq: llama-3.3-70b-versatile. Este catálogo es solo para chat; Veo se configura abajo.';
    providerSelect.addEventListener('change', () => {
      providerInput.placeholder = ({openrouter:'liquid/lfm-3-1.7b:free',openai:'gpt-4o-mini',gemini:'gemini-2.5-flash',groq:'llama-3.3-70b-versatile'})[providerSelect.value];
    });
    const tierLabel = document.createElement('label');
    tierLabel.textContent = 'Nivel de acceso';
    const tierInput = document.createElement('select');
    tierInput.className = 'profile-name-input';
    tierInput.dataset.modelField = 'tier';
    for (const [value, label] of [['free', 'Gratis'], ['pro', 'Pro'], ['premium', 'Premium']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; tierInput.append(option);
    }
    tierInput.value = model.tier || 'free';
    tierLabel.append(tierInput);
    const capabilityOptions = document.createElement('div');
    capabilityOptions.className = 'admin-model-capabilities';
    for (const [field, textValue] of [['vision', 'Analiza imágenes en el chat'], ['audio', 'Analiza audio en el chat']]) {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.modelField = field;
      checkbox.checked = Boolean(model[field]);
      const text = document.createElement('span');
      text.textContent = textValue;
      label.append(checkbox, text);
      capabilityOptions.append(label);
    }
    const tokenLabel = document.createElement('label');
    tokenLabel.textContent = 'Límite individual de tokens por ciclo (0 = límite del plan)';
    const tokenInput = document.createElement('input');
    tokenInput.className = 'profile-name-input';
    tokenInput.type = 'number'; tokenInput.min = '0'; tokenInput.max = '10000000'; tokenInput.step = '1000';
    tokenInput.dataset.modelField = 'tokenLimit'; tokenInput.value = String(model.tokenLimit || 0);
    tokenLabel.append(tokenInput);
    const imageLabel = document.createElement('label');
    imageLabel.textContent = 'Foto o logo del modelo (solo visual)';
    const imageInput = document.createElement('input');
    imageInput.className = 'profile-name-input';
    imageInput.type = 'url';
    imageInput.placeholder = 'https://…';
    imageInput.dataset.modelField = 'imageUrl';
    imageInput.value = model.imageUrl || '';
    imageInput.addEventListener('input', () => {
      const imageUrl = safeHttpsUrl(imageInput.value.trim());
      image.hidden = !imageUrl;
      fallback.hidden = Boolean(imageUrl);
      if (imageUrl) image.src = imageUrl;
    });
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    imageLabel.append(imageInput);
    const descriptionLabel = document.createElement('label');
    descriptionLabel.textContent = 'Descripción';
    const descriptionInput = document.createElement('input');
    descriptionInput.className = 'profile-name-input';
    descriptionInput.maxLength = 180;
    descriptionInput.dataset.modelField = 'description';
    descriptionInput.value = model.description || '';
    descriptionLabel.append(descriptionInput);
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'admin-toggle';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = model.enabled !== false;
    enabledInput.dataset.modelField = 'enabled';
    const enabledText = document.createElement('span');
    enabledText.textContent = 'Mostrar en el chat';
    enabledLabel.append(enabledInput, enabledText);
    content.append(heading);
    if (idLabel) content.append(idLabel);
    content.append(nameLabel, providerLabel, providerModelLabel, providerHelp, tierLabel, capabilityOptions, tokenLabel, imageLabel, descriptionLabel, enabledLabel);
    row.append(preview, content);
    container.append(row);
    const initialImage = safeHttpsUrl(model.imageUrl || '');
    image.hidden = !initialImage;
    fallback.hidden = Boolean(initialImage);
    if (initialImage) image.src = initialImage;
  }
}

function readModelSettings() {
  const disabledVoiceModels = [];
  const models = [...document.querySelectorAll('.admin-model-row')].map(row => {
    const get = field => row.querySelector(`[data-model-field="${field}"]`);
    const base = currentSettings.models.find(item => item.id === row.dataset.modelId) || { id: row.dataset.modelId, name: row.dataset.modelId };
    const id = (get('id')?.value || row.dataset.modelId).trim();
    if (!/^Nexus-?[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/.test(id)) throw new Error(`ID de modelo no válido: ${id}`);
    const providerModel = get('providerModel').value.trim();
    const provider = get('provider').value;
    const enabled = get('enabled').checked;
    if (!['openrouter','openai','gemini','groq'].includes(provider)) throw new Error(`Proveedor no válido para ${id}.`);
    const validProviderModel = provider === 'openrouter' ? /^[A-Za-z0-9._-]+\/[A-Za-z0-9][A-Za-z0-9._:-]*$/ : /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
    if (providerModel && !validProviderModel.test(providerModel)) throw new Error(`El identificador del proveedor no es válido para ${id}.`);
    if (enabled && !providerModel) throw new Error(`Configura un modelo conversacional para ${id} antes de activarlo.`);
    const isTextToSpeech = /^fish-audio\//i.test(providerModel) || /\/(?:tts|text-to-speech)(?:[-/:.]|$)/i.test(providerModel);
    if (enabled && isTextToSpeech) disabledVoiceModels.push(id);
    const isEnabled = enabled && !isTextToSpeech;
    const tokenLimit = Number.parseInt(get('tokenLimit').value || '0', 10);
    if (!Number.isInteger(tokenLimit) || tokenLimit < 0 || tokenLimit > 10_000_000) throw new Error(`Límite de tokens no válido para ${id}.`);
    return {
      ...base,
      id,
      name: get('name').value.trim().slice(0, 50) || base.name,
      providerModel,
      provider,
      tier: get('tier').value,
      tokenLimit,
      vision: get('vision').checked,
      audio: get('audio').checked,
      imageUrl: safeHttpsUrl(get('imageUrl').value.trim()),
      description: get('description').value.trim().slice(0, 180),
      enabled: isEnabled,
    };
  });
  const ids = new Set();
  for (const model of models) {
    if (ids.has(model.id)) throw new Error(`El ID ${model.id} está repetido. Cada modelo necesita un ID único.`);
    ids.add(model.id);
  }
  return { models, disabledVoiceModels };
}

function renderPlanSettings() {
  currentSettings.comparisonRows = readPlanComparisonDrafts();
  const container = $('#adminPlansConfig');
  container.replaceChildren();
  for (const plan of currentSettings.plans) {
    const row = document.createElement('article');
    row.className = 'admin-plan-row';
    row.dataset.planId = plan.id;
    const preview = document.createElement('div');
    preview.className = 'admin-plan-preview';
    const previewName = document.createElement('strong');
    previewName.textContent = plan.name;
    const previewPrice = document.createElement('span');
    previewPrice.textContent = `${plan.price} ${plan.currency}`;
    preview.append(previewName, previewPrice);

    const fields = document.createElement('div');
    fields.className = 'admin-plan-fields';
    const heading = document.createElement('div');
    heading.className = 'admin-plan-heading';
    const idLabel = document.createElement('strong');
    idLabel.textContent = plan.id;
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'admin-toggle';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.dataset.planField = 'enabled';
    enabled.checked = plan.enabled !== false;
    const enabledText = document.createElement('span');
    enabledText.textContent = 'Mostrar en Planes';
    enabledLabel.append(enabled, enabledText);
    heading.append(idLabel, enabledLabel);
    if (!PLAN_DEFAULTS.some(item => item.id === plan.id)) {
      const removePlan = document.createElement('button');
      removePlan.type = 'button';
      removePlan.className = 'admin-item-remove';
      removePlan.setAttribute('aria-label', `Eliminar plan ${plan.name}`);
      removePlan.title = 'Eliminar plan personalizado';
      removePlan.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
      removePlan.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar el plan ${plan.name}? Los usuarios con este plan podrían perder su configuración.`)) return;
        row.remove();
      });
      heading.append(removePlan);
    }

    const makeInput = (labelText, field, value, type = 'text', options = {}) => {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.className = 'profile-name-input';
      input.type = type;
      input.dataset.planField = field;
      if (options.maxLength) input.maxLength = options.maxLength;
      if (options.min !== undefined) input.min = String(options.min);
      if (options.max !== undefined) input.max = String(options.max);
      if (options.step) input.step = options.step;
      input.value = value ?? '';
      label.append(input);
      return { label, input };
    };

    const name = makeInput('Nombre', 'name', plan.name, 'text', { maxLength: 60 });
    const description = document.createElement('label');
    description.textContent = 'Descripción';
    const descriptionInput = document.createElement('textarea');
    descriptionInput.className = 'profile-name-input';
    descriptionInput.dataset.planField = 'description';
    descriptionInput.maxLength = 220;
    descriptionInput.rows = 2;
    descriptionInput.value = plan.description || '';
    description.append(descriptionInput);

    const price = makeInput('Precio', 'price', plan.price, 'number', { min: 0, max: 999999, step: '0.01' });
    const currencyLabel = document.createElement('label');
    currencyLabel.textContent = 'Moneda';
    const currency = document.createElement('select');
    currency.className = 'profile-name-input';
    currency.dataset.planField = 'currency';
    for (const value of ['ARS', 'USD', 'COP']) {
      const option = document.createElement('option'); option.value = value; option.textContent = value; currency.append(option);
    }
    currency.value = plan.currency || 'USD';
    currencyLabel.append(currency);
    const duration = makeInput('Duración en días', 'durationDays', plan.durationDays, 'number', { min: 1, max: 3650, step: '1' });
    const monthlyTokens = makeInput('Tokens por ciclo', 'monthlyTokens', plan.monthlyTokens, 'number', { min: 0, max: 100000000, step: '1000' });
    const badge = makeInput('Etiqueta superior', 'badge', plan.badge, 'text', { maxLength: 40 });
    const period = makeInput('Texto junto al precio', 'periodLabel', plan.periodLabel, 'text', { maxLength: 40 });
    const discount = makeInput('Descuento (%)', 'discountPercent', plan.discountPercent || 0, 'number', { min: 0, max: 90, step: '1' });

    const benefitsLabel = document.createElement('label');
    benefitsLabel.textContent = 'Beneficios (uno por línea)';
    const benefits = document.createElement('textarea');
    benefits.className = 'profile-name-input';
    benefits.dataset.planField = 'benefits';
    benefits.rows = 5;
    benefits.maxLength = 1200;
    benefits.value = Array.isArray(plan.benefits) ? plan.benefits.join('\n') : '';
    benefitsLabel.append(benefits);

    const featureOptions = document.createElement('fieldset');
    featureOptions.className = 'admin-plan-feature-options';
    const featureLegend = document.createElement('legend');
    featureLegend.textContent = 'Funciones incluidas';
    featureOptions.append(featureLegend);
    const enabledFeatures = Array.isArray(plan.features) ? plan.features : CORE_PLAN_FEATURES;
    for (const feature of currentSettings.planFeatures || PLAN_FEATURE_OPTIONS) {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.planFeature = feature.id;
      checkbox.checked = enabledFeatures.includes(feature.id);
      const text = document.createElement('span');
      text.textContent = feature.label;
      label.append(checkbox, text);
      featureOptions.append(label);
    }

    const color = makeInput('Color de fondo (hex, opcional)', 'backgroundColor', plan.backgroundColor, 'text', { maxLength: 7 });
    color.input.placeholder = '#18212b';
    const background = makeInput('Fondo imagen o GIF (URL https://)', 'backgroundImage', plan.backgroundImage, 'url');
    const backgroundVideo = makeInput('Fondo MP4 (URL https://)', 'backgroundVideo', plan.backgroundVideo, 'url');
    const featuredLabel = document.createElement('label');
    featuredLabel.className = 'admin-toggle';
    const featured = document.createElement('input');
    featured.type = 'checkbox'; featured.dataset.planField = 'featured'; featured.checked = Boolean(plan.featured);
    const featuredText = document.createElement('span'); featuredText.textContent = 'Destacar tarjeta';
    featuredLabel.append(featured, featuredText);

    const updatePreview = () => {
      previewName.textContent = name.input.value || plan.name;
      const basePrice = Math.max(0, Number(price.input.value) || 0);
      const percent = Math.max(0, Math.min(90, Number(discount.input.value) || 0));
      const finalPrice = Number((basePrice * (100 - percent) / 100).toFixed(2));
      previewPrice.textContent = percent ? `${formatPlanPrice({currency: currency.value}, basePrice)} → ${formatPlanPrice({currency: currency.value}, finalPrice)}` : `${formatPlanPrice({currency: currency.value}, basePrice)}`;
      const bgColor = /^#[0-9a-f]{6}$/i.test(color.input.value) ? color.input.value : '';
      const bgImage = safeHttpsUrl(background.input.value.trim());
      preview.style.backgroundColor = bgColor || '';
      preview.style.backgroundImage = bgImage
        ? `linear-gradient(rgba(7, 9, 14, .62), rgba(7, 9, 14, .82)), url("${bgImage}")`
        : bgColor ? 'linear-gradient(rgba(7, 9, 14, .62), rgba(7, 9, 14, .82))' : '';
      preview.classList.toggle('has-plan-background', Boolean(bgColor || bgImage));
    };
    [name.input, price.input, currency, discount.input, color.input, background.input, backgroundVideo.input].forEach(input => input.addEventListener('input', updatePreview));
    fields.append(heading, name.label, description, price.label, currencyLabel, discount.label, duration.label, monthlyTokens.label, badge.label, period.label, benefitsLabel, featureOptions, color.label, background.label, backgroundVideo.label, featuredLabel);
    row.append(preview, fields);
    container.append(row);
    updatePreview();
  }
  renderPlanFeatureCatalog();
  renderPlanComparisonSettings();
}

function renderPlanFeatureCatalog() {
  const container = $('#adminPlanFeatureCatalog');
  if (!container) return;
  container.replaceChildren();
  for (const feature of currentSettings.planFeatures || PLAN_FEATURE_OPTIONS) {
    const item = document.createElement('div');
    item.className = 'admin-plan-feature-item';
    const label = document.createElement('span');
    label.textContent = feature.label;
    item.append(label);
    if (!PLAN_FEATURE_OPTIONS.some(base => base.id === feature.id)) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'admin-item-remove';
      remove.setAttribute('aria-label', `Eliminar función ${feature.label}`);
      remove.title = 'Eliminar función personalizada';
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
      remove.addEventListener('click', () => {
        try {
          currentSettings.plans = readPlanSettings();
        } catch (error) {
          toast(error.message || 'Revisa los datos de los planes antes de quitar esta función.');
          return;
        }
        currentSettings.planFeatures = currentSettings.planFeatures.filter(item => item.id !== feature.id);
        currentSettings.plans = currentSettings.plans.map(plan => ({
          ...plan,
          features: plan.features.filter(id => id !== feature.id),
        }));
        renderPlanSettings();
      });
      item.append(remove);
    } else {
      const base = document.createElement('small');
      base.textContent = 'Base';
      item.append(base);
    }
    container.append(item);
  }
}

function addPlanFeature(labelValue) {
  const label = labelValue.trim().slice(0, 64);
  if (!label) return toast('Escribe el nombre de la función.');
  if ((currentSettings.planFeatures || []).length >= 30) return toast('Puedes configurar hasta 30 funciones.');
  if ((currentSettings.planFeatures || []).some(feature => feature.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
    return toast('Esa función ya está en el catálogo.');
  }
  try {
    currentSettings.plans = readPlanSettings();
  } catch (error) {
    return toast(error.message || 'Revisa los datos de los planes antes de agregar una función.');
  }
  const slug = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
  const stem = `custom-${slug || 'funcion'}`;
  let id = stem;
  let suffix = 2;
  while (currentSettings.planFeatures.some(feature => feature.id === id)) id = `${stem.slice(0, 44)}-${suffix++}`;
  currentSettings.planFeatures.push({id, label});
  currentSettings.plans = currentSettings.plans.map(plan => ({...plan, features: [...plan.features]}));
  $('#newPlanFeatureLabel').value = '';
  renderPlanSettings();
}

function readPlanComparisonDrafts() {
  const rows = [...document.querySelectorAll('.admin-plan-comparison-row')];
  if (!rows.length) return currentSettings.comparisonRows || [];
  const planIds = new Set(currentSettings.plans.map(plan => plan.id));
  return rows.map(row => {
    const values = {};
    for (const input of row.querySelectorAll('[data-comparison-plan]')) {
      const planId = input.dataset.comparisonPlan;
      if (planIds.has(planId)) values[planId] = input.value.slice(0, 160);
    }
    return {
      id: row.dataset.comparisonId,
      label: row.querySelector('[data-comparison-label]').value.slice(0, 60),
      values,
    };
  });
}

function renderPlanComparisonSettings() {
  const container = $('#adminPlanComparisonConfig');
  if (!container) return;
  container.replaceChildren();
  for (const comparisonRow of currentSettings.comparisonRows || []) {
    const row = document.createElement('article');
    row.className = 'admin-plan-comparison-row';
    row.dataset.comparisonId = comparisonRow.id;
    const heading = document.createElement('div');
    heading.className = 'admin-plan-comparison-heading';
    const title = document.createElement('strong');
    title.textContent = comparisonRow.label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-item-remove';
    remove.setAttribute('aria-label', `Eliminar fila ${comparisonRow.label}`);
    remove.title = 'Eliminar fila comparativa';
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
    remove.addEventListener('click', () => row.remove());
    heading.append(title, remove);

    const label = document.createElement('label');
    label.className = 'admin-plan-comparison-label';
    label.textContent = 'Nombre de la característica';
    const labelInput = document.createElement('input');
    labelInput.className = 'profile-name-input';
    labelInput.maxLength = 60;
    labelInput.dataset.comparisonLabel = '';
    labelInput.value = comparisonRow.label;
    labelInput.addEventListener('input', () => { title.textContent = labelInput.value || 'Nueva característica'; });
    label.append(labelInput);

    const values = document.createElement('div');
    values.className = 'admin-plan-comparison-values';
    for (const plan of currentSettings.plans) {
      const valueLabel = document.createElement('label');
      valueLabel.textContent = plan.name;
      const valueInput = document.createElement('input');
      valueInput.className = 'profile-name-input';
      valueInput.maxLength = 160;
      valueInput.placeholder = '—';
      valueInput.dataset.comparisonPlan = plan.id;
      valueInput.value = comparisonRow.values?.[plan.id] || '';
      valueLabel.append(valueInput);
      values.append(valueLabel);
    }
    row.append(heading, label, values);
    container.append(row);
  }
}

function readPlanComparisonSettings(plans) {
  const planIds = new Set(plans.map(plan => plan.id));
  const rows = [...document.querySelectorAll('.admin-plan-comparison-row')].map(row => {
    const label = row.querySelector('[data-comparison-label]').value.trim().slice(0, 60);
    if (!label) throw new Error('Cada fila de la comparativa necesita un nombre.');
    const values = {};
    for (const input of row.querySelectorAll('[data-comparison-plan]')) {
      const planId = input.dataset.comparisonPlan;
      if (planIds.has(planId)) values[planId] = input.value.trim().slice(0, 160);
    }
    return {id: row.dataset.comparisonId, label, values};
  });
  const labels = new Set();
  for (const row of rows) {
    const normalized = row.label.toLocaleLowerCase();
    if (labels.has(normalized)) throw new Error(`La fila “${row.label}” está repetida.`);
    labels.add(normalized);
  }
  return rows;
}

function readPlanSettings() {
  const plans = [...document.querySelectorAll('.admin-plan-row')].map(row => {
    const get = field => row.querySelector(`[data-plan-field="${field}"]`);
    const base = currentSettings.plans.find(plan => plan.id === row.dataset.planId);
    const durationDays = Number.parseInt(get('durationDays').value, 10);
    const monthlyTokens = Number.parseInt(get('monthlyTokens').value, 10);
    const price = Number(get('price').value);
    const discountPercent = Number.parseInt(get('discountPercent').value || '0', 10);
    const backgroundColor = get('backgroundColor').value.trim();
    const enabled = get('enabled').checked;
    if (!Number.isFinite(price) || price < 0 || (enabled && !['free', 'custom-plan'].includes(row.dataset.planId) && price <= 0) || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
      throw new Error(`Revisa el precio y duración del plan ${base.name}.`);
    }
    if (!Number.isInteger(monthlyTokens) || monthlyTokens < 0 || monthlyTokens > 100_000_000 || (enabled && monthlyTokens === 0)) {
      throw new Error(`Revisa los tokens por ciclo del plan ${base.name}.`);
    }
    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 90) {
      throw new Error(`El descuento de ${base.name} debe estar entre 0 y 90%.`);
    }
    if (backgroundColor && !/^#[0-9a-f]{6}$/i.test(backgroundColor)) {
      throw new Error(`El color de fondo de ${base.name} debe tener formato #RRGGBB.`);
    }
    return {
      ...base,
      name: get('name').value.trim().slice(0, 60) || base.name,
      description: get('description').value.trim().slice(0, 220),
      price: String(price),
      discountPercent,
      currency: get('currency').value,
      durationDays,
      monthlyTokens,
      badge: get('badge').value.trim().slice(0, 40),
      periodLabel: get('periodLabel').value.trim().slice(0, 40),
      benefits: get('benefits').value.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 12),
      features: [...row.querySelectorAll('[data-plan-feature]:checked')].map(input => input.dataset.planFeature),
      backgroundColor,
      backgroundImage: safeHttpsUrl(get('backgroundImage').value.trim()),
      backgroundVideo: safeHttpsUrl(get('backgroundVideo').value.trim()),
      enabled,
      featured: get('featured').checked,
    };
  });
  return plans;
}

function renderPlanCards() {
  const grid = $('#planGrid');
  grid.replaceChildren();
  for (const plan of currentSettings.plans.filter(item => item.enabled !== false)) {
    const card = document.createElement('article');
    card.className = `panel plan${plan.featured ? ' featured' : ''}`;
    if (plan.id === 'custom-plan') card.classList.add('is-custom-plan');
    card.dataset.planCard = plan.id;
    const acquired = document.createElement('span');
    acquired.className = 'plan-acquired-state'; acquired.hidden = true; acquired.textContent = 'Adquirido';
    card.append(acquired);
    if (plan.badge) {
      const badge = document.createElement('span'); badge.className = 'plan-badge'; badge.textContent = plan.badge; card.append(badge);
    }
    const title = document.createElement('h3'); title.textContent = plan.name;
    const description = document.createElement('p'); description.textContent = plan.description || '';
    const price = document.createElement('div'); price.className = 'price';
    const discountPercent = Math.max(0, Math.min(90, Number(plan.discountPercent) || 0));
    if (plan.id === 'custom-plan') {
      const priceText = document.createElement('span');
      priceText.className = 'plan-custom-price';
      priceText.textContent = 'A cotizar';
      price.append(priceText);
    } else if (discountPercent && Number(plan.price) > 0) {
      const oldPrice = document.createElement('del');
      oldPrice.className = 'plan-price-old';
      oldPrice.textContent = formatPlanPrice(plan, Number(plan.price));
      const newPrice = document.createElement('strong');
      newPrice.className = 'plan-price-discount';
      newPrice.textContent = formatPlanPrice(plan);
      const discountTag = document.createElement('span');
      discountTag.className = 'plan-discount-tag';
      discountTag.textContent = `Ahorras ${discountPercent}%`;
      price.append(oldPrice, newPrice, discountTag);
      card.classList.add('has-plan-discount');
    } else {
      const priceText = document.createElement('span');
      priceText.textContent = plan.price ? formatPlanPrice(plan, Number(plan.price)) : 'A definir';
      price.append(priceText);
    }
    const period = document.createElement('small'); period.textContent = plan.id === 'custom-plan' ? '/ según tu selección' : `/ ${plan.periodLabel || `${plan.durationDays} días`}`;
    price.append(period);
    const benefits = document.createElement('ul');
    for (const benefit of plan.benefits || []) {
      const item = document.createElement('li'); item.textContent = benefit; benefits.append(item);
    }
    card.append(title, description, price, benefits);
    if (plan.id === 'free') {
      const button = document.createElement('button'); button.className = 'btn'; button.id = 'currentPlan'; button.type = 'button'; button.disabled = true; button.textContent = 'Plan actual'; card.append(button);
    } else {
      const button = document.createElement('button');
      button.className = `btn${plan.featured ? ' primary' : ''}`;
      button.type = 'button';
      button.dataset.buyPlan = plan.id;
      button.dataset.planName = plan.name;
      button.dataset.durationDays = String(plan.durationDays);
      button.dataset.amount = plan.id === 'custom-plan' ? 'A cotizar' : `${effectivePlanPrice(plan)} ${plan.currency}`;
      button.dataset.currency = plan.currency || 'USD';
      button.disabled = plan.id === 'custom-plan' ? false : !plan.price || Number(plan.price) <= 0;
      button.textContent = plan.id === 'custom-plan' ? 'Diseñar mi plan' : button.disabled ? 'Precio pendiente' : 'Enviar comprobante';
      card.append(button);
    }
    const bgColor = /^#[0-9a-f]{6}$/i.test(plan.backgroundColor || '') ? plan.backgroundColor : '';
    const bgImage = safeHttpsUrl(plan.backgroundImage || '');
    const bgVideo = safeHttpsUrl(plan.backgroundVideo || '');
    if (bgVideo) {
      const video = document.createElement('video');
      video.className = 'plan-background-video';
      video.src = bgVideo;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      card.append(video);
      card.classList.add('has-plan-video');
    }
    if (bgColor || bgImage) {
      card.classList.add('has-plan-background');
      if (bgColor) card.style.backgroundColor = bgColor;
      card.style.backgroundImage = bgImage
        ? `linear-gradient(rgba(7, 9, 14, .62), rgba(7, 9, 14, .84)), url("${bgImage}")`
        : 'linear-gradient(rgba(7, 9, 14, .62), rgba(7, 9, 14, .84))';
    }
    grid.append(card);
  }
  renderPlanComparison();
  updatePlanCards(userProfile);
  initializePlanCardMotion();
}

function renderPlanComparison() {
  const table = $('#planComparisonTable');
  if (!table) return;
  const plans = currentSettings.plans.filter(plan => plan.enabled !== false);
  table.replaceChildren();
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const featureHeading = document.createElement('th');
  featureHeading.scope = 'col';
  featureHeading.textContent = 'Comparación';
  headRow.append(featureHeading);
  for (const plan of plans) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = plan.name;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  const comparisonRows = [
    ['Precio', plan => plan.id === 'custom-plan' ? 'A cotizar' : plan.price ? `${plan.currency} ${plan.price} / ${plan.periodLabel || `${plan.durationDays} días`}` : 'A definir'],
    ['Duración', plan => plan.id === 'free' ? 'Sin vencimiento' : plan.id === 'custom-plan' ? 'A medida' : `${plan.durationDays} días`],
    ['Tokens por ciclo', plan => plan.id === 'custom-plan' ? 'A definir' : Number(plan.monthlyTokens || 0).toLocaleString('es-AR')],
    ['Beneficios', plan => (plan.benefits || []).join(' · ') || '—'],
    ...(currentSettings.planFeatures || PLAN_FEATURE_OPTIONS).map(feature => [feature.label, plan => plan.features?.includes(feature.id) ? 'Incluido' : '—']),
    ...(currentSettings.comparisonRows || []).map(row => [row.label, plan => row.values?.[plan.id] || '—']),
  ];
  for (const [label, getValue] of comparisonRows) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const plan of plans) {
      const cell = document.createElement('td');
      cell.textContent = getValue(plan);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
}

function methodName(id) {
  if (id === 'custom-request') return 'Solicitud personalizada';
  return currentSettings.paymentMethods[id]?.name || METHOD_NAMES[id] || id;
}

function compressPaymentIcon(file) {
  return new Promise((resolve, reject) => {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      reject(new Error('Usa JPG, PNG o WebP de hasta 5 MB.'));
      return;
    }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const ratio = Math.min(1, 180 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      let quality = 0.78;
      let data = canvas.toDataURL('image/webp', quality);
      while (data.length > 65000 && quality > 0.38) {
        quality -= 0.08;
        data = canvas.toDataURL('image/webp', quality);
      }
      if (data.length > 65000) reject(new Error('El icono sigue siendo muy grande; usa uno más sencillo o un enlace.'));
      else resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer el icono.'));
    };
    image.src = objectUrl;
  });
}

function renderPaymentMethodSettings() {
  const container = $('#adminMethodsConfig');
  container.replaceChildren();
  for (const [id, method] of Object.entries(currentSettings.paymentMethods)) {
    const row = document.createElement('article');
    row.className = 'admin-method-card admin-method-row';
    row.dataset.methodId = id;
    row.dataset.iconData = method.iconData || '';

    const heading = document.createElement('div');
    heading.className = 'admin-method-heading';
    const preview = document.createElement('div');
    preview.className = 'admin-method-icon-preview';
    const image = document.createElement('img');
    image.alt = '';
    const fallback = document.createElement('span');
    fallback.textContent = (method.name || id).slice(0, 2).toUpperCase();
    preview.append(image, fallback);
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'admin-toggle';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.dataset.methodField = 'enabled';
    enabled.checked = Boolean(method.enabled);
    const enabledText = document.createElement('span');
    enabledText.textContent = 'Disponible';
    enabledLabel.append(enabled, enabledText);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-method-remove';
    remove.setAttribute('aria-label', `Eliminar ${method.name || id}`);
    remove.title = 'Eliminar método';
    remove.textContent = '×';
    remove.addEventListener('click', () => row.remove());
    heading.append(preview, enabledLabel, remove);

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nombre del método';
    const nameInput = document.createElement('input');
    nameInput.className = 'profile-name-input';
    nameInput.dataset.methodField = 'name';
    nameInput.maxLength = 50;
    nameInput.value = method.name || id;
    nameLabel.append(nameInput);

    const accountLabel = document.createElement('label');
    accountLabel.textContent = 'Nombre de cuenta';
    const accountInput = document.createElement('input');
    accountInput.className = 'profile-name-input';
    accountInput.dataset.methodField = 'accountName';
    accountInput.maxLength = 100;
    accountInput.value = method.accountName || '';
    accountLabel.append(accountInput);

    const identifierLabel = document.createElement('label');
    identifierLabel.textContent = 'Correo, cuenta o enlace';
    const identifierInput = document.createElement('input');
    identifierInput.className = 'profile-name-input';
    identifierInput.dataset.methodField = 'identifier';
    identifierInput.maxLength = 160;
    identifierInput.value = method.identifier || '';
    identifierLabel.append(identifierInput);

    const instructionsLabel = document.createElement('label');
    instructionsLabel.textContent = 'Instrucciones';
    const instructionsInput = document.createElement('input');
    instructionsInput.className = 'profile-name-input';
    instructionsInput.dataset.methodField = 'instructions';
    instructionsInput.maxLength = 240;
    instructionsInput.value = method.instructions || '';
    instructionsLabel.append(instructionsInput);

    const iconUrlLabel = document.createElement('label');
    iconUrlLabel.textContent = 'Icono por URL';
    const iconUrlInput = document.createElement('input');
    iconUrlInput.className = 'profile-name-input';
    iconUrlInput.type = 'url';
    iconUrlInput.placeholder = 'https://…';
    iconUrlInput.dataset.methodField = 'iconUrl';
    iconUrlInput.value = method.iconUrl || '';
    const syncPreview = source => {
      if (source === 'url' && iconUrlInput.value.trim()) row.dataset.iconData = '';
      const url = row.dataset.iconData || safeHttpsUrl(iconUrlInput.value.trim());
      image.hidden = !url;
      fallback.hidden = Boolean(url);
      if (url) image.src = url;
    };
    iconUrlInput.addEventListener('input', () => syncPreview('url'));
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    iconUrlLabel.append(iconUrlInput);

    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'admin-icon-upload';
    uploadLabel.textContent = 'O sube una imagen';
    const upload = document.createElement('input');
    upload.type = 'file';
    upload.accept = 'image/jpeg,image/png,image/webp';
    upload.addEventListener('change', async () => {
      try {
        row.dataset.iconData = await compressPaymentIcon(upload.files[0]);
        iconUrlInput.value = '';
        syncPreview('file');
      } catch (error) {
        toast(error.message);
      }
    });
    uploadLabel.append(upload);
    row.append(heading, nameLabel, accountLabel, identifierLabel, instructionsLabel, iconUrlLabel, uploadLabel);
    container.append(row);
    syncPreview('initial');
  }
}

function renderTokenPackageSettings() {
  const container = $('#adminTokenPackagesConfig');
  if (!container) return;
  container.replaceChildren();
  if (!currentSettings.tokenPackages.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-user-empty';
    empty.textContent = 'Todavía no hay paquetes. Agrega uno y actívalo cuando tenga precio y método de pago.';
    container.append(empty);
    return;
  }
  for (const tokenPackage of currentSettings.tokenPackages) {
    const row = document.createElement('article');
    row.className = 'admin-token-package-row';
    row.dataset.packageId = tokenPackage.id;
    const heading = document.createElement('div');
    heading.className = 'admin-token-package-heading';
    const id = document.createElement('strong');
    id.textContent = tokenPackage.id;
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'admin-toggle';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.dataset.packageField = 'enabled';
    enabled.checked = tokenPackage.enabled;
    const enabledText = document.createElement('span');
    enabledText.textContent = 'Disponible para comprar';
    enabledLabel.append(enabled, enabledText);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-method-remove';
    remove.title = 'Eliminar paquete';
    remove.textContent = '×';
    remove.addEventListener('click', () => row.remove());
    heading.append(id, enabledLabel, remove);

    const makeInput = (labelText, field, value, type, options = {}) => {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.className = 'profile-name-input';
      input.type = type;
      input.dataset.packageField = field;
      input.value = value ?? '';
      if (options.min !== undefined) input.min = String(options.min);
      if (options.max !== undefined) input.max = String(options.max);
      if (options.maxLength) input.maxLength = options.maxLength;
      label.append(input);
      return {label, input};
    };
    const name = makeInput('Nombre del paquete', 'name', tokenPackage.name, 'text', {maxLength: 60});
    const tokens = makeInput('Cantidad de tokens', 'tokenAmount', tokenPackage.tokenAmount, 'number', {min: 1000, max: 50_000_000});
    const price = makeInput('Precio', 'price', tokenPackage.price, 'number', {min: 0, max: 999999, step: '0.01'});
    const currencyLabel = document.createElement('label');
    currencyLabel.textContent = 'Moneda';
    const currency = document.createElement('select');
    currency.className = 'profile-name-input';
    currency.dataset.packageField = 'currency';
    for (const value of ['ARS', 'USD', 'COP']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      currency.append(option);
    }
    currency.value = tokenPackage.currency;
    currencyLabel.append(currency);
    const description = makeInput('Descripción', 'description', tokenPackage.description, 'text', {maxLength: 180});
    const imageField = makeInput('Imagen o GIF de fondo (URL HTTPS)', 'backgroundImage', tokenPackage.backgroundImage || '', 'url', {maxLength: 2048});
    imageField.input.placeholder = 'https://ejemplo.com/portada.gif';
    const videoField = makeInput('Video de fondo (YouTube o MP4 HTTPS)', 'backgroundVideo', tokenPackage.backgroundVideo || '', 'url', {maxLength: 2048});
    videoField.input.placeholder = 'https://www.youtube.com/watch?v=...';
    const mediaNote = document.createElement('small');
    mediaNote.className = 'nx-package-media-note';
    mediaNote.textContent = 'Video tiene prioridad sobre la imagen. Usa enlaces públicos HTTPS; YouTube reproduce sin sonido.';
    row.append(heading, name.label, tokens.label, price.label, currencyLabel, description.label, imageField.label, videoField.label, mediaNote);
    container.append(row);
  }
}

function readTokenPackageSettings() {
  return [...document.querySelectorAll('.admin-token-package-row')].map(row => {
    const get = field => row.querySelector(`[data-package-field="${field}"]`);
    const tokenAmount = Number.parseInt(get('tokenAmount').value, 10);
    const priceValue = get('price').value.trim();
    const price = Number(priceValue);
    const enabled = get('enabled').checked;
    if (!Number.isInteger(tokenAmount) || tokenAmount < 1000 || tokenAmount > 50_000_000) {
      throw new Error('Cada paquete debe incluir entre 1.000 y 50.000.000 tokens.');
    }
    if (priceValue && (!Number.isFinite(price) || price < 0)) {
      throw new Error('Escribe un precio válido para el paquete.');
    }
    if (enabled && (!priceValue || !Number.isFinite(price) || price <= 0)) {
      throw new Error('Configura un precio mayor a cero antes de activar el paquete.');
    }
    return {
      id: row.dataset.packageId,
      name: get('name').value.trim().slice(0, 60) || 'Paquete de tokens',
      description: get('description').value.trim().slice(0, 180),
      tokenAmount,
      price: priceValue ? String(price) : '',
      currency: get('currency').value,
      enabled,
      backgroundImage: safeHttpsUrl(get('backgroundImage').value.trim()),
      backgroundVideo: safeHttpsUrl(get('backgroundVideo').value.trim()),
    };
  });
}

function renderTokenPackages() {
  const container = $('#tokenPackagesGrid');
  if (!container) return;
  container.replaceChildren();
  const packages = currentSettings.tokenPackages.filter(item => item.enabled && Number(item.tokenAmount) > 0 && Number(item.price) > 0);
  if (!packages.length) {
    const empty = document.createElement('p');
    empty.className = 'history-loading';
    empty.textContent = 'No hay paquetes disponibles por el momento.';
    container.append(empty);
    return;
  }
  for (const tokenPackage of packages) {
    const card = document.createElement('article');
    card.className = 'token-package-card nx-token-media-card';
    const bgVideo = safeHttpsUrl(tokenPackage.backgroundVideo || '');
    const bgImage = safeHttpsUrl(tokenPackage.backgroundImage || '');
    if (bgVideo || bgImage) {
      const layer = document.createElement('div');
      layer.className = 'nx-token-media-layer';
      const yt = bgVideo.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (yt) {
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&playsinline=1`;
        frame.title = 'Fondo animado del paquete'; frame.loading = 'lazy'; frame.tabIndex = -1;
        frame.allow = 'autoplay; encrypted-media'; layer.append(frame);
      } else if (bgVideo && /\.(?:mp4|webm)(?:$|[?#])/i.test(bgVideo)) {
        const video = document.createElement('video');
        video.src = bgVideo; video.autoplay = true; video.loop = true; video.muted = true;
        video.playsInline = true; video.preload = 'none'; layer.append(video);
      } else if (bgImage) {
        const image = document.createElement('img'); image.src = bgImage; image.alt = '';
        image.loading = 'lazy'; layer.append(image);
      }
      if (layer.childElementCount) card.append(layer);
    }
    const title = document.createElement('h3');
    title.textContent = tokenPackage.name;
    const quantity = document.createElement('strong');
    quantity.textContent = `${Number(tokenPackage.tokenAmount).toLocaleString('es-AR')} tokens`;
    const description = document.createElement('p');
    description.textContent = tokenPackage.description || 'Se agregan a tu cuota al aprobar el pago.';
    const price = document.createElement('span');
    price.className = 'token-package-price';
    price.textContent = `${tokenPackage.currency} ${tokenPackage.price}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn primary';
    button.dataset.buyTokenPackage = tokenPackage.id;
    button.textContent = 'Comprar ahora';
    card.append(title, quantity, description, price, button);
    container.append(card);
  }
}

function readPaymentMethodSettings() {
  const methods = {};
  for (const row of document.querySelectorAll('.admin-method-row')) {
    const get = field => row.querySelector(`[data-method-field="${field}"]`);
    const name = get('name').value.trim().slice(0, 50);
    if (!name) throw new Error('Cada método necesita un nombre.');
    methods[row.dataset.methodId] = {
      id: row.dataset.methodId,
      name,
      enabled: get('enabled').checked,
      accountName: get('accountName').value.trim().slice(0, 100),
      identifier: get('identifier').value.trim().slice(0, 160),
      instructions: get('instructions').value.trim().slice(0, 240),
      iconUrl: safeHttpsUrl(get('iconUrl').value.trim()),
      iconData: row.dataset.iconData || '',
    };
  }
  if (Object.keys(methods).length > 8) throw new Error('Puedes configurar hasta 8 métodos de pago.');
  return methods;
}

function renderPlanPaymentMethods() {
  const container = $('#paymentMethodsList');
  container.replaceChildren();
  const enabled = Object.entries(currentSettings.paymentMethods).filter(([, method]) => method.enabled);
  if (!enabled.length) {
    const empty = document.createElement('span');
    empty.className = 'payment-method-empty';
    empty.textContent = 'Los métodos de pago se anunciarán aquí cuando estén configurados.';
    container.append(empty);
    return;
  }
  for (const [id, method] of enabled) {
    const card = document.createElement('article');
    card.className = 'payment-method-card';
    const mark = document.createElement('span');
    mark.className = `payment-method-mark method-${id}`;
    const iconUrl = method.iconData || safeHttpsUrl(method.iconUrl || '');
    if (iconUrl) {
      const image = document.createElement('img');
      image.src = iconUrl;
      image.alt = '';
      image.onerror = () => { image.remove(); mark.textContent = (method.name || id).slice(0, 2).toUpperCase(); };
      mark.append(image);
    } else {
      mark.textContent = (method.name || id).slice(0, 2).toUpperCase();
    }
    const body = document.createElement('div');
    body.className = 'payment-method-copy';
    const name = document.createElement('strong');
    name.textContent = method.name || METHOD_NAMES[id] || id;
    const account = document.createElement('span');
    account.textContent = method.accountName || method.identifier || 'Datos disponibles al pagar';
    body.append(name, account);
    card.append(mark, body);
    container.append(card);
  }
}

async function loadSettings() {
  try {
    const [snapshot, loginBrandingSnapshot] = await Promise.all([
      getDoc(SETTINGS_REF),
      getDoc(LOGIN_BRANDING_REF),
    ]);
    currentSettings = normalizeSettings(snapshot.exists() ? snapshot.data() : {});
    const loginBranding = loginBrandingSnapshot.exists() ? loginBrandingSnapshot.data() : {};
    currentLoginBranding = normalizeLoginBranding({
      faviconUrl: currentSettings.webCustomization.faviconUrl,
      ...loginBranding,
    });
  } catch (error) {
    currentSettings = normalizeSettings();
    currentLoginBranding = normalizeLoginBranding({faviconUrl: currentSettings.webCustomization.faviconUrl});
    console.warn('No se pudo leer la configuración pública:', error);
  }
  renderModelSettings();
  renderPaymentMethodSettings();
  renderPlanPaymentMethods();
  renderPlanSettings();
  renderTokenPackageSettings();
  renderTokenPackages();
  renderWebCustomizationSettings();
  renderPlanCards();
  applyWebCustomization();
}

async function saveSettings(patch) {
  const next = { ...currentSettings, ...patch };
  await setDoc(SETTINGS_REF, {
    ...next,
    updatedAt: serverTimestamp(),
    updatedBy: activeUser?.email || '',
  }, { merge: true });
  currentSettings = next;
  renderPlanPaymentMethods();
  renderPlanCards();
  renderTokenPackages();
  applyWebCustomization();
  window.dispatchEvent(new CustomEvent('model-config-updated', { detail: { models: currentSettings.models, plans: currentSettings.plans, planFeatures: currentSettings.planFeatures } }));
}

function renderPaymentMethodDetails() {
  const method = currentSettings.paymentMethods[$('#paymentMethod').value];
  const container = $('#paymentAccountDetails');
  container.replaceChildren();
  if (!method) return;
  const iconUrl = method.iconData || safeHttpsUrl(method.iconUrl || '');
  if (iconUrl) {
    const image = document.createElement('img');
    image.className = 'payment-account-icon';
    image.src = iconUrl;
    image.alt = '';
    image.onerror = () => image.remove();
    container.append(image);
  }
  const title = document.createElement('strong');
  title.textContent = method.accountName || method.name || METHOD_NAMES[$('#paymentMethod').value] || $('#paymentMethod').value;
  const identifier = document.createElement('span');
  identifier.textContent = method.identifier || '';
  const instructions = document.createElement('p');
  instructions.textContent = method.instructions || 'Realiza el pago y adjunta el comprobante.';
  container.append(title, identifier, instructions);
  const accountIdentifier = String(method.identifier || '').trim();
  if (accountIdentifier) {
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'payment-copy-account';
    copy.textContent = 'Copiar dato';
    copy.setAttribute('aria-label', 'Copiar el dato de la cuenta de pago');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(accountIdentifier);
        copy.textContent = '¡Copiado!';
        toast('Dato de pago copiado.');
      } catch (_) {
        toast('No se pudo copiar automáticamente. Selecciona el dato manualmente.');
      }
    });
    container.append(copy);
  }
}

function refreshPaymentMethodOptions() {
  const select = $('#paymentMethod');
  const enabled = Object.entries(currentSettings.paymentMethods).filter(([, method]) => method.enabled);
  select.replaceChildren();
  for (const [id, method] of enabled) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = method.name || METHOD_NAMES[id] || id;
    select.append(option);
  }
  select.disabled = !enabled.length;
  renderPaymentMethodDetails();
}

function openPurchase(button) {
  if (!activeUser) return toast('Inicia sesión para enviar un comprobante.');
  const plan = currentSettings.plans.find(item => item.id === button.dataset.buyPlan);
  if (!plan) return toast('No se encontró la configuración del plan.');
  const isCustomRequest = plan.id === 'custom-plan';
  currentPurchase = {
    type: isCustomRequest ? 'custom' : 'plan',
    planId: plan.id,
    planName: plan.name,
    durationDays: Number(plan.durationDays),
    monthlyTokens: Number(plan.monthlyTokens || 0),
    amount: isCustomRequest ? 'A cotizar' : `${plan.price} ${plan.currency}`,
    currency: plan.currency || 'USD',
  };
  openPurchaseDialog(
    isCustomRequest ? 'Solicitar plan Personalizado' : `Comprobante · ${currentPurchase.planName}`,
    isCustomRequest
      ? 'Elige lo que necesitas. El administrador revisará tu propuesta y te confirmará el precio.'
      : `${currentPurchase.amount} · acceso por ${currentPurchase.durationDays} días`,
  );
}

function openTokenPurchase(tokenPackage) {
  if (!activeUser) return toast('Inicia sesión para comprar tokens.');
  currentPurchase = {
    type: 'tokens',
    planId: 'tokens',
    planName: tokenPackage.name,
    packageId: tokenPackage.id,
    tokenAmount: Number(tokenPackage.tokenAmount),
    durationDays: 0,
    amount: `${tokenPackage.price} ${tokenPackage.currency}`,
    currency: tokenPackage.currency,
  };
  openPurchaseDialog(
    `Comprar tokens · ${tokenPackage.name}`,
    `${currentPurchase.tokenAmount.toLocaleString('es-AR')} tokens · ${currentPurchase.amount}`,
  );
}

function openPurchaseDialog(title, summary) {
  const isCustomRequest = currentPurchase.type === 'custom';
  const needsCustomTag = ['premium', 'custom-plan'].includes(currentPurchase.planId);
  $('#paymentKicker').textContent = isCustomRequest ? 'Solicitud a medida' : currentPurchase.type === 'tokens' ? 'Compra de tokens' : 'Solicitud de acceso';
  $('#paymentTitle').textContent = title;
  $('#paymentPlanSummary').textContent = summary;
  $('#paymentCustomTagField').hidden = !needsCustomTag;
  $('#paymentCustomTag').value = '';
  $('#customPlanBuilder').hidden = !isCustomRequest;
  $('#paymentMethodFields').hidden = isCustomRequest;
  $('#paymentMethod').required = !isCustomRequest;
  $('#paymentPayerFields').hidden = isCustomRequest;
  $('#paymentPayerFields').querySelectorAll('input').forEach(input => { input.required = !isCustomRequest && input.id !== 'payerAlias'; });
  $('#paymentReceiptFields').hidden = isCustomRequest;
  $('#submitPayment').textContent = isCustomRequest ? 'Enviar solicitud' : 'Enviar comprobante';
  $('#buyerEmail').value = activeUser.email || '';
  $('#buyerName').value = userProfile.displayName || activeUser.displayName || '';
  $('#payerName').value = '';
  $('#recipientAccountName').value = '';
  $('#payerAlias').value = '';
  $('#payerPhone').value = '';
  $('#receiptFile').value = '';
  $('#receiptUrl').value = '';
  $('#paymentFeedback').textContent = '';
  const dialog = $('#paymentDialog');
  dialog.dataset.custom = String(isCustomRequest);
  $('#paymentOrderPlan').textContent = currentPurchase.planName;
  $('#paymentOrderAmount').textContent = currentPurchase.amount;
  $('#paymentOrderDuration').textContent = isCustomRequest
    ? 'Configuración a medida'
    : currentPurchase.type === 'tokens'
      ? `${Number(currentPurchase.tokenAmount || 0).toLocaleString('es-CO')} tokens adicionales`
      : `Acceso por ${currentPurchase.durationDays} días`;
  $('#paymentOrderStatus').textContent = isCustomRequest ? 'Precio por confirmar' : 'Pendiente de revisión';
  $('#paymentBuyerHint').textContent = isCustomRequest
    ? 'Datos de contacto para que el equipo responda tu solicitud.'
    : 'Confirma quién realizó el pago para poder verificarlo.';
  $('#paymentConfirmNote').textContent = isCustomRequest
    ? 'Tu solicitud será evaluada. No se realizará ningún cobro al enviarla.'
    : 'El acceso o los tokens se activan únicamente tras la aprobación del pago.';
  paymentResetReceiptPreview();
  if (isCustomRequest) {
    $('#customPlanDuration').value = String(currentPurchase.durationDays || 30);
    $('#customPlanTokens').value = String(currentPurchase.monthlyTokens || 500000);
    renderCustomPlanBuilder();
  }
  const modelOptions = $('#paymentModelOptions');
  modelOptions.replaceChildren();
  const needsModels = currentPurchase.type === 'plan' && ['rental', 'model-pack'].includes(currentPurchase.planId);
  modelOptions.hidden = !needsModels;
  if (needsModels) {
    const legend = document.createElement('legend');
    legend.textContent = 'Modelos alquilados';
    modelOptions.append(legend);
    for (const modelId of paidModelIds()) {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'paymentModels';
      checkbox.value = modelId;
      const text = document.createElement('span');
      text.textContent = modelId;
      label.append(checkbox, text);
      modelOptions.append(label);
    }
  }
  refreshPaymentMethodOptions();
  $('#paymentDialog').showModal();
}

function renderCustomPlanBuilder() {
  const benefits = $('#customPlanBenefitOptions');
  const features = $('#customPlanFeatureOptions');
  const models = $('#customPlanModelOptions');
  benefits.replaceChildren();
  features.replaceChildren();
  models.replaceChildren();

  const addChoice = (container, name, value, labelText) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = name;
    checkbox.value = value;
    checkbox.dataset.choiceLabel = labelText;
    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(checkbox, text);
    container.append(label);
  };

  for (const plan of currentSettings.plans.filter(item => item.enabled !== false && item.id !== 'custom-plan')) {
    for (const [index, benefit] of (plan.benefits || []).entries()) {
      addChoice(benefits, 'customSelections', `${plan.id}:${index}`, `${plan.name}: ${benefit}`.slice(0, 180));
    }
  }
  for (const feature of currentSettings.planFeatures || PLAN_FEATURE_OPTIONS) {
    addChoice(features, 'customPlanFeatures', feature.id, feature.label);
  }
  for (const modelId of paidModelIds()) {
    addChoice(models, 'customPlanModels', modelId, modelId);
  }
}

function compressReceipt(file) {
  return new Promise((resolve, reject) => {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      reject(new Error('Elige una imagen JPG, PNG o WebP de hasta 12 MB.'));
      return;
    }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      let quality = 0.72;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 650000 && quality > 0.38) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      if (dataUrl.length > 650000) reject(new Error('La imagen aún es muy grande. Usa un archivo más pequeño o pega un enlace.'));
      else resolve(dataUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen del comprobante.'));
    };
    image.src = objectUrl;
  });
}

// Vista previa local: no sube ni transmite el archivo hasta enviar el formulario.
let paymentPreviewObjectUrl = '';
function paymentResetReceiptPreview() {
  if (paymentPreviewObjectUrl) URL.revokeObjectURL(paymentPreviewObjectUrl);
  paymentPreviewObjectUrl = '';
  const preview = $('#paymentUploadPreview');
  if (preview) preview.hidden = true;
  const image = $('#paymentPreviewImage');
  if (image) image.removeAttribute('src');
  const zone = $('#paymentUploadZone');
  if (zone) zone.classList.remove('is-dragging');
}
function paymentUpdateReceiptPreview() {
  paymentResetReceiptPreview();
  const file = $('#receiptFile').files?.[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    $('#paymentFeedback').textContent = 'Usa JPG, PNG o WebP de hasta 12 MB.';
    $('#receiptFile').value = '';
    return;
  }
  $('#receiptUrl').value = '';
  $('#paymentFeedback').textContent = '';
  paymentPreviewObjectUrl = URL.createObjectURL(file);
  $('#paymentPreviewImage').src = paymentPreviewObjectUrl;
  $('#paymentPreviewName').textContent = file.name;
  $('#paymentPreviewSize').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · imagen seleccionada`;
  $('#paymentUploadPreview').hidden = false;
}
$('#receiptFile').addEventListener('change', paymentUpdateReceiptPreview);
$('#paymentRemoveFile').addEventListener('click', () => {
  $('#receiptFile').value = '';
  paymentResetReceiptPreview();
});
$('#receiptUrl').addEventListener('input', () => {
  if (!$('#receiptUrl').value.trim()) return;
  if ($('#receiptFile').files?.length) {
    $('#receiptFile').value = '';
    paymentResetReceiptPreview();
  }
});
const paymentUploadZone = $('#paymentUploadZone');
['dragenter', 'dragover'].forEach(name => paymentUploadZone.addEventListener(name, event => {
  event.preventDefault();
  if (!$('#paymentDialog').open) return;
  paymentUploadZone.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach(name => paymentUploadZone.addEventListener(name, event => {
  event.preventDefault();
  paymentUploadZone.classList.remove('is-dragging');
}));
paymentUploadZone.addEventListener('drop', event => {
  if (!$('#paymentDialog').open || !event.dataTransfer?.files?.length) return;
  const transfer = new DataTransfer();
  transfer.items.add(event.dataTransfer.files[0]);
  $('#receiptFile').files = transfer.files;
  paymentUpdateReceiptPreview();
});
$('#cancelPayment').addEventListener('click', () => $('#paymentDialog').close());
$('#paymentDialog').addEventListener('close', paymentResetReceiptPreview);

$('#paymentMethod').addEventListener('change', renderPaymentMethodDetails);
$('#closePayment').addEventListener('click', () => $('#paymentDialog').close());
$('#paymentDialog').addEventListener('click', event => { if (event.target === $('#paymentDialog')) $('#paymentDialog').close(); });
$('#planGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-buy-plan]');
  if (button && !button.disabled) openPurchase(button);
});
$('#tokenPackagesGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-buy-token-package]');
  const tokenPackage = currentSettings.tokenPackages.find(item => item.id === button?.dataset.buyTokenPackage);
  if (tokenPackage?.enabled) openTokenPurchase(tokenPackage);
});
$('#paymentForm').addEventListener('submit', async event => {
  event.preventDefault();
  const feedback = $('#paymentFeedback');
  const submit = $('#submitPayment');
  const file = $('#receiptFile').files[0];
  const urlValue = $('#receiptUrl').value.trim();
  const isCustomRequest = currentPurchase?.type === 'custom';
  const paymentMethod = isCustomRequest ? 'custom-request' : $('#paymentMethod').value;
  if (!currentPurchase) return;
  if (!isCustomRequest && !currentSettings.paymentMethods[paymentMethod]?.enabled) {
    feedback.textContent = 'No hay un método de pago disponible. Revisa los planes más tarde.';
    return;
  }
  if (!isCustomRequest && Boolean(file) === Boolean(urlValue)) {
    feedback.textContent = 'Adjunta una imagen o proporciona su enlace, no ambos.';
    return;
  }
  const receiptUrl = !isCustomRequest && urlValue ? safeHttpsUrl(urlValue) : '';
  if (urlValue && !receiptUrl) {
    feedback.textContent = 'El enlace del comprobante debe comenzar con https://.';
    return;
  }
  const models = currentPurchase.type === 'tokens'
    ? []
    : [...document.querySelectorAll(`input[name="${isCustomRequest ? 'customPlanModels' : 'paymentModels'}"]:checked`)].map(input => input.value);
  if (currentPurchase.type === 'plan' && ['rental', 'model-pack'].includes(currentPurchase.planId) && !models.length) {
    feedback.textContent = 'Selecciona al menos un modelo para el alquiler.';
    return;
  }
  const customFeatures = isCustomRequest
    ? [...document.querySelectorAll('input[name="customPlanFeatures"]:checked')].map(input => input.value)
    : [];
  const customSelections = isCustomRequest
    ? [...document.querySelectorAll('input[name="customSelections"]:checked')].map(input => input.dataset.choiceLabel)
    : [];
  const durationDays = isCustomRequest ? Number($('#customPlanDuration').value) : currentPurchase.durationDays;
  const planTokenLimit = isCustomRequest ? Number($('#customPlanTokens').value) : currentPurchase.monthlyTokens;
  if (isCustomRequest && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650
      || !Number.isInteger(planTokenLimit) || planTokenLimit < 0 || planTokenLimit > 100_000_000)) {
    feedback.textContent = 'Revisa la duración y la cantidad de tokens de tu propuesta.';
    return;
  }
  if (isCustomRequest && !customFeatures.length && !customSelections.length && !models.length) {
    feedback.textContent = 'Selecciona al menos una función, beneficio o modelo.';
    return;
  }
  if (customSelections.length > 60 || customFeatures.length > 30 || models.length > 30) {
    feedback.textContent = 'La propuesta supera el máximo de elementos por categoría.';
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Enviando…';
  feedback.textContent = '';
  try {
    const receiptData = !isCustomRequest && file ? await compressReceipt(file) : '';
    const payload = {
      uid: activeUser.uid,
      email: activeUser.email || '',
      buyerName: $('#buyerName').value.trim(),
      payerName: isCustomRequest ? '' : $('#payerName').value.trim(),
      accountName: isCustomRequest ? '' : $('#recipientAccountName').value.trim(),
      accountAlias: isCustomRequest ? '' : $('#payerAlias').value.trim(),
      phone: isCustomRequest ? '' : $('#payerPhone').value.trim(),
      purchaseType: currentPurchase.type,
      planId: currentPurchase.planId,
      planName: currentPurchase.planName,
      durationDays,
      models,
      ...(currentPurchase.type === 'tokens'
        ? {tokenPackageId: currentPurchase.packageId, tokenAmount: currentPurchase.tokenAmount}
        : {planTokenLimit}),
      ...(isCustomRequest ? {customFeatures, customSelections} : {}),
      ...($('#paymentCustomTag').value.trim() ? {customTag: $('#paymentCustomTag').value.trim().slice(0, 32)} : {}),
      amount: currentPurchase.amount,
      currency: currentPurchase.currency,
      paymentMethod,
      status: 'pending',
      createdAt: serverTimestamp(),
      ...(receiptData ? {receiptData} : receiptUrl ? {receiptUrl} : {}),
    };
    await addDoc(collection(db, 'paymentSubmissions'), payload);
    $('#paymentDialog').close();
    toast(isCustomRequest
      ? 'Solicitud enviada al administrador para revisión.'
      : currentPurchase.type === 'tokens'
      ? 'Comprobante enviado. Los tokens se acreditarán al aprobar el pago.'
      : 'Comprobante enviado. El acceso se activará al aprobar el pago.');
  } catch (error) {
    feedback.textContent = error.message || 'No se pudo enviar el comprobante. Revisa la conexión y las reglas de Firestore.';
  } finally {
    submit.disabled = false;
    submit.textContent = isCustomRequest ? 'Enviar solicitud' : 'Enviar comprobante';
  }
});

function renderPaymentQueue() {
  const queue = $('#adminPaymentQueue');
  queue.replaceChildren();
  const count = $('#adminPendingCount');
  const countLabel = $('#adminPaymentCount');
  count.textContent = String(adminPayments.length);
  countLabel.textContent = `${adminPayments.length} pendientes`;
  if (!adminPayments.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-user-empty';
    empty.textContent = 'No hay comprobantes pendientes.';
    queue.append(empty);
    $('#adminPaymentDetail').replaceChildren(empty.cloneNode(true));
    return;
  }
  for (const payment of adminPayments) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-payment-item${selectedPayment?.id === payment.id ? ' active' : ''}`;
    const title = document.createElement('strong');
    title.textContent = payment.buyerName || payment.email || 'Comprador';
    const description = document.createElement('span');
    description.textContent = `${payment.planName || 'Plan'} · ${payment.purchaseType === 'custom' ? 'Solicitud a medida' : methodName(payment.paymentMethod)}`;
    const amount = document.createElement('small');
    amount.textContent = payment.amount || '';
    button.append(title, description, amount);
    button.addEventListener('click', () => {
      selectedPayment = payment;
      renderPaymentQueue();
      renderPaymentDetail(payment);
    });
    queue.append(button);
  }
  if (!selectedPayment || !adminPayments.some(item => item.id === selectedPayment.id)) {
    selectedPayment = adminPayments[0];
    renderPaymentDetail(selectedPayment);
  }
}

function renderPaymentDetail(payment) {
  const detail = $('#adminPaymentDetail');
  detail.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'admin-payment-detail-head';
  const title = document.createElement('h4');
  title.textContent = payment.planName || 'Solicitud de pago';
  const amount = document.createElement('span');
  amount.className = 'payment-amount';
  amount.textContent = payment.amount || '';
  heading.append(title, amount);
  const metadata = document.createElement('dl');
  metadata.className = 'payment-metadata';
  const isTokenPurchase = payment.purchaseType === 'tokens';
  const isCustomRequest = payment.purchaseType === 'custom';
  const planFeatureLabels = new Map((currentSettings.planFeatures || PLAN_FEATURE_OPTIONS).map(feature => [feature.id, feature.label]));
  for (const [label, value] of [
    ['Comprador', payment.buyerName], ['Correo', payment.email], ['Pagó', payment.payerName],
    ['Cuenta', payment.accountName], ['Alias', payment.accountAlias || 'No indicado'], ['Teléfono', payment.phone],
    ['Método', methodName(payment.paymentMethod)],
    ['Compra', isCustomRequest ? 'Solicitud personalizada' : isTokenPurchase ? 'Recarga de tokens' : 'Plan'],
    ['Paquete', isTokenPurchase ? `${Number(payment.tokenAmount || 0).toLocaleString('es-AR')} tokens` : payment.planName],
    ['Modelos', isTokenPurchase ? 'No aplica' : (payment.models || []).join(', ') || 'Incluidos en el plan'],
    ...(isCustomRequest ? [
      ['Etiqueta solicitada', payment.customTag || 'Sin etiqueta'],
      ['Funciones', (payment.customFeatures || []).map(id => planFeatureLabels.get(id) || id).join(', ') || 'Ninguna seleccionada'],
      ['Beneficios', (payment.customSelections || []).join(' · ') || 'Ninguno seleccionado'],
      ['Duración deseada', `${payment.durationDays} días`],
      ['Tokens por ciclo deseados', Number(payment.planTokenLimit || 0).toLocaleString('es-AR')],
    ] : payment.customTag ? [['Etiqueta personalizada', payment.customTag]] : []),
  ]) {
    const row = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const valueNode = document.createElement('dd'); valueNode.textContent = value || '—';
    row.append(term, valueNode); metadata.append(row);
  }
  const receipt = document.createElement('div');
  receipt.className = 'admin-receipt-preview';
  const imageUrl = payment.receiptData || safeHttpsUrl(payment.receiptUrl || '');
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = 'Comprobante enviado';
    receipt.append(image);
  } else {
    const noImage = document.createElement('span'); noImage.textContent = isCustomRequest ? 'Solicitud enviada sin pago adjunto; requiere cotización y revisión.' : 'No hay imagen disponible.'; receipt.append(noImage);
  }
  const actions = document.createElement('div');
  actions.className = 'admin-payment-actions';
  const reject = document.createElement('button');
  reject.type = 'button'; reject.className = 'btn'; reject.textContent = isCustomRequest ? 'Rechazar solicitud' : 'Rechazar';
  reject.addEventListener('click', () => reviewPayment(payment, false));
  const approve = document.createElement('button');
  approve.type = 'button'; approve.className = 'btn primary'; approve.textContent = isCustomRequest ? 'Marcar revisada' : 'Aprobar pago';
  approve.addEventListener('click', () => reviewPayment(payment, true));
  actions.append(reject, approve);
  detail.append(heading, metadata, receipt, actions);
}

async function reviewPayment(payment, approved) {
  if (!ADMIN_EMAILS.has((activeUser?.email || '').toLowerCase())) return;
  const isCustomRequest = payment.purchaseType === 'custom';
  const batch = writeBatch(db);
  const paymentRef = doc(db, 'paymentSubmissions', payment.id);
  const notificationRef = doc(collection(db, 'users', payment.uid, 'notifications'));
  batch.update(paymentRef, {
    status: approved ? isCustomRequest ? 'reviewed' : 'approved' : 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: activeUser.email || '',
  });
  const isTokenPurchase = payment.purchaseType === 'tokens';
  if (approved && !isCustomRequest) {
    const profileRef = doc(db, 'users', payment.uid);
    let profileSnapshot;
    try {
      profileSnapshot = await getDoc(profileRef);
    } catch (error) {
      toast('No se pudo leer el perfil antes de activar el acceso.');
      return;
    }
    const existingProfile = profileSnapshot.exists() ? profileSnapshot.data() : {};
    const identity = {
      displayName: existingProfile.displayName || payment.buyerName || payment.email.split('@')[0],
      photoURL: existingProfile.photoURL || '',
      avatarPath: existingProfile.avatarPath || '',
      email: existingProfile.email || payment.email,
      createdAt: existingProfile.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: activeUser.email || '',
    };
    if (isTokenPurchase) {
      const tokenPackage = currentSettings.tokenPackages.find(item => item.id === payment.tokenPackageId && item.enabled);
      if (!tokenPackage
        || Number(payment.tokenAmount) !== Number(tokenPackage.tokenAmount)
        || payment.amount !== `${tokenPackage.price} ${tokenPackage.currency}`) {
        toast('El paquete cambió o no coincide con la solicitud. Actualiza la cola antes de aprobar.');
        return;
      }
      const currentCreditsExpiry = existingProfile.tokenCreditsExpiresAt?.toDate?.()
        || (existingProfile.tokenCreditsExpiresAt ? new Date(existingProfile.tokenCreditsExpiresAt) : null);
      const hasCurrentCredits = currentCreditsExpiry && currentCreditsExpiry.getTime() > Date.now();
      const planExpiry = existingProfile.expiresAt?.toDate?.()
        || (existingProfile.expiresAt ? new Date(existingProfile.expiresAt) : null);
      const now = new Date();
      const cycleExpiry = planExpiry && planExpiry.getTime() > now.getTime()
        ? planExpiry
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const creditsExpiry = hasCurrentCredits && currentCreditsExpiry > cycleExpiry ? currentCreditsExpiry : cycleExpiry;
      batch.set(profileRef, {
        ...identity,
        tokenCredits: (hasCurrentCredits ? Number(existingProfile.tokenCredits || 0) : 0) + Number(tokenPackage.tokenAmount),
        tokenCreditsExpiresAt: Timestamp.fromDate(creditsExpiry),
      }, { merge: true });
    } else {
      const plan = currentSettings.plans.find(item => item.id === payment.planId && item.enabled !== false);
      if (!plan) {
        toast('El plan ya no está disponible. Actualiza la configuración antes de aprobar.');
        return;
      }
      const models = ['pro', 'studio', 'premium'].includes(plan.id) ? paidModelIds() : (payment.models || []);
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + Number(plan.durationDays || 30) * 86400000));
      batch.set(profileRef, {
        ...identity,
        plan: plan.name,
        planId: plan.id,
        planType: plan.name,
        subscriptionType: plan.name,
        planTokenLimit: Number(plan.monthlyTokens || 0),
        premiumModels: models,
        expiresAt,
        ...(plan.id === 'premium' && payment.customTag ? {customTag: String(payment.customTag).slice(0, 32)} : {}),
      }, { merge: true });
    }
  }
  batch.set(notificationRef, {
    title: approved ? isCustomRequest ? 'Solicitud personalizada revisada' : isTokenPurchase ? 'Tokens acreditados' : 'Pago aprobado' : 'Pago revisado',
    message: approved
      ? isCustomRequest
        ? 'Tu propuesta fue revisada. El acceso se activará cuando el administrador configure las opciones acordadas.'
        : isTokenPurchase
        ? `Se acreditaron ${Number(payment.tokenAmount).toLocaleString('es-AR')} tokens en tu cuenta.`
        : `Tu pago para ${payment.planName} fue aprobado. Ya tienes acceso a las funciones incluidas.`
      : `Tu comprobante para ${payment.planName} no fue aprobado. Revisa los datos y vuelve a enviarlo.`,
    type: 'payment',
    createdAt: serverTimestamp(),
    read: false,
    paymentId: payment.id,
  });
  try {
    await batch.commit();
    selectedPayment = null;
    await loadAdminPayments();
    toast(approved
      ? isCustomRequest ? 'Solicitud marcada como revisada; no se activó acceso automáticamente.' : isTokenPurchase ? 'Tokens acreditados.' : 'Pago aprobado y acceso activado.'
      : isCustomRequest ? 'Solicitud rechazada.' : 'Comprobante rechazado.');
  } catch (error) {
    console.error('No se pudo revisar el pago:', error);
    toast('No se pudo guardar la revisión. Comprueba las reglas publicadas.');
  }
}

async function loadAdminPayments() {
  if (!ADMIN_EMAILS.has((activeUser?.email || '').toLowerCase())) return;
  try {
    const snapshot = await getDocs(query(collection(db, 'paymentSubmissions'), where('status', '==', 'pending')));
    adminPayments = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((left, right) => (right.createdAt?.toDate?.() || 0) - (left.createdAt?.toDate?.() || 0));
    renderPaymentQueue();
  } catch (error) {
    $('#adminPaymentQueue').textContent = 'No se pudieron cargar los comprobantes.';
    console.error('No se pudo cargar la cola de pagos:', error);
  }
}

async function fetchAdminFeedbackBackup(path, options = {}) {
  if (!activeUser) throw new Error('Inicia sesión para revisar el feedback.');
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${await activeUser.getIdToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.error || `Error ${response.status} del servidor de feedback.`);
  return data;
}

async function loadAdminFeedback() {
  if (!ADMIN_EMAILS.has((activeUser?.email || '').toLowerCase())) return;
  const queue = $('#adminFeedbackQueue');
  queue.textContent = 'Cargando feedback…';
  const [firestoreResult, backupResult] = await Promise.allSettled([
    getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(100))),
    fetchAdminFeedbackBackup('/api/admin/feedback'),
  ]);
  const combined = [];
  if (firestoreResult.status === 'fulfilled') {
    combined.push(...firestoreResult.value.docs.map(item => ({id: item.id, ...item.data()})));
  }
  if (backupResult.status === 'fulfilled' && Array.isArray(backupResult.value.items)) {
    combined.push(...backupResult.value.items);
  }
  if (firestoreResult.status !== 'fulfilled' && backupResult.status !== 'fulfilled') {
    console.error('No se pudo cargar el feedback:', firestoreResult.reason, backupResult.reason);
    queue.textContent = 'No se pudo consultar el feedback. Verifica permisos de Firebase, sesión de administrador y servidor Python.';
    return;
  }
  const feedbackTimestamp = item => item.createdAt?.toDate?.()?.getTime() || new Date(item.createdAt || 0).getTime() || 0;
  adminFeedbackItems = combined.sort((a, b) => feedbackTimestamp(b) - feedbackTimestamp(a)).slice(0, 100);
  selectedFeedback = adminFeedbackItems.find(item => item.id === selectedFeedback?.id) || adminFeedbackItems[0] || null;
  renderAdminFeedbackQueue();
}

function renderAdminFeedbackQueue() {
  const queue = $('#adminFeedbackQueue');
  queue.replaceChildren();
  const pendingCount = adminFeedbackItems.filter(item => item.status === 'pending').length;
  $('#adminFeedbackCount').textContent = `${adminFeedbackItems.length} mensajes · ${pendingCount} pendientes`;
  $('#adminFeedbackTabCount').textContent = String(pendingCount);
  if (!adminFeedbackItems.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-user-empty';
    empty.textContent = 'Todavía no hay propuestas recibidas.';
    queue.append(empty);
    $('#adminFeedbackDetail').innerHTML = '<span class="admin-user-empty">Cuando alguien envíe feedback, aparecerá acá.</span>';
    return;
  }
  for (const item of adminFeedbackItems) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-payment-item${selectedFeedback?.id === item.id ? ' active' : ''}`;
    const title = document.createElement('strong');
    title.textContent = item.title || 'Propuesta sin título';
    const description = document.createElement('span');
    description.textContent = `${item.displayName || item.email || 'Usuario'} · ${item.area || 'general'}`;
    const status = document.createElement('small');
    status.textContent = ({pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada'})[item.status] || 'Pendiente';
    button.append(title, description, status);
    button.addEventListener('click', () => {
      selectedFeedback = item;
      renderAdminFeedbackQueue();
      renderAdminFeedbackDetail(item);
    });
    queue.append(button);
  }
  renderAdminFeedbackDetail(selectedFeedback);
}

function renderAdminFeedbackDetail(item) {
  const detail = $('#adminFeedbackDetail');
  detail.replaceChildren();
  if (!item) {
    const empty = document.createElement('span');
    empty.className = 'admin-user-empty';
    empty.textContent = 'Selecciona un mensaje para responderlo.';
    detail.append(empty);
    return;
  }
  const header = document.createElement('div');
  header.className = 'admin-payment-detail-head';
  const title = document.createElement('h4');
  title.textContent = item.title || 'Propuesta';
  const status = document.createElement('span');
  status.className = `feedback-status is-${item.status || 'pending'}`;
  status.textContent = ({pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada'})[item.status] || 'Pendiente';
  header.append(title, status);
  const metadata = document.createElement('dl');
  metadata.className = 'payment-metadata';
  const createdAt = item.createdAt?.toDate?.() || (item.createdAt ? new Date(item.createdAt) : null);
  for (const [label, value] of [
    ['Usuario', item.displayName], ['Correo', item.email], ['Tipo', item.type], ['Área', item.area],
    ['Valoración', item.rating ? `${item.rating} / 5` : 'Sin valoración'],
    ['Recibido', createdAt ? createdAt.toLocaleString('es-AR') : 'Fecha pendiente'],
  ]) {
    const row = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const valueNode = document.createElement('dd'); valueNode.textContent = value || '—';
    row.append(term, valueNode);
    metadata.append(row);
  }
  const message = document.createElement('p');
  message.className = 'admin-feedback-message';
  message.textContent = item.details || '';
  detail.append(header, metadata, message);

  const responseLabel = document.createElement('label');
  responseLabel.className = 'admin-feedback-response-label';
  responseLabel.textContent = 'Respuesta para la persona';
  const responseInput = document.createElement('textarea');
  responseInput.className = 'profile-name-input';
  responseInput.rows = 4;
  responseInput.maxLength = 1200;
  responseInput.placeholder = 'Escribe una respuesta personalizada…';
  responseInput.value = item.response || '';
  responseInput.disabled = item.status !== 'pending';
  responseLabel.append(responseInput);
  detail.append(responseLabel);

  if (item.status === 'pending') {
    const actions = document.createElement('div');
    actions.className = 'admin-payment-actions';
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'btn';
    reject.textContent = 'Rechazar';
    reject.addEventListener('click', () => saveAdminFeedbackReview(item, 'rejected', responseInput.value));
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'btn primary';
    accept.textContent = 'Aceptar propuesta';
    accept.addEventListener('click', () => saveAdminFeedbackReview(item, 'accepted', responseInput.value));
    actions.append(reject, accept);
    detail.append(actions);
  } else if (item.response) {
    const savedResponse = document.createElement('p');
    savedResponse.className = 'feedback-response';
    savedResponse.textContent = `Respuesta enviada: ${item.response}`;
    detail.append(savedResponse);
  }
  const removeBar = document.createElement('div');
  removeBar.className = 'nexus-admin-feedback-remove-bar';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'nexus-admin-feedback-delete';
  remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg><span>Eliminar definitivamente</span>';
  remove.addEventListener('click', async () => {
    if (!(await window.nexusConfirmFeedback({title: item.title || 'Propuesta', description: 'Se borrará del panel admin y del historial del usuario. No se puede recuperar.'}))) return;
    remove.disabled = true;
    try {
      if (item.source === 'nexus-backup') {
        await fetchAdminFeedbackBackup(`/api/admin/feedback/${encodeURIComponent(item.id)}`, {method: 'DELETE'});
      } else {
        await deleteDoc(doc(db, 'feedback', item.id));
      }
      toast('Propuesta eliminada definitivamente.');
      selectedFeedback = null;
      await loadAdminFeedback();
    } catch (error) {
      console.error('No se pudo borrar el feedback:', error);
      toast(error.code === 'permission-denied' ? 'Firestore bloqueó el borrado. Revisa las reglas de seguridad.' : (error.message || 'No se pudo borrar.'));
      remove.disabled = false;
    }
  });
  removeBar.append(remove);
  detail.append(removeBar);
}

async function saveAdminFeedbackReview(item, status, response) {
  if (!ADMIN_EMAILS.has((activeUser?.email || '').toLowerCase())) return;
  const message = response.trim().slice(0, 1200);
  if (!message) return toast('Escribe una respuesta antes de revisar la propuesta.');
  try {
    if (item.source === 'nexus-backup') {
      await fetchAdminFeedbackBackup('/api/admin/feedback/review', {
        method: 'POST', body: JSON.stringify({id: item.id, status, response: message}),
      });
    } else {
      await updateDoc(doc(db, 'feedback', item.id), {
        status,
        response: message,
        reviewedAt: serverTimestamp(),
        reviewedBy: activeUser.email || '',
      });
    }
    toast(status === 'accepted' ? 'Propuesta aceptada y respuesta enviada.' : 'Propuesta rechazada y respuesta enviada.');
    await loadAdminFeedback();
  } catch (error) {
    console.error('No se pudo guardar la respuesta de feedback:', error);
    toast(error.code === 'permission-denied' ? 'Firestore no permite revisar feedback. Publica las reglas actualizadas.' : 'No se pudo guardar la respuesta.');
  }
}

function renderNotifications(items) {
  const container = $('#notificationList');
  container.replaceChildren();
  const unread = items.filter(item => !item.read).length;
  $('#notificationCount').textContent = unread > 9 ? '9+' : String(unread);
  $('#notificationCount').hidden = unread === 0;
  $('#notificationLabel').textContent = `${unread} nuevas`;
  window.dispatchEvent(new CustomEvent('nx-local-notifications', { detail: {unread} }));
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'notification-empty';
    empty.textContent = 'No tienes notificaciones.';
    container.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('article');
    row.className = `notification-item${item.read ? '' : ' unread'}`;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'notification-copy';
    const title = document.createElement('strong'); title.textContent = item.title || 'Notificación';
    const message = document.createElement('span'); message.textContent = item.message || '';
    copy.append(title, message);
    copy.addEventListener('click', async () => {
      if (!item.read) await updateDoc(doc(db, 'users', activeUser.uid, 'notifications', item.id), { read: true });
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'notification-remove'; remove.setAttribute('aria-label', 'Borrar notificación'); remove.title = 'Borrar'; remove.textContent = '×';
    remove.addEventListener('click', async () => {
      await deleteDoc(doc(db, 'users', activeUser.uid, 'notifications', item.id));
    });
    row.append(copy, remove); container.append(row);
  }
}

function playNotificationSound(value = currentSettings.webCustomization?.notificationSoundUrl) {
  const soundUrl = safeHttpsUrl(value || '');
  if (!soundUrl) return;
  const host = document.getElementById('notificationSoundHost') || document.body.appendChild(document.createElement('div'));
  host.id = 'notificationSoundHost';
  host.replaceChildren();
  const youtubeId = soundUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  if (youtubeId) {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&playsinline=1`;
    frame.title = 'Sonido de notificación';
    frame.allow = 'autoplay';
    host.append(frame);
    window.setTimeout(() => frame.remove(), 15000);
    return;
  }
  const media = document.createElement(/\.mp4(?:$|[?#])/i.test(soundUrl) ? 'video' : 'audio');
  media.src = soundUrl;
  media.volume = 0.65;
  media.autoplay = true;
  media.playsInline = true;
  media.onended = () => media.remove();
  host.append(media);
  media.play().catch(error => console.info('El navegador bloqueó el sonido de notificación:', error));
}

function listenToNotifications(user) {
  notificationUnsubscribe?.();
  let firstSnapshot = true;
  const knownIds = new Set();
  notificationUnsubscribe = onSnapshot(collection(db, 'users', user.uid, 'notifications'), snapshot => {
    const incoming = snapshot.docChanges().filter(change => change.type === 'added' && !knownIds.has(change.doc.id));
    snapshot.docs.forEach(item => knownIds.add(item.id));
    if (!firstSnapshot && incoming.some(change => !change.doc.data().read)) {
      playNotificationSound();
    }
    firstSnapshot = false;
    const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      .sort((left, right) => (right.createdAt?.toDate?.() || 0) - (left.createdAt?.toDate?.() || 0));
    renderNotifications(items);
  }, error => {
    console.error('No se pudieron cargar las notificaciones:', error);
  });
}

document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', () => setAdminTab(button.dataset.adminTab)));
initializePlanCardMotion();
document.querySelector('#addPlanConfig').addEventListener('click', () => {
  if (currentSettings.plans.length >= 30) return toast('Puedes configurar hasta 30 planes.');
  const suffix = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 10) || Date.now().toString(36);
  currentSettings.plans.push({
    id: `custom-${suffix}`,
    name: 'Nuevo plan', description: '', price: '', currency: 'ARS', durationDays: 30,
    monthlyTokens: 1_000_000, badge: '', periodLabel: 'mes', benefits: [],
    features: [...CORE_PLAN_FEATURES], enabled: false, featured: false, backgroundColor: '', backgroundImage: '',
  });
  renderPlanSettings();
});
document.querySelector('#addPlanComparisonRow').addEventListener('click', () => {
  if (currentSettings.comparisonRows.length >= 20) return toast('Puedes agregar hasta 20 filas a la comparativa.');
  currentSettings.comparisonRows = readPlanComparisonDrafts();
  const id = globalThis.crypto?.randomUUID?.() || `comparison-${Date.now().toString(36)}`;
  currentSettings.comparisonRows.push({id, label: 'Nueva característica', values: {}});
  renderPlanComparisonSettings();
});
document.querySelector('#addPlanFeature').addEventListener('click', () => addPlanFeature($('#newPlanFeatureLabel').value));
document.querySelector('#newPlanFeatureLabel').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); addPlanFeature(event.currentTarget.value); }
});
document.querySelector('#addAiModel').addEventListener('click', () => {
  if (currentSettings.models.length >= 30) return toast('Puedes configurar hasta 30 modelos.');
  const modelId = document.querySelector('#newAiModelId').value.trim();
  if (!/^Nexus-?[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/.test(modelId)) {
    return toast('Escribe un ID válido con el formato Nexus-Day.');
  }
  if (currentSettings.models.some(model => model.id === modelId)) return toast(`Ya existe el modelo ${modelId}.`);
  currentSettings.models.push({
    id: modelId,
    name: modelId,
    providerModel: '',
    provider: 'openrouter',
    tier: 'free',
    tokenLimit: 0,
    imageUrl: '',
    description: '',
    enabled: false,
  });
  document.querySelector('#newAiModelId').value = '';
  renderModelSettings();
});
document.querySelector('#addPaymentMethod').addEventListener('click', () => {
  if (Object.keys(currentSettings.paymentMethods).length >= 8) return toast('Puedes configurar hasta 8 métodos de pago.');
  const randomId = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) || Date.now().toString(36);
  const id = `custom-${randomId}`;
  currentSettings.paymentMethods[id] = { id, name: 'Nuevo método', enabled: false, accountName: '', identifier: '', instructions: '', iconUrl: '', iconData: '' };
  renderPaymentMethodSettings();
});
document.querySelector('#addTokenPackage').addEventListener('click', () => {
  if (currentSettings.tokenPackages.length >= 20) return toast('Puedes configurar hasta 20 paquetes de tokens.');
  const suffix = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 10) || Date.now().toString(36);
  currentSettings.tokenPackages.push({
    id: `tokens-${suffix}`, name: 'Nuevo paquete', description: '', tokenAmount: 500_000,
    price: '', currency: 'ARS', enabled: false, backgroundImage: '', backgroundVideo: '',
  });
  renderTokenPackageSettings();
});
document.querySelector('#saveTokenPackages').addEventListener('click', async () => {
  try {
    await saveSettings({ tokenPackages: readTokenPackageSettings() });
    renderTokenPackageSettings();
    toast('Paquetes de tokens guardados.');
  } catch (error) {
    toast(error.message || 'No se pudieron guardar los paquetes de tokens.');
  }
});
document.querySelector('#savePlanConfig').addEventListener('click', async () => {
  try {
    const plans = readPlanSettings();
    const comparisonRows = readPlanComparisonSettings(plans);
    await saveSettings({ plans, planFeatures: currentSettings.planFeatures, comparisonRows });
    renderPlanSettings();
    toast('Planes y comparativa guardados.');
  } catch (error) {
    toast(error.message || 'No se pudieron guardar los planes.');
  }
});
document.querySelector('#saveModelConfig').addEventListener('click', async () => {
  try {
    const { models, disabledVoiceModels } = readModelSettings();
    await saveSettings({ models });
    renderModelSettings();
    toast(disabledVoiceModels.length
      ? `Catálogo guardado. Se desactivaron ${disabledVoiceModels.length} modelo${disabledVoiceModels.length === 1 ? '' : 's'} de voz incompatible${disabledVoiceModels.length === 1 ? '' : 's'}.`
      : 'Catálogo de modelos guardado.');
  } catch (error) {
    toast(error.message || 'No se pudieron guardar los modelos. Revisa las reglas de Firestore.');
  }
});
document.querySelector('#savePaymentMethods').addEventListener('click', async () => {
  try {
    await saveSettings({ paymentMethods: readPaymentMethodSettings() });
    renderPaymentMethodSettings();
    refreshPaymentMethodOptions();
    toast('Métodos de pago guardados.');
  } catch (error) {
    toast(error.message || 'No se pudieron guardar los métodos. Revisa las reglas de Firestore.');
  }
});
document.querySelector('#saveWebCustomization').addEventListener('click', async () => {
  try {
    const customization = readWebCustomizationSettings();
    const loginBranding = readLoginBrandingSettings(customization.faviconUrl);
    currentSettings.webCustomization = customization;
    await saveSettings({ webCustomization: customization });
    await setDoc(LOGIN_BRANDING_REF, {
      ...loginBranding,
      updatedAt: serverTimestamp(),
      updatedBy: activeUser?.email || '',
    });
    currentLoginBranding = loginBranding;
    applyWebCustomization();
    renderWebCustomizationSettings();
    toast('Personalización guardada.');
  } catch (error) {
    toast(error.message || 'No se pudo guardar la personalización de la web.');
  }
});
document.querySelector('#notificationButton').addEventListener('click', () => {
  $('#notificationPanel').hidden = !$('#notificationPanel').hidden;
});
document.addEventListener('click', event => {
  if (!event.target.closest('.notification-wrap')) $('#notificationPanel').hidden = true;
});
document.querySelector('#adminDialog').addEventListener('close', () => setAdminTab('users'));
window.addEventListener('admin-open', async () => {
  if (!ADMIN_EMAILS.has((activeUser?.email || '').toLowerCase())) return;
  await loadSettings();
  await loadAdminPayments();
  setAdminTab('users');
});

authReady.then(() => onAuthStateChanged(auth, async user => {
  notificationUnsubscribe?.();
  profileUnsubscribe?.();
  activeUser = user;
  if (!user) return;
  profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), snapshot => {
    userProfile = snapshot.exists() ? snapshot.data() : {};
    updatePlanCards(userProfile);
    window.dispatchEvent(new CustomEvent('access-profile-updated', { detail: userProfile }));
  }, () => { userProfile = {}; });
  listenToNotifications(user);
  await loadSettings();
}));
