let listaExamenesOriginal = [];

// Apenas carga la pantalla, leemos la memoria local
document.addEventListener("DOMContentLoaded", () => {
    const dataGuardada = localStorage.getItem('pacienteSeleccionado');
    
    // Si alguien entra directo a perfil.html sin seleccionar paciente, lo devolvemos
    if (!dataGuardada) {
        window.location.href = '../Vista/dashboard.html';
        return;
    }

    const paciente = JSON.parse(dataGuardada);
    pintarDatosPerfil(paciente);
    cargarFoto(paciente.rutReal);
    cargarExamenes(paciente.rutReal);
});

function pintarDatosPerfil(paciente) {
    const nombreCompleto = `${paciente.nombre} ${paciente.apPaterno} ${paciente.apMaterno}`;
    document.getElementById('perfil-nombre-completo').innerText = nombreCompleto.toUpperCase();
    
    const iniciales = `${paciente.nombre.charAt(0)}${paciente.apPaterno.charAt(0)}`.toUpperCase();
    document.getElementById('perfil-iniciales').innerText = iniciales;

    document.getElementById('perfil-rut-header').innerText = `RUN: ${paciente.rutReal}`;
    document.getElementById('perfil-rut-detalle').innerText = paciente.rutReal;
    document.getElementById('perfil-telefono-detalle').innerText = paciente.fonoReal;
}

async function cargarFoto(rutReal) {
    const avatarContainer = document.getElementById('perfil-avatar-container');
    try {
        const url = `http://localhost:8081/api/pacientes/perfil/foto?run=${encodeURIComponent(rutReal)}`;
        const res = await fetch(url);
        if (res.ok) {
            const urlFoto = await res.text();
            if(urlFoto) {
                avatarContainer.innerHTML = `<img src="${urlFoto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            }
        }
    } catch (e) { console.log("No hay foto o API apagada."); }
}

async function cargarExamenes(rutReal) {
    try {
        const url = `http://localhost:8081/api/pacientes/${encodeURIComponent(rutReal)}/documentos`;
        const res = await fetch(url);
        let dataTemporal = [];
        
        if (res.ok) {
            const resp = await res.json();
            if (Array.isArray(resp) && resp.length > 0 && resp[0].documentos) {
                dataTemporal = resp[0].documentos;
            } else if (resp && resp.documentos) {
                dataTemporal = resp.documentos;
            } else if (Array.isArray(resp)) {
                dataTemporal = resp; 
            }
        }
        
        listaExamenesOriginal = dataTemporal;
        renderExamenes(listaExamenesOriginal);
    } catch (e) {
        console.error("Error al obtener exámenes", e);
        renderExamenes([]);
    }
}

function renderExamenes(lista) {
    const tbody = document.getElementById('tabla-documentos');
    tbody.innerHTML = '';
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No hay exámenes registrados.</td></tr>';
        return;
    }
    
    lista.forEach(doc => {
        let fecha = 'Sin fecha';
        if(doc.fechaCreacion) {
            const parts = doc.fechaCreacion.split('T')[0].split('-');
            if(parts.length === 3) fecha = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        
        const fila = `<tr>
            <td>${fecha}</td>
            <td><strong>${doc.nombre || 'Documento Médico'}</strong></td>
            <td style="text-align: center;"><a href="${doc.url || '#'}" target="_blank" class="btn-action outline" style="text-decoration:none;"><i class="fa-solid fa-download"></i> Descargar</a></td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', fila);
    });
}

function filtrarPorFecha(fecha) {
    if (fecha) {
        document.getElementById('btn-limpiar-filtro').style.display = 'inline-block';
        const filtrados = listaExamenesOriginal.filter(doc => doc.fechaCreacion && doc.fechaCreacion.includes(fecha));
        renderExamenes(filtrados);
    } else {
        limpiarFiltro();
    }
}

function limpiarFiltro() {
    document.getElementById('filtro-fecha').value = '';
    document.getElementById('btn-limpiar-filtro').style.display = 'none';
    renderExamenes(listaExamenesOriginal); 
}