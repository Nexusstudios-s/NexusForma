

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});


document.addEventListener('keydown', (e) => {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.key.toLowerCase() === 'u')
    ) {
        e.preventDefault();
    }
});


const titulo = 'font-size:24px;font-weight:900;color:#ff5252;';
const subtitulo = 'font-size:15px;font-weight:bold;color:#4fd8ff;';
const mensaje = 'font-size:13px;color:#ffffff;';

console.clear();

console.log(
    '%c⛔ ¡ALTO! ZONA DE SEGURIDAD',
    titulo
);

console.log(
    '%c🛡️ Nexus Forma · Protección activa',
    subtitulo
);

console.log(
    '%c⚠️ Si alguien te pidió abrir esta consola y pegar código, NO LO HAGAS.',
    mensaje
);

console.log(
    '%c🚨 Podría ser un intento de robar tu cuenta, sesión o información personal.',
    'font-size:14px;font-weight:bold;color:#ff7676;'
);

console.log(
    '%c🔒 Ningún administrador de Nexus Forma necesita que pegues código aquí para darte premios, activar planes Premium o verificar tu cuenta.',
    mensaje
);

console.log(
    '%c❌ No ejecutes instrucciones desconocidas, aunque te prometan beneficios gratuitos.',
    mensaje
);

console.log(
    '%c✅ Si recibiste estas instrucciones por mensaje, ignóralas y repórtalas al soporte oficial.',
    'font-size:13px;color:#6ee7a8;'
);

console.log(
    '%c© 2026 Nexus Forma · Nexus Studios',
    'font-size:11px;color:#9098a8;'
);
