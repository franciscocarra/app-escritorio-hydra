// ==========================================
// 1. CARGA INICIAL DE PACIENTES
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    cargarDatosMedico();
    cargarPacientes();
});

let pacienteActualData = null; // Memoria temporal para el paciente que se está viendo
let listaRecetaActual = [];

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
                
                // DOS BOTONES EN LA TABLA: PERFIL Y DASHBOARD
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
    // Guardamos los datos para usarlos si presiona el Dashboard dentro del perfil
    pacienteActualData = { nombreCompleto: `${nombre} ${apP}`, rut: rut };

    // Llenamos la UI de la cabecera y el Grid
    const iniciales = `${nombre.charAt(0).toUpperCase()}${apP.charAt(0).toUpperCase()}`;
    document.getElementById('pac-iniciales').innerText = iniciales;
    document.getElementById('pac-nombre-completo').innerText = `${nombre} ${apP} ${apM}`;
    document.getElementById('pac-rut-header').innerText = `RUN: ${rut}`;
    document.getElementById('pac-rut-grid').innerText = rut;
    document.getElementById('pac-fono').innerText = fono;

    // Cambiamos la vista (Ocultamos tabla, mostramos el perfil completo)
    document.getElementById('vista-directorio').style.display = 'none';
    document.getElementById('vista-perfil').style.display = 'block';
}

function volverAlDirectorio() {
    document.getElementById('vista-perfil').style.display = 'none';
    document.getElementById('vista-directorio').style.display = 'block';
    pacienteActualData = null;
}

// ==========================================
// 3. GENERADOR DE DATOS DE DASHBOARD (14 DÍAS)
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
// 4. LÓGICA DEL MODAL DE RECETAS (MÚLTIPLES ITEMS)
// ==========================================
function abrirModalReceta() {
    document.getElementById('modal-receta').style.display = 'flex';
    renderizarListaReceta(); // Refresca la lista visual
}

function cerrarModalReceta() {
    document.getElementById('modal-receta').style.display = 'none';
    document.getElementById('receta-med').value = '';
    document.getElementById('receta-dosis').value = '';
    listaRecetaActual = []; // Vaciamos el carrito al cerrar
}

function agregarMedicamentoAReceta() {
    const med = document.getElementById('receta-med').value.trim();
    const dosis = document.getElementById('receta-dosis').value.trim();

    if(!med || !dosis) {
        alert("Por favor, ingresa el medicamento y la dosis antes de agregar."); 
        return;
    }

    // Guardamos en el arreglo temporal
    listaRecetaActual.push({ medicamento: med, dosis: dosis });
    
    // Limpiamos los inputs para el siguiente
    document.getElementById('receta-med').value = '';
    document.getElementById('receta-dosis').value = '';
    
    // Actualizamos el recuadro visual
    renderizarListaReceta();
}

function renderizarListaReceta() {
    const contenedor = document.getElementById('contenedor-lista-receta');
    
    if(listaRecetaActual.length === 0) {
        contenedor.innerHTML = '<p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 35px;">No hay medicamentos añadidos aún.</p>';
        return;
    }

    // Dibujamos cada medicamento agregado con un botón para eliminar (Basurero)
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
    if(listaRecetaActual.length === 0) {
        alert("Debes agregar al menos un medicamento a la lista antes de emitir la receta."); 
        return;
    }

    // Aquí ya tienes el arreglo completo listo para enviar a la base de datos
    console.log("Receta Lista para Base de Datos:", listaRecetaActual);
    
    alert(`¡Firma digital exitosa! Receta con ${listaRecetaActual.length} medicamentos guardada y enviada.`);
    cerrarModalReceta();
}

// Función que lee la sesión y pone el nombre en el Sidebar
function cargarDatosMedico() {
    const usuarioString = localStorage.getItem('hydraUser');
    if(usuarioString) {
        const usuario = JSON.parse(usuarioString);
        // Colocamos el nombre y apellido paterno
        document.getElementById('doc-name-sidebar').innerText = `Dr. ${usuario.nombre} ${usuario.apellidoPaterno}`;
    } else {
        // Si no hay sesión, lo devuelve al login por seguridad
        window.location.href = 'Login.html';
    }
}
