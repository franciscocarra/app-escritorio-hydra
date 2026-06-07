// Ejecutar la carga apenas se abra la pantalla
document.addEventListener("DOMContentLoaded", cargarPacientes);

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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--primary);">Consultando BD y Desencriptando datos <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

        const res = await fetch(urlAPI, { headers: { 'Authorization': `Basic ${credenciales}` }});
        if (res.ok) {
            const cifrados = await res.json(); 
            const promesas = cifrados.map(async (p) => {
                const [rut, tel] = await Promise.all([desencriptarDato(p.runP), desencriptarDato(p.telefono)]);
                return { ...p, runP: rut, telefono: tel, runOriginalCifrado: p.runP };
            });
            const legibles = await Promise.all(promesas);

            tbody.innerHTML = ''; 
            legibles.forEach(p => {
                const apP = p.apellidoPaterno || ''; const apM = p.apellidoMaterno || '';
                const fila = `<tr>
                    <td>${p.runP}</td><td>${p.nombre}</td><td>${apP} ${apM}</td><td>${p.telefono}</td>
                    <td><button class="btn-action outline" onclick="irAlPerfil('${p.nombre}', '${apP}', '${apM}', '${p.runP}', '${p.telefono}', '${p.runOriginalCifrado}')">Perfil Clínico</button></td>
                </tr>`;
                tbody.insertAdjacentHTML('beforeend', fila);
            });
        }
    } catch (e) { console.error(e); }
}

function irAlPerfil(nombre, apPaterno, apMaterno, rutReal, fonoReal, runEncriptado) {
    // GUARDAMOS LOS DATOS EN LA MEMORIA LOCAL
    const paciente = { nombre, apPaterno, apMaterno, rutReal, fonoReal, runEncriptado };
    localStorage.setItem('pacienteSeleccionado', JSON.stringify(paciente));
    
    // VIAJAMOS AL HTML DEL PERFIL
    window.location.href = '../Vista/perfil.html';
}