document.addEventListener("DOMContentLoaded", () => {
    cargarDatosMedico();
    inicializarDashboard();
});

// 1. Mostrar nombre dinámico del Médico (Igual que en home)
function cargarDatosMedico() {
    const usuarioString = localStorage.getItem('hydraUser');
    if(usuarioString) {
        const usuario = JSON.parse(usuarioString);
        document.getElementById('doc-name-sidebar').innerText = `Dr. ${usuario.nombre} ${usuario.apellidoPaterno}`;
    }
}

// 2. Extraer telemetría y dibujar gráficos
function inicializarDashboard() {
    const dataString = localStorage.getItem('dashboardTemporal');
    
    // Si entró directo sin hacer clic en un paciente, lo devolvemos
    if(!dataString) {
        alert("No hay datos telemétricos seleccionados.");
        window.location.href = 'home.html';
        return;
    }

    const dataObj = JSON.parse(dataString);
    const telemetria = dataObj.telemetria; // El arreglo de 14 días

    // Cambiamos títulos
    document.getElementById('titulo-paciente').innerText = `Análisis: ${dataObj.paciente}`;
    document.getElementById('subtitulo-rut').innerText = `RUN: ${dataObj.rut} | Reporte de 14 Días`;

    // ----------------------------------------------------
    // MATEMÁTICAS PARA LAS TARJETAS (KPIs)
    // ----------------------------------------------------
    let sumaHoras = 0;
    let sumaBat = 0;
    let maxTemp = 0;

    telemetria.forEach(dia => {
        sumaHoras += parseFloat(dia.usoHoras);
        sumaBat += parseInt(dia.bateria);
        let temp = parseFloat(dia.temperatura);
        if(temp > maxTemp) maxTemp = temp;
    });

    const promHoras = (sumaHoras / telemetria.length).toFixed(1);
    const promBat = Math.round(sumaBat / telemetria.length);

    document.getElementById('kpi-uso').innerText = `${promHoras} hrs`;
    document.getElementById('kpi-bateria').innerText = `${promBat}%`;
    document.getElementById('kpi-temp').innerText = `${maxTemp}°C`;

    // ----------------------------------------------------
    // CONSTRUCCIÓN DE GRÁFICOS CON CHART.JS
    // ----------------------------------------------------
    
    // Arrays separados para X (Fechas) y las Y (Valores)
    const etiquetasFechas = telemetria.map(dia => dia.fecha);
    const datosUso = telemetria.map(dia => parseFloat(dia.usoHoras));
    const datosTemp = telemetria.map(dia => parseFloat(dia.temperatura));

    // Gráfico de Barras (Horas de Uso)
    const ctxUso = document.getElementById('graficoUso').getContext('2d');
    new Chart(ctxUso, {
        type: 'bar',
        data: {
            labels: etiquetasFechas,
            datasets: [{
                label: 'Horas de Uso',
                data: datosUso,
                backgroundColor: 'rgba(79, 70, 229, 0.8)', // Color morado
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
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
                borderColor: '#ef4444', // Color rojo
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3 // Hace que la línea sea curva
            }]
        },
        options: {
            responsive: true,
            scales: { y: { suggestedMin: 20, suggestedMax: 45 } }
        }
    });
}