import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, authReady, db } from './firebase.js';

const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
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
      const plan = configuredPlans.find(item => item.id === activePlanId());
      return !Array.isArray(plan?.features) || plan.features.includes(feature);
    }

    function canUseImageLibrary(profile = activeUserProfile) {
      return ['pro', 'premium'].includes(activePlanId(profile));
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
        renderVideoPreviewFrame();
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
      $('#pageHead').hidden = ['home', 'agents', 'usage'].includes(view);
      $('#newProject').hidden = view === 'others';
      $('#crumbTitle').textContent = crumb; $('#eyebrowText').textContent = eyebrow; $('#pageTitle').textContent = title; $('#pageDescription').textContent = description;
      if (view === 'library') loadImageLibrary();
      if (view === 'others') loadDiscordPresence();
      window.scrollTo({top: 0, behavior: 'smooth'});
      return true;
    }
    $$('.nav button').forEach(button => button.addEventListener('click', () => setActiveView(button.dataset.view)));
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
    const chatWelcome = $('#chatWelcome');
    const FREE_TOKEN_LIMIT = 500_000;
    const chatSessionList = $('#chatSessionList');
    let activeChatUser = null;
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
    let pendingChatImages = [];
    let pendingChatAudio = null;
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

    function renderMiniAgents() {
      const list = $('#miniAgentList');
      if (!list) return;
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
        if (activeMiniAgentId && !userMiniAgents.some(agent => agent.id === activeMiniAgentId)) setActiveMiniAgent();
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

    function renderChatSessions() {
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
        await addDoc(collection(sessionRef, 'messages'), {
          role, content, model, createdAt: serverTimestamp(),
        });
        await updateDoc(sessionRef, {
          updatedAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + chatRetentionDays() * 24 * 60 * 60 * 1000)),
        });
        await loadChatSessions();
        return true;
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
        const messageData = messageDocs.length ? messageDocs.map(message => message.data()) : storedMessages;
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
          chatHistory.push({role: data.role, content: data.content});
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

    function syncChatButton() {
      const secondsLeft = Math.max(0, Math.ceil((chatNextAllowedAt - Date.now()) / 1000));
      const hasAttachments = pendingChatImages.length > 0 || Boolean(pendingChatAudio);
      chatSend.disabled = chatBusy || chatHistoryBusy || (!chatInput.value.trim() && !hasAttachments) || secondsLeft > 0;
      chatSend.title = secondsLeft ? `Disponible en ${secondsLeft} s` : 'Enviar mensaje';
      $('#chatCooldown').textContent = secondsLeft ? `Disponible en ${secondsLeft} s` : 'Se cuentan tokens de entrada y salida';
    }

    function appendInlineChatText(parent, text) {
      const tokenPattern = /(\[[^\]\n]+\]\(https:\/\/[^\s)]+\)|\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
      const appendPlain = value => value.split('\n').forEach((line, index) => {
        if (index) parent.append(document.createElement('br'));
        if (line) parent.append(document.createTextNode(line));
      });
      let position = 0;
      for (const match of text.matchAll(tokenPattern)) {
        appendPlain(text.slice(position, match.index));
        const token = match[0];
        const linkMatch = token.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
        const element = document.createElement(linkMatch ? 'a' : token.startsWith('**') ? 'strong' : token.startsWith('`') ? 'code' : 'em');
        element.className = token.startsWith('`') ? 'chat-inline-code' : '';
        if (linkMatch) {
          element.href = linkMatch[2];
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
          element.textContent = linkMatch[1];
        } else {
          element.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1);
        }
        parent.append(element);
        position = match.index + token.length;
      }
      appendPlain(text.slice(position));
    }

    function renderChatAnswer(container, text) {
      container.replaceChildren();
      const blocks = text.trim().split(/\n\s*\n/).filter(Boolean);
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
          } else if (attachment.name) {
            const label = document.createElement('span');
            label.className = 'chat-message-attachment-label';
            label.textContent = `Audio adjunto: ${attachment.name}`;
            content.append(label);
          }
        }
        article.append(content);
      }
      $('#chatMessages').append(article);
      $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
      return article;
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
      container.hidden = !pendingChatImages.length && !pendingChatAudio;
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
      if ((!typedMessage && !pendingChatImages.length && !pendingChatAudio) || chatBusy || chatHistoryBusy) return;
      if (!planHasFeature('chat')) {
        setActiveView('plans');
        return;
      }
      const model = $('#chatModel').value;
      const modelConfig = configuredModels.find(item => item.id === model) || DEFAULT_MODELS.find(item => item.id === model);
      if (pendingChatImages.length && modelConfig?.vision !== true) return toast('El modelo seleccionado no admite imágenes. Elige uno compatible.');
      if (pendingChatAudio && modelConfig?.audio !== true) return toast('El modelo seleccionado no admite audio. Elige uno compatible.');
      const images = pendingChatImages.map(attachment => attachment.dataUrl);
      const audio = pendingChatAudio ? {data: pendingChatAudio.data, format: pendingChatAudio.format} : null;
      const message = typedMessage || (audio && images.length
        ? 'Transcribe el audio adjunto y analiza también las imágenes.'
        : audio ? 'Transcribe el audio adjunto y responde a su contenido.'
          : 'Analiza y describe la imagen adjunta.');
      const secondsLeft = Math.ceil((chatNextAllowedAt - Date.now()) / 1000);
      if (secondsLeft > 0) return toast(`La API gratuita estará disponible en ${secondsLeft} s.`);
      let headers;
      try { headers = await authenticatedHeaders(); }
      catch (error) { return toast(error.message); }
      chatWelcome.hidden = true;
      chatHistory.push({role: 'user', content: message});
      appendChatMessage('user', message, false, [
        ...pendingChatImages,
        ...(pendingChatAudio ? [{name: pendingChatAudio.name}] : []),
      ]);
      pendingChatImages = [];
      pendingChatAudio = null;
      renderChatAttachments();
      const thinking = appendChatMessage('assistant', '', true);
      chatInput.value = ''; chatInput.style.height = 'auto';
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
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: chatHistory.slice(-12),
            conversationId: activeUsageConversationId,
            images,
            ...(audio ? {audio} : {}),
            ...(activeAgentInstructions ? {agentName: activeAgentName, agentInstructions: activeAgentInstructions} : {}),
            explainSteps: explainStepsEnabled,
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
        chatHistory.push({role: 'assistant', content: savedAnswer});
        if (historySaved) await saveChatEntry('assistant', savedAnswer, model);
        const content = thinking.querySelector('.chat-assistant-content');
        content.replaceChildren();
        const answerNode = document.createElement('div'); answerNode.className = 'chat-message-text'; renderChatAnswer(answerNode, savedAnswer); content.append(answerNode);
      } catch (error) {
        const content = thinking.querySelector('.chat-assistant-content'); content.replaceChildren();
        const answerNode = document.createElement('div'); answerNode.className = 'chat-message-text'; answerNode.textContent = error.message || 'No se pudo conectar con la API gratuita. Prueba otra vez más tarde.'; content.append(answerNode);
        chatHistory.pop();
      } finally {
        chatBusy = false; syncChatButton(); chatInput.focus(); loadUsagePeriod();
      }
    }

    chatForm.addEventListener('submit', event => { event.preventDefault(); sendChatMessage(chatInput.value); });
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

    authReady.then(() => onAuthStateChanged(auth, async user => {
      $('#homeSessionNote').textContent = user
        ? 'Tus conversaciones quedan guardadas en tu cuenta.'
        : 'Iniciá sesión para guardar tus conversaciones.';
      if (!user) return;
      activeChatUser = user;
      await loadModelConfiguration(user);
      await loadMiniAgents();
      loadPhotoCleanupStatus();
      loadTokenUsage();
      loadChatSessions();
      loadUsagePeriod();
    })).catch(() => {
      $('#chatTokenCount').textContent = 'Cuota no disponible';
    });

    const prompt = $('#prompt');
    prompt.addEventListener('input', () => $('#charCount').textContent = `${prompt.value.length} / 500`);
    $('#clearPrompt').addEventListener('click', () => { prompt.value = ''; prompt.dispatchEvent(new Event('input')); prompt.focus(); });
    $('#enhancePrompt').addEventListener('click', () => {
      const text = prompt.value.trim();
      if (!text) return toast('Escribe una idea para mejorarla.');
      if (!/(detalles|luz|composición|textura)/i.test(text)) {
        prompt.value = `${text}, sujeto principal claro, composición cuidada, iluminación coherente y detalles nítidos`;
      }
      prompt.dispatchEvent(new Event('input'));
    });
    $$('#styles .chip').forEach(chip => chip.addEventListener('click', () => { $$('#styles .chip').forEach(item => item.classList.toggle('selected', item === chip)); }));
    $('#randomizeImageSeed').addEventListener('click', () => {
      $('#imageSeed').value = String(Math.floor(Math.random() * 1_000_000));
    });
    let ratio = '1:1';
    $$('#ratios button').forEach(button => button.addEventListener('click', () => { ratio = button.dataset.ratio; $$('#ratios button').forEach(item => item.classList.toggle('selected', item === button)); $('#resultMeta').textContent = `Imagen generada · ${ratio}`; }));

    let generationAllowedAt = 0;
    $('#generate').addEventListener('click', () => {
      const description = prompt.value.trim();
      if (!description) { prompt.focus(); return toast('Escribe una descripción para empezar.'); }
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
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=${dimensions[0]}&height=${dimensions[1]}&seed=${seed}&safe=true`;
      const image = $('#generatedImage'); const button = $('#generate'); const empty = $('#previewEmpty');
      generationAllowedAt = Date.now() + 45000;
      button.disabled = true; $('span', button).textContent = 'Generando…';
      $('#loadingTitle').textContent = 'Creando tu imagen'; $('#loadingDetail').textContent = 'La API gratuita puede tardar un poco.';
      empty.classList.add('show'); $('#imageStatus').textContent = 'Generando imagen…';
      image.onload = () => {
        empty.classList.remove('show'); image.style.visibility = 'visible'; $('#imageStatus').textContent = 'Imagen lista'; $('#imageCaption').textContent = `${description.slice(0, 34)}${description.length > 34 ? '…' : ''}`; $('#resultMeta').textContent = `Generada · ${ratio}`; button.disabled = false; $('span', button).textContent = 'Generar imagen';
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
      image.onerror = () => { empty.classList.add('show'); $('#loadingTitle').textContent = 'No se pudo generar'; $('#loadingDetail').textContent = 'La API puede estar ocupada. Inténtalo más tarde.'; $('#imageStatus').textContent = 'Error de generación'; button.disabled = false; $('span', button).textContent = 'Intentar de nuevo'; };
      image.crossOrigin = 'anonymous';
      image.style.visibility = 'hidden'; image.src = url;
      toast('Solicitud enviada. La API gratuita limita la frecuencia.');
    });
    $('#openImage').addEventListener('click', () => window.open($('#generatedImage').src, '_blank', 'noopener'));
    $('#downloadImage').addEventListener('click', async () => {
      try { const response = await fetch($('#generatedImage').src); if (!response.ok) throw new Error(); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'forma-imagen.jpg'; link.click(); URL.revokeObjectURL(link.href); }
      catch { window.open($('#generatedImage').src, '_blank', 'noopener'); toast('Imagen abierta en otra pestaña; puedes guardarla desde allí.'); }
    });
    $$('.thumb').forEach(thumb => thumb.addEventListener('click', () => {
      $$('.thumb').forEach(item => item.classList.toggle('active', item === thumb)); $('#generatedImage').src = thumb.dataset.image; $('#imageCaption').textContent = thumb.dataset.caption; $('#resultMeta').textContent = 'Imagen de inspiración · 1:1'; $('#imageStatus').textContent = 'Vista de inspiración';
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

