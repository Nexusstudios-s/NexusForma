import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, authReady, db } from './firebase.js';

const $ = selector => document.querySelector(selector);

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function youtubeEmbedUrl(value) {
  const url = safeHttpsUrl(value);
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}&controls=0&rel=0&playsinline=1` : '';
}

function renderLoginBackground(media, mode, source) {
  if (!media) return false;
  media.replaceChildren();
  media.hidden = true;
  if (mode === 'image') {
    if (!source) return false;
    const image = document.createElement('img');
    image.alt = '';
    image.src = source;
    media.append(image);
  } else if (mode === 'video') {
    if (!source) return false;
    const embedUrl = youtubeEmbedUrl(source);
    if (embedUrl) {
      const frame = document.createElement('iframe');
      frame.src = embedUrl;
      frame.title = 'Fondo de video';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      media.append(frame);
    } else if (source.startsWith('data:video/') || /\.(?:mp4|webm)(?:$|\?)/i.test(source)) {
      const video = document.createElement('video');
      video.src = source;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      media.append(video);
      video.play().catch(() => {});
    } else return false;
  } else return;
  media.hidden = false;
  return true;
}

function applyLoginBranding(data = {}) {
  const favicon = $('#siteFavicon');
  const faviconUrl = safeHttpsUrl(data.faviconUrl || '') || (data.faviconUrl === 'assets/NXF.png' ? 'assets/NXF.png' : '');
  if (favicon && faviconUrl) favicon.href = faviconUrl;

  const visual = $('.visual');
  const visualMedia = $('#loginVisualMedia');
  const pageMedia = $('#loginPageMedia');
  if (!visual || !visualMedia || !pageMedia) return;
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
  const legacyCanDuplicate = !legacyData || !legacyPanel || !legacyPage || legacyData.length * 2 <= 700000;
  const panelMode = ['none', 'image', 'video'].includes(data.panelMode) ? data.panelMode : (legacyPanel ? legacyMode : 'none');
  const pageMode = ['none', 'image', 'video'].includes(data.pageMode) ? data.pageMode : (legacyPage ? legacyMode : 'none');
  const panelData = validData(data.panelData) || (legacyPanel ? legacyData : '');
  const pageLinkedToPanel = data.pageLinkedToPanel === true || Boolean(legacyData && legacyPanel && legacyPage && !legacyCanDuplicate && !data.pageData);
  const pageData = validData(data.pageData) || (legacyPage && legacyCanDuplicate ? legacyData : '');
  const getSource = (mode, imageUrl, videoUrl, dataUrl) => mode === 'image'
    ? (dataUrl.startsWith('data:image/') ? dataUrl : safeHttpsUrl(imageUrl || ''))
    : mode === 'video'
      ? (dataUrl.startsWith('data:video/') ? dataUrl : safeHttpsUrl(videoUrl || ''))
      : '';
  const panelSource = getSource(
    panelMode,
    data.panelUrl || (legacyPanel ? data.backgroundUrl : ''),
    data.panelVideo || (legacyPanel ? data.backgroundVideo : ''),
    panelData,
  );
  const pageSource = pageLinkedToPanel ? panelSource : getSource(
    pageMode,
    data.pageUrl || (legacyPage ? data.backgroundUrl : ''),
    data.pageVideo || (legacyPage ? data.backgroundVideo : ''),
    pageData,
  );
  const visualApplied = renderLoginBackground(visualMedia, panelMode, panelSource);
  renderLoginBackground(pageMedia, pageLinkedToPanel ? panelMode : pageMode, pageSource);
  visual.classList.toggle('has-login-background', visualApplied);
}

async function loadLoginBranding() {
  try {
    const snapshot = await getDoc(doc(db, 'appConfig', 'loginBranding'));
    if (snapshot.exists()) applyLoginBranding(snapshot.data());
  } catch (error) {
    console.warn('No se pudo cargar la personalización del login:', error);
  }
}

loadLoginBranding();

    const themeToggle = $('#loginThemeToggle');
    const theme = localStorage.getItem('nexus-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem('nexus-theme', nextTheme);
      themeToggle.setAttribute('aria-label', nextTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    });
    const feedback = (message, success = false) => { $('#feedback').textContent = message; $('#feedback').classList.toggle('success', success); };
    let mode = 'login';

    function setMode(nextMode) {
      mode = nextMode;
      const registering = mode === 'register';
      $('#title').textContent = registering ? 'Crea tu espacio creativo' : 'Qué bueno tenerte de vuelta';
      $('#intro').textContent = registering ? 'Unos datos y ya puedes empezar a crear.' : 'Inicia sesión para continuar en tu espacio creativo.';
      $('#submitButton').textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
      $('#nameField').hidden = !registering;
      $('#forgotButton').hidden = registering;
      $('#password').autocomplete = registering ? 'new-password' : 'current-password';
      $('#loginTab').classList.toggle('selected', !registering);
      $('#registerTab').classList.toggle('selected', registering);
      $('#loginTab').setAttribute('aria-selected', String(!registering));
      $('#registerTab').setAttribute('aria-selected', String(registering));
      feedback('');
    }

    function authMessage(error) {
      const messages = {
        'auth/invalid-email': 'Revisa el formato del correo electrónico.',
        'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
        'auth/user-not-found': 'No encontramos una cuenta con ese correo.',
        'auth/wrong-password': 'El correo o la contraseña no son correctos.',
        'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/too-many-requests': 'Hubo demasiados intentos. Espera un momento y vuelve a probar.',
        'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
        'auth/popup-blocked': 'El navegador bloqueó Google. Permite ventanas emergentes y vuelve a intentarlo.',
        'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
        'auth/operation-not-allowed': 'Habilita este método de acceso en Firebase Authentication.'
      };
      return messages[error.code] || 'No se pudo completar el acceso. Inténtalo de nuevo.';
    }

    $('#loginTab').addEventListener('click', () => setMode('login'));
    $('#registerTab').addEventListener('click', () => setMode('register'));
    $('#togglePassword').addEventListener('click', event => {
      const input = $('#password'); const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password'; event.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar';
    });

    $('#authForm').addEventListener('submit', async event => {
      event.preventDefault();
      const email = $('#email').value.trim(); const password = $('#password').value;
      if (!email || !password) return feedback('Completa tu correo y contraseña.');
      const button = $('#submitButton'); button.disabled = true; button.textContent = mode === 'register' ? 'Creando cuenta…' : 'Entrando…';
      feedback('');
      try {
        if (mode === 'register') {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          const displayName = $('#displayName').value.trim();
          if (displayName) await updateProfile(credential.user, {displayName});
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
        location.replace('index.html');
      } catch (error) {
        feedback(authMessage(error));
      } finally {
        button.disabled = false; button.textContent = mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
      }
    });

    $('#googleButton').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true; feedback('Conectando con Google…', true);
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        location.replace('index.html');
      } catch (error) {
        feedback(authMessage(error));
      } finally {
        button.disabled = false;
      }
    });

    $('#forgotButton').addEventListener('click', async () => {
      const email = $('#email').value.trim();
      if (!email) return feedback('Escribe tu correo y vuelve a pulsar este botón.');
      try {
        await sendPasswordResetEmail(auth, email);
        feedback('Te enviamos un enlace para restablecer tu contraseña.', true);
      } catch (error) {
        feedback(authMessage(error));
      }
    });

    authReady.then(() => onAuthStateChanged(auth, user => {
      if (user) location.replace('index.html');
      else $('#loading').hidden = true;
    })).catch(() => {
      $('#loading').hidden = true;
      feedback('No se pudo conectar con Firebase. Comprueba tu conexión e inténtalo otra vez.');
    });
