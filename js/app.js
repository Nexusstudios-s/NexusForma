import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, authReady, db } from './firebase.js';

const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    // Tarjetas luminosas que siguen el mouse sin oscurecer el diseño.
    // Delegación de eventos: también funciona con mini agentes renderizados después.
    (() => {
      const canFollow = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
      if (!canFollow.matches) return;
      const selector = '.mini-agent-template-card, .mini-agent-card, .home-example, .home-action-card, .home-agent-list button, .home-resume-button';
      let active = null;
      let pending = null;
      let frameId = 0;
      function clearActive() {
        if (!active) return;
        active.classList.remove('nexus-follow-active');
        active.style.removeProperty('--nexus-tilt-x');
        active.style.removeProperty('--nexus-tilt-y');
        active = null;
      }
      function draw() {
        frameId = 0;
        if (!pending) return;
        const {card, x, y} = pending;
        pending = null;
        if (card !== active) { clearActive(); active = card; active.classList.add('nexus-follow-active'); }
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const relX = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        const relY = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
        card.style.setProperty('--nexus-shine-x', `${Math.round(relX * 100)}%`);
        card.style.setProperty('--nexus-shine-y', `${Math.round(relY * 100)}%`);
        card.style.setProperty('--nexus-tilt-x', `${((.5 - relY) * 4.5).toFixed(2)}deg`);
        card.style.setProperty('--nexus-tilt-y', `${((relX - .5) * 4.5).toFixed(2)}deg`);
      }
      for (const view of $$('#view-home, #view-agents')) {
        view.addEventListener('pointermove', event => {
          if (event.pointerType !== 'mouse') return;
          const card = event.target.closest(selector);
          if (!card || !view.contains(card)) { pending = null; clearActive(); return; }
          pending = {card, x: event.clientX, y: event.clientY};
          if (!frameId) frameId = requestAnimationFrame(draw);
        }, {passive: true});
        view.addEventListener('pointerleave', () => { pending = null; clearActive(); }, {passive: true});
      }
      canFollow.addEventListener?.('change', () => { if (!canFollow.matches) { pending = null; clearActive(); } });
    })();

    const toast = (message) => { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2800); };

const themeToggle = $('#themeToggle');
const savedTheme = localStorage.getItem('nexus-theme');
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function setTheme(theme, savePreference = false) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('nexus-theme', theme);
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#101815' : '#f4f6f3';
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  themeToggle.title = theme === 'dark' ? 'Tema claro' : 'Tema oscuro';
  if (savePreference) saveUserPreference('theme', theme);
}

