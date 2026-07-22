/**
 * Widget multicanal y Chat Web premium para Portal del Cliente.
 * Unificado con linktree — mismo motor, sesión propia, contexto portal.
 * Soporte completo: PDF, Word, Excel, imágenes, audio, mensajería web.
 */

const chatOptionsMenu = document.getElementById('chat-options-menu');
const webChatWindow = document.getElementById('web-chat-window');
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('chat-file-input');
const recordBtn = document.getElementById('record-btn');
const attachmentPreview = document.getElementById('attachment-preview');

const N8N_WEBHOOK_URL = 'https://primary-production-0abcf.up.railway.app/webhook/chat-insurance';
const WEBCHAT_SESSION_KEY = 'siraPortalWebChatSessionId';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

let pendingAttachments = [];
let mediaRecorder = null;
let recordedChunks = [];
let lastValidationStatus = '';
let lastPortalAccess = '';
let lastDni = '';
let lastPortalPassword = '';
let conversationIntent = ''; // Persisted intent from n8n
let lastUserMessage = ''; // Track last user message for quick replies context
let lastUserIntent = ''; // Locally detected intent from user message
let clientValidationFlow = ''; // 'asking_if_client', 'client_validated', 'not_client'

function getWebChatSessionId() {
    let sessionId = localStorage.getItem(WEBCHAT_SESSION_KEY);
    if (!sessionId) {
        sessionId = 'portal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(WEBCHAT_SESSION_KEY, sessionId);
    }
    return sessionId;
}

function getPortalDni() {
    return String(localStorage.getItem('saasUserDNI') || '').trim();
}

function getPortalUserName() {
    const nameEl = document.getElementById('user-display-name');
    const raw = String(nameEl?.textContent || '').trim();
    if (!raw || /^cargando/i.test(raw)) return '';
    return raw;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function urlLabel(url) {
    const u = url.toLowerCase();
    if (u.includes('modal=siniestro')) return 'Denunciar Siniestro';
    if (u.includes('modal=asesoria')) return 'Solicitar Asesoria';
    if (u.includes('modal=cotizacion')) return 'Cotizar Online';
    if (u.includes('modal=reclamo')) return 'Hacer Reclamo';
    if (u.includes('modal=faq')) return 'Preguntas Frecuentes';
    if (u.includes('modal=cuenta')) return 'Mi Cuenta';
    if (u.includes('modal=sucursales')) return 'Sucursales';
    if (u.includes('modal=nosotros')) return 'Sobre Nosotros';
    if (u.includes('modal=calificar')) return 'Calificanos';
    if (u.includes('modal=acceso')) return 'Acceso Empleados';
    if (u.includes('crear-clave')) return 'Crear Clave';
    if (u.includes('recuperar-clave')) return 'Recuperar Clave';
    if (u.includes('register') || u.includes('registro') || u.includes('signup')) return 'Registrarse';
    if (u.includes('login') || u.includes('ingresar') || u.includes('iniciar-sesion')) return 'Iniciar Sesion';
    if (u.includes('whatsapp') || u.includes('wa.me')) return 'Contactar por WhatsApp';
    if (u.includes('reset') || u.includes('recuperar')) return 'Recuperar Acceso';
    if (u.includes('portal.html') || u.includes('portal-cliente')) return 'Ir al Portal';
    if (u.includes('cotizar') || u.includes('presupuesto')) return 'Cotizar';
    const path = url.replace(/^https?:\/\/[^\/]+/, '').replace(/\.html?$/, '').replace(/[/_-]+/g, ' ').trim();
    if (path) return path.charAt(0).toUpperCase() + path.slice(1).substring(0, 30);
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function makeBtn(url, label) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-btn-link"><i class="fas fa-arrow-right"></i> ${label}</a>`;
}

function linkify(text) {
    const stripped = text.replace(/<[^>]+>/g, '').trim();
    const escaped = escapeHtml(stripped);
    const mdLinks = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const withMd = escaped.replace(mdLinks, (match, linkText, url) => {
        const cleanUrl = url.replace(/[),.;!?]+$/, '');
        const label = escapeHtml(linkText.trim());
        const btnLabel = label.length <= 30 ? label : urlLabel(cleanUrl);
        return makeBtn(cleanUrl, btnLabel);
    });
    return withMd.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
        const cleanUrl = url.replace(/[),.;!?]+$/, '');
        const suffix = url.slice(cleanUrl.length);
        return makeBtn(cleanUrl, urlLabel(cleanUrl)) + suffix;
    });
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(file) {
    if (file.type.startsWith('image/')) return 'fa-image';
    if (file.type.startsWith('audio/')) return 'fa-microphone';
    if (file.type.includes('pdf')) return 'fa-file-pdf';
    if (file.type.includes('spreadsheet') || /\.(xls|xlsx|csv)$/i.test(file.name)) return 'fa-file-excel';
    return 'fa-file-lines';
}

