// Explorar · mapa mundial funcional.
// Leaflet + Esri (mapas a color) + OpenStreetMap (búsqueda) + Open-Meteo (clima) + REST Countries (datos de país).
// Todo sin claves de API. Se inicia solo cuando abres la pestaña Explorar.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const COUNTRIES_GEOJSON = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';

const CC = {Colombia:'CO','México':'MX','Estados Unidos':'US','Canadá':'CA',Cuba:'CU','Panamá':'PA',Venezuela:'VE',Ecuador:'EC','Perú':'PE',Chile:'CL',Argentina:'AR',Brasil:'BR',Islandia:'IS','Reino Unido':'GB',Francia:'FR','España':'ES',Portugal:'PT',Italia:'IT',Alemania:'DE','Países Bajos':'NL',Suecia:'SE',Grecia:'GR','Turquía':'TR',Rusia:'RU',Marruecos:'MA',Egipto:'EG',Nigeria:'NG',Kenia:'KE','Sudáfrica':'ZA','Emiratos Árabes':'AE','Arabia Saudita':'SA',India:'IN',Tailandia:'TH','Singapur':'SG',Indonesia:'ID',Filipinas:'PH',China:'CN','Corea del Sur':'KR','Japón':'JP',Australia:'AU','Nueva Zelanda':'NZ'};
// [nombre, país, lat, lon, zona horaria]
const CITIES = [
  ['Medellín','Colombia',6.2442,-75.5812,'America/Bogota'],['Bogotá','Colombia',4.711,-74.0721,'America/Bogota'],
  ['Ciudad de México','México',19.4326,-99.1332,'America/Mexico_City'],['Nueva York','Estados Unidos',40.7128,-74.006,'America/New_York'],
  ['Los Ángeles','Estados Unidos',34.0522,-118.2437,'America/Los_Angeles'],['Chicago','Estados Unidos',41.8781,-87.6298,'America/Chicago'],
  ['Miami','Estados Unidos',25.7617,-80.1918,'America/New_York'],['San Francisco','Estados Unidos',37.7749,-122.4194,'America/Los_Angeles'],
  ['Honolulu','Estados Unidos',21.3099,-157.8581,'Pacific/Honolulu'],['Toronto','Canadá',43.6532,-79.3832,'America/Toronto'],
  ['La Habana','Cuba',23.1136,-82.3666,'America/Havana'],['Panamá','Panamá',8.9824,-79.5199,'America/Panama'],
  ['Caracas','Venezuela',10.4806,-66.9036,'America/Caracas'],['Quito','Ecuador',-0.1807,-78.4678,'America/Guayaquil'],
  ['Lima','Perú',-12.0464,-77.0428,'America/Lima'],['Santiago','Chile',-33.4489,-70.6693,'America/Santiago'],
  ['Buenos Aires','Argentina',-34.6037,-58.3816,'America/Argentina/Buenos_Aires'],['São Paulo','Brasil',-23.5505,-46.6333,'America/Sao_Paulo'],
  ['Río de Janeiro','Brasil',-22.9068,-43.1729,'America/Sao_Paulo'],['Reikiavik','Islandia',64.1466,-21.9426,'Atlantic/Reykjavik'],
  ['Londres','Reino Unido',51.5074,-0.1278,'Europe/London'],['París','Francia',48.8566,2.3522,'Europe/Paris'],
  ['Madrid','España',40.4168,-3.7038,'Europe/Madrid'],['Barcelona','España',41.3874,2.1686,'Europe/Madrid'],
  ['Lisboa','Portugal',38.7223,-9.1393,'Europe/Lisbon'],['Roma','Italia',41.9028,12.4964,'Europe/Rome'],
  ['Berlín','Alemania',52.52,13.405,'Europe/Berlin'],['Ámsterdam','Países Bajos',52.3676,4.9041,'Europe/Amsterdam'],
  ['Estocolmo','Suecia',59.3293,18.0686,'Europe/Stockholm'],['Atenas','Grecia',37.9838,23.7275,'Europe/Athens'],
  ['Estambul','Turquía',41.0082,28.9784,'Europe/Istanbul'],['Moscú','Rusia',55.7558,37.6173,'Europe/Moscow'],
  ['Casablanca','Marruecos',33.5731,-7.5898,'Africa/Casablanca'],['El Cairo','Egipto',30.0444,31.2357,'Africa/Cairo'],
  ['Lagos','Nigeria',6.5244,3.3792,'Africa/Lagos'],['Nairobi','Kenia',-1.2921,36.8219,'Africa/Nairobi'],
  ['Ciudad del Cabo','Sudáfrica',-33.9249,18.4241,'Africa/Johannesburg'],['Dubái','Emiratos Árabes',25.2048,55.2708,'Asia/Dubai'],
  ['Riad','Arabia Saudita',24.7136,46.6753,'Asia/Riyadh'],['Mumbai','India',19.076,72.8777,'Asia/Kolkata'],
  ['Nueva Delhi','India',28.6139,77.209,'Asia/Kolkata'],['Bangkok','Tailandia',13.7563,100.5018,'Asia/Bangkok'],
  ['Singapur','Singapur',1.3521,103.8198,'Asia/Singapore'],['Yakarta','Indonesia',-6.2088,106.8456,'Asia/Jakarta'],
  ['Manila','Filipinas',14.5995,120.9842,'Asia/Manila'],['Hong Kong','China',22.3193,114.1694,'Asia/Hong_Kong'],
  ['Shanghái','China',31.2304,121.4737,'Asia/Shanghai'],['Pekín','China',39.9042,116.4074,'Asia/Shanghai'],
  ['Seúl','Corea del Sur',37.5665,126.978,'Asia/Seoul'],['Tokio','Japón',35.6762,139.6503,'Asia/Tokyo'],
  ['Osaka','Japón',34.6937,135.5023,'Asia/Tokyo'],['Sídney','Australia',-33.8688,151.2093,'Australia/Sydney'],
  ['Melbourne','Australia',-37.8136,144.9631,'Australia/Melbourne'],['Auckland','Nueva Zelanda',-36.8485,174.7633,'Pacific/Auckland']
].map(([name, country, lat, lon, tz]) => ({name, country, lat, lon, tz, cc: CC[country], kind: 'ciudad'}));
const FEATURED = ['Medellín','Tokio','París','Nueva York','Dubái','Sídney','El Cairo','Río de Janeiro','Reikiavik','Singapur'];

