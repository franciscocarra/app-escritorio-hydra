document.addEventListener("DOMContentLoaded", () => {
    cargarDatosCuidador();
    conectarRealtimeCuidador();
    cargarPacientesCuidador();
    renderizarCanalAlertas(); // Dibuja las alertas filtradas al cargar
});

let pacienteBandejaActual = { nombre: '', rut: '' };
let runCuidadorCache = null;
let pollingChatInterval = null;

// Paciente seleccionado para monitorear (techo de datos BPM/GPS).
//   pacienteMonitorId   = RUN CIFRADO, que es lo que guarda la tabla bpm (ESP32)
//   pacienteMonitorRut  = RUN plano, de donde sale el hash de geolocalizacion
//   pacienteMonitorHash = SHA-256, que es lo que guarda la tabla geolocalizacion
let pacienteMonitorId = null;
let pacienteMonitorRut = null;
let pacienteMonitorHash = '';
let pacienteMonitorNombre = '';

// ── Mapa Leaflet ──
let mapaCuidador = null;
let markerCuidador = null;
let polylineCuidador = null;
const MAPA_CUIDADOR_INICIAL = [-33.4489, -70.6693];

function cargarDatosCuidador() {
    const usuarioString = localStorage.getItem('hydraUser');
    if(usuarioString) {
        const usuario = JSON.parse(usuarioString);
        document.getElementById('caregiver-name-sidebar').innerText = `Cuidador: ${usuario.nombre} ${usuario.apellidoPaterno}`;
    } else {
        window.location.href = 'Login.html';
    }
}

// ==========================================
// MÓDULO 1: TABLA DE PACIENTES, NOTIFICACIONES Y CHAT
// ==========================================
let pacientesCuidador = [];

// RUN del cuidador (desencriptado una sola vez desde hydraUser.run)
async function getRunCuidador() {
    if (runCuidadorCache) return runCuidadorCache;
    const usuario = JSON.parse(localStorage.getItem('hydraUser') || 'null');
    if (usuario && usuario.run) {
        try {
            runCuidadorCache = await window.hydraAPI.decrypt(usuario.run);
        } catch (e) {
            console.error('Error desencriptando run del cuidador', e);
            runCuidadorCache = null;
        }
    }
    return runCuidadorCache || '';
}

// Carga los pacientes reales y desencripta su RUN para usarlo como clave de conversación
async function cargarPacientesCuidador() {
    try {
        const lista = await window.hydraAPI.getPacientes();
        if (!Array.isArray(lista)) throw new Error('Respuesta inválida');

        const legibles = [];
        for (const p of lista) {
            let run = null;
            try { run = await window.hydraAPI.decrypt(p.runP); } catch (e) { run = null; }
            if (!run) continue;

            // El teléfono viene cifrado desde la API: se descifra para mostrarlo
            let fono = '';
            if (p.telefono) {
                try { fono = (await window.hydraAPI.decrypt(p.telefono)) || ''; } catch (e) { fono = ''; }
            }

            legibles.push({
                run: run,
                runEnc: p.runP,               // RUN cifrado = clave para filtrar BPM/GPS
                nombre: p.nombre || '',
                apellido: `${p.apellidoPaterno || ''} ${p.apellidoMaterno || ''}`.trim(),
                fono: fono
            });
        }

        if (legibles.length > 0) {
            pacientesCuidador = legibles;
        }
        inicializarTablaPacientes();
        poblarSelectAlertas();
    } catch (e) {
        console.error('No se pudieron cargar pacientes reales, usando demo:', e);
        inicializarTablaPacientes();
    }
}

