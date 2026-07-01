// ==========================================
// VARIABLES GLOBALES
// ==========================================
let listaEmpleadosOriginal = [];
let listaPacientesOriginal = []; 

// ⚠️ ACTUALIZA LA CONTRASEÑA DE SPRING BOOT HOY AQUÍ ⚠️
function getAuthHeaders() {
    const token = localStorage.getItem('hydra_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

document.addEventListener("DOMContentLoaded", () => {
    cargarPacientesAdmin();
});

// ==========================================
// MOTOR DE CRIPTOGRAFÍA (API 8081) - MODO ESTRICTO
// ==========================================
async function desencriptarDato(hash) {
    if (!hash || hash === 'null' || hash.length < 15) return hash || 'Sin registro';
    try {
        const url = `https://hydra-arm-security.onrender.com/api/user/cripto/decrypt?codigo=${encodeURIComponent(hash)}`;
        const res = await fetch(url);
        return res.ok ? await res.text() : "Error descifrado";
    } catch (e) { return "Error API"; }
}

async function encriptarDato(textoLimpio) {
    if (!textoLimpio) return null;
    try {
        const url = `https://hydra-arm-security.onrender.com/api/user/cripto/encrypt?texto=${encodeURIComponent(textoLimpio)}`;
        const res = await fetch(url, { method: 'GET' }); 
        
        if (!res.ok) {
            throw new Error(`Error en la API de encriptación: ${res.status}`);
        }
        return await res.text(); 
    } catch (e) { 
        console.error("Fallo de seguridad al encriptar:", e);
        throw new Error("Motor de encriptación apagado o fallando."); 
    }
}

// ==========================================
// LÓGICA DE PESTAÑAS Y MODALES
// ==========================================
function cambiarDirectorio(tipo) {
    const btnPacientes = document.getElementById('btn-tab-pacientes');
    const btnEmpleados = document.getElementById('btn-tab-empleados');
    const contPacientes = document.getElementById('contenedor-pacientes');
    const contEmpleados = document.getElementById('contenedor-empleados');
    const filtrosEmpleados = document.getElementById('filtros-empleados');
    const filtrosPacientes = document.getElementById('filtros-pacientes'); 

    if (tipo === 'pacientes') {
        btnPacientes.classList.remove('outline');
        btnEmpleados.classList.add('outline');
        contPacientes.style.display = 'block';
        contEmpleados.style.display = 'none';
        filtrosPacientes.style.display = 'flex'; 
        filtrosEmpleados.style.display = 'none'; 

        cargarPacientesAdmin();
    } else if (tipo === 'empleados') {
        btnEmpleados.classList.remove('outline');
        btnPacientes.classList.add('outline');
        contEmpleados.style.display = 'block';
        contPacientes.style.display = 'none';
        filtrosEmpleados.style.display = 'flex'; 
        filtrosPacientes.style.display = 'none'; 

        cargarEmpleadosAdmin();
    }
}

function abrirModalAgregar(tipo) {
    if (tipo === 'paciente') {
        document.getElementById('modal-agregar-paciente').style.display = 'flex';
    } else if (tipo === 'empleado') {
        document.getElementById('modal-agregar-empleado').style.display = 'flex';
    }
}

function cerrarModalAgregar(tipo) {
    if (tipo === 'paciente') {
        document.getElementById('modal-agregar-paciente').style.display = 'none';
        document.getElementById('form-nuevo-paciente').reset(); 
    } else if (tipo === 'empleado') {
        document.getElementById('modal-agregar-empleado').style.display = 'none';
        document.getElementById('form-nuevo-empleado').reset(); 
    }
}

// ==========================================
// MÓDULO: PACIENTES 
// ==========================================
async function cargarPacientesAdmin() {
    const urlAPI = 'https://hydra-arm-crud.onrender.com/api/pacientes';
    
    try {
        const tbody = document.getElementById('cuerpo-tabla-pacientes');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--primary);">Consultando BD y Desencriptando datos <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

        const res = await fetch(urlAPI, { headers: { 'Authorization': `Bearer ${localStorage.getItem('hydra_token')}` }});
        if (res.ok) {
            const cifrados = await res.json(); 
            const promesas = cifrados.map(async (p) => {
                const [rut, tel] = await Promise.all([desencriptarDato(p.runP), desencriptarDato(p.telefono)]);
                return { ...p, runP_Legible: rut, telefono_Legible: tel }; 
            });
            
            listaPacientesOriginal = await Promise.all(promesas); 
            renderPacientes(listaPacientesOriginal);
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--danger);">Error al conectar con la API. Código: ${res.status}</td></tr>`;
        }
    } catch (e) { console.error(e); }
}

