
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
                (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
                (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j'))) {
                e.preventDefault();
                return false;
            }
        });
        console.log('%c🛡️ Rules· Protección activa', 'color:#4fd8ff;font-size:14px;font-weight:bold;');