function inicializarTablaPacientes() {
    const tbody = document.getElementById('tabla-pacientes-cuidador');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (pacientesCuidador.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No hay pacientes disponibles.</td></tr>';
        return;
    }

    pacientesCuidador.forEach((p, idx) => {
        const nombreCompleto = `${p.nombre} ${p.apellido}`.trim();
        const enMonitorio = p.runEnc === pacienteMonitorId;

        const fila = `<tr>
            <td>${p.run}</td>
            <td>${p.nombre}</td>
            <td>${p.apellido}</td>
            <td>${p.fono}</td>
            <td>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn-action" style="display: flex; align-items: center; justify-content: center; padding: 8px 12px; ${enMonitorio ? 'background:#3b82f6; color:#fff; border-color:#3b82f6;' : ''}" onclick="seleccionarPacienteMonitoreo(${idx})">
                        <i class="fa-solid fa-heart-pulse" style="margin-right: 5px;"></i> ${enMonitorio ? 'Monitoreando' : 'Monitorear'}
                    </button>
                    <button class="btn-action outline" style="display: flex; align-items: center; justify-content: center; padding: 8px 12px;" onclick="abrirBandejaMensajesPorIndice(${idx})">
                        <i class="fa-solid fa-envelope" style="margin-right: 5px;"></i> Mensajes
                    </button>
                    <button class="btn-action outline" style="border-color: #10b981; color: #10b981; display: flex; align-items: center; justify-content: center; padding: 8px 12px;" onclick="abrirChatPacientePorIndice(${idx})">
                        <i class="fa-brands fa-whatsapp" style="font-size: 15px; margin-right: 5px;"></i> Chat
                    </button>
                </div>
            </td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', fila);
    });
}

// Llaves seguras desde la tabla (evitan problemas de escapado con nombres)
function abrirBandejaMensajesPorIndice(idx) {
    const p = pacientesCuidador[idx];
    if (!p) return;
    abrirBandejaMensajes(`${p.nombre} ${p.apellido}`.trim(), p.run, 0);
}

function abrirChatPacientePorIndice(idx) {
    const p = pacientesCuidador[idx];
    if (!p) return;
    abrirChatPaciente(`${p.nombre} ${p.apellido}`.trim(), p.run);
}

// ==========================================
// SELECCIÓN DEL PACIENTE A MONITOREAR
// ==========================================
async function seleccionarPacienteMonitoreo(idx) {
    const p = pacientesCuidador[idx];
    if (!p) return;

    pacienteMonitorId = p.runEnc;
    pacienteMonitorNombre = `${p.nombre} ${p.apellido}`.trim();

    // geolocalizacion guarda el SHA-256 del RUN, no el RUN cifrado. Se pide al
    // cambiar de paciente para no filtrar eventos con el hash del anterior.
    // El objeto de paciente guarda el RUN descifrado en `run` (linea 76).
    pacienteMonitorRut = p.run || null;
    getHashRun(pacienteMonitorRut).then(h => { pacienteMonitorHash = h; });

    // Reinicia mapa y traza para no mezclar pacientes
    if (markerCuidador) { mapaCuidador?.removeLayer(markerCuidador); markerCuidador = null; }
    if (polylineCuidador) { mapaCuidador?.removeLayer(polylineCuidador); polylineCuidador = null; }

    inicializarTablaPacientes();
    actualizarEncabezadoMonitor();

    // Snapshot inicial: el SSE podría no tener llegado todavía
    try {
        const bpm = await window.hydraAPI.getBpmActual(p.runEnc);
        if (bpm) { manejarBpm({ new: bpm }); }
    } catch (e) {
        console.warn('Sin snapshot de BPM:', e);
    }
    try {
        const geo = await window.hydraAPI.getUbicacionActual(p.runEnc);
        if (geo && geo.latitud != null && geo.longitud != null) {
            manejarGeolocalizacion({ new: geo });
        }
    } catch (e) {
        console.warn('Sin snapshot de geolocalización:', e);
    }
}

function actualizarEncabezadoMonitor() {
    const el = document.getElementById('monitor-paciente-actual');
    if (el) {
        el.textContent = pacienteMonitorId ? pacienteMonitorNombre : 'Seleccione un paciente';
    }
}

// Llave común: descarta cualquier evento que no sea del paciente elegido.
// OJO: cada tabla guarda algo distinto, por eso hay dos funciones.
// El SSE reenvía la fila cruda de Postgres, así que el identificador va en
// snake_case.
//   - bpm             -> sigue guardando el RUN CIFRADO (la escribe el ESP32)
//   - geolocalizacion -> guarda el SHA-256 del RUN
function esBpmMonitoreado(fila) {
    return !!pacienteMonitorId && !!fila && fila.paciente_run_p === pacienteMonitorId;
}

function esGeoMonitoreado(fila) {
    if (!fila || !pacienteMonitorHash || !pacienteMonitorRut) return false;
    return fila.paciente_run_p === pacienteMonitorHash;
}

function poblarSelectAlertas() {
    const sel = document.getElementById('alerta-paciente');
    if (!sel) return;
    const actual = sel.value;
    sel.innerHTML = '<option value="">Seleccione un paciente</option>' +
        pacientesCuidador.map(p =>
            `<option value="${p.run}">${`${p.nombre} ${p.apellido}`.trim()}</option>`).join('');
    if (actual) sel.value = actual;
    renderizarCanalAlertas();
}

// ==========================================
// SPA: SISTEMA DE BANDEJA Y CHAT
// ==========================================
function abrirBandejaMensajes(nombreCompleto, rut, cantidadNotificaciones) {
    pacienteBandejaActual = { nombre: nombreCompleto, rut: rut };

    document.getElementById('vista-principal-cuidador').style.display = 'none';
    document.getElementById('vista-chat-paciente').style.display = 'none';
    document.getElementById('vista-bandeja-mensajes').style.display = 'block';

    document.getElementById('bandeja-nombre-paciente').innerText = `Bandeja de Entrada: ${nombreCompleto}`;
    document.getElementById('bandeja-rut-paciente').innerText = `RUN: ${rut}`;

    const contenedor = document.getElementById('contenedor-mensajes');
    contenedor.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 50px;">Cargando mensajes...</p>';

    cargarNoLeidos(nombreCompleto, rut, contenedor);
}

async function cargarNoLeidos(nombre, rut, contenedor) {
    const runCuidador = await getRunCuidador();
    try {
        // El REST no serializa remitente_run/destinatario_run (WRITE_ONLY), pero si
        // rolDestino y leido: filtramos los entrantes sin leer de esta conversacion 1:1.
        const historial = await window.hydraAPI.getConversacion(runCuidador, rut);
        const delPaciente = (historial || []).filter(m => !m.leido && m.rolDestino === 'cuidador');
        if (delPaciente.length === 0) {
            contenedor.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 50px;">No hay mensajes nuevos de este paciente.</p>';
            return;
        }
        contenedor.innerHTML = delPaciente.map(m => `
            <div class="mensaje-card">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 11px; font-weight: 700; color: #2563eb;"><i class="fa-solid fa-user"></i> ${m.rolOrigen === 'familiar' ? 'FAMILIAR' : 'PACIENTE'}</span>
                    <span style="font-size: 11px; color: #64748b;">${m.creadoEn ? new Date(m.creadoEn).toLocaleString('es-CL') : ''}</span>
                </div>
                ${m.adjuntoUrl ? `<img src="${m.adjuntoUrl}" style="display: block; max-width: 180px; max-height: 180px; border-radius: 8px; margin-bottom: 8px;" alt="Foto adjunta">` : ''}
                <p style="margin: 0; font-size: 13px; color: #334155;">${escapeHtmlMensaje(m.contenido) || (m.adjuntoUrl ? '<em>Envió una foto</em>' : '')}</p>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error cargando no leídos:', e);
        contenedor.innerHTML = '<p style="text-align: center; color: var(--danger); margin-top: 50px;">No se pudo conectar con el servidor de mensajes.</p>';
    }
}

async function abrirChatPaciente(nombreCompleto, rut) {
    pacienteBandejaActual = { nombre: nombreCompleto, rut: rut };

    document.getElementById('vista-principal-cuidador').style.display = 'none';
    document.getElementById('vista-bandeja-mensajes').style.display = 'none';

    document.getElementById('chat-nombre-paciente').innerText = nombreCompleto;
    document.getElementById('vista-chat-paciente').style.display = 'block';

    if (typeof quitarAdjuntoCuidador === 'function') quitarAdjuntoCuidador();

    cargarConversacion();
    clearInterval(pollingChatInterval);
    pollingChatInterval = setInterval(() => cargarConversacion(true), 5000);
}

async function cargarConversacion(silent = false) {
    const contenedor = document.getElementById('mensajes-chat');
    if (!contenedor) return;
    const runCuidador = await getRunCuidador();

    if (!silent) {
        contenedor.innerHTML = '<p style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 20px;">Cargando conversación...</p>';
    }

    try {
        const historial = await window.hydraAPI.getConversacion(runCuidador, pacienteBandejaActual.rut);
        renderMensajes(historial || []);
        marcarLeidosDeChat(runCuidador, historial || []);
    } catch (e) {
        console.error('Error cargando conversación:', e);
        if (!silent) {
            contenedor.innerHTML = '<p style="text-align: center; color: var(--danger); margin-top: 50px;">No se pudo cargar la conversación.</p>';
        }
    }
}

function renderMensajes(historial) {
    const contenedor = document.getElementById('mensajes-chat');
    if (!contenedor) return;

    if (!historial || historial.length === 0) {
        contenedor.innerHTML = '<p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 50px;">Aún no hay mensajes. Envía el primero para iniciar la conversación.</p>';
        return;
    }

    contenedor.innerHTML = historial.map(m => {
        const esDeMi = m.rolOrigen === 'cuidador';
        const autor = esDeMi ? 'Tú' : (m.rolOrigen === 'familiar' ? 'Familiar' : 'Paciente');
        const hora = m.creadoEn ? new Date(m.creadoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
        const bolita = m.leido ? '' : ' <span style="font-size: 9px; color: #ef4444;">●</span>';
        const foto = m.adjuntoUrl
            ? `<img src="${m.adjuntoUrl}" style="display: block; max-width: 260px; max-height: 260px; border-radius: 10px; margin-bottom: 6px;" alt="Foto adjunta">`
            : '';
        const texto = m.contenido
            ? `<strong>${autor}:</strong><br>${escapeHtmlMensaje(m.contenido)}`
            : `<strong>${autor}:</strong><br><em style="opacity: 0.7;">Envió una foto</em>`;
        return `<div class="chat-burbuja ${esDeMi ? 'chat-cuidador' : 'chat-paciente'}">
            ${foto}
            ${texto}
            <span style="display: block; text-align: right; font-size: 10px; opacity: 0.7; margin-top: 4px;">${hora}${bolita}</span>
        </div>`;
    }).join('');

    contenedor.scrollTop = contenedor.scrollHeight;
}

function escapeHtmlMensaje(texto) {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : texto;
    return div.innerHTML;
}

async function marcarLeidosDeChat(runCuidador, historial) {
    // El REST omite el hash del RUN; usamos el rol de destino para saber cuales son entrantes.
    const pendientes = (historial || []).filter(m => !m.leido && m.rolDestino === 'cuidador');
    for (const m of pendientes) {
        try { await window.hydraAPI.marcarLeido(m.id); } catch (e) { /* CORS/despliegue pendiente */ }
    }
}

/** SHA-256 del RUN, cacheado: el RUN cifrado de los mensajes no sale del servidor. */
const _hashRunCache = {};
async function getHashRun(run) {
    if (!run) return '';
    if (_hashRunCache[run]) return _hashRunCache[run];
    try {
        const h = await window.hydraAPI.getHashRun(run);
        _hashRunCache[run] = h;
        return h;
    } catch (e) {
        return '';
    }
}

// ── Adjuntos de foto (cuidador) ──
let archivoAdjuntoCuidador = null;

function onFileSelectedCuidador(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Solo se pueden adjuntar imágenes.');
        event.target.value = '';
        return;
    }
    archivoAdjuntoCuidador = file;

    const preview = document.getElementById('preview-adjunto-cuidador');
    const img = document.getElementById('img-preview-cuidador');
    if (preview && img) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(file);
        preview.style.display = 'flex';
    }
}

