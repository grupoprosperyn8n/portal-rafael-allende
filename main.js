const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const messageEl = document.getElementById('message');

const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
const API_URL = isLocal ? 'http://127.0.0.1:8000/api/portal/login-password' : 'https://web-production-2584d.up.railway.app/api/portal/login-password';

// Warm-up: despertar Railway si está frío antes del primer submit
fetch(isLocal ? 'http://127.0.0.1:8000/' : 'https://web-production-2584d.up.railway.app/', { method: 'HEAD' }).catch(() => {});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dni = document.getElementById('dni').value.trim();
    const password = document.getElementById('password').value.trim();
    
    messageEl.classList.add('hidden');
    messageEl.classList.remove('error');
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, password }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        const data = await response.json();

        if (response.ok && data.valid) {
            messageEl.textContent = `¡Hola ${data.cliente.nombres}! Accediendo a tu portal...`;
            messageEl.classList.remove('hidden');
            messageEl.style.color = "#10b981";
            
            localStorage.setItem('saasUserDNI', dni);

            setTimeout(() => {
                window.location.href = 'portal.html';
            }, 1500);
        } else {
            throw new Error(data.message || 'Credenciales inválidas');
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            messageEl.textContent = 'El servidor está tardando en responder. Por favor intentá de nuevo en unos segundos.';
        } else if (error.message === 'Failed to fetch' || error.message.includes('NetworkError') || error.message.includes('ERR_CONNECTION')) {
            messageEl.textContent = 'No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá de nuevo.';
        } else {
            messageEl.textContent = error.message;
        }
        messageEl.classList.remove('hidden');
        messageEl.classList.add('error');
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});
