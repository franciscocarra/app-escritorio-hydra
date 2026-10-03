// ==========================================
// VARIABLES GLOBALES
// ==========================================
let pacienteActualData = null;
let listaRecetaActual = [];
let archivoExamenSeleccionado = null;
let runMedicoCache = null;
let pollingChatMedicoInterval = null;

// ── Mapa Leaflet ──
let mapaMedico = null;
let markerMedico = null;
let polylineMedico = null;
const MAPA_MEDICO_INICIAL = [-33.4489, -70.6693];

// GPS (servicio en Render; misma URL que preload.js y js/realtime.js)
let gpsMapa = null;
let gpsMarker = null;
let gpsRuta = null;
let gpsPollingInterval = null;
const API_GPS = 'https://geolocalizaci-n-1.onrender.com/api/geolocalizacion';

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosMedico();
    cargarPacientes();
    conectarRealtimeMedico();

    // MAGIA: Si la URL dice "?return=perfil", significa que venimos del Dashboard.
    // Restauramos automáticamente el perfil del paciente.
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('return') === 'perfil') {
        const pacGuardado = localStorage.getItem('pacienteActivo');
        if(pacGuardado) {
            const p = JSON.parse(pacGuardado);
            abrirPerfil(p.nombre, p.apP, p.apM, p.rut, p.fono, p.rutEnc);
        }
    }

    
});

// ==========================================
// 1. CARGA DE DATOS PRINCIPALES
// ==========================================
function cargarDatosMedico() {
    const usuarioString = localStorage.getItem('hydraUser');
    if(usuarioString) {
        const usuario = JSON.parse(usuarioString);
        document.getElementById('doc-name-sidebar').innerText = `Dr. ${usuario.email}`;
    } else {
        window.location.href = 'Login.html';
    }
}

async function desencriptarDato(hash) {
    if (!hash || hash === 'null' || hash.length < 15) return hash || 'Sin registro';
    try {
        return await window.hydraAPI.decrypt(hash);
    } catch (e) { return "Error API"; }
}