function quitarAdjuntoCuidador() {
    archivoAdjuntoCuidador = null;
    const input = document.getElementById('input-adjunto-cuidador');
    if (input) input.value = '';
    const preview = document.getElementById('preview-adjunto-cuidador');
    if (preview) preview.style.display = 'none';
}

async function enviarMensajeChat() {
    const input = document.getElementById('chat-input');
    const texto = (input.value || '').trim();
    const foto = archivoAdjuntoCuidador;
    if (!texto && !foto) return;

    const runCuidador = await getRunCuidador();
    if (!runCuidador) { alert('No se pudo identificar tu RUN. Vuelve a iniciar sesión.'); return; }

    let adjuntoUrl = null;
    try {
        // Paso 1: subir la foto. La carpeta se deriva del hash de ambos RUN.
        if (foto) {
            const info = await window.hydraAPI.subirAdjuntoMensaje(runCuidador, pacienteBandejaActual.rut, foto);
            adjuntoUrl = info.url;
        }

        // Paso 2: crear el mensaje. Si falla, borramos el adjunto huérfano.
        await window.hydraAPI.enviarMensaje({
            remitenteRun: runCuidador,
            rolOrigen: 'cuidador',
            destinatarioRun: pacienteBandejaActual.rut,
            rolDestino: 'paciente',
            contenido: texto || null,
            adjuntoUrl: adjuntoUrl,
            adjuntoNombre: foto ? foto.name : null
        });

        input.value = '';
        quitarAdjuntoCuidador();
        cargarConversacion();
    } catch (e) {
        console.error('Error enviando mensaje:', e);
        if (adjuntoUrl) {
            try { await window.hydraAPI.eliminarAdjunto(adjuntoUrl); } catch (e2) { /* archivo huérfano */ }
        }
        alert('No se pudo enviar el mensaje: ' + (e.message || 'error de conexión'));
    }
}

