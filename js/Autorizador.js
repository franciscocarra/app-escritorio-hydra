document.addEventListener("DOMContentLoaded", () => {
    cargarDatosAutorizador();
    renderizarRecetasDelBucket();
    renderizarSolicitudesProtesis(); // NUEVO: Cargamos las prótesis al abrir
});

function cargarDatosAutorizador() {
    const usuarioString = localStorage.getItem('hydraUser');
    if(usuarioString) {
        const usuario = JSON.parse(usuarioString);
        document.getElementById('auth-name-sidebar').innerText = `Autorizador: ${usuario.nombre} ${usuario.apellidoPaterno}`;
    }
}

// ==========================================
// MÓDULO 1: RECETAS
// ==========================================
function renderizarRecetasDelBucket() {
    const tbody = document.getElementById('lista-recetas-pendientes');
    const recetas = JSON.parse(localStorage.getItem('bucketRecetasPendientes')) || [];

    if(recetas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay recetas pendientes en el bucket actualmente.</td></tr>';
        return;
    }

    tbody.innerHTML = recetas.map((r, index) => {
        const detalleMeds = r.medicamentos.map(m => `${m.medicamento} (${m.dosis})`).join('<br>');
        return `
            <tr>
                <td><strong>${r.paciente}</strong><br><span style="font-size:11px; color:#64748b;">${r.rut}</span></td>
                <td>${r.fecha}</td>
                <td style="color:#2563eb; font-family: monospace; font-size:12px;"><i class="fa-solid fa-file-invoice"></i> ${r.archivo}</td>
                <td style="font-size:12px; line-height:1.4;">${detalleMeds}</td>
                <td style="display: flex; gap: 8px;">
                    <button class="btn-action" style="background-color: #10b981; color: white; border: none; padding: 6px 12px; font-size: 12px;" onclick="visarReceta(${index}, true)">Visar</button>
                    <button class="btn-action outline" style="color: #ef4444; border-color: #ef4444; padding: 6px 12px; font-size: 12px;" onclick="visarReceta(${index}, false)">Rechazar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function visarReceta(index, aprobado) {
    let recetas = JSON.parse(localStorage.getItem('bucketRecetasPendientes')) || [];
    if(aprobado) {
        alert(`La receta ${recetas[index].archivo} fue visada con éxito. Se habilitará su despacho en farmacia.`);
    } else {
        alert(`La receta ${recetas[index].archivo} fue rechazada y devuelta al médico tratante.`);
    }
    recetas.splice(index, 1);
    localStorage.setItem('bucketRecetasPendientes', JSON.stringify(recetas));
    renderizarRecetasDelBucket(); 
}

// ==========================================
// MÓDULO 2: PRÓTESIS (NUEVO)
// ==========================================
function renderizarSolicitudesProtesis() {
    const tbody = document.getElementById('lista-solicitudes-pendientes');
    const solicitudes = JSON.parse(localStorage.getItem('bucketSolicitudesPendientes')) || [];

    if(solicitudes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay órdenes de prótesis pendientes.</td></tr>';
        return;
    }

    tbody.innerHTML = solicitudes.map((s, index) => {
        return `
            <tr>
                <td><strong>${s.rut}</strong></td>
                <td><strong style="color: #0f172a;">${s.modelo}</strong></td>
                <td style="font-size: 12px; color: #475569; max-width: 250px;">${s.justificacion}</td>
                <td style="color: #16a34a; font-weight: 600;">${s.costo} CLP</td>
                <td style="display: flex; gap: 8px;">
                    <button class="btn-action" style="background-color: #10b981; color: white; border: none; padding: 6px 12px; font-size: 12px;" onclick="gestionarProtesis(${index}, true)">Aprobar</button>
                    <button class="btn-action outline" style="color: #ef4444; border-color: #ef4444; padding: 6px 12px; font-size: 12px;" onclick="gestionarProtesis(${index}, false)">Rechazar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function gestionarProtesis(index, aprobado) {
    let solicitudes = JSON.parse(localStorage.getItem('bucketSolicitudesPendientes')) || [];
    let modelo = solicitudes[index].modelo;

    if(aprobado) {
        alert(`¡Orden Aprobada!\nEl presupuesto fue liberado y la manufactura de la prótesis ${modelo} ha comenzado.`);
    } else {
        alert(`Orden Rechazada.\nLa solicitud del modelo ${modelo} fue devuelta al médico por falta de justificación o fondos.`);
    }

    // Eliminamos la solicitud de la lista pendiente
    solicitudes.splice(index, 1);
    localStorage.setItem('bucketSolicitudesPendientes', JSON.stringify(solicitudes));
    renderizarSolicitudesProtesis(); // Refrescar la tabla

// ==========================================
// MÓDULO 3: COBERTURA FINANCIERA (CONECTADO)
// ==========================================
function mostrarFinanzasPaciente() {
    const rutSeleccionado = document.getElementById('auth-paciente-select').value;
    const txtPrevision = document.getElementById('auth-val-prev-seg');
    const txtCobertura = document.getElementById('auth-val-cob');

    // Si vuelve a la opción vacía "-- Seleccione un paciente --"
    if (!rutSeleccionado) {
        txtPrevision.innerText = "---";
        txtCobertura.innerHTML = "---";
        txtCobertura.style.color = "#16a34a"; // Color verde por defecto
        return;
    }

    // Buscamos si el médico guardó un expediente financiero para este RUT
    const dataGuardada = localStorage.getItem('finanzas_paciente_' + rutSeleccionado);
    
    if (dataGuardada) {
        const datos = JSON.parse(dataGuardada);
        
        // Formateamos para que se vea: "Isapre Banmédica + Seguro MetLife"
        txtPrevision.innerText = `${datos.prevision} + ${datos.seguro}`;
        
        // Imprimimos la cobertura
        txtCobertura.innerHTML = `<i class="fa-solid fa-circle-check"></i> Cobertura asignada: ${datos.cobertura}`;
        txtCobertura.style.color = "#16a34a"; // Color verde éxito
        
    } else {
        // Si el médico no guardó nada en el perfil
        txtPrevision.innerText = "Sin expediente financiero";
        txtCobertura.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Datos no registrados por el médico`;
        txtCobertura.style.color = "#ef4444"; // Color rojo alerta
    }
}

}