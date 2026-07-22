document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar sesión
    const userDNI = localStorage.getItem('saasUserDNI');
    if (!userDNI) {
        window.location.href = 'index.html';
        return;
    }

    // Entorno Local de Alta Disponibilidad
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const BACKEND_BASE = isLocal ? 'http://127.0.0.1:8000/api/portal' : 'https://web-production-2584d.up.railway.app/api/portal';
    const BACKEND_API = `${BACKEND_BASE}/user-data`;

    // Warm-up: despertar Railway si está frío
    fetch(isLocal ? 'http://127.0.0.1:8000/' : 'https://web-production-2584d.up.railway.app/', { method: 'HEAD' }).catch(() => {});
    const appState = {
        portalData: null,
        collectionControllers: {},
        pendingPolizaFilter: ''
    };

    const POLIZA_FILTER_DEFINITIONS = [
        { value: 'activas', label: 'Activas', cls: 'stat-activa', icon: 'fa-circle-check' },
        { value: 'anuladas', label: 'Anuladas', cls: 'stat-anulada', icon: 'fa-circle-xmark' },
        { value: 'en_tramite', label: 'En trámite', cls: 'stat-tramite', icon: 'fa-hourglass-half' },
        { value: 'sin_poliza', label: 'Sin póliza', cls: 'stat-neutral', icon: 'fa-ban' },
        { value: 'sin_vigencia', label: 'Sin vigencia', cls: 'stat-7dias', icon: 'fa-circle-exclamation' },
        { value: 'vence_hoy', label: 'Vence hoy', cls: 'stat-alert-hot', icon: 'fa-bell' },
        { value: 'vence_1_dia', label: 'Vence en 1 día', cls: 'stat-alert-urgent', icon: 'fa-calendar-day' },
        { value: 'falta_menos_7', label: 'Falta menos de 7 días', cls: 'stat-semana', icon: 'fa-calendar-week' },
        { value: 'vence_7', label: 'Vence en 7 días', cls: 'stat-semana', icon: 'fa-clock' },
        { value: 'falta_menos_2_semanas', label: 'Falta menos de 2 semanas', cls: 'stat-mes', icon: 'fa-hourglass-start' },
        { value: 'menos_30', label: 'Menos de 30 días para vencer', cls: 'stat-mes', icon: 'fa-calendar-minus' },
        { value: 'vence_30', label: 'Vence en 30 días', cls: 'stat-30dias', icon: 'fa-calendar-days' }
    ];
    const POLIZA_FILTER_LABEL_MAP = Object.fromEntries(POLIZA_FILTER_DEFINITIONS.map((def) => [def.value, def.label]));
    
    const ACCIDENTE_DATE_KEYS = ['FECHA DEL SINIESTRO', 'FECHA CARGA', 'FECHA DE CREACION', 'FECHA'];
    const ACCIDENTE_PATENTE_KEYS = [
        'PATENTE DEL VEHICULO',
        'PATENTE DEL VEHICULO (Rollup)',
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES) Compilación (de N° POLIZA)',
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES)',
        'PATENTE'
    ];
    const ACCIDENTE_VEHICLE_KEYS = [
        'MARCA DEL VEHICULO Compilación (de N° POLIZA)',
        'MARCA DEL VEHICULO',
        'MODELO DEL VEHICULO',
        'MODELO DEL  VEHICULO',
        'VEHICULO',
        'MARCA'
    ];
    const ACCIDENTE_COBERTURA_KEYS = ['COBERTURA', 'COBERTURA (Rollup)', 'COBERTURA (de GESTIÓN GENERAL)', 'TIPO_COBERTURA'];
    const ACCIDENTE_POLIZA_KEYS = ['N° DE POLIZA', 'N° POLIZA', 'N° POLIZA (Rollup)', 'N° DE POLIZA (de GESTIÓN GENERAL)', 'ETIQUETA_POLIZA'];

    const GESTION_PATENTE_KEYS = [
        ...ACCIDENTE_PATENTE_KEYS,
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES)',
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES) Compilación (de N° POLIZA)'
    ];
    const POLIZA_PATENTE_KEYS = [
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES) Compilación (de N° POLIZA)',
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES)',
        'PATENTE DEL VEHICULO',
        'PATENTE DEL VEHICULO (Rollup)',
        'PATENTE'
    ];

    const ROBO_OC_PATENTE_KEYS = [
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES) Compilación (de N° POLIZA)',
        'PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES)',
        'PATENTE DEL VEHICULO (Rollup)',
        'PATENTE'
    ];
    const ROBO_OC_ID_KEYS = ['ID_UNICO_GESTION', 'ID-GESTION-UNICO', 'ID_UNICO_GESTION (from GESTIÓN GENERAL 2)'];
    const ROBO_OC_VEHICLE_KEYS = [
        'MARCA DEL VEHICULO Compilación (de N° POLIZA)',
        'MARCA DEL VEHICULO',
        'MODELO DEL VEHICULO',
        'MODELO DEL  VEHICULO'
    ];
    const ROBO_OC_COBERTURA_KEYS = ['COBERTURA', 'COBERTURA (Rollup)', 'ALCANCE DE COBERTURA'];
    const ROBO_OC_POLIZA_KEYS = ['N° DE POLIZA', 'N° POLIZA', 'N° POLIZA (Rollup)'];

    const ROBO_INC_ID_KEYS = ['ID_UNICO_GESTION', 'ID-GESTION-UNICO', 'ID_UNICO_GESTION (from GESTIÓN GENERAL 2)'];
    const ROBO_INC_PATENTE_KEYS = [
        'PATENTE DEL VEHICULO (Rollup)',
        'PATENTE DEL VEHICULO',
        'PATENTE'
    ];
    const ROBO_INC_VEHICLE_KEYS = [
        'MARCA DEL VEHICULO (Rollup)',
        'MARCA DEL VEHICULO',
        'MODELO DEL VEHICULO (Rollup)',
        'MODELO DEL VEHICULO',
        'MODELO DEL  VEHICULO'
    ];
    const ROBO_INC_COBERTURA_KEYS = ['COBERTURA (Rollup)', 'COBERTURA', 'ALCANCE DE COBERTURA'];
    const ROBO_INC_POLIZA_KEYS = ['N° POLIZA (Rollup)', 'N° DE POLIZA', 'N° POLIZA'];

    const ui = {
        nameDisplay: document.getElementById('user-display-name'),
        logoutBtn: document.getElementById('logoutBtn'),
        tabs: document.querySelectorAll('.tab-btn'),
        panes: document.querySelectorAll('.tab-pane'),
        loading: document.getElementById('loading-indicator'),
        contentArea: document.getElementById('content-area'),
        // Nodos del Modal Global
        modal: {
            overlay: document.getElementById('portal-detail-modal'),
            closeBtn: document.getElementById('pdm-close'),
            title: document.getElementById('pdm-title'),
            body: document.getElementById('pdm-body')
        }
    };

    function activateTab(target) {
        ui.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.target === target));
        ui.panes.forEach((pane) => pane.classList.toggle('active', pane.id === `tab-${target}`));
    }

    function getCollectionController(key) {
        return appState.collectionControllers[key] || null;
    }

    function mapPolizaPresetToFilterValue(preset = '') {
        const map = {
            all: '',
            activas: 'activas',
            anuladas: 'anuladas',
            tramite: 'en_tramite',
            sin_vigencia: 'sin_vigencia',
            sin_poliza: 'sin_poliza',
            vence_hoy: 'vence_hoy',
            vence_1_dia: 'vence_1_dia',
            falta_menos_7: 'falta_menos_7',
            vence_30: 'vence_30',
            vence_7: 'vence_7',
            falta_menos_2_semanas: 'falta_menos_2_semanas',
            menos_30: 'menos_30'
        };
        return map[preset] ?? '';
    }

    function openPolizaPreset(preset = '') {
        const filterValue = mapPolizaPresetToFilterValue(preset);
        appState.pendingPolizaFilter = filterValue;
        activateTab('polizas');
        const controller = getCollectionController('polizas');
        if (controller) {
            controller.setState({ search: '', filter: filterValue, sort: 'vence_asc' });
        }
    }

    // Modal Logic
    function openModal(titleHTML, bodyHTML) {
        ui.modal.title.innerHTML = titleHTML;
        ui.modal.body.innerHTML = bodyHTML;
        ui.modal.body.scrollTop = 0;
        ui.modal.overlay.scrollTop = 0;
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
        ui.modal.overlay.classList.add('active');
    }
    function closeModal() {
        ui.modal.overlay.classList.remove('active');
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        // Clear timeout/listeners if needed
        setTimeout(() => ui.modal.body.innerHTML = '', 300);
    }
    
    ui.modal.closeBtn.addEventListener('click', closeModal);
    ui.modal.overlay.addEventListener('click', (e) => {
        if (e.target === ui.modal.overlay) closeModal();
    });
    // Close on ESC mapping
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // 3. Navegación de tabs
    ui.tabs.forEach((btn) => {
        btn.addEventListener('click', () => activateTab(btn.dataset.target));
    });

    // 4. Logout
    ui.logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('saasUserDNI');
        window.location.href = 'index.html';
    });

    async function loadPortalData() {
        try {
            ui.nameDisplay.textContent = 'Cargando...';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            const res = await fetch(`${BACKEND_API}?dni=${encodeURIComponent(userDNI)}`, { signal: controller.signal });
            clearTimeout(timeout);
            const result = await res.json();
            
            if (!res.ok || !result.valid) {
                throw new Error(result.message || 'Error cargando datos');
            }

            const data = result.data;
            appState.portalData = data;

            // Cache profile in localStorage for chat context
            try {
                const chatProfile = {
                    dni: data.perfil?.dni || userDNI,
                    nombres: data.perfil?.nombres || '',
                    apellido: data.perfil?.apellido || '',
                    email: data.perfil?.EMAIL || data.perfil?.email || '',
                    telefono: data.perfil?.TELEFONO || data.perfil?.telefono || '',
                    polizas_count: (data.polizas || []).length,
                };
                localStorage.setItem('portalProfile', JSON.stringify(chatProfile));
            } catch (e) { /* ignore */ }
            
            if (data.perfil && data.perfil.nombres) {
                ui.nameDisplay.textContent = `${data.perfil.nombres} ${data.perfil.apellido || ''}`.trim();
            } else {
                ui.nameDisplay.textContent = 'Mi Cuenta';
            }

            renderPerfil(data.perfil);
            renderPolizas(data.polizas);
            renderGestiones(data.gestiones, data.polizas);
            renderAccidentes(data.accidentes, data.polizas);
            renderRoboOc(data.robo_oc, data.polizas);
            renderRoboIncendio(data.robo_incendio, data.polizas);

            ui.loading.classList.add('hidden');
            ui.contentArea.classList.remove('hidden');
        } catch (err) {
            console.error("Portal Error:", err);
            let userMsg = err.message;
            if (err.name === 'AbortError') {
                userMsg = 'El servidor está tardando en responder. Hacé click en Reintentar.';
            } else if (err.message === 'Failed to fetch' || err.message.includes('NetworkError') || err.message.includes('ERR_CONNECTION')) {
                userMsg = 'No se pudo conectar con el servidor. Verificá tu conexión a internet.';
            }
            ui.loading.innerHTML = `
                <div class="status-message error">
                    <p>${userMsg}</p>
                    <button onclick="window.location.reload()" class="action-btn">Reintentar</button>
                </div>`;
        }
    }

    // ========================
    // Utilidades
    // ========================

    function formatDate(str) {
        if (!str) return '-';
        try {
            const d = new Date(str);
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return str; }
    }

    function formatDateTime(str) {
        if (!str) return '-';
        try {
            const d = new Date(str);
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                   ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        } catch { return str; }
    }

    function daysUntilDate(value) {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const to = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        return Math.round((to - from) / 86400000);
    }

function strVal(v) {
        if (!v) return '';
        // Limpieza de strings técnicos detectados
        const clean = (val) => {
            const s = String(val);
            if (s === 'emptyDependency') return '';
            return s;
        };
        if (Array.isArray(v)) return v.map(clean).filter(Boolean).join(', ');
        return clean(v);
}

    function displayVal(v, fallback = '-') {
        const s = strVal(v).trim();
    return s || fallback;
}