// Mapas base (todos a color y sin API key)
const BASES = {
  streets: {label: 'Calles', hint: 'Colorido y claro', swatch: 'linear-gradient(135deg,#a8d8a0,#f6e7b0,#9ccfe8)'},
  topo:    {label: 'Topográfico', hint: 'Relieve y vegetación', swatch: 'linear-gradient(135deg,#cfe3b0,#e6cf9c,#a9d1e6)'},
  natgeo:  {label: 'Atlas', hint: 'Estilo National Geographic', swatch: 'linear-gradient(135deg,#d9d3a3,#b9cf9a,#8fbfd1)'},
  sat:     {label: 'Satélite', hint: 'Fotos reales', swatch: 'linear-gradient(135deg,#1e4b2e,#55703c,#1a3b63)'},
  night:   {label: 'Nocturno', hint: 'Oscuro con color', swatch: 'linear-gradient(135deg,#14213d,#2b3a67,#0f5c5c)'},
  relief:  {label: 'Relieve', hint: 'Curvas de nivel', swatch: 'linear-gradient(135deg,#b7d3a3,#d6b98c,#e9e4d4)'}
};
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const ICONS = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  city: '<svg viewBox="0 0 24 24"><path d="M4 21V9l6-3v15M10 21V4l10 4v13M3 21h18M13 11h4M13 15h4"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>'
};
const WEATHER = {
  0:['☀️','Despejado'],1:['🌤️','Mayormente despejado'],2:['⛅','Parcialmente nublado'],3:['☁️','Nublado'],45:['🌫️','Niebla'],48:['🌫️','Niebla con escarcha'],
  51:['🌦️','Llovizna ligera'],53:['🌦️','Llovizna'],55:['🌧️','Llovizna intensa'],61:['🌧️','Lluvia ligera'],63:['🌧️','Lluvia'],65:['🌧️','Lluvia fuerte'],
  66:['🌧️','Lluvia helada'],67:['🌧️','Lluvia helada fuerte'],71:['🌨️','Nieve ligera'],73:['🌨️','Nieve'],75:['❄️','Nieve fuerte'],77:['🌨️','Granizo fino'],
  80:['🌦️','Chubascos'],81:['🌧️','Chubascos fuertes'],82:['⛈️','Chubascos violentos'],85:['🌨️','Chubascos de nieve'],86:['❄️','Nevadas fuertes'],
  95:['⛈️','Tormenta'],96:['⛈️','Tormenta con granizo'],99:['⛈️','Tormenta fuerte con granizo']
};
const SAVED_KEY = 'nexus-explore-saved', BASE_KEY = 'nexus-explore-base';

let L, map, started = false, stage;
let baseMode = 'streets', baseLayer = null, labelsLayer = null;
const overlays = {countries: null, daynight: null, radar: null};
let selectedMarker = null, pointMarker = null; const cityMarkers = new Map();
let clockTimer = null, nightTimer = null, current = null, saved = [];
let weatherToken = 0, countryToken = 0, searchToken = 0, searchTimer = null;
let measuring = false, measurePts = [], measureLine = null, measureDots = [];
const countryCache = new Map(); let countriesGeo = null;

