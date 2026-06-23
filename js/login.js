// ===================================================================
// 1. CREDENCIALES GLOBALES
// ===================================================================
const credencialesGlobales = btoa(`user:dc20f0e4-b1bc-4969-a01c-cbb8282c805f`); 

// ===================================================================
// 2. MOTOR DE DESENCRIPTACIÓN 
// ===================================================================
async function desencriptarParaLogin(hash) {
    if (!hash || hash === 'null') return null;
    try {
        const url = `http://localhost:8081/api/user/cripto/decrypt?codigo=${encodeURIComponent(hash)}`;
        const res = await fetch(url, { method: 'GET' });
        
        if (!res.ok) return null;
        
        let textoLimpio = await res.text();
        return textoLimpio.replace(/"/g, '').trim(); 
    } catch (e) {
        return null;
    }
}

// ===================================================================
// 3. LÓGICA PRINCIPAL DE INICIO DE SESIÓN (A prueba de fallos)
// ===================================================================
async function iniciarSesion() {
    // 1. ATRAPAMOS LOS ELEMENTOS DE FORMA GENÉRICA (Sin importar IDs o Clases)
    const inputs = document.querySelectorAll('input');
    const correoElement = inputs[0]; // El primer input siempre será el correo
    const passElement = inputs[1];   // El segundo siempre será la contraseña
    const btnLogin = document.querySelector('button'); // El único botón del formulario

    if (!correoElement || !passElement || !btnLogin) {
        alert("Error interno: No se detecta el formulario en el HTML.");
        return;
    }

    const correoInput = correoElement.value.trim();
    const passInput = passElement.value.trim();

    // 2. VALIDACIÓN VACÍA
    if (!correoInput || !passInput) {
        alert("Por favor, ingresa tu correo y contraseña.");
        return;
    }

    // 3. ESTADO DE CARGA (Bloqueamos el botón para evitar que se quede pegado)
    const textoOriginal = btnLogin.innerHTML;
    btnLogin.innerHTML = 'Verificando... <i class="fa-solid fa-spinner fa-spin"></i>';
    btnLogin.disabled = true; // Evita clics múltiples

    try {
        // 4. CONEXIÓN A LA BASE DE DATOS
        const res = await fetch('http://localhost:8080/api/empleados', {
            headers: { 'Authorization': `Basic ${credencialesGlobales}` }
        });
        
        if (!res.ok) throw new Error("API caída");
        const empleadosBD = await res.json();

        let usuarioValido = null;

        // 5. BÚSQUEDA Y DESENCRIPTACIÓN
        for (let emp of empleadosBD) {
            const correoDesencriptado = await desencriptarParaLogin(emp.correo);
            
            if (correoDesencriptado === correoInput) {
                const passDesencriptada = await desencriptarParaLogin(emp.password);
                
                if (passDesencriptada === passInput) {
                    usuarioValido = emp; 
                    break; 
                }
            }
        }

        // 6. RESULTADOS
        if (usuarioValido) {
            localStorage.setItem('hydraUser', JSON.stringify(usuarioValido));
            
            if (usuarioValido.rolIdRol === 1) {
                window.location.href = 'Admin.html'; 
            } else if (usuarioValido.rolIdRol === 2) {
                window.location.href = 'home.html';
            } else if (usuarioValido.rolIdRol === 3) {
                window.location.href = 'Autorizador.html';
            } else if (usuarioValido.rolIdRol === 4) {
                window.location.href = 'Cuidador.html';
            } else { 
                alert("Tu rol no tiene un panel asignado en esta versión."); 
                btnLogin.innerHTML = textoOriginal; 
                btnLogin.disabled = false; // Desbloqueamos
            }
        } else {
            // ERROR DE CREDENCIALES
            alert("Correo o contraseña incorrectos. Intenta nuevamente.");
            passElement.value = ''; // Vaciamos la contraseña para no dejarla "pegada"
            btnLogin.innerHTML = textoOriginal;
            btnLogin.disabled = false; // Desbloqueamos el botón para que vuelva a funcionar
        }

    } catch (error) {
        console.error(error);
        alert("Error crítico de servidor. Asegúrate de iniciar los servicios de Java.");
        btnLogin.innerHTML = textoOriginal;
        btnLogin.disabled = false; // Desbloqueamos en caso de error crítico
    }
}

// ===================================================================
// 4. ZONA DE DESARROLLADOR: ATAJO SECRETO (Ctrl + Shift + D)
// ===================================================================
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
        window.location.href = 'generador-admins.html';
    }
});