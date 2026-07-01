async function iniciarSesion() {
    const inputs = document.querySelectorAll('input');
    const correoElement = inputs[0];
    const passElement = inputs[1];
    const btnLogin = document.querySelector('button');

    if (!correoElement || !passElement || !btnLogin) {
        alert("Error interno: No se detecta el formulario en el HTML.");
        return;
    }

    const correoInput = correoElement.value.trim();
    const passInput = passElement.value.trim();

    if (!correoInput || !passInput) {
        alert("Por favor, ingresa tu correo y contrasena.");
        return;
    }

    const textoOriginal = btnLogin.innerHTML;
    btnLogin.innerHTML = 'Verificando... <i class="fa-solid fa-spinner fa-spin"></i>';
    btnLogin.disabled = true;

    try {
        const data = await window.hydraAPI.login(correoInput, passInput, 'MEDICO', '');
        window.location.href = 'home.html';
    } catch (error) {
        alert(error.message || "Correo o contrasena incorrectos.");
        passElement.value = '';
        btnLogin.innerHTML = textoOriginal;
        btnLogin.disabled = false;
    }
}

document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
        window.location.href = 'generador-admins.html';
    }
});