function renderPacientes(lista) {
    const tbody = document.getElementById('cuerpo-tabla-pacientes');
    tbody.innerHTML = ''; 

    if(lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No se encontraron pacientes que coincidan con la búsqueda.</td></tr>';
        return;
    }

    lista.forEach(p => {
        const apP = p.apellidoPaterno || ''; const apM = p.apellidoMaterno || '';
        const fila = `<tr>
            <td>${p.runP_Legible}</td><td>${p.nombre}</td><td>${apP} ${apM}</td><td>${p.telefono_Legible}</td>
            <td>
                <button class="btn-action outline">Editar</button> 
                <button class="btn-action danger"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', fila);
    });
}

function filtrarPacientesAdmin() {
    const rutBuscado = document.getElementById('filtro-rut-pac').value.toLowerCase().trim();
    const pacientesFiltrados = listaPacientesOriginal.filter(pac => {
        return pac.runP_Legible.toLowerCase().includes(rutBuscado);
    });
    renderPacientes(pacientesFiltrados);
}

async function guardarNuevoPaciente() {
    const rutInput = document.getElementById('nuevo-pac-rut').value.trim();
    const telInput = document.getElementById('nuevo-pac-tel').value.trim();
    const nombreInput = document.getElementById('nuevo-pac-nombre').value.trim();
    const apPaternoInput = document.getElementById('nuevo-pac-apPaterno').value.trim();
    const apMaternoInput = document.getElementById('nuevo-pac-apMaterno').value.trim();
    const generoInput = document.getElementById('nuevo-pac-genero').value;
    const correoInput = document.getElementById('nuevo-pac-correo').value.trim();
    const passInput = document.getElementById('nuevo-pac-password').value.trim();
    const edadInput = document.getElementById('nuevo-pac-edad').value;
    const alturaInput = document.getElementById('nuevo-pac-altura').value;
    const pesoInput = document.getElementById('nuevo-pac-peso').value;

    if(!rutInput || !telInput || !nombreInput || !apPaternoInput) {
        alert("Por favor, llena los campos principales (RUT, Teléfono, Nombre y Apellido).");
        return;
    }

    try {
        const rutEncriptado = await encriptarDato(rutInput);
        const telEncriptado = await encriptarDato(telInput);
        const correoEncriptado = correoInput ? await encriptarDato(correoInput) : null;
        const passEncriptado = passInput ? await encriptarDato(passInput) : null;

        const pacienteData = {
            runP: rutEncriptado,
            nombre: nombreInput,
            apellidoPaterno: apPaternoInput,
            apellidoMaterno: apMaternoInput,
            correo: correoEncriptado,
            password: passEncriptado,
            genero: generoInput,
            edad: edadInput ? parseInt(edadInput) : null,
            altura: alturaInput ? parseInt(alturaInput) : null,
            peso: pesoInput ? parseInt(pesoInput) : null,
            telefono: telEncriptado
        };

        const res = await fetch('https://hydra-arm-crud.onrender.com/api/pacientes', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('hydra_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pacienteData)
        });

        if(res.ok || res.status === 201) {
            alert("¡Paciente guardado exitosamente!");
            cerrarModalAgregar('paciente');
            cargarPacientesAdmin(); 
        } else {
            alert("Error al guardar paciente en el servidor. Código HTTP: " + res.status);
        }

    } catch(errorSeguridad) {
        console.error(errorSeguridad);
        alert("⚠️ ALERTA DE SEGURIDAD: No se pudo conectar con el motor de encriptación (Puerto 8081).");
    }
}

// ==========================================
// MÓDULO: EMPLEADOS 
// ==========================================
async function cargarEmpleadosAdmin() {
    const urlAPI = 'https://hydra-arm-crud.onrender.com/api/empleados'; 
    
    try {
        const tbody = document.getElementById('cuerpo-tabla-empleados');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--primary);">Buscando Empleados... <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

        const res = await fetch(urlAPI, { headers: { 'Authorization': `Bearer ${localStorage.getItem('hydra_token')}` }});
        if (res.ok) {
            const cifrados = await res.json(); 
            
            // 🛑 REGLA DE NEGOCIO: Filtramos a los Administradores (rol 1) para que no se muestren
            const sinAdmins = cifrados.filter(emp => emp.rolIdRol !== 1);

            // Ahora solo desencriptamos a los médicos, autorizadores y cuidadores
            const promesas = sinAdmins.map(async (emp) => {
                const rutReal = await desencriptarDato(emp.run);
                return { ...emp, rutLegible: rutReal };
            });
            
            listaEmpleadosOriginal = await Promise.all(promesas);
            renderEmpleados(listaEmpleadosOriginal);
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--danger);">Error conectando a la API de Empleados.</td></tr>`;
        }
    } catch (e) { 
        console.error(e);
        document.getElementById('cuerpo-tabla-empleados').innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">No se pudo conectar a la API de Empleados.</td></tr>';
    }
}

