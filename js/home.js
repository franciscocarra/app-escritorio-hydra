// ==========================================
// VARIABLES GLOBALES
// ==========================================
let pacienteActualData = null;
let listaRecetaActual = []; // Aquí se guardan los medicamentos temporalmente

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosMedico();
    cargarPacientes();

    // MAGIA: Si la URL dice "?return=perfil", significa que venimos del Dashboard.
    // Restauramos automáticamente el perfil del paciente.
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('return') === 'perfil') {
        const pacGuardado = localStorage.getItem('pacienteActivo');
        if(pacGuardado) {
            const p = JSON.parse(pacGuardado);
            abrirPerfil(p.nombre, p.apP, p.apM, p.rut, p.fono);
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
        document.getElementById('doc-name-sidebar').innerText = `Dr. ${usuario.nombre} ${usuario.apellidoPaterno}`;
    } else {
        window.location.href = 'Login.html';
    }
}

async function desencriptarDato(hash) {
    if (!hash || hash === 'null' || hash.length < 15) return hash || 'Sin registro';
    try {
        const url = `http://localhost:8081/api/user/cripto/decrypt?codigo=${encodeURIComponent(hash)}`;
        const res = await fetch(url);
        return res.ok ? await res.text() : "Error descifrado";
    } catch (e) { return "Error API"; }
}

async function cargarPacientes() {
    const urlAPI = 'http://localhost:8080/api/pacientes';
    const credenciales = btoa(`user:dc20f0e4-b1bc-4969-a01c-cbb8282c805f`); 
    
    try {
        const tbody = document.getElementById('cuerpo-tabla-pacientes');
        const res = await fetch(urlAPI, { headers: { 'Authorization': `Basic ${credenciales}` }});
        
        if (res.ok) {
            const cifrados = await res.json(); 
            const promesas = cifrados.map(async (p) => {
                const [rut, tel] = await Promise.all([desencriptarDato(p.runP), desencriptarDato(p.telefono)]);
                return { ...p, runP: rut, telefono: tel };
            });
            const legibles = await Promise.all(promesas);

            tbody.innerHTML = ''; 
            legibles.forEach(p => {
                const apP = p.apellidoPaterno || ''; const apM = p.apellidoMaterno || '';
                const nombreCompleto = `${p.nombre} ${apP}`;
                
                const fila = `<tr>
                    <td>${p.runP}</td><td>${p.nombre}</td><td>${apP} ${apM}</td><td>${p.telefono}</td>
                    <td style="display: flex; gap: 8px;">
                        <button class="btn-action outline" style="display: flex; align-items: center; gap: 5px;" onclick="abrirPerfil('${p.nombre}', '${apP}', '${apM}', '${p.runP}', '${p.telefono}')">
                            <i class="fa-solid fa-user-doctor"></i> Perfil Clínico
                        </button>
                        <button class="btn-action" style="background-color: #8b5cf6; color: white; border: none; display: flex; align-items: center; gap: 5px;" onclick="irAlDashboard('${nombreCompleto}', '${p.runP}')">
                            <i class="fa-solid fa-chart-line"></i> Dashboard
                        </button>
                    </td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// 2. INTERCAMBIO DE VISTAS (TABLA <-> PERFIL)
// ==========================================
function abrirPerfil(nombre, apP, apM, rut, fono) {
    // Memoria del paciente actual
    const pacObj = { nombre, apP, apM, rut, fono };
    localStorage.setItem('pacienteActivo', JSON.stringify(pacObj));
    pacienteActualData = { nombreCompleto: `${nombre} ${apP}`, rut: rut };

    // Inyectamos iniciales y datos en cabecera
    const iniciales = `${nombre.charAt(0).toUpperCase()}${apP.charAt(0).toUpperCase()}`;
    document.getElementById('pac-iniciales').innerText = iniciales;
    document.getElementById('pac-nombre-completo').innerText = `${nombre} ${apP} ${apM}`;
    document.getElementById('pac-rut-header').innerText = `RUN: ${rut}`;
    document.getElementById('pac-rut-grid').innerText = rut;
    document.getElementById('pac-fono').innerText = fono;

    // NUEVO: Verificamos si este paciente ya tiene datos financieros guardados
    actualizarVistaFinanzasModulo(rut);

    // Cambiamos de vista
    document.getElementById('vista-directorio').style.display = 'none';
    document.getElementById('vista-perfil').style.display = 'block';
}

function volverAlDirectorio() {
    // Si vuelve a la tabla general, borramos la memoria del paciente activo
    localStorage.removeItem('pacienteActivo');
    pacienteActualData = null;

    document.getElementById('vista-perfil').style.display = 'none';
    document.getElementById('vista-directorio').style.display = 'block';

    // Limpiamos la URL para que no se quede pegado el "?return=perfil"
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ==========================================
// 3. GENERADOR DE DATOS DE DASHBOARD
// ==========================================
function irAlDashboard(nombrePaciente, rutPaciente) {
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

    const dataDashboard = { paciente: nombrePaciente, rut: rutPaciente, telemetria: datos14Dias };
    localStorage.setItem('dashboardTemporal', JSON.stringify(dataDashboard));
    
    window.location.href = 'dashboard.html';
}

function generarDashboardActual() {
    if(pacienteActualData) {
        irAlDashboard(pacienteActualData.nombreCompleto, pacienteActualData.rut);
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
    
