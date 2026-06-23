document.addEventListener("DOMContentLoaded", () => {
    cargarDatosCuidador();
    inicializarTablaPacientes();
    renderizarCanalAlertas(); // Dibuja las alertas filtradas al cargar
});

let pacienteBandejaActual = { nombre: '', rut: '' };

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
const pacientesCuidador = [
    { rut: "21.799.988-k", nombre: "Luis", apellido: "Jofré Aguirre", fono: "993499568", notificaciones: 3 },
    { rut: "19.432.105-8", nombre: "Valentina", apellido: "Morales Castro", fono: "987452136", notificaciones: 0 },
    { rut: "15.890.334-2", nombre: "Andrés", apellido: "Sepúlveda Rojas", fono: "965412387", notificaciones: 1 }
];

function inicializarTablaPacientes() {
    const tbody = document.getElementById('tabla-pacientes-cuidador');
    tbody.innerHTML = '';

    pacientesCuidador.forEach(p => {
        let badgeNotificacion = '';
        if (p.notificaciones > 0) {
            badgeNotificacion = `<span class="badge-notificacion">${p.notificaciones}</span>`;
        }

        const nombreCompleto = `${p.nombre} ${p.apellido}`;

        const fila = `<tr>
            <td>${p.rut}</td>
            <td>${p.nombre}</td>
            <td>${p.apellido}</td>
            <td>${p.fono}</td>
            <td>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-action outline" style="display: flex; align-items: center; justify-content: center; padding: 8px 12px;" onclick="abrirBandejaMensajes('${nombreCompleto}', '${p.rut}', ${p.notificaciones})">
                        <i class="fa-solid fa-envelope" style="margin-right: 5px;"></i> Mensajes ${badgeNotificacion}
                    </button>
                    <button class="btn-action outline" style="border-color: #10b981; color: #10b981; display: flex; align-items: center; justify-content: center; padding: 8px 12px;" onclick="abrirChatPaciente('${nombreCompleto}', '${p.rut}')">
                        <i class="fa-brands fa-whatsapp" style="font-size: 15px; margin-right: 5px;"></i> Chat
                    </button>
                </div>
            </td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', fila);
    });
}

// ==========================================
// SPA: SISTEMA DE BANDEJA Y CHAT
// ==========================================
function abrirBandejaMensajes(nombreCompleto, rut, cantidadNotificaciones) {
    pacienteBandejaActual = { nombre: nombreCompleto, rut: rut };

    document.getElementById('vista-principal-cuidador').style.display = 'none';
    document.getElementById('vista-chat-paciente').style.display = 'none';
    document.getElementById('vista-bandeja-mensajes').style.display = 'block';

    document.getElementById('bandeja-nombre-paciente').innerText = `Mensajes Institucionales: ${nombreCompleto}`;
    document.getElementById('bandeja-rut-paciente').innerText = `RUN: ${rut}`;

    const contenedor = document.getElementById('contenedor-mensajes');
    
    if (cantidadNotificaciones === 0) {
        contenedor.innerHTML = '<p style="text-align: center; color: #94a3b8; margin-top: 50px;">No hay mensajes nuevos ni alertas de la clínica para este paciente.</p>';
        return;
    }

    let mensajesHTML = `
        <div class="mensaje-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 700; color: #2563eb;"><i class="fa-solid fa-user-doctor"></i> DEPARTAMENTO MÉDICO</span>
                <span style="font-size: 11px; color: #64748b;">Hoy, 09:30 AM</span>
            </div>
            <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 5px;">Receta Médica Visada y Disponible</strong>
            <p style="margin: 0; font-size: 13px; color: #334155;">La receta emitida para este paciente ya ha sido aprobada por el Autorizador. Puede dirigirse a farmacia para el retiro.</p>
        </div>
    `;

    if (cantidadNotificaciones > 1) {
        mensajesHTML += `
            <div class="mensaje-card critico">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 11px; font-weight: 700; color: #ef4444;"><i class="fa-solid fa-robot"></i> SOPORTE TÉCNICO HYDRA</span>
                    <span style="font-size: 11px; color: #64748b;">Ayer, 18:45 PM</span>
                </div>
                <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 5px;">Alerta de Telemetría Biónica</strong>
                <p style="margin: 0; font-size: 13px; color: #334155;">El dispositivo reportó un sobrecalentamiento del servomotor. Por favor, asegúrese de apagar la prótesis durante 1 hora.</p>
            </div>
        `;
    }

    contenedor.innerHTML = mensajesHTML;

    // Elimina la burbuja al leer los mensajes
    const pacienteIndex = pacientesCuidador.findIndex(p => p.rut === rut);
    if (pacienteIndex !== -1) { pacientesCuidador[pacienteIndex].notificaciones = 0; }
}

function abrirChatPaciente(nombreCompleto, rut) {
    // ESTO ES LO NUEVO: Guarda el nombre para que el botón de ambulancia sepa a quién despachar
    pacienteBandejaActual = { nombre: nombreCompleto, rut: rut };
    
    document.getElementById('vista-principal-cuidador').style.display = 'none';
    document.getElementById('vista-bandeja-mensajes').style.display = 'none';
    
    document.getElementById('chat-nombre-paciente').innerText = nombreCompleto;
    document.getElementById('vista-chat-paciente').style.display = 'block';
}

function volverAlDirectorioCuidador() {
    document.getElementById('vista-bandeja-mensajes').style.display = 'none';
    document.getElementById('vista-chat-paciente').style.display = 'none';
    document.getElementById('vista-principal-cuidador').style.display = 'block';
    inicializarTablaPacientes();
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