function renderEmpleados(lista) {
    const tbody = document.getElementById('cuerpo-tabla-empleados');
    tbody.innerHTML = '';
    
    if(lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No hay empleados registrados.</td></tr>';
        return;
    }

    lista.forEach(emp => {
        const apP = emp.apellidoPaterno || ''; const apM = emp.apellidoMaterno || '';
        
        let rol = 'Sin Rol';
        let badgeClass = 'bg-info'; 

        if (emp.rolIdRol === 2) { rol = 'Médico'; badgeClass = 'bg-success'; }
        else if (emp.rolIdRol === 3) { rol = 'Autorizador'; badgeClass = 'bg-primary'; }
        else if (emp.rolIdRol === 4) { rol = 'Cuidador'; badgeClass = 'bg-secondary'; }

        const fila = `<tr>
            <td>${emp.rutLegible}</td>
            <td>${emp.nombre || 'N/A'}</td>
            <td>${apP} ${apM}</td>
            <td><span class="badge ${badgeClass}">${rol}</span></td>
            <td>
                <button class="btn-action outline">Editar</button> 
                <button class="btn-action danger"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', fila);
    });
}

function aplicarFiltros() {
    const rutBuscado = document.getElementById('filtro-rut-emp').value.toLowerCase().trim();
    const rolBuscado = document.getElementById('filtro-rol-emp').value.toLowerCase();

    const empleadosFiltrados = listaEmpleadosOriginal.filter(emp => {
        const coincideRut = emp.rutLegible.toLowerCase().includes(rutBuscado);
        
        // Convertimos el ID al formato de búsqueda ("medico", "autorizador", "cuidador")
        let rolTexto = '';
        if (emp.rolIdRol === 2) rolTexto = 'medico';
        if (emp.rolIdRol === 3) rolTexto = 'autorizador';
        if (emp.rolIdRol === 4) rolTexto = 'cuidador';

        const coincideRol = (rolBuscado === '') || rolTexto === rolBuscado;

        return coincideRut && coincideRol;
    });

    renderEmpleados(empleadosFiltrados);
}

async function guardarNuevoEmpleado() {
    const rutInput = document.getElementById('nuevo-emp-rut').value.trim();
    const nombreInput = document.getElementById('nuevo-emp-nombre').value.trim();
    const apPaternoInput = document.getElementById('nuevo-emp-apPaterno').value.trim();
    const apMaternoInput = document.getElementById('nuevo-emp-apMaterno').value.trim();
    const correoInput = document.getElementById('nuevo-emp-correo').value.trim();
    const passwordInput = document.getElementById('nuevo-emp-password').value.trim();
    const rolInput = document.getElementById('nuevo-emp-rol').value;
    const sucursalInput = document.getElementById('nuevo-emp-sucursal').value;

    if(!rutInput || !nombreInput || !apPaternoInput || !correoInput || !passwordInput) {
        alert("Por favor, llena todos los campos obligatorios del empleado.");
        return;
    }

    try {
        const rutEncriptado = await encriptarDato(rutInput);
        const correoEncriptado = await encriptarDato(correoInput);
        const passwordEncriptado = await encriptarDato(passwordInput);

        const empleadoData = {
            run: rutEncriptado,
            nombre: nombreInput,
            apellidoPaterno: apPaternoInput,
            apellidoMaterno: apMaternoInput,
            correo: correoEncriptado,
            password: passwordEncriptado,
            rolIdRol: parseInt(rolInput),
            sucursalIdSucursal: parseInt(sucursalInput)
        };

        const res = await fetch('https://hydra-arm-crud.onrender.com/api/empleados', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('hydra_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(empleadoData)
        });

        if(res.ok || res.status === 201) {
            alert("¡Empleado guardado exitosamente!");
            cerrarModalAgregar('empleado');
            cargarEmpleadosAdmin(); 
        } else {
            alert("Error al guardar empleado en el servidor. Código HTTP: " + res.status);
        }

    } catch(errorSeguridad) {
        console.error(errorSeguridad);
        alert("⚠️ ALERTA DE SEGURIDAD: No se pudo conectar con el motor de encriptación. Guardado bloqueado.");
    }
}