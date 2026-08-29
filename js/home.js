// ==========================================
// VARIABLES GLOBALES
// ==========================================
let pacienteActualData = null;
let listaRecetaActual = [];
let archivoExamenSeleccionado = null;

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
    // Memoria del paciente actual
    const pacObj = { nombre, apP, apM, rut, fono };
    localStorage.setItem('pacienteActivo', JSON.stringify(pacObj));
    pacienteActualData = { nombreCompleto: `${nombre} ${apP}`, rut: rut, rutEnc: rutEnc || rut };

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
}

function volverAlDirectorio() {
    // Si vuelve a la tabla general, borramos la memoria del paciente activo
    localStorage.removeItem('pacienteActivo');
    pacienteActualData = null;

    document.getElementById('vista-perfil').style.display = 'none';
    document.getElementById('vista-directorio').style.display = 'block';
    document.getElementById('vista-directorio-familiares').style.display = 'none';

    marcaNavActiva('volverAlDirectorio');

    // Limpiamos la URL para que no se quede pegado el "?return=perfil"
    window.history.replaceState({}, document.title, window.location.pathname);
}

function marcaNavActiva(fn) {
    const navItems = document.querySelectorAll('.sidebar nav p');
    navItems.forEach(p => {
        const esActivo = p.getAttribute('onclick') && p.getAttribute('onclick').includes(fn);
        p.classList.toggle('active', !!esActivo);
    });
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