function getFirstFieldValue(record, keys = []) {
    for (const key of keys) {
        if (key in record) {
            const value = record[key];
            if (value === null || value === undefined) continue;
            if (Array.isArray(value)) {
                const parts = value.map((item) => {
                    if (typeof item === 'string') return item.trim();
                    if (typeof item === 'object') return strVal(item);
                    return '';
                }).filter(Boolean);
                if (parts.length) return parts.join(', ');
                continue;
            }
            const str = String(value).trim();
            if (str) return str;
        }
    }
    return '';
}

function getFirstExistingRawValue(record, keys = []) {
    for (const key of keys) {
        if (record && Object.prototype.hasOwnProperty.call(record, key)) {
            const value = record[key];
            if (value !== null && value !== undefined && value !== '') return value;
        }
    }
    return null;
}

function buildPolizaLookup(polizas = []) {
    const map = new Map();
    polizas.forEach((pol) => {
        const rid = pol.RECORD_ID || pol["RECORD_ID"];
        if (rid) map.set(rid, pol);
        const numero = strVal(pol['N° DE POLIZA']);
        if (numero) map.set(numero, pol);
        const etiqueta = strVal(pol['ETIQUETA_POLIZA']);
        if (etiqueta) map.set(etiqueta, pol);
    });
    return map;
}

function resolveAccidentePolizaFallback(record, lookup) {
    if (!lookup || !record) return null;
    const referenceKeys = ['POLIZAS', 'POLIZAS 2', 'POLIZAS 3', 'POLIZAS 4'];
    const references = [];
    referenceKeys.forEach((key) => {
        const value = record[key];
        if (!value) return;
        if (Array.isArray(value)) {
            references.push(...value);
            return;
        }
        references.push(value);
    });

    for (const ref of references) {
        if (lookup.has(ref)) {
            return lookup.get(ref);
        }
    }

    const fallbackNumber = getFirstFieldValue(record, ['N° POLIZA', 'N° POLIZA (Rollup)', 'N° DE POLIZA', 'N° DE POLIZA (Rollup)']);
    if (fallbackNumber && lookup.has(fallbackNumber)) {
        return lookup.get(fallbackNumber);
    }
    return null;
}

function isAirtableRecordId(value) {
    const s = strVal(value).trim();
    return /^rec[a-zA-Z0-9]{10,}$/i.test(s);
}

function isTechnicalCodeValue(value) {
    const s = strVal(value).trim();
    if (!s) return false;
    if (isAirtableRecordId(s)) return true;
    if (/^REC[A-Z0-9]{8,}$/.test(s.toUpperCase())) return true;
    if (/^[a-z]{3}[A-Za-z0-9]{10,}$/.test(s)) return true;
    return false;
}

function isInternalWorkflowCode(value) {
    const s = strVal(value).trim();
    if (!s) return false;
    const normalized = s.toUpperCase();

    if (/^\d{3,4}-[A-ZÁÉÍÓÚÑ]+-GESTI[ÓO]N$/i.test(s)) return true;
    if (/^(WAPP|WHATSAPP|WEB|MAIL|EMAIL|PERSONAL|OFICINA|SUCURSAL)(-[A-ZÁÉÍÓÚÑ0-9]+)+$/i.test(s)) return true;
    if (/^(AUTO|MOTO|HOGAR|VIDA|COMERCIO)(-[A-ZÁÉÍÓÚÑ0-9]+)+$/i.test(s) && !/(CULPABLE|CUBIERTO|PARCIAL|TOTAL|PROCESO|PENDIENTE|RESUELTO|INCENDIO|ROBO)/i.test(normalized)) {
        return true;
    }

    return false;
}

function sanitizeUserFacingValue(value) {
    const s = strVal(value).trim();
    if (!s) return '';
    if (isTechnicalCodeValue(s)) return '';
    if (isInternalWorkflowCode(s)) return '';
    return s;
}

const POLIZA_REFERENCE_KEYS = [
    "POLIZAS",
    "POLIZAS 2",
    "POLIZAS 3",
    "POLIZAS 4",
    "POLIZAS 5",
    "POLIZAS 6",
    "POLIZAS 7",
    "POLIZA",
    "POLIZA 2"
];

function findLinkedPoliza(record, lookup) {
    if (!record || !lookup) return null;
    for (const key of POLIZA_REFERENCE_KEYS) {
        const value = record[key];
        if (!value) continue;
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
            if (lookup.has(id)) {
                return lookup.get(id);
            }
        }
    }
    const fallbackNumber = getFirstFieldValue(record, ["N° POLIZA", "N° DE POLIZA", "N° POLIZA (Rollup)", "N° DE POLIZA (Rollup)", "ETIQUETA_POLIZA"]);
    if (fallbackNumber && lookup.has(fallbackNumber)) {
        return lookup.get(fallbackNumber);
    }
    return null;
}

function resolvePolicyNumber(record, linkedPoliza = null, keys = []) {
    const candidates = [
        getFirstFieldValue(record, keys),
        getFirstFieldValue(linkedPoliza || {}, [
            'N° DE POLIZA',
            'N° POLIZA',
            'N° POLIZA (Rollup)',
            'N° DE POLIZA (Rollup)',
            'ETIQUETA_POLIZA'
        ])
    ].filter(Boolean);

    const humanReadable = candidates.find((value) => !isTechnicalCodeValue(value));
    return humanReadable ? strVal(humanReadable).trim() : '';
}

function resolveFieldWithPoliza(record, lookup, keys, fallbackField) {
    const directValue = getFirstFieldValue(record, keys);
    if (directValue) return directValue;
    if (!fallbackField || !lookup) return '';
    const linked = findLinkedPoliza(record, lookup);
    if (linked && linked[fallbackField]) {
        return strVal(linked[fallbackField]);
    }
    return '';
}

function resolveVehicleLabel(record, lookup) {
    const vehicleValue = getFirstFieldValue(record, [
        "MARCA DEL VEHICULO Compilación (de N° POLIZA)",
        "MARCA DEL VEHICULO",
        "MODELO DEL VEHICULO",
        "MODELO DEL  VEHICULO",
        "VEHICULO",
        "MARCA"
    ]);
    if (vehicleValue) return vehicleValue;
    const linked = findLinkedPoliza(record, lookup);
    if (linked) {
        const brand = strVal(linked["MARCA DEL VEHICULO"]);
        const model = strVal(linked["MODELO DEL VEHICULO"]);
        return [brand, model].filter(Boolean).join(' ');
    }
    return '';
}

function resolveCompany(record, linkedPoliza = null) {
    return displayVal(
        getFirstFieldValue(record, [
            'COMPANIA_RESOLVED',
            'NOMBRE (from COMPANIA LINK)',
            'COMPAÑIA DE SEGURO ( TER 1 )',
            'COMPAÑIA DE SEGURO  ( TER 2 )',
            'COMPANIA'
        ]) ||
        getFirstFieldValue(linkedPoliza || {}, [
            'COMPANIA_RESOLVED',
            'NOMBRE (from COMPANIA LINK)',
            'COMPANIA'
        ])
    );
}

function isHumanReadableProduct(value) {
    const s = strVal(value).trim();
    if (!s) return false;
    const normalized = s.toUpperCase();

    if (/^REC[A-Z0-9]{8,}$/.test(normalized)) return false;
    if (/^[A-Z0-9_-]{12,}$/.test(s) && !/\s/.test(s)) return false;

    if (/(AUTO|MOTO|CAMIONETA|CAMION|BICICLETA|HOGAR|VIDA|COMERCIO|ACCIDENTES PERSONALES|BOLSO|SEGURO|SALUD|EMBARCACION|CRISTALES|ROBO|INCENDIO)/i.test(s)) {
        return true;
    }

    if (s.length <= 4 && /^[A-Z0-9]+$/.test(normalized)) return false;

    return /[A-ZÁÉÍÓÚÑ]/i.test(s);
}

function resolveProduct(record, linkedPoliza = null) {
    const candidates = [
        getFirstFieldValue(record, [
            'NOMBRE (from PRODUCTO LINK)',
            'NOMBRE PRODUCTO (from PRODUCTO LINK)',
            'PRODUCTO (from PRODUCTO LINK)',
            'TIPO DE PRODUCTOS (from PRODUCTO LINK)',
            'TIPO DE PRODUCTOS',
            'NOMBRE PRODUCTO',
            'PRODUCTO',
            'PRODUCTO_RESOLVED',
            'PRODUCTO LINK'
        ]),
        getFirstFieldValue(linkedPoliza || {}, [
            'NOMBRE (from PRODUCTO LINK)',
            'NOMBRE PRODUCTO (from PRODUCTO LINK)',
            'PRODUCTO (from PRODUCTO LINK)',
            'TIPO DE PRODUCTOS (from PRODUCTO LINK)',
            'TIPO DE PRODUCTOS',
            'NOMBRE PRODUCTO',
            'PRODUCTO',
            'PRODUCTO_RESOLVED',
            'PRODUCTO LINK'
        ])
    ].filter(Boolean);

    const readable = candidates.find(isHumanReadableProduct);
    return readable ? strVal(readable).trim() : '';
}

function resolveDisplayProduct(record, linkedPoliza = null) {
    return displayVal(
        resolveProduct(record, linkedPoliza) ||
        getFirstFieldValue(record, [
            'NOMBRE (from PRODUCTO LINK)',
            'NOMBRE PRODUCTO (from PRODUCTO LINK)',
            'PRODUCTO (from PRODUCTO LINK)',
            'TIPO DE PRODUCTOS (from PRODUCTO LINK)',
            'NOMBRE PRODUCTO',
            'TIPO DE PRODUCTOS',
            'PRODUCTO',
            'TIPO DE VEHICULO',
            'TIPO VEHICULO',
            'ARTICULO'
        ]) ||
        getFirstFieldValue(linkedPoliza || {}, [
            'NOMBRE (from PRODUCTO LINK)',
            'NOMBRE PRODUCTO (from PRODUCTO LINK)',
            'PRODUCTO (from PRODUCTO LINK)',
            'TIPO DE PRODUCTOS (from PRODUCTO LINK)',
            'NOMBRE PRODUCTO',
            'TIPO DE PRODUCTOS',
            'PRODUCTO',
            'TIPO DE VEHICULO',
            'TIPO VEHICULO',
            'ARTICULO'
        ]),
        ''
    );
}

function getFirstAttachment(record, keys = []) {
    for (const key of keys) {
        const value = record?.[key];
        if (Array.isArray(value) && value.length && value[0]?.url) {
            return value[0];
        }
    }
    return null;
}

function formatCurrency(value) {
    const raw = strVal(value).trim();
    if (!raw) return '-';

    const normalized = raw
        .replace(/\$/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const num = Number(normalized);

    if (!Number.isFinite(num)) return raw.startsWith('$') ? raw : `$${raw}`;

    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(num);
}

function resolveVehicleType(record) {
    return displayVal(
        getFirstFieldValue(record, [
            'PRODUCTO LINK',
            'PRODUCTO_RESOLVED',
            'TIPO DE PRODUCTOS',
            'TIPO DE VEHICULO',
            'TIPO VEHICULO',
            'ARTICULO'
        ]),
        ''
    );
}

function resolveProductIcon(record) {
    const icon = strVal(
        getFirstFieldValue(record, [
            'ICONO (from PRODUCTO LINK)',
            'ICONO PRODUCTO',
            'ICONO',
            'EMOJI'
        ])
    ).trim();

    if (icon) return icon;
    return resolveVehicleEmoji(resolveVehicleType(record));
}

function resolveVehicleEmoji(value) {
    const s = strVal(value).toUpperCase();
    if (s.includes('MOTO')) return '🏍️';
    if (s.includes('CAMIONETA')) return '🚙';
    if (s.includes('CAMION')) return '🚚';
    if (s.includes('BICICLETA')) return '🚲';
    if (s.includes('TAXI')) return '🚕';
    if (s.includes('AUTO')) return '🚘';
    return '🛡️';
}

function makeInteractiveCard(card, onActivate) {
    if (!card || typeof onActivate !== 'function') return card;

    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Abrir detalle');
    card.querySelectorAll('a, button').forEach((node) => {
        node.addEventListener('click', (event) => event.stopPropagation());
    });
    card.addEventListener('click', (event) => {
        if (event.target.closest('a, button, input, select, textarea')) return;
        onActivate();
    });
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate();
        }
    });
    return card;
}