// ---------- utilidades ----------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 2600);
}
const fmt = new Intl.NumberFormat('es');
const fmtCompact = new Intl.NumberFormat('es', {notation: 'compact', maximumFractionDigits: 1});
function storageGet(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function storageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } }
function formatTime(tz) {
  try { return new Intl.DateTimeFormat('es', {timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date()); }
  catch { return '—'; }
}
function offsetMin(tz) {
  try {
    const part = new Intl.DateTimeFormat('en', {timeZone: tz, timeZoneName: 'longOffset'}).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || 'GMT';
    const m = part.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + (+m[3] || 0)) : 0;
  } catch { return null; }
}
function diffText(tz) {
  const a = offsetMin(tz); if (a == null) return '—';
  const d = a - (-new Date().getTimezoneOffset());
  if (!d) return 'Misma hora que tú';
  const h = Math.floor(Math.abs(d) / 60), m = Math.abs(d) % 60;
  return `${d > 0 ? '+' : '−'}${h} h${m ? ` ${m} min` : ''} que tú`;
}
const coordsText = (lat, lon) => `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'O'}`;
const hhmm = iso => (iso || '').split('T')[1]?.slice(0, 5) || '—';
function uvLabel(v) { return v < 3 ? 'Bajo' : v < 6 ? 'Moderado' : v < 8 ? 'Alto' : v < 11 ? 'Muy alto' : 'Extremo'; }

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!$('link[data-leaflet]')) {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; css.dataset.leaflet = '';
      document.head.append(css);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS; script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('No se pudo cargar el motor del mapa.'));
    document.head.append(script);
  });
}

// ---------- mapas base ----------
function applyBase() {
  if (baseLayer) map.removeLayer(baseLayer);
  if (labelsLayer) { map.removeLayer(labelsLayer); labelsLayer = null; }
  const esri = (path, o = {}) => L.tileLayer(`${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`, {maxZoom: 17, maxNativeZoom: 17, attribution: 'Mapa © Esri y colaboradores', ...o});
  if (baseMode === 'sat') {
    baseLayer = esri('World_Imagery', {attribution: 'Imágenes © Esri'});
    labelsLayer = esri('Reference/World_Boundaries_and_Places', {pane: 'shadowPane'});
  } else if (baseMode === 'topo') baseLayer = esri('World_Topo_Map');
  else if (baseMode === 'natgeo') baseLayer = esri('NatGeo_World_Map', {maxNativeZoom: 16});
  else if (baseMode === 'relief') baseLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {subdomains: 'abc', maxZoom: 17, maxNativeZoom: 17, attribution: '© OpenStreetMap · © OpenTopoMap'});
  else baseLayer = esri('World_Street_Map'); // streets y night usan los mismos mosaicos; night se oscurece por CSS
  baseLayer.addTo(map); baseLayer.bringToBack();
  if (labelsLayer) labelsLayer.addTo(map);
  stage.dataset.base = baseMode;
  $$('.explore-base').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.base === baseMode)));
}
function setBase(mode) {
  if (!BASES[mode]) return;
  baseMode = mode; storageSet(BASE_KEY, mode); applyBase();
}