setTheme(savedTheme || preferredTheme);
themeToggle.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
    const pageCopy = {
      create: ['Crear imagen', 'Tu estudio creativo', 'Dale forma a tus ideas', 'Describe lo que imaginas. Nosotros ponemos el primer píxel.'],
      edit: ['Editar foto', 'Edición local', 'Encuentra el tono exacto', 'Ajusta luz y color en tu dispositivo, sin subir tu imagen.'],
      video: ['Editar vídeo', 'Edición local', 'Quédate con lo esencial', 'Selecciona un tramo y expórtalo directamente desde el navegador.'],
      agents: ['Mini agentes', 'Asistentes a tu manera', 'Mini agentes', 'Creá un asistente para una tarea y volvé a usarlo cuando quieras.'],
      explore: ['Explorar', 'Mapa mundial', 'Explorar el mundo', 'Busca ciudades y lugares en un mapa interactivo.'],
      usage: ['Uso y tokens', 'Tu cuenta', 'Uso y tokens', 'Consumo real registrado en el backend.'],
      chat: ['Chat IA', 'Asistente creativo', '¿Qué tienes en mente?', 'Cuéntame lo que quieres crear o resolver.'],
      plans: ['Planes', 'Crece a tu ritmo', 'Un plan para cada idea', 'Empieza gratis. Pásate a Pro cuando tu proceso lo pida.'],
      library: ['Biblioteca', 'Tus imágenes', 'Biblioteca creativa', 'Tus imágenes generadas, guardadas en tu cuenta.'],
      others: ['Otros', 'Ecosistema Nexus', 'Nexus y sus servicios', 'Beneficios, condiciones de compra y enlaces del ecosistema.'],
      home: ['Inicio', 'Una mano para lo que tenés en mente', '¿Qué tenés entre manos?', 'Una duda, una idea para tu negocio o algo que querés aprender.']
    };
    const VIEW_FEATURES = {create: 'create', edit: 'edit', video: 'video', chat: 'chat'};
    const FEATURE_LABELS = {create: 'Crear imágenes', edit: 'Editar fotos', video: 'Editar vídeos', chat: 'Chat IA', history: 'el historial'};
    let configuredPlans = [];
    const discordInviteCodes = ['nZ42azXrTQ', 'kQ8pxqmhfS', 'p2bQMgcQ3s'];
    let discordPresenceCache = null;
    let discordPresenceLoadedAt = 0;
    let discordPresenceRequest = null;

    function renderDiscordPresence(presence) {
      for (const code of discordInviteCodes) {
        const row = $(`[data-discord-code="${code}"]`);
        const status = row?.querySelector('[data-discord-presence]');
        const item = presence.find(entry => entry.code === code);
        if (!row || !status) continue;
        if (!item) {
          status.textContent = 'Abrir comunidad';
          row.dataset.presence = '';
          continue;
        }
        status.textContent = `≈${item.online} en línea · ${item.members} miembros`;
        row.dataset.presence = item.online > 0 ? 'online' : 'offline';
      }
    }

    async function loadDiscordPresence() {
      const status = $('#discordPresenceStatus');
      if (discordPresenceCache && Date.now() - discordPresenceLoadedAt < 120_000) {
        renderDiscordPresence(discordPresenceCache);
        return;
      }
      if (discordPresenceRequest) return discordPresenceRequest;
      status.textContent = 'Consultando presencia aproximada…';
      discordPresenceRequest = Promise.all(discordInviteCodes.map(async code => {
        try {
          const response = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`);
          if (!response.ok) throw new Error('Discord no está disponible.');
          const data = await response.json();
          return {
            code,
            online: Math.max(0, Number(data.approximate_presence_count) || 0),
            members: Math.max(0, Number(data.approximate_member_count) || 0),
          };
        } catch {
          return null;
        }
      })).then(results => {
        const presence = results.filter(Boolean);
        if (!presence.length) throw new Error('No se pudo consultar la presencia de Discord.');
        discordPresenceCache = presence;
        discordPresenceLoadedAt = Date.now();
        renderDiscordPresence(presence);
        status.textContent = presence.length === discordInviteCodes.length
          ? 'Presencia aproximada · actualizada ahora'
          : 'Presencia parcial · algunos servidores no respondieron';
      }).catch(() => {
        status.textContent = discordPresenceCache ? 'No se pudo actualizar; se muestra el último estado.' : 'Presencia no disponible · los enlaces siguen activos.';
        if (discordPresenceCache) renderDiscordPresence(discordPresenceCache);
        else renderDiscordPresence([]);
      }).finally(() => { discordPresenceRequest = null; });
      return discordPresenceRequest;

    }

    function activePlanId(profile = activeUserProfile) {
      const expiry = profile.expiresAt?.toDate?.() || (profile.expiresAt ? new Date(profile.expiresAt) : null);
      if (expiry && expiry.getTime() <= Date.now()) return 'free';
      if (profile.planId) return profile.planId;
      return ({Gratis: 'free', Pro: 'pro', Estudio: 'studio', Premium: 'premium', Alquiler: 'rental'})[profile.plan] || 'free';
    }

    function chatRetentionDays(profile = activeUserProfile) {
      const planId = activePlanId(profile);
      if (planId === 'free') return 5;
      const configuredPlan = configuredPlans.find(plan => plan.id === planId);
      const configuredDays = Number(configuredPlan?.historyRetentionDays ?? configuredPlan?.durationDays);
      if (Number.isInteger(configuredDays) && configuredDays > 0) return Math.min(configuredDays, 3650);
      return ({free: 5, pro: 30, studio: 30, premium: 30, rental: 7, 'model-pack': 90})[planId] || 5;
    }

    function updateChatRetentionLabel() {
      const label = $('#chatRetentionLabel');
      const days = chatRetentionDays();
      if (label) label.textContent = `${days} días`;
      const note = $('#chatRetentionNote');
      if (note) note.textContent = `Se guardan y caducan a los ${days} días.`;
    }

    function planHasFeature(feature) {
      const planId = activePlanId();
      if (planId.startsWith('custom-')) {
        return Array.isArray(activeUserProfile.customFeatures) && activeUserProfile.customFeatures.includes(feature);
      }
      const plan = configuredPlans.find(item => item.id === planId);
      return !Array.isArray(plan?.features) || plan.features.includes(feature);
    }

    function canUseImageLibrary(profile = activeUserProfile) {
      return ['pro', 'premium'].includes(activePlanId(profile));
    }

    // Editar mensajes, detener la respuesta y adjuntar archivos: solo Pro y Premium.
    function hasChatProTools(profile = activeUserProfile) {
      return ['pro', 'premium'].includes(activePlanId(profile));
    }

    function requireChatProTools(featureLabel) {
      if (hasChatProTools()) return true;
      toast(`${featureLabel} está disponible solo en los planes Pro y Premium.`);
      setActiveView('plans');
      return false;
    }

    function hasPremiumEditorAccess(profile = activeUserProfile) {
      return ['pro', 'premium'].includes(activePlanId(profile));
    }

    function syncPremiumEditorAccess() {
      const allowed = hasPremiumEditorAccess();
      $$('[data-editor-premium], [data-video-premium]').forEach(option => { option.disabled = !allowed; });
      $('#editorPremiumNote').hidden = allowed;
      let resetSelection = false;
      if (!allowed && $('#editorEffect').selectedOptions[0]?.dataset.editorPremium) {
        $('#editorEffect').value = 'none';
        resetSelection = true;
      }
      if (!allowed && $('#editorFont').selectedOptions[0]?.dataset.editorPremium) {
        $('#editorFont').value = 'instrument';
        resetSelection = true;
      }
      if (!allowed && $('#videoEffect').selectedOptions[0]?.dataset.videoPremium) {
        $('#videoEffect').value = 'none';
        resetSelection = true;
      }
      if (!allowed && $('#videoFont').selectedOptions[0]?.dataset.videoPremium) {
        $('#videoFont').value = 'instrument';
        resetSelection = true;
      }
      if (!allowed && $('#videoTextEffect').selectedOptions[0]?.dataset.videoPremium) {
        $('#videoTextEffect').value = 'clean';
        resetSelection = true;
      }
      $('#videoPremiumNote').hidden = allowed;
      if (resetSelection) {
        renderEditorPreview();
      }
    }

    function applyPlanFeatureAccess() {
      updateChatRetentionLabel();
      const historyEnabled = planHasFeature('history');
      $('.chat-history').hidden = !historyEnabled;
      $('.chat-workspace').classList.toggle('without-history', !historyEnabled);
      if (!historyEnabled) {
        savedChatSessions = [];
        renderChatSessions();
      } else {
        loadChatSessions();
      }
      const currentView = $('.view.active')?.id.replace('view-', '');
      if (VIEW_FEATURES[currentView] && !planHasFeature(VIEW_FEATURES[currentView])) setActiveView('home');
    }

    function setActiveView(view) {
      const copy = pageCopy[view];
      if (!copy) return;
      if (view === 'library' && !canUseImageLibrary()) {
        toast('La Biblioteca requiere un plan Pro o Premium.');
        setActiveView('plans');
        return false;
      }
      const requiredFeature = VIEW_FEATURES[view];
      if (requiredFeature && !planHasFeature(requiredFeature)) {
        toast(`${FEATURE_LABELS[requiredFeature]} no está incluido en tu plan. Revisa Planes.`);
        setActiveView('plans');
        return false;
      }
      $$('.nav button').forEach(item => item.classList.toggle('active', item.dataset.view === view));
      $$('.view').forEach(item => item.classList.toggle('active', item.id === `view-${view}`));
      const [crumb, eyebrow, title, description] = copy;
      $('#pageHead').hidden = ['home', 'agents', 'usage', 'explore'].includes(view);
      $('#newProject').hidden = view === 'others';
      $('#crumbTitle').textContent = crumb; $('#eyebrowText').textContent = eyebrow; $('#pageTitle').textContent = title; $('#pageDescription').textContent = description;
      if (view === 'library') loadImageLibrary();
      if (view === 'others') { loadDiscordPresence(); loadMyFeedback(); }
      window.scrollTo({top: 0, behavior: 'smooth'});
      return true;
    }
    $$('.nav button').forEach(button => button.addEventListener('click', () => setActiveView(button.dataset.view)));
    const appShell = $('.shell');
    let sidebarCollapsed = localStorage.getItem('nexus-sidebar-collapsed') === 'true';
    let mobileNavHidden = localStorage.getItem('nexus-mobile-nav-hidden') === 'true';
    appShell.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    appShell.classList.toggle('mobile-nav-hidden', mobileNavHidden);

    function syncSidebarToggleButtons() {
      const isMobile = window.matchMedia('(max-width: 760px)').matches;
      const isDesktop = window.matchMedia('(min-width: 1101px)').matches;
      const expanded = isMobile ? !mobileNavHidden : !sidebarCollapsed;
      const label = isMobile
        ? (expanded ? 'Ocultar navegación' : 'Mostrar navegación')
        : isDesktop
          ? (expanded ? 'Contraer barra lateral' : 'Expandir barra lateral')
          : (expanded ? 'Ocultar barra lateral' : 'Mostrar barra lateral');
      for (const button of [$('#sidebarToggle'), $('#mobileSidebarToggle')]) {
        button.setAttribute('aria-expanded', String(expanded));
        button.setAttribute('aria-label', label);
        button.title = label;
      }
    }

    function toggleSidebar() {
      sidebarCollapsed = !sidebarCollapsed;
      appShell.classList.toggle('sidebar-collapsed', sidebarCollapsed);
      localStorage.setItem('nexus-sidebar-collapsed', String(sidebarCollapsed));
      syncSidebarToggleButtons();
    }

    $('#sidebarToggle').addEventListener('click', toggleSidebar);
    $('#mobileSidebarToggle').addEventListener('click', () => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        mobileNavHidden = !mobileNavHidden;
        appShell.classList.toggle('mobile-nav-hidden', mobileNavHidden);
        localStorage.setItem('nexus-mobile-nav-hidden', String(mobileNavHidden));
      } else {
        toggleSidebar();
        return;
      }
      syncSidebarToggleButtons();
    });
    window.addEventListener('resize', syncSidebarToggleButtons);
    syncSidebarToggleButtons();
    $('#shareNexusForma').addEventListener('click', async () => {
      const shareData = {
        title: 'Nexus Forma',
        text: 'Conoce Nexus Forma, el estudio creativo con IA del ecosistema Nexus.',
        url: new URL('login.html', window.location.href).href,
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
          return;
        }
        await navigator.clipboard.writeText(shareData.url);
        toast('Enlace de Nexus Forma copiado.');
      } catch (error) {
        if (error.name === 'AbortError') return;
        toast('No se pudo compartir el enlace.');
      }
    });
    $$('[data-home-view]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.homeFocus === 'history' && !planHasFeature('history')) {
        toast('El historial no está incluido en tu plan. Revisa Planes.');
        setActiveView('plans');
        return;
      }
      if (!setActiveView(button.dataset.homeView)) return;
      if (button.dataset.homeFocus === 'history') {
        requestAnimationFrame(() => $('#chatSessionList').scrollIntoView({block: 'nearest', behavior: 'smooth'}));
      }
    }));
    $('#homeContinueButton').addEventListener('click', async event => {
      if (!setActiveView('chat')) return;
      const sessionId = event.currentTarget.dataset.sessionId;
      if (sessionId && activeChatUser && planHasFeature('history')) {
        await openChatSession(sessionId);
        return;
      }
      chatInput.focus({preventScroll: true});
    });
    $$('[data-home-target]').forEach(button => button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.homeTarget);
      if (target?.classList.contains('home-agents')) {
        setActiveView('agents');
        return;
      }
      target?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }));

    const chatHistory = [];
    let chatBusy = false;
    let chatNextAllowedAt = 0;
    const chatForm = $('#chatForm');
    const chatInput = $('#chatInput');
    const chatSend = $('#chatSend');
    const chatEffortTrigger = $('#chatEffortTrigger');
    const chatEffortMenu = $('#chatEffortMenu');
    const CHAT_EFFORT_NAMES = {auto: 'Auto', low: 'Bajo', medium: 'Medio', high: 'Alto'};
    let selectedReasoningEffort = 'auto';
    try {
      const previousEffort = localStorage.getItem('nexus-chat-reasoning-effort');
      if (Object.hasOwn(CHAT_EFFORT_NAMES, previousEffort)) selectedReasoningEffort = previousEffort;
    } catch {}
    const chatWelcome = $('#chatWelcome');
    const FREE_TOKEN_LIMIT = 500_000;
    const chatSessionList = $('#chatSessionList');
    let activeChatUser = null;
    let myFeedbackLoadVersion = 0;
    let activeChatSessionId = null;
    let savedChatSessions = [];
    let chatHistoryBusy = false;
    let chatSessionLoadId = 0;
    let activeUsageConversationId = newConversationId();
    let activeAgentInstructions = '';
    let activeAgentName = '';
    let activeMiniAgentId = '';
    let userMiniAgents = [];
    let miniAgentEditingId = '';
    let chatDeleteResolver = null;
    let chatAnswerDeleteResolver = null;
    let pendingChatImages = [];
    let pendingChatAudio = null;
    let pendingChatFiles = [];
    let chatAbortController = null;
    let explainStepsEnabled = false;
    let webSearchEnabled = false;
    let activeSpeechRecognition = null;
    let activeUserProfile = {};
    let configuredModels = [];
    let chatAssistantLogoUrl = '';
    let preferenceSaveTimer = 0;
    const PREMIUM_MODELS = ['Nexus-Premium', 'Nexus-SST', 'Nexus-Sonet', 'Nexus-Astra'];
    const DEFAULT_MODELS = [
      {id: 'Nexus-St', name: 'Nexus-St', tier: 'free', vision: false, audio: false},
      {id: 'Nexus-Pro', name: 'Nexus-Pro', tier: 'free', vision: true, audio: false},
      {id: 'Nexus-Basic', name: 'Nexus-Basic', tier: 'free', vision: false, audio: false},
      ...PREMIUM_MODELS.map(id => ({id, name: id, tier: 'premium', vision: id === 'Nexus-SST', audio: id === 'Nexus-SST'})),
    ];

    function newConversationId() {
      return globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function saveUserPreference(key, value) {
      if (!activeChatUser || !['model', 'theme'].includes(key)) return;
      const preferences = { ...(activeUserProfile.preferences || {}), [key]: value };
      activeUserProfile = { ...activeUserProfile, preferences };
      try {
        localStorage.setItem(`nexus-${activeChatUser.uid}-${key}`, value);
      } catch {}
      window.clearTimeout(preferenceSaveTimer);
      const userId = activeChatUser.uid;
      preferenceSaveTimer = window.setTimeout(async () => {
        if (activeChatUser?.uid !== userId) return;
        try {
          await setDoc(doc(db, 'users', userId), {
            displayName: activeUserProfile.displayName || activeChatUser.displayName || activeChatUser.email?.split('@')[0] || 'Usuario',
            photoURL: activeUserProfile.photoURL || activeChatUser.photoURL || '',
            avatarPath: activeUserProfile.avatarPath || '',
            email: activeChatUser.email || '',
            preferences,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.warn('No se pudo sincronizar la preferencia en Firestore:', error);
          toast('No se pudo guardar esta preferencia en tu cuenta.');
        }
      }, 300);
    }

    function renderModelSelector() {
      const select = $('#chatModel');
      const selectedModel = select.value || 'Nexus-St';
      select.replaceChildren();
      const models = configuredModels.length ? configuredModels : DEFAULT_MODELS;
      for (const model of models) {
        if (model.enabled === false) continue;
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name || model.id;
        option.dataset.tier = model.tier || (PREMIUM_MODELS.includes(model.id) ? 'premium' : 'free');
        select.append(option);
      }
      if (!select.options.length) {
        const option = document.createElement('option');
        option.value = 'Nexus-St';
        option.textContent = 'Nexus-St';
        select.append(option);
      }
      if (![...select.options].some(option => option.value === selectedModel)) select.value = select.options[0].value;
      else select.value = selectedModel;
      updateSelectedModelUI();
    }

    function renderModelOptions() {
      const select = $('#chatModel');
      const options = $('#chatModelOptions');
      const selectedModel = select.value;
      options.replaceChildren();
      for (const nativeOption of select.options) {
        const model = configuredModels.find(item => item.id === nativeOption.value)
          || DEFAULT_MODELS.find(item => item.id === nativeOption.value)
          || {id: nativeOption.value, name: nativeOption.textContent, tier: nativeOption.dataset.tier};
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'chat-model-option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(model.id === selectedModel));
        const name = document.createElement('span');
        name.className = 'chat-model-option-name';
        name.textContent = model.name || model.id;
        const tier = document.createElement('span');
        tier.className = `chat-model-option-tier${model.tier === 'premium' ? ' is-premium' : model.tier === 'pro' ? ' is-pro' : ''}`;
        tier.textContent = ({free: 'Gratis', pro: 'Pro', premium: 'Premium'})[model.tier] || 'Gratis';
        const details = document.createElement('span');
        details.className = 'chat-model-option-details';
        const capabilities = [model.vision === true && 'Imagen', model.audio === true && 'Voz'].filter(Boolean);
        details.textContent = capabilities.length ? capabilities.join(' · ') : 'Solo texto';
        option.append(name, tier, details);
        option.addEventListener('click', () => {
          select.value = model.id;
          select.dispatchEvent(new Event('change', {bubbles: true}));
          closeChatModelOptions(true);
        });
        options.append(option);
      }
      const model = configuredModels.find(item => item.id === selectedModel)
        || DEFAULT_MODELS.find(item => item.id === selectedModel);
      $('#chatModelTriggerLabel').textContent = model?.name || selectedModel;
      $('#chatModelTrigger').setAttribute('aria-label', `Modelo de IA: ${model?.name || selectedModel}`);
    }

    function closeChatModelOptions(returnFocus = false) {
      $('#chatModelOptions').hidden = true;
      $('#chatModelTrigger').setAttribute('aria-expanded', 'false');
      if (returnFocus) $('#chatModelTrigger').focus();
    }

    function updateSelectedModelUI() {
      const selected = $('#chatModel').selectedOptions[0];
      const modelId = selected?.value || 'Nexus-St';
      const model = configuredModels.find(item => item.id === modelId) || DEFAULT_MODELS.find(item => item.id === modelId);
      const image = $('#chatModelImage');
      const fallback = $('#chatModelFallback');
      const imageUrl = model?.imageUrl || '';
      image.hidden = !imageUrl;
      image.src = imageUrl;
      image.alt = imageUrl ? `${model?.name || modelId}` : '';
      image.onerror = () => { image.hidden = true; fallback.hidden = false; };
      fallback.hidden = Boolean(imageUrl);
      fallback.textContent = (model?.name || modelId).slice(0, 1).toUpperCase();
      const tier = model?.tier || (PREMIUM_MODELS.includes(modelId) ? 'premium' : 'free');
      $('#chatModelTier').textContent = ({free: 'Gratis', pro: 'Pro', premium: 'Premium'})[tier] || 'Gratis';
      $('#chatModelTier').classList.toggle('is-premium', tier === 'premium');
      $('#chatModelTier').classList.toggle('is-pro', tier === 'pro');
      const capabilities = [model?.vision === true && 'Imagen', model?.audio === true && 'Voz'].filter(Boolean);
      $('#chatModelCapabilities').textContent = capabilities.length ? capabilities.join(' · ') : 'Texto';
      $('#chatModelCapabilities').title = capabilities.length ? `Entrada: ${capabilities.join(' y ')}` : 'Solo entrada de texto';
      renderModelOptions();
      $('#chatModel').title = model?.description || model?.name || modelId;
      $('#chatImageButton').disabled = model?.vision !== true;
      $('#chatImageButton').title = model?.vision === true ? 'Adjuntar imágenes' : 'Este modelo no admite imágenes';
      $('#chatAudioButton').disabled = model?.audio !== true;
      $('#chatAudioButton').title = model?.audio === true ? 'Adjuntar audio' : 'Este modelo no admite audio; usa Dictar para convertir voz a texto';
    }

    window.addEventListener('model-config-updated', event => {
      configuredModels = Array.isArray(event.detail?.models) ? event.detail.models : [];
      configuredPlans = Array.isArray(event.detail?.plans) ? event.detail.plans : configuredPlans;
      renderModelSelector();
      renderMiniAgentModelOptions();
      renderMiniAgents();
      applyPlanFeatureAccess();
      loadTokenUsage();
    });
    window.addEventListener('access-profile-updated', event => {
      const previousPlan = activePlanId();
      activeUserProfile = event.detail && typeof event.detail === 'object' ? event.detail : {};
      syncPremiumEditorAccess();
      const preferredModel = activeUserProfile.preferences?.model;
      if (!chatBusy && preferredModel && [...$('#chatModel').options].some(option => option.value === preferredModel)) {
        $('#chatModel').value = preferredModel;
        updateSelectedModelUI();
      }
      const preferredTheme = activeUserProfile.preferences?.theme;
      if (preferredTheme === 'dark' || preferredTheme === 'light') setTheme(preferredTheme);
      if (previousPlan !== activePlanId()) applyPlanFeatureAccess();
      if ($('.view.active')?.id === 'view-library' && !canUseImageLibrary()) setActiveView('plans');
      renderMiniAgents();
      loadTokenUsage();
      loadPhotoCleanupStatus();
    });

    function hasModelAccess(modelId) {
      const model = configuredModels.find(item => item.id === modelId);
      const tier = model?.tier || (PREMIUM_MODELS.includes(modelId) ? 'premium' : 'free');
      if (tier === 'free') return true;
      const expiry = activeUserProfile.expiresAt?.toDate?.() || (activeUserProfile.expiresAt ? new Date(activeUserProfile.expiresAt) : null);
      if (expiry && expiry.getTime() <= Date.now()) return false;
      const paidPlan = ['Pro', 'Estudio', 'Premium'].includes(activeUserProfile.plan);
      return paidPlan || (Array.isArray(activeUserProfile.premiumModels) && activeUserProfile.premiumModels.includes(modelId));
    }

    function canCreateMiniAgents() {
      const expiry = activeUserProfile.expiresAt?.toDate?.() || (activeUserProfile.expiresAt ? new Date(activeUserProfile.expiresAt) : null);
      if (expiry && expiry.getTime() <= Date.now()) return false;
      return ['pro', 'premium', 'studio'].includes(activePlanId())
        || ['Pro', 'Premium', 'Estudio'].includes(activeUserProfile.plan);
    }

    function setActiveMiniAgent(agent = null) {
      activeAgentInstructions = agent?.instructions || '';
      activeAgentName = agent?.name || '';
      activeMiniAgentId = agent?.id || '';
      const status = $('#chatAgentStatus');
      if (status) {
        status.hidden = !agent;
        $('#chatActiveAgentName').textContent = activeAgentName;
      }
      $('#chatInput').placeholder = agent ? `Pregúntale a ${activeAgentName}…` : 'Escribe tu mensaje…';
      renderMiniAgents();
    }

    function resetMiniAgentForm() {
      miniAgentEditingId = '';
      $('#miniAgentForm').reset();
      $('#miniAgentForm').querySelector('.mini-agent-form-heading h2').textContent = 'Crear un mini agente';
      $('#miniAgentForm').querySelector('[type="submit"]').textContent = 'Guardar agente';
      $('#cancelMiniAgentEdit').hidden = true;
      $('#miniAgentFeedback').textContent = '';
    }

    function renderMiniAgentModelOptions() {
      const select = $('#miniAgentModel');
      if (!select) return;
      const selectedModel = select.value;
      const freeModels = (configuredModels.length ? configuredModels : DEFAULT_MODELS)
        .filter(model => model.enabled !== false && (model.tier || 'free') === 'free');
      select.replaceChildren();
      if (!freeModels.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay modelos gratis habilitados';
        option.disabled = true;
        option.selected = true;
        select.append(option);
        return;
      }
      for (const model of freeModels) {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name || model.id;
        select.append(option);
      }
      if ([...select.options].some(option => option.value === selectedModel)) select.value = selectedModel;
    }

    const MINI_AGENT_PRESETS = [
      {
        id: 'whatsapp-sales', name: 'Ventas por WhatsApp', icon: '<path d="m4 5 17-2-7 18-3-7-7-3Z"/><path d="m11 14 10-11"/>',
        description: 'Responde consultas con un tono cercano y deja el mensaje listo para copiar.',
        example: 'Cliente: Hola, ¿tenés la 42 en negro? ¿Cuánto sale con envío a Santa Fe?', requiresPro: true,
        instructions: 'Eres asistente de ventas por WhatsApp. Escribe respuestas breves, cercanas y listas para copiar. Usa solo precios, stock, condiciones y datos de envío que el usuario haya proporcionado; nunca los inventes. Si falta un dato necesario, haz una pregunta concreta antes de prometer algo.',
      },
      {
        id: 'writer', name: 'Escritor', icon: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
        description: 'Redacta y pule correos, mensajes y textos con el tono que necesitas.',
        example: 'Escribí un mail breve para pedir un presupuesto.', requiresPro: true,
        instructions: 'Eres un asistente de escritura en español. Redacta textos claros, naturales y bien estructurados según el propósito indicado. Respeta los datos y la intención originales, no agregues hechos y ofrece opciones de tono cuando sean útiles.',
      },
      {
        id: 'programmer', name: 'Programador', icon: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-10-2 12"/>',
        description: 'Escribe código, explica decisiones y ayuda a revisar errores.',
        example: 'Hacé una función en Python que lea un CSV sin pandas.', requiresPro: true,
        instructions: 'Eres un asistente de programación. Propón soluciones funcionales y adecuadas al lenguaje y contexto. Explica brevemente cómo usarlas y señala supuestos importantes. No afirmes que ejecutaste o probaste código si no se ejecutó; pide el error o contexto que falte.',
      },
      {
        id: 'ideas', name: 'Lluvia de ideas', icon: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1 1-2.5Z"/>',
        description: 'Propone opciones concretas cuando todavía no sabes por dónde empezar.',
        example: 'Dame 10 nombres para un emprendimiento de panificados.', requiresPro: true,
        instructions: 'Eres un facilitador de ideas. Genera opciones variadas, concretas y fáciles de comparar para el objetivo indicado. Evita repetir la misma idea con otras palabras; organiza listas y añade una breve razón cuando ayude a elegir.',
      },
      {
        id: 'summarizer', name: 'Resumidor', icon: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
        description: 'Convierte textos extensos en puntos clave, sin agregar información.',
        example: 'Resumí esto en 5 bullets: [pegá aquí el texto]', requiresPro: false,
        instructions: 'Eres un asistente de síntesis. Resume únicamente el contenido que te entreguen, conserva los datos y matices importantes, no inventes información y distingue con claridad hechos de opiniones. Si falta el texto, pídelo. Cuando soliciten cinco puntos, entrega exactamente cinco.',
      },
      {
        id: 'explainer', name: 'Explicador', icon: '<path d="M9 18h6m-5 3h4m-2-19a7 7 0 0 0-4 12.7c.5.4 1 1 1 1.8h6c0-.8.5-1.4 1-1.8A7 7 0 0 0 12 2Z"/>',
        description: 'Explica temas complejos con palabras simples y ejemplos cotidianos.',
        example: 'Explicame cómo funciona un transformador.', requiresPro: true,
        instructions: 'Eres un explicador paciente. Desglosa temas difíciles en pasos sencillos, define los términos necesarios y utiliza analogías o ejemplos cotidianos sin distorsionar el concepto. Ajusta el detalle a la pregunta y admite cuando algo depende del contexto.',
      },
      {
        id: 'translator', name: 'Traductor', icon: '<path d="m5 8 6 6m-7 0 6-6 2-2M2 5h12M7 2v3m6 19 5-12 5 12m-8-4h6"/>',
        description: 'Traduce entre español e inglés conservando sentido y tono.',
        example: 'Pasá esto a inglés natural: [pegá aquí el texto]', requiresPro: true,
        instructions: 'Eres un traductor español-inglés. Traduce al idioma opuesto cuando el destino no se indique, conserva el significado, el tono y los nombres propios, y adapta expresiones para que suenen naturales. Devuelve solo la traducción salvo que pidan una explicación.',
      },
      {
        id: 'brand-strategist', name: 'Estratega de marca', icon: '<path d="M12 3 20 7v10l-8 4-8-4V7l8-4Z"/><path d="m8 10 4 2 4-2m-4 2v5"/>',
        description: 'Define posicionamiento, audiencia y una voz de marca coherente.',
        example: 'Ayúdame a definir el tono de voz para una marca de café de especialidad.', premiumOnly: true,
        instructions: 'Eres estratega de marca. Ayuda a definir audiencia, propuesta de valor, diferenciación y tono de voz a partir de los datos del usuario. Si falta contexto, pregunta lo esencial. No inventes investigación, resultados, certificaciones ni afirmaciones sobre competidores.',
      },
      {
        id: 'content-planner', name: 'Planificador de contenido', icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M3 9h18m-14 4h3m-3 4h8"/>',
        description: 'Organiza publicaciones con formatos, ideas y llamados a la acción.',
        example: 'Arma un calendario de 7 publicaciones para lanzar mi tienda de plantas.', premiumOnly: true,
        instructions: 'Eres estratega de contenido. Diseña calendarios editoriales claros, adaptados a la audiencia, plataforma y objetivo que indique el usuario. Incluye fecha o día, formato, idea principal y llamado a la acción. No presentes tendencias actuales como verificadas si no hay búsqueda web.',
      },
      {
        id: 'data-analyst', name: 'Analista de datos', icon: '<path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7"/><path d="M16 6h3v3"/>',
        description: 'Encuentra patrones y anomalías en los datos que compartas.',
        example: 'Analiza estas ventas y señala tendencias: [pega los datos]', premiumOnly: true,
        instructions: 'Eres analista de datos. Analiza únicamente los datos proporcionados, explica los cálculos de manera breve y distingue observaciones de hipótesis. No inventes valores ni causalidad. Si faltan columnas, período o contexto para responder, indícalo y pregunta lo necesario.',
      },
    ];

    function canUseMiniAgentPreset(preset) {
      if (preset.premiumOnly) return activePlanId() === 'premium' && canCreateMiniAgents();
      return !preset.requiresPro || canCreateMiniAgents();
    }

    function activateMiniAgentPreset(preset) {
      if (!canUseMiniAgentPreset(preset)) return setActiveView('plans');
      if (!activeChatUser) return toast('Inicia sesión para usar agentes en el chat.');
      if (chatBusy || chatHistoryBusy) return toast('Espera a que termine el chat actual antes de cambiar de agente.');
      if (!setActiveView('chat')) return;
      resetActiveChat();
      const modelSelect = $('#chatModel');
      if (!hasModelAccess(modelSelect.value)) {
        const availableFreeModel = (configuredModels.length ? configuredModels : DEFAULT_MODELS)
          .find(model => model.enabled !== false && (model.tier || 'free') === 'free'
            && [...modelSelect.options].some(option => option.value === model.id));
        if (!availableFreeModel) return toast('No hay un modelo gratuito habilitado para esta plantilla.');
        modelSelect.value = availableFreeModel.id;
        modelSelect.dispatchEvent(new Event('change', {bubbles: true}));
      }
      setActiveMiniAgent({id: `preset:${preset.id}`, name: preset.name, instructions: preset.instructions});
      chatInput.value = preset.example;
      chatInput.dispatchEvent(new Event('input'));
      chatInput.focus({preventScroll: true});
    }

    function renderMiniAgentTemplates() {
      const list = $('#miniAgentPresetList');
      if (!list) return;
      list.replaceChildren();
      for (const preset of MINI_AGENT_PRESETS) {
        const locked = !canUseMiniAgentPreset(preset);
        const isActive = activeMiniAgentId === `preset:${preset.id}`;
        const card = document.createElement('article');
        card.className = `mini-agent-template-card${locked ? ' is-locked' : ''}${isActive ? ' is-active' : ''}`;
        const header = document.createElement('div');
        header.className = 'mini-agent-template-head';
        const icon = document.createElement('span');
        icon.className = 'mini-agent-template-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg viewBox="0 0 24 24">${preset.icon}</svg>`;
        const copy = document.createElement('div');
        copy.className = 'mini-agent-template-copy';
        const title = document.createElement('h3');
        title.textContent = preset.name;
        const description = document.createElement('p');
        description.textContent = preset.description;
        copy.append(title, description);
        const access = document.createElement('span');
        access.className = `mini-agent-template-access${locked ? ' is-locked' : ''}`;
        if (locked) access.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>${preset.premiumOnly ? 'Premium' : 'Pro+'}</span>`;
        else access.textContent = preset.premiumOnly ? 'Premium' : preset.requiresPro ? 'De pago' : 'Gratis';
        header.append(icon, copy, access);

        const example = document.createElement('div');
        example.className = 'mini-agent-template-example';
        const exampleLabel = document.createElement('small');
        exampleLabel.textContent = 'EJEMPLO';
        const exampleText = document.createElement('p');
        exampleText.textContent = preset.example;
        example.append(exampleLabel, exampleText);

        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.className = `mini-agent-template-use${locked ? ' is-locked' : ''}`;
        useButton.textContent = locked ? 'Ver planes' : isActive ? 'Activo en el chat' : 'Probar en chat';
        useButton.setAttribute('aria-pressed', String(isActive));
        useButton.addEventListener('click', () => {
          if (locked) setActiveView('plans');
          else activateMiniAgentPreset(preset);
        });
        card.append(header, example, useButton);
        list.append(card);
      }
    }

    function renderMiniAgents() {
      const list = $('#miniAgentList');
      if (!list) return;
      renderMiniAgentTemplates();
      const canCreate = canCreateMiniAgents();
      $('#miniAgentCreateSection').hidden = !canCreate;
      $('#miniAgentCount').textContent = String(userMiniAgents.length);
      list.replaceChildren();
      if (!userMiniAgents.length) {
        const empty = document.createElement('p');
        empty.className = 'history-loading';
        empty.textContent = canCreate ? 'Todavía no creaste mini agentes.' : 'Iniciá sesión y elegí un plan Pro, Premium o Estudio para guardar agentes propios.';
        list.append(empty);
        return;
      }
      for (const agent of userMiniAgents) {
        const isActive = agent.id === activeMiniAgentId;
        const card = document.createElement('article');
        card.className = 'mini-agent-card';
        card.classList.toggle('is-active', isActive);
        const content = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = agent.name;
        const description = document.createElement('p');
        description.textContent = agent.instructions;
        const model = document.createElement('small');
        model.textContent = agent.model || 'Nexus-St';
        content.append(title, description, model);
        const actions = document.createElement('div');
        actions.className = 'mini-agent-actions';
        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.className = 'btn primary';
        useButton.textContent = isActive ? 'Usar de nuevo' : 'Usar en chat';
        useButton.setAttribute('aria-pressed', String(isActive));
        useButton.disabled = !canCreate;
        useButton.title = canCreate ? '' : 'Crear y usar mini agentes propios requiere Pro, Premium o Estudio.';
        useButton.addEventListener('click', () => {
          if (!canCreateMiniAgents()) return toast('Usar mini agentes propios requiere Pro, Premium o Estudio.');
          if (chatBusy || chatHistoryBusy) return toast('Espera a que termine el chat actual antes de cambiar de agente.');
          const modelId = agent.model || 'Nexus-St';
          if (![...$('#chatModel').options].some(option => option.value === modelId)) {
            return toast(`El modelo ${modelId} ya no está habilitado. Edita el agente y elige otro modelo.`);
          }
          if (!setActiveView('chat')) return;
          resetActiveChat();
          $('#chatModel').value = modelId;
          $('#chatModel').dispatchEvent(new Event('change'));
          setActiveMiniAgent(agent);
          $('#chatInput').focus();
        });
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'mini-agent-edit';
        editButton.textContent = 'Editar';
        editButton.disabled = !canCreate;
        editButton.addEventListener('click', () => {
          if (!canCreateMiniAgents()) return toast('Editar mini agentes requiere Pro, Premium o Estudio.');
          miniAgentEditingId = agent.id;
          $('#miniAgentName').value = agent.name || '';
          $('#miniAgentInstructions').value = agent.instructions || '';
          $('#miniAgentModel').value = agent.model || 'Nexus-St';
          $('#miniAgentForm').querySelector('.mini-agent-form-heading h2').textContent = 'Editar mini agente';
          $('#miniAgentForm').querySelector('[type="submit"]').textContent = 'Guardar cambios';
          $('#cancelMiniAgentEdit').hidden = false;
          $('#miniAgentFeedback').textContent = '';
          $('#miniAgentForm').scrollIntoView({behavior: 'smooth', block: 'center'});
        });
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'mini-agent-remove';
        removeButton.textContent = 'Eliminar';
        removeButton.addEventListener('click', async () => {
          if (!activeChatUser || !window.confirm(`¿Eliminar el mini agente “${agent.name}”?`)) return;
          try {
            await deleteDoc(doc(db, 'users', activeChatUser.uid, 'miniAgents', agent.id));
            userMiniAgents = userMiniAgents.filter(item => item.id !== agent.id);
            if (activeMiniAgentId === agent.id) setActiveMiniAgent();
            renderMiniAgents();
          } catch {
            toast('No se pudo eliminar el mini agente.');
          }
        });
        actions.append(useButton, editButton, removeButton);
        card.append(content, actions);
        list.append(card);
      }
    }

    async function loadMiniAgents() {
      if (!activeChatUser) return;
      try {
        const snapshot = await getDocs(collection(db, 'users', activeChatUser.uid, 'miniAgents'));
        userMiniAgents = snapshot.docs.map(item => ({id: item.id, ...item.data()}));
        if (activeMiniAgentId && !activeMiniAgentId.startsWith('preset:') && !userMiniAgents.some(agent => agent.id === activeMiniAgentId)) setActiveMiniAgent();
      } catch (error) {
        userMiniAgents = [];
        console.warn('No se pudieron cargar los mini agentes:', error);
      }
      renderMiniAgentModelOptions();
      renderMiniAgents();
    }

    async function loadModelConfiguration(user) {
      try {
        const [profileSnapshot, settingsSnapshot] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDoc(doc(db, 'appConfig', 'public')),
        ]);
        activeUserProfile = profileSnapshot.exists() ? profileSnapshot.data() : {};
        configuredModels = settingsSnapshot.exists() && Array.isArray(settingsSnapshot.data().models)
          ? settingsSnapshot.data().models
          : [];
        configuredPlans = settingsSnapshot.exists() && Array.isArray(settingsSnapshot.data().plans)
          ? settingsSnapshot.data().plans
          : [];
      } catch (error) {
        activeUserProfile = {};
        configuredModels = [];
        configuredPlans = [];
        console.warn('No se pudo cargar la configuración de modelos:', error);
      }
      syncPremiumEditorAccess();
      renderModelSelector();
      const preferredModel = activeUserProfile.preferences?.model;
      if (preferredModel && [...$('#chatModel').options].some(option => option.value === preferredModel)) {
        $('#chatModel').value = preferredModel;
        updateSelectedModelUI();
      }
      const preferredTheme = activeUserProfile.preferences?.theme;
      if (preferredTheme === 'dark' || preferredTheme === 'light') setTheme(preferredTheme);
      renderMiniAgentModelOptions();
      renderMiniAgents();
      applyPlanFeatureAccess();
    }

    function updateTokenMeter(usage = {}) {
      const used = Math.max(0, Number(usage.usedTokens ?? (Number(usage.promptTokens || 0) + Number(usage.completionTokens || 0))));
      const limitTokens = Number(usage.limit || FREE_TOKEN_LIMIT);
      const remaining = Math.max(0, Number(usage.remainingTokens ?? limitTokens - used));
      const formattedUsed = Math.min(used, limitTokens).toLocaleString('es-ES');
      const formattedLimit = limitTokens.toLocaleString('es-ES');
      $('#chatTokenCount').textContent = `${formattedUsed} / ${formattedLimit} tokens`;
      $('#chatTokenProgress').max = limitTokens;
      $('#chatTokenProgress').value = Math.min(used, limitTokens);
      $('#usageCount').textContent = `${formattedUsed} / ${formattedLimit}`;
      $('#usageProgress').style.width = `${Math.min(100, used / limitTokens * 100)}%`;
      $('#usageCaption').textContent = `${remaining.toLocaleString('es-ES')} tokens disponibles · entrada y salida.`;
    }

    function isoDate(date) {
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
    }

    function initializeUsagePeriod() {
      const now = new Date();
      $('#usageFrom').value = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
      $('#usageTo').value = isoDate(now);
    }

    async function loadUsagePeriod() {
      if (!activeChatUser) return;
      const from = $('#usageFrom').value;
      const to = $('#usageTo').value;
      if (!from || !to || from > to) return toast('Revisa las fechas del período.');
      const submit = $('#usageRangeForm').querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const model = encodeURIComponent($('#chatModel').value || 'Nexus-St');
        const response = await fetch(`/api/usage?model=${model}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {headers: await authenticatedHeaders()});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo consultar el período.');
        const periodUsed = Number(data.periodUsedTokens || 0);
        const used = Number(data.usedTokens ?? periodUsed);
        const limitTokens = Number(data.limit || FREE_TOKEN_LIMIT);
        const remaining = Number(data.remainingTokens ?? Math.max(0, limitTokens - used));
        const percent = limitTokens ? Math.min(100, used / limitTokens * 100) : 0;
        const legacyCycleFallback = used > periodUsed && from <= isoDate(new Date()) && to >= isoDate(new Date());
        $('#usagePeriodTotal').textContent = `${used.toLocaleString('es-AR')} / ${limitTokens.toLocaleString('es-AR')}`;
        $('#usagePeriodPercent').textContent = `${Math.floor(percent)}% usado`;
        $('#usagePeriodProgress').style.width = `${percent}%`;
        $('#usagePeriodSummary').textContent = legacyCycleFallback
          ? `${remaining.toLocaleString('es-AR')} tokens restantes · ${used.toLocaleString('es-AR')} usados en el ciclo. El detalle por fecha registra ${periodUsed.toLocaleString('es-AR')}.`
          : `${remaining.toLocaleString('es-AR')} tokens restantes · ${periodUsed.toLocaleString('es-AR')} tokens en el período · ${from} a ${to}`;
        $('#usagePromptTokens').textContent = Number(legacyCycleFallback ? data.promptTokens : data.periodPromptTokens || 0).toLocaleString('es-AR');
        $('#usageCompletionTokens').textContent = Number(legacyCycleFallback ? data.completionTokens : data.periodCompletionTokens || 0).toLocaleString('es-AR');
        $('#usageMessageCount').textContent = Number(data.periodMessages || 0).toLocaleString('es-AR');
        $('#usageConversationCount').textContent = Number(data.periodConversations || 0).toLocaleString('es-AR');
      } catch (error) {
        toast(error.message || 'No se pudo consultar el uso.');
      } finally {
        submit.disabled = false;
      }
    }

    function renderImageLibrary(entries) {
      const grid = $('#generatedImageGrid');
      grid.replaceChildren();
      $('#imageLibraryCount').textContent = `${entries.length} ${entries.length === 1 ? 'elemento' : 'elementos'}`;
      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'library-empty';
        empty.textContent = 'Todavía no guardaste imágenes. Las que generes aparecerán aquí.';
        grid.append(empty);
        return;
      }
      for (const entry of entries) {
        const isVideo = entry.mediaType === 'video';
        const card = document.createElement('article');
        card.className = 'generated-image-card';
        const imageLink = document.createElement(isVideo ? 'div' : 'a');
        imageLink.className = 'generated-image-link';
        if (isVideo) {
          const video = document.createElement('video');
          video.src = entry.videoData;
          video.controls = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.setAttribute('aria-label', entry.prompt || 'Vídeo guardado');
          imageLink.append(video);
        } else {
          imageLink.href = entry.imageData;
          imageLink.target = '_blank';
          imageLink.rel = 'noopener noreferrer';
          imageLink.setAttribute('aria-label', 'Abrir imagen en una pestaña nueva');
          const image = document.createElement('img');
          image.src = entry.imageData;
          image.alt = entry.prompt || 'Imagen generada';
          image.loading = 'lazy';
          imageLink.append(image);
        }
        const details = document.createElement('div');
        details.className = 'generated-image-details';
        const prompt = document.createElement('p');
        prompt.textContent = entry.prompt || 'Imagen generada';
        const meta = document.createElement('small');
        const createdAt = entry.createdAt?.toDate?.();
        meta.textContent = `${isVideo ? 'Vídeo editado' : entry.ratio || '1:1'}${createdAt ? ` · ${createdAt.toLocaleDateString('es-ES')}` : ''}`;
        details.append(prompt, meta);
        const actions = document.createElement('div');
        actions.className = 'generated-image-actions';
        const open = document.createElement('a');
        open.className = 'library-open-image';
        open.href = isVideo ? entry.videoData : entry.imageData;
        const imageExtension = entry.imageData?.startsWith('data:image/png;') ? 'png' : 'jpg';
        open.download = isVideo ? `nexus-forma-${entry.id}.webm` : `nexus-forma-${entry.id}.${imageExtension}`;
        open.textContent = 'Descargar';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'library-delete-image';
        remove.setAttribute('aria-label', 'Borrar imagen guardada');
        remove.title = 'Borrar imagen';
        remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
        remove.addEventListener('click', async () => {
          if (!activeChatUser || !canUseImageLibrary()) return;
          remove.disabled = true;
          try {
            await deleteDoc(doc(db, 'users', activeChatUser.uid, 'imageLibrary', entry.id));
            card.remove();
            const remaining = [...grid.querySelectorAll('.generated-image-card')].length;
            $('#imageLibraryCount').textContent = `${remaining} ${remaining === 1 ? 'elemento' : 'elementos'}`;
            if (!remaining) renderImageLibrary([]);
            toast('Imagen borrada de la biblioteca.');
          } catch (error) {
            console.error('No se pudo borrar la imagen guardada:', error);
            toast('No se pudo borrar la imagen. Revisa las reglas de Firestore.');
            remove.disabled = false;
          }
        });
        actions.append(open, remove);
        card.append(imageLink, details, actions);
        grid.append(card);
      }
    }

    async function loadImageLibrary() {
      if (!activeChatUser || !canUseImageLibrary()) return;
      const grid = $('#generatedImageGrid');
      grid.replaceChildren();
      const loading = document.createElement('p');
      loading.className = 'history-loading';
      loading.textContent = 'Cargando biblioteca…';
      grid.append(loading);
      try {
        const snapshot = await getDocs(query(
          collection(db, 'users', activeChatUser.uid, 'imageLibrary'),
          orderBy('createdAt', 'desc'), limit(60),
        ));
        if ($('.view.active')?.id !== 'view-library') return;
        renderImageLibrary(snapshot.docs.map(item => ({id: item.id, ...item.data()})));
      } catch (error) {
        console.error('No se pudo cargar la biblioteca:', error);
        grid.replaceChildren();
        const message = document.createElement('p');
        message.className = 'library-empty';
        message.textContent = 'No se pudo cargar la biblioteca. Revisa las reglas de Firestore.';
        grid.append(message);
      }
    }

    async function compressGeneratedImage(imageElement, filter = 'none', mimeType = 'image/jpeg') {
      const bitmap = await createImageBitmap(imageElement);
      const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar la imagen para Firestore.');
      context.filter = filter;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();
      if (mimeType === 'image/png') {
        const imageData = canvas.toDataURL('image/png');
        if (imageData.length > 800_000) throw new Error('El PNG transparente supera el límite de Firestore. Descárgalo para conservar toda su calidad.');
        return imageData;
      }
      let quality = 0.78;
      let imageData = canvas.toDataURL('image/jpeg', quality);
      while (imageData.length > 800_000 && quality > 0.42) {
        quality -= 0.08;
        imageData = canvas.toDataURL('image/jpeg', quality);
      }
      if (imageData.length > 800_000) throw new Error('La imagen supera el tamaño permitido por Firestore.');
      return imageData;
    }

    async function saveGeneratedImage(imageElement, prompt, ratio, seed, filter = 'none', mimeType = 'image/jpeg') {
      if (!activeChatUser || !canUseImageLibrary()) return false;
      const imageData = await compressGeneratedImage(imageElement, filter, mimeType);
      await addDoc(collection(db, 'users', activeChatUser.uid, 'imageLibrary'), {
        imageData,
        prompt: prompt.slice(0, 500),
        ratio,
        seed,
        createdAt: serverTimestamp(),
      });
      return true;
    }

    async function saveTrimmedVideoToLibrary(blob) {
      if (!activeChatUser || !canUseImageLibrary()) throw new Error('Guardar vídeos en la biblioteca requiere Pro o Premium.');
      const videoData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo preparar el vídeo para Firestore.'));
        reader.readAsDataURL(new Blob([blob], {type: 'video/webm'}));
      });
      if (videoData.length > 800_000) throw new Error('Este recorte supera el límite de Firestore para la biblioteca. Exporta un clip más corto.');
      await addDoc(collection(db, 'users', activeChatUser.uid, 'imageLibrary'), {
        mediaType: 'video', videoData, prompt: 'Recorte de vídeo editado', createdAt: serverTimestamp(),
      });
    }

    async function authenticatedHeaders() {
      await authReady;
      const user = auth.currentUser;
      if (!user) throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
      activeChatUser = user;
      return {'Content-Type': 'application/json', 'Authorization': `Bearer ${await user.getIdToken()}`};
    }

    function renderDeveloperApiKeys(keys = []) {
      const list = $('#developerApiKeysList');
      list.replaceChildren();
      $('#developerApiKeyCount').textContent = `${keys.length} de 5 activas`;
      $('#createDeveloperApiKey').disabled = keys.length >= 5;
      if (!keys.length) {
        const empty = document.createElement('p');
        empty.className = 'developer-api-empty';
        empty.textContent = 'Todavía no tienes claves API.';
        list.append(empty);
        return;
      }
      for (const key of keys) {
        const row = document.createElement('div');
        row.className = 'developer-api-key-row';
        const details = document.createElement('div');
        const prefix = document.createElement('strong');
        prefix.textContent = key.prefix;
        const metadata = document.createElement('small');
        const expiry = key.expiresAt ? new Date(key.expiresAt).toLocaleDateString('es-ES') : 'Sin vencimiento';
        metadata.textContent = `Creada ${new Date(key.createdAt).toLocaleDateString('es-ES')} · vence ${expiry}`;
        details.append(prefix, metadata);
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.className = 'btn';
        revoke.textContent = 'Revocar';
        revoke.addEventListener('click', () => revokeDeveloperApiKey(key.id, revoke));
        row.append(details, revoke);
        list.append(row);
      }
    }

    async function loadDeveloperApiKeys() {
      const feedback = $('#developerApiFeedback');
      feedback.textContent = '';
      try {
        const headers = await authenticatedHeaders();
        const response = await fetch('/api/developer/keys', {headers: {Authorization: headers.Authorization}});
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo consultar API Plus.');
        const allowed = data.allowed === true;
        $('#developerApiLocked').hidden = allowed;
        $('#developerApiActive').hidden = !allowed;
        const state = $('#developerApiState');
        state.textContent = allowed ? `API Plus activa · ${data.plan === 'pro' ? 'Pro' : 'Premium'}` : 'Requiere Pro o Premium';
        state.classList.toggle('is-active', allowed);
        state.title = '';
        if (allowed && data.expiresAt) state.title = `Acceso hasta ${new Date(data.expiresAt).toLocaleDateString('es-ES')}`;
        const modelList = $('#developerApiModels');
        modelList.replaceChildren();
        for (const modelId of Array.isArray(data.models) ? data.models : []) {
          const model = document.createElement('span');
          model.textContent = modelId;
          modelList.append(model);
        }
        renderDeveloperApiKeys(Array.isArray(data.keys) ? data.keys : []);
      } catch (error) {
        feedback.textContent = error.message || 'No se pudo cargar la configuración de API Plus.';
      }
    }

    async function revokeDeveloperApiKey(keyId, button) {
      button.disabled = true;
      try {
        const headers = await authenticatedHeaders();
        const response = await fetch(`/api/developer/keys/${encodeURIComponent(keyId)}`, {
          method: 'DELETE',
          headers: {Authorization: headers.Authorization},
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo revocar la clave.');
        $('#developerApiFeedback').textContent = '';
        await loadDeveloperApiKeys();
        toast('Clave API revocada.');
      } catch (error) {
        $('#developerApiFeedback').textContent = error.message || 'No se pudo revocar la clave.';
        button.disabled = false;
      }
    }

    async function copyDeveloperApiText(value, successMessage) {
      try {
        await navigator.clipboard.writeText(value);
        $('#developerApiFeedback').textContent = '';
        toast(successMessage);
      } catch {
        $('#developerApiFeedback').textContent = 'El navegador no permitió copiar. Selecciona el texto y cópialo manualmente.';
      }
    }

    function setDeveloperApiExample() {
      const endpoint = `${window.location.origin}/v1/chat/completions`;
      $('#developerApiEndpoint').value = endpoint;
      $('#developerApiExample').textContent = [
        `const response = await fetch("${endpoint}", {`,
        '  method: "POST",',
        '  headers: {',
        '    "Authorization": "Bearer " + process.env.NEXUS_API_KEY,',
        '    "Content-Type": "application/json",',
        '  },',
        '  body: JSON.stringify({',
        '    model: "Nexus-Pro",',
        '    messages: [{ role: "user", content: "Hola" }],',
        '  }),',
        '});',
        'const completion = await response.json();',
      ].join('\n');
    }

    const developerApiDialog = $('#developerApiDialog');
    $('#developerApiButton').addEventListener('click', () => {
      setDeveloperApiExample();
      developerApiDialog.showModal();
      loadDeveloperApiKeys();
    });
    $('#closeDeveloperApi').addEventListener('click', () => developerApiDialog.close());
    developerApiDialog.addEventListener('click', event => {
      if (event.target === developerApiDialog) developerApiDialog.close();
    });
    developerApiDialog.addEventListener('close', () => {
      $('#developerApiSecret').value = '';
      $('#developerApiKeyReveal').hidden = true;
    });
    $('#developerApiPlansButton').addEventListener('click', () => {
      developerApiDialog.close();
      setActiveView('plans');
    });
    $('#copyDeveloperApiEndpoint').addEventListener('click', () => copyDeveloperApiText($('#developerApiEndpoint').value, 'Endpoint copiado.'));
    $('#copyDeveloperApiExample').addEventListener('click', () => copyDeveloperApiText($('#developerApiExample').textContent, 'Ejemplo copiado.'));
    $('#copyDeveloperApiSecret').addEventListener('click', () => copyDeveloperApiText($('#developerApiSecret').value, 'Clave copiada.'));
    $('#createDeveloperApiKey').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Creando…';
      $('#developerApiFeedback').textContent = '';
      try {
        const headers = await authenticatedHeaders();
        const response = await fetch('/api/developer/keys', {
          method: 'POST',
          headers: {Authorization: headers.Authorization},
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo crear la clave.');
        $('#developerApiSecret').value = data.key;
        $('#developerApiKeyReveal').hidden = false;
        await loadDeveloperApiKeys();
        toast('Clave creada. Guárdala ahora; no volverá a mostrarse.');
      } catch (error) {
        $('#developerApiFeedback').textContent = error.message || 'No se pudo crear la clave API.';
      } finally {
        button.textContent = 'Crear clave';
        button.disabled = $('#developerApiKeysList').querySelectorAll('.developer-api-key-row').length >= 5;
      }
    });

    function chatSessionsCollection() {
      return collection(db, 'users', activeChatUser.uid, 'chatSessions');
    }

    function renderHomeContinue() {
      const button = $('#homeContinueButton');
      if (!button) return;
      const signedIn = Boolean(auth.currentUser && activeChatUser);
      const hasHistory = Boolean(signedIn && planHasFeature('history'));
      const session = hasHistory
        ? savedChatSessions.find(item => item.id === activeChatSessionId) || savedChatSessions[0]
        : null;
      const heading = $('#homeContinueHeading');
      const description = $('#homeContinueDescription');
      const title = $('#homeContinueTitle');
      const meta = $('#homeContinueMeta');
      button.dataset.sessionId = session?.id || '';
      if (session) {
        heading.textContent = 'Seguí donde quedaste';
        description.textContent = 'Retomá una conversación reciente.';
        title.textContent = session.title || 'Conversación sin título';
        const updatedAt = session.updatedAt?.toDate?.() || (session.updatedAt ? new Date(session.updatedAt) : null);
        meta.textContent = updatedAt && !Number.isNaN(updatedAt.getTime())
          ? `Última actividad · ${updatedAt.toLocaleDateString('es-AR', {day: 'numeric', month: 'short'})}`
          : 'Conversación reciente';
        button.setAttribute('aria-label', `Continuar conversación: ${session.title || 'conversación reciente'}`);
      } else {
        heading.textContent = 'Un buen lugar para empezar';
        description.textContent = hasHistory
          ? 'Tu primera conversación va a aparecer acá.'
          : signedIn ? 'El historial no está incluido en tu plan actual.' : 'Iniciá sesión para retomar tus conversaciones.';
        title.textContent = 'Empezar un chat';
        meta.textContent = 'Abrí el asistente y empezá algo nuevo.';
        button.setAttribute('aria-label', 'Empezar un chat');
      }
    }

    function renderChatSessions() {
      renderHomeContinue();
      chatSessionList.replaceChildren();
      $('#clearChatHistory').disabled = !savedChatSessions.length || chatHistoryBusy;
      if (!savedChatSessions.length) {
        const empty = document.createElement('span');
        empty.className = 'history-loading';
        empty.textContent = 'Todavía no hay conversaciones guardadas.';
        chatSessionList.append(empty);
        return;
      }
      for (const session of savedChatSessions) {
        const row = document.createElement('div');
        row.className = 'chat-session-row';
        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = `chat-session${session.id === activeChatSessionId ? ' active' : ''}`;
        openButton.title = session.title;
        const title = document.createElement('span');
        title.textContent = session.title;
        const date = document.createElement('small');
        const updatedAt = session.updatedAt?.toDate?.();
        date.textContent = updatedAt ? updatedAt.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'}) : 'Hoy';
        openButton.append(title, date);
        openButton.addEventListener('click', () => openChatSession(session.id));
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'chat-session-delete';
        deleteButton.title = `Borrar conversación: ${session.title}`;
        deleteButton.setAttribute('aria-label', deleteButton.title);
        deleteButton.disabled = chatHistoryBusy;
        deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
        deleteButton.addEventListener('click', () => removeChatSessions([session]));
        row.append(openButton, deleteButton);
        chatSessionList.append(row);
      }
    }

    async function deleteChatSession(sessionId) {
      const messages = await getDocs(collection(db, 'users', activeChatUser.uid, 'chatSessions', sessionId, 'messages'));
      await Promise.all(messages.docs.map(message => deleteDoc(message.ref)));
      await deleteDoc(doc(db, 'users', activeChatUser.uid, 'chatSessions', sessionId));
    }

    function resetActiveChat() {
      chatSessionLoadId += 1;
      chatHistory.length = 0;
      activeChatSessionId = null;
      activeUsageConversationId = newConversationId();
      setActiveMiniAgent();
      pendingChatImages = [];
      pendingChatAudio = null;
      pendingChatFiles = [];
      renderChatAttachments();
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatInput.placeholder = 'Escribe tu mensaje…';
      chatWelcome.hidden = false;
      $('#chatMessages').replaceChildren(chatWelcome);
      $('#chatMessages').scrollTop = 0;
      syncChatButton();
    }

    function settleChatDeletion(confirmed) {
      const resolve = chatDeleteResolver;
      chatDeleteResolver = null;
      if ($('#chatDeleteDialog').open) $('#chatDeleteDialog').close();
      resolve?.(confirmed);
    }

    function confirmChatDeletion(sessions) {
      if (chatDeleteResolver) return Promise.resolve(false);
      const multiple = sessions.length > 1;
      $('#chatDeleteTitle').textContent = multiple ? '¿Borrar todo el historial?' : '¿Borrar esta conversación?';
      $('#chatDeleteMessage').textContent = multiple
        ? `Se eliminarán ${sessions.length} conversaciones y sus mensajes. Esta acción no se puede deshacer.`
        : `Se eliminará “${sessions[0].title}” y todos sus mensajes. Esta acción no se puede deshacer.`;
      $('#confirmChatDelete').textContent = multiple ? 'Borrar historial' : 'Borrar conversación';
      return new Promise(resolve => {
        chatDeleteResolver = resolve;
        $('#chatDeleteDialog').showModal();
      });
    }

    $('#cancelChatDelete').addEventListener('click', () => settleChatDeletion(false));
    $('#confirmChatDelete').addEventListener('click', () => settleChatDeletion(true));
    $('#chatDeleteDialog').addEventListener('close', () => settleChatDeletion(false));

    async function removeChatSessions(sessions, askForConfirmation = true) {
      if (!activeChatUser || chatBusy || chatHistoryBusy || !sessions.length) return;
      const sessionIds = sessions.map(session => session.id);
      if (askForConfirmation && !await confirmChatDeletion(sessions)) return;
      chatHistoryBusy = true;
      renderChatSessions();
      try {
        for (const sessionId of sessionIds) await deleteChatSession(sessionId);
        savedChatSessions = savedChatSessions.filter(session => !sessionIds.includes(session.id));
        if (sessionIds.includes(activeChatSessionId)) resetActiveChat();
        renderChatSessions();
        toast(sessions.length === 1 ? 'Conversación borrada.' : 'Historial borrado.');
      } catch (error) {
        console.error('No se pudo borrar el historial:', error);
        toast('No se pudo borrar el historial. Revisa las reglas de Firestore e inténtalo de nuevo.');
        await loadChatSessions();
      } finally {
        chatHistoryBusy = false;
        renderChatSessions();
      }
    }

    $('#clearChatHistory').addEventListener('click', () => removeChatSessions([...savedChatSessions]));

    async function loadChatSessions() {
      if (!activeChatUser) return;
      if (!planHasFeature('history')) {
        savedChatSessions = [];
        renderChatSessions();
        return;
      }
      try {
        const sessions = chatSessionsCollection();
        try {
          const expired = await getDocs(query(sessions, where('expiresAt', '<=', Timestamp.now()), limit(100)));
          for (const session of expired.docs) await deleteChatSession(session.id);
        } catch (expiryError) {
          console.warn('No se pudieron limpiar sesiones vencidas; se continúa cargando el historial:', expiryError);
        }
        let snapshot;
        try {
          snapshot = await getDocs(query(sessions, orderBy('updatedAt', 'desc'), limit(30)));
        } catch (orderError) {
          console.warn('Fallo de orden en historial, cargando fallback sin orden:', orderError);
          snapshot = await getDocs(sessions);
        }
        savedChatSessions = snapshot.docs
          .map(item => ({id: item.id, ...item.data()}))
          .sort((a, b) => ((b.updatedAt?.toDate?.() ?? 0) - (a.updatedAt?.toDate?.() ?? 0)) || 0);
        renderChatSessions();
      } catch (error) {
        console.error('No se pudo leer el historial:', error);
        chatSessionList.textContent = 'Activa Firestore y sus reglas para sincronizar el historial.';
      }
    }

    async function loadTokenUsage() {
      try {
        const model = encodeURIComponent($('#chatModel').value || 'Nexus-St');
        const response = await fetch(`/api/usage?model=${model}`, {headers: await authenticatedHeaders()});
        const data = await response.json();
        if (response.ok) updateTokenMeter(data);
        else $('#chatTokenCount').textContent = 'Cuota no disponible';
      } catch {
        $('#chatTokenCount').textContent = 'Cuota no disponible';
      }
    }

    async function saveChatEntry(role, content, model) {
      if (!activeChatUser || !planHasFeature('history')) return false;
      try {
        if (!activeChatSessionId) {
          const expiry = Timestamp.fromDate(new Date(Date.now() + chatRetentionDays() * 24 * 60 * 60 * 1000));
          const session = await addDoc(chatSessionsCollection(), {
            title: content.slice(0, 64), model,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(), expiresAt: expiry,
          });
          activeChatSessionId = session.id;
          activeUsageConversationId = session.id;
        }
        const sessionRef = doc(db, 'users', activeChatUser.uid, 'chatSessions', activeChatSessionId);
        const messageRef = await addDoc(collection(sessionRef, 'messages'), {
          role, content, model, createdAt: serverTimestamp(),
        });
        await updateDoc(sessionRef, {
          updatedAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + chatRetentionDays() * 24 * 60 * 60 * 1000)),
        });
        await loadChatSessions();
        return messageRef.id;
      } catch {
        toast('No se pudo guardar el historial. Revisa las reglas de Firestore.');
        return false;
      }
    }

    function embeddedChatMessages(session) {
      if (Array.isArray(session?.messages)) return session.messages;
      if (session?.messages && typeof session.messages === 'object') return Object.values(session.messages);
      return [];
    }

    async function openChatSession(sessionId) {
      if (!activeChatUser || chatBusy || chatHistoryBusy || !planHasFeature('history')) return;
      const loadId = ++chatSessionLoadId;
      let stage = 'leer la conversación';
      try {
        const sessionRef = doc(db, 'users', activeChatUser.uid, 'chatSessions', sessionId);
        const sessionDoc = await getDoc(sessionRef);
        if (loadId !== chatSessionLoadId) return;
        if (!sessionDoc.exists()) {
          savedChatSessions = savedChatSessions.filter(item => item.id !== sessionId);
          renderChatSessions();
          toast('Esta conversación ya no existe o venció. Actualicé el historial.');
          return;
        }
        const session = {id: sessionDoc.id, ...sessionDoc.data()};
        savedChatSessions = [session, ...savedChatSessions.filter(item => item.id !== sessionId)];
        const storedMessages = embeddedChatMessages(session);
        let messageDocs = [];
        stage = 'leer los mensajes';
        try {
          const snapshot = await getDocs(query(
            collection(db, 'users', activeChatUser.uid, 'chatSessions', sessionId, 'messages'),
            orderBy('createdAt', 'asc'), limit(50),
          ));
          messageDocs = [...snapshot.docs];
        } catch (orderError) {
          if (loadId !== chatSessionLoadId) return;
          console.warn('Fallo de orden en mensajes, cargando fallback sin orden:', orderError);
          try {
            const snapshot = await getDocs(collection(db, 'users', activeChatUser.uid, 'chatSessions', sessionId, 'messages'));
            messageDocs = [...snapshot.docs];
          } catch (messageError) {
            if (!storedMessages.length) throw messageError;
            console.warn('Se abrirá el historial desde los mensajes guardados en la sesión:', messageError);
          }
        }
        if (loadId !== chatSessionLoadId) return;
        const messageData = messageDocs.length ? messageDocs.map(message => ({...message.data(), _id: message.id})) : storedMessages;
        const validMessages = messageData
          .filter(data => ['user', 'assistant'].includes(data?.role)
            && typeof data.content === 'string'
            && data.content.trim());
        const orderedMessages = validMessages
          .sort((left, right) => {
            const leftDate = left.createdAt?.toDate?.() || new Date(left.createdAt || 0);
            const rightDate = right.createdAt?.toDate?.() || new Date(right.createdAt || 0);
            return (leftDate?.getTime?.() || 0) - (rightDate?.getTime?.() || 0);
          });
        activeChatSessionId = sessionId;
        activeUsageConversationId = sessionId;
        setActiveMiniAgent();
        chatHistory.length = 0;
        $('#chatMessages').replaceChildren();
        chatWelcome.hidden = orderedMessages.length > 0;
        if (!orderedMessages.length) $('#chatMessages').append(chatWelcome);
        for (const data of orderedMessages) {
          chatHistory.push({role: data.role, content: data.content, ...(data._id ? {_id: data._id} : {})});
          appendChatMessage(data.role, data.content);
        }
        if (session.model && [...$('#chatModel').options].some(option => option.value === session.model)) {
          $('#chatModel').value = session.model;
          updateSelectedModelUI();
        }
        renderChatSessions();
      } catch (error) {
        if (loadId !== chatSessionLoadId) return;
        console.error('No se pudo abrir esta conversación:', error);
        const errors = {
          unauthenticated: 'Tu sesión venció. Inicia sesión de nuevo para abrir el historial.',
          'permission-denied': 'Firebase no permite leer los mensajes. Revisa las reglas publicadas.',
          'failed-precondition': 'Firestore no pudo completar la consulta. Revisa la conexión o el índice requerido.',
          unavailable: 'No hay conexión con Firestore. Vuelve a intentarlo.',
          'not-found': 'Esta conversación ya no existe. Actualiza el historial.',
        };
        const detail = typeof error.message === 'string' ? error.message.replace(/https?:\/\/\S+/g, '').slice(0, 100) : '';
        toast(errors[error.code] || `No se pudo ${stage}${error.code ? ` (${error.code})` : ''}${detail ? `: ${detail}` : '.'}`);
      }
    }

    function closeChatEffortMenu(returnFocus = false) {
      if (chatEffortMenu.hidden) return;
      chatEffortMenu.hidden = true;
      chatEffortTrigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) chatEffortTrigger.focus();
    }

    function syncChatEffortUI() {
      const label = CHAT_EFFORT_NAMES[selectedReasoningEffort];
      $('#chatEffortLabel').textContent = label;
      chatEffortTrigger.setAttribute('aria-label', `Esfuerzo de razonamiento: ${label}`);
      chatEffortTrigger.title = `Esfuerzo de razonamiento: ${label}`;
      chatEffortMenu.querySelectorAll('[data-chat-effort]').forEach(option => {
        option.setAttribute('aria-checked', String(option.dataset.chatEffort === selectedReasoningEffort));
      });
    }

    chatEffortTrigger.addEventListener('click', () => {
      if (chatBusy || chatHistoryBusy) return;
      const open = chatEffortMenu.hidden;
      chatEffortMenu.hidden = !open;
      chatEffortTrigger.setAttribute('aria-expanded', String(open));
      if (open) {
        // Mantener el menú completo dentro de la pantalla, incluso en móviles estrechos.
        chatEffortMenu.style.right = '';
        const rect = chatEffortMenu.getBoundingClientRect();
        const shiftRight = Math.max(0, 14 - rect.left);
        const shiftLeft = Math.max(0, rect.right + shiftRight - window.innerWidth + 14);
        if (shiftRight || shiftLeft) chatEffortMenu.style.right = `${Math.round(shiftLeft - shiftRight)}px`;
        chatEffortMenu.querySelector('[aria-checked="true"]')?.focus();
      }
    });
    chatEffortMenu.querySelectorAll('[data-chat-effort]').forEach(option => {
      option.addEventListener('click', () => {
        if (chatBusy || chatHistoryBusy) return;
        selectedReasoningEffort = option.dataset.chatEffort;
        try { localStorage.setItem('nexus-chat-reasoning-effort', selectedReasoningEffort); } catch {}
        syncChatEffortUI();
        closeChatEffortMenu(true);
      });
    });
    document.addEventListener('click', event => {
      if (!$('#chatEffortControl').contains(event.target)) closeChatEffortMenu();
    });
    document.addEventListener('keydown', event => {
      if (chatEffortMenu.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChatEffortMenu(true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const options = [...chatEffortMenu.querySelectorAll('[data-chat-effort]')];
        const currentIndex = options.indexOf(document.activeElement);
        if (currentIndex !== -1) {
          event.preventDefault();
          options[(currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
        }
      }
    });
    syncChatEffortUI();

    function syncChatButton() {
      const secondsLeft = Math.max(0, Math.ceil((chatNextAllowedAt - Date.now()) / 1000));
      const hasAttachments = pendingChatImages.length > 0 || Boolean(pendingChatAudio) || pendingChatFiles.length > 0;
      chatSend.disabled = chatBusy || chatHistoryBusy || (!chatInput.value.trim() && !hasAttachments) || secondsLeft > 0;
      chatEffortTrigger.disabled = chatBusy || chatHistoryBusy;
      if (chatEffortTrigger.disabled) closeChatEffortMenu();
      const stopButton = $('#chatStop');
      if (stopButton) {
        const showStop = chatBusy;
        stopButton.hidden = !showStop;
        chatSend.hidden = showStop;
      }
      chatSend.title = secondsLeft ? `Disponible en ${secondsLeft} s` : 'Enviar mensaje';
      $('#chatCooldown').textContent = secondsLeft ? `Disponible en ${secondsLeft} s` : 'Se cuentan tokens de entrada y salida';
    }

    function appendInlineChatText(parent, text) {
      const tokenPattern = /(\[[^\]\n]+\]\(https:\/\/[^\s)]+\)|https:\/\/[^\s<]+|\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
      const appendPlain = value => value.split('\n').forEach((line, index) => {
        if (index) parent.append(document.createElement('br'));
        if (line) parent.append(document.createTextNode(line));
      });
      let position = 0;
      for (const match of text.matchAll(tokenPattern)) {
        appendPlain(text.slice(position, match.index));
        const token = match[0];
        const linkMatch = token.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
        if (linkMatch || token.startsWith('https://')) {
          const rawUrl = linkMatch ? linkMatch[2] : token;
          const trailingPunctuation = linkMatch ? '' : (rawUrl.match(/[.,!?;:]+$/)?.[0] || '');
          const href = trailingPunctuation ? rawUrl.slice(0, -trailingPunctuation.length) : rawUrl;
          try {
            const url = new URL(href);
            if (url.protocol !== 'https:') throw new Error('Unsupported link protocol');
            const label = linkMatch?.[1] || url.hostname;
            const element = document.createElement('a');
            element.className = 'chat-open-link';
            element.href = url.href;
            element.target = '_blank';
            element.rel = 'noopener noreferrer';
            element.setAttribute('aria-label', `Abrir ${label} en el navegador`);
            const title = document.createElement('span');
            title.className = 'chat-open-link-title';
            title.textContent = label;
            const action = document.createElement('span');
            action.className = 'chat-open-link-action';
            action.textContent = 'Abrir en el navegador';
            element.append(title, action);
            parent.append(element);
            if (trailingPunctuation) parent.append(document.createTextNode(trailingPunctuation));
          } catch {
            appendPlain(token);
          }
        } else {
          const element = document.createElement(token.startsWith('**') ? 'strong' : token.startsWith('`') ? 'code' : 'em');
          element.className = token.startsWith('`') ? 'chat-inline-code' : '';
          element.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1);
          parent.append(element);
        }
        position = match.index + token.length;
      }
      appendPlain(text.slice(position));
    }

    function extractChatCodeFiles(text) {
      const extensionByLanguage = {
        html: 'html', htm: 'html', css: 'css', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
        json: 'json', markdown: 'md', md: 'md', python: 'py', py: 'py', text: 'txt', plaintext: 'txt',
        bash: 'sh', sh: 'sh', xml: 'xml', svg: 'svg', yaml: 'yml', yml: 'yml', sql: 'sql',
      };
      return [...text.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)].map((match, index) => {
        const info = match[1].trim();
        const pathMatch = info.match(/(?:^|\s)(?:path|filename)=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i);
        const language = info.split(/\s+/, 1)[0].toLowerCase();
        const extension = extensionByLanguage[language] || 'txt';
        const name = pathMatch?.[1] || pathMatch?.[2] || pathMatch?.[3] || `archivo-${index + 1}.${extension}`;
        return {name, content: match[2].replace(/\n$/, '')};
      });
    }

    function saveChatDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function chatFileBasename(path) {
      return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'archivo.txt';
    }

    async function downloadChatFiles(files, button) {
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = files.length > 1 ? 'Preparando ZIP…' : 'Preparando archivo…';
      try {
        if (files.length === 1) {
          saveChatDownload(new Blob([files[0].content], {type: 'text/plain;charset=utf-8'}), chatFileBasename(files[0].name));
          return;
        }
        const headers = await authenticatedHeaders();
        const response = await fetch('/api/files/zip', {
          method: 'POST', headers, body: JSON.stringify({files}),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo crear el ZIP.');
        }
        saveChatDownload(await response.blob(), 'nexus-proyecto.zip');
      } catch (error) {
        toast(error.message || 'No se pudieron descargar los archivos.');
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }

    function appendChatFileDownload(container, files) {
      if (!files.length) return;
      const actions = document.createElement('div');
      actions.className = 'chat-artifact-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-artifact-download';
      button.textContent = files.length > 1
        ? `Descargar ZIP (${files.length} archivos)`
        : `Descargar ${chatFileBasename(files[0].name)}`;
      button.addEventListener('click', () => downloadChatFiles(files, button));
      actions.append(button);
      container.append(actions);
    }

    let chatCodeDrawer = null;

    async function copyChatCode(value, button) {
      const original = button.innerHTML;
      try {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          const field = document.createElement('textarea');
          field.value = value;
          field.setAttribute('readonly', '');
          field.style.position = 'fixed';
          field.style.opacity = '0';
          document.body.append(field);
          field.select();
          const copied = document.execCommand('copy');
          field.remove();
          if (!copied) throw new Error('No se pudo copiar');
        }
        button.classList.add('is-copied');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Copiado</span>';
        if (typeof toast === 'function') toast('Código copiado al portapapeles.');
        window.setTimeout(() => {
          button.classList.remove('is-copied');
          button.innerHTML = original;
        }, 1700);
      } catch {
        if (typeof toast === 'function') toast('No se pudo copiar. Selecciona el código y cópialo manualmente.');
      }
    }

    function closeChatCodeDrawer() {
      if (!chatCodeDrawer) return;
      chatCodeDrawer.classList.remove('is-open');
      chatCodeDrawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('chat-code-drawer-open');
    }

    function openChatCodeDrawer(codeText, language, filename) {
      if (!chatCodeDrawer) {
        chatCodeDrawer = document.createElement('aside');
        chatCodeDrawer.className = 'chat-code-drawer';
        chatCodeDrawer.setAttribute('aria-hidden', 'true');
        chatCodeDrawer.innerHTML = `
          <button class="chat-code-drawer-backdrop" type="button" aria-label="Cerrar panel de código"></button>
          <section class="chat-code-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="chatCodeDrawerTitle">
            <header class="chat-code-drawer-head">
              <div class="chat-code-drawer-heading">
                <span class="chat-code-drawer-eyebrow">CÓDIGO</span>
                <strong id="chatCodeDrawerTitle">Vista ampliada</strong>
                <small class="chat-code-drawer-filename"></small>
              </div>
              <div class="chat-code-drawer-actions">
                <button class="chat-code-action chat-code-drawer-copy" type="button" aria-label="Copiar código">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span>Copiar</span>
                </button>
                <button class="chat-code-action chat-code-drawer-close" type="button" aria-label="Cerrar vista ampliada" title="Cerrar">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
                </button>
              </div>
            </header>
            <div class="chat-code-drawer-meta"><span class="chat-code-drawer-language"></span><span>Vista de lectura</span></div>
            <pre class="chat-code-drawer-pre"><code></code></pre>
          </section>`;
        document.body.append(chatCodeDrawer);
        chatCodeDrawer.querySelector('.chat-code-drawer-backdrop').addEventListener('click', closeChatCodeDrawer);
        chatCodeDrawer.querySelector('.chat-code-drawer-close').addEventListener('click', closeChatCodeDrawer);
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape' && chatCodeDrawer?.classList.contains('is-open')) closeChatCodeDrawer();
        });
      }
      chatCodeDrawer.querySelector('.chat-code-drawer-filename').textContent = filename || 'Código';
      chatCodeDrawer.querySelector('.chat-code-drawer-language').textContent = (language || 'texto').toUpperCase();
      chatCodeDrawer.querySelector('.chat-code-drawer-pre code').textContent = codeText;
      const copyButton = chatCodeDrawer.querySelector('.chat-code-drawer-copy');
      copyButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span>Copiar</span>';
      copyButton.classList.remove('is-copied');
      copyButton.onclick = () => copyChatCode(codeText, copyButton);
      chatCodeDrawer.classList.add('is-open');
      chatCodeDrawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('chat-code-drawer-open');
      chatCodeDrawer.querySelector('.chat-code-drawer-close').focus();
    }

    function renderChatAnswer(container, text) {
      container.replaceChildren();
      const codeBlocks = [...text.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)];
      const files = extractChatCodeFiles(text);
      const appendText = value => {
        const blocks = value.trim().split(/\n\s*\n/).filter(Boolean);
        for (const block of blocks) {
          const lines = block.split('\n');
          const heading = lines.length === 1 ? lines[0].match(/^#{1,3}\s+(.+)/) : null;
          const isList = lines.every(line => /^\s*(?:[-*]|\d+\.)\s+/.test(line));
          if (heading) {
            const element = document.createElement('h3'); appendInlineChatText(element, heading[1]); container.append(element);
          } else if (isList) {
            const numbered = /^\s*\d+\./.test(lines[0]);
            const list = document.createElement(numbered ? 'ol' : 'ul');
            lines.forEach(line => { const item = document.createElement('li'); appendInlineChatText(item, line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')); list.append(item); });
            container.append(list);
          } else {
            const paragraph = document.createElement('p'); appendInlineChatText(paragraph, block); container.append(paragraph);
          }
        }
      };
      let position = 0;
      codeBlocks.forEach((match, index) => {
        appendText(text.slice(position, match.index));
        const frame = document.createElement('section');
        frame.className = 'chat-code-frame';
        const file = files[index] || {name: `Código ${index + 1}`, content: match[2].replace(/\n$/, '')};
        const title = document.createElement('div');
        title.className = 'chat-code-title';
        const titleName = document.createElement('span');
        titleName.className = 'chat-code-filename';
        titleName.textContent = file.name;
        const toolbar = document.createElement('div');
        toolbar.className = 'chat-code-toolbar';
        const language = (match[1].trim().split(/\s+/, 1)[0] || 'texto').toLowerCase();
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'chat-code-action';
        copyButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span>Copiar</span>';
        copyButton.addEventListener('click', () => copyChatCode(file.content, copyButton));
        const expandButton = document.createElement('button');
        expandButton.type = 'button';
        expandButton.className = 'chat-code-action chat-code-expand';
        expandButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg><span>Abrir en grande</span>';
        expandButton.addEventListener('click', () => openChatCodeDrawer(file.content, language, file.name));
        toolbar.append(copyButton, expandButton);
        title.append(titleName, toolbar);
        const pre = document.createElement('pre');
        pre.className = 'chat-code-block';
        const code = document.createElement('code');
        code.textContent = file.content;
        pre.append(code);
        frame.append(title, pre);
        container.append(frame);
        position = match.index + match[0].length;
      });
      appendText(text.slice(position));
      appendChatFileDownload(container, files);
    }

    function appendChatMessage(role, text, thinking = false, attachments = []) {
      const article = document.createElement('article');
      article.className = `chat-message ${role}`;
      if (role === 'assistant') {
        const mark = document.createElement('span'); mark.className = 'chat-mark';
        if (chatAssistantLogoUrl) {
          const logo = document.createElement('img'); logo.src = chatAssistantLogoUrl; logo.alt = '';
          mark.append(logo);
        } else mark.textContent = 'f';
        const content = document.createElement('div'); content.className = 'chat-assistant-content';
        if (thinking) {
          const status = document.createElement('div'); status.className = 'chat-thinking'; status.innerHTML = '<span>Pensando</span><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
          content.append(status);
        } else {
          const answer = document.createElement('div'); answer.className = 'chat-message-text'; renderChatAnswer(answer, text);
          content.append(answer);
        }
        article.append(mark, content);
      } else {
        const content = document.createElement('div');
        content.className = 'chat-user-content';
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = text;
        content.append(bubble);
        for (const attachment of attachments) {
          if (attachment.dataUrl) {
            const image = document.createElement('img');
            image.className = 'chat-message-attachment-image';
            image.src = attachment.dataUrl;
            image.alt = attachment.name || 'Imagen adjunta';
            content.append(image);
          } else if (attachment.fileName) {
            const label = document.createElement('span');
            label.className = 'chat-message-attachment-label';
            label.textContent = `Archivo adjunto: ${attachment.fileName}`;
            content.append(label);
          } else if (attachment.name) {
            const label = document.createElement('span');
            label.className = 'chat-message-attachment-label';
            label.textContent = `Audio adjunto: ${attachment.name}`;
            content.append(label);
          }
        }
        // El índice permite saber qué mensaje de chatHistory se está editando.
        article.dataset.hidx = String(Math.max(0, chatHistory.length - 1));
        const actions = document.createElement('div');
        actions.className = 'chat-message-actions';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'chat-message-action';
        editButton.title = hasChatProTools() ? 'Editar mensaje' : 'Editar mensajes: solo Pro y Premium';
        editButton.setAttribute('aria-label', 'Editar mensaje');
        editButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z"/></svg><span>Editar</span>';
        editButton.addEventListener('click', () => beginChatEdit(article));
        actions.append(editButton);
        content.append(actions);
        article.append(content);
      }
      $('#chatMessages').append(article);
      if (role === 'assistant' && !thinking && chatHistory[chatHistory.length - 1]?.role === 'assistant' && chatHistory[chatHistory.length - 1]?.content === text) {
        article.dataset.hidx = String(chatHistory.length - 1);
        installAssistantMessageActions(article);
      }
      $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
      return article;
    }

    function renderChatTimeline() {
      const view = $('#chatMessages');
      view.replaceChildren();
      chatWelcome.hidden = chatHistory.length > 0;
      if (!chatHistory.length) view.append(chatWelcome);
      for (let i = 0; i < chatHistory.length; i++) {
        const entry = chatHistory[i];
        const item = appendChatMessage(entry.role, entry.content);
        item.dataset.hidx = String(i);
      }
      view.scrollTop = view.scrollHeight;
    }

    // Mantener intactas las imágenes, audios y archivos ya renderizados al eliminar
    // respuestas o regenerar. Reconstruir todo el DOM los haría desaparecer.
    function trimChatDom(startIndex) {
      const nodes = [...$('#chatMessages').querySelectorAll(':scope > .chat-message')];
      for (const node of nodes) {
        const value = Number(node.dataset.hidx);
        if (Number.isInteger(value) && value >= startIndex) node.remove();
      }
      chatWelcome.hidden = chatHistory.length > 0;
      if (!chatHistory.length) $('#chatMessages').append(chatWelcome);
    }

    function removeOneChatDom(article, deletedIndex) {
      article.remove();
      for (const node of $('#chatMessages').querySelectorAll(':scope > .chat-message')) {
        const value = Number(node.dataset.hidx);
        if (Number.isInteger(value) && value > deletedIndex) node.dataset.hidx = String(value - 1);
      }
      chatWelcome.hidden = chatHistory.length > 0;
      if (!chatHistory.length) $('#chatMessages').append(chatWelcome);
    }

    async function eraseSavedChatRange(entries) {
      if (!activeChatUser || !activeChatSessionId) return;
      const session = doc(db, 'users', activeChatUser.uid, 'chatSessions', activeChatSessionId);
      for (const entry of entries) {
        if (entry._id) await deleteDoc(doc(session, 'messages', entry._id));
      }
    }

    // Una confirmación accesible, con foco administrado por <dialog> y Escape para cancelar.
    function settleChatAnswerDeletion(confirmed) {
      const resolve = chatAnswerDeleteResolver;
      chatAnswerDeleteResolver = null;
      if ($('#chatAnswerDeleteDialog').open) $('#chatAnswerDeleteDialog').close();
      resolve?.(confirmed);
    }

    function confirmChatAnswerDeletion(entry) {
      if (!entry || chatAnswerDeleteResolver) return Promise.resolve(false);
      const excerpt = String(entry.content || '').replace(/\s+/g, ' ').trim();
      $('#chatAnswerDeletePreview').textContent = excerpt ? excerpt.slice(0, 240) + (excerpt.length > 240 ? '…' : '') : 'Respuesta sin texto';
      return new Promise(resolve => {
        chatAnswerDeleteResolver = resolve;
        $('#chatAnswerDeleteDialog').showModal();
        $('#chatAnswerDeleteCancel').focus();
      });
    }

    $('#chatAnswerDeleteClose').addEventListener('click', () => settleChatAnswerDeletion(false));
    $('#chatAnswerDeleteCancel').addEventListener('click', () => settleChatAnswerDeletion(false));
    $('#chatAnswerDeleteAccept').addEventListener('click', () => settleChatAnswerDeletion(true));
    $('#chatAnswerDeleteDialog').addEventListener('cancel', event => { event.preventDefault(); settleChatAnswerDeletion(false); });
    $('#chatAnswerDeleteDialog').addEventListener('close', () => settleChatAnswerDeletion(false));

    function installAssistantMessageActions(article) {
      if (article.querySelector('.nexus-ai-answer-actions')) return;
      const content = article.querySelector('.chat-assistant-content');
      if (!content) return;
      const actions = document.createElement('div');
      actions.className = 'nexus-ai-answer-actions';
      const make = (text, icon, label, callback) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nexus-ai-answer-button';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = icon + '<span>' + text + '</span>';
        button.addEventListener('click', callback);
        actions.append(button);
        return button;
      };
      const indexNow = () => Number(article.dataset.hidx);
      make('Regenerar', '<svg viewBox="0 0 24 24"><path d="M3 11a9 9 0 0 1 15-6l3 3M21 3v5h-5M21 13a9 9 0 0 1-15 6l-3-3M3 21v-5h5"/></svg>', 'Generar una nueva respuesta', async () => {
        if (chatBusy || chatHistoryBusy) return toast('Espera a que termine la respuesta actual.');
        const idx = indexNow();
        if (chatHistory[idx]?.role !== 'assistant') return;
        let promptIndex = idx - 1;
        while (promptIndex >= 0 && chatHistory[promptIndex]?.role !== 'user') promptIndex--;
        if (promptIndex < 0) return toast('No se encontró la pregunta original.');
        if (Date.now() < chatNextAllowedAt) return toast('Espera un momento para volver a generar la respuesta.');
        if (idx < chatHistory.length - 1 && !window.confirm('Regenerar desde esta respuesta borrará los mensajes posteriores de la conversación. ¿Continuar?')) return;
        const promptEntry = {...chatHistory[promptIndex]};
        const removed = chatHistory.slice(promptIndex);
        chatHistoryBusy = true;
        syncChatButton();
        try { await eraseSavedChatRange(removed); }
        catch (error) { console.error(error); toast('No se pudo actualizar el historial guardado.'); chatHistoryBusy = false; syncChatButton(); return; }
        chatHistory.splice(promptIndex);
        trimChatDom(promptIndex);
        pendingChatFiles = [...(promptEntry.files || [])].slice(0, CHAT_MAX_FILES);
        renderChatAttachments();
        chatHistoryBusy = false;
        syncChatButton();
        await sendChatMessage(promptEntry.content);
      });
      make('Preguntar', '<svg viewBox="0 0 24 24"><path d="M8 10h8M8 14h5M20 11.5a8 8 0 0 1-8.5 8H6l-3 2 1-4A8 8 0 1 1 20 11.5Z"/></svg>', 'Hacer una pregunta sobre esta respuesta', () => {
        const entry = chatHistory[indexNow()];
        if (!entry || entry.role !== 'assistant') return;
        const excerpt = entry.content.replace(/\s+/g, ' ').slice(0, 160);
        chatInput.value = `Tengo una pregunta sobre tu respuesta: «${excerpt}${entry.content.length > 160 ? '…' : ''}»\n\n`;
        chatInput.dispatchEvent(new Event('input', {bubbles:true}));
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
      });
      make('Borrar', '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg>', 'Borrar esta respuesta de la conversación', async () => {
        if (chatBusy || chatHistoryBusy) return toast('Espera a que termine la respuesta actual.');
        const idx = indexNow();
        const entry = chatHistory[idx];
        if (!entry || entry.role !== 'assistant') return;
        if (!await confirmChatAnswerDeletion(entry)) return;
        // Si el usuario cambió de conversación durante el modal, no borrar otra entrada.
        if (chatBusy || chatHistoryBusy || chatHistory[idx] !== entry || !article.isConnected) return;
        chatHistoryBusy = true; syncChatButton();
        try { await eraseSavedChatRange([entry]); }
        catch (error) { console.error(error); toast('No se pudo eliminar la respuesta guardada.'); chatHistoryBusy = false; syncChatButton(); return; }
        chatHistory.splice(idx, 1);
        removeOneChatDom(article, idx);
        chatHistoryBusy = false; syncChatButton();
        toast('Respuesta eliminada.');
      });
      content.append(actions);
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsDataURL(file);
      });
    }

    function compressChatImage(file) {
      return new Promise((resolve, reject) => {
        if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
          reject(new Error('Elige JPG, PNG o WebP de hasta 10 MB.'));
          return;
        }
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => {
          const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(objectUrl);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (dataUrl.length > 2_100_000) reject(new Error('La imagen comprimida supera 1,5 MB. Elige otra imagen.'));
          else resolve({dataUrl, name: file.name.slice(0, 100)});
        };
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('No se pudo abrir la imagen.'));
        };
        image.src = objectUrl;
      });
    }

    async function readChatAudio(file) {
      const formats = {
        'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
      };
      const format = formats[file?.type] || file?.name?.split('.').pop()?.toLowerCase();
      if (!file || file.size > 5 * 1024 * 1024 || !['wav', 'mp3'].includes(format)) {
        throw new Error('Elige WAV o MP3 de hasta 5 MB.');
      }
      const dataUrl = await readFileAsDataUrl(file);
      return {data: dataUrl.split(',')[1] || '', format, name: file.name.slice(0, 100)};
    }

    function renderChatAttachments() {
      const container = $('#chatAttachments');
      container.replaceChildren();
      container.hidden = !pendingChatImages.length && !pendingChatAudio && !pendingChatFiles.length;
      pendingChatImages.forEach((attachment, index) => {
        const item = document.createElement('div');
        item.className = 'chat-attachment-preview';
        const image = document.createElement('img');
        image.src = attachment.dataUrl;
        image.alt = attachment.name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.title = `Quitar ${attachment.name}`;
        remove.setAttribute('aria-label', remove.title);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          pendingChatImages.splice(index, 1);
          renderChatAttachments();
          syncChatButton();
        });
        item.append(image, remove);
        container.append(item);
      });
      pendingChatFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'chat-audio-preview chat-file-preview';
        const label = document.createElement('span');
        label.textContent = `${file.name} · ${file.text.length.toLocaleString('es')} caracteres${file.truncated ? ' (recortado)' : ''}`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.title = `Quitar ${file.name}`;
        remove.setAttribute('aria-label', remove.title);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          pendingChatFiles.splice(index, 1);
          renderChatAttachments();
          syncChatButton();
        });
        item.append(label, remove);
        container.append(item);
      });
      if (pendingChatAudio) {
        const item = document.createElement('div');
        item.className = 'chat-audio-preview';
        const label = document.createElement('span');
        label.textContent = `${pendingChatAudio.name} · audio listo`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.title = 'Quitar audio';
        remove.setAttribute('aria-label', 'Quitar audio');
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          pendingChatAudio = null;
          renderChatAttachments();
          syncChatButton();
        });
        item.append(label, remove);
        container.append(item);
      }
    }

    async function sendChatMessage(rawMessage) {
      const typedMessage = rawMessage.trim();
      if ((!typedMessage && !pendingChatImages.length && !pendingChatAudio && !pendingChatFiles.length) || chatBusy || chatHistoryBusy) return;
      if (!planHasFeature('chat')) {
        setActiveView('plans');
        return;
      }
      const model = $('#chatModel').value;
      const reasoningEffort = selectedReasoningEffort;
      const modelConfig = configuredModels.find(item => item.id === model) || DEFAULT_MODELS.find(item => item.id === model);
      if (pendingChatImages.length && modelConfig?.vision !== true) return toast('El modelo seleccionado no admite imágenes. Elige uno compatible.');
      if (pendingChatAudio && modelConfig?.audio !== true) return toast('El modelo seleccionado no admite audio. Elige uno compatible.');
      if (pendingChatFiles.length && !requireChatProTools('Adjuntar archivos')) return;
      const files = pendingChatFiles.map(({name, text}) => ({name, text}));
      const images = pendingChatImages.map(attachment => attachment.dataUrl);
      const audio = pendingChatAudio ? {data: pendingChatAudio.data, format: pendingChatAudio.format} : null;
      const message = typedMessage || (files.length && !audio && !images.length
        ? 'Lee el archivo adjunto y hazme un resumen de su contenido.'
        : audio && images.length
          ? 'Transcribe el audio adjunto y analiza también las imágenes.'
          : audio ? 'Transcribe el audio adjunto y responde a su contenido.'
            : 'Analiza y describe la imagen adjunta.');
      const secondsLeft = Math.ceil((chatNextAllowedAt - Date.now()) / 1000);
      if (secondsLeft > 0) return toast(`La API gratuita estará disponible en ${secondsLeft} s.`);
      let headers;
      try { headers = await authenticatedHeaders(); }
      catch (error) { return toast(error.message); }
      chatWelcome.hidden = true;
      const userEntry = {role: 'user', content: message, ...(files.length ? {files} : {})};
      chatHistory.push(userEntry);
      appendChatMessage('user', message, false, [
        ...pendingChatImages,
        ...(pendingChatAudio ? [{name: pendingChatAudio.name}] : []),
        ...files.map(file => ({fileName: file.name})),
      ]);
      pendingChatImages = [];
      pendingChatAudio = null;
      pendingChatFiles = [];
      renderChatAttachments();
      const thinking = appendChatMessage('assistant', '', true);
      chatInput.value = ''; chatInput.style.height = 'auto';
      chatAbortController = new AbortController();
      const abortSignal = chatAbortController.signal;
      chatBusy = true; chatNextAllowedAt = Date.now() + 2000; syncChatButton();
      if (!hasModelAccess(model)) {
        thinking.remove();
        chatHistory.pop();
        appendChatMessage('assistant', `Debes adquirir acceso a ${model} para usar este modelo. Revisa los planes y envía el comprobante de pago.`);
        chatBusy = false;
        syncChatButton();
        chatInput.focus();
        return;
      }
      try {
        const historySaved = await saveChatEntry('user', message, model);
        if (historySaved) userEntry._id = historySaved;
        if (abortSignal.aborted) throw new DOMException('Respuesta detenida.', 'AbortError');
        const requestFiles = hasChatProTools() ? collectChatFiles() : [];
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers,
          signal: abortSignal,
          body: JSON.stringify({
            model,
            messages: chatHistory.slice(-12).map(({role, content}) => ({role, content})),
            ...(requestFiles.length ? {files: requestFiles} : {}),
            conversationId: activeUsageConversationId,
            images,
            ...(audio ? {audio} : {}),
            ...(activeAgentInstructions ? {agentName: activeAgentName, agentInstructions: activeAgentInstructions} : {}),
            ...(activeMiniAgentId.startsWith('preset:') ? {agentPresetId: activeMiniAgentId.slice(7)} : {}),
            explainSteps: explainStepsEnabled,
            reasoningEffort,
            webSearch: webSearchEnabled,
          })
        });
        const data = await response.json();
        if (data.usage) updateTokenMeter(data.usage);
        if (!response.ok) throw new Error(data.error || `El servicio respondió con error ${response.status}.`);
        const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
        if (!answer) throw new Error('La API devolvió una respuesta vacía. Inténtalo más tarde.');
        const sources = webSearchEnabled && Array.isArray(data.sources)
          ? data.sources.flatMap(source => {
            try {
              const url = new URL(source.url);
              if (url.protocol !== 'https:') return [];
              const title = String(source.title || url.hostname).replace(/[\[\]]/g, '').slice(0, 120);
              return [`- [${title}](${url.href})`];
            } catch { return []; }
          })
          : [];
        const savedAnswer = sources.length ? `${answer}\n\n## Fuentes\n${sources.join('\n')}` : answer;
        const assistantEntry = {role: 'assistant', content: savedAnswer};
        chatHistory.push(assistantEntry);
        if (historySaved) {
          const savedId = await saveChatEntry('assistant', savedAnswer, model);
          if (savedId) assistantEntry._id = savedId;
        }
        const content = thinking.querySelector('.chat-assistant-content');
        content.replaceChildren();
        const answerNode = document.createElement('div'); answerNode.className = 'chat-message-text'; renderChatAnswer(answerNode, savedAnswer); content.append(answerNode);
        thinking.dataset.hidx = String(chatHistory.length - 1);
        installAssistantMessageActions(thinking);
      } catch (error) {
        const content = thinking.querySelector('.chat-assistant-content'); content.replaceChildren();
        const stopped = error?.name === 'AbortError';
        const answerNode = document.createElement('div'); answerNode.className = 'chat-message-text'; answerNode.textContent = stopped ? 'Respuesta detenida.' : (error.message || 'No se pudo conectar con la API gratuita. Prueba otra vez más tarde.'); content.append(answerNode);
        // Si la detuvo el usuario se conserva su mensaje en el contexto (y en el historial guardado).
        if (!stopped) chatHistory.pop();
      } finally {
        chatAbortController = null;
        chatBusy = false; syncChatButton(); chatInput.focus(); loadUsagePeriod();
      }
    }


    // ---------- Pro/Premium: archivos adjuntos, detener respuesta y editar mensajes ----------
    const CHAT_TEXT_FILE_EXTENSIONS = new Set([
      'txt', 'md', 'markdown', 'html', 'htm', 'css', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'json', 'csv', 'tsv',
      'xml', 'yml', 'yaml', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'rb', 'sql', 'sh', 'log',
      'ini', 'toml', 'vue', 'svg',
    ]);
    const CHAT_MAX_FILES = 3;
    const CHAT_FILE_CHAR_LIMIT = 30000;
    const CHAT_FILES_TOTAL_LIMIT = 60000;

    // Lee word/document.xml de un .docx (ZIP) sin librerías externas.
    async function extractDocxText(file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const view = new DataView(bytes.buffer);
      let eocd = -1;
      for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw new Error('El archivo Word no es válido o está dañado.');
      const entries = view.getUint16(eocd + 10, true);
      let offset = view.getUint32(eocd + 16, true);
      for (let n = 0; n < entries; n++) {
        if (view.getUint32(offset, true) !== 0x02014b50) break;
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        if (name === 'word/document.xml') {
          const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
          const raw = bytes.subarray(start, start + compressedSize);
          let xmlBytes;
          if (method === 0) xmlBytes = raw;
          else if (method === 8 && 'DecompressionStream' in window) {
            xmlBytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
          } else throw new Error('Tu navegador no puede abrir archivos Word. Actualízalo o pega el texto.');
          const xml = new DOMParser().parseFromString(new TextDecoder().decode(xmlBytes), 'application/xml');
          const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
          const paragraphs = [...xml.getElementsByTagNameNS(W, 'p')].map(paragraph => {
            let line = '';
            for (const node of paragraph.getElementsByTagNameNS(W, '*')) {
              if (node.localName === 't') line += node.textContent;
              else if (node.localName === 'tab') line += '\t';
              else if (node.localName === 'br') line += '\n';
            }
            return line;
          });
          return paragraphs.join('\n');
        }
        offset += 46 + nameLength + extraLength + commentLength;
      }
      throw new Error('No encontré texto en el archivo Word.');
    }

    async function readChatFile(file) {
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      const isDocx = extension === 'docx';
      if (!isDocx && !CHAT_TEXT_FILE_EXTENSIONS.has(extension)) {
        throw new Error(`No puedo leer archivos .${extension || 'sin extensión'}. Usa TXT, MD, HTML, CSV, JSON, código o Word (.docx).`);
      }
      if (file.size > (isDocx ? 5 : 1) * 1024 * 1024) throw new Error(`${file.name} pesa demasiado (máximo ${isDocx ? 5 : 1} MB).`);
      const text = (isDocx ? await extractDocxText(file) : await file.text()).replace(/\u0000/g, '').trim();
      if (!text) throw new Error(`${file.name} no tiene texto legible.`);
      return {name: file.name.slice(0, 120), text: text.slice(0, CHAT_FILE_CHAR_LIMIT), truncated: text.length > CHAT_FILE_CHAR_LIMIT};
    }

    // Los archivos de los mensajes recientes se reenvían para que la IA siga "viéndolos" en la conversación.
    function collectChatFiles() {
      const collected = [];
      let total = 0;
      for (const entry of chatHistory.slice(-12).reverse()) {
        for (const file of [...(entry.files || [])].reverse()) {
          if (collected.length >= CHAT_MAX_FILES || total + file.text.length > CHAT_FILES_TOTAL_LIMIT) continue;
          collected.unshift({name: file.name, text: file.text});
          total += file.text.length;
        }
      }
      return collected;
    }

    $('#chatFileButton').addEventListener('click', () => {
      if (!requireChatProTools('Adjuntar archivos')) return;
      $('#chatFileInput').click();
    });
    $('#chatFileInput').addEventListener('change', async event => {
      const picked = [...event.currentTarget.files];
      event.currentTarget.value = '';
      if (!picked.length || !requireChatProTools('Adjuntar archivos')) return;
      const room = Math.max(0, CHAT_MAX_FILES - pendingChatFiles.length);
      if (picked.length > room) toast(`Puedes adjuntar hasta ${CHAT_MAX_FILES} archivos por mensaje.`);
      for (const file of picked.slice(0, room)) {
        try {
          const attachment = await readChatFile(file);
          pendingChatFiles.push(attachment);
          if (attachment.truncated) toast(`De ${attachment.name} se usarán los primeros ${CHAT_FILE_CHAR_LIMIT.toLocaleString('es')} caracteres.`);
        } catch (error) {
          toast(error.message || 'No se pudo leer el archivo.');
        }
      }
      renderChatAttachments();
      syncChatButton();
    });

    $('#chatStop').addEventListener('click', () => {
      if (chatBusy && chatAbortController) chatAbortController.abort();
    });

    function beginChatEdit(article) {
      if (!requireChatProTools('Editar mensajes')) return;
      if (chatBusy || chatHistoryBusy) return toast('Espera a que termine la respuesta o detenla para editar.');
      if (article.classList.contains('is-editing')) return;
      const index = Number(article.dataset.hidx);
      const bubble = article.querySelector('.chat-bubble');
      const actions = article.querySelector('.chat-message-actions');
      const content = article.querySelector('.chat-user-content');
      const original = chatHistory[index]?.content ?? bubble.textContent;
      const box = document.createElement('div');
      box.className = 'chat-edit-box';
      const textarea = document.createElement('textarea');
      textarea.value = original;
      textarea.maxLength = 4000;
      textarea.rows = Math.min(8, Math.max(2, original.split('\n').length));
      textarea.setAttribute('aria-label', 'Editar mensaje');
      const buttons = document.createElement('div');
      buttons.className = 'chat-edit-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = 'Cancelar';
      const save = document.createElement('button');
      save.type = 'button'; save.className = 'btn primary'; save.textContent = 'Guardar y reenviar';
      const hint = document.createElement('small');
      hint.textContent = 'Se reemplazarán este mensaje y las respuestas posteriores.';
      buttons.append(cancel, save);
      box.append(textarea, hint, buttons);
      const close = () => {
        box.remove();
        bubble.hidden = false;
        if (actions) actions.hidden = false;
        article.classList.remove('is-editing');
      };
      cancel.addEventListener('click', close);
      textarea.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); save.click(); }
      });
      save.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) return toast('El mensaje no puede estar vacío.');
        if (chatBusy || chatHistoryBusy) return;
        save.disabled = cancel.disabled = true;
        const applied = await applyChatEdit(article, index, text);
        if (!applied) { save.disabled = cancel.disabled = false; }
      });
      bubble.hidden = true;
      if (actions) actions.hidden = true;
      article.classList.add('is-editing');
      content.insertBefore(box, bubble.nextSibling);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    async function applyChatEdit(article, index, text) {
      chatHistoryBusy = true;
      syncChatButton();
      const removed = chatHistory.slice(index);
      try {
        if (activeChatUser && activeChatSessionId) {
          const sessionRef = doc(db, 'users', activeChatUser.uid, 'chatSessions', activeChatSessionId);
          await Promise.all(removed.filter(entry => entry._id).map(entry => deleteDoc(doc(sessionRef, 'messages', entry._id))));
          if (index === 0) await updateDoc(sessionRef, {title: text.slice(0, 64), updatedAt: serverTimestamp()}).catch(() => {});
        }
      } catch (error) {
        console.error('No se pudo borrar el tramo editado del historial:', error);
        toast('No se pudo actualizar el historial guardado. Inténtalo de nuevo.');
        chatHistoryBusy = false;
        syncChatButton();
        return false;
      }
      const restoredFiles = removed[0]?.files || [];
      chatHistory.length = Math.min(index, chatHistory.length);
      while (article.nextElementSibling) article.nextElementSibling.remove();
      article.remove();
      pendingChatFiles = [...restoredFiles, ...pendingChatFiles].slice(0, CHAT_MAX_FILES);
      renderChatAttachments();
      chatHistoryBusy = false;
      syncChatButton();
      await sendChatMessage(text);
      return true;
    }

    chatForm.addEventListener('submit', event => { event.preventDefault(); sendChatMessage(chatInput.value); });
    const chatWorkspace = $('#chatWorkspace');
    const chatFocusToggle = $('#chatFocusToggle');
    chatFocusToggle.addEventListener('click', () => {
      const focused = chatWorkspace.classList.toggle('focus-mode');
      chatFocusToggle.setAttribute('aria-pressed', String(focused));
      const label = focused ? 'Salir del chat ampliado' : 'Ampliar chat';
      chatFocusToggle.setAttribute('aria-label', label);
      chatFocusToggle.title = label;
    });
    $('#chatModel').addEventListener('change', () => {
      updateSelectedModelUI();
      saveUserPreference('model', $('#chatModel').value);
      loadTokenUsage();
      loadUsagePeriod();
    });
    window.addEventListener('web-customization-updated', event => {
      chatAssistantLogoUrl = typeof event.detail?.chatLogoUrl === 'string' ? event.detail.chatLogoUrl : '';
      const mark = $('#chatHeaderMark');
      if (!mark) return;
      mark.replaceChildren();
      if (chatAssistantLogoUrl) {
        const logo = document.createElement('img'); logo.src = chatAssistantLogoUrl; logo.alt = '';
        mark.append(logo);
      } else mark.textContent = 'f';
    });
    const chatModelPicker = $('#chatModelPicker');
    const chatModelTrigger = $('#chatModelTrigger');
    const chatModelOptions = $('#chatModelOptions');
    function openChatModelOptions() {
      chatModelOptions.hidden = false;
      chatModelTrigger.setAttribute('aria-expanded', 'true');
      (chatModelOptions.querySelector('[aria-selected="true"]') || chatModelOptions.querySelector('[role="option"]'))?.focus();
    }
    chatModelTrigger.addEventListener('click', () => {
      if (chatModelOptions.hidden) openChatModelOptions();
      else closeChatModelOptions();
    });
    chatModelTrigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openChatModelOptions();
      }
    });
    chatModelOptions.addEventListener('keydown', event => {
      const options = [...chatModelOptions.querySelectorAll('[role="option"]')];
      const index = options.indexOf(document.activeElement);
      let nextIndex;
      if (event.key === 'ArrowDown') nextIndex = Math.min(options.length - 1, index + 1);
      else if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - 1);
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = options.length - 1;
      else if (event.key === 'Escape') {
        event.preventDefault();
        closeChatModelOptions(true);
        return;
      } else if (event.key === 'Tab') {
        closeChatModelOptions();
        return;
      } else return;
      event.preventDefault();
      options[nextIndex]?.focus();
    });
    document.addEventListener('pointerdown', event => {
      if (!chatModelPicker.contains(event.target)) closeChatModelOptions();
    });
    $('#usageRangeForm').addEventListener('submit', event => { event.preventDefault(); loadUsagePeriod(); });
    initializeUsagePeriod();
    renderMiniAgentModelOptions();
    renderMiniAgents();
    $('#chatImageButton').addEventListener('click', () => $('#chatImageInput').click());
    $('#chatImageInput').addEventListener('change', async event => {
      const files = [...event.currentTarget.files];
      event.currentTarget.value = '';
      const remaining = Math.max(0, 4 - pendingChatImages.length);
      if (files.length > remaining) toast('Puedes adjuntar hasta cuatro imágenes por mensaje.');
      for (const file of files.slice(0, remaining)) {
        try {
          pendingChatImages.push(await compressChatImage(file));
        } catch (error) {
          toast(error.message || 'No se pudo adjuntar la imagen.');
        }
      }
      renderChatAttachments();
      syncChatButton();
    });
    $('#chatAudioButton').addEventListener('click', () => $('#chatAudioInput').click());
    $('#chatAudioInput').addEventListener('change', async event => {
      const file = event.currentTarget.files[0];
      event.currentTarget.value = '';
      if (!file) return;
      try {
        pendingChatAudio = await readChatAudio(file);
        renderChatAttachments();
        syncChatButton();
      } catch (error) {
        toast(error.message || 'No se pudo adjuntar el audio.');
      }
    });
    $('#chatDictateButton').addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return toast('Este navegador no ofrece dictado por voz. Adjunta un audio a un modelo compatible.');
      if (activeSpeechRecognition) {
        activeSpeechRecognition.stop();
        return;
      }
      const recognition = new SpeechRecognition();
      activeSpeechRecognition = recognition;
      recognition.lang = 'es-AR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      $('#chatDictateButton').classList.add('is-listening');
      $('#chatDictateButton').title = 'Escuchando…';
      recognition.onresult = event => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          chatInput.value = `${chatInput.value.trim()}${chatInput.value.trim() ? ' ' : ''}${transcript}`;
          chatInput.dispatchEvent(new Event('input'));
        }
      };
      recognition.onerror = () => toast('No se pudo reconocer la voz. Revisa el permiso del micrófono.');
      recognition.onend = () => {
        activeSpeechRecognition = null;
        $('#chatDictateButton').classList.remove('is-listening');
        $('#chatDictateButton').title = 'Dictar un mensaje con el micrófono';
      };
      try { recognition.start(); }
      catch { activeSpeechRecognition = null; toast('No se pudo iniciar el micrófono.'); }
    });
    $('#chatReasoningToggle').addEventListener('click', event => {
      explainStepsEnabled = !explainStepsEnabled;
      event.currentTarget.setAttribute('aria-pressed', String(explainStepsEnabled));
      event.currentTarget.classList.toggle('is-active', explainStepsEnabled);
    });
    $('#chatWebSearchToggle').addEventListener('click', event => {
      webSearchEnabled = !webSearchEnabled;
      event.currentTarget.setAttribute('aria-pressed', String(webSearchEnabled));
      event.currentTarget.classList.toggle('is-active', webSearchEnabled);
    });
    $('#miniAgentForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!activeChatUser || !canCreateMiniAgents()) return toast('Crear mini agentes propios requiere Pro, Premium o Estudio.');
      const name = $('#miniAgentName').value.trim();
      const instructions = $('#miniAgentInstructions').value.trim();
      const model = $('#miniAgentModel').value;
      const feedback = $('#miniAgentFeedback');
      if (!name || !instructions) return;
      if (!model) {
        feedback.textContent = 'Habilita al menos un modelo gratis en el panel admin para usarlo en un agente.';
        return;
      }
      if (instructions.length > 1800) return toast('Las instrucciones no pueden superar 1800 caracteres.');
      const saveButton = $('#miniAgentForm').querySelector('[type="submit"]');
      const editingId = miniAgentEditingId;
      saveButton.disabled = true;
      feedback.textContent = '';
      try {
        const values = {name: name.slice(0, 48), instructions, model};
        if (editingId) {
          await updateDoc(doc(db, 'users', activeChatUser.uid, 'miniAgents', editingId), {
            ...values, updatedAt: serverTimestamp(),
          });
          userMiniAgents = userMiniAgents.map(agent => agent.id === editingId ? {...agent, ...values} : agent);
          if (activeMiniAgentId === editingId) {
            activeAgentName = values.name;
            activeAgentInstructions = values.instructions;
            $('#chatActiveAgentName').textContent = values.name;
          }
        } else {
          const agent = {...values, createdAt: serverTimestamp(), updatedAt: serverTimestamp()};
          const reference = await addDoc(collection(db, 'users', activeChatUser.uid, 'miniAgents'), agent);
          userMiniAgents.unshift({id: reference.id, ...agent});
        }
        resetMiniAgentForm();
        renderMiniAgents();
        toast(editingId ? 'Mini agente actualizado.' : 'Mini agente guardado.');
      } catch (error) {
        feedback.textContent = error.code === 'permission-denied'
          ? 'Crear mini agentes requiere un plan Pro o Premium y reglas de Firestore publicadas.'
          : 'No se pudo guardar el mini agente.';
      } finally {
        saveButton.disabled = false;
      }
    });
    $('#cancelMiniAgentEdit').addEventListener('click', resetMiniAgentForm);
    chatInput.addEventListener('input', () => { chatInput.style.height = 'auto'; chatInput.style.height = `${Math.min(chatInput.scrollHeight, 150)}px`; syncChatButton(); });
    chatInput.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chatForm.requestSubmit(); } });
    $$('[data-chat-suggestion]').forEach(button => button.addEventListener('click', () => sendChatMessage(button.dataset.chatSuggestion)));
    $$('[data-home-prompt]').forEach(button => button.addEventListener('click', () => {
      if (chatBusy) return toast('Espera a que termine la respuesta actual.');
      if (!setActiveView('chat')) return;
      chatInput.value = button.dataset.homePrompt;
      chatInput.dispatchEvent(new Event('input'));
      chatInput.focus({preventScroll: true});
    }));
    $('#newChat').addEventListener('click', () => {
      if (chatBusy || chatHistoryBusy) return;
      resetActiveChat();
      activeUsageConversationId = newConversationId();
      renderChatSessions();
    });
    $('#clearChatAgent').addEventListener('click', () => {
      if (chatBusy || chatHistoryBusy) return;
      setActiveMiniAgent();
      toast('Agente desactivado para los próximos mensajes.');
    });
    window.setInterval(syncChatButton, 1000);
    syncChatButton();

    function renderMyFeedback(items = []) {
      const list = $('#myFeedbackList');
      const count = $('#myFeedbackCount');
      list.replaceChildren();
      count.textContent = String(items.length);
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'history-loading';
        empty.textContent = activeChatUser
          ? 'Todavía no enviaste propuestas.'
          : 'Inicia sesión para enviar y consultar tus propuestas.';
        list.append(empty);
        return;
      }
      const typeLabels = {idea: 'Idea', problem: 'Problema', praise: 'Reconocimiento', other: 'Comentario'};
      const areaLabels = {general: 'Experiencia general', chat: 'Chat IA', image: 'Crear imagen', editor: 'Edición', plans: 'Planes y pagos', agents: 'Mini agentes', account: 'Cuenta'};
      for (const item of items) {
        const card = document.createElement('article');
        card.className = 'feedback-submission-card';
        const header = document.createElement('div');
        header.className = 'feedback-submission-header';
        const title = document.createElement('strong');
        title.textContent = item.title || 'Propuesta';
        const status = document.createElement('span');
        status.className = `feedback-status is-${item.status || 'pending'}`;
        status.textContent = ({pending: 'En revisión', accepted: 'Aceptada', rejected: 'No seleccionada'})[item.status] || 'En revisión';
        header.append(title, status);
        const details = document.createElement('p');
        details.textContent = item.details || '';
        const date = item.createdAt?.toDate?.() || (item.createdAt ? new Date(item.createdAt) : null);
        const meta = document.createElement('small');
        meta.textContent = `${typeLabels[item.type] || 'Feedback'} · ${areaLabels[item.area] || 'Experiencia general'} · ${item.rating || 0}/5${date && !Number.isNaN(date.getTime()) ? ` · ${date.toLocaleDateString('es-AR')}` : ''}`;
        card.append(header, details, meta);
        if (item.response) {
          const response = document.createElement('div');
          response.className = 'feedback-response';
          const responseTitle = document.createElement('strong');
          responseTitle.textContent = 'Respuesta de Nexus';
          const responseText = document.createElement('p');
          responseText.textContent = item.response;
          response.append(responseTitle, responseText);
          card.append(response);
        } else if (item.status === 'pending') {
          const waiting = document.createElement('small');
          waiting.className = 'feedback-waiting';
          waiting.textContent = 'El equipo está revisando tu propuesta.';
          card.append(waiting);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'nexus-feedback-delete';
        remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg><span>Eliminar propuesta</span>';
        remove.setAttribute('aria-label', `Eliminar propuesta: ${item.title || 'sin título'}`);
        remove.addEventListener('click', async () => {
          if (!(await window.nexusConfirmFeedback({title: item.title || 'Propuesta', description: 'Se eliminará tu propuesta y también la respuesta del equipo, si existe.'}))) return;
          remove.disabled = true;
          try {
            if (item.source === 'nexus-backup') {
              await fetchFeedbackBackup(`/api/feedback/${encodeURIComponent(item.id)}`, {method: 'DELETE'});
            } else {
              if (item.uid !== activeChatUser?.uid) throw new Error('No puedes borrar una propuesta ajena.');
              await deleteDoc(doc(db, 'feedback', item.id));
            }
            toast('Propuesta eliminada.');
            await loadMyFeedback();
          } catch (error) {
            console.error('Error al borrar feedback:', error);
            toast(error.code === 'permission-denied' ? 'Firebase no permite eliminar la propuesta: revisa las reglas de Firestore.' : (error.message || 'No se pudo eliminar.'));
            remove.disabled = false;
          }
        });
        card.append(remove);
        list.append(card);
      }
    }

    async function fetchFeedbackBackup(path, options = {}) {
      const headers = await authenticatedHeaders();
      const response = await fetch(path, {
        ...options,
        headers: {...headers, ...(options.headers || {})},
        cache: 'no-store',
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) {
        const failure = new Error(data.error || `El servidor respondió ${response.status}.`);
        failure.status = response.status;
        throw failure;
      }
      return data;
    }

    function friendlyFeedbackFailure(error) {
      if (error?.code === 'permission-denied') {
        return 'Firestore rechazó el acceso. El servidor de respaldo tampoco pudo guardar la propuesta. Revisa las reglas de Firebase y que el backend esté activo.';
      }
      if (error?.status === 401) return 'Tu sesión venció. Vuelve a iniciar sesión.';
      if (error?.status === 429) return error.message || 'Llegaste al límite diario de propuestas.';
      if (error?.status === 404 || error?.status === 405) {
        return 'El servidor no tiene instalada la actualización del feedback. Reemplaza server.py y reinícialo.';
      }
      return error?.message ? `No se pudo enviar: ${error.message}` : 'No se pudo enviar. Revisa la conexión y vuelve a intentarlo.';
    }

    async function loadMyFeedback() {
      const loadVersion = ++myFeedbackLoadVersion;
      const user = activeChatUser;
      if (!user) return renderMyFeedback([]);
      const [firestoreResult, backupResult] = await Promise.allSettled([
        getDocs(query(collection(db, 'feedback'), where('uid', '==', user.uid), limit(50))),
        fetchFeedbackBackup('/api/feedback'),
      ]);
      if (loadVersion !== myFeedbackLoadVersion || activeChatUser?.uid !== user.uid) return;
      const items = [];
      if (firestoreResult.status === 'fulfilled') {
        items.push(...firestoreResult.value.docs.map(item => ({id: item.id, ...item.data()})));
      }
      if (backupResult.status === 'fulfilled' && Array.isArray(backupResult.value.items)) {
        items.push(...backupResult.value.items);
      }
      if (firestoreResult.status !== 'fulfilled' && backupResult.status !== 'fulfilled') {
        console.warn('No se pudo cargar feedback:', firestoreResult.reason, backupResult.reason);
        $('#myFeedbackList').textContent = friendlyFeedbackFailure(backupResult.reason);
        $('#myFeedbackCount').textContent = '—';
        return;
      }
      items.sort((left, right) => {
        const dateValue = item => item.createdAt?.toDate?.()?.getTime() || new Date(item.createdAt || 0).getTime() || 0;
        return dateValue(right) - dateValue(left);
      });
      renderMyFeedback(items);
    }

    $('#feedbackForm').addEventListener('submit', async event => {
      event.preventDefault();
      const feedbackStatus = $('#feedbackFormStatus');
      const sendButton = $('#sendFeedback');
      const user = activeChatUser;
      if (!user) {
        feedbackStatus.textContent = 'Inicia sesión para enviar una propuesta.';
        return;
      }
      const title = $('#feedbackTitleInput').value.trim();
      const details = $('#feedbackDetails').value.trim();
      const rating = Number(new FormData(event.currentTarget).get('feedbackRating'));
      if (!title || !details || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        feedbackStatus.textContent = 'Completa el título, los detalles y tu valoración.';
        return;
      }
      const feedbackData = {
        type: $('#feedbackType').value, area: $('#feedbackArea').value,
        title: title.slice(0, 90), details: details.slice(0, 1800), rating,
      };
      sendButton.disabled = true;
      sendButton.textContent = 'Enviando…';
      feedbackStatus.textContent = '';
      try {
        let usedBackup = false;
        try {
          await addDoc(collection(db, 'feedback'), {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
            ...feedbackData,
            status: 'pending', response: '', createdAt: serverTimestamp(),
          });
        } catch (firestoreError) {
          console.warn('Firestore no pudo recibir la propuesta. Se intenta respaldo:', firestoreError);
          try {
            await fetchFeedbackBackup('/api/feedback', {
              method: 'POST', body: JSON.stringify(feedbackData),
            });
            usedBackup = true;
          } catch (backupError) {
            console.warn('Tampoco pudo guardar el servidor:', backupError);
            const failure = new Error(friendlyFeedbackFailure(backupError));
            failure.cause = firestoreError;
            throw failure;
          }
        }
        event.currentTarget.reset();
        feedbackStatus.textContent = usedBackup
          ? 'Propuesta guardada en Nexus. La encontrarás en Tus propuestas; el equipo la recibirá desde el panel admin.'
          : 'Propuesta enviada. Gracias por ayudar a mejorar Nexus.';
        toast('Feedback enviado al equipo.');
        await loadMyFeedback();
      } catch (error) {
        console.error('Falló el envío de feedback:', error);
        feedbackStatus.textContent = error.message || friendlyFeedbackFailure(error);
      } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar propuesta';
      }
    });

    authReady.then(() => onAuthStateChanged(auth, async user => {
      $('#homeSessionNote').textContent = user
        ? 'Tus conversaciones quedan guardadas en tu cuenta.'
        : 'Iniciá sesión para guardar tus conversaciones.';
      renderHomeContinue();
      if (!user) { activeChatUser = null; renderMyFeedback([]); return; }
      activeChatUser = user;
      await loadModelConfiguration(user);
      await loadMiniAgents();
      loadPhotoCleanupStatus();
      loadMyFeedback();
      loadTokenUsage();
      loadChatSessions();
      loadUsagePeriod();
    })).catch(() => {
      $('#chatTokenCount').textContent = 'Cuota no disponible';
    });

    // Crear imagen: plantillas y ayudas locales. No cambian el proveedor ni el contrato de la API.
    const prompt = $('#prompt');
    const createPresets = {
      portrait: {prompt: 'Retrato editorial de una persona de expresión serena junto a una ventana, fondo discreto, piel y texturas naturales, fotografía profesional, luz suave y composición cuidada', style: 'Fotografía', lighting: 'softbox', composition: 'closeup', palette: 'warm', quality: 'natural', ratio: '3:4'},
      product: {prompt: 'Un frasco de perfume de vidrio sobre piedra pulida, sombras suaves y reflejos delicados, escenografía minimalista, fotografía de producto premium con detalles definidos', style: 'Producto editorial', lighting: 'softbox', composition: 'closeup', palette: 'balanced', quality: 'vivid', ratio: '1:1'},
      landscape: {prompt: 'Un valle de montañas con un lago cristalino al atardecer, nubes doradas, perspectiva amplia y atmósfera cinematográfica, paisaje natural detallado', style: 'Cinematográfico', lighting: 'golden', composition: 'wide', palette: 'warm', quality: 'vivid', ratio: '4:3'},
      anime: {prompt: 'Una pequeña librería flotante sobre las nubes al amanecer, faroles de papel, flores y un cielo de fantasía, ilustración anime detallada y ambiente mágico', style: 'Anime', lighting: 'golden', composition: 'wide', palette: 'pastel', quality: 'soft', ratio: '4:3'},
    };
    function clearCreatePresetSelection() {
      $$('#view-create .create-preset-card').forEach(card => card.setAttribute('aria-pressed', 'false'));
    }
    function updateCreatePromptHelp() {
      const length = prompt.value.length;
      $('#charCount').textContent = `${length} / 500`;
      $('#createPromptProgress').style.width = `${Math.min(100, length / 500 * 100)}%`;
      $('#createPromptHint').textContent = !length
        ? 'Describe el sujeto, el entorno y la luz para empezar.'
        : length < 40
          ? 'Buen inicio. Añade dónde ocurre la escena y qué ambiente imaginas.'
          : length < 100
            ? 'Puedes mencionar colores, iluminación o tipo de encuadre.'
            : 'Tienes una descripción detallada. Elige un estilo y genera cuando quieras.';
    }
    prompt.addEventListener('input', () => { updateCreatePromptHelp(); clearCreatePresetSelection(); });
    $('#clearPrompt').addEventListener('click', () => { prompt.value = ''; prompt.dispatchEvent(new Event('input')); prompt.focus(); });
    $('#enhancePrompt').addEventListener('click', () => {
      const current = prompt.value.trim();
      if (!current) return toast('Escribe una idea para mejorarla.');
      const addition = ', sujeto principal claro, composición cuidada, iluminación coherente y detalles nítidos';
      if (!/(detalles|luz|composición|textura)/i.test(current)) {
        const available = prompt.maxLength - current.length;
        if (available > 0) prompt.value = current + addition.slice(0, available);
      }
      prompt.dispatchEvent(new Event('input'));
    });
    function setCreateStyle(style) {
      $$('#styles .chip').forEach(chip => chip.classList.toggle('selected', chip.dataset.style === style));
    }
    function setCreateRatio(next) {
      ratio = next;
      $$('#ratios button').forEach(button => button.classList.toggle('selected', button.dataset.ratio === next));
      updateCreateSummary();
    }
    function updateCreateSummary() {
      const style = $('#styles .chip.selected')?.dataset.style || 'Fotografía';
      const labels = {'1:1': 'Cuadrado · 768 × 768', '4:3': 'Horizontal · 768 × 576', '3:4': 'Vertical · 576 × 768'};
      const lighting = {natural: 'Luz natural', golden: 'Hora dorada', softbox: 'Luz de estudio', dramatic: 'Luz dramática', neon: 'Luz de neón'};
      $('#createSummaryStyle').textContent = style;
      $('#createSummaryRatio').textContent = labels[ratio];
      $('#createSummaryLighting').textContent = lighting[$('#imageLighting').value] || 'Luz natural';
    }
    $$('#styles .chip').forEach(chip => chip.addEventListener('click', () => { setCreateStyle(chip.dataset.style); clearCreatePresetSelection(); updateCreateSummary(); }));
    $('#randomizeImageSeed').addEventListener('click', () => {
      $('#imageSeed').value = String(Math.floor(Math.random() * 1_000_000));
    });
    let ratio = '1:1';
    $$('#ratios button').forEach(button => button.addEventListener('click', () => { setCreateRatio(button.dataset.ratio); clearCreatePresetSelection(); }));
    ['imageLighting', 'imageComposition', 'imagePalette', 'quality', 'imageAvoid', 'imageSeed'].forEach(id => {
      $(`#${id}`).addEventListener('change', () => { clearCreatePresetSelection(); updateCreateSummary(); });
    });
    $$('#view-create .create-preset-card').forEach(card => card.addEventListener('click', () => {
      const preset = createPresets[card.dataset.createPreset];
      if (!preset) return;
      prompt.value = preset.prompt;
      prompt.dispatchEvent(new Event('input'));
      setCreateStyle(preset.style);
      $('#imageLighting').value = preset.lighting;
      $('#imageComposition').value = preset.composition;
      $('#imagePalette').value = preset.palette;
      $('#quality').value = preset.quality;
      $('#imageSeed').value = '';
      $('#imageAvoid').value = '';
      setCreateRatio(preset.ratio);
      clearCreatePresetSelection();
      card.setAttribute('aria-pressed', 'true');
      updateCreateSummary();
      toast('Plantilla cargada. Puedes editar cada detalle antes de generar.');
    }));
    async function copyCreatePrompt() {
      const value = prompt.value.trim();
      if (!value) return toast('Escribe o elige una descripción para copiar.');
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
        else {
          const field = document.createElement('textarea');
          field.value = value; field.style.position = 'fixed'; field.style.opacity = '0';
          document.body.append(field); field.select();
          const copied = document.execCommand('copy'); field.remove();
          if (!copied) throw new Error('No se pudo copiar');
        }
        toast('Descripción copiada al portapapeles.');
      } catch { toast('No se pudo copiar. Selecciona el texto y cópialo manualmente.'); }
    }
    $('#createCopyPrompt').addEventListener('click', copyCreatePrompt);
    $('#createCopyIdea').addEventListener('click', copyCreatePrompt);
    $('#createSurprisePrompt').addEventListener('click', () => {
      const examples = $$('[data-image-prompt]');
      if (!examples.length) return;
      const example = examples[Math.floor(Math.random() * examples.length)];
      prompt.value = example.dataset.imagePrompt.slice(0, prompt.maxLength);
      prompt.dispatchEvent(new Event('input'));
      toast('Nueva idea lista para personalizar.');
    });
    prompt.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        $('#generate').click();
      }
    });
    $('#createVariation').addEventListener('click', () => {
      if (!prompt.value.trim()) return toast('Primero escribe o selecciona una idea.');
      if ($('#generate').disabled) return;
      $('#randomizeImageSeed').click();
      $('#generate').click();
    });
    updateCreatePromptHelp();
    updateCreateSummary();

    let generationAllowedAt = 0;
    let imageLimitRetryAt = 0;
    let imageLimitCountdownTimer = 0;
    let generatedImageObjectUrl = '';
    const imageLimitDialog = $('#imageLimitDialog');

    function updateImageLimitCountdown() {
      const secondsLeft = Math.max(0, Math.ceil((imageLimitRetryAt - Date.now()) / 1000));
      if (!secondsLeft) {
        $('#imageLimitCountdown').textContent = 'Ya puedes crear otra imagen';
        imageLimitRetryAt = 0;
        window.clearInterval(imageLimitCountdownTimer);
        imageLimitCountdownTimer = 0;
        return;
      }
      const hours = Math.floor(secondsLeft / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);
      const seconds = secondsLeft % 60;
      $('#imageLimitCountdown').textContent = [
        hours ? `${hours} h` : '', minutes ? `${minutes} min` : '', `${seconds} s`,
      ].filter(Boolean).join(' ');
    }

    function showImageLimitDialog(retryAfterSeconds) {
      imageLimitRetryAt = Date.now() + Math.max(0, Number(retryAfterSeconds) || 0) * 1000;
      window.clearInterval(imageLimitCountdownTimer);
      updateImageLimitCountdown();
      if (!imageLimitDialog.open) imageLimitDialog.showModal();
      if (imageLimitRetryAt) imageLimitCountdownTimer = window.setInterval(updateImageLimitCountdown, 1000);
    }

    $('#closeImageLimit').addEventListener('click', () => imageLimitDialog.close());
    $('#imageLimitPlans').addEventListener('click', () => { imageLimitDialog.close(); setActiveView('plans'); });
    imageLimitDialog.addEventListener('click', event => { if (event.target === imageLimitDialog) imageLimitDialog.close(); });
    imageLimitDialog.addEventListener('close', () => { window.clearInterval(imageLimitCountdownTimer); imageLimitCountdownTimer = 0; });

    $('#generate').addEventListener('click', async () => {
      const description = prompt.value.trim();
      if (!description) { prompt.focus(); return toast('Escribe una descripción para empezar.'); }
      if (imageLimitRetryAt > Date.now()) {
        showImageLimitDialog(Math.ceil((imageLimitRetryAt - Date.now()) / 1000));
        return;
      }
      const wait = Math.ceil((generationAllowedAt - Date.now()) / 1000);
      if (wait > 0) return toast(`La API gratis permite otra imagen en ${wait} s.`);
      const style = $('.chip.selected', $('#styles')).dataset.style;
      const quality = $('#quality').value;
      const qualityText = {natural: 'natural light, balanced color', vivid: 'vivid colors, rich contrast', soft: 'soft light, gentle colors'}[quality];
      const lightingText = {
        natural: 'natural lighting', golden: 'warm golden-hour lighting', softbox: 'soft studio lighting',
        dramatic: 'dramatic directional lighting', neon: 'colorful neon lighting',
      }[$('#imageLighting').value];
      const compositionText = {
        balanced: 'balanced composition with a clear focal subject', wide: 'wide establishing shot',
        closeup: 'close-up framing', topdown: 'top-down view', thirds: 'rule-of-thirds composition',
      }[$('#imageComposition').value];
      const paletteText = {
        balanced: 'balanced natural color palette', warm: 'warm color palette', cool: 'cool color palette',
        pastel: 'soft pastel color palette', mono: 'monochromatic color palette',
      }[$('#imagePalette').value];
      const avoid = $('#imageAvoid').value.trim();
      const imagePrompt = [description, `${style.toLowerCase()} style`, qualityText, lightingText, compositionText, paletteText,
        avoid ? `avoid ${avoid}` : '',
      ].filter(Boolean).join(', ');
      const dimensions = ratio === '4:3' ? [768, 576] : ratio === '3:4' ? [576, 768] : [768, 768];
      const enteredSeed = $('#imageSeed').value.trim();
      const seed = enteredSeed ? Number(enteredSeed) : Math.floor(Math.random() * 1_000_000);
      if (!Number.isInteger(seed) || seed < 0 || seed >= 1_000_000) return toast('La semilla debe ser un número entre 0 y 999999.');
      $('#imageSeed').value = String(seed);
      const image = $('#generatedImage'); const button = $('#generate'); const empty = $('#previewEmpty');
      generationAllowedAt = Date.now() + 45000;
      button.disabled = true; $('span', button).textContent = 'Generando…';
      $('#loadingTitle').textContent = 'Creando tu imagen'; $('#loadingDetail').textContent = 'La API gratuita puede tardar un poco.';
      empty.classList.add('show'); $('#imageStatus').textContent = 'Generando imagen…';
      $('#createPreviewLabel').textContent = 'CREANDO TU IMAGEN';
      $('#createVariation').disabled = true;
      image.style.visibility = 'hidden';
      try {
        const headers = await authenticatedHeaders();
        const response = await fetch('/api/images/generate', {
          method: 'POST', headers,
          body: JSON.stringify({prompt: imagePrompt, width: dimensions[0], height: dimensions[1], seed}),
        });
        const data = response.headers.get('Content-Type')?.includes('application/json')
          ? await response.json()
          : null;
        if (response.status === 429) {
          empty.classList.remove('show'); image.style.visibility = 'visible';
          $('#imageStatus').textContent = 'Límite diario alcanzado';
          button.disabled = false; $('span', button).textContent = 'Generar imagen';
          $('#createVariation').disabled = false;
          $('#createPreviewLabel').textContent = generatedImageObjectUrl ? 'IMAGEN GENERADA' : 'IMAGEN DE EJEMPLO';
          showImageLimitDialog(data?.retryAfterSeconds || 0);
          return;
        }
        if (!response.ok) throw new Error(data?.error || 'No se pudo generar la imagen. Inténtalo más tarde.');
        const quotaRemaining = response.headers.get('X-Image-Quota-Remaining');
        const retryAfter = Number(response.headers.get('X-Image-Retry-After')) || 0;
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('El proveedor devolvió un formato de imagen no válido.');
        const objectUrl = URL.createObjectURL(blob);
        const previousObjectUrl = generatedImageObjectUrl;
        generatedImageObjectUrl = objectUrl;
        image.onload = () => {
          image.onload = null; image.onerror = null;
          if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
          empty.classList.remove('show'); image.style.visibility = 'visible'; $('#imageStatus').textContent = 'Imagen lista'; $('#imageCaption').textContent = `${description.slice(0, 34)}${description.length > 34 ? '…' : ''}`; $('#resultMeta').textContent = `Generada · ${ratio}`; button.disabled = false; $('span', button).textContent = 'Generar imagen'; $('#createVariation').disabled = false;
          $('#createPreviewLabel').textContent = 'IMAGEN GENERADA'; image.alt = `Imagen generada: ${description.slice(0, 120)}`;
          if (quotaRemaining === '0') showImageLimitDialog(retryAfter);
          if (canUseImageLibrary()) {
            saveGeneratedImage(image, imagePrompt, ratio, seed).then(saved => {
              if (!saved) return;
              $('#imageStatus').textContent = 'Guardada en tu biblioteca';
              toast('Imagen guardada en la Biblioteca.');
              if ($('.view.active')?.id === 'view-library') loadImageLibrary();
            }).catch(error => {
              console.error('No se pudo guardar la imagen en Firestore:', error);
              const reason = error?.code === 'permission-denied'
                ? 'Firestore denegó el permiso. Verifica que el perfil tenga Pro o Premium vigente y que las reglas estén publicadas en el mismo proyecto.'
                : error?.code === 'resource-exhausted'
                  ? 'Firestore rechazó el tamaño del documento.'
                  : error?.name === 'TypeError'
                    ? 'No se pudo descargar la imagen del proveedor; revisa la conexión.'
                    : error?.message || 'Error desconocido.';
              toast(`La imagen se creó, pero no se pudo guardar: ${reason}`);
            });
          }
        };
        image.onerror = () => {
          image.onload = null; image.onerror = null; URL.revokeObjectURL(objectUrl);
          if (generatedImageObjectUrl === objectUrl) generatedImageObjectUrl = previousObjectUrl;
          empty.classList.add('show'); $('#loadingTitle').textContent = 'No se pudo generar'; $('#loadingDetail').textContent = 'La respuesta del proveedor no se pudo abrir como imagen.'; $('#imageStatus').textContent = 'Error de generación'; button.disabled = false; $('span', button).textContent = 'Intentar de nuevo'; $('#createVariation').disabled = false; $('#createPreviewLabel').textContent = 'ERROR DE GENERACIÓN';
        };
        image.src = objectUrl;
        toast('Solicitud enviada al generador.');
      } catch (error) {
        empty.classList.add('show'); $('#loadingTitle').textContent = 'No se pudo generar'; $('#loadingDetail').textContent = error.message || 'Inténtalo más tarde.'; $('#imageStatus').textContent = 'Error de generación'; button.disabled = false; $('span', button).textContent = 'Intentar de nuevo'; $('#createVariation').disabled = false; $('#createPreviewLabel').textContent = 'ERROR DE GENERACIÓN';
      }
    });
    $('#openImage').addEventListener('click', () => window.open($('#generatedImage').src, '_blank', 'noopener'));
    $('#downloadImage').addEventListener('click', async () => {
      try { const response = await fetch($('#generatedImage').src); if (!response.ok) throw new Error(); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'forma-imagen.jpg'; link.click(); URL.revokeObjectURL(link.href); }
      catch { window.open($('#generatedImage').src, '_blank', 'noopener'); toast('Imagen abierta en otra pestaña; puedes guardarla desde allí.'); }
    });
    $$('.thumb').forEach(thumb => thumb.addEventListener('click', () => {
      if (generatedImageObjectUrl) { URL.revokeObjectURL(generatedImageObjectUrl); generatedImageObjectUrl = ''; }
      $$('.thumb').forEach(item => item.classList.toggle('active', item === thumb)); $('#generatedImage').src = thumb.dataset.image; $('#imageCaption').textContent = thumb.dataset.caption; $('#resultMeta').textContent = 'Imagen de inspiración · 1:1'; $('#imageStatus').textContent = 'Vista de inspiración'; $('#createPreviewLabel').textContent = 'IMAGEN DE EJEMPLO'; $('#generatedImage').alt = thumb.querySelector('img')?.alt || 'Imagen de inspiración';
    }));
    $('#shuffleGallery').addEventListener('click', () => { const thumbs = $$('.thumb'); thumbs.push(thumbs.shift()); thumbs.forEach(node => $('.thumbs').append(node)); });
    function useImageIdea(text) {
      prompt.value = text;
      prompt.dispatchEvent(new Event('input'));
      prompt.focus();
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
    $$('[data-image-prompt]').forEach(button => button.addEventListener('click', () => useImageIdea(button.dataset.imagePrompt)));
    $('#tryIdea').addEventListener('click', () => {
      const ideas = $$('[data-image-prompt]');
      if (!ideas.length) return;
      const idea = ideas[Math.floor(Math.random() * ideas.length)];
      useImageIdea(idea.dataset.imagePrompt);
    });
    $('#newProject').addEventListener('click', () => { prompt.value = ''; prompt.dispatchEvent(new Event('input')); toast('Proyecto nuevo listo.'); });

    let sourceImage = null;
    let sourceImageUrl = '';
    let sourceImageMayHaveTransparency = false;
    let overlayImage = null;
    let overlayImageUrl = '';
    let overlayPlacement = null;
    let textPlacement = null;
    let samplingBackgroundColor = false;
    const imageFile = $('#imageFile');
    const overlayImageFile = $('#overlayImageFile');
    const editorStage = $('.editor-stage', $('#view-edit'));
    const editorCanvasPreview = $('#editorCanvasPreview');
    const editorPreviewCanvas = $('#editorPreviewCanvas');
    const watermarkMaskCanvas = $('#watermarkMaskCanvas');
    const editorOverlayImage = $('#editorOverlayImage');
    const editorOverlayText = $('#editorOverlayText');
    let photoCleanupStatus = null;
    let photoCleanupBusy = false;
    let watermarkBrushActive = false;
    let watermarkMaskPointer = null;

    function editorEffectFilter() {
      return ({
        none: '', film: 'contrast(92%) saturate(82%) sepia(12%)', mono: 'grayscale(100%)',
        warm: 'sepia(18%) saturate(115%)', cool: 'hue-rotate(10deg) saturate(95%)',
        fade: 'contrast(85%) brightness(105%) saturate(75%)',
        cinematic: 'contrast(112%) saturate(88%) brightness(96%) sepia(8%)',
        matte: 'contrast(88%) saturate(78%) brightness(108%)',
        duotone: 'grayscale(100%) contrast(108%)',
        glow: 'brightness(108%) saturate(118%)',
        grain: 'contrast(104%) saturate(90%)',
      })[$('#editorEffect').value] || '';
    }

    function editorFilter() {
      const base = `brightness(${$('#brightness').value}%) contrast(${$('#contrast').value}%) saturate(${$('#saturation').value}%)`;
      return `${base} ${editorEffectFilter()}`.trim();
    }

    function removeFlatColor(canvas) {
      if (!$('#removeBackgroundEnabled').checked) return;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = image.data;
      const hex = $('#backgroundColor').value;
      const target = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
      const threshold = Number($('#backgroundTolerance').value) * 2.2;
      const feather = 20;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index] - target[0];
        const green = pixels[index + 1] - target[1];
        const blue = pixels[index + 2] - target[2];
        const distance = Math.sqrt(red * red + green * green + blue * blue);
        if (distance <= threshold) pixels[index + 3] = 0;
        else if (distance < threshold + feather) pixels[index + 3] = Math.round(pixels[index + 3] * (distance - threshold) / feather);
      }
      context.putImageData(image, 0, 0);
    }

    function applyPremiumPixelEffect(canvas) {
      const effect = $('#editorEffect').value;
      if (!['duotone', 'grain'].includes(effect)) return;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = image.data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (!pixels[index + 3]) continue;
        if (effect === 'duotone') {
          const luminance = (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255;
          pixels[index] = 24 + (245 - 24) * luminance;
          pixels[index + 1] = 43 + (196 - 43) * luminance;
          pixels[index + 2] = 75 + (141 - 75) * luminance;
        } else {
          const noise = ((((index * 1103515245 + 12345) >>> 16) & 255) / 255 - 0.5) * 22;
          pixels[index] = Math.min(255, Math.max(0, pixels[index] + noise));
          pixels[index + 1] = Math.min(255, Math.max(0, pixels[index + 1] + noise));
          pixels[index + 2] = Math.min(255, Math.max(0, pixels[index + 2] + noise));
        }
      }
      context.putImageData(image, 0, 0);
    }

    function drawEditorBase(canvas, width, height) {
      canvas.width = width;
      canvas.height = height;
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      sourceCanvas.getContext('2d').drawImage(sourceImage, 0, 0, width, height);
      removeFlatColor(sourceCanvas);
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, width, height);
      context.filter = editorFilter();
      context.drawImage(sourceCanvas, 0, 0);
      context.filter = 'none';
      applyPremiumPixelEffect(canvas);
    }

    function defaultOverlayPlacement(position = $('#overlayPosition').value) {
      return ({
        'bottom-right': {x: 0.78, y: 0.78}, 'bottom-left': {x: 0.22, y: 0.78},
        'top-right': {x: 0.78, y: 0.22}, 'top-left': {x: 0.22, y: 0.22}, center: {x: 0.5, y: 0.5},
      })[position] || {x: 0.78, y: 0.78};
    }

    function defaultTextPlacement(position = $('#editorTextPosition').value) {
      return ({top: {x: 0.5, y: 0.14}, center: {x: 0.5, y: 0.5}, bottom: {x: 0.5, y: 0.86}})[position] || {x: 0.5, y: 0.86};
    }

    function selectCustomPosition(selector) {
      const select = $(selector);
      if (![...select.options].some(option => option.value === 'custom')) {
        const option = document.createElement('option');
        option.value = 'custom';
        option.textContent = 'Posición manual';
        select.append(option);
      }
      select.value = 'custom';
    }

    function bindEditorLayerDrag(element, getPlacement, setPlacement, initialPlacement) {
      let drag = null;
      element.tabIndex = 0;
      element.setAttribute('role', 'button');
      element.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight');
      element.addEventListener('pointerdown', event => {
        if (element.hidden || samplingBackgroundColor || event.button !== 0) return;
        const bounds = editorCanvasPreview.getBoundingClientRect();
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startPlacement: {...(getPlacement() || initialPlacement())},
          bounds,
        };
        element.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      element.addEventListener('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const x = drag.startPlacement.x + (event.clientX - drag.startX) / drag.bounds.width;
        const y = drag.startPlacement.y + (event.clientY - drag.startY) / drag.bounds.height;
        setPlacement({x: Math.min(0.98, Math.max(0.02, x)), y: Math.min(0.98, Math.max(0.02, y))});
      });
      const endDrag = event => {
        if (drag?.pointerId === event.pointerId) drag = null;
      };
      element.addEventListener('pointerup', endDrag);
      element.addEventListener('pointercancel', endDrag);
      element.addEventListener('keydown', event => {
        const directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 0.05 : 0.01;
        const current = getPlacement() || initialPlacement();
        setPlacement({
          x: Math.min(0.98, Math.max(0.02, current.x + direction[0] * step)),
          y: Math.min(0.98, Math.max(0.02, current.y + direction[1] * step)),
        });
      });
    }

    bindEditorLayerDrag(
      editorOverlayImage,
      () => overlayPlacement,
      placement => { overlayPlacement = placement; selectCustomPosition('#overlayPosition'); updateEditorOverlayPreview(); },
      defaultOverlayPlacement,
    );
    bindEditorLayerDrag(
      editorOverlayText,
      () => textPlacement,
      placement => { textPlacement = placement; selectCustomPosition('#editorTextPosition'); updateEditorOverlayPreview(); },
      defaultTextPlacement,
    );

    function updateEditorOverlayPreview() {
      if (overlayImage && overlayImageUrl) {
        if (editorOverlayImage.getAttribute('src') !== overlayImageUrl) editorOverlayImage.src = overlayImageUrl;
        editorOverlayImage.hidden = false;
        editorOverlayImage.className = 'editor-overlay-image';
        const placement = overlayPlacement || defaultOverlayPlacement();
        editorOverlayImage.style.setProperty('--layer-x', `${placement.x * 100}%`);
        editorOverlayImage.style.setProperty('--layer-y', `${placement.y * 100}%`);
        editorOverlayImage.style.setProperty('--overlay-width', `${$('#overlayScale').value}%`);
        editorOverlayImage.setAttribute('aria-label', 'Arrastra para mover la foto añadida. Usa las flechas para ajustar la posición.');
        $('#editorLayerControls').hidden = false;
        $('#overlayScaleValue').textContent = `${$('#overlayScale').value}%`;
      } else {
        editorOverlayImage.hidden = true;
        $('#editorLayerControls').hidden = true;
      }
      const text = $('#editorText').value.trim();
      editorOverlayText.textContent = text;
      editorOverlayText.hidden = !text;
      if (text) {
        const font = $('#editorFont').value;
        const effect = document.querySelector('.editor-effect-chip.selected')?.dataset.textEffect || 'clean';
        editorOverlayText.className = `editor-overlay-text font-${font} effect-${effect}`;
        const placement = textPlacement || defaultTextPlacement();
        editorOverlayText.style.setProperty('--text-x', `${placement.x * 100}%`);
        editorOverlayText.style.setProperty('--text-y', `${placement.y * 100}%`);
        editorOverlayText.style.fontSize = `${$('#editorTextSize').value}px`;
        editorOverlayText.style.color = $('#editorTextColor').value;
        editorOverlayText.style.textAlign = 'center';
        editorOverlayText.setAttribute('aria-label', `Arrastra para mover el texto: ${text}. Usa las flechas para ajustar la posición.`);
      }
      $('#backgroundToleranceValue').textContent = `${$('#backgroundTolerance').value}%`;
    }

    function renderEditorPreview() {
      if (!sourceImage) return;
      drawEditorBase(editorPreviewCanvas, editorPreviewCanvas.width, editorPreviewCanvas.height);
      updateEditorOverlayPreview();
      $('#brightnessValue').textContent = `${$('#brightness').value}%`;
      $('#contrastValue').textContent = `${$('#contrast').value}%`;
      $('#saturationValue').textContent = `${$('#saturation').value}%`;
    }

    function hasWatermarkSelection() {
      if (!watermarkMaskCanvas.width || !watermarkMaskCanvas.height) return false;
      const pixels = watermarkMaskCanvas.getContext('2d', {willReadFrequently: true})
        .getImageData(0, 0, watermarkMaskCanvas.width, watermarkMaskCanvas.height).data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] > 24 && pixels[index + 3] > 24) return true;
      }
      return false;
    }

    function setPhotoCleanupMessage(message, kind = '') {
      const status = $('#photoCleanupUsage');
      status.textContent = message;
      status.classList.toggle('is-error', kind === 'error');
      status.classList.toggle('is-ready', kind === 'ready');
    }

    function updatePhotoCleanupControls() {
      const available = photoCleanupStatus?.configured && photoCleanupStatus.allowed && photoCleanupStatus.available;
      const selected = hasWatermarkSelection();
      $('#toggleWatermarkBrush').disabled = !sourceImage;
      $('#clearWatermarkMask').disabled = !selected;
      $('#removeOwnWatermark').disabled = !sourceImage || !selected || !$('#confirmPhotoRights').checked || photoCleanupBusy || !available;
    }

    async function loadPhotoCleanupStatus() {
      if (!activeChatUser) return;
      try {
        const headers = await authenticatedHeaders();
        const response = await fetch('/api/photo-cleanup/status', {headers: {Authorization: headers.Authorization}});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo consultar la disponibilidad.');
        photoCleanupStatus = data;
        if (!data.allowed) setPhotoCleanupMessage('Disponible solo con Pro o Premium.', 'error');
        else if (!data.configured) setPhotoCleanupMessage('Servicio sin configurar.', 'error');
        else setPhotoCleanupMessage('Uso ilimitado incluido en tu plan.', 'ready');
      } catch (error) {
        photoCleanupStatus = null;
        setPhotoCleanupMessage(error.message || 'No se pudo consultar la disponibilidad.', 'error');
      }
      updatePhotoCleanupControls();
    }

    function cleanupMaskPoint(event) {
      const bounds = watermarkMaskCanvas.getBoundingClientRect();
      return {
        x: (event.clientX - bounds.left) * watermarkMaskCanvas.width / bounds.width,
        y: (event.clientY - bounds.top) * watermarkMaskCanvas.height / bounds.height,
      };
    }

    function drawCleanupMaskSegment(from, to) {
      const context = watermarkMaskCanvas.getContext('2d');
      context.save();
      context.globalCompositeOperation = $('#watermarkMaskMode').value === 'erase' ? 'destination-out' : 'source-over';
      context.strokeStyle = 'rgba(255, 54, 80, .78)';
      context.fillStyle = 'rgba(255, 54, 80, .78)';
      context.lineWidth = Number($('#watermarkBrushSize').value) * watermarkMaskCanvas.width / Math.max(1, watermarkMaskCanvas.clientWidth);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.beginPath();
      context.arc(to.x, to.y, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
      updatePhotoCleanupControls();
    }

    function canvasBlob(canvas, type, quality) {
      return new Promise((resolve, reject) => canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen para el servicio.')),
        type,
        quality,
      ));
    }

    async function createPhotoCleanupFiles() {
      const maxPixels = 16_000_000;
      const scale = Math.min(1, Math.sqrt(maxPixels / (sourceImage.naturalWidth * sourceImage.naturalHeight)));
      const width = Math.max(1, Math.floor(sourceImage.naturalWidth * scale));
      const height = Math.max(1, Math.floor(sourceImage.naturalHeight * scale));
      const imageCanvas = document.createElement('canvas');
      imageCanvas.width = width;
      imageCanvas.height = height;
      imageCanvas.getContext('2d').drawImage(sourceImage, 0, 0, width, height);
      const imageType = sourceImageMayHaveTransparency ? 'image/png' : 'image/jpeg';
      let imageBlob = await canvasBlob(imageCanvas, imageType, 0.9);
      if (imageType === 'image/jpeg') {
        for (const quality of [0.82, 0.72, 0.62]) {
          if (imageBlob.size <= 30 * 1024 * 1024) break;
          imageBlob = await canvasBlob(imageCanvas, imageType, quality);
        }
      }
      if (imageBlob.size > 30 * 1024 * 1024) throw new Error('La imagen supera el límite de 30 MB de Cleanup.');

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskContext = maskCanvas.getContext('2d', {willReadFrequently: true});
      maskContext.fillStyle = '#000000';
      maskContext.fillRect(0, 0, width, height);
      maskContext.drawImage(watermarkMaskCanvas, 0, 0, width, height);
      const maskPixels = maskContext.getImageData(0, 0, width, height);
      for (let index = 0; index < maskPixels.data.length; index += 4) {
        const marked = maskPixels.data[index] > 35 && maskPixels.data[index + 3] > 20;
        const value = marked ? 255 : 0;
        maskPixels.data[index] = value;
        maskPixels.data[index + 1] = value;
        maskPixels.data[index + 2] = value;
        maskPixels.data[index + 3] = 255;
      }
      maskContext.putImageData(maskPixels, 0, 0);
      const maskBlob = await canvasBlob(maskCanvas, 'image/png');
      if (maskBlob.size > 30 * 1024 * 1024) throw new Error('La máscara supera el límite de 30 MB de Cleanup.');
      return {imageBlob, imageType, maskBlob};
    }

    function fitEditorPreview() {
      if (!sourceImage) return;
      const maxWidth = Math.max(1, editorStage.clientWidth - 48);
      const maxHeight = Math.max(1, Math.min(520, editorStage.clientHeight - 48));
      const scale = Math.min(1, maxWidth / sourceImage.naturalWidth, maxHeight / sourceImage.naturalHeight);
      const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
      const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
      editorCanvasPreview.style.width = `${width}px`;
      editorCanvasPreview.style.height = `${height}px`;
      editorCanvasPreview.hidden = false;
      editorStage.classList.add('has-image');
      const previousMask = document.createElement('canvas');
      previousMask.width = watermarkMaskCanvas.width;
      previousMask.height = watermarkMaskCanvas.height;
      if (previousMask.width && previousMask.height) previousMask.getContext('2d').drawImage(watermarkMaskCanvas, 0, 0);
      watermarkMaskCanvas.width = width;
      watermarkMaskCanvas.height = height;
      watermarkMaskCanvas.getContext('2d').drawImage(previousMask, 0, 0, width, height);
      editorPreviewCanvas.width = width;
      editorPreviewCanvas.height = height;
      renderEditorPreview();
    }

    function loadEditorImage(file, asOverlay = false) {
      if (!file || !/^image\/(?:jpeg|png|webp|gif|avif)$/i.test(file.type) || file.size > 20 * 1024 * 1024) {
        return toast('Elige JPG, PNG, WebP, GIF o AVIF de hasta 20 MB.');
      }
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        if (asOverlay) {
          if (overlayImageUrl) URL.revokeObjectURL(overlayImageUrl);
          overlayImageUrl = imageUrl;
          overlayImage = image;
          overlayPlacement = null;
        } else {
          if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
          sourceImageUrl = imageUrl;
          sourceImage = image;
          sourceImageMayHaveTransparency = file.type !== 'image/jpeg';
          watermarkMaskCanvas.getContext('2d').clearRect(0, 0, watermarkMaskCanvas.width, watermarkMaskCanvas.height);
          $('#imageDrop').style.display = 'none';
          editorCanvasPreview.hidden = false;
          requestAnimationFrame(fitEditorPreview);
        }
        renderEditorPreview();
        updatePhotoCleanupControls();
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        toast('No se pudo abrir esta imagen.');
      };
      image.src = imageUrl;
    }

    $('#chooseImage').addEventListener('click', () => imageFile.click());
    imageFile.addEventListener('change', () => {
      const file = imageFile.files[0];
      imageFile.value = '';
      if (file) loadEditorImage(file);
    });
    $('#addOverlayImage').addEventListener('click', () => overlayImageFile.click());
    overlayImageFile.addEventListener('change', () => {
      const file = overlayImageFile.files[0];
      overlayImageFile.value = '';
      if (file) loadEditorImage(file, true);
    });
    $('#removeOverlayImage').addEventListener('click', () => {
      if (overlayImageUrl) URL.revokeObjectURL(overlayImageUrl);
      overlayImageUrl = '';
      overlayImage = null;
      overlayPlacement = null;
      renderEditorPreview();
    });
    const editorResizeObserver = new ResizeObserver(fitEditorPreview);
    editorResizeObserver.observe(editorStage);
    syncPremiumEditorAccess();
    ['brightness', 'contrast', 'saturation', 'editorEffect', 'overlayScale', 'overlayPosition', 'editorText', 'editorFont', 'editorTextPosition', 'editorTextSize', 'editorTextColor', 'backgroundTolerance']
      .forEach(id => $(`#${id}`).addEventListener('input', renderEditorPreview));
    $('#editorEffect').addEventListener('change', event => {
      if (event.currentTarget.selectedOptions[0]?.dataset.editorPremium && !hasPremiumEditorAccess()) {
        event.currentTarget.value = 'none';
        return toast('Este efecto requiere Pro o Premium.');
      }
      renderEditorPreview();
    });
    $('#editorFont').addEventListener('change', event => {
      if (event.currentTarget.selectedOptions[0]?.dataset.editorPremium && !hasPremiumEditorAccess()) {
        event.currentTarget.value = 'instrument';
        return toast('Esta tipografía requiere Pro o Premium.');
      }
      renderEditorPreview();
    });
    $('#overlayPosition').addEventListener('change', () => {
      if ($('#overlayPosition').value === 'custom') return;
      overlayPlacement = null;
      renderEditorPreview();
    });
    $('#editorTextPosition').addEventListener('change', () => {
      if ($('#editorTextPosition').value === 'custom') return;
      textPlacement = null;
      renderEditorPreview();
    });
    $('#removeBackgroundEnabled').addEventListener('change', renderEditorPreview);
    $('#backgroundColor').addEventListener('input', () => {
      $('#removeBackgroundEnabled').checked = true;
      renderEditorPreview();
    });
    $$('.editor-effect-chip').forEach(button => button.addEventListener('click', () => {
      $$('.editor-effect-chip').forEach(item => item.classList.toggle('selected', item === button));
      renderEditorPreview();
    }));
    $('#sampleBackgroundColor').addEventListener('click', () => {
      if (!sourceImage) return toast('Primero elige una imagen.');
      samplingBackgroundColor = true;
      editorStage.classList.add('is-sampling');
      toast('Haz clic sobre el color del fondo que quieres quitar.');
    });
    editorPreviewCanvas.addEventListener('click', event => {
      if (!samplingBackgroundColor || !sourceImage) return;
      const bounds = editorPreviewCanvas.getBoundingClientRect();
      const x = Math.min(sourceImage.naturalWidth - 1, Math.max(0, Math.floor((event.clientX - bounds.left) / bounds.width * sourceImage.naturalWidth)));
      const y = Math.min(sourceImage.naturalHeight - 1, Math.max(0, Math.floor((event.clientY - bounds.top) / bounds.height * sourceImage.naturalHeight)));
      const sample = document.createElement('canvas');
      sample.width = 1;
      sample.height = 1;
      const context = sample.getContext('2d', {willReadFrequently: true});
      context.drawImage(sourceImage, x, y, 1, 1, 0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      $('#backgroundColor').value = `#${[red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('')}`;
      $('#removeBackgroundEnabled').checked = true;
      samplingBackgroundColor = false;
      editorStage.classList.remove('is-sampling');
      renderEditorPreview();
    });
    $('#confirmPhotoRights').addEventListener('change', updatePhotoCleanupControls);
    $('#watermarkBrushSize').addEventListener('input', () => {
      $('#watermarkBrushSizeValue').textContent = `${$('#watermarkBrushSize').value} px`;
    });
    $('#toggleWatermarkBrush').addEventListener('click', event => {
      watermarkBrushActive = !watermarkBrushActive;
      watermarkMaskCanvas.hidden = !watermarkBrushActive;
      editorCanvasPreview.classList.toggle('is-mask-editing', watermarkBrushActive);
      event.currentTarget.setAttribute('aria-pressed', String(watermarkBrushActive));
      event.currentTarget.textContent = watermarkBrushActive ? 'Terminar selección' : 'Marcar zona';
      if (watermarkBrushActive) toast('Pinta sobre la marca propia o el área que tienes permiso para modificar.');
    });
    $('#clearWatermarkMask').addEventListener('click', () => {
      watermarkMaskCanvas.getContext('2d').clearRect(0, 0, watermarkMaskCanvas.width, watermarkMaskCanvas.height);
      updatePhotoCleanupControls();
    });
    watermarkMaskCanvas.addEventListener('pointerdown', event => {
      if (!watermarkBrushActive || event.button !== 0) return;
      event.preventDefault();
      watermarkMaskPointer = event.pointerId;
      watermarkMaskCanvas.setPointerCapture(event.pointerId);
      const point = cleanupMaskPoint(event);
      drawCleanupMaskSegment(point, point);
    });
    watermarkMaskCanvas.addEventListener('pointermove', event => {
      if (watermarkMaskPointer !== event.pointerId) return;
      const point = cleanupMaskPoint(event);
      drawCleanupMaskSegment(point, point);
    });
    const finishMaskStroke = event => {
      if (watermarkMaskPointer === event.pointerId) watermarkMaskPointer = null;
    };
    watermarkMaskCanvas.addEventListener('pointerup', finishMaskStroke);
    watermarkMaskCanvas.addEventListener('pointercancel', finishMaskStroke);
    $('#removeOwnWatermark').addEventListener('click', async event => {
      if (!$('#confirmPhotoRights').checked) return toast('Confirma que tienes permiso para modificar esta imagen.');
      if (!hasWatermarkSelection()) return toast('Pinta primero la zona que quieres limpiar.');
      if (!photoCleanupStatus?.available) {
        await loadPhotoCleanupStatus();
        updatePhotoCleanupControls();
        if (!photoCleanupStatus?.available) return;
      }
      const button = event.currentTarget;
      button.disabled = true;
      photoCleanupBusy = true;
      button.textContent = 'Limpiando…';
      updatePhotoCleanupControls();
      try {
        const {imageBlob, imageType, maskBlob} = await createPhotoCleanupFiles();
        const formData = new FormData();
        formData.append('image_file', imageBlob, imageType === 'image/png' ? 'source.png' : 'source.jpg');
        formData.append('mask_file', maskBlob, 'mask.png');
        formData.append('mode', $('#photoCleanupMode').value);
        formData.append('rights_confirmed', 'true');
        const headers = await authenticatedHeaders();
        const response = await fetch('/api/photo-cleanup', {
          method: 'POST',
          headers: {Authorization: headers.Authorization},
          body: formData,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'El servicio no pudo limpiar esta selección.');
        }
        const cleanedImageBlob = await response.blob();
        if (cleanedImageBlob.type !== 'image/png') throw new Error('El servicio devolvió un formato de imagen inesperado.');
        const cleanedImageUrl = URL.createObjectURL(cleanedImageBlob);
        const cleanedImage = new Image();
        await new Promise((resolve, reject) => {
          cleanedImage.onload = resolve;
          cleanedImage.onerror = () => reject(new Error('No se pudo abrir la imagen limpiada.'));
          cleanedImage.src = cleanedImageUrl;
        });
        if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
        sourceImageUrl = cleanedImageUrl;
        sourceImage = cleanedImage;
        sourceImageMayHaveTransparency = true;
        watermarkMaskCanvas.getContext('2d').clearRect(0, 0, watermarkMaskCanvas.width, watermarkMaskCanvas.height);
        watermarkBrushActive = false;
        watermarkMaskCanvas.hidden = true;
        editorCanvasPreview.classList.remove('is-mask-editing');
        $('#toggleWatermarkBrush').setAttribute('aria-pressed', 'false');
        $('#toggleWatermarkBrush').textContent = 'Marcar zona';
        fitEditorPreview();
        toast('Área limpiada. Revisa el resultado y descarga la imagen.');
        await loadPhotoCleanupStatus();
      } catch (error) {
        console.error('No se pudo limpiar el área seleccionada:', error);
        toast(error.message || 'No se pudo limpiar el área.');
      } finally {
        photoCleanupBusy = false;
        button.textContent = 'Limpiar área marcada';
        updatePhotoCleanupControls();
      }
    });
    $('#resetEdits').addEventListener('click', () => {
      ['brightness', 'contrast', 'saturation'].forEach(name => { $(`#${name}`).value = 100; });
      $('#editorEffect').value = 'none';
      $('#editorText').value = '';
      $('#editorTextSize').value = 48;
      $('#editorTextColor').value = '#ffffff';
      $('#editorTextPosition').value = 'bottom';
      $('#editorFont').value = 'instrument';
      $('#overlayScale').value = 38;
      $('#overlayPosition').value = 'bottom-right';
      overlayPlacement = null;
      textPlacement = null;
      $('#removeBackgroundEnabled').checked = false;
      $$('.editor-effect-chip').forEach(button => button.classList.toggle('selected', button.dataset.textEffect === 'clean'));
      if (overlayImageUrl) URL.revokeObjectURL(overlayImageUrl);
      overlayImageUrl = '';
      overlayImage = null;
      samplingBackgroundColor = false;
      editorStage.classList.remove('is-sampling');
      renderEditorPreview();
    });
    function wrapEditorText(context, text, maxWidth) {
      const lines = [];
      for (const paragraph of text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
          const candidate = line ? `${line} ${word}` : word;
          if (line && context.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
          } else line = candidate;
        }
        lines.push(line);
      }
      return lines.filter(Boolean);
    }

    function drawEditorText(context, width, height) {
      const text = $('#editorText').value.trim();
      if (!text) return;
      const fontFamilies = {
        instrument: 'Instrument Sans', bricolage: 'Bricolage Grotesque', serif: 'Georgia',
        mono: 'Courier New', impact: 'Impact', playfair: 'Playfair Display', space: 'Space Grotesk',
        cormorant: 'Cormorant Garamond', bebas: 'Bebas Neue', dmmono: 'DM Mono',
      };
      const scale = width / Math.max(1, editorPreviewCanvas.width);
      const fontSize = Math.max(12, Number($('#editorTextSize').value) * scale);
      const effect = document.querySelector('.editor-effect-chip.selected')?.dataset.textEffect || 'clean';
      const color = $('#editorTextColor').value;
      const maxWidth = width * 0.86;
      const placement = textPlacement || defaultTextPlacement();
      context.save();
      context.font = `700 ${fontSize}px "${fontFamilies[$('#editorFont').value] || fontFamilies.instrument}"`;
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.lineJoin = 'round';
      const lines = wrapEditorText(context, text, maxWidth);
      const lineHeight = fontSize * 1.12;
      const maxLineWidth = Math.max(...lines.map(line => context.measureText(line).width));
      const totalHeight = lines.length * lineHeight;
      const x = placement.x * width;
      const y = placement.y * height - totalHeight / 2;
      if (effect === 'label') {
        const paddingX = fontSize * 0.3;
        const paddingY = fontSize * 0.2;
        const boxX = x - maxLineWidth / 2 - paddingX;
        context.fillStyle = 'rgba(8, 10, 14, .72)';
        context.fillRect(boxX, y - paddingY, maxLineWidth + paddingX * 2, totalHeight + paddingY * 2);
      }
      context.fillStyle = color;
      if (effect === 'clean') {
        context.shadowColor = 'rgba(0,0,0,.78)';
        context.shadowBlur = fontSize * 0.2;
        context.shadowOffsetY = fontSize * 0.04;
      } else if (effect === 'neon') {
        context.shadowColor = color;
        context.shadowBlur = fontSize * 0.5;
      } else if (effect === 'outline') {
        context.strokeStyle = 'rgba(0,0,0,.9)';
        context.lineWidth = Math.max(2, fontSize * 0.07);
      }
      lines.forEach((line, index) => {
        const lineY = y + index * lineHeight;
        if (effect === 'outline') context.strokeText(line, x, lineY, maxWidth);
        context.fillText(line, x, lineY, maxWidth);
      });
      context.restore();
    }

    function drawEditorLayers(context, width, height) {
      if (overlayImage) {
        const scale = Number($('#overlayScale').value) / 100;
        let layerWidth = width * scale;
        let layerHeight = layerWidth * overlayImage.naturalHeight / overlayImage.naturalWidth;
        const maxHeight = height * 0.78;
        if (layerHeight > maxHeight) {
          layerWidth *= maxHeight / layerHeight;
          layerHeight = maxHeight;
        }
        const placement = overlayPlacement || defaultOverlayPlacement();
        const x = placement.x * width - layerWidth / 2;
        const y = placement.y * height - layerHeight / 2;
        context.drawImage(overlayImage, x, y, layerWidth, layerHeight);
      }
      drawEditorText(context, width, height);
    }

    async function createEditorOutput() {
      if (!sourceImage) throw new Error('Primero elige una imagen.');
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = document.createElement('canvas');
      drawEditorBase(canvas, sourceImage.naturalWidth, sourceImage.naturalHeight);
      drawEditorLayers(canvas.getContext('2d'), canvas.width, canvas.height);
      return canvas;
    }

    $('#exportImage').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const canvas = await createEditorOutput();
        canvas.toBlob(blob => {
          if (!blob) {
            toast('No se pudo exportar la composición.');
            button.disabled = false;
            return;
          }
          const link = document.createElement('a');
          const downloadUrl = URL.createObjectURL(blob);
          link.href = downloadUrl;
          link.download = 'forma-foto-editada.png';
          link.click();
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
          button.disabled = false;
        }, 'image/png');
      } catch (error) {
        toast(error.message || 'No se pudo exportar la composición.');
        button.disabled = false;
      }
    });
    $('#saveEditedImage').addEventListener('click', async event => {
      if (!sourceImage) return toast('Primero elige una imagen.');
      if (!canUseImageLibrary()) {
        setActiveView('plans');
        return toast('Guardar en la biblioteca requiere Pro o Premium.');
      }
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const output = await createEditorOutput();
        const ratio = sourceImage.naturalWidth > sourceImage.naturalHeight * 1.15 ? '4:3'
          : sourceImage.naturalHeight > sourceImage.naturalWidth * 1.15 ? '3:4' : '1:1';
        const imageFormat = $('#removeBackgroundEnabled').checked || sourceImageMayHaveTransparency ? 'image/png' : 'image/jpeg';
        await saveGeneratedImage(output, 'Foto editada', ratio, 0, 'none', imageFormat);
        toast('Foto guardada en la biblioteca.');
      } catch (error) {
        console.error('No se pudo guardar la foto editada:', error);
        toast(error.message || 'No se pudo guardar la foto en la biblioteca.');
      } finally {
        button.disabled = false;
      }
    });

    const videoFile = $('#videoFile');
    const videoPlayer = $('#videoPlayer');
    const videoPreview = $('#videoPreview');
    const videoOverlayCanvas = $('#videoOverlayCanvas');
    const videoOverlayContext = videoOverlayCanvas.getContext('2d');
    const videoOverlayFile = $('#videoOverlayFile');
    let videoSourceObjectUrl = '';
    let videoOverlayObjectUrl = '';
    let videoOverlayImage = null;
    let videoOverlayVideo = null;
    let videoOverlayLoadId = 0;
    let videoStickerPlacement = null;
    let videoTextPlacement = null;
    let activeVideoDrag = null;
    let videoAudioContext = null;
    let videoAudioSource = null;
    const videoGlitchImage = new Image();
    videoGlitchImage.onload = () => renderVideoPreviewFrame();
    videoGlitchImage.src = '/assets/ass/glitch.png';
    const videoGrainTexture = document.createElement('canvas');
    videoGrainTexture.width = 128;
    videoGrainTexture.height = 128;
    const videoGrainContext = videoGrainTexture.getContext('2d');
    if (videoGrainContext) {
      const grain = videoGrainContext.createImageData(videoGrainTexture.width, videoGrainTexture.height);
      for (let index = 0; index < grain.data.length; index += 4) {
        const shade = Math.random() > 0.5 ? 255 : 0;
        grain.data[index] = shade;
        grain.data[index + 1] = shade;
        grain.data[index + 2] = shade;
        grain.data[index + 3] = 38;
      }
      videoGrainContext.putImageData(grain, 0, 0);
    }
    const videoEffectFilters = {
      none: 'none', film: 'contrast(92%) saturate(82%) sepia(12%)', mono: 'grayscale(100%)',
      warm: 'sepia(18%) saturate(115%)', cool: 'hue-rotate(10deg) saturate(95%)',
      fade: 'contrast(85%) brightness(105%) saturate(75%)', cinematic: 'contrast(112%) saturate(88%) brightness(96%) sepia(8%)',
      matte: 'contrast(88%) saturate(78%) brightness(108%)', duotone: 'grayscale(100%) sepia(65%) hue-rotate(155deg) saturate(140%)',
      glow: 'brightness(112%) saturate(125%)', grain: 'contrast(108%) saturate(88%)',
      glitch: 'contrast(125%) saturate(145%)', vhs: 'contrast(110%) saturate(125%) hue-rotate(345deg)',
      chromatic: 'saturate(115%)', dream: 'brightness(108%) saturate(125%) blur(.6px)',
      noir: 'grayscale(100%) contrast(145%) brightness(86%)', pop: 'saturate(190%) contrast(120%)',
      negative: 'invert(100%) hue-rotate(180deg)', solarize: 'contrast(175%) saturate(160%) hue-rotate(150deg)',
    };

    function formatTime(seconds) {
      if (!Number.isFinite(seconds)) return '00:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function updateTrimLabels() {
      $('#startRead').textContent = formatTime(Number($('#trimStart').value));
      $('#endRead').textContent = formatTime(Number($('#trimEnd').value));
    }

    function drawVideoFinishingEffects(context, width, height) {
      const effect = $('#videoEffect').value;
      if (effect === 'chromatic') {
        const offset = Math.max(2, width * 0.003);
        context.save();
        context.globalAlpha = 0.16;
        context.globalCompositeOperation = 'screen';
        context.filter = 'sepia(100%) hue-rotate(300deg) saturate(350%)';
        context.drawImage(videoPlayer, -offset, 0, width, height);
        context.filter = 'sepia(100%) hue-rotate(145deg) saturate(350%)';
        context.drawImage(videoPlayer, offset, 0, width, height);
        context.restore();
      }
      if (effect === 'grain' && videoGrainTexture.width) {
        context.save();
        context.globalAlpha = 0.16;
        context.globalCompositeOperation = 'overlay';
        context.drawImage(videoGrainTexture, 0, 0, width, height);
        context.restore();
      }
      if (effect === 'vhs') {
        context.save();
        context.fillStyle = 'rgba(0, 0, 0, .22)';
        const gap = Math.max(4, Math.round(height / 90));
        for (let y = 0; y < height; y += gap) context.fillRect(0, y, width, 1);
        context.restore();
      }
      if ((effect === 'glitch' || $('#videoOverlayAsset').value.endsWith('/glitch.png')) && videoGlitchImage.complete && videoGlitchImage.naturalWidth) {
        context.save();
        context.globalAlpha = effect === 'glitch' ? 0.34 : 0.25;
        context.globalCompositeOperation = 'screen';
        context.drawImage(videoGlitchImage, 0, 0, width, height);
        context.restore();
      }
    }

    function positionVideoDragTarget(target, centerX, centerY, targetWidth, targetHeight, canvasWidth, canvasHeight) {
      const scaleX = videoPreview.clientWidth / canvasWidth;
      const scaleY = videoPreview.clientHeight / canvasHeight;
      const styles = {
        left: `${centerX * scaleX}px`,
        top: `${centerY * scaleY}px`,
        width: `${Math.max(32, targetWidth * scaleX)}px`,
        height: `${Math.max(32, targetHeight * scaleY)}px`,
      };
      Object.entries(styles).forEach(([property, value]) => {
        if (target.style[property] !== value) target.style[property] = value;
      });
      target.hidden = false;
    }

    function drawVideoSticker(context, width, height) {
      const target = $('#videoStickerDragTarget');
      if ($('#videoOverlayAsset').value.endsWith('/glitch.png')) {
        target.hidden = true;
        return;
      }
      const media = videoOverlayVideo || videoOverlayImage;
      if (!media) {
        target.hidden = true;
        return;
      }
      const mediaWidth = videoOverlayVideo ? videoOverlayVideo.videoWidth : videoOverlayImage.naturalWidth;
      const mediaHeight = videoOverlayVideo ? videoOverlayVideo.videoHeight : videoOverlayImage.naturalHeight;
      if (!mediaWidth || !mediaHeight || (videoOverlayVideo && videoOverlayVideo.readyState < 2)) {
        target.hidden = true;
        return;
      }
      const aspect = mediaWidth / mediaHeight;
      let stickerWidth = width * Number($('#videoOverlayScale').value) / 100;
      let stickerHeight = stickerWidth / aspect;
      const maxHeight = height * 0.72;
      if (stickerHeight > maxHeight) {
        stickerHeight = maxHeight;
        stickerWidth = stickerHeight * aspect;
      }
      const insetX = width * 0.055;
      const insetY = height * 0.07;
      const position = $('#videoOverlayPosition').value;
      const defaults = {
        'top-left': {x: insetX + stickerWidth / 2, y: insetY + stickerHeight / 2},
        'top-right': {x: width - insetX - stickerWidth / 2, y: insetY + stickerHeight / 2},
        'bottom-left': {x: insetX + stickerWidth / 2, y: height - insetY - stickerHeight / 2},
        'bottom-right': {x: width - insetX - stickerWidth / 2, y: height - insetY - stickerHeight / 2},
        center: {x: width / 2, y: height / 2},
      };
      const placement = videoStickerPlacement || defaults[position] || defaults.center;
      const centerX = videoStickerPlacement ? placement.x * width : placement.x;
      const centerY = videoStickerPlacement ? placement.y * height : placement.y;
      const x = centerX - stickerWidth / 2;
      const y = centerY - stickerHeight / 2;
      positionVideoDragTarget(target, centerX, centerY, stickerWidth + 18, stickerHeight + 18, width, height);
      context.drawImage(media, x, y, stickerWidth, stickerHeight);
    }

    function drawVideoCaption(context, width, height) {
      const text = $('#videoText').value.trim();
      if (!text) {
        $('#videoTextDragTarget').hidden = true;
        return;
      }
      const fontFamilies = {
        instrument: 'Instrument Sans', bricolage: 'Bricolage Grotesque', serif: 'Georgia',
        mono: 'Courier New', impact: 'Impact', playfair: 'Playfair Display', space: 'Space Grotesk',
        cormorant: 'Cormorant Garamond', bebas: 'Bebas Neue', dmmono: 'DM Mono',
      };
      const displayWidth = Math.max(1, videoPlayer.clientWidth || width);
      const fontSize = Math.max(12, Number($('#videoTextSize').value) * width / displayWidth);
      const maxWidth = width * 0.88;
      const lineHeight = fontSize * 1.12;
      const color = $('#videoTextColor').value;
      const effect = $('#videoTextEffect').value;
      context.save();
      context.font = `700 ${fontSize}px "${fontFamilies[$('#videoFont').value] || fontFamilies.instrument}"`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineJoin = 'round';
      const lines = wrapEditorText(context, text, maxWidth);
      const totalHeight = lines.length * lineHeight;
      const defaultY = ({top: 0.18, center: 0.5, bottom: 0.82})[$('#videoTextPosition').value] ?? 0.5;
      const placement = videoTextPlacement || {x: 0.5, y: defaultY};
      const centerX = placement.x * width;
      const centerY = placement.y * height;
      const firstY = centerY - totalHeight / 2;
      const widestLine = Math.max(...lines.map(line => context.measureText(line).width));
      positionVideoDragTarget($('#videoTextDragTarget'), centerX, centerY, widestLine + fontSize * 0.55, totalHeight + fontSize * 0.45, width, height);
      if (effect === 'label') {
        const paddingX = fontSize * 0.3;
        const paddingY = fontSize * 0.2;
        context.fillStyle = 'rgba(8, 10, 14, .72)';
        context.fillRect(centerX - widestLine / 2 - paddingX, firstY - paddingY, widestLine + paddingX * 2, totalHeight + paddingY * 2);
      }
      if (effect === 'gradient') {
        const gradient = context.createLinearGradient(centerX - widestLine / 2, 0, centerX + widestLine / 2, 0);
        gradient.addColorStop(0, '#ff4f9a');
        gradient.addColorStop(0.52, '#ffd166');
        gradient.addColorStop(1, '#5de2e7');
        context.fillStyle = gradient;
      } else context.fillStyle = color;
      if (effect === 'clean') {
        context.shadowColor = 'rgba(0, 0, 0, .78)';
        context.shadowBlur = fontSize * 0.2;
        context.shadowOffsetY = fontSize * 0.04;
      } else if (effect === 'neon') {
        context.shadowColor = color;
        context.shadowBlur = fontSize * 0.5;
      } else if (effect === 'shadow') {
        context.shadowColor = 'rgba(0, 0, 0, .9)';
        context.shadowBlur = fontSize * 0.35;
        context.shadowOffsetX = fontSize * 0.1;
        context.shadowOffsetY = fontSize * 0.14;
      } else if (effect === 'outline') {
        context.strokeStyle = 'rgba(0, 0, 0, .9)';
        context.lineWidth = Math.max(2, fontSize * 0.07);
      } else if (effect === 'retro') {
        context.strokeStyle = '#ff4f7b';
        context.lineWidth = Math.max(2, fontSize * 0.14);
      }
      if (effect === 'glitch') {
        context.save();
        context.globalCompositeOperation = 'screen';
        context.globalAlpha = 0.9;
        context.fillStyle = '#00e5ff';
        lines.forEach((line, index) => context.fillText(line, centerX - fontSize * 0.07, firstY + index * lineHeight + lineHeight / 2, maxWidth));
        context.fillStyle = '#ff315f';
        lines.forEach((line, index) => context.fillText(line, centerX + fontSize * 0.07, firstY + index * lineHeight + lineHeight / 2, maxWidth));
        context.restore();
        context.fillStyle = '#fff';
      }
      lines.forEach((line, index) => {
        const y = firstY + index * lineHeight + lineHeight / 2;
        if (effect === 'outline' || effect === 'retro') context.strokeText(line, centerX, y, maxWidth);
        context.fillText(line, centerX, y, maxWidth);
      });
      context.restore();
    }

    function drawVideoOverlays(context, width, height) {
      drawVideoFinishingEffects(context, width, height);
      drawVideoSticker(context, width, height);
      drawVideoCaption(context, width, height);
    }

    function renderVideoPreviewFrame() {
      if (!videoPreview.classList.contains('visible') || videoPlayer.readyState < 2) return;
      const bounds = videoPlayer.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (videoOverlayCanvas.width !== width || videoOverlayCanvas.height !== height) {
        videoOverlayCanvas.width = width;
        videoOverlayCanvas.height = height;
      }
      videoPlayer.style.filter = videoEffectFilters[$('#videoEffect').value] || 'none';
      videoOverlayContext.clearRect(0, 0, width, height);
      drawVideoOverlays(videoOverlayContext, width, height);
    }

    function scheduleVideoPreviewFrame() {
      if (videoPlayer.paused || videoPlayer.ended) return;
      if (videoPlayer.requestVideoFrameCallback) {
        videoPlayer.requestVideoFrameCallback(() => {
          renderVideoPreviewFrame();
          scheduleVideoPreviewFrame();
        });
      } else {
        requestAnimationFrame(() => {
          renderVideoPreviewFrame();
          scheduleVideoPreviewFrame();
        });
      }
    }

    function startVideoDrag(target, kind, event) {
      if (event.button !== 0) return;
      event.preventDefault();
      activeVideoDrag = {target, kind, pointerId: event.pointerId};
      target.classList.add('is-dragging');
      target.setPointerCapture(event.pointerId);
    }

    function moveVideoDrag(event) {
      if (!activeVideoDrag || activeVideoDrag.pointerId !== event.pointerId) return;
      const bounds = videoOverlayCanvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const placement = {
        x: Math.min(0.97, Math.max(0.03, (event.clientX - bounds.left) / bounds.width)),
        y: Math.min(0.94, Math.max(0.06, (event.clientY - bounds.top) / bounds.height)),
      };
      if (activeVideoDrag.kind === 'text') {
        videoTextPlacement = placement;
        $('#videoTextPosition').value = 'custom';
      } else {
        videoStickerPlacement = placement;
        $('#videoOverlayPosition').value = 'custom';
      }
      renderVideoPreviewFrame();
    }

    function finishVideoDrag(event) {
      if (!activeVideoDrag || activeVideoDrag.pointerId !== event.pointerId) return;
      activeVideoDrag.target.classList.remove('is-dragging');
      activeVideoDrag = null;
    }

    [[$('#videoTextDragTarget'), 'text'], [$('#videoStickerDragTarget'), 'sticker']].forEach(([target, kind]) => {
      target.addEventListener('pointerdown', event => startVideoDrag(target, kind, event));
      target.addEventListener('pointermove', moveVideoDrag);
      target.addEventListener('pointerup', finishVideoDrag);
      target.addEventListener('pointercancel', finishVideoDrag);
    });

    function clearVideoOverlay() {
      videoOverlayLoadId += 1;
      if (videoOverlayVideo) {
        videoOverlayVideo.pause();
        videoOverlayVideo.removeAttribute('src');
        videoOverlayVideo.load();
      }
      if (videoOverlayObjectUrl) URL.revokeObjectURL(videoOverlayObjectUrl);
      videoOverlayObjectUrl = '';
      videoOverlayImage = null;
      videoOverlayVideo = null;
      $('#removeVideoOverlay').disabled = true;
      renderVideoPreviewFrame();
    }

    function loadVideoOverlay(sourceUrl, isVideo, objectUrl = '') {
      clearVideoOverlay();
      const requestId = videoOverlayLoadId;
      videoOverlayObjectUrl = objectUrl;
      $('#removeVideoOverlay').disabled = false;
      if (isVideo) {
        const overlay = document.createElement('video');
        overlay.muted = true;
        overlay.loop = true;
        overlay.playsInline = true;
        overlay.preload = 'auto';
        videoOverlayVideo = overlay;
        overlay.addEventListener('loadeddata', () => {
          if (requestId !== videoOverlayLoadId) return;
          renderVideoPreviewFrame();
          if (!videoPlayer.paused) overlay.play().catch(() => {});
        }, {once: true});
        overlay.addEventListener('error', () => {
          if (requestId !== videoOverlayLoadId) return;
          clearVideoOverlay();
          $('#videoOverlayAsset').value = '';
          toast('No se pudo abrir este clip de capa.');
        }, {once: true});
        overlay.src = sourceUrl;
        overlay.load();
      } else {
        const image = new Image();
        videoOverlayImage = image;
        image.onload = () => { if (requestId === videoOverlayLoadId) renderVideoPreviewFrame(); };
        image.onerror = () => {
          if (requestId !== videoOverlayLoadId) return;
          clearVideoOverlay();
          $('#videoOverlayAsset').value = '';
          toast('No se pudo abrir esta imagen de capa.');
        };
        image.src = sourceUrl;
      }
    }

    function formatVideoOutputSize() {
      const maxDimension = 1920;
      const scale = Math.min(1, maxDimension / videoPlayer.videoWidth, maxDimension / videoPlayer.videoHeight);
      return {
        width: Math.max(2, Math.floor(videoPlayer.videoWidth * scale / 2) * 2),
        height: Math.max(2, Math.floor(videoPlayer.videoHeight * scale / 2) * 2),
      };
    }

    async function captureVideoAudioTracks(sourceStream) {
      const sourceAudioTracks = sourceStream.getAudioTracks();
      if (sourceAudioTracks.length) return {tracks: sourceAudioTracks, destination: null};
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return {tracks: [], destination: null};
      try {
        if (!videoAudioContext) {
          videoAudioContext = new AudioContextConstructor();
          videoAudioSource = videoAudioContext.createMediaElementSource(videoPlayer);
          videoAudioSource.connect(videoAudioContext.destination);
        }
        if (videoAudioContext.state === 'suspended') await videoAudioContext.resume();
        const destination = videoAudioContext.createMediaStreamDestination();
        videoAudioSource.connect(destination);
        return {tracks: destination.stream.getAudioTracks(), destination};
      } catch (error) {
        console.warn('No se pudo capturar la pista de audio del vídeo:', error);
        return {tracks: [], destination: null};
      }
    }

    $('#chooseVideo').addEventListener('click', () => videoFile.click());
    videoFile.addEventListener('change', () => {
      const file = videoFile.files[0];
      videoFile.value = '';
      if (!file) return;
      if (!file.type.startsWith('video/') || file.size > 200 * 1024 * 1024) return toast('Elige un vídeo compatible de hasta 200 MB.');
      if (videoSourceObjectUrl) URL.revokeObjectURL(videoSourceObjectUrl);
      videoSourceObjectUrl = URL.createObjectURL(file);
      videoPlayer.onloadedmetadata = () => {
        videoPreview.hidden = false;
        videoPreview.classList.add('visible');
        $('#videoPlaceholder').hidden = true;
        $('#videoDuration').textContent = `Duración ${formatTime(videoPlayer.duration)}`;
        $('#trimStart').value = '0';
        $('#trimEnd').value = videoPlayer.duration.toFixed(1);
        $('#trimEnd').max = videoPlayer.duration;
        $('#exportVideo').disabled = false;
        $('#saveVideoLibrary').disabled = false;
        updateTrimLabels();
        renderVideoPreviewFrame();
      };
      videoPlayer.src = videoSourceObjectUrl;
      videoPlayer.load();
    });

    videoPlayer.addEventListener('play', () => {
      if (videoOverlayVideo) {
        if (Number.isFinite(videoOverlayVideo.duration) && videoOverlayVideo.duration > 0) {
          videoOverlayVideo.currentTime = videoPlayer.currentTime % videoOverlayVideo.duration;
        }
        videoOverlayVideo.play().catch(() => {});
      }
      scheduleVideoPreviewFrame();
    });
    videoPlayer.addEventListener('pause', () => {
      videoOverlayVideo?.pause();
      renderVideoPreviewFrame();
    });
    videoPlayer.addEventListener('loadeddata', renderVideoPreviewFrame);
    videoPlayer.addEventListener('seeked', renderVideoPreviewFrame);
    videoPlayer.addEventListener('timeupdate', renderVideoPreviewFrame);
    new ResizeObserver(renderVideoPreviewFrame).observe(videoPreview);
    window.addEventListener('resize', renderVideoPreviewFrame);

    function updateTrimLabelsAndPreview() {
      updateTrimLabels();
      renderVideoPreviewFrame();
    }
    ['trimStart', 'trimEnd'].forEach(id => $(`#${id}`).addEventListener('input', updateTrimLabels));
    ['videoText', 'videoTextColor']
      .forEach(id => $(`#${id}`).addEventListener('input', renderVideoPreviewFrame));
    $('#videoTextPosition').addEventListener('change', event => {
      videoTextPlacement = event.currentTarget.value === 'custom' ? (videoTextPlacement || {x: 0.5, y: 0.5}) : null;
      renderVideoPreviewFrame();
    });
    $('#videoOverlayPosition').addEventListener('change', event => {
      videoStickerPlacement = event.currentTarget.value === 'custom' ? (videoStickerPlacement || {x: 0.5, y: 0.5}) : null;
      renderVideoPreviewFrame();
    });
    $('#videoTextEffect').addEventListener('change', event => {
      if (event.currentTarget.selectedOptions[0]?.dataset.videoPremium && !hasPremiumEditorAccess()) {
        event.currentTarget.value = 'clean';
        renderVideoPreviewFrame();
        return toast('Este tratamiento de texto requiere Pro o Premium.');
      }
      renderVideoPreviewFrame();
    });
    $('#videoTextSize').addEventListener('input', () => {
      $('#videoTextSizeValue').textContent = `${$('#videoTextSize').value} px`;
      renderVideoPreviewFrame();
    });
    $('#videoOverlayScale').addEventListener('input', () => {
      $('#videoOverlayScaleValue').textContent = `${$('#videoOverlayScale').value}%`;
      renderVideoPreviewFrame();
    });
    $('#videoEffect').addEventListener('change', event => {
      if (event.currentTarget.selectedOptions[0]?.dataset.videoPremium && !hasPremiumEditorAccess()) {
        event.currentTarget.value = 'none';
        renderVideoPreviewFrame();
        return toast('Este efecto requiere Pro o Premium.');
      }
      renderVideoPreviewFrame();
    });
    $('#videoFont').addEventListener('change', event => {
      if (event.currentTarget.selectedOptions[0]?.dataset.videoPremium && !hasPremiumEditorAccess()) {
        event.currentTarget.value = 'instrument';
        renderVideoPreviewFrame();
        return toast('Esta tipografía requiere Pro o Premium.');
      }
      renderVideoPreviewFrame();
    });
    $('#videoOverlayAsset').addEventListener('change', event => {
      const sourceUrl = event.currentTarget.value;
      if (!sourceUrl) return clearVideoOverlay();
      loadVideoOverlay(sourceUrl, /\.mp4$|\.webm$/i.test(sourceUrl));
    });
    $('#chooseVideoOverlay').addEventListener('click', () => videoOverlayFile.click());
    videoOverlayFile.addEventListener('change', () => {
      const file = videoOverlayFile.files[0];
      videoOverlayFile.value = '';
      if (!file) return;
      const supportedImage = /^image\/(?:png|jpeg|webp|gif)$/i.test(file.type);
      const supportedVideo = /^video\/(?:mp4|webm)$/i.test(file.type);
      if ((!supportedImage && !supportedVideo) || file.size > 20 * 1024 * 1024) return toast('Elige PNG, JPG, WebP, GIF, MP4 o WebM de hasta 20 MB.');
      $('#videoOverlayAsset').value = '';
      const objectUrl = URL.createObjectURL(file);
      loadVideoOverlay(objectUrl, supportedVideo, objectUrl);
    });
    $('#removeVideoOverlay').addEventListener('click', () => {
      clearVideoOverlay();
      $('#videoOverlayAsset').value = '';
    });

    async function createTrimmedVideoBlob() {
      const start = Number($('#trimStart').value);
      const end = Number($('#trimEnd').value);
      if (!videoPlayer.src || end <= start || end > videoPlayer.duration) throw new Error('Revisa el inicio y final del recorte.');
      if (!videoPlayer.captureStream || !HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) {
        throw new Error('Tu navegador no admite exportar vídeo editado. Prueba Chrome o Edge.');
      }
      videoPlayer.pause();
      await new Promise((resolve, reject) => {
        const finishSeek = () => { videoPlayer.removeEventListener('seeked', finishSeek); videoPlayer.removeEventListener('error', failSeek); resolve(); };
        const failSeek = () => { videoPlayer.removeEventListener('seeked', finishSeek); videoPlayer.removeEventListener('error', failSeek); reject(new Error('No se pudo posicionar el vídeo.')); };
        videoPlayer.addEventListener('seeked', finishSeek);
        videoPlayer.addEventListener('error', failSeek);
        if (Math.abs(videoPlayer.currentTime - start) < 0.02) finishSeek(); else videoPlayer.currentTime = start;
      });

      const {width, height} = formatVideoOutputSize();
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const outputContext = outputCanvas.getContext('2d');
      const outputStream = outputCanvas.captureStream(30);
      const sourceStream = videoPlayer.captureStream();
      const {tracks: audioTracks, destination: audioDestination} = await captureVideoAudioTracks(sourceStream);
      audioTracks.forEach(track => outputStream.addTrack(track));
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(outputStream, {...(mimeType ? {mimeType} : {}), videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 96_000});
      const chunks = [];
      let animationFrame = 0;
      const recording = new Promise((resolve, reject) => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error('No se pudo procesar el vídeo editado.'));
        recorder.onstop = () => resolve(new Blob(chunks, {type: recorder.mimeType || 'video/webm'}));
      });
      try {
        recorder.start(250);
        await videoPlayer.play();
        if (videoOverlayVideo) videoOverlayVideo.play().catch(() => {});
        await new Promise((resolve, reject) => {
          const render = () => {
            outputContext.clearRect(0, 0, width, height);
            outputContext.save();
            outputContext.filter = videoEffectFilters[$('#videoEffect').value] || 'none';
            outputContext.drawImage(videoPlayer, 0, 0, width, height);
            outputContext.restore();
            drawVideoOverlays(outputContext, width, height);
            if (videoPlayer.currentTime >= end - 0.02 || videoPlayer.ended) {
              videoPlayer.pause();
              if (recorder.state !== 'inactive') recorder.stop();
              resolve();
            } else if (videoPlayer.paused) {
              if (recorder.state !== 'inactive') recorder.stop();
              reject(new Error('El vídeo se pausó durante la exportación.'));
            } else {
              animationFrame = requestAnimationFrame(render);
            }
          };
          render();
        });
        return await recording;
      } finally {
        cancelAnimationFrame(animationFrame);
        if (recorder.state !== 'inactive') recorder.stop();
        videoPlayer.pause();
        videoOverlayVideo?.pause();
        outputStream.getVideoTracks().forEach(track => track.stop());
        sourceStream.getTracks().forEach(track => track.stop());
        if (audioDestination) {
          videoAudioSource.disconnect(audioDestination);
          audioDestination.stream.getTracks().forEach(track => track.stop());
        }
        renderVideoPreviewFrame();
      }
    }

    $('#exportVideo').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Preparando…';
      try {
        const blob = await createTrimmedVideoBlob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'forma-video-editado.webm';
        link.click();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        toast('Vídeo editado exportado como WebM.');
      } catch (error) {
        toast(error.message || 'No se pudo exportar este vídeo.');
      } finally {
        button.disabled = false;
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/></svg>Exportar vídeo editado';
      }
    });
    $('#saveVideoLibrary').addEventListener('click', async event => {
      if (!canUseImageLibrary()) {
        setActiveView('plans');
        return toast('Guardar vídeos en la biblioteca requiere Pro o Premium.');
      }
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Guardando…';
      try {
        const blob = await createTrimmedVideoBlob();
        await saveTrimmedVideoToLibrary(blob);
        toast('Vídeo editado guardado en la biblioteca.');
      } catch (error) {
        console.error('No se pudo guardar el vídeo editado:', error);
        toast(error.message || 'No se pudo guardar el vídeo en la biblioteca.');
      } finally {
        button.disabled = false;
        button.textContent = 'Guardar en biblioteca';
      }
    });

