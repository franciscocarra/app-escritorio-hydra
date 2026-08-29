document.addEventListener("DOMContentLoaded", () => {
    cargarDatosMedico();
    inicializarDashboard();
});

// 1. Mostrar nombre dinámico del Médico (Igual que en home)
function cargarDatosMedico() {
    const usuarioString = localStorage.getItem('hydraUser');
    if (usuarioString) {
        try {
            const usuario = JSON.parse(usuarioString);
            const nombre = usuario.nombre || usuario.email || '';
            const apP = usuario.apellidoPaterno || '';
            document.getElementById('doc-name-sidebar').innerText = `Dr. ${nombre} ${apP}`.trim();
        } catch (e) {
            document.getElementById('doc-name-sidebar').innerText = 'Dr.';
        }
    } else {
        window.location.href = 'Login.html';
    }
}

// 2. Extraer telemetría del local storage y dibujar gráficos (estático)
function inicializarDashboard() {
    const dataString = localStorage.getItem('dashboardTemporal');

    // Si entró directo sin hacer clic en un paciente, lo devolvemos
    if (!dataString) {
        alert("No hay datos telemétricos seleccionados.");
        window.location.href = 'home.html';
        return;
    }

    let dataObj;
    try {
        dataObj = JSON.parse(dataString);
    } catch (e) {
        alert("Datos telemétricos inválidos.");
        window.location.href = 'home.html';
        return;
    }

    const telemetria = Array.isArray(dataObj.telemetria) ? dataObj.telemetria : [];

    // Títulos
    document.getElementById('titulo-paciente').innerText = `Análisis: ${dataObj.paciente || 'Paciente'}`;
    const runDisplay = dataObj.rutDisplay || dataObj.rut || '--------';
    document.getElementById('subtitulo-rut').innerText = `RUN: ${runDisplay} | Reporte de 14 Días`;

    if (telemetria.length === 0) {
        document.getElementById('kpi-uso').innerText = '-- hrs';
        document.getElementById('kpi-bateria').innerText = '--%';
        document.getElementById('kpi-temp').innerText = '--°C';
        document.getElementById('kpi-dias').innerText = '0';
        return;
    }

    // ----------------------------------------------------
    // MATEMÁTICAS PARA LAS TARJETAS (KPIs)
    // ----------------------------------------------------
    let sumaHoras = 0;
    let sumaBat = 0;
    let maxTemp = 0;

    telemetria.forEach(dia => {
        sumaHoras += parseFloat(dia.usoHoras) || 0;
        sumaBat += parseInt(dia.bateria) || 0;
        let temp = parseFloat(dia.temperatura) || 0;
        if (temp > maxTemp) maxTemp = temp;
    });

    const promHoras = (sumaHoras / telemetria.length).toFixed(1);
    const promBat = Math.round(sumaBat / telemetria.length);

    document.getElementById('kpi-uso').innerText = `${promHoras} hrs`;
    document.getElementById('kpi-bateria').innerText = `${promBat}%`;
    document.getElementById('kpi-temp').innerText = `${maxTemp}°C`;
    document.getElementById('kpi-dias').innerText = `${telemetria.length}`;

    const fill = document.getElementById('battery-fill');
    fill.style.width = Math.max(0, Math.min(100, promBat)) + '%';
    fill.style.background = promBat > 20 ? '#16a34a' : '#dc2626';

    // ----------------------------------------------------
    // CONSTRUCCIÓN DE GRÁFICOS CON CHART.JS
    // ----------------------------------------------------

    // Arrays separados para X (Fechas) y las Y (Valores)
    const etiquetasFechas = telemetria.map(dia => dia.fecha);
    const datosUso = telemetria.map(dia => parseFloat(dia.usoHoras) || 0);
    const datosTemp = telemetria.map(dia => parseFloat(dia.temperatura) || 0);

    // Gráfico de Barras (Horas de Uso)
    const ctxUso = document.getElementById('graficoUso').getContext('2d');
    new Chart(ctxUso, {
        type: 'bar',
        data: {
            labels: etiquetasFechas,
            datasets: [{
                label: 'Horas de Uso',
                data: datosUso,
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, suggestedMax: 15 } }
        }
    });

    // Gráfico de Líneas (Temperatura)
    const ctxTemp = document.getElementById('graficoTemp').getContext('2d');
    new Chart(ctxTemp, {
        type: 'line',
        data: {
            labels: etiquetasFechas,
            datasets: [{
                label: 'Grados °C',
                data: datosTemp,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { suggestedMin: 20, suggestedMax: 45 } }
        }
    });
}