// ---------- capas opcionales ----------
function nightPoints(date) {
  const rad = Math.PI / 180, n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const g = ((357.529 + 0.98560028 * n) % 360) * rad, q = (280.459 + 0.98564736 * n) % 360;
  const lam = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, eps = (23.439 - 0.00000036 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const gmst = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
  const subLon = (((ra / rad - gmst * 15) + 540) % 360) - 180;
  const tanDec = Math.tan(dec) || 1e-6, pts = [];
  for (let lon = -540; lon <= 540; lon += 3) pts.push([Math.atan(-Math.cos((lon - subLon) * rad) / tanDec) / rad, lon]);
  const pole = dec > 0 ? -90 : 90;
  pts.push([pole, 540], [pole, -540]);
  return pts;
}
function updateNight() { overlays.daynight?.setLatLngs(nightPoints(new Date())); }

async function ensureCountriesGeo() {
  if (countriesGeo) return countriesGeo;
  const res = await fetch(COUNTRIES_GEOJSON);
  if (!res.ok) throw new Error('geo');
  countriesGeo = await res.json();
  return countriesGeo;
}
const hue = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

async function setOverlay(name, on) {
  const input = $(`[data-overlay="${name}"]`);
  try {
    if (!on) {
      if (overlays[name]) { map.removeLayer(overlays[name]); overlays[name] = null; }
      if (name === 'daynight') clearInterval(nightTimer);
      return;
    }
    if (name === 'daynight') {
      overlays.daynight = L.polygon(nightPoints(new Date()), {stroke: false, fillColor: '#060b2e', fillOpacity: .42, interactive: false}).addTo(map);
      clearInterval(nightTimer); nightTimer = setInterval(updateNight, 60000);
    } else if (name === 'radar') {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) throw new Error('radar');
      const data = await res.json();
      const frame = data.radar?.past?.at(-1);
      if (!frame) throw new Error('radar');
      overlays.radar = L.tileLayer(`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {opacity: .7, maxNativeZoom: 7, maxZoom: 17, attribution: 'Radar © RainViewer'}).addTo(map);
    } else if (name === 'countries') {
      const geo = await ensureCountriesGeo();
      overlays.countries = L.geoJSON(geo, {
        bubblingMouseEvents: false,
        style: f => ({color: '#ffffff', weight: .8, opacity: .6, fillColor: `hsl(${hue(f.id || f.properties.name)} 72% 55%)`, fillOpacity: .3}),
        onEachFeature: (f, layer) => {
          layer.bindTooltip(f.properties.name, {sticky: true, direction: 'top', className: 'xp-tip'});
          layer.on({
            mouseover: () => layer.setStyle({fillOpacity: .55, weight: 1.8}),
            mouseout: () => overlays.countries?.resetStyle(layer),
            click: e => {
              if (measuring) return addMeasurePoint(e.latlng);
              selectPlace({name: f.properties.name, country: '', lat: e.latlng.lat, lon: e.latlng.lng, kind: 'país', cc: f.id}, {fit: layer.getBounds(), tab: 'country'});
            }
          });
        }
      }).addTo(map);
      overlays.countries.bringToBack(); baseLayer?.bringToBack();
    }
  } catch {
    if (input) input.checked = false;
    overlays[name] = null;
    toast(name === 'radar' ? 'El radar de lluvia no está disponible ahora.' : 'No se pudo cargar esa capa. Revisa tu conexión.');
  }
}

// ---------- pines ----------
function pinIcon(label, extra = '') {
  const wrap = el('div', `xp-pin ${extra}`.trim());
  wrap.append(el('i'), el('span', null, label));
  return L.divIcon({html: wrap, className: 'xp-pin-wrap', iconSize: [0, 0]});
}
function addCityMarkers() {
  CITIES.forEach(city => {
    const m = L.marker([city.lat, city.lon], {icon: pinIcon(city.name), keyboard: true, title: city.name}).addTo(map);
    m.on('click', e => { L.DomEvent.stopPropagation(e); if (measuring) return addMeasurePoint(m.getLatLng()); selectPlace({...city}, {zoom: 10}); });
    cityMarkers.set(city.name, m);
  });
}
function clearSelectedPins() {
  cityMarkers.forEach(m => m.getElement()?.querySelector('.xp-pin')?.classList.remove('is-selected'));
  if (pointMarker) { map.removeLayer(pointMarker); pointMarker = null; }
}
function markSelected(place) {
  clearSelectedPins();
  const known = CITIES.find(c => c.name === place.name && Math.abs(c.lat - place.lat) < 0.01);
  if (known) cityMarkers.get(known.name)?.getElement()?.querySelector('.xp-pin')?.classList.add('is-selected');
  else pointMarker = L.marker([place.lat, place.lon], {icon: pinIcon(place.name, 'is-point is-selected'), zIndexOffset: 900, interactive: false}).addTo(map);
}

// ---------- ficha del lugar ----------
function setTab(tab) {
  $$('.explore-tabs button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('selected', on); b.setAttribute('aria-selected', String(on)); });
  $$('.explore-tabpanel').forEach(p => { p.hidden = p.dataset.panel !== tab; });
}
const samePlace = (a, b) => a && b && a.name === b.name && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
function isSaved(place) { return saved.some(s => samePlace(s, place)); }
function refreshSaveButton() {
  const btn = $('#exploreSave'); if (!btn || !current) return;
  const on = isSaved(current);
  btn.classList.toggle('is-on', on);
  btn.querySelector('span').textContent = on ? 'Guardado' : 'Guardar';
  btn.setAttribute('aria-pressed', String(on));
}
function renderCard(place) {
  $('#exploreCard').hidden = false;
  $('#exploreCardKind').textContent = place.kind || 'lugar';
  $('#exploreCardTitle').textContent = place.name;
  $('#exploreCardSub').textContent = place.country || '';
  const dash = '…';
  ['Time','Diff','Sunrise','Sunset','Uv','Wind','Elev'].forEach(k => { $(`#exploreFact${k}`).textContent = dash; });
  $('#exploreFactTime').textContent = place.tz ? formatTime(place.tz) : dash;
  $('#exploreFactDiff').textContent = place.tz ? diffText(place.tz) : dash;
  $('#exploreFactCoords').textContent = coordsText(place.lat, place.lon);
  const w = $('#exploreWeather'); w.className = 'explore-weather is-loading'; w.textContent = 'Consultando el clima…';
  $('#exploreForecast').replaceChildren();
  $('#exploreMaps').href = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
  $('#exploreRoute').href = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
  refreshSaveButton();
}

async function loadWeather(place) {
  const token = ++weatherToken, weather = $('#exploreWeather');
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}`
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max'
      + '&timezone=auto&forecast_days=5';
    const res = await fetch(url);
    if (!res.ok) throw new Error('clima');
    const data = await res.json();
    if (token !== weatherToken) return;
    const c = data.current, d = data.daily;
    place.tz = place.tz || data.timezone;
    const [icon, label] = WEATHER[c.weather_code] || ['🌡️', 'Condiciones actuales'];
    weather.className = 'explore-weather'; weather.replaceChildren();
    const box = el('div'); box.append(el('strong', null, `${Math.round(c.temperature_2m)}°C`), el('small', null, `${label} · sensación ${Math.round(c.apparent_temperature)}°`));
    weather.append(el('span', 'explore-weather-icon', icon), box);
    $('#exploreFactTime').textContent = formatTime(place.tz);
    $('#exploreFactDiff').textContent = diffText(place.tz);
    $('#exploreFactSunrise').textContent = hhmm(d.sunrise[0]);
    $('#exploreFactSunset').textContent = hhmm(d.sunset[0]);
    const uv = d.uv_index_max[0];
    $('#exploreFactUv').textContent = uv == null ? '—' : `${uv.toFixed(1)} · ${uvLabel(uv)}`;
    $('#exploreFactWind').textContent = `${Math.round(c.wind_speed_10m)} km/h · ${c.relative_humidity_2m}%`;
    $('#exploreFactElev').textContent = data.elevation != null ? `${fmt.format(Math.round(data.elevation))} m` : '—';
    const list = $('#exploreForecast'); list.replaceChildren();
    d.time.forEach((day, i) => {
      const li = el('li', 'explore-forecast-row');
      const name = new Intl.DateTimeFormat('es', {weekday: 'long', timeZone: 'UTC'}).format(new Date(`${day}T12:00:00Z`));
      const [ic, lb] = WEATHER[d.weather_code[i]] || ['🌡️', ''];
      const mid = el('div'); mid.append(el('strong', null, i === 0 ? 'Hoy' : name), el('small', null, `${lb} · ${d.precipitation_probability_max[i] ?? 0}% lluvia`));
      li.append(el('span', 'explore-forecast-icon', ic), mid, el('b', null, `${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°`));
      list.append(li);
    });
  } catch {
    if (token !== weatherToken) return;
    weather.className = 'explore-weather is-loading'; weather.textContent = 'No se pudo cargar el clima ahora mismo.';
  }
}

async function getCountry(code) {
  const key = String(code).toUpperCase();
  if (countryCache.has(key)) return countryCache.get(key);
  const res = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(key)}?fields=name,translations,capital,population,area,languages,currencies,flag,idd,car`);
  if (!res.ok) throw new Error('pais');
  const raw = await res.json();
  const data = Array.isArray(raw) ? raw[0] : raw;
  countryCache.set(key, data);
  return data;
}
async function loadCountry(place) {
  const token = ++countryToken, box = $('#exploreCountry');
  if (!place.cc) { box.textContent = 'Este punto no pertenece a un país (mar o zona remota). Toca una ciudad o activa la capa «Países de colores».'; return; }
  box.textContent = 'Cargando datos del país…';
  try {
    const c = await getCountry(place.cc);
    if (token !== countryToken) return;
    const nameEs = c.translations?.spa?.common || c.name?.common || place.name;
    if (place.kind === 'país') { place.name = nameEs; $('#exploreCardTitle').textContent = nameEs; }
    const rows = [
      ['Capital', (c.capital || []).join(', ') || '—'],
      ['Población', c.population ? fmt.format(c.population) : '—'],
      ['Superficie', c.area ? `${fmt.format(Math.round(c.area))} km²` : '—'],
      ['Idiomas', Object.values(c.languages || {}).join(', ') || '—'],
      ['Moneda', Object.values(c.currencies || {}).map(m => `${m.name}${m.symbol ? ` (${m.symbol})` : ''}`).join(', ') || '—'],
      ['Prefijo telefónico', c.idd?.root ? `${c.idd.root}${(c.idd.suffixes || []).length === 1 ? c.idd.suffixes[0] : ''}` : '—'],
      ['Se conduce por la', c.car?.side === 'left' ? 'izquierda' : c.car?.side === 'right' ? 'derecha' : '—']
    ];
    box.replaceChildren();
    const head = el('div', 'explore-country-head'); head.append(el('span', 'explore-flag', c.flag || '🌍'), el('strong', null, nameEs));
    const dl = el('dl', 'explore-kv');
    rows.forEach(([k, v]) => { const r = el('div'); r.append(el('dt', null, k), el('dd', null, v)); dl.append(r); });
    box.append(head, dl);
  } catch {
    if (token === countryToken) box.textContent = 'No se pudieron cargar los datos del país.';
  }
}

function selectPlace(place, {zoom = 10, fit = null, tab = null} = {}) {
  current = place;
  $('#exploreResults').replaceChildren();
  markSelected(place); renderCard(place); loadWeather(place); loadCountry(place);
  if (tab) setTab(tab);
  clearInterval(clockTimer);
  clockTimer = setInterval(() => { if (current?.tz) { $('#exploreFactTime').textContent = formatTime(current.tz); } }, 20000);
  if (fit) map.flyToBounds(fit, {duration: 1.6, maxZoom: 6, paddingTopLeft: [window.innerWidth > 760 ? 390 : 20, 20]});
  else map.flyTo([place.lat, place.lon], zoom, {duration: 1.6});
  $$('.explore-chip').forEach(c => c.classList.toggle('selected', c.dataset.name === place.name));
}

// ---------- guardados ----------
function renderChips(mode = chipMode) {
  chipMode = mode;
  $$('.explore-chip-tab').forEach(b => b.classList.toggle('selected', b.dataset.chips === mode));
  const box = $('#exploreChips'); box.replaceChildren();
  const list = mode === 'saved' ? saved : FEATURED.map(n => CITIES.find(c => c.name === n));
  if (!list.length) { box.append(el('span', 'explore-status', 'Aún no guardas lugares. Toca «Guardar» en una ficha.')); return; }
  list.forEach(p => {
    const b = el('button', 'explore-chip', p.name); b.type = 'button'; b.dataset.name = p.name;
    b.classList.toggle('selected', current?.name === p.name);
    b.addEventListener('click', () => selectPlace({...p}, {zoom: 10}));
    box.append(b);
  });
}
let chipMode = 'featured';
function toggleSave() {
  if (!current || current.name === 'Cargando lugar…') return;
  if (isSaved(current)) { saved = saved.filter(s => !samePlace(s, current)); toast('Lugar quitado de guardados.'); }
  else {
    const {name, country, lat, lon, tz, cc, kind} = current;
    saved = [{name, country, lat, lon, tz, cc, kind}, ...saved].slice(0, 30); toast('Lugar guardado.');
  }
  storageSet(SAVED_KEY, saved); refreshSaveButton();
  $('#exploreSavedCount').textContent = saved.length || '';
  if (chipMode === 'saved') renderChips('saved');
}

// ---------- medir distancias ----------
function haversine(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
function updateMeasureText() {
  let km = 0; for (let i = 1; i < measurePts.length; i++) km += haversine(measurePts[i - 1], measurePts[i]);
  const text = $('#exploreMeasureText');
  if (measurePts.length < 2) { text.textContent = measurePts.length ? 'Toca otro punto para medir' : 'Toca el mapa para empezar a medir'; return; }
  const mins = Math.round(km / 850 * 60 + 25), flight = km > 150 ? ` · ✈️ ~${Math.floor(mins / 60)} h ${mins % 60} min` : '';
  text.textContent = `${fmt.format(Math.round(km))} km · ${fmt.format(Math.round(km * 0.621371))} mi${flight}`;
}
function addMeasurePoint(latlng) {
  measurePts.push(L.latLng(latlng.lat, latlng.lng));
  measureDots.push(L.circleMarker(latlng, {radius: 5, color: '#fff', weight: 2, fillColor: '#ff9d66', fillOpacity: 1, interactive: false}).addTo(map));
  if (measureLine) measureLine.setLatLngs(measurePts);
  else measureLine = L.polyline(measurePts, {color: '#ff9d66', weight: 3, dashArray: '8 7', interactive: false}).addTo(map);
  updateMeasureText();
}
function clearMeasure() {
  measurePts = []; measureDots.forEach(d => map.removeLayer(d)); measureDots = [];
  if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
  updateMeasureText();
}
function setMeasuring(on) {
  measuring = on;
  stage.classList.toggle('is-measuring', on);
  $('#exploreMeasure').hidden = !on;
  $('#exploreMeasureBtn').classList.toggle('is-on', on);
  $('#exploreMap').style.cursor = on ? 'crosshair' : '';
  if (!on) clearMeasure(); else updateMeasureText();
}

// ---------- búsqueda ----------
function resultButton(title, sub, icon, onPick) {
  const b = el('button', 'explore-result'); b.type = 'button';
  const ic = el('span'); ic.innerHTML = icon; // iconos estáticos propios
  const box = el('span'); box.append(el('strong', null, title), el('small', null, sub));
  b.append(ic, box); b.addEventListener('click', onPick); return b;
}
function renderResults(local, remote, message = '') {
  const box = $('#exploreResults'); box.replaceChildren();
  local.forEach(c => box.append(resultButton(c.name, c.country, ICONS.city, () => selectPlace({...c}, {zoom: 10}))));
  remote.forEach(r => box.append(resultButton(r.name, r.sub, ICONS.pin, () => selectPlace(r.place, {fit: r.bounds, zoom: 11}))));
  if (message) box.append(el('div', 'explore-status', message));
}
async function searchRemote(q, token) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=es&q=${encodeURIComponent(q)}`, {headers: {Accept: 'application/json'}});
  if (!res.ok) throw new Error('search');
  const rows = await res.json();
  if (token !== searchToken) return null;
  return rows.map(r => {
    const a = r.address || {}, name = r.name || a.city || a.town || a.village || r.display_name.split(',')[0];
    const region = [a.state || a.region, a.country].filter(Boolean).join(', ');
    const bb = r.boundingbox ? [[+r.boundingbox[0], +r.boundingbox[2]], [+r.boundingbox[1], +r.boundingbox[3]]] : null;
    return {name, sub: region || r.display_name, bounds: bb, place: {name, country: region, lat: +r.lat, lon: +r.lon, kind: (r.type || 'lugar').replace(/_/g, ' '), cc: a.country_code?.toUpperCase()}};
  });
}
function onSearchInput() {
  const q = $('#exploreSearch').value;
  $('#exploreClear').hidden = !q;
  clearTimeout(searchTimer);
  if (q.trim().length < 2) { $('#exploreResults').replaceChildren(); return; }
  const coords = q.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (coords && Math.abs(+coords[1]) <= 90 && Math.abs(+coords[2]) <= 180) {
    const box = $('#exploreResults'); box.replaceChildren();
    box.append(resultButton(`Ir a ${coords[1]}, ${coords[2]}`, 'Coordenadas', ICONS.pin, () => pickPoint(+coords[1], +coords[2])));
    return;
  }
  const n = norm(q), local = CITIES.filter(c => norm(c.name).includes(n) || norm(c.country).includes(n)).slice(0, 4);
  renderResults(local, [], 'Buscando en todo el mundo…');
  const token = ++searchToken;
  searchTimer = setTimeout(async () => {
    try {
      const remote = await searchRemote(q.trim(), token);
      if (!remote) return;
      const extra = remote.filter(r => !local.some(c => norm(c.name) === norm(r.name))).slice(0, 5);
      renderResults(local, extra, !local.length && !extra.length ? 'Sin resultados. Prueba con otro nombre.' : '');
    } catch { if (token === searchToken) renderResults(local, [], local.length ? '' : 'No se pudo buscar ahora. Revisa tu conexión.'); }
  }, 420);
}

async function reverse(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=es&lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('reverse');
  const r = await res.json(), a = r.address || {};
  if (r.error) throw new Error('mar');
  const name = a.city || a.town || a.village || a.municipality || a.county || a.state || r.name || 'Punto en el mapa';
  return {name, country: [a.state, a.country].filter(Boolean).join(', '), lat, lon, kind: 'punto del mapa', cc: a.country_code?.toUpperCase()};
}
async function pickPoint(lat, lon) {
  const wrapped = ((lon + 540) % 360) - 180;
  selectPlace({name: 'Cargando lugar…', country: '', lat, lon: wrapped, kind: 'punto del mapa'}, {zoom: Math.max(map.getZoom(), 6)});
  const mine = current;
  try {
    const place = await reverse(lat, wrapped);
    if (current === mine) { current = place; markSelected(place); renderCard(place); loadWeather(place); loadCountry(place); }
  } catch {
    if (current === mine) { current.name = 'Punto en el mapa'; current.country = 'Sin población cercana'; $('#exploreCardTitle').textContent = current.name; $('#exploreCardSub').textContent = current.country; loadCountry(current); }
  }
}
function locateMe() {
  const btn = $('#exploreLocate');
  if (!navigator.geolocation) return toast('Tu navegador no permite geolocalización.');
  btn.classList.add('is-busy');
  navigator.geolocation.getCurrentPosition(
    pos => { btn.classList.remove('is-busy'); pickPoint(pos.coords.latitude, pos.coords.longitude); },
    () => { btn.classList.remove('is-busy'); toast('No pudimos obtener tu ubicación. Revisa los permisos.'); },
    {timeout: 10000}
  );
}

// ---------- interfaz ----------
function buildMenu() {
  const wrap = $('#exploreBases'); wrap.replaceChildren();
  Object.entries(BASES).forEach(([key, b]) => {
    const btn = el('button', 'explore-base'); btn.type = 'button'; btn.dataset.base = key;
    const sw = el('i'); sw.style.background = b.swatch;
    const copy = el('span'); copy.append(el('strong', null, b.label), el('small', null, b.hint));
    btn.append(sw, copy); btn.addEventListener('click', () => setBase(key)); wrap.append(btn);
  });
}
function bindUi() {
  buildMenu();
  const search = $('#exploreSearch');
  search.addEventListener('input', onSearchInput);
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); $('#exploreResults .explore-result')?.click(); }
    if (e.key === 'Escape') $('#exploreClear').click();
  });
  $('#exploreClear').addEventListener('click', () => { search.value = ''; $('#exploreClear').hidden = true; $('#exploreResults').replaceChildren(); });
  $('#exploreZoomIn').addEventListener('click', () => map.zoomIn());
  $('#exploreZoomOut').addEventListener('click', () => map.zoomOut());
  $('#exploreLocate').addEventListener('click', locateMe);
  $('#exploreRandom').addEventListener('click', () => {
    const pool = CITIES.filter(c => c.name !== current?.name);
    selectPlace({...pool[Math.floor(Math.random() * pool.length)]}, {zoom: 9});
  });
  $('#exploreMeasureBtn').addEventListener('click', () => setMeasuring(!measuring));
  $('#exploreMeasureClear').addEventListener('click', clearMeasure);
  $('#exploreMeasureDone').addEventListener('click', () => setMeasuring(false));
  const fsBtn = $('#exploreFullscreen');
  if (document.fullscreenEnabled) {
    fsBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen?.(); });
    document.addEventListener('fullscreenchange', () => setTimeout(() => map.invalidateSize(), 120));
  } else fsBtn.hidden = true;
  // menú de capas
  const menuBtn = $('#exploreLayersBtn'), menu = $('#exploreLayersMenu');
  const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; menuBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
  menu.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', closeMenu);
  $$('[data-overlay]').forEach(i => i.addEventListener('change', () => setOverlay(i.dataset.overlay, i.checked)));
  // ficha
  $$('.explore-tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#exploreCardClose').addEventListener('click', () => { $('#exploreCard').hidden = true; current = null; clearInterval(clockTimer); clearSelectedPins(); $$('.explore-chip').forEach(c => c.classList.remove('selected')); });
  $('#exploreZoomTo').addEventListener('click', () => current && map.flyTo([current.lat, current.lon], 13, {duration: 1.4}));
  $('#exploreSave').addEventListener('click', toggleSave);
  $('#exploreCopy').addEventListener('click', async () => {
    if (!current) return;
    const label = $('#exploreCopy span'), old = label.textContent;
    try { await navigator.clipboard.writeText(`${current.lat.toFixed(5)}, ${current.lon.toFixed(5)}`); label.textContent = '¡Copiado!'; }
    catch { label.textContent = 'No se pudo'; }
    setTimeout(() => { label.textContent = old; }, 1400);
  });
  $('#exploreAsk').addEventListener('click', () => {
    if (!current) return;
    const where = [current.name, current.country].filter(Boolean).join(', ');
    document.querySelector('.nav button[data-view="chat"]')?.click();
    setTimeout(() => {
      const input = $('#chatInput'); if (!input) return;
      input.value = `Cuéntame sobre ${where}: qué ver y hacer, mejor época para ir, costo de vida aproximado y consejos locales.`;
      input.dispatchEvent(new Event('input', {bubbles: true})); input.focus();
    }, 220);
  });
  // pestañas de atajos
  $$('.explore-chip-tab').forEach(b => b.addEventListener('click', () => renderChips(b.dataset.chips)));
  $('#exploreSavedCount').textContent = saved.length || '';
  renderChips('featured');
  $('#exploreCount').textContent = `${CITIES.length} ciudades · 6 mapas · 3 capas`;
  // atajos de teclado
  document.addEventListener('keydown', e => {
    if (!$('#view-explore')?.classList.contains('active')) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); }
    if (e.key === 'Escape' && measuring) setMeasuring(false);
  });
}

async function start() {
  if (started) return;
  started = true;
  stage = $('.explore-stage');
  try { L = await loadLeaflet(); }
  catch (e) { started = false; renderResults([], [], e.message); return; }
  saved = storageGet(SAVED_KEY, []);
  const savedBase = storageGet(BASE_KEY, 'streets'); baseMode = BASES[savedBase] ? savedBase : 'streets';
  map = L.map('exploreMap', {zoomControl: false, minZoom: 2, maxZoom: 17, worldCopyJump: true, zoomSnap: .25, zoomDelta: .5, center: [20, -30], zoom: 2.5, maxBounds: [[-85, -420], [85, 420]], maxBoundsViscosity: .6});
  applyBase(); addCityMarkers();
  map.on('zoomend', () => $('#exploreMap').classList.toggle('xp-labels', map.getZoom() >= 4));
  map.on('click', e => { if (measuring) addMeasurePoint(e.latlng); else pickPoint(e.latlng.lat, e.latlng.lng); });
  bindUi();
  setTimeout(() => map.invalidateSize(), 50);
  setTimeout(() => selectPlace({...CITIES[0]}, {zoom: 4.5}), 900);
}

const view = $('#view-explore');
if (view) {
  const onShow = () => {
    if (!view.classList.contains('active')) return;
    if (!started) start(); else setTimeout(() => map?.invalidateSize(), 60);
  };
  new MutationObserver(onShow).observe(view, {attributes: true, attributeFilter: ['class']});
  onShow();
}