function volverAlDirectorioCuidador() {
    clearInterval(pollingChatInterval);
    pollingChatInterval = null;
    quitarAdjuntoCuidador();
    document.getElementById('vista-bandeja-mensajes').style.display = 'none';
    document.getElementById('vista-chat-paciente').style.display = 'none';
    document.getElementById('vista-principal-cuidador').style.display = 'block';
    cargarPacientesCuidador();
}

// ==========================================
// REALTIME: PUENTE SSE (hydra_realtime en localhost:8083)
// ==========================================
function conectarRealtimeCuidador() {
    if (!window.HydraRT) { console.warn('realtime.js no cargado'); return; }
    HydraRT.conectar({
        eventos: ['hello', 'mensajes', 'geolocalizacion', 'bpm'],
        handlers: {
            hello: function () {
                const el = document.getElementById('chat-en-linea');
                if (el) { el.style.color = '#10b981'; el.innerHTML = '<i class="fa-solid fa-circle" style="font-size: 8px;"></i> En línea (puente realtime conectado)'; }
                iniciarMapaCuidador();
            },
            mensajes: manejarNuevoMensaje,
            geolocalizacion: manejarGeolocalizacion,
            bpm: manejarBpm
        }
    });
}

// ── Mapa Leaflet ──
function iniciarMapaCuidador() {
    const el = document.getElementById('mapa-cuidador');
    if (!el || mapaCuidador) return;

    mapaCuidador = L.map(el).setView(MAPA_CUIDADOR_INICIAL, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapaCuidador);

    const icono = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });

    markerCuidador = L.marker(MAPA_CUIDADOR_INICIAL, { icon: icono }).addTo(mapaCuidador)
        .bindPopup('<b>Paciente</b>');

    setTimeout(() => mapaCuidador?.invalidateSize(), 300);
}

