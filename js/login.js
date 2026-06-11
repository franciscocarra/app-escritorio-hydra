function iniciarSesion() {
    // 1. Capturamos lo que el usuario escribió en los inputs de Login.html
    const rutInput = document.querySelector('input[type="text"]').value.trim();
    const passInput = document.querySelector('input[type="password"]').value.trim();
    // 3. Verificamos si es el Administrador
    if (rutInput === 'admin' && passInput === 'admin') {
        // Viajamos a la vista de administración
        window.location.href = 'admin.html';
    } 
    // 4. Si es cualquier otro usuario (simulando un Médico)
    else {
        // Viajamos a la vista normal de pacientes
        window.location.href = 'home.html';
    }
}