function buildPolizaDetailModal(poliza = {}) {
    const numeroPoliza = displayVal(strVal(poliza['N° DE POLIZA']) || strVal(poliza['ETIQUETA_POLIZA']), 'Sin número');
    const estado = displayVal(strVal(poliza['ESTADO DE LA POLIZA']) || strVal(poliza['ETIQUETA_POLIZA']), 'Sin estado');
    const patente = displayVal(getFirstFieldValue(poliza, POLIZA_PATENTE_KEYS));
    const marca = strVal(poliza['MARCA DEL VEHICULO']);
    const modelo = strVal(poliza['MODELO DEL VEHICULO']);
    const vehiculo = displayVal([marca, modelo].filter(Boolean).join(' '));
    const cobertura = displayVal(poliza['COBERTURA']);
    const compania = resolveCompany(poliza);
    const tipoVehiculo = resolveDisplayProduct(poliza);
    const productIcon = resolveProductIcon(poliza);
    const logo = getFirstAttachment(poliza, ['LOGO (from COMPANIA LINK)', 'LOGO']);
    const fechaInicio = formatDate(poliza['FECHA DE INICIO DE LA POLIZA']);
    const fechaVencimiento = formatDate(poliza['FECHA VENCIMIENTO DE LA POLIZA']);
    const anio = displayVal(poliza['AÑO DEL VEHICULO']);
    const combustible = displayVal(poliza['TIPO DE COMBUSTIBLE']);
    const usoVehiculo = displayVal(poliza['USO DEL VEHICULO']);
    const vida = displayVal(poliza['VIDA'], 'No');
    const auxilioPlan = displayVal(getFirstFieldValue(poliza, ['AUXILIO', 'AUXILIO 24', 'AUXILIOS']), 'No disponible');
    const importePoliza = formatCurrency(getFirstFieldValue(poliza, ['IMPORTE', 'IMPORTE POLIZA']));
    const importeVida = formatCurrency(getFirstFieldValue(poliza, ['IMPORTE VIDA']));
    const importeAuxilio = formatCurrency(getFirstFieldValue(poliza, ['IMPORTE AUXILIO 24', 'IMPORTE AUX 24', 'IMPORTE AUXILIO']));
    const telefonoAuxilio = displayVal(getFirstFieldValue(poliza, ['TEL. AUXILIO (from COMPANIA LINK)', 'TEL. AUXILIO', 'TELEFONO AUXILIO']), 'No disponible');
    const emailSiniestros = displayVal(getFirstFieldValue(poliza, ['EMAIL SINIESTROS (from COMPANIA LINK)', 'EMAIL SINIESTROS']), 'No disponible');
    const documentacion = getFirstAttachment(poliza, ['DOCUMENTACION']);
    const documentacionUrl = documentacion?.url || '';
    const office = displayVal(resolvedOficina(poliza), 'No asignada');

    const title = `${productIcon} Póliza ${numeroPoliza}`;
    const body = `
        <div class="poliza-modal-hero">
            <div class="poliza-modal-hero-main">
                <span class="poliza-modal-kicker">Detalle de cobertura</span>
                <h3 class="poliza-modal-heading">${vehiculo}</h3>
                <div class="poliza-modal-badges">
                    ${makeBadge(estado)}
                    ${tipoVehiculo ? makeBadge(`${productIcon} ${tipoVehiculo}`, 'badge-blue') : ''}
                    ${cobertura !== '-' ? makeBadge(cobertura, 'badge-orange') : ''}
                </div>
            </div>
            ${logo?.thumbnails?.large?.url || logo?.url ? `
                <div class="poliza-modal-company">
                    <img class="poliza-modal-logo" src="${logo.thumbnails?.large?.url || logo.url}" alt="${compania}">
                    <strong>${compania}</strong>
                </div>
            ` : `
                <div class="poliza-modal-company poliza-modal-company-textonly">
                    <strong>${compania}</strong>
                </div>
            `}
        </div>

        <div class="modal-fixed-grid">
            <section class="modal-fixed-section">
                <h3 class="modal-section-title">Resumen de la póliza</h3>
                <div class="modal-detail-row"><span class="modal-detail-label">Estado</span><span class="modal-detail-value">${makeBadge(estado)}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">N° de póliza</span><span class="modal-detail-value">${numeroPoliza}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Compañía</span><span class="modal-detail-value">${compania}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Producto</span><span class="modal-detail-value">${tipoVehiculo ? makeBadge(`${productIcon} ${tipoVehiculo}`, 'badge-blue') : '-'}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Cobertura</span><span class="modal-detail-value">${cobertura !== '-' ? makeBadge(cobertura, 'badge-orange') : '-'}</span></div>
            </section>

            <section class="modal-fixed-section">
                <h3 class="modal-section-title">Vehículo asegurado</h3>
                <div class="modal-detail-row"><span class="modal-detail-label">Vehículo</span><span class="modal-detail-value">${vehiculo}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Patente</span><span class="modal-detail-value">${patente}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Marca</span><span class="modal-detail-value">${displayVal(marca)}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Modelo</span><span class="modal-detail-value">${displayVal(modelo)}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Año</span><span class="modal-detail-value">${anio}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Uso</span><span class="modal-detail-value">${usoVehiculo}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Combustible</span><span class="modal-detail-value">${combustible}</span></div>
            </section>

            <section class="modal-fixed-section">
                <h3 class="modal-section-title">Vigencia</h3>
                <div class="modal-detail-row"><span class="modal-detail-label">Inicio de cobertura</span><span class="modal-detail-value">${fechaInicio}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Vencimiento</span><span class="modal-detail-value">${fechaVencimiento}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Oficina</span><span class="modal-detail-value">${office}</span></div>
            </section>

            <section class="modal-fixed-section">
                <h3 class="modal-section-title">Costos y adicionales</h3>
                <div class="modal-grid-3">
                    <div class="mini-card"><small>Importe póliza</small><strong>${importePoliza}</strong></div>
                    <div class="mini-card"><small>Importe vida</small><strong>${importeVida}</strong></div>
                    <div class="mini-card"><small>Importe auxilio</small><strong>${importeAuxilio}</strong></div>
                </div>
                <div class="modal-grid-2" style="margin-top:10px;">
                    <div class="mini-badge-row"><span>Vida</span> ${makeBadge(vida, /SI/i.test(vida) ? 'badge-green' : 'badge-gray')}</div>
                    <div class="mini-badge-row"><span>Auxilio</span> ${makeBadge(auxilioPlan, /AUX|SI/i.test(auxilioPlan) ? 'badge-green' : 'badge-gray')}</div>
                </div>
            </section>

            <section class="modal-fixed-section">
                <h3 class="modal-section-title">Contacto y asistencia</h3>
                <div class="modal-detail-row"><span class="modal-detail-label">Teléfono de auxilio</span><span class="modal-detail-value">${telefonoAuxilio}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Email de siniestros</span><span class="modal-detail-value">${emailSiniestros}</span></div>
                <div class="modal-detail-row"><span class="modal-detail-label">Plan de auxilio</span><span class="modal-detail-value">${auxilioPlan}</span></div>
                ${documentacionUrl ? `
                    <div class="poliza-modal-actions">
                        <a href="${documentacionUrl}" target="_blank" class="btn-download-doc" title="Descargar PDF de la póliza">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Descargar documentación
                        </a>
                    </div>
                ` : ''}
            </section>
        </div>
    `;

    return { title, body };
}

    function buildFields(fields) {
        return fields.map(({ label, value, valueClass = '', isHtml = false }) => {
            const finalValue = value && String(value).trim() ? value : '-';
            return `
                <div class="record-field">
                    <span class="record-field-label">${label}</span>
                    <span class="record-field-value${finalValue === '-' ? ' is-empty' : ''}${valueClass ? ` ${valueClass}` : ''}">${isHtml ? finalValue : finalValue}</span>
                </div>
            `;
        }).join('');
    }

    function createRecordCard({
        accent = 'var(--primary)',
        eyebrow = '',
        title = '-',
        subtitle = '',
        badges = [],
        fields = [],
        footer = ''
    }) {
        const card = document.createElement('div');
        card.className = 'record-card';
        card.style.setProperty('--record-accent', accent);
        card.innerHTML = `
            <div class="record-card-top">
                <div class="record-card-eyebrow">${eyebrow || '&nbsp;'}</div>
                <div class="record-card-badges">${badges.filter(Boolean).join('')}</div>
            </div>
            <div class="record-card-heading">
                <h3 class="record-card-title">${title || '-'}</h3>
                ${subtitle ? `<p class="record-card-subtitle">${subtitle}</p>` : ''}
            </div>
            <div class="record-card-fields">
                ${buildFields(fields)}
            </div>
            ${footer ? `<div class="record-card-footer">${footer}</div>` : ''}
        `;
        return card;
    }

    function normalizeSearchText(...values) {
        return values
            .map((value) => strVal(value).toLowerCase().trim())
            .filter(Boolean)
            .join(' ');
    }

    function toDateStamp(value) {
        if (!value) return 0;
        const stamp = new Date(value).getTime();
        return Number.isFinite(stamp) ? stamp : 0;
    }

    function compareText(a, b) {
        return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base', numeric: true });
    }

    function normalizeStatusText(value) {
        return strVal(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .trim();
    }

    function formatOptionLabel(value) {
        const raw = strVal(value).trim();
        if (!raw) return '';
        if (POLIZA_FILTER_LABEL_MAP[raw]) return POLIZA_FILTER_LABEL_MAP[raw];
        return raw
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((word) => (/^[A-Z0-9]{1,3}$/.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
            .join(' ');
    }

    function derivePolizaFilterValues(record = {}) {
        const estadoRaw = displayVal(strVal(record['ESTADO DE LA POLIZA']) || strVal(record['ETIQUETA_POLIZA']), 'SIN ESTADO');
        const estado = normalizeStatusText(estadoRaw);
        const venceDias = daysUntilDate(record['FECHA VENCIMIENTO DE LA POLIZA']);
        const values = [];

        if (estado.includes('ALTA') || estado.includes('ACTIV')) values.push('activas');
        if (estado.includes('ANUL') || estado.includes('BAJA')) values.push('anuladas');
        if (estado.includes('TRAM')) values.push('en_tramite');
        if (estado.includes('SIN VIG')) values.push('sin_vigencia');
        if (estado.includes('SIN POL')) values.push('sin_poliza');

        if (estado.includes('VENCE HOY')) {
            values.push('vence_hoy');
        } else if (estado.includes('VENCE EN 1 DIA')) {
            values.push('vence_1_dia');
        } else if (estado.includes('FALTA MENOS DE 7 DIAS')) {
            values.push('falta_menos_7');
        } else if (estado.includes('VENCE EN 7 DIAS')) {
            values.push('vence_7');
        } else if (estado.includes('FALTA MENOS DE 2 SEMANAS')) {
            values.push('falta_menos_2_semanas');
        } else if (estado.includes('MENOS DE 30 DIAS PARA VENCER')) {
            values.push('menos_30');
        } else if (estado.includes('VENCE EN 30 DIAS')) {
            values.push('vence_30');
        } else if (typeof venceDias === 'number' && venceDias >= 0) {
            if (venceDias === 0) values.push('vence_hoy');
            else if (venceDias === 1) values.push('vence_1_dia');
            else if (venceDias >= 2 && venceDias <= 6) values.push('falta_menos_7');
            else if (venceDias === 7) values.push('vence_7');
            else if (venceDias >= 8 && venceDias <= 13) values.push('falta_menos_2_semanas');
            else if (venceDias >= 14 && venceDias <= 29) values.push('menos_30');
            else if (venceDias === 30) values.push('vence_30');
        }

        return [...new Set(values)];
    }

    function countPolizaNotifications(polizas = []) {
        const counts = Object.fromEntries(POLIZA_FILTER_DEFINITIONS.map((def) => [def.value, 0]));
        polizas.forEach((poliza) => {
            derivePolizaFilterValues(poliza).forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
            });
        });
        return counts;
    }

    function buildSelectOptions(items, key) {
        return Array.from(new Set(
            items
                .map((item) => strVal(item[key]).trim())
                .filter(Boolean)
        ))
        .sort((a, b) => compareText(a, b))
        .map((value) => ({ value, label: formatOptionLabel(value) }));
    }

    function mountCollectionUI({
        pane,
        summaryText,
        searchPlaceholder,
        items,
        filterLabel = 'Filtrar',
        filterOptions = [],
        defaultSort,
        sortOptions,
        sortFn,
        controllerKey = '',
        emptyFilteredMessage = 'No hay resultados con esos filtros.'
    }) {
        pane.innerHTML = '';

        const hdr = document.createElement('p');
        hdr.className = 'section-intro';
        hdr.textContent = summaryText;
        pane.appendChild(hdr);

        const tools = document.createElement('div');
        tools.className = 'list-tools';
        tools.innerHTML = `
            <div class="list-tools-group list-tools-group-grow">
                <label class="list-tools-label" for="${pane.id}-search">Buscar</label>
                <input id="${pane.id}-search" class="list-tools-input" type="search" placeholder="${searchPlaceholder}">
            </div>
            <div class="list-tools-group">
                <label class="list-tools-label" for="${pane.id}-filter">${filterLabel}</label>
                <select id="${pane.id}-filter" class="list-tools-select">
                    <option value="">Todos</option>
                    ${filterOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
                </select>
            </div>
            <div class="list-tools-group">
                <label class="list-tools-label" for="${pane.id}-sort">Orden</label>
                <select id="${pane.id}-sort" class="list-tools-select">
                    ${sortOptions.map((option) => `<option value="${option.value}" ${option.value === defaultSort ? 'selected' : ''}>${option.label}</option>`).join('')}
                </select>
            </div>
            <div class="list-tools-actions">
                <button type="button" class="list-tools-reset" id="${pane.id}-reset">Ver todo</button>
                <div class="list-tools-count" id="${pane.id}-count"></div>
            </div>
        `;
        pane.appendChild(tools);

        const searchInput = tools.querySelector(`#${pane.id}-search`);
        const filterSelect = tools.querySelector(`#${pane.id}-filter`);
        const sortSelect = tools.querySelector(`#${pane.id}-sort`);
        const countEl = tools.querySelector(`#${pane.id}-count`);
        const resetBtn = tools.querySelector(`#${pane.id}-reset`);

        const host = document.createElement('div');
        host.className = 'cards-host';
        pane.appendChild(host);

        function renderFilteredItems() {
            const query = strVal(searchInput.value).toLowerCase().trim();
            const filterValue = filterSelect.value;
            const sortValue = sortSelect.value;

            let filtered = items.filter((item) => {
                if (query && !item.searchText.includes(query)) return false;
                if (filterValue) {
                    const values = Array.isArray(item.filterValues)
                        ? item.filterValues
                        : [item.filterValue].filter(Boolean);
                    if (!values.includes(filterValue)) return false;
                }
                return true;
            });

            filtered = [...filtered].sort((a, b) => sortFn(a, b, sortValue));
            countEl.textContent = `Mostrando ${filtered.length} de ${items.length}`;
            resetBtn.classList.toggle('is-active', Boolean(query || filterValue || sortValue !== defaultSort));

            host.replaceChildren();
            if (!filtered.length) {
                host.appendChild(emptyState(emptyFilteredMessage));
                return;
            }

            filtered.forEach((item) => host.appendChild(item.render()));
        }

        searchInput.addEventListener('input', renderFilteredItems);
        filterSelect.addEventListener('change', renderFilteredItems);
        sortSelect.addEventListener('change', renderFilteredItems);
        resetBtn.addEventListener('click', () => {
            searchInput.value = '';
            filterSelect.value = '';
            sortSelect.value = defaultSort;
            renderFilteredItems();
        });

        const controller = {
            setState(nextState = {}) {
                if (Object.prototype.hasOwnProperty.call(nextState, 'search')) searchInput.value = nextState.search || '';
                if (Object.prototype.hasOwnProperty.call(nextState, 'filter')) filterSelect.value = nextState.filter || '';
                if (Object.prototype.hasOwnProperty.call(nextState, 'sort')) sortSelect.value = nextState.sort || defaultSort;
                renderFilteredItems();
            },
            getState() {
                return {
                    search: searchInput.value,
                    filter: filterSelect.value,
                    sort: sortSelect.value
                };
            }
        };

        if (controllerKey) {
            appState.collectionControllers[controllerKey] = controller;
        }

        renderFilteredItems();
        return controller;
    }

    function resolvedAtendido(rec) {
        return (
            strVal(rec?.['ATENDIDO X']) ||
            strVal(rec?.['ATENDIDO X (from CLIENTES)']) ||
            strVal(rec?.['Atendido por']) ||
            strVal(rec?.['ATENDIDO POR']) ||
            ''
        );
    }

    function resolvedOficina(rec) {
        return (
            strVal(rec?.['OFICINAS']) ||
            strVal(rec?.['OFICINA']) ||
            strVal(rec?.['Oficina']) ||
            strVal(rec?.['OFICINAS (from CLIENTES)']) ||
            ''
        );
    }

    // Clase CSS de badge según texto — mapeo exacto al sistema del backend
    function badgeClass(text) {
        if (!text) return 'badge-gray';
        const s = strVal(text).toUpperCase().trim();
        // Verde
        if (/\bALTA$|\bALTAS\b|ACTIV|NO CULPABLE|POLIZA ACTIVADA|INCENDIO PARCIAL|ALTA PRODUCTO|EST[AÁ] CUBIERTO|RESUELVE/.test(s)) return 'badge-green';
        // Rojo
        if (/ANULD|ANULAC|BAJA|CON LESIONES|CULPABLE|ROBO TOTAL/.test(s)) return 'badge-red';
        // Amarillo
        if (/TRAMITE|PROCESO|ASESORADO|PENDIENTE|VER TENGO DUDAS|NO APLICA|ESPERA|ENDOSO|COBRANZA/.test(s)) return 'badge-yellow';
        // Naranja
        if (/VENCE|VTO|30 DI|7 DI|DERIVADO|ABOGADO|IMPRESIÓN|RETIRO|ENVIADA/.test(s)) return 'badge-orange';
        // Morado
        if (/INCENDIO TOTAL|SINIESTRO/.test(s)) return 'badge-purple';
        // Azul/celeste
        if (/SIN LESIONES|CONSULTA|COTIZACI|DENUNCIA/.test(s)) return 'badge-blue';
        // Gris
        if (/NUEVA|SIN VIG|SIN P[OÓ]LIZA|OTROS|NO REQUIERE|CRISTAL|PARABRISAS/.test(s)) return 'badge-gray';
        return 'badge-blue';
    }

    function makeBadge(text, cls) {
        if (!text) return '';
        const c = cls || badgeClass(text);
        return `<span class="badge ${c}">${strVal(text)}</span>`;
    }

    function buildStatBadge({ cls, count, label, preset = '', icon = '' }) {
        const interactive = preset ? ' stat-badge-actionable' : '';
        const actionAttr = preset ? ` data-poliza-preset="${preset}" role="button" tabindex="0"` : '';
        return `
            <div class="stat-badge ${cls}${interactive}"${actionAttr} title="${label}">
                <div class="stat-badge-head">
                    ${icon ? `<span class="stat-icon" aria-hidden="true"><i class="fas ${icon}"></i></span>` : ''}
                    <span class="stat-num">${count}</span>
                </div>
                <span class="stat-label">${label}</span>
            </div>
        `;
    }

    function openContactEditor(profile = {}) {
        const title = `
            <span class="modal-title-inline">
                <span class="modal-title-inline-icon" aria-hidden="true"><i class="fas fa-envelope"></i></span>
                <span>Editar contacto</span>
            </span>
        `;
        const body = `
            <form id="portal-contact-form" class="portal-edit-form">
                <div class="portal-form-grid">
                    <label class="portal-form-field">
                        <span class="portal-form-label">Email</span>
                        <input type="email" name="email" class="portal-form-input" value="${strVal(profile.email).replace(/"/g, '&quot;')}" placeholder="cliente@email.com">
                    </label>
                    <label class="portal-form-field">
                        <span class="portal-form-label">Teléfono</span>
                        <input type="text" name="telefono" class="portal-form-input" value="${strVal(profile.telefono).replace(/"/g, '&quot;')}" placeholder="3410000000">
                    </label>
                    <label class="portal-form-field portal-form-field-full">
                        <span class="portal-form-label">Dirección</span>
                        <textarea name="direccion" class="portal-form-textarea" rows="3" placeholder="Calle, altura, localidad">${strVal(profile.direccion)}</textarea>
                    </label>
                </div>
                <div id="portal-contact-feedback" class="portal-form-feedback hidden"></div>
                <div class="portal-form-actions">
                    <button type="button" id="portal-contact-cancel" class="portal-btn-secondary">Cancelar</button>
                    <button type="submit" id="portal-contact-save" class="action-btn">Guardar cambios</button>
                </div>
            </form>
        `;
        openModal(title, body);

        const form = document.getElementById('portal-contact-form');
        const cancelBtn = document.getElementById('portal-contact-cancel');
        const saveBtn = document.getElementById('portal-contact-save');
        const feedback = document.getElementById('portal-contact-feedback');

        cancelBtn.addEventListener('click', closeModal);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            feedback.className = 'portal-form-feedback hidden';
            const payload = {
                dni: userDNI,
                email: form.email.value.trim(),
                telefono: form.telefono.value.trim(),
                direccion: form.direccion.value.trim()
            };

            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';

            try {
                const res = await fetch(`${BACKEND_BASE}/contacto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const rawText = await res.text();
                let result = {};
                try {
                    result = rawText ? JSON.parse(rawText) : {};
                } catch {
                    result = { valid: false, message: rawText || 'Respuesta inválida del servidor.' };
                }
                if (!res.ok || !result.valid) {
                    throw new Error(result.message || result.detail || 'No se pudieron guardar los datos de contacto.');
                }

                appState.portalData = appState.portalData || {};
                appState.portalData.perfil = {
                    ...(appState.portalData.perfil || {}),
                    email: payload.email,
                    telefono: payload.telefono,
                    direccion: payload.direccion
                };
                renderPerfil(appState.portalData.perfil);

                feedback.className = 'portal-form-feedback is-success';
                feedback.textContent = 'Contacto actualizado correctamente.';
                setTimeout(() => closeModal(), 550);
            } catch (error) {
                feedback.className = 'portal-form-feedback is-error';
                feedback.textContent = error.message || 'Error guardando los datos de contacto.';
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar cambios';
            }
        });
    }

    function extractRichText(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            const joined = value
                .map((item) => extractRichText(item))
                .filter(Boolean)
                .join('\n')
                .trim();
            return joined;
        }
        if (typeof value === 'object') {
            const priorityKeys = ['value', 'text', 'content', 'label', 'name', 'description', 'markdown', 'html'];
            for (const key of priorityKeys) {
                if (key in value) {
                    const extracted = extractRichText(value[key]).trim();
                    if (extracted) return extracted;
                }
            }
            const nested = Object.values(value)
                .map((item) => extractRichText(item))
                .filter((item) => item && item.trim().length > 0);
            if (nested.length) return nested.join('\n').trim();
        }
        return '';
    }

    // Limpia el texto de análisis IA removiendo palabras técnicas internas
    function cleanIAText(raw) {
        if (!raw) return null;
        let normalized = extractRichText(raw);
        if (!normalized && typeof raw === 'string') normalized = raw;
        if (!normalized) return null;

        if (normalized.trim().startsWith('{') || normalized.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(normalized);
                const reparsed = extractRichText(parsed);
                if (reparsed) normalized = reparsed;
            } catch { /* usar como está */ }
        }

        normalized = normalized
            .replace(/\b(state|generate|valve|value)\b/gi, '')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const invalidTokens = new Set([
            'error',
            'null',
            'undefined',
            '[object object]',
            '{}',
            '[]',
            '-',
            'n/a'
        ]);
        const normalizedToken = normalized.toLowerCase();
        if (invalidTokens.has(normalizedToken)) return null;
        if (!/[a-z0-9áéíóúñ]/i.test(normalized)) return null;

        return normalized.length > 2 ? normalized : null;
    }

    function resolveIAText(record = {}) {
        const candidates = [];
        const pushCandidate = (value) => {
            const cleaned = cleanIAText(value);
            if (cleaned) candidates.push(cleaned);
        };

        const directKeys = [
            'CULPABILIDAD IA',
            'CULPABILIDAD_IA',
            'Culpabilidad IA',
            'RESUMEN IA',
            'INFORME IA',
            'DICTAMEN IA',
            'PERITO IA',
            'ANALISIS IA',
            'ANÁLISIS IA',
            'IA'
        ];
        directKeys.forEach((key) => {
            if (record && Object.prototype.hasOwnProperty.call(record, key)) {
                pushCandidate(record[key]);
            }
        });

        const normalizedTargets = [
            'culpabilidadia',
            'resumenia',
            'informeia',
            'dictamenia',
            'peritoia',
            'analisisia'
        ];

        for (const [key, value] of Object.entries(record || {})) {
            const normalizedKey = String(key)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
            if (!normalizedTargets.some((target) => normalizedKey.includes(target))) continue;
            pushCandidate(value);
        }

        if (!candidates.length) return null;
        candidates.sort((a, b) => b.length - a.length);
        return candidates[0] || null;
    }

    function summarizeIAText(text, maxLength = 180) {
        const clean = strVal(text).replace(/\s+/g, ' ').trim();
        if (!clean) return '';
        if (clean.length <= maxLength) return clean;
        return `${clean.slice(0, maxLength).trimEnd()}...`;
    }

    function resolveClientCompany(record, linkedPoliza = null) {
        return displayVal(
            getFirstFieldValue(linkedPoliza || {}, [
                'COMPANIA_RESOLVED',
                'NOMBRE (from COMPANIA LINK)',
                'COMPANIA'
            ]) ||
            getFirstFieldValue(record, [
                'COMPANIA_RESOLVED',
                'NOMBRE (from COMPANIA LINK)',
                'COMPANIA'
            ])
        );
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatAIParagraph(text) {
        return escapeHTML(text).replace(/\n/g, '<br>');
    }

    function buildAIAccordion(iaText, heading = 'Resumen del Perito IA de Siniestro') {
        if (!iaText) return '';

        const normalized = String(iaText)
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const paragraphs = normalized
            .split(/\n\s*\n/)
            .map((chunk) => chunk.trim())
            .filter(Boolean);

        const contentHTML = paragraphs.length
            ? paragraphs.map((paragraph) => `<div class="ai-accordion-paragraph">${formatAIParagraph(paragraph)}</div>`).join('')
            : `<div class="ai-accordion-paragraph">${formatAIParagraph(normalized)}</div>`;

        return `
            <details class="analyzer-details ai-accordion-item">
                <summary class="analyzer-label ai-accordion-summary">
                    <span class="ai-accordion-title">${heading}</span>
                    <span class="analyzer-toggle-icon">▼</span>
                </summary>
                <div class="analyzer-block ai-accordion-content">
                    ${contentHTML}
                </div>
            </details>
        `;
    }

    function emptyState(msg) {
        const d = document.createElement('div');
        d.className = 'empty-state';
        d.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg>
            <p>${msg}</p>`;
        return d;
    }

    // ========================
    // PERFIL
    // Imagen ref:
    //   - 2 cards lado a lado: "Datos Personales" (NOMBRE/DNI/FECHA DE ALTA) | "Contacto" (EMAIL/TELEFONO/DIRECCIÓN)
    //   - Strip inferior: Total / Activas / Anuladas / En Trámite / Sin Vigencia / Sin Póliza / Vence 30 días / Vence 7 días
    // ========================
    function renderPerfil(perfil) {
        const pane = document.getElementById('tab-perfil');
        pane.innerHTML = '';
        const p = perfil || {};
        const polizas = appState.portalData?.polizas || [];
        const derivedCounts = countPolizaNotifications(polizas);
        const total = polizas.length || p.total_polizas || 0;
        const statCards = [
            { cls: 'stat-total', count: total, label: 'Total', preset: 'all', icon: 'fa-chart-column' },
            { cls: 'stat-activa', count: derivedCounts.activas || p.polizas_activas || 0, label: 'Activas', preset: 'activas', icon: 'fa-circle-check' },
            { cls: 'stat-anulada', count: derivedCounts.anuladas || p.polizas_anuladas || 0, label: 'Anuladas', preset: 'anuladas', icon: 'fa-circle-xmark' },
            { cls: 'stat-tramite', count: derivedCounts.en_tramite || p.polizas_tramite || 0, label: 'En trámite', preset: 'tramite', icon: 'fa-hourglass-half' },
            { cls: 'stat-neutral', count: p.sin_poliza || 0, label: 'Sin póliza', preset: 'sin_poliza', icon: 'fa-ban' },
            { cls: 'stat-7dias', count: derivedCounts.sin_vigencia || p.polizas_sin_vigencia || 0, label: 'Sin vigencia', preset: 'sin_vigencia', icon: 'fa-circle-exclamation' },
            { cls: 'stat-alert-hot', count: derivedCounts.vence_hoy || 0, label: 'Vence hoy', preset: 'vence_hoy', icon: 'fa-bell' },
            { cls: 'stat-alert-urgent', count: derivedCounts.vence_1_dia || 0, label: 'Vence en 1 día', preset: 'vence_1_dia', icon: 'fa-calendar-day' },
            { cls: 'stat-semana', count: derivedCounts.falta_menos_7 || 0, label: 'Falta menos de 7 días', preset: 'falta_menos_7', icon: 'fa-calendar-week' },
            { cls: 'stat-semana', count: derivedCounts.vence_7 || p.vence_7dias || 0, label: 'Vence en 7 días', preset: 'vence_7', icon: 'fa-clock' },
            { cls: 'stat-mes', count: derivedCounts.falta_menos_2_semanas || 0, label: 'Falta menos de 2 semanas', preset: 'falta_menos_2_semanas', icon: 'fa-hourglass-start' },
            { cls: 'stat-mes', count: derivedCounts.menos_30 || 0, label: 'Menos de 30 días para vencer', preset: 'menos_30', icon: 'fa-calendar-minus' },
            { cls: 'stat-30dias', count: derivedCounts.vence_30 || p.vence_30dias || 0, label: 'Vence en 30 días', preset: 'vence_30', icon: 'fa-calendar-days' }
        ];

        const layout = document.createElement('div');
        layout.className = 'perfil-layout';

        // Strip de estadísticas — exactamente como el backend de Airtable
        const strip = document.createElement('div');
        strip.className = 'stats-strip';
        strip.innerHTML = statCards.map((card) => buildStatBadge(card)).join('');
        layout.appendChild(strip);

        strip.querySelectorAll('[data-poliza-preset]').forEach((badge) => {
            const openPreset = () => openPolizaPreset(badge.dataset.polizaPreset || '');
            badge.addEventListener('click', openPreset);
            badge.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPreset();
                }
            });
        });

        // Tarjeta: Datos Personales — NOMBRE, DNI, FECHA DE ALTA
        const cardLeft = document.createElement('div');
        cardLeft.className = 'data-card';
        cardLeft.innerHTML = `
            <div class="card-header"><div><p class="card-title">👤 Datos Personales</p></div></div>
            <div class="card-divider"></div>
            <div class="card-body">
                <div class="card-row"><span class="row-label">NOMBRE</span><span class="row-val">${(strVal(p.nombres) + ' ' + strVal(p.apellido)).trim() || '-'}</span></div>
                <div class="card-row"><span class="row-label">DNI</span><span class="row-val">${displayVal(p.dni)}</span></div>
                <div class="card-row"><span class="row-label">FECHA DE ALTA</span><span class="row-val">${formatDate(p.fecha_alta)}</span></div>
            </div>`;
        layout.appendChild(cardLeft);

        // Tarjeta: Contacto — EMAIL, TELÉFONO, DIRECCIÓN
        const cardRight = document.createElement('div');
        cardRight.className = 'data-card';
        cardRight.innerHTML = `
            <div class="card-header">
                <div class="card-header-main">
                    <span class="card-title-icon card-title-icon-contact" aria-hidden="true"><i class="fas fa-envelope"></i></span>
                    <p class="card-title">Contacto</p>
                </div>
                <button type="button" class="card-edit-btn" aria-label="Editar contacto">Editar</button>
            </div>
            <div class="card-divider"></div>
            <div class="card-body">
                <div class="card-row"><span class="row-label">EMAIL</span><span class="row-val">${displayVal(p.email)}</span></div>
                <div class="card-row"><span class="row-label">TELÉFONO</span><span class="row-val">${displayVal(p.telefono)}</span></div>
                <div class="card-row"><span class="row-label">DIRECCIÓN</span><span class="row-val">${displayVal(p.direccion)}</span></div>
            </div>`;
        cardRight.querySelector('.card-edit-btn').addEventListener('click', () => openContactEditor(p));
        layout.appendChild(cardRight);

        pane.appendChild(layout);
    }

    // ========================
    // PÓLIZAS
    // ========================
    function renderPolizas(polizas) {
        const pane = document.getElementById('tab-polizas');
        pane.innerHTML = '';
        pane.classList.add('list-mode');
        if (!polizas || !polizas.length) { pane.appendChild(emptyState('No hay pólizas registradas.')); return; }
        const polizaFilterOptions = POLIZA_FILTER_DEFINITIONS.map((definition) => ({
            value: definition.value,
            label: definition.label
        }));

        const items = polizas.map((p) => {
            const estado   = displayVal(strVal(p['ESTADO DE LA POLIZA']) || strVal(p['ETIQUETA_POLIZA']), 'SIN ESTADO');
            const patente  = displayVal(p['PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES)']);
            const marca    = strVal(p['MARCA DEL VEHICULO']);
            const modelo   = strVal(p['MODELO DEL VEHICULO']);
            const vehiculo = displayVal([marca, modelo].filter(Boolean).join(' '));
            const compania = resolveCompany(p);
            const tipoVehiculo = resolveDisplayProduct(p);
            const productIcon = resolveProductIcon(p);
            const cobert   = displayVal(p['COBERTURA']);
            const vence    = displayVal(p['FECHA VENCIMIENTO DE LA POLIZA']);
            const venceStamp = toDateStamp(p['FECHA VENCIMIENTO DE LA POLIZA']);
            const nPoliza  = displayVal(strVal(p['N° DE POLIZA']) || strVal(p['ETIQUETA_POLIZA']), 'Sin número');
            const vida = displayVal(p['VIDA'], 'No');
            const auxilio = displayVal(getFirstFieldValue(p, ['AUXILIO', 'AUXILIO 24', 'AUXILIOS']), 'No');
            const filterValues = derivePolizaFilterValues(p);
            
            // Extract Documentacion array from Airtable (list of attachments)
            const docArray = p['DOCUMENTACION'];
            let docButtonHTML = '';
            if (Array.isArray(docArray) && docArray.length > 0) {
                // Airtable objects hold URL in the .url property
                const docUrl = docArray[0].url;
                if (docUrl) {
                    docButtonHTML = `
                        <a href="${docUrl}" target="_blank" class="btn-download-doc" title="Descargar PDF">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            PDF póliza
                        </a>`;
                }
            }

            // Color borde izquierdo según estado
            let borderColor = 'var(--primary)';
            if (filterValues.includes('vence_hoy')) borderColor = '#ff375f';
            else if (filterValues.includes('vence_1_dia')) borderColor = '#ff5d1f';
            else if (filterValues.includes('falta_menos_7') || filterValues.includes('vence_7')) borderColor = '#ff2d78';
            else if (filterValues.includes('falta_menos_2_semanas') || filterValues.includes('menos_30') || filterValues.includes('vence_30')) borderColor = 'var(--color-warning)';
            else if (filterValues.includes('activas')) borderColor = 'var(--color-activa)';
            else if (filterValues.includes('anuladas')) borderColor = 'var(--color-anulada)';
            else if (filterValues.includes('en_tramite')) borderColor = 'var(--color-tramite)';
            else if (filterValues.includes('sin_vigencia')) borderColor = 'var(--color-employee)';
            else if (filterValues.includes('sin_poliza')) borderColor = 'rgba(185, 173, 255, 0.65)';

            return {
                searchText: normalizeSearchText(nPoliza, patente, vehiculo, cobert, estado),
                filterValue: filterValues[0] || '',
                filterValues,
                sortDate: venceStamp,
                sortText: nPoliza,
                render: () => {
                    const row = createRecordCard({
                        accent: borderColor,
                        eyebrow: compania,
                        title: `Póliza ${nPoliza}`,
                        subtitle: [tipoVehiculo ? `${productIcon} ${tipoVehiculo}` : '', vehiculo !== '-' ? vehiculo : '']
                            .filter(Boolean)
                            .join(' · '),
                        badges: [
                            makeBadge(estado),
                            cobert !== '-' ? makeBadge(cobert, 'badge-orange') : ''
                        ],
                        fields: [
                            { label: 'Compañía', value: compania },
                            { label: 'Patente', value: patente },
                            { label: 'Vida', value: vida },
                            { label: 'Auxilio', value: auxilio },
                            { label: 'Cobertura', value: cobert },
                            { label: 'Vence', value: vence }
                        ],
                        footer: `
                            <div class="record-card-footer-row">
                                <span class="record-card-hint">Toque la tarjeta para ver el detalle completo</span>
                                ${docButtonHTML || ''}
                            </div>
                        `
                    });

                    const modal = buildPolizaDetailModal(p);
                    return makeInteractiveCard(row, () => openModal(modal.title, modal.body));
                }
            };
        });

        mountCollectionUI({
            pane,
            controllerKey: 'polizas',
            summaryText: `📄 ${polizas.length} póliza${polizas.length !== 1 ? 's' : ''}`,
            searchPlaceholder: 'Buscar por póliza, patente, vehículo o cobertura',
            items,
            filterLabel: 'Condición',
            filterOptions: polizaFilterOptions,
            defaultSort: 'vence_asc',
            sortOptions: [
                { value: 'vence_asc', label: 'Vencimiento cercano' },
                { value: 'vence_desc', label: 'Vencimiento lejano' },
                { value: 'numero_asc', label: 'N° de póliza' }
            ],
            sortFn: (a, b, sortValue) => {
                if (sortValue === 'vence_desc') return (b.sortDate || 0) - (a.sortDate || 0);
                if (sortValue === 'numero_asc') return compareText(a.sortText, b.sortText);
                const aDate = a.sortDate || Number.MAX_SAFE_INTEGER;
                const bDate = b.sortDate || Number.MAX_SAFE_INTEGER;
                return aDate - bDate;
            },
            emptyFilteredMessage: 'No hay pólizas que coincidan con esa búsqueda.'
        });

        const controller = getCollectionController('polizas');
        if (controller) {
            controller.setState({
                filter: appState.pendingPolizaFilter,
                sort: 'vence_asc'
            });
            appState.pendingPolizaFilter = '';
        }
    }

    // ========================
    // GESTIONES - LINEAL LIST
    // ========================
    function renderGestiones(gestiones, allPolizas = []) {
        const pane = document.getElementById('tab-gestiones');
        pane.innerHTML = '';
        pane.classList.add('list-mode');
        if (!gestiones || !gestiones.length) { pane.appendChild(emptyState('No hay gestiones registradas.')); return; }

        const items = gestiones.map((g) => {
            // 1. Vincular Póliza para obtener datos faltantes (Lookup/Rollup Cross-table)
            const idsPoliza = g['POLIZAS'] || [];
            const polId = Array.isArray(idsPoliza) ? idsPoliza[0] : idsPoliza;
            
            // Buscar la póliza en el set de datos ya cargado
            const polRecord = allPolizas.find(p => p.RECORD_ID === polId) || {};
            
            // Extracción de datos con fallback agresivo
            const idGestion   = getFirstFieldValue(g, ['ID_UNICO_GESTION', 'ID-GESTION-UNICO']);
            const fechaCarga  = strVal(g['FECHA DE CREACION']);
            const motivo      = strVal(g['MOTIVOS DE LA CONSULTA']);
            const atendido    = displayVal(resolvedAtendido(g));
            
            // Datos del Seguro (Buscando en Gestion y luego en Poliza)
            const nPolizaValue = strVal(g['N° DE POLIZA']) || strVal(polRecord['N° DE POLIZA']) || strVal(polRecord['ETIQUETA_POLIZA']);
            const nPoliza     = displayVal(nPolizaValue || '');
            const patenteValue = getFirstFieldValue(g, GESTION_PATENTE_KEYS) || getFirstFieldValue(polRecord, POLIZA_PATENTE_KEYS);
            const patente     = displayVal(patenteValue);
            
            const compania    = resolveCompany(g, polRecord);
            const producto    = resolveProduct(g, polRecord);
            
            const oficina     = displayVal(resolvedOficina(g));
            const detallarOtr = displayVal(g['DETALLAR OTROS']);
            const formaPago   = displayVal(g['FORMA DE PAGOS']);
            const vida        = displayVal(g['VIDA'], 'NO');
            const auxilio     = displayVal(g['AUXILIOS'], 'NO');
            const impPoliza   = strVal(g['IMPORTE']) ? `$${strVal(g['IMPORTE'])}` : '-';
            const impVida     = strVal(g['IMPORTE VIDA']) ? `$${strVal(g['IMPORTE VIDA'])}` : '-';
            const impAux      = strVal(g['IMPORTE AUX 24']) ? `$${strVal(g['IMPORTE AUX 24'])}` : '-';

            const render = () => {
                const row = createRecordCard({
                    accent: 'var(--primary-light)',
                    eyebrow: idGestion ? `🪪 Gestión ${idGestion}` : '🪪 Gestión',
                    title: motivo || '-',
                    subtitle: `Póliza ${nPoliza}`,
                    badges: [
                        producto !== '-' ? makeBadge(producto, 'badge-blue') : '',
                        oficina !== '-' ? makeBadge(oficina, 'badge-gray') : ''
                    ],
                    fields: [
                        { label: 'Fecha de carga', value: formatDate(fechaCarga) },
                        { label: 'Patente', value: displayVal(patente) },
                        { label: 'Compañía', value: compania },
                        { label: 'Atendido por', value: atendido }
                    ]
                });

                row.addEventListener('click', () => {
                    const title = `🪪 Gestión ${idGestion || ''}`;
                    const body = `
                    <div class="modal-fixed-grid">
                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Información de Gestión</h3>
                            <div class="modal-detail-row"><span class="modal-detail-label">ID Gestión</span><span class="modal-detail-value">${idGestion || '-'}</span></div>
                            <div class="modal-detail-row"><span class="modal-detail-label">Fecha de Carga</span><span class="modal-detail-value">${formatDateTime(fechaCarga)}</span></div>
                            <div class="modal-detail-row"><span class="modal-detail-label">Oficina</span><span class="modal-detail-value">${oficina}</span></div>
                            <div class="modal-detail-row"><span class="modal-detail-label">Atendido por</span><span class="modal-detail-value" style="color:var(--primary-light);">${atendido || '-'}</span></div>
                        </section>

                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Datos del Seguro</h3>
                            <div class="modal-detail-row"><span class="modal-detail-label">N° de Póliza</span><span class="modal-detail-value">${nPoliza}</span></div>
                            <div class="modal-detail-row"><span class="modal-detail-label">Patente</span><span class="modal-detail-value">${patente}</span></div>
                            <div class="modal-detail-row"><span class="modal-detail-label">Compañía</span><span class="modal-detail-value">${compania}</span></div>
                            <div class="modal-detail-row"><span class="modal-detail-label">Tipo de Producto</span><span class="modal-detail-value">${makeBadge(producto, 'badge-blue')}</span></div>
                        </section>

                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Consulta</h3>
                            <div class="modal-detail-row"><span class="modal-detail-label">Motivo de Consulta</span><span class="modal-detail-value">${makeBadge(motivo, 'badge-orange')}</span></div>
                            <div class="modal-detail-row"><span class="modal-detail-label">Detallar Otros</span><span class="modal-detail-value" style="font-style:italic; color:var(--white-70);">${detallarOtr}</span></div>
                        </section>

                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Información Financiera</h3>
                            <div class="modal-detail-row"><span class="modal-detail-label">Forma de Pago</span><span class="modal-detail-value">${formaPago}</span></div>
                            <div class="modal-grid-3">
                                <div class="mini-card"><small>Importe Póliza</small><strong>${impPoliza}</strong></div>
                                <div class="mini-card"><small>Importe Vida</small><strong>${impVida}</strong></div>
                                <div class="mini-card"><small>Importe Auxilio</small><strong>${impAux}</strong></div>
                            </div>
                            <div class="modal-grid-2" style="margin-top:10px;">
                                <div class="mini-badge-row"><span>Vida</span> ${makeBadge(vida, vida.toUpperCase().includes('SI') ? 'badge-green' : 'badge-gray')}</div>
                                <div class="mini-badge-row"><span>Auxilio</span> ${makeBadge(auxilio, auxilio.toUpperCase().includes('SI') ? 'badge-green' : 'badge-gray')}</div>
                            </div>
                        </section>
                    </div>
                `;
                    openModal(title, body);
                });

                return row;
            };

            return {
                searchText: normalizeSearchText(idGestion, motivo, nPoliza, patente, compania, oficina, atendido),
                filterValue: motivo || 'Sin motivo',
                sortDate: toDateStamp(fechaCarga),
                sortText: idGestion || motivo,
                render
            };
        });

        mountCollectionUI({
            pane,
            summaryText: `📁 ${gestiones.length} gestión${gestiones.length !== 1 ? 'es' : ''}`,
            searchPlaceholder: 'Buscar por ID, motivo, póliza, patente o compañía',
            items,
            filterLabel: 'Motivo',
            filterOptions: buildSelectOptions(items, 'filterValue'),
            defaultSort: 'fecha_desc',
            sortOptions: [
                { value: 'fecha_desc', label: 'Más recientes' },
                { value: 'fecha_asc', label: 'Más antiguas' },
                { value: 'id_asc', label: 'ID / texto' }
            ],
            sortFn: (a, b, sortValue) => {
                if (sortValue === 'fecha_asc') return (a.sortDate || 0) - (b.sortDate || 0);
                if (sortValue === 'id_asc') return compareText(a.sortText, b.sortText);
                return (b.sortDate || 0) - (a.sortDate || 0);
            },
            emptyFilteredMessage: 'No hay gestiones que coincidan con ese filtro.'
        });
    }

    // ========================
    // ACCIDENTES
    // Imagen ref:
    //   - Header pequeño: "Siniestro"
    //   - Tipo badge (SIN LESIONES azul claro / CON LESIONES rojo) + Culpa badge (NO CULPABLE verde / CULPABLE rojo / VER TENGO DUDAS naranja)
    //   - Sección IA contraíble individual por tarjeta
    //   - Tratam badge + Resoluc badge
    //   - Campos inline: Patente | Vehículo | Cobertura | Fecha | Atendido por | Póliza
    // ========================
    function renderAccidentes(accidentes, allPolizas = []) {
        const pane = document.getElementById('tab-accidentes');
        pane.innerHTML = '';
        pane.classList.add('list-mode');
        if (!accidentes || !accidentes.length) { pane.appendChild(emptyState('No hay denuncias de accidente.')); return; }

        const polizaLookup = buildPolizaLookup(allPolizas);
        const items = accidentes.map((a) => {
            const idGestion = getFirstFieldValue(a, ['ID_GESTION_UNICO', 'ID-GESTION-UNICO', 'ID_UNICO_GESTION (from GESTIÓN GENERAL 2)', 'ID_UNICO_GESTION']);
            const numSiniestro = strVal(a['NUMERO DE SINIESTRO']);
            const tipo      = sanitizeUserFacingValue(
                strVal(a['ATASCAMIENTO - CHOQUE -DAÑO - OTRO']) ||
                strVal(a['CLASIFICACIÓN']) ||
                strVal(a['TIPO DE ATENCIÓN'])
            );
            let culpa       = strVal(a['CULPABILIDAD']);
            const tratam    = sanitizeUserFacingValue(strVal(a['TRATAMIENTO']) || strVal(a['Tratamiento']));
            const resoluc   = strVal(a['TIPO DE RESOLUCION']) || strVal(a['Elegir Resolucion ']);
            const marca      = strVal(a['MARCA DEL VEHICULO Compilación (de N° POLIZA)']) || strVal(a['MARCA DEL VEHICULO']);
            const modelo     = strVal(a['MODELO DEL VEHICULO']) || strVal(a['MODELO DEL  VEHICULO']);
            const vehiculo   = [marca, modelo].filter(Boolean).join(' ');
            const fecha     = getFirstFieldValue(a, ACCIDENTE_DATE_KEYS);
            const atendido  = resolvedAtendido(a);
            const iaText    = resolveIAText(a);

            if (!culpa && iaText) {
                const match = String(iaText).match(/CULPABILIDAD:\s*([^\n<]+)/i);
                if (match && match[1]) {
                    culpa = match[1].replace(/[*_>]/g, '').trim();
                }
            }

            const fallbackPoliza = resolveAccidentePolizaFallback(a, polizaLookup);
            const poliza    = resolvePolicyNumber(a, fallbackPoliza, ACCIDENTE_POLIZA_KEYS);
            const fallbackPatente = fallbackPoliza ? (
                strVal(fallbackPoliza['PATENTE DEL VEHICULO (Rollup)']) ||
                strVal(fallbackPoliza['PATENTE DEL VEHICULO (de GESTIÓN GENERAL) (from CLIENTES)']) ||
                strVal(fallbackPoliza['PATENTE DEL VEHICULO']) ||
                strVal(fallbackPoliza['PATENTE'])
            ) : '';
            const fallbackVehiculo = fallbackPoliza ? [strVal(fallbackPoliza['MARCA DEL VEHICULO']), strVal(fallbackPoliza['MODELO DEL VEHICULO'])].filter(Boolean).join(' ') : '';
            const patente   = getFirstFieldValue(a, ACCIDENTE_PATENTE_KEYS) || fallbackPatente;
            const coverageField = getFirstFieldValue(a, ACCIDENTE_COBERTURA_KEYS) || (fallbackPoliza ? displayVal(fallbackPoliza['COBERTURA']) : '');
            const vehicleLabel = getFirstFieldValue(a, ACCIDENTE_VEHICLE_KEYS);
            const vehicleFinal = vehicleLabel ? displayVal(vehicleLabel) : displayVal(vehiculo || fallbackVehiculo);
            const compania = resolveClientCompany(a, fallbackPoliza);
            // Colores específicos
            const tipoCls  = tipo && tipo.toUpperCase().includes('CON LESIONES') ? 'badge-red' : 'badge-blue';
            const culpaCls = !culpa ? '' :
                culpa.toUpperCase().includes('NO CULP') ? 'badge-green' :
                culpa.toUpperCase().includes('TENGO')   ? 'badge-yellow' : 'badge-red';
            const tipoChoque = tipo ? makeBadge(tipo, tipoCls) : '-';
            const culpaBadge = culpa ? makeBadge(culpa, culpaCls) : '-';
            const tratamientoBadge = tratam ? makeBadge(tratam, 'badge-yellow') : '-';
            const resolucionBadge = resoluc ? makeBadge(resoluc, 'badge-green') : 'Pendiente';

            const render = () => {
                const row = createRecordCard({
                    accent: culpaCls === 'badge-red' ? 'var(--color-anulada)' : 'var(--primary-light)',
                    eyebrow: idGestion ? `🚨 Gestión ${idGestion}` : (numSiniestro ? `🚨 Siniestro ${numSiniestro}` : '🚨 Accidente'),
                    title: 'Accidente',
                    subtitle: displayVal(vehicleFinal),
                    badges: [
                        tipo ? makeBadge(tipo, tipoCls) : '',
                        culpa ? makeBadge(culpa, culpaCls) : '',
                        resoluc ? makeBadge(resoluc, 'badge-green') : ''
                    ],
                    fields: [
                        { label: 'Fecha', value: formatDate(fecha) },
                        { label: 'Patente', value: displayVal(patente) },
                        { label: 'Cobertura', value: displayVal(coverageField) },
                        { label: 'Póliza', value: displayVal(poliza) },
                        { label: 'Atendido por', value: displayVal(atendido, 'Agente IA') }
                    ],
                    footer: `
                        <div class="record-card-footer-row">
                            <span class="record-card-hint">${iaText ? 'Toque la tarjeta para ver el dictamen completo del Perito IA' : 'Toque la tarjeta para ver el detalle del siniestro'}</span>
                        </div>
                    `
                });

                row.addEventListener('click', () => {
                    const title = `🚨 Accidente ${numSiniestro || ''}`;
                    const body = `
                    <div class="accident-modal-hero">
                        <div class="accident-modal-hero-main">
                            <span class="accident-modal-eyebrow">Siniestro del cliente</span>
                            <h3 class="accident-modal-title">${vehicleFinal}</h3>
                            <p class="accident-modal-subtitle">
                                ${[
                                    patente ? `Patente ${displayVal(patente)}` : '',
                                    poliza ? `Póliza ${displayVal(poliza)}` : '',
                                    compania !== '-' ? compania : ''
                                ].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                        <div class="accident-modal-hero-badges">
                            ${tipo ? makeBadge(tipo, tipoCls) : ''}
                            ${culpa ? makeBadge(culpa, culpaCls) : ''}
                            ${tratam ? makeBadge(tratam, 'badge-yellow') : ''}
                        </div>
                    </div>

                    <div class="modal-fixed-grid accident-modal-grid">
                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Lo más importante</h3>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Fecha del siniestro</span>
                                <span class="modal-detail-value">${formatDateTime(fecha)}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Vehículo involucrado</span>
                                <span class="modal-detail-value">${vehicleFinal}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Patente</span>
                                <span class="modal-detail-value">${displayVal(patente)}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Cobertura</span>
                                <span class="modal-detail-value">${displayVal(coverageField)}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Compañía</span>
                                <span class="modal-detail-value">${compania}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">N° de póliza</span>
                                <span class="modal-detail-value">${displayVal(poliza)}</span>
                            </div>
                        </section>

                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Estado del caso</h3>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Tipo de choque</span>
                                <span class="modal-detail-value">${tipoChoque}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Culpabilidad IA</span>
                                <span class="modal-detail-value">${culpaBadge}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Tratamiento actual</span>
                                <span class="modal-detail-value">${tratamientoBadge}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Resolución final</span>
                                <span class="modal-detail-value">${resolucionBadge}</span>
                            </div>
                        </section>
                    </div>

                    ${buildAIAccordion(
                        iaText || 'Todavía no hay un dictamen del Perito IA cargado para este siniestro.',
                        'RESUMEN DEL PERITO IA DE ACCIDENTES'
                    )}
                `;
                    openModal(title, body);
                });

                return row;
            };

            return {
                searchText: normalizeSearchText(idGestion, numSiniestro, vehicleFinal, patente, coverageField, poliza, tipo, culpa, resoluc, atendido),
                filterValue: resoluc || tratam || culpa || 'Sin estado',
                sortDate: toDateStamp(fecha),
                sortText: idGestion || numSiniestro,
                render
            };
        });

        mountCollectionUI({
            pane,
            summaryText: `🚗 ${accidentes.length} denuncia${accidentes.length !== 1 ? 's' : ''} de accidente`,
            searchPlaceholder: 'Buscar por ID, siniestro, patente, vehículo o póliza',
            items,
            filterLabel: 'Estado',
            filterOptions: buildSelectOptions(items, 'filterValue'),
            defaultSort: 'fecha_desc',
            sortOptions: [
                { value: 'fecha_desc', label: 'Más recientes' },
                { value: 'fecha_asc', label: 'Más antiguas' },
                { value: 'id_asc', label: 'ID / siniestro' }
            ],
            sortFn: (a, b, sortValue) => {
                if (sortValue === 'fecha_asc') return (a.sortDate || 0) - (b.sortDate || 0);
                if (sortValue === 'id_asc') return compareText(a.sortText, b.sortText);
                return (b.sortDate || 0) - (a.sortDate || 0);
            },
            emptyFilteredMessage: 'No hay accidentes que coincidan con ese criterio.'
        });
    }

    // ========================
    // ROBO OC
    // Imagen ref:
    //   - Header pequeño: "Siniestro" + N° de siniestro
    //   - Daño badges (CLASIFICACIÓN DEL DAÑO): PARABRISAS gris oscuro / ROBO 1 RUEDA gris oscuro / CRISTAL azul
    //   - Alcance badge (ALCANCE DE COBERTURA): ESTÁ CUBIERTO azul
    //   - Tratam badge (TIPO DE ATENCIÓN): ESTA SIENDO ASESORADO-EN PROCESO amarillo
    //   - Orden badge (ORDEN PEDIDA A CIA): SI verde
    //   - Verif badge (VERIFICACION DE ORDEN): ENVIADA AL ASEGURADO naranja
    //   - Campos inline: Patente | Vehículo | Cobertura | Fecha | Atendido por | Póliza
    // ========================
    function renderRoboOc(robos, allPolizas = []) {
        const pane = document.getElementById('tab-robo_oc');
        pane.innerHTML = '';
        pane.classList.add('list-mode');
        if (!robos || !robos.length) { pane.appendChild(emptyState('No hay denuncias de Robo OC.')); return; }

        const polizaLookup = buildPolizaLookup(allPolizas);
        const items = robos.map((r) => {
            const idGestion = getFirstFieldValue(r, ROBO_OC_ID_KEYS);
            const nSiniestro = strVal(r['NUMERO DE SINIESTRO ']) || strVal(r['NUMERO DE SINIESTRO']) || strVal(r['NUMERO']);
            const danyoRaw   = r['CLASIFICACIÓN DEL DAÑO'];
            const resoluc    = strVal(r['TIPO DE RESOLUCION']) || strVal(r['Resolución']);
            const tratam     = sanitizeUserFacingValue(strVal(r['TIPO DE ATENCIÓN']));
            const orden      = strVal(r['ORDEN PEDIDA A CIA']);
            const verif      = strVal(r['VERIFICACION DE ORDEN']);
            const fecha      = getFirstFieldValue(r, ['FECHA DEL SINIESTRO', 'FECHA DE CREACION']);
            const atendido   = resolvedAtendido(r);
            const linkedPoliza = findLinkedPoliza(r, polizaLookup);
            const patente    = getFirstFieldValue(r, ROBO_OC_PATENTE_KEYS) || getFirstFieldValue(linkedPoliza || {}, POLIZA_PATENTE_KEYS);
            const vehiculo   = resolveVehicleLabel(r, polizaLookup);
            const alcance    = getFirstFieldValue(r, ROBO_OC_COBERTURA_KEYS) || strVal(linkedPoliza?.['COBERTURA']);
            const poliza     = resolvePolicyNumber(r, linkedPoliza, ROBO_OC_POLIZA_KEYS);
            const compania   = resolveCompany(r, linkedPoliza);
            const producto   = resolveProduct(r, linkedPoliza);
            const oficina    = displayVal(resolvedOficina(r));
            const iaText     = resolveIAText(r);

            const danyos = Array.isArray(danyoRaw) ? danyoRaw : (danyoRaw ? [danyoRaw] : []);

            const render = () => {
                const row = createRecordCard({
                    accent: 'var(--primary-light)',
                    eyebrow: idGestion ? `🔍 Gestión ${idGestion}` : (nSiniestro ? `🔍 Siniestro ${nSiniestro}` : '🔍 Robo OC'),
                    title: 'Robo Parcial (OC)',
                    subtitle: displayVal(vehiculo),
                    badges: [
                        tratam ? makeBadge(tratam, 'badge-yellow') : '',
                        alcance ? makeBadge(alcance, 'badge-blue') : '',
                        resoluc ? makeBadge(resoluc, 'badge-green') : ''
                    ],
                    fields: [
                        { label: 'Fecha', value: formatDate(fecha) },
                        { label: 'Patente', value: displayVal(patente) },
                        { label: 'Cobertura', value: displayVal(alcance) },
                        { label: 'Póliza', value: displayVal(poliza) },
                        { label: 'Atendido por', value: displayVal(atendido, 'Agente IA') }
                    ]
                });

                row.addEventListener('click', () => {
                    const title = `🔍 Robo OC ${idGestion || nSiniestro || ''}`;
                    const body = `
                    <div class="poliza-modal-hero">
                        <div style="flex:1;">
                            <div class="card-eyebrow">
                                Siniestro del cliente
                                <span class="eyebrow-badges" style="float:right;">
                                    ${alcance ? makeBadge(alcance, 'badge-blue') : ''}
                                    ${tratam ? makeBadge(tratam, 'badge-yellow') : ''}
                                </span>
                            </div>
                            <h2 class="poliza-hero-title">${displayVal(vehiculo)}</h2>
                            <div class="poliza-hero-subtitle">Patente ${displayVal(patente)} &bull; Póliza ${displayVal(poliza)} &bull; ${compania}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="margin-bottom:8px;">${resoluc ? makeBadge(resoluc, 'badge-green') : ''}</div>
                        </div>
                    </div>

                    <div class="modal-fixed-grid accident-modal-grid">
                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Lo más importante</h3>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Fecha del siniestro</span>
                                <span class="modal-detail-value">${formatDateTime(fecha)}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Producto</span>
                                <span class="modal-detail-value">${producto}</span>
                            </div>
                            ${danyos.length ? `
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Elementos Afectados</span>
                                <span class="modal-detail-value">${danyos.map(d => makeBadge(d, 'badge-gray')).join(' ')}</span>
                            </div>` : ''}
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Identificador Base</span>
                                <span class="modal-detail-value">${displayVal(idGestion || nSiniestro)}</span>
                            </div>
                        </section>

                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Progreso de Gestión</h3>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Orden Pedida a Cía</span>
                                <span class="modal-detail-value">${orden ? makeBadge(orden, 'badge-green') : '-'}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Verificación</span>
                                <span class="modal-detail-value">${verif ? makeBadge(verif, 'badge-orange') : '-'}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Oficina</span>
                                <span class="modal-detail-value">${oficina}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Atendido por</span>
                                <span class="modal-detail-value" style="color:var(--primary-light);">${atendido || '-'}</span>
                            </div>
                        </section>
                    </div>

                    ${buildAIAccordion(
                        iaText || 'Todavía no hay un dictamen del Perito IA cargado para este siniestro.',
                        'RESUMEN DEL PERITO IA DE ROBO OC'
                    )}
                `;
                    openModal(title, body);
                });

                return row;
            };

            return {
                searchText: normalizeSearchText(idGestion, nSiniestro, vehiculo, patente, alcance, poliza, compania, producto, tratam, resoluc, atendido),
                filterValue: tratam || alcance || 'Sin estado',
                sortDate: toDateStamp(fecha),
                sortText: idGestion || nSiniestro,
                render
            };
        });

        mountCollectionUI({
            pane,
            summaryText: `🛡️ ${robos.length} denuncia${robos.length !== 1 ? 's' : ''} de robo OC`,
            searchPlaceholder: 'Buscar por ID, siniestro, patente, vehículo o póliza',
            items,
            filterLabel: 'Tratamiento',
            filterOptions: buildSelectOptions(items, 'filterValue'),
            defaultSort: 'fecha_desc',
            sortOptions: [
                { value: 'fecha_desc', label: 'Más recientes' },
                { value: 'fecha_asc', label: 'Más antiguas' },
                { value: 'id_asc', label: 'ID / siniestro' }
            ],
            sortFn: (a, b, sortValue) => {
                if (sortValue === 'fecha_asc') return (a.sortDate || 0) - (b.sortDate || 0);
                if (sortValue === 'id_asc') return compareText(a.sortText, b.sortText);
                return (b.sortDate || 0) - (a.sortDate || 0);
            },
            emptyFilteredMessage: 'No hay denuncias de Robo OC con esos filtros.'
        });
    }

    // ========================
    // ROBO/INCENDIO
    // Imagen ref:
    //   - ID badge morado (ID_UNICO_GESTION) + estado badge top-right (ANULADA rojo)
    //   - Tipo badge: ROBO TOTAL rojo / INCENDIO TOTAL gris oscuro (morado) / INCENDIO PARCIAL verde
    //   - Alcance badge (ALCANCE DE COBERTURA): ESTA CUBIERTO azul
    //   - Tratam badge: ESTA SIENDO ASESORADO verde / YA FUE CONTACTADO amarillo
    //   - Resoluc badge: DERIVADO AL GESTOR naranja / RESUELVE CON ABOGADO NUESTRO naranja
    //   - Campos: Fecha, Atendido por
    // ========================
    function renderRoboIncendio(robos, allPolizas = []) {
        const pane = document.getElementById('tab-robo_incendio');
        pane.innerHTML = '';
        pane.classList.add('list-mode');
        if (!robos || !robos.length) { pane.appendChild(emptyState('No hay denuncias de Robo/Incendio.')); return; }

        const polizaLookup = buildPolizaLookup(allPolizas);
        const items = robos.map((r) => {
            const idReg    = getFirstFieldValue(r, ROBO_INC_ID_KEYS);
            const nSiniestro = strVal(r['NUMERO DE SINIESTRO']);
            const tipo     = strVal(r['TIPO DE ROBO / INCENDIO ']) || strVal(r['CLASIFICACIÓN DEL SINIESTRO']) || strVal(r['TIPO DE ATENCIÓN']);
            const tratam   = sanitizeUserFacingValue(
                strVal(r['Tratamiento']) ||
                strVal(r['TIPO DE ATENCIÓN']) ||
                strVal(r['TRATAMIENTO'])
            );
            const resoluc  = strVal(r['TIPO DE RESOLUCION']) || strVal(r['Elegir Resolucion ']);
            const fecha    = getFirstFieldValue(r, ['FECHA DEL SINIESTRO', 'FECHA DE CREACION']);
            const atendido = resolvedAtendido(r);
            const estado   = strVal(r['ES CLIENTE']);
            const linkedPoliza = findLinkedPoliza(r, polizaLookup);
            const patente  = getFirstFieldValue(r, ROBO_INC_PATENTE_KEYS) || getFirstFieldValue(linkedPoliza || {}, POLIZA_PATENTE_KEYS);
            const vehiculo = getFirstFieldValue(r, ROBO_INC_VEHICLE_KEYS) || resolveVehicleLabel(r, polizaLookup);
            const alcance  = getFirstFieldValue(r, ROBO_INC_COBERTURA_KEYS) || strVal(linkedPoliza?.['COBERTURA']);
            const poliza   = resolvePolicyNumber(r, linkedPoliza, ROBO_INC_POLIZA_KEYS);
            const compania = resolveCompany(r, linkedPoliza);
            const producto = resolveProduct(r, linkedPoliza);
            const oficina  = displayVal(resolvedOficina(r));
            const iaText   = resolveIAText(r);

            // Color tipo exacto
            let tipoCls = 'badge-gray';
            if (tipo) {
                const tu = tipo.toUpperCase();
                if (tu.includes('ROBO TOTAL')) tipoCls = 'badge-red';
                else if (tu.includes('INCENDIO TOTAL')) tipoCls = 'badge-purple';
                else if (tu.includes('INCENDIO PARCIAL')) tipoCls = 'badge-green';
            }

            const render = () => {
                const row = createRecordCard({
                    accent: tipoCls === 'badge-red' ? 'var(--color-anulada)' : (tipoCls === 'badge-green' ? 'var(--color-activa)' : 'var(--color-employee)'),
                    eyebrow: idReg ? `🔥 Gestión ${idReg}` : (nSiniestro ? `🔥 Siniestro ${nSiniestro}` : '🔥 Robo / Incendio'),
                    title: 'Robo Total / Incendio',
                    subtitle: displayVal(vehiculo || tipo),
                    badges: [
                        tipo ? makeBadge(tipo, tipoCls) : '',
                        resoluc ? makeBadge(resoluc, 'badge-orange') : '',
                        alcance ? makeBadge(alcance, 'badge-blue') : '',
                        tratam ? makeBadge(tratam, 'badge-green') : ''
                    ],
                    fields: [
                        { label: 'Fecha', value: formatDate(fecha) },
                        { label: 'Patente', value: displayVal(patente) },
                        { label: 'Cobertura', value: displayVal(alcance) },
                        { label: 'Póliza', value: displayVal(poliza) },
                        { label: 'Atendido por', value: displayVal(atendido, 'Agente IA') }
                    ]
                });

                row.addEventListener('click', () => {
                    const title = `🔥 Robo/Incendio ${idReg || ''}`;
                    const body = `
                    <div class="poliza-modal-hero">
                        <div style="flex:1;">
                            <div class="card-eyebrow">
                                Siniestro del cliente
                                <span class="eyebrow-badges" style="float:right;">
                                    ${tipo ? makeBadge(tipo, tipoCls) : ''}
                                    ${alcance ? makeBadge(alcance, 'badge-blue') : ''}
                                </span>
                            </div>
                            <h2 class="poliza-hero-title">${displayVal(vehiculo || tipo)}</h2>
                            <div class="poliza-hero-subtitle">Patente ${displayVal(patente)} &bull; Póliza ${displayVal(poliza)} &bull; ${compania}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="margin-bottom:8px;">${tratam ? makeBadge(tratam, 'badge-green') : ''}</div>
                            <div>${resoluc ? makeBadge(resoluc, 'badge-orange') : ''}</div>
                        </div>
                    </div>

                    <div class="modal-fixed-grid accident-modal-grid">
                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Lo más importante</h3>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Fecha del siniestro</span>
                                <span class="modal-detail-value">${formatDateTime(fecha)}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Producto</span>
                                <span class="modal-detail-value">${producto}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Status Principal</span>
                                <span class="modal-detail-value">${estado ? makeBadge(estado, 'badge-gray') : '-'}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Identificador Base</span>
                                <span class="modal-detail-value">${displayVal(idReg || nSiniestro)}</span>
                            </div>
                        </section>

                        <section class="modal-fixed-section">
                            <h3 class="modal-section-title">Seguimiento</h3>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Situación</span>
                                <span class="modal-detail-value">${tratam || '-'}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Resolución</span>
                                <span class="modal-detail-value">${resoluc || '-'}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Oficina</span>
                                <span class="modal-detail-value">${oficina}</span>
                            </div>
                            <div class="modal-detail-row">
                                <span class="modal-detail-label">Atendido por</span>
                                <span class="modal-detail-value" style="color:var(--primary-light);">${atendido || '-'}</span>
                            </div>
                        </section>
                    </div>

                    ${buildAIAccordion(
                        iaText || 'Todavía no hay un dictamen del Perito IA cargado para este siniestro.',
                        'RESUMEN DEL PERITO IA DE ROBO E INCENDIO'
                    )}
                `;
                    openModal(title, body);
                });

                return row;
            };

            return {
                searchText: normalizeSearchText(idReg, nSiniestro, vehiculo, patente, alcance, poliza, compania, producto, tipo, tratam, resoluc, atendido),
                filterValue: tipo || resoluc || 'Sin tipo',
                sortDate: toDateStamp(fecha),
                sortText: idReg || nSiniestro,
                render
            };
        });

        mountCollectionUI({
            pane,
            summaryText: `🔥 ${robos.length} denuncia${robos.length !== 1 ? 's' : ''} de robo/incendio`,
            searchPlaceholder: 'Buscar por ID, siniestro, patente, vehículo o póliza',
            items,
            filterLabel: 'Tipo',
            filterOptions: buildSelectOptions(items, 'filterValue'),
            defaultSort: 'fecha_desc',
            sortOptions: [
                { value: 'fecha_desc', label: 'Más recientes' },
                { value: 'fecha_asc', label: 'Más antiguas' },
                { value: 'id_asc', label: 'ID / siniestro' }
            ],
            sortFn: (a, b, sortValue) => {
                if (sortValue === 'fecha_asc') return (a.sortDate || 0) - (b.sortDate || 0);
                if (sortValue === 'id_asc') return compareText(a.sortText, b.sortText);
                return (b.sortDate || 0) - (a.sortDate || 0);
            },
            emptyFilteredMessage: 'No hay denuncias de robo/incendio con esos filtros.'
        });
    }
    await loadPortalData();
});