function manejarGeolocalizacion(payload) {
    const fila = payload && payload.new;
    if (!fila || !fila.latitud || !fila.longitud) return;
    if (!esGeoMonitoreado(fila)) return;

    if (!mapaCuidador) iniciarMapaCuidador();

    const posicion = [fila.latitud, fila.longitud];
    if (markerCuidador) {
        markerCuidador.setLatLng(posicion);
    } else {
        markerCuidador = L.marker(posicion, {
            icon: L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41]
            })
        }).addTo(mapaCuidador);
    }
    markerCuidador.bindPopup(`<b>${pacienteMonitorNombre}</b>`);
    mapaCuidador.panTo(posicion);

    if (!polylineCuidador) {
        polylineCuidador = L.polyline([posicion], { color: '#3b82f6', weight: 3, opacity: 0.7 }).addTo(mapaCuidador);
    } else {
        polylineCuidador.addLatLng(posicion);
    }

    const el = document.getElementById('geo-estado');
    if (el) {
        const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Actualizado ${hora}`;
    }
}

// ── BPM en tiempo real ──
function manejarBpm(payload) {
    const fila = payload && payload.new;
    if (!fila) return;
    if (!esBpmMonitoreado(fila)) return;

    const valor = fila.valor_bpm;
    const spo2 = fila.spo2;
    if (valor == null && spo2 == null) return;

    if (valor != null) {
        const el = document.getElementById('bpm-valor');
        if (el) el.textContent = valor;

        const clasificacion = document.getElementById('bpm-clasificacion');
        if (clasificacion) {
            if (valor < 60) {
                clasificacion.textContent = 'Bradicardia';
                clasificacion.style.color = '#f59e0b';
            } else if (valor > 100) {
                clasificacion.textContent = 'Taquicardia';
                clasificacion.style.color = '#ef4444';
            } else {
                clasificacion.textContent = 'Normal';
                clasificacion.style.color = '#10b981';
            }
        }

        const indicador = document.getElementById('bpm-indicador');
        if (indicador) {
            indicador.style.borderColor = valor < 60 ? '#f59e0b' : (valor > 100 ? '#ef4444' : '#10b981');
        }
    }

    if (spo2 != null) {
        const elSpo2 = document.getElementById('spo2-valor');
        if (elSpo2) elSpo2.textContent = spo2;

        const estadoSpo2 = document.getElementById('spo2-estado');
        if (estadoSpo2) {
            if (spo2 < 90) {
                estadoSpo2.textContent = 'Crítico';
                estadoSpo2.style.color = '#ef4444';
            } else if (spo2 < 94) {
                estadoSpo2.textContent = 'Bajo';
                estadoSpo2.style.color = '#f59e0b';
            } else {
                estadoSpo2.textContent = 'Normal';
                estadoSpo2.style.color = '#10b981';
            }
        }
    }

    const estado = document.getElementById('bpm-estado');
    if (estado) {
        const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        estado.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Actualizado ${hora}`;
    }
}

