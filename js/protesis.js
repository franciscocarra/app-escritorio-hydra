document.addEventListener("DOMContentLoaded", () => {
    cargarDatosMedico();

    // MAGIA: Si el médico viene desde el perfil de un paciente, autocompletamos el RUT
    const pacienteGuardado = localStorage.getItem('pacienteActivo');
    if (pacienteGuardado) {
        const paciente = JSON.parse(pacienteGuardado);
        const inputRut = document.getElementById('solicitud-rut');
        
        if(inputRut) {
            inputRut.value = paciente.rut; // Rellena el RUT automáticamente
            inputRut.style.backgroundColor = "#f1f5f9"; // Le da un tono gris
            inputRut.readOnly = true; // Evita que el médico lo borre por error
        }
    }
});

// 1. Mostrar nombre dinámico del Médico en la sesión activa
function cargarDatosMedico() {
    const usuarioString = localStorage.getItem('hydraUser');
    if(usuarioString) {
        const usuario = JSON.parse(usuarioString);
        document.getElementById('doc-name-sidebar').innerText = `Dr. ${usuario.nombre} ${usuario.apellidoPaterno}`;
    } else {
        window.location.href = 'Login.html';
    }
}

// 2. Validación de RUT Chileno (Algoritmo Oficial Módulo 11)
function validarRutChileno(rutCompleto) {
    let valor = rutCompleto.replace(/\./g, '').replace(/-/g, '');
    if (valor.length < 8) return false;
    let cuerpo = valor.slice(0, -1);
    let dv = valor.slice(-1).toUpperCase();
    if (!cuerpo.match(/^[0-9]+$/)) return false;
    let suma = 0; let multiplo = 2;
    for (let i = 1; i <= cuerpo.length; i++) {
        suma += multiplo * valor.charAt(cuerpo.length - i);
        if (multiplo < 7) { multiplo += 1; } else { multiplo = 2; }
    }
    let dvEsperado = 11 - (suma % 11);
    dvEsperado = (dvEsperado == 11) ? 0 : ((dvEsperado == 10) ? "K" : dvEsperado);
    return dvEsperado.toString() === dv;
}

// 3. Control del Modal de Solicitudes
function abrirModalSolicitud(nombreModelo) {
    document.getElementById('nombre-modelo-solicitud').innerText = nombreModelo;
    document.getElementById('modal-solicitud').style.display = 'flex';
    document.getElementById('error-rut-solicitud').style.display = 'none';
}

function cerrarModalSolicitud() {
    document.getElementById('modal-solicitud').style.display = 'none';
    document.getElementById('form-solicitud').reset();
}

// 4. Envío de datos de Solicitud
function enviarSolicitud() {
    document.getElementById('error-rut-solicitud').style.display = 'none';
    
    const rut = document.getElementById('solicitud-rut').value.trim();
    const obs = document.getElementById('solicitud-obs').value.trim();
    const modelo = document.getElementById('nombre-modelo-solicitud').innerText;

    if(!rut || !obs) {
        alert("Por favor, rellene todos los campos de la orden médica.");
        return;
    }

    if(!validarRutChileno(rut)) {
        document.getElementById('error-rut-solicitud').style.display = 'block';
        return;
    }

    // ==========================================
    // NUEVO: ENVIAR AL BUCKET DEL AUTORIZADOR
    // ==========================================
    // Asignamos un costo simulado dependiendo del modelo para que el Autorizador lo vea
    let costoEstimado = "$2.800.000";
    if (modelo.includes("RX-7")) costoEstimado = "$4.500.000";
    if (modelo.includes("Titan")) costoEstimado = "$5.200.000";

    let solicitudesGlobales = JSON.parse(localStorage.getItem('bucketSolicitudesPendientes')) || [];
    solicitudesGlobales.push({
        rut: rut,
        modelo: modelo,
        justificacion: obs,
        costo: costoEstimado
    });
    localStorage.setItem('bucketSolicitudesPendientes', JSON.stringify(solicitudesGlobales));

    alert(`¡Orden de manufactura enviada!\nLa prótesis ${modelo} quedó en estado 'Pendiente' en el panel del Autorizador.`);
    cerrarModalSolicitud();
}