async function cargarPacientes() {
    const urlAPI = 'https://hydra-crud.onrender.com/api/pacientes';
    
    try {
        const tbody = document.getElementById('cuerpo-tabla-pacientes');
        const res = await fetch(urlAPI, { headers: { 'Authorization': `Bearer ${localStorage.getItem('hydra_token')}` }});
        
        if (res.ok) {
            const cifrados = await res.json(); 
            const promesas = cifrados.map(async (p) => {
                const [rut, tel] = await Promise.all([desencriptarDato(p.runP), desencriptarDato(p.telefono)]);
                return { ...p, runP: rut, telefono: tel, runPEncriptado: p.runP };
            });
            const legibles = await Promise.all(promesas);

            tbody.innerHTML = ''; 
            legibles.forEach(p => {
                const apP = p.apellidoPaterno || ''; const apM = p.apellidoMaterno || '';
                const nombreCompleto = `${p.nombre} ${apP}`;
                
                const fila = `<tr>
                    <td>${p.runP}</td><td>${p.nombre}</td><td>${apP} ${apM}</td><td>${p.telefono}</td>
                    <td style="display: flex; gap: 8px;">
                        <button class="btn-action outline" style="display: flex; align-items: center; gap: 5px;" onclick="abrirPerfil('${p.nombre}', '${apP}', '${apM}', '${p.runP}', '${p.telefono}', '${p.runPEncriptado}')">
                            <i class="fa-solid fa-user-doctor"></i> Perfil Clínico
                        </button>
                        <button class="btn-action" style="background-color: #8b5cf6; color: white; border: none; display: flex; align-items: center; gap: 5px;" onclick="irAlDashboard('${nombreCompleto}', '${p.runPEncriptado}', '${p.runP}')">
                            <i class="fa-solid fa-chart-line"></i> Dashboard
                        </button>
                            <button class="btn-action" style="background-color: #10b981; color: white; border: none; display: flex; align-items: center; gap: 5px;" onclick="abrirChatMedico('${nombreCompleto}', '${p.runP}', '${p.runPEncriptado}')">
                            <i class="fa-solid fa-comment-dots"></i> Chat
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// CARGA DE DOCUMENTOS DESDE EL BUCKET
// ==========================================
async function cargarDocumentos(rutEnc) {
    const tbody = document.getElementById('cuerpo-tabla-documentos');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Cargando documentos...</td></tr>';

    try {
        const resp = await window.hydraAPI.getDocumentos(rutEnc);

        // Misma normalización que la app móvil (perfil.page.ts):
        // el backend devuelve {documentos:[...]} o [{documentos:[...]}]
        let documentos = [];
        if (Array.isArray(resp) && resp.length > 0 && resp[0] && resp[0].documentos) {
            documentos = resp[0].documentos;
        } else if (resp && resp.documentos) {
            documentos = resp.documentos;
        } else if (Array.isArray(resp)) {
            documentos = resp;
        }

        if (!Array.isArray(documentos) || documentos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">El paciente no tiene documentos disponibles</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        documentos.forEach(doc => {
            const fecha = new Date(doc.fechaCreacion);
            const fechaStr = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

            const fila = `<tr>
                <td>${fechaStr}</td>
                <td style="font-weight: 700;">${doc.nombre}</td>
                <td style="text-align: center;">
                    <button class="btn-action outline" style="color: #2563eb; border-color: #2563eb; padding: 5px 15px; font-size: 12px;" onclick="window.open('${doc.url}', '_blank')">
                        <i class="fa-solid fa-download"></i> Descargar
                    </button>
                </td>
            </tr>`;
            tbody.insertAdjacentHTML('beforeend', fila);
        });
    } catch (e) {
        console.error('Error al cargar documentos:', e);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--danger);">Error al cargar documentos</td></tr>';
    }
}

// ==========================================
// 2. INTERCAMBIO DE VISTAS (TABLA <-> PERFIL)
// ==========================================
function abrirPerfil(nombre, apP, apM, rut, fono, rutEnc) {
    // Memoria del paciente actual.
    //   rutEnc = RUN cifrado -> lo que sigue guardando la tabla bpm (ESP32)
    //   rut    = RUN plano   -> de donde sale el SHA-256 de geolocalizacion
    const pacObj = { nombre, apP, apM, rut, fono, rutEnc: rutEnc || rut };
    localStorage.setItem('pacienteActivo', JSON.stringify(pacObj));
    pacienteActualData = { nombreCompleto: `${nombre} ${apP}`, rut: rut, rutEnc: rutEnc || rut };
    getHashRun(pacienteActualData.rut).then(h => { hashRunPacienteActual = h; });

    // Inyectamos iniciales y datos en cabecera
    const iniciales = `${nombre.charAt(0).toUpperCase()}${apP.charAt(0).toUpperCase()}`;
    document.getElementById('pac-iniciales').innerText = iniciales;
    document.getElementById('pac-nombre-completo').innerText = `${nombre} ${apP} ${apM}`;
    document.getElementById('pac-rut-header').innerText = `RUN: ${rut}`;
    document.getElementById('pac-rut-grid').innerText = rut;
    document.getElementById('pac-fono').innerText = fono;

    // NUEVO: Verificamos si este paciente ya tiene datos financieros guardados
    actualizarVistaFinanzasModulo(rut);

    // Cargamos documentos del bucket (con RUT limpio)
    cargarDocumentos(rut);

    // Cargamos los contactos familiares vinculados a este paciente
    cargarContactosFamiliares(rutEnc || rut);

    // Cambiamos de vista
    document.getElementById('vista-directorio').style.display = 'none';
    document.getElementById('vista-perfil').style.display = 'block';

    // GPS en vivo para el paciente
    detenerPollingGPS();
    cargarMapaGPS(rut);
    gpsPollingInterval = setInterval(function () {
        if (pacienteActualData && pacienteActualData.rut) {
            cargarMapaGPS(pacienteActualData.rut);
        }
    }, 10000);
}

function volverAlDirectorio() {
    // Si vuelve a la tabla general, borramos la memoria del paciente activo
    localStorage.removeItem('pacienteActivo');
    detenerPollingGPS();
    pacienteActualData = null;

    // Reiniciamos la telemetría para no dejar datos del paciente anterior
    if (markerMedico) { mapaMedico?.removeLayer(markerMedico); markerMedico = null; }
    if (polylineMedico) { mapaMedico?.removeLayer(polylineMedico); polylineMedico = null; }
    limpiarTelemetriaMedico();
    // Sin esto, los eventos del paciente anterior seguiríanABILitando el filtro
    hashRunPacienteActual = '';

    document.getElementById('vista-perfil').style.display = 'none';
    document.getElementById('vista-directorio').style.display = 'block';
    document.getElementById('vista-directorio-familiares').style.display = 'none';
    const vistaChat = document.getElementById('vista-chat-medico');
    if (vistaChat) vistaChat.style.display = 'none';

    marcaNavActiva('volverAlDirectorio');

    // Limpiamos la URL para que no se quede pegado el "?return=perfil"
    window.history.replaceState({}, document.title, window.location.pathname);
}

function limpiarTelemetriaMedico() {
    const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
    set('bpm-valor-medico', '--');
    set('spo2-valor-medico', '--');
    set('bpm-clasificacion-medico', 'Esperando...');
    set('spo2-clasificacion-medico', 'Esperando...');
    const geo = document.getElementById('geo-estado-medico');
    if (geo) geo.innerHTML = 'Esperando datos GPS...';
    const bpm = document.getElementById('bpm-estado-medico');
    if (bpm) bpm.innerHTML = 'Esperando datos BPM...';
}

function marcaNavActiva(fn) {
    const navItems = document.querySelectorAll('.sidebar nav p');
    navItems.forEach(p => {
        const esActivo = p.getAttribute('onclick') && p.getAttribute('onclick').includes(fn);
        p.classList.toggle('active', !!esActivo);
    });
}

// ==========================================
// CHAT DEL MÉDICO (mensajes realtime sobre hydra_realtime)
// ==========================================
async function getRunMedico() {
    if (runMedicoCache) return runMedicoCache;
    const usuario = JSON.parse(localStorage.getItem('hydraUser') || 'null');
    if (usuario && usuario.run) {
        try { runMedicoCache = await window.hydraAPI.decrypt(usuario.run); }
        catch (e) { runMedicoCache = null; }
    }
    return runMedicoCache || '';
}

function abrirChatMedico(nombreCompleto, rutPaciente, rutEnc) {
    pacienteActualData = { nombreCompleto: nombreCompleto, rut: rutPaciente, rutEnc: rutEnc || rutPaciente };
    // Los eventos SSE de geolocalizacion se filtran por hash, no por el RUN
    // cifrado. Se pide antes de que empiece a llegar el stream.
    getHashRun(pacienteActualData.rut).then(h => { hashRunPacienteActual = h; });

    document.getElementById('vista-directorio').style.display = 'none';
    document.getElementById('vista-perfil').style.display = 'none';
    document.getElementById('vista-directorio-familiares').style.display = 'none';

    document.getElementById('chat-medico-nombre').innerText = nombreCompleto;
    document.getElementById('vista-chat-medico').style.display = 'block';

    if (typeof quitarAdjuntoMedico === 'function') quitarAdjuntoMedico();

    cargarConversacionMedico();
    clearInterval(pollingChatMedicoInterval);
    pollingChatMedicoInterval = setInterval(() => cargarConversacionMedico(true), 5000);
}

async function cargarConversacionMedico(silent = false) {
    const contenedor = document.getElementById('mensajes-chat-medico');
    if (!contenedor) return;
    const runMedico = await getRunMedico();

    if (!silent) {
        contenedor.innerHTML = '<p style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 20px;">Cargando conversación...</p>';
    }

    try {
        const historial = await window.hydraAPI.getConversacion(runMedico, pacienteActualData.rut);
        renderMensajesMedico(historial || []);
        marcarLeidosMedico(runMedico, historial || []);
    } catch (e) {
        console.error('Error cargando conversación:', e);
        if (!silent) {
            contenedor.innerHTML = '<p style="text-align: center; color: var(--danger); margin-top: 50px;">No se pudo cargar la conversación.</p>';
        }
    }
}

function renderMensajesMedico(historial) {
    const contenedor = document.getElementById('mensajes-chat-medico');
    if (!contenedor) return;

    if (!historial || historial.length === 0) {
        contenedor.innerHTML = '<p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 50px;">Aún no hay mensajes. Envía el primero para iniciar la conversación.</p>';
        return;
    }

    contenedor.innerHTML = historial.map(m => {
        const esDeMi = m.rolOrigen === 'medico';
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

/**
 * SHA-256 del paciente abierto. La tabla geolocalizacion guarda el hash, no el
 * RUN cifrado, así que hace falta para filtrar sus eventos SSE.
 * Se rellena al seleccionar un paciente y se limpia al salir del perfil.
 */
let hashRunPacienteActual = '';

async function marcarLeidosMedico(runMedico, historial) {
    // El REST omite el hash del RUN; usamos el rol de destino para saber cuales son entrantes.
    const pendientes = (historial || []).filter(m => !m.leido && m.rolDestino === 'medico');
    for (const m of pendientes) {
        try { await window.hydraAPI.marcarLeido(m.id); } catch (e) { /* CORS/despliegue pendiente */ }
    }
}

// ── Adjuntos de foto (médico) ──
let archivoAdjuntoMedico = null;

function onFileSelectedMedico(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Solo se pueden adjuntar imágenes.');
        event.target.value = '';
        return;
    }
    archivoAdjuntoMedico = file;

    const preview = document.getElementById('preview-adjunto-medico');
    const img = document.getElementById('img-preview-medico');
    if (preview && img) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(file);
        preview.style.display = 'flex';
    }
}

function quitarAdjuntoMedico() {
    archivoAdjuntoMedico = null;
    const input = document.getElementById('input-adjunto-medico');
    if (input) input.value = '';
    const preview = document.getElementById('preview-adjunto-medico');
    if (preview) preview.style.display = 'none';
}

async function enviarMensajeMedico() {
    const input = document.getElementById('chat-medico-input');
    const texto = (input.value || '').trim();
    const foto = archivoAdjuntoMedico;
    if (!texto && !foto) return;

    const runMedico = await getRunMedico();
    if (!runMedico) { alert('No se pudo identificar tu RUN. Vuelve a iniciar sesión.'); return; }

    let adjuntoUrl = null;
    try {
        // Paso 1: subir la foto. La carpeta se deriva del hash de ambos RUN.
        if (foto) {
            const info = await window.hydraAPI.subirAdjuntoMensaje(runMedico, pacienteActualData.rut, foto);
            adjuntoUrl = info.url;
        }

        // Paso 2: crear el mensaje. Si falla, borramos el adjunto huérfano.
        await window.hydraAPI.enviarMensaje({
            remitenteRun: runMedico,
            rolOrigen: 'medico',
            destinatarioRun: pacienteActualData.rut,
            rolDestino: 'paciente',
            contenido: texto || null,
            adjuntoUrl: adjuntoUrl,
            adjuntoNombre: foto ? foto.name : null
        });

        input.value = '';
        quitarAdjuntoMedico();
        cargarConversacionMedico();
    } catch (e) {
        console.error('Error enviando mensaje:', e);
        if (adjuntoUrl) {
            try { await window.hydraAPI.eliminarAdjunto(adjuntoUrl); } catch (e2) { /* archivo huérfano */ }
        }
        alert('No se pudo enviar el mensaje: ' + (e.message || 'error de conexión'));
    }
}

function volverDeChatMedico() {
    clearInterval(pollingChatMedicoInterval);
    pollingChatMedicoInterval = null;
    if (typeof quitarAdjuntoMedico === 'function') quitarAdjuntoMedico();
    document.getElementById('vista-chat-medico').style.display = 'none';
    document.getElementById('vista-directorio').style.display = 'block';
}

function conectarRealtimeMedico() {
    if (!window.HydraRT) { console.warn('realtime.js no cargado'); return; }
    HydraRT.conectar({
        eventos: ['hello', 'mensajes', 'geolocalizacion', 'bpm'],
        handlers: {
            hello: function () {
                const el = document.getElementById('chat-medico-enlinea');
                if (el) { el.style.color = '#10b981'; el.innerHTML = '<i class="fa-solid fa-circle" style="font-size: 8px;"></i> En línea (puente realtime conectado)'; }
                iniciarMapaMedico();
            },
            mensajes: manejarMensajeMedico,
            geolocalizacion: manejarGeolocalizacionMedico,
            bpm: manejarBpmMedico
        }
    });
}

// ── Mapa Leaflet ──
function iniciarMapaMedico() {
    const el = document.getElementById('mapa-medico');
    if (!el || mapaMedico) return;

    mapaMedico = L.map(el).setView(MAPA_MEDICO_INICIAL, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapaMedico);

    const icono = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });

    markerMedico = L.marker(MAPA_MEDICO_INICIAL, { icon: icono }).addTo(mapaMedico)
        .bindPopup('<b>Paciente</b>');

    setTimeout(() => mapaMedico?.invalidateSize(), 300);
}

// Llave común: solo acepta eventos del paciente abierto en el perfil.
// El SSE reenvía la fila cruda de Postgres, así que el identificador llega en
// snake_case. OJO: cada tabla guarda algo distinto, por eso hay dos funciones:
//   - bpm            -> sigue guardando el RUN CIFRADO (la escribe el ESP32)
//   - geolocalizacion-> guarda el SHA-256 del RUN
function esBpmDelPacienteActual(fila) {
    return !!pacienteActualData?.rutEnc && !!fila
        && fila.paciente_run_p === pacienteActualData.rutEnc;
}

function esGeoDelPacienteActual(fila) {
    if (!fila || !pacienteActualData?.rut || !hashRunPacienteActual) return false;
    return fila.paciente_run_p === hashRunPacienteActual;
}

function manejarGeolocalizacionMedico(payload) {
    const fila = payload && payload.new;
    if (!fila || !fila.latitud || !fila.longitud) return;
    if (!esGeoDelPacienteActual(fila)) return;

    if (!mapaMedico) iniciarMapaMedico();

    const posicion = [fila.latitud, fila.longitud];
    if (markerMedico) {
        markerMedico.setLatLng(posicion);
        mapaMedico.panTo(posicion);
    }
    if (markerMedico && pacienteActualData?.nombreCompleto) {
        markerMedico.bindPopup(`<b>${pacienteActualData.nombreCompleto}</b>`);
    }

    if (!polylineMedico) {
        polylineMedico = L.polyline([posicion], { color: '#2563eb', weight: 3, opacity: 0.7 }).addTo(mapaMedico);
    } else {
        polylineMedico.addLatLng(posicion);
    }

    const el = document.getElementById('geo-estado-medico');
    if (el) {
        const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Actualizado ${hora}`;
    }
}

// ── BPM en tiempo real ──
function manejarBpmMedico(payload) {
    const fila = payload && payload.new;
    if (!fila) return;
    if (!esBpmDelPacienteActual(fila)) return;

    const valor = fila.valor_bpm;
    const spo2 = fila.spo2;
    if (valor == null && spo2 == null) return;

    if (valor != null) {
        const el = document.getElementById('bpm-valor-medico');
        if (el) el.textContent = valor;

        const clasificacion = document.getElementById('bpm-clasificacion-medico');
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

        const indicador = document.getElementById('bpm-indicador-medico');
        if (indicador) {
            indicador.style.borderColor = valor < 60 ? '#f59e0b' : (valor > 100 ? '#ef4444' : '#10b981');
        }
    }

    if (spo2 != null) {
        const elSpo2 = document.getElementById('spo2-valor-medico');
        if (elSpo2) elSpo2.textContent = spo2;

        const estadoSpo2 = document.getElementById('spo2-clasificacion-medico');
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

    const estado = document.getElementById('bpm-estado-medico');
    if (estado) {
        const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        estado.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Actualizado ${hora}`;
    }
}

async function manejarMensajeMedico(payload) {
    const fila = payload && payload.new;
    if (!fila) return;

    // El SSE reenvía la fila cruda de Postgres: los nombres van en snake_case y
    // remitente_run ya contiene el SHA-256, no el RUN cifrado.
    const runMedico = await getRunMedico();
    const hashMedico = await getHashRun(runMedico);
    if (!hashMedico) return;

    const remitente = fila.remitente_run;
    const destinatario = fila.destinatario_run;

    const meConcierne = remitente === hashMedico || destinatario === hashMedico;
    if (!meConcierne) return;

    const hashPaciente = pacienteActualData ? await getHashRun(pacienteActualData.rut) : '';
    const chatAbierto = document.getElementById('vista-chat-medico').style.display === 'block';
    const esDelPacienteActual = chatAbierto && hashPaciente && remitente === hashPaciente;

    if (esDelPacienteActual) {
        cargarConversacionMedico();
        try { await window.hydraAPI.marcarLeido(fila.id); } catch (e) {}
    } else if (destinatario === hashMedico) {
        console.log('Nuevo mensaje recibido de', fila.rol_origen);
    }
}

// ==========================================
// 3. GENERADOR DE DATOS DE DASHBOARD
// ==========================================
function irAlDashboard(nombrePaciente, rutPaciente, rutDisplay) {
    const datos14Dias = [];
    const hoy = new Date();

    for (let i = 13; i >= 0; i--) {
        let fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - i);
        datos14Dias.push({
            fecha: fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
            usoHoras: (Math.random() * (14 - 4) + 4).toFixed(1),
            bateria: Math.floor(Math.random() * (85 - 15) + 15),
            temperatura: (Math.random() * (39 - 28) + 28).toFixed(1)
        });
    }

    const dataDashboard = { paciente: nombrePaciente, runP: rutPaciente, rutDisplay: rutDisplay || rutPaciente, telemetria: datos14Dias };
    localStorage.setItem('dashboardTemporal', JSON.stringify(dataDashboard));
    
    window.location.href = 'dashboard.html';
}

function generarDashboardActual() {
    if(pacienteActualData) {
        irAlDashboard(pacienteActualData.nombreCompleto, pacienteActualData.rutEnc, pacienteActualData.rut);
    }
}

// ==========================================
// 4. LÓGICA DEL MODAL DE RECETAS CON LISTA
// ==========================================
function abrirModalReceta() {
    document.getElementById('modal-receta').style.display = 'flex';
    renderizarListaReceta();
}

function cerrarModalReceta() {
    document.getElementById('modal-receta').style.display = 'none';
    document.getElementById('receta-med').value = '';
    document.getElementById('receta-dosis').value = '';
    listaRecetaActual = []; // Vacía la lista si el usuario cancela
}

function agregarMedicamentoAReceta() {
    const med = document.getElementById('receta-med').value.trim();
    const dosis = document.getElementById('receta-dosis').value.trim();

    if(!med || !dosis) {
        alert("Por favor, ingresa el medicamento y la dosis antes de agregar."); 
        return;
    }

    // Añade al carrito de la receta
    listaRecetaActual.push({ medicamento: med, dosis: dosis });
    
    // Limpia las cajas de texto para agregar otro rápidamente
    document.getElementById('receta-med').value = '';
    document.getElementById('receta-dosis').value = '';
    
    // Dibuja la lista actualizada
    renderizarListaReceta();
}

function renderizarListaReceta() {
    const contenedor = document.getElementById('contenedor-lista-receta');
    
    if(listaRecetaActual.length === 0) {
        contenedor.innerHTML = '<p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 35px;">No hay medicamentos añadidos aún.</p>';
        return;
    }

    // Crea un mini-recuadro por cada medicamento con un botón para eliminarlo
    contenedor.innerHTML = listaRecetaActual.map((item, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px; border-bottom: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 5px;">
            <div>
                <strong style="font-size: 13px; color: #0f172a;">${item.medicamento}</strong><br>
                <span style="font-size: 11px; color: #64748b;"><i class="fa-solid fa-clock"></i> ${item.dosis}</span>
            </div>
            <button onclick="eliminarDeReceta(${index})" style="color: #ef4444; background: transparent; border: none; cursor: pointer; font-size: 14px;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function eliminarDeReceta(index) {
    listaRecetaActual.splice(index, 1);
    renderizarListaReceta();
}

function guardarReceta() {
    const med = document.getElementById('receta-med').value.trim();
    const dosis = document.getElementById('receta-dosis').value.trim();

    if(listaRecetaActual.length === 0) {
        alert("Debes agregar al menos un medicamento a la lista antes de emitir la receta."); 
        return;
    }

    // 1. SIMULAMOS EL ENVÍO AL BUCKET DEL PACIENTE
    // Creamos una nomenclatura única para el archivo PDF/JSON de la receta
    const fechaHoy = new Date();
    const fechaString = fechaHoy.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timestamp = fechaHoy.getTime();
    const nombreArchivoBucket = `RECETA_MEDICA_${timestamp}.pdf`;

    // Guardamos en la lista global de recetas pendientes para que el Autorizador las vea
    let recetasGlobalesBucket = JSON.parse(localStorage.getItem('bucketRecetasPendientes')) || [];
    recetasGlobalesBucket.push({
        id: timestamp,
        paciente: pacienteActualData.nombreCompleto,
        rut: pacienteActualData.rut,
        fecha: fechaString,
        archivo: nombreArchivoBucket,
        medicamentos: [...listaRecetaActual],
        estado: 'Pendiente'
    });
    localStorage.setItem('bucketRecetasPendientes', JSON.stringify(recetasGlobalesBucket));

    // 2. INYECTAMOS VISUALMENTE EN EL EXPEDIENTE (Tabla de Documentos del Paciente)
    const tablaDocs = document.getElementById('cuerpo-tabla-documentos');
    const nuevaFilaDocumento = `
        <tr style="background-color: #f0fdf4;">
            <td>${fechaString}</td>
            <td style="font-weight: 700; color: #16a34a;"><i class="fa-solid fa-file-pdf"></i> ${nombreArchivoBucket} (Subido al Bucket)</td>
            <td style="text-align: center;">
                <span style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                    <i class="fa-solid fa-cloud-arrow-up"></i> En Bucket
                </span>
            </td>
        </tr>
    `;
    // Insertamos la nueva receta arriba de los otros exámenes
    tablaDocs.insertAdjacentHTML('afterbegin', nuevaFilaDocumento);
    
    alert(`¡Firma digital exitosa!\nLa receta fue procesada y enviada de forma segura al bucket del paciente.`);
    cerrarModalReceta();
}

// ===================================================
// LÓGICA DE CONTROL: MÓDULO FINANCIERO Y SEGUROS
// ===================================================

function actualizarVistaFinanzasModulo(rut) {
    // Buscamos si el paciente ya tiene historial financiero guardado
    const finanzasGuardadas = localStorage.getItem('finanzas_paciente_' + rut);

    if (finanzasGuardadas) {
        const datos = JSON.parse(finanzasGuardadas);
        
        // Rellenamos el bloque de lectura
        document.getElementById('finanzas-prevision-val').innerText = datos.prevision;
        document.getElementById('finanzas-seguro-val').innerText = datos.seguro;
        document.getElementById('finanzas-cobertura-val').innerText = datos.cobertura;

        // Ocultamos el formulario y mostramos los datos fijos
        document.getElementById('finanzas-form-bloque').style.display = 'none';
        document.getElementById('finanzas-status-bloque').style.display = 'flex';
    } else {
        // Si es nuevo, limpiamos el formulario para que elija
        document.getElementById('finanzas-prevision-sel').value = "";
        document.getElementById('finanzas-seguro-sel').value = "";
        document.getElementById('finanzas-cobertura-input').value = "";
        
        document.getElementById('finanzas-form-bloque').style.display = 'flex';
        document.getElementById('finanzas-status-bloque').style.display = 'none';
    }
}

function guardarFinanzasModulo() {
    const prev = document.getElementById('finanzas-prevision-sel').value;
    const seg = document.getElementById('finanzas-seguro-sel').value;
    const cob = document.getElementById('finanzas-cobertura-input').value.trim();
    const rutPaciente = pacienteActualData.rut;

    // Validamos que complete los menús
    if (!prev || !seg || !cob) {
        alert("Por favor, seleccione la Previsión, el Seguro y especifique la Cobertura.");
        return;
    }

    const paqueteFinanzas = { prevision: prev, seguro: seg, cobertura: cob };

    // Guardamos en memoria amarrado al RUT del paciente
    localStorage.setItem('finanzas_paciente_' + rutPaciente, JSON.stringify(paqueteFinanzas));

    alert("¡Expediente Financiero guardado con éxito para este paciente!");
    
    // Refrescamos la vista para mostrar el bloque de lectura
    actualizarVistaFinanzasModulo(rutPaciente);
}

function editarFinanzasModulo() {
    const rutPaciente = pacienteActualData.rut;
    const finanzasGuardadas = localStorage.getItem('finanzas_paciente_' + rutPaciente);
    
    // Si decide editar, cargamos lo que ya tenía en los selectores
    if(finanzasGuardadas) {
        const datos = JSON.parse(finanzasGuardadas);
        document.getElementById('finanzas-prevision-sel').value = datos.prevision;
        document.getElementById('finanzas-seguro-sel').value = datos.seguro;
        document.getElementById('finanzas-cobertura-input').value = datos.cobertura;
    }

    // Volvemos a mostrar el formulario interactivo
    document.getElementById('finanzas-form-bloque').style.display = 'flex';
    document.getElementById('finanzas-status-bloque').style.display = 'none';
}

// ==========================================
// SUBIDA DE EXÁMENES MÉDICOS
// ==========================================
function abrirModalSubida() {
    if (!pacienteActualData) {
        alert('Selecciona un paciente primero.');
        return;
    }
    document.getElementById('modal-subida-nombre-paciente').innerText = pacienteActualData.nombreCompleto;
    document.getElementById('modal-subida-examen').style.display = 'flex';
    limpiarArchivoExamen();
}

function cerrarModalSubida() {
    document.getElementById('modal-subida-examen').style.display = 'none';
    document.getElementById('input-nombre-examen').value = '';
    limpiarArchivoExamen();
}

function onFileSelectedExam(event) {
    const file = event.target.files[0];
    if (!file) return;

    archivoExamenSeleccionado = file;

    const inputNombre = document.getElementById('input-nombre-examen');
    if (!inputNombre.value) {
        inputNombre.value = file.name.split('.').slice(0, -1).join('.');
    }

    document.getElementById('drop-content-vacio').style.display = 'none';
    document.getElementById('drop-content-archivo').style.display = 'block';
    document.getElementById('drop-icon-examen').className = 'fa-solid fa-check-circle';
    document.getElementById('drop-icon-examen').style.color = '#00b894';
    document.getElementById('exam-file-name').textContent = file.name;
    document.getElementById('exam-file-size').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
    document.getElementById('drop-zone-examen').style.borderStyle = 'solid';
    document.getElementById('drop-zone-examen').style.borderColor = '#00b894';
    document.getElementById('drop-zone-examen').style.background = '#f0fdf4';

    if (file.type.includes('image')) {
        const reader = new FileReader();
        reader.onload = () => {
            document.getElementById('preview-img-examen').src = reader.result;
            document.getElementById('preview-container-examen').style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        document.getElementById('preview-container-examen').style.display = 'none';
    }

    document.getElementById('btn-subir-examen').style.display = 'flex';
}

function limpiarArchivoExamen() {
    archivoExamenSeleccionado = null;
    document.getElementById('input-file-examen').value = '';
    document.getElementById('drop-content-vacio').style.display = 'block';
    document.getElementById('drop-content-archivo').style.display = 'none';
    document.getElementById('drop-icon-examen').className = 'fa-solid fa-cloud-arrow-up';
    document.getElementById('drop-icon-examen').style.color = '#444';
    document.getElementById('drop-zone-examen').style.borderStyle = 'dashed';
    document.getElementById('drop-zone-examen').style.borderColor = '#b1b1b1';
    document.getElementById('drop-zone-examen').style.background = '#f9f9f9';
    document.getElementById('preview-container-examen').style.display = 'none';
    document.getElementById('btn-subir-examen').style.display = 'none';
}

async function subirArchivoExamen() {
    if (!archivoExamenSeleccionado || !pacienteActualData) {
        alert('Debes seleccionar un archivo.');
        return;
    }

    const nombreExamen = document.getElementById('input-nombre-examen').value.trim();
    if (!nombreExamen) {
        alert('Debes asignar un nombre al examen.');
        return;
    }

    const btn = document.getElementById('btn-subir-examen');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';

    try {
        await window.hydraAPI.uploadDocumento(pacienteActualData.rut, archivoExamenSeleccionado);

        const fechaHoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const tablaDocs = document.getElementById('cuerpo-tabla-documentos');

        if (tablaDocs.querySelector('td[colspan]')) {
            tablaDocs.innerHTML = '';
        }

        tablaDocs.insertAdjacentHTML('afterbegin', `
            <tr style="background-color: #f0fdf4;">
                <td>${fechaHoy}</td>
                <td style="font-weight: 700;"><i class="fa-solid fa-file-medical"></i> ${archivoExamenSeleccionado.name}</td>
                <td style="text-align: center;">
                    <span style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Subido
                    </span>
                </td>
            </tr>
        `);

        alert(`¡Examen "${nombreExamen}" subido correctamente!`);
        cerrarModalSubida();
    } catch (error) {
        console.error('Error en subida:', error);
        alert('Error al subir: ' + (error.message || 'Error desconocido'));
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-send"></i> Iniciar Subida';
    }
}

function setupDragDropExam() {
    const dropZone = document.getElementById('drop-zone-examen');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#2563eb';
        dropZone.style.background = '#f0edff';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!archivoExamenSeleccionado) {
            dropZone.style.borderColor = '#b1b1b1';
            dropZone.style.background = '#f9f9f9';
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            document.getElementById('input-file-examen').files = files;
            onFileSelectedExam({ target: { files: files } });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupDragDropExam();
});

// ==========================================================
// CONTACTOS FAMILIARES DEL PACIENTE (perfil)
// ==========================================================
async function cargarContactosFamiliares(rutEnc) {
    const tbody = document.getElementById('cuerpo-contactos-familiares');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Cargando contactos...</td></tr>';

    try {
        const familiares = await window.hydraAPI.getFamiliaresDePaciente(rutEnc);
        if (!familiares || familiares.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Sin contactos registrados</td></tr>';
            return;
        }
        const legibles = await Promise.all(familiares.map(async (f) => {
            const [rut, correo, tel] = await Promise.all([
                desencriptarDato(f.run),
                desencriptarDato(f.correo),
                desencriptarDato(f.telefono)
            ]);
            return { ...f, run: rut, correo, telefono: tel };
        }));

        tbody.innerHTML = '';
        legibles.forEach(f => {
            const nombre = `${f.nombre || ''} ${f.apellidoPaterno || ''} ${f.apellidoMaterno || ''}`.trim();
            tbody.innerHTML += `<tr>
                <td>${nombre || '-'}</td>
                <td>Familiar</td>
                <td>${f.telefono || '-'}</td>
                <td>Correo</td>
                <td>${f.correo || '-'}</td>
            </tr>`;
        });
    } catch (e) {
        console.error('Error cargando contactos familiares:', e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error al cargar contactos.</td></tr>';
    }
}

// ==========================================================
// VINCULAR PACIENTE + FAMILIAR (MANUAL)
// ==========================================================
async function abrirModalVincular() {
    const modal = document.getElementById('modal-vincular-familiar');
    const resultado = document.getElementById('vincular-resultado');
    resultado.style.display = 'none';
    modal.style.display = 'flex';

    const selPaciente = document.getElementById('vincular-paciente-select');
    const selFamiliar = document.getElementById('vincular-familiar-select');
    selPaciente.innerHTML = '<option value="">Cargando pacientes...</option>';
    selFamiliar.innerHTML = '<option value="">Cargando familiares...</option>';

    try {
        const pacientes = await window.hydraAPI.getPacientes();
        const opciones = await Promise.all(pacientes.map(async (p) => {
            const rut = await desencriptarDato(p.runP);
            const nombre = `${p.nombre || ''} ${p.apellidoPaterno || ''} ${p.apellidoMaterno || ''}`.trim();
            return `<option value="${p.runP}">${nombre || 'Paciente'} - ${rut}</option>`;
        }));
        selPaciente.innerHTML = '<option value="">Selecciona un paciente...</option>' + opciones.join('');
    } catch (e) {
        console.error('Error cargando pacientes:', e);
        selPaciente.innerHTML = '<option value="">Error cargando pacientes</option>';
    }

    try {
        const familiares = await window.hydraAPI.getFamiliares();
        const opciones = await Promise.all(familiares.map(async (f) => {
            const rut = await desencriptarDato(f.run);
            const nombre = `${f.nombre || ''} ${f.apellidoPaterno || ''} ${f.apellidoMaterno || ''}`.trim();
            return `<option value="${f.run}">${nombre || 'Familiar'} - ${rut}</option>`;
        }));
        selFamiliar.innerHTML = '<option value="">Selecciona un familiar...</option>' + opciones.join('');
    } catch (e) {
        console.error('Error cargando familiares:', e);
        selFamiliar.innerHTML = '<option value="">Error cargando familiares</option>';
    }
}

function cerrarModalVincular() {
    document.getElementById('modal-vincular-familiar').style.display = 'none';
}

async function vincularFamiliarPaciente() {
    const pacienteRun = document.getElementById('vincular-paciente-select').value;
    const familiarRun = document.getElementById('vincular-familiar-select').value;
    const resultado = document.getElementById('vincular-resultado');

    if (!pacienteRun || !familiarRun) {
        resultado.style.display = 'block';
        resultado.style.background = '#fef2f2';
        resultado.style.color = '#b91c1c';
        resultado.innerText = 'Selecciona un paciente y un familiar.';
        return;
    }

    resultado.style.display = 'block';
    resultado.style.background = '#eff6ff';
    resultado.style.color = '#1d4ed8';
    resultado.innerText = 'Vinculando...';

      try {
          await window.hydraAPI.vincularFamiliar(familiarRun, pacienteRun);
          resultado.style.background = '#f0fdf4';
          resultado.style.color = '#15803d';
          resultado.innerText = '✓ Vínculo creado correctamente!';
          if (pacienteActualData) {
              cargarContactosFamiliares(pacienteActualData.rutEnc || pacienteActualData.rut);
          }
          setTimeout(() => cerrarModalVincular(), 1500);
      } catch (error) {
        console.error('Error al vincular:', error);
        resultado.style.background = '#fef2f2';
        resultado.style.color = '#b91c1c';
        resultado.innerText = 'Error: ' + (error.message || 'No se pudo vincular');
    }
}

// ==========================================================
// DIRECTORIO DE FAMILIARES + ALTA DE NUEVO FAMILIAR
// ==========================================================
async function encriptarDato(textoLimpio) {
    if (!textoLimpio) return null;
    try {
        const url = `https://hydra-arm-security.onrender.com/api/user/cripto/encrypt?texto=${encodeURIComponent(textoLimpio)}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`Error en la API de encriptación: ${res.status}`);
        return await res.text();
    } catch (e) {
        console.error("Fallo de seguridad al encriptar:", e);
        throw new Error("Motor de encriptación apagado o fallando.");
    }
}

let listaFamiliaresLegibles = [];

function verDirectorioFamiliares() {
    document.getElementById('vista-directorio').style.display = 'none';
    document.getElementById('vista-perfil').style.display = 'none';
    document.getElementById('vista-directorio-familiares').style.display = 'block';
    marcaNavActiva('verDirectorioFamiliares');
    cargarFamiliares();
}

async function cargarFamiliares() {
    const tbody = document.getElementById('cuerpo-tabla-familiares');
    try {
        const familiares = await window.hydraAPI.getFamiliares();
        listaFamiliaresLegibles = await Promise.all(familiares.map(async (f) => {
            const [rut, correo, tel] = await Promise.all([
                desencriptarDato(f.run),
                desencriptarDato(f.correo),
                desencriptarDato(f.telefono)
            ]);
            return { ...f, runEnc: f.run, run: rut, correo, telefono: tel };
        }));

        tbody.innerHTML = '';
        if (listaFamiliaresLegibles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);">No hay familiares registrados.</td></tr>';
            return;
        }
        listaFamiliaresLegibles.forEach((f, i) => {
            const apP = f.apellidoPaterno || '';
            const apM = f.apellidoMaterno || '';
            tbody.innerHTML += `<tr>
                <td>${f.run}</td><td>${f.nombre || ''}</td><td>${apP}</td><td>${apM}</td>
                <td>${f.correo}</td><td>${f.telefono}</td><td>${f.edad ?? '-'}</td>
                <td>${f.genero || '-'}</td>
                <td style="display:flex; gap:8px;">
                    <button class="btn-action outline" onclick="verPacientesDeFamiliar(${i})">
                        <i class="fa-solid fa-users"></i> Ver pacientes
                    </button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error('Error cargando familiares:', e);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--danger);">Error al cargar familiares.</td></tr>';
    }
}

async function verPacientesDeFamiliar(i) {
    const f = listaFamiliaresLegibles[i];
    if (!f) return;
    const modal = document.getElementById('modal-pacientes-familiar');
    const tbody = document.getElementById('cuerpo-pacientes-familiar');
    document.getElementById('pacientes-familiar-nombre').innerText = `${f.nombre || ''} ${f.apellidoPaterno || ''}`.trim() || '...';
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Cargando pacientes...</td></tr>';
    modal.style.display = 'flex';

    try {
        const pacientes = await window.hydraAPI.getPacientesDeFamiliar(f.runEnc);
        if (!pacientes || pacientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Este familiar no tiene pacientes vinculados.</td></tr>';
            return;
        }
        const legibles = await Promise.all(pacientes.map(async (p) => {
            const rut = await desencriptarDato(p.runP);
            return { ...p, runP: rut };
        }));
        tbody.innerHTML = '';
        legibles.forEach(p => {
            const apP = p.apellidoPaterno || '';
            const apM = p.apellidoMaterno || '';
            tbody.innerHTML += `<tr><td>${p.runP}</td><td>${p.nombre || ''}</td><td>${apP} ${apM}</td></tr>`;
        });
    } catch (e) {
        console.error('Error cargando pacientes del familiar:', e);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--danger);">Error al cargar pacientes.</td></tr>';
    }
}

function cerrarModalPacientesFamiliar() {
    document.getElementById('modal-pacientes-familiar').style.display = 'none';
}

function abrirModalNuevoFamiliar() {
    const modal = document.getElementById('modal-nuevo-familiar');
    const resultado = document.getElementById('nuevo-familiar-resultado');
    resultado.style.display = 'none';
    ['nf-rut', 'nf-nombre', 'nf-apellido-paterno', 'nf-apellido-materno', 'nf-correo', 'nf-telefono', 'nf-password', 'nf-edad'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const gen = document.getElementById('nf-genero');
    if (gen) gen.value = '';
    modal.style.display = 'flex';
}

function cerrarModalNuevoFamiliar() {
    document.getElementById('modal-nuevo-familiar').style.display = 'none';
}

async function guardarNuevoFamiliar() {
    const v = (id) => document.getElementById(id).value.trim();
    const rut = v('nf-rut'), nombre = v('nf-nombre'), apP = v('nf-apellido-paterno'),
          apM = v('nf-apellido-materno'), correo = v('nf-correo'), telefono = v('nf-telefono'),
          password = v('nf-password');
    const genero = document.getElementById('nf-genero').value;
    const edadRaw = document.getElementById('nf-edad').value;
    const resultado = document.getElementById('nuevo-familiar-resultado');

    if (!rut || !nombre || !correo || !telefono || !password) {
        resultado.style.display = 'block';
        resultado.style.background = '#fef2f2';
        resultado.style.color = '#b91c1c';
        resultado.innerText = 'Completa los campos obligatorios (RUT, Nombre, Correo, Teléfono, Password).';
        return;
    }

    resultado.style.display = 'block';
    resultado.style.background = '#eff6ff';
    resultado.style.color = '#1d4ed8';
    resultado.innerText = 'Guardando familiar...';

    try {
        const [rutE, correoE, telE, passE] = await Promise.all([
            encriptarDato(rut), encriptarDato(correo), encriptarDato(telefono), encriptarDato(password)
        ]);
        const payload = {
            run: rutE,
            nombre,
            apellidoPaterno: apP || null,
            apellidoMaterno: apM || null,
            correo: correoE,
            telefono: telE,
            genero: genero || null,
            edad: edadRaw ? parseInt(edadRaw, 10) : null,
            password: passE
        };
        await window.hydraAPI.crearFamiliar(payload);
        resultado.style.background = '#f0fdf4';
        resultado.style.color = '#15803d';
        resultado.innerText = '¡Familiar registrado correctamente!';
        setTimeout(() => { cerrarModalNuevoFamiliar(); cargarFamiliares(); }, 1500);
    } catch (e) {
        console.error('Error al crear familiar:', e);
        resultado.style.background = '#fef2f2';
        resultado.style.color = '#b91c1c';
        resultado.innerText = 'Error: ' + (e.message || 'No se pudo crear el familiar');
    }
}

// ==========================================
// MÓDULO GPS EN VIVO (Leaflet + API 8082)
// ==========================================

function detenerPollingGPS() {
    if (gpsPollingInterval) {
        clearInterval(gpsPollingInterval);
        gpsPollingInterval = null;
    }
}

function destruirMapaGPS() {
    if (gpsMapa) {
        gpsMapa.remove();
        gpsMapa = null;
        gpsMarker = null;
        gpsRuta = null;
    }
}

function pintarSinSenal(mensaje, detalle) {
    const contenedor = document.getElementById('mapa-gps-contenedor');
    const lblSenal = document.getElementById('gps-ultima-senal');
    if (!contenedor) return;
    destruirMapaGPS();
    contenedor.innerHTML = '<div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#ef4444;">' +
        '<i class="fa-solid fa-location-crosshairs" style="font-size:26px; margin-bottom:8px;"></i>' +
        '<span style="font-size:12px; font-weight:600;">' + mensaje + '</span>' +
        '<span style="font-size:11px; color:#94a3b8;">' + detalle + '</span></div>';
    if (lblSenal) {
        lblSenal.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Sin señal';
        lblSenal.style.color = '#ef4444';
    }
}

async function cargarMapaGPS(rut) {
    if (!rut) return;
    let id = rut;
    if (!/^[0-9a-f]{64}$/.test(id)) {
        try { const h = await getHashRun(rut); if (h) id = h; } catch (e) { }
    }
    if (!id) return;
    const contenedor = document.getElementById('mapa-gps-contenedor');
    const lblSenal = document.getElementById('gps-ultima-senal');
    if (!contenedor || !lblSenal) return;

    try {
        const [resActual, resHistorial] = await Promise.all([
            fetch(API_GPS + '/' + encodeURIComponent(id)),
            fetch(API_GPS + '/' + encodeURIComponent(id) + '/historial?limite=30')
        ]);

        const historial = resHistorial.ok ? await resHistorial.json() : [];
        const puntosRuta = (Array.isArray(historial) ? historial : []).slice().reverse();

        if (!resActual.ok) {
            pintarSinSenal('Sin señal de prótesis', 'El paciente aún no registra ubicaciones.');
            return;
        }

        const ultima = await resActual.json();
        const lat = parseFloat(ultima.latitud);
        const lng = parseFloat(ultima.longitud);
        if (isNaN(lat) || isNaN(lng)) {
            pintarSinSenal('Sin señal de prótesis', 'El paciente aún no registra ubicaciones.');
            return;
        }

        if (!gpsMapa) {
            contenedor.innerHTML = '';
            gpsMapa = L.map(contenedor).setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(gpsMapa);
            gpsMarker = L.marker([lat, lng]).addTo(gpsMapa);
            setTimeout(function () { if (gpsMapa) gpsMapa.invalidateSize(); }, 150);
        } else {
            gpsMapa.setView([lat, lng], Math.max(gpsMapa.getZoom(), 15));
            gpsMarker.setLatLng([lat, lng]);
        }

        if (gpsRuta) { gpsMapa.removeLayer(gpsRuta); gpsRuta = null; }
        const coords = puntosRuta
            .filter(function (p) { return p.latitud != null && p.longitud != null; })
            .map(function (p) { return [parseFloat(p.latitud), parseFloat(p.longitud)]; });
        if (coords.length >= 2) {
            gpsRuta = L.polyline(coords, { color: '#2563eb', weight: 3, dashArray: '6 4' }).addTo(gpsMapa);
        }

        const fecha = ultima.fechaReporte ? new Date(ultima.fechaReporte) : new Date();
        lblSenal.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Señal en vivo - ' +
            fecha.toLocaleTimeString('es-CL');
        lblSenal.style.color = '#16a34a';

    } catch (e) {
        console.error('Error GPS:', e);
        const contenedorErr = document.getElementById('mapa-gps-contenedor');
        if (!contenedorErr) return;
        destruirMapaGPS();
        contenedorErr.innerHTML = '<div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#64748b;">' +
            '<i class="fa-solid fa-tower-cell" style="font-size:26px; margin-bottom:8px;"></i>' +
            '<span style="font-size:12px; font-weight:600;">API de geolocalización no disponible</span>' +
            '<span style="font-size:11px; color:#94a3b8;">Asegúrate de que el servicio 8082 esté corriendo.</span></div>';
        if (lblSenal) {
            lblSenal.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> API no disponible';
            lblSenal.style.color = '#ef4444';
        }
    }
}

function recargarGPS() {
    if (pacienteActualData && pacienteActualData.rut) {
        cargarMapaGPS(pacienteActualData.rut);
    }
}