async function manejarNuevoMensaje(payload) {
    const fila = payload && payload.new;
    if (!fila) return;

    // El SSE reenvía la fila cruda de Postgres: los nombres llegan en snake_case.
    // remitente_run ya contiene el SHA-256, no el RUN cifrado.
    const runCuidador = await getRunCuidador();
    const hashCuidador = await getHashRun(runCuidador);
    if (!hashCuidador) return;

    const remitente = fila.remitente_run;
    const destinatario = fila.destinatario_run;

    const meConcierne = remitente === hashCuidador || destinatario === hashCuidador;
    if (!meConcierne) return;

    const hashPaciente = await getHashRun(pacienteBandejaActual.rut);
    const chatAbierto = document.getElementById('vista-chat-paciente').style.display === 'block';
    const esDelPacienteActual = chatAbierto && hashPaciente && remitente === hashPaciente;

    if (esDelPacienteActual) {
        cargarConversacion();
        try { await window.hydraAPI.marcarLeido(fila.id); } catch (e) {}
    } else if (destinatario === hashCuidador) {
        console.log('Nuevo mensaje recibido de', fila.rol_origen);
    }
}

// ==========================================
// MÓDULO 2: DESPACHO Y FILTRO DE ALERTAS
// ==========================================
function emitirAlertaClinica() {
    const paciente = document.getElementById('alerta-paciente').value;
    const tipo = document.getElementById('alerta-tipo').value;
    const desc = document.getElementById('alerta-descripcion').value.trim();

    if(!desc) { alert("Por favor, describa detalladamente la situación actual o síntomas."); return; }

    const fechaHoy = new Date();
    const horaString = fechaHoy.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const nuevaAlerta = { paciente: paciente, tipo: tipo, descripcion: desc, hora: horaString };

    let historialComunicaciones = JSON.parse(localStorage.getItem('bufferAlertasClinica')) || [];
    historialComunicaciones.unshift(nuevaAlerta);
    localStorage.setItem('bufferAlertasClinica', JSON.stringify(historialComunicaciones));

    alert(tipo === 'Ambulancia' ? "🚨 ALERTA CRÍTICA DESPACHADA 🚨" : "✉️ COMUNICACIÓN ENVIADA");

    document.getElementById('alerta-descripcion').value = "";
    renderizarCanalAlertas();
}

