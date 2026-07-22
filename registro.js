const registerForm = document.getElementById('registerForm');
const registerBtn = document.getElementById('registerBtn');
const messageEl = document.getElementById('message');

const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
const API_URL = isLocal ? 'http://127.0.0.1:8000/api/portal/register' : 'https://web-production-2584d.up.railway.app/api/portal/register';

// Warm-up: despertar Railway si está frío
fetch(isLocal ? 'http://127.0.0.1:8000/' : 'https://web-production-2584d.up.railway.app/', { method: 'HEAD' }).catch(() => {});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dni = document.getElementById('dni').value.trim();
    const patente = document.getElementById('patente').value.trim();
    const password = document.getElementById('password').value.trim();
    
    messageEl.classList.add('hidden');
    messageEl.classList.remove('error');
    registerBtn.classList.add('loading');
    registerBtn.disabled = true;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, patente, password }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        const data = await response.json();

        if (response.ok && data.valid) {
            messageEl.textContent = "¡Contraseña creada con éxito! Redirigiendo al Login...";
            messageEl.classList.remove('hidden');
            messageEl.style.color = "#10b981";
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            throw new Error(data.message || 'No se pudo crear la contraseña');
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
        registerBtn.classList.remove('loading');
        registerBtn.disabled = false;
    }
});
