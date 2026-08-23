// Contraseña de Spring Boot para autenticación básica
function getAuthHeaders() {
    const token = localStorage.getItem('hydra_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ==========================================
// VALIDACIÓN MATEMÁTICA DE RUT CHILENO (MÓDULO 11)
// ==========================================
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

// ==========================================
// VALIDACIÓN DE ESTRUCTURA DE CORREO
// ==========================================
function validarCorreo(correo) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(correo);
}

// ==========================================
// INTERCOMINICACIÓN CON MICROSERVICIO CRIPTO (8081)
// ==========================================
async function enc(textoLimpio) {
    try {
        const url = `https://hydra-arm-security.onrender.com/api/user/cripto/encrypt?texto=${encodeURIComponent(textoLimpio)}`;
        const res = await fetch(url, { method: 'GET' }); 
        if (!res.ok) throw new Error("Motor apagado");
        return await res.text(); 
    } catch (e) {
        alert("Error crítico: El motor de seguridad (8081) no responde.");
        return null;
    }
}

// ==========================================
// LÓGICA CORE: PERSISTENCIA DIRECTA EN LA BD
// ==========================================
async function crearAdminDirecto() {
    // Inicialización del estado visual de errores y éxito
    document.getElementById('error-rut').style.display = 'none';
    document.getElementById('error-correo').style.display = 'none';
    document.getElementById('caja-credenciales').style.display = 'none';

    const btn = document.getElementById('btn-generar');
    const originalText = btn.innerHTML;

    // Captura de datos ingresados en el formulario
    const rut = document.getElementById('dev-rut').value.trim();
    const nom = document.getElementById('dev-nombre').value.trim();
    const app = document.getElementById('dev-appat').value.trim();
    const am = document.getElementById('dev-apmat').value.trim();
    const cor = document.getElementById('dev-correo').value.trim();
    const pas = document.getElementById('dev-pass').value.trim();

    if(!rut || !nom || !app || !cor || !pas) {
        alert("Completa todos los campos obligatorios.");
        return;
    }

    // Comprobación estricta de validaciones
    let hayErrores = false;
    if (!validarRutChileno(rut)) { 
        document.getElementById('error-rut').style.display = 'block'; 
        hayErrores = true; 
    }
    if (!validarCorreo(cor)) { 
        document.getElementById('error-correo').style.display = 'block'; 
        hayErrores = true; 
    }
    if (hayErrores) return; 

    // Bloqueo del control de envío para evitar múltiples clics
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando BD...';
    btn.disabled = true;

    // 1. Cifrado de datos sensibles
    const rutE = await enc(rut);
    const corE = await enc(cor);
    const pasE = await enc(pas);

    if(rutE && corE && pasE) {
        // 2. Mapeo de la entidad de acuerdo al modelo de base de datos
        const adminData = {
            run: rutE,
            nombre: nom,
            apellidoPaterno: app,
            apellidoMaterno: am,
            correo: corE,
            password: pasE,
            rolIdRol: 1,      // Rol 1 asignado para Super Administradores
            sucursalIdSucursal: 1
        };

        try {
            // 3. Inyección directa vía HTTP POST a la API REST de Empleados (8080)
            const res = await fetch('https://hydra-crud.onrender.com/api/empleados', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('hydra_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(adminData)
            });

            if(res.ok || res.status === 201) {
                // Éxito: Limpieza de inputs del formulario
                document.querySelectorAll('input').forEach(i => i.value = '');
                
                // Renderizado dinámico del recuadro de credenciales legibles
                document.getElementById('res-correo').innerText = cor;
                document.getElementById('res-pass').innerText = pas;
                document.getElementById('caja-credenciales').style.display = 'flex';
            } else {
                alert("Error al inyectar en la Base de Datos. Código HTTP: " + res.status);
            }
        } catch(err) {
            alert("Error: No se pudo conectar a la API principal (8080).");
        }
    }
    
    // Restauración del estado original del botón
    btn.innerHTML = originalText;
    btn.disabled = false;
}

// ==========================================
// SISTEMA DE COPIADO AL PORTAPAPELES (CLIPBOARD)
// ==========================================
function copiarCredenciales() {
    const cor = document.getElementById('res-correo').innerText;
    const pas = document.getElementById('res-pass').innerText;
    
    navigator.clipboard.writeText(`Correo: ${cor}\nContraseña: ${pas}`).then(() => {
        const btnCopiar = document.getElementById('btn-copiar');
        btnCopiar.innerHTML = `<i class="fa-solid fa-check"></i> ¡Copiados!`;
        btnCopiar.style.background = "#059669";

        setTimeout(() => {
            btnCopiar.innerHTML = `<i class="fa-regular fa-copy"></i> Copiar para Login`;
            btnCopiar.style.background = "#10b981";
        }, 2000);
    });
}