// ESTA FUNCIÓN AHORA FILTRA SEGÚN EL PACIENTE SELECCIONADO EN EL MENÚ
function renderizarCanalAlertas() {
    const contenedor = document.getElementById('historial-alertas-cuidador');
    const pacienteSeleccionado = document.getElementById('alerta-paciente').value;
    
    const todasLasAlertas = JSON.parse(localStorage.getItem('bufferAlertasClinica')) || [];
    const alertasDelPaciente = todasLasAlertas.filter(a => a.paciente === pacienteSeleccionado);

    if(alertasDelPaciente.length === 0) {
        contenedor.innerHTML = `<p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 80px;">No se registran despachos o alertas para ${pacienteSeleccionado}.</p>`;
        return;
    }

    contenedor.innerHTML = alertasDelPaciente.map(a => {
        let estiloBadge = "background: #e0e7ff; color: #2563eb;"; 
        let tituloAlerta = `<i class="fa-solid fa-info-circle"></i> Solicitud Información`;

        if (a.tipo === "Ambulancia") {
            estiloBadge = "background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5;"; 
            tituloAlerta = `🚨 CÓDIGO ROJO: DESPACHO AMBULANCIA`;
        } else if (a.tipo === "Emergencia") {
            estiloBadge = "background: #fef3c7; color: #d97706;"; 
            tituloAlerta = `⚠️ ALERTA MÉDICA: REVISIÓN DE TURNO`;
        }

        return `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.01);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; ${estiloBadge}">${tituloAlerta}</span>
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${a.hora}</span>
                </div>
                <strong style="font-size: 13px; color: #1e293b; display: block; margin-bottom: 2px;">Pac: ${a.paciente}</strong>
                <p style="margin: 0; font-size: 12px; color: #64748b; font-style: italic; line-height: 1.4;">"${a.descripcion}"</p>
            </div>
        `;
    }).join('');
}

// ==========================================
// LÓGICA DEL BOTÓN DE PÁNICO (AMBULANCIA)
// ==========================================
function abrirModalAmbulancia() {
    document.getElementById('nombre-modal-amb').innerText = pacienteBandejaActual.nombre;
    document.getElementById('modal-ambulancia').style.display = 'flex';
}

function cerrarModalAmbulancia() {
    document.getElementById('modal-ambulancia').style.display = 'none';
}

function confirmarAmbulancia() {
    const fechaHoy = new Date();
    const horaString = fechaHoy.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const nuevaAlerta = { 
        paciente: pacienteBandejaActual.nombre, 
        tipo: 'Ambulancia', 
        descripcion: '🚨 BOTÓN DE PÁNICO ACCIONADO DESDE LA BANDEJA DEL PACIENTE 🚨', 
        hora: horaString 
    };

    let historialComunicaciones = JSON.parse(localStorage.getItem('bufferAlertasClinica')) || [];
    historialComunicaciones.unshift(nuevaAlerta);
    localStorage.setItem('bufferAlertasClinica', JSON.stringify(historialComunicaciones));

    cerrarModalAmbulancia();
    alert(`¡UNIDAD MÉDICA DESPACHADA!\nSe ha enviado una ambulancia de urgencia a la ubicación registrada de ${pacienteBandejaActual.nombre}.`);
}