function createDownloadAction(attachment) {
    const link = document.createElement('a');
    link.className = 'attachment-download';
    link.href = attachment.dataUrl;
    link.download = attachment.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = `Descargar ${attachment.name}`;
    link.setAttribute('aria-label', `Descargar ${attachment.name}`);
    link.innerHTML = '<i class="fas fa-download"></i>';
    link.addEventListener('click', (event) => event.stopPropagation());
    return link;
}

function isOpenableAttachment(attachment) {
    return Boolean(attachment?.dataUrl) && !String(attachment?.type || '').startsWith('audio/');
}

function openAttachment(attachment) {
    if (!isOpenableAttachment(attachment)) return;
    const opened = window.open(attachment.dataUrl, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
}

function createOpenAction(attachment) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'attachment-open';
    button.title = `Abrir ${attachment.name}`;
    button.setAttribute('aria-label', `Abrir ${attachment.name}`);
    button.innerHTML = '<i class="fas fa-up-right-from-square"></i>';
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        openAttachment(attachment);
    });
    return button;
}

function createAttachmentCard(attachment, options = {}) {
    const compact = Boolean(options.compact);
    const showActions = options.showActions !== false;
    const card = document.createElement('div');
    card.className = 'attachment-card';
    const openable = isOpenableAttachment(attachment);

    if (attachment.type.startsWith('audio/')) {
        card.classList.add('attachment-audio-card');
        if (compact) card.classList.add('attachment-audio-compact');
        else card.classList.add('attachment-audio-full');
    }

    if (openable) {
        card.classList.add('attachment-openable');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Abrir ${attachment.name}`);
        card.title = `Abrir ${attachment.name}`;
        card.addEventListener('click', () => openAttachment(attachment));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAttachment(attachment);
            }
        });
    }

    if (attachment.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'attachment-thumb';
        img.src = attachment.dataUrl;
        img.alt = attachment.name;
        card.appendChild(img);
    } else if (attachment.type.startsWith('audio/')) {
        const icon = document.createElement('div');
        icon.className = 'attachment-thumb';
        icon.innerHTML = '<i class="fas fa-microphone"></i>';
        card.appendChild(icon);
    } else {
        const icon = document.createElement('div');
        icon.className = 'attachment-thumb';
        icon.innerHTML = `<i class="fas ${attachment.icon}"></i>`;
        card.appendChild(icon);
    }

    const meta = document.createElement('div');
    meta.className = 'attachment-meta';
    meta.innerHTML = `
        <div class="attachment-name">${escapeHtml(attachment.name)}</div>
        <div class="attachment-size">${escapeHtml(formatBytes(attachment.size))}</div>
    `;
    card.appendChild(meta);

    if (attachment.type.startsWith('audio/')) {
        if (!compact) {
            const controls = document.createElement('div');
            controls.className = 'attachment-audio-controls';

            const audio = document.createElement('audio');
            audio.className = 'attachment-audio';
            audio.controls = true;
            audio.preload = 'metadata';
            audio.src = attachment.dataUrl;

            controls.appendChild(audio);
            controls.appendChild(createDownloadAction(attachment));
            card.appendChild(controls);
        }
    } else if (showActions) {
        const actions = document.createElement('div');
        actions.className = compact ? 'attachment-actions attachment-actions-compact' : 'attachment-actions';
        if (openable) actions.appendChild(createOpenAction(attachment));
        actions.appendChild(createDownloadAction(attachment));
        card.appendChild(actions);
    }

    return card;
}

function renderPreview() {
    if (!attachmentPreview) return;
    attachmentPreview.innerHTML = '';
    attachmentPreview.classList.toggle('hidden', pendingAttachments.length === 0);

    pendingAttachments.forEach((attachment, index) => {
        const chip = document.createElement('div');
        chip.className = 'preview-chip';
        chip.appendChild(createAttachmentCard(attachment, { compact: true, showActions: false }));

        const remove = document.createElement('button');
        remove.className = 'preview-remove';
        remove.type = 'button';
        remove.innerHTML = '&times;';
        remove.setAttribute('aria-label', 'Quitar adjunto');
        remove.addEventListener('click', () => {
            pendingAttachments.splice(index, 1);
            renderPreview();
        });
        chip.appendChild(remove);
        attachmentPreview.appendChild(chip);
    });
}

function addMessage(text, sender, attachments = []) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    if (attachments.length) messageDiv.classList.add('has-attachments');

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (attachments.length) {
        const list = document.createElement('div');
        list.className = 'message-attachments';
        attachments.forEach((attachment) => {
            const isAudio = String(attachment.type || '').startsWith('audio/');
            list.appendChild(createAttachmentCard(attachment, { compact: sender === 'user' && !isAudio }));
        });
        bubble.appendChild(list);
    }

    if (text) {
        const body = document.createElement('div');
        body.innerHTML = sender === 'assistant' ? linkify(text) : escapeHtml(text);
        bubble.appendChild(body);
    }

    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleChatMenu() {
    if (!chatOptionsMenu || !webChatWindow) return;
    chatOptionsMenu.classList.toggle('hidden');
    if (!chatOptionsMenu.classList.contains('hidden')) {
        webChatWindow.classList.add('hidden');
    }
}

function toggleWebChat() {
    if (!webChatWindow || !chatOptionsMenu || !userInput) return;
    webChatWindow.classList.toggle('hidden');
    chatOptionsMenu.classList.add('hidden');
    if (!webChatWindow.classList.contains('hidden')) {
        userInput.focus();
        const dot = document.querySelector('.notification-dot');
        if (dot) dot.style.display = 'none';
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function readTextPreview(file) {
    const name = file.name.toLowerCase();
    // PDF
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
        try {
            if (typeof pdfjsLib === 'undefined') return '[PDF - lector no disponible]';
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(' ') + '\n';
            }
            return text.trim().slice(0, 4000);
        } catch {
            return '[PDF - error al leer]';
        }
    }
    // Word (.docx)
    if (name.endsWith('.docx')) {
        try {
            if (typeof mammoth === 'undefined') return '[Word - lector no disponible]';
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return (result.value || '').trim().slice(0, 4000);
        } catch {
            return '[Word - error al leer]';
        }
    }
    // Excel (.xlsx, .xls)
    if (/\.xlsx?$/.test(name)) {
        try {
            if (typeof XLSX === 'undefined') return '[Excel - lector no disponible]';
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            let text = '';
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                text += `\n--- ${sheetName} ---\n`;
                text += XLSX.utils.sheet_to_csv(sheet);
            });
            return text.trim().slice(0, 4000);
        } catch {
            return '[Excel - error al leer]';
        }
    }
    // Texto plano
    if (file.type.startsWith('text/') || /\.(txt|csv|md|json|xml|html?|log)$/i.test(name)) {
        try {
            return (await file.text()).slice(0, 4000);
        } catch {
            return '';
        }
    }
    return '';
}

async function addFiles(files) {
    for (const file of Array.from(files || [])) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
            addMessage(`El archivo ${file.name} supera 8 MB. Probá con uno más liviano.`, 'assistant');
            continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        pendingAttachments.push({
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl,
            icon: attachmentIcon(file),
            textPreview: await readTextPreview(file),
        });
    }
    renderPreview();
}

function detectUserIntent(text) {
    if (!text) return '';
    const lower = text.toLowerCase().trim();

    // FLOW 1 — EMERGENCY (highest priority, skip validation)
    if (/\bemergencia\b|\bhay heridos\b|\blesionados\b|\burgente\b|\baccidente grave\b|\bnecesito ayuda urgente\b|\bnecesito auxilio urgente\b|\bpedir auxilio\b|\bambulancia\b|\bbomberos\b|\bpolic[ií]a\b|\bme est[áa] pasando\b/i.test(lower)) return 'emergency';

    // FLOW 2 — CLAIM REPORT (reportar siniestro sin emergencia)
    if (/denunciar siniestro|reportar siniestro|cargar siniestro|tuve un accidente|me chocaron|choqu[eé]|robo\b|incendio|gr[uú]a|pipa\b|auxilio mec[aá]nico|auxilio en ruta|auxilio en carretera|destrucci[oó]n total|me robaron/i.test(lower)) return 'claim_report';

    // FLOW 3 — POLICY SENSITIVE (requires validation)
    if (/\bp[oó]lizas?\b|\bcertificado\b|\bcup[oó]n\b|\bvencimiento\b|\bvigencia\b|\bcobertura\b|\bvalor de p[oó]liza\b|\bimporte\b|\bcu[aá]nto pago\b|\bestado de p[oó]liza\b|\bmis seguros\b/i.test(lower)) return 'policy_sensitive';

    // FLOW 4 — FAQ / GENERAL KNOWLEDGE
    if (/qu[eé] cubre|c[oó]mo funciona|horarios|sucursales|medios de pago|requisitos|qu[eé] necesito para|cu[aá]nto sale|d[oó]nde est[áa]n|tel[eé]fono|direcci[oó]n|qu[eé] seguro|diferencia entre|tipos de seguro|terceros completo|todo riesgo|qu[eé] es/i.test(lower)) return 'faq';

    // FLOW 5 — PASSWORD HELP
    if (/no tengo contrase[ñn]a|olvid[eé] la (clave|contrase[ñn]a)|perd[ií] la contrase[ñn]a|no estoy registrad[oa]|no tengo acceso|crear (cuenta|clave)|registrarme|no puedo entrar|no me acuerdo la contrase[ñn]a|recuperar (clave|contrase[ñn]a)|c[oó]mo (creo|hago|genero) (una|mi) (clave|contrase[ñn]a)/i.test(lower)) return 'password_help';

    // FLOW 6 — ADVISORY APPOINTMENT
    if (/turno|asesor[ií]a|asesor[ií]as?|videollamada|video llamada|agendar|agenda|reuni[oó]n|hablar con (alguien|un asesor|una persona)|quiero que me (llamen|contacten)|consulta personal/i.test(lower)) return 'advisory_appointment';

    // FLOW 7 — STATUS SENSITIVE (requires validation)
    if (/estado de (gesti[oó]n|siniestro|denuncia)|seguimiento|en qu[eé] estado est[aá]|c[oó]mo va (mi|la)|denuncia (hecha|anterior|registrada)|tengo (una |)denuncia|aprobad[oa]|observad[oa]|pendiente de/i.test(lower)) return 'status_sensitive';

    // FLOW 8 — DOCUMENTATION (may require validation)
    if (/documentaci[oó]n (faltante|pendiente)|papeles|requisitos para|qu[eé] documentos|adjuntar|fotocopia|me piden|qu[eé] me falta/i.test(lower)) return 'documentation_sensitive';

    // FLOW 9 — HUMAN HANDOFF
    if (/abogado|demanda|carta documento|defensa del consumidor|quiero hablar con (humano|una persona|un operador|alguien)|operador\b|muy enojad[oa]|estoy enojad[oa]|reclamo legal|me quejo|no me resolvieron|quiero que me atienda/i.test(lower)) return 'human_handoff';

    // FLOW 10 — SALES / QUOTE
    if (/cotizaci[oó]n|presupuesto|quiero (asegurar|contratar)|me interesa (un seguro|el seguro)|seguro para (mi )?(auto|moto|camioneta|cami[oó]n)|seguro de (vida|hogar)|cu[aá]nto cuesta (el seguro|un seguro)|contratar un seguro/i.test(lower)) return 'sales_quote';

    // FLOW 11 — THANKS / GOODBYE
    if (/\b(gracias|te agradezco|genial|perfecto|listo|eso era todo|nos vemos|chau\b|saludos|hasta luego|bye)\b/i.test(lower) && text.length < 30) return 'thanks_goodbye';

    // FLOW 11b — CLIENT STATUS RESPONSES
    if (/soy cliente|ya soy cliente|soy cliente de|tengo cuenta|tengo p[oó]liza|ya me (registr[ée]|valid[ée])/i.test(lower)) return 'client_yes';

    if (/no soy cliente|no tengo cuenta|no tengo p[oó]liza|nunca (me |)registr[ée]|no estoy registrado|nuevo cliente|quiero registrarme|primera vez/i.test(lower)) return 'client_no';

    if (/seguir sin validarme|sin validaci[oó]n|continuar sin|no validar|skip validation|como no cliente/i.test(lower)) return 'continue_without_validation';

    // FLOW 12 — CANCEL / CHANGE
    if (/dar de baja|darme de baja|cancelar (p[oó]liza|seguro)|no quiero m[aá]s|no (lo |)renuevo|modificar (p[oó]liza|seguro)|cambiar (de |)cobertura|actualizar datos|cambio de (domicilio|veh[ií]culo)|vend[ií] el (auto|veh[ií]culo)/i.test(lower)) return 'cancel_change';

    // FLOW 13 — MEDIA REVIEW (attachment present)
    if (/imagen|im[aá]genes|foto|fotos|captura|documento|documentos|archivo|archivos|pdf|adjunto|adjuntos|audio\b|escuchar|revis[aá] (esta |el |la |este )|mir[aá] (esta |el |la )/i.test(lower)) return 'media_review';

    // FLOW 14 — MALICIOUS
    if (/\bsystem prompt\b|\bdeveloper mode\b|\bignore (previous|all|instructions)\b|\bjailbreak\b|\breveal (instructions|prompt)\b|\bprompt injection\b|\bact as\b|\beres\b|\bolvida (las |tus |todas )instrucciones\b/i.test(lower)) return 'malicious';

    // Default greeting
    if (/hola|buen[ao]s d[ií]as?|buenas (tardes|noches)|qu[eé] tal|buen inicio/i.test(lower)) return 'general';

    return '';
}

function buildPayload(text, attachments) {
    const attachmentSummaries = attachments.map((item) => {
        const kind = item.type.startsWith('image/') ? 'imagen' : item.type.startsWith('audio/') ? 'audio' : 'documento';
        return `${kind}: ${item.name} (${item.type || 'sin tipo'}, ${formatBytes(item.size)})`;
    });

    const message = [text, attachmentSummaries.length ? `Adjuntos enviados:\n${attachmentSummaries.join('\n')}` : '']
        .filter(Boolean)
        .join('\n\n');

    const sessionId = getWebChatSessionId();
    const dni = getPortalDni();
    const userName = getPortalUserName();

    // Build user context from portal session
    const userEmail = localStorage.getItem('saasUserEmail') || '';
    const cachedProfile = (() => {
        try { return JSON.parse(localStorage.getItem('portalProfile') || 'null'); } catch { return null; }
    })();

    const detectedIntent = detectUserIntent(text) || conversationIntent;

    const payload = {
        message,
        text,
        dni,
        user_name: userName,
        user_email: userEmail,
        is_authenticated: !!(dni || userEmail),
        portal_context: {
            source: 'portal-cliente',
            page: window.location.href,
            user_name: userName,
            dni: dni,
            email: userEmail,
        },
        attachments: attachments.map((item) => ({
            name: item.name,
            type: item.type,
            size: item.size,
            dataUrl: item.dataUrl,
            textPreview: item.textPreview || '',
        })),
        platform: 'webchat',
        channel: 'webchat',
        sessionId,
        userId: dni || sessionId,
        pageUrl: window.location.href,
        source: 'portal',
        conversation_intent: detectedIntent,
    };
    if (lastValidationStatus) payload.validation_status = lastValidationStatus;
    if (lastPortalAccess) payload.portal_access = lastPortalAccess;
    if (lastDni) payload.dni = lastDni;
    if (lastPortalPassword) payload.portal_password = lastPortalPassword;
    return payload;
}

async function sendMessage() {
    const text = userInput.value.trim();
    const attachments = [...pendingAttachments];
    if (!text && attachments.length === 0) return;

    userInput.value = '';
    pendingAttachments = [];
    renderPreview();
    lastUserMessage = text;
    lastUserIntent = detectUserIntent(text);
    addMessage(text, 'user', attachments);

    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'assistant', 'typing');
    typingDiv.innerHTML = `<div class="bubble"><i class="fas fa-ellipsis-h fa-beat"></i></div>`;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload(text, attachments)),
        });

        if (!response.ok) throw new Error('Error en la respuesta del servidor');

        const data = await response.json();
        chatMessages.removeChild(typingDiv);
        lastValidationStatus = data.validation_status || '';
        lastPortalAccess = data.portal_access || '';
        lastDni = data.dni || '';
        lastPortalPassword = data.portal_password || '';
        conversationIntent = data.intent || ''; // Persist intent from n8n

        const reply = (data.output || data.reply_text || data.message || '').trim();
        if (reply) {
            addMessage(reply, 'assistant');
            suggestQuickReplies(reply, data);
        }
    } catch (error) {
        console.error('Error Chat Portal:', error);
        if (chatMessages.contains(typingDiv)) chatMessages.removeChild(typingDiv);
        addMessage('Lo siento, tengo una demora técnica. Por favor, intenta de nuevo o escríbeme por WhatsApp.', 'assistant');
    }
}

async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordBtn.classList.remove('recording');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        });
        mediaRecorder.addEventListener('stop', async () => {
            stream.getTracks().forEach((track) => track.stop());
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            const file = new File([blob], `audio-chat-${Date.now()}.webm`, { type: blob.type });
            await addFiles([file]);
        });
        recordBtn.classList.add('recording');
        mediaRecorder.start();
    } catch (error) {
        console.error('Error recording audio:', error);
        addMessage('No pude acceder al micrófono. Revisá los permisos del navegador o enviame un archivo de audio.', 'assistant');
    }
}

if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        await addFiles(fileInput.files);
        fileInput.value = '';
    });
}

if (recordBtn) {
    recordBtn.addEventListener('click', toggleRecording);
}

if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}

if (userInput) {
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
}

document.addEventListener('click', (event) => {
    const widget = document.getElementById('multi-chat-widget');
    if (widget && chatOptionsMenu && !widget.contains(event.target) && !chatOptionsMenu.classList.contains('hidden')) {
        chatOptionsMenu.classList.add('hidden');
    }
});

// --- Quick Replies contextuales ---
let quickRepliesHistory = [];

function addQuickReplies(replies) {
    if (!replies || !replies.length) return;
    const existing = chatMessages.querySelector('.quick-replies');
    const prevLabels = existing ? Array.from(existing.querySelectorAll('.quick-reply-chip')).map(c => c.textContent) : [];

    if (existing) {
        // Save current state for back navigation
        if (prevLabels.length) quickRepliesHistory.push(prevLabels);
        existing.remove();
    }

    const container = document.createElement('div');
    container.className = 'quick-replies';

    // Back button if we have history
    if (quickRepliesHistory.length) {
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'quick-reply-chip quick-reply-back';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
        backBtn.title = 'Volver a opciones anteriores';
        backBtn.addEventListener('click', () => {
            const prev = quickRepliesHistory.pop();
            if (prev) {
                // Don't re-save when restoring
                const currentLabels = Array.from(container.querySelectorAll('.quick-reply-chip:not(.quick-reply-back)')).map(c => ({ label: c.textContent }));
                addQuickReplies(prev.map(l => ({ label: l })));
                // Put current labels back on history
                if (currentLabels.length) quickRepliesHistory.push(prev);
                quickRepliesHistory = quickRepliesHistory.slice(0, -1); // remove the double push
            }
            container.remove();
        });
        container.appendChild(backBtn);
    }

    replies.forEach((item) => {
        const label = typeof item === 'string' ? item : item.label;
        const url = typeof item === 'object' ? item.url : null;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'quick-reply-chip';
        chip.textContent = label;

        if (url) {
            // Direct action — open URL, don't send to bot
            chip.classList.add('quick-reply-action');
            chip.addEventListener('click', () => {
                window.open(url, '_blank', 'noopener,noreferrer');
            });
        } else {
            chip.addEventListener('click', () => {
                container.remove();
                lastUserMessage = label;
                lastUserIntent = detectUserIntent(label);
                addMessage(label, 'user');
                userInput.value = '';
                pendingAttachments = [];
                const typingDiv = document.createElement('div');
                typingDiv.classList.add('message', 'assistant', 'typing');
                typingDiv.innerHTML = '<div class="bubble"><i class="fas fa-ellipsis-h fa-beat"></i></div>';
                chatMessages.appendChild(typingDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                fetch(N8N_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildPayload(label, [])),
                }).then(async (response) => {
                    if (chatMessages.contains(typingDiv)) chatMessages.removeChild(typingDiv);
                    if (!response.ok) throw new Error('Error');
                    const data = await response.json();
                    lastValidationStatus = data.validation_status || '';
                    lastPortalAccess = data.portal_access || '';
                    const reply = (data.output || data.reply_text || data.message || '').trim();
                    if (reply) {
                        addMessage(reply, 'assistant');
                        suggestQuickReplies(reply, data);
                    }
                }).catch(() => {
                    if (chatMessages.contains(typingDiv)) chatMessages.removeChild(typingDiv);
                    addMessage('Lo siento, tengo una demora. ¿Probamos de nuevo?', 'assistant');
                });
            });
        }
        container.appendChild(chip);
    });

    // Subtle hint that user can also type/audio freely
    const hint = document.createElement('div');
    hint.className = 'quick-reply-hint';
    hint.innerHTML = 'Por otra cosa, escribime o mandame un audio';
    container.appendChild(hint);

    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Auto-hide hint when user starts typing
    const hideHint = () => {
        hint.style.opacity = '0';
        hint.style.transition = 'opacity 0.3s';
    };
    if (userInput) {
        userInput.addEventListener('input', hideHint, { once: true });
    }
}

function suggestQuickReplies(replyText, data = {}) {
    quickRepliesHistory = [];
    const lower = replyText.toLowerCase();
    const intent = (data.intent || conversationIntent || '').toLowerCase();
    const userIntentLower = lastUserIntent.toLowerCase();
    const userMsgLower = lastUserMessage.toLowerCase();

    // Emergency intent from user ALWAYS takes priority — even if bot asks for password
    const userIsEmergency = userIntentLower === 'emergency' ||
        /\bemergencia\b|\bauxilio\b|\bhay heridos\b|\blesionados\b|\burgente\b|\baccidente grave\b/i.test(userMsgLower);

    // ── Priority Intent Resolution ──
    const isEmergency = userIsEmergency || intent === 'emergency' ||
        /\bemergencia\b|\bauxilio\b|\bhay heridos\b|\blesionados\b/i.test(lower);
    const isMalicious = intent === 'malicious' || userIntentLower === 'malicious';
    const isClaim = intent === 'claim_report' || userIntentLower === 'claim_report';
    const isPolicySensitive = intent === 'policy_sensitive' || userIntentLower === 'policy_sensitive';
    const isFaq = intent === 'faq' || userIntentLower === 'faq';
    const isPasswordHelp = intent === 'password_help' || userIntentLower === 'password_help';
    const isAdvisory = intent === 'advisory_appointment' || userIntentLower === 'advisory_appointment';
    const isStatusSensitive = intent === 'status_sensitive' || userIntentLower === 'status_sensitive';
    const isDocSensitive = intent === 'documentation_sensitive' || userIntentLower === 'documentation_sensitive';
    const isHumanHandoff = intent === 'human_handoff' || userIntentLower === 'human_handoff';
    const isSales = intent === 'sales_quote' || userIntentLower === 'sales_quote';
    const isThanksGoodbye = intent === 'thanks_goodbye' || userIntentLower === 'thanks_goodbye';
    const isCancel = intent === 'cancel_change' || userIntentLower === 'cancel_change';
    const isGreeting = intent === 'general' || /hola|bienvenido|¿en qué|en que puedo|ayudarte|ayudar|c[oó]mo est[aá]s/i.test(lower);
    const isHelpOffer = intent === 'general' && /algo más|otra consulta|necesitás|necesitas|por acá para|decime|cualquier cosa/i.test(lower);
    const isValidation = /contraseña|contrasena|validarte|validar|escribime la|pasame la|te valido|DNI|dni\b/i.test(lower);
    const isError = /no pude|no coincide|error|inválido|incorrecto|demora/i.test(lower);
    const isClientYes = intent === 'client_yes' || userIntentLower === 'client_yes';
    const isClientNo = intent === 'client_no' || userIntentLower === 'client_no';
    const isContinueWithoutValidation = intent === 'continue_without_validation' || userIntentLower === 'continue_without_validation';

    let contextualHint = '';

    // ── FLOW 0: CLIENT STATUS RESPONSES (highest priority after emergency) ──
    if (isClientYes) {
        clientValidationFlow = 'client_validated';
        addQuickReplies([
            { label: 'Iniciar sesión en Portal', url: 'https://portal.rafaelallendeseguros.digital/' },
            { label: 'Recuperar contraseña', url: 'https://portal.rafaelallendeseguros.digital/recuperar-clave.html' },
            { label: 'Seguir sin validarme' },
        ]);
        contextualHint = 'Para acceder a tus datos, iniciá sesión o recuperá tu clave';
    }
    else if (isClientNo) {
        clientValidationFlow = 'not_client';
        addQuickReplies([
            { label: 'Registrarme como cliente', url: 'https://portal.rafaelallendeseguros.digital/registro.html' },
            { label: 'Recuperar contraseña', url: 'https://portal.rafaelallendeseguros.digital/recuperar-clave.html' },
            { label: 'Seguir sin validarme' },
        ]);
        contextualHint = 'Podes registrarte o continuar sin validación';
    }
    else if (isContinueWithoutValidation) {
        clientValidationFlow = 'not_client';
        addQuickReplies([
            { label: 'Consultas generales' },
            { label: 'Cotizar seguro' },
            { label: 'Agendar asesoría', url: 'https://linktree.rafaelallendeseguros.digital/?modal=asesoria' },
            { label: 'Contactar WhatsApp', url: 'https://wa.me/5493417035515' },
        ]);
        contextualHint = 'Estas son las gestiones disponibles para vos';
    }
    // ── FLOW 1: EMERGENCY ──
    else if (isEmergency) {
        addQuickReplies([
            { label: 'Hay heridos' },
            { label: 'Necesito auxilio' },
            { label: 'Hablar con asesor' },
            { label: 'Llamame ya', url: 'https://wa.me/5493417035515' },
        ]);
        contextualHint = 'Contame tu situación y te asisto urgente';
    }
    // ── FLOW 2: CLAIM REPORT ──
    else if (isClaim) {
        addQuickReplies([
            { label: 'Soy cliente' },
            { label: 'No soy cliente' },
        ]);
        contextualHint = 'Para cargar la denuncia, primero verifiquemos tu estado';
    }
    // ── FLOW 3: POLICY (shows after validation) ──
    else if (isPolicySensitive) {
        addQuickReplies([
            { label: 'Soy cliente' },
            { label: 'No soy cliente' },
        ]);
        contextualHint = 'Para ver tus pólizas, primero verifiquemos tu estado';
    }
    // ── FLOW 4: FAQ ──
    else if (isFaq) {
        addQuickReplies([
            { label: 'Coberturas' },
            { label: 'Sucursales' },
            { label: 'Agendar asesoría', url: 'https://linktree.rafaelallendeseguros.digital/?modal=asesoria' },
            { label: 'Otra consulta' },
        ]);
        contextualHint = 'Preguntame lo que necesites saber';
    }
    // ── FLOW 5: PASSWORD HELP ──
    else if (isPasswordHelp) {
        addQuickReplies([
            { label: 'Crear clave', url: 'https://portal.rafaelallendeseguros.digital/crear-clave.html' },
            { label: 'Recuperar clave', url: 'https://portal.rafaelallendeseguros.digital/recuperar-clave.html' },
            { label: 'Ya tengo clave' },
        ]);
        contextualHint = 'Elegí la opción que necesites';
    }
    // ── FLOW 6: ADVISORY ──
    else if (isAdvisory) {
        addQuickReplies([
            { label: 'Agendar ahora', url: 'https://linktree.rafaelallendeseguros.digital/?modal=asesoria' },
            { label: 'Contacto WhatsApp', url: 'https://wa.me/5493417035515' },
            { label: 'Otra consulta' },
        ]);
        contextualHint = 'Reservá tu turno cuando quieras';
    }
    // ── FLOW 7: STATUS ──
    else if (isStatusSensitive) {
        addQuickReplies([
            { label: 'Ver estado' },
            { label: 'Ver detalle' },
            { label: 'Nueva consulta' },
        ]);
        contextualHint = 'Revisemos tus gestiones en curso';
    }
    // ── FLOW 8: DOCS ──
    else if (isDocSensitive) {
        addQuickReplies([
            { label: 'Qué me falta' },
            { label: 'Subir documento' },
            { label: 'Hablar con asesor' },
        ]);
        contextualHint = 'Revisemos tu documentación';
    }
    // ── FLOW 9: HUMAN HANDOFF ──
    else if (isHumanHandoff) {
        addQuickReplies([
            { label: 'Llamame', url: 'https://wa.me/5493417035515' },
            { label: 'Dejar mi contacto' },
            { label: 'Nueva consulta' },
        ]);
        contextualHint = 'Un asesor va a comunicarse con vos';
    }
    // ── FLOW 10: SALES ──
    else if (isSales) {
        addQuickReplies([
            { label: 'Quiero cotizar' },
            { label: 'Agendar asesoría', url: 'https://linktree.rafaelallendeseguros.digital/?modal=asesoria' },
            { label: 'Info de coberturas' },
        ]);
        contextualHint = 'Contame qué seguro te interesa';
    }
    // ── FLOW 11: THANKS ──
    else if (isThanksGoodbye) {
        addQuickReplies([
            { label: 'Nueva consulta' },
        ]);
        contextualHint = 'Para eso estoy. ¡Volvé cuando necesites!';
    }
    // ── FLOW 12: CANCEL ──
    else if (isCancel) {
        addQuickReplies([
            { label: 'Agendar asesoría', url: 'https://linktree.rafaelallendeseguros.digital/?modal=asesoria' },
            { label: 'Hablar con asesor' },
            { label: 'Contacto WhatsApp', url: 'https://wa.me/5493417035515' },
        ]);
        contextualHint = 'Un asesor te ayuda con esta gestión';
    }
    // ── FLOW 14: MALICIOUS ──
    else if (isMalicious) {
        contextualHint = 'Soy Sira, tu asesora de seguros. ¿En qué puedo ayudarte?';
    }
    // ── VALIDATION / ERROR ──
    else if (isValidation || isError) {
        addQuickReplies([
            { label: 'Crear clave', url: 'https://portal.rafaelallendeseguros.digital/crear-clave.html' },
            { label: 'Recuperar clave', url: 'https://portal.rafaelallendeseguros.digital/recuperar-clave.html' },
            { label: 'Hablar con asesor' },
        ]);
        contextualHint = 'Si no la tenés o la olvidaste, usá estas opciones';
    }
    // ── GREETING ──
    else if (isGreeting) {
        const userName = getPortalUserName();
        const firstName = userName && userName !== 'Cargando...' ? userName.split(' ')[0] : '';
        addQuickReplies([
            { label: firstName ? 'Mis pólizas' : 'Ver pólizas' },
            { label: 'Reportar siniestro', url: 'https://linktree.rafaelallendeseguros.digital/?modal=siniestro' },
            { label: 'Agendar asesoría', url: 'https://linktree.rafaelallendeseguros.digital/?modal=asesoria' },
            { label: 'Emergencia / Auxilio' },
        ]);
        contextualHint = 'Por otra cosa, escribime o mandame un audio';
    }
    // ── HELP OFFER (after answering) ──
    else if (isHelpOffer) {
        addQuickReplies([
            { label: 'Mis pólizas' },
            { label: 'Reportar siniestro', url: 'https://linktree.rafaelallendeseguros.digital/?modal=siniestro' },
            { label: 'Hablar con asesor' },
        ]);
        contextualHint = 'Por otra cosa, escribime o mandame un audio';
    }

    // Apply contextual hint
    if (contextualHint) {
        setTimeout(() => {
            const hint = chatMessages.querySelector('.quick-reply-hint');
            if (hint) hint.innerHTML = contextualHint;
        }, 50);
    }
}

window.toggleChatMenu = toggleChatMenu;
window.toggleWebChat = toggleWebChat;
window.sendMessage = sendMessage;
window.openInsuranceChat = function openInsuranceChat() {
    if (webChatWindow?.classList.contains('hidden')) {
        toggleWebChat();
        return;
    }
    if (userInput) userInput.focus();
};

// --- Personalizar saludo inicial con nombre del portal ---
(function initChatGreeting() {
    function updateGreeting() {
        const userName = getPortalUserName();
        const dni = getPortalDni();

        // If name is still loading, profile might be in localStorage
        let firstName = '';
        let fullName = userName;
        if ((!userName || userName === 'Cargando...') && dni) {
            try {
                const cached = JSON.parse(localStorage.getItem('portalProfile') || 'null');
                if (cached && cached.nombres) {
                    fullName = cached.nombres;
                    firstName = cached.nombres.split(' ')[0] || '';
                }
            } catch (e) { /* ignore */ }
        } else if (userName && userName !== 'Cargando...') {
            firstName = userName.split(' ')[0] || '';
        }

        if (!firstName && !dni) return; // not logged in yet

        const greeting = firstName
            ? `¡Hola ${firstName}! 👋 Soy Sira, tu asesora virtual. Ya estás en tu portal. ¿En qué puedo ayudarte hoy?`
            : `¡Hola! 👋 Soy Sira, tu asesora virtual. Ya veo que iniciaste sesión. ¿En qué necesitás ayuda?`;

        const firstBubble = document.querySelector('#chat-messages .message.assistant .bubble');
        if (firstBubble) {
            firstBubble.textContent = greeting;
        }
    }

    // Try immediately
    updateGreeting();

    // Also retry after portal data loads (portal.js sets user-display-name)
    let retries = 0;
    const interval = setInterval(() => {
        const name = getPortalUserName();
        if (name && name !== 'Cargando...') {
            updateGreeting();
            clearInterval(interval);
            return;
        }
        // Also check localStorage profile
        try {
            const cached = JSON.parse(localStorage.getItem('portalProfile') || 'null');
            if (cached && cached.nombres) {
                updateGreeting();
                clearInterval(interval);
                return;
            }
        } catch (e) { /* ignore */ }
        if (++retries > 15) clearInterval(interval); // stop after ~7.5s
    }, 500);
})();
