const API_URL = 'https://api.hydra.cl/api';
let chartHistorico = null;
let chartVivo = null;
let map = null;
let mapMarker = null;
let pollingInterval = null;
let ultimoId = 0;
let runP = '';
let pacienteNombre = '';

// Datos vivos
const bpmVivos = [];
const tiemposVivos = [];
const MAX_VIVOS = 30;

document.addEventListener('DOMContentLoaded', async () => {
    cargarDatosMedico();
    await cargarPaciente();
    if (!runP) return;

    await cargarHistorico14Dias();
    await cargarVivoInicial();
    iniciarPolling();
    iniciarMapa();
});

function cargarDatosMedico() {
    const usuarioString = localStorage.getItem('hydraUser');
    if (usuarioString) {
        const usuario = JSON.parse(usuarioString);
        document.getElementById('doc-name-sidebar').innerText = `Dr. ${usuario.nombre} ${usuario.apellidoPaterno}`;
    }
}

async function cargarPaciente() {
    const dataString = localStorage.getItem('dashboardTemporal');
    if (dataString) {
        const dataObj = JSON.parse(dataString);
        pacienteNombre = dataObj.paciente || '';
        runP = dataObj.runP || dataObj.rut || '';
        const rutDisplay = dataObj.rutDisplay || dataObj.rut || runP;
        document.getElementById('titulo-paciente').innerText = `Análisis: ${pacienteNombre}`;
        document.getElementById('subtitulo-rut').innerText = `RUN: ${rutDisplay} | Dashboard en Vivo`;
        return;
    }

    // Fallback: sesion de ionic
    const sesion = localStorage.getItem('hydra_sesion');
    if (sesion) {
        const s = JSON.parse(sesion);
        runP = s.runPaciente || s.dbId || '';
        pacienteNombre = s.pacienteNombre || s.display?.nombre || '';
        const rutDisplay = s.runPacienteDisplay || s.display?.runP || runP;
        document.getElementById('titulo-paciente').innerText = `Análisis: ${pacienteNombre}`;
        document.getElementById('subtitulo-rut').innerText = `RUN: ${rutDisplay}`;
        return;
    }

    document.getElementById('titulo-paciente').innerText = 'Sin paciente seleccionado';
    alert('No hay paciente seleccionado. Vuelve a la lista de pacientes.');
}

// ============== HISTÓRICO 14 DÍAS ==============
async function cargarHistorico14Dias() {
    const ahora = new Date();
    const hace14d = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000);

    try {
        const res = await fetch(`${API_URL}/bpm/search?runP=${encodeURIComponent(runP)}&inicio=${hace14d.toISOString()}&fin=${ahora.toISOString()}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        if (!data || data.length === 0) {
            mostrarHistoricoVacio();
            return;
        }

        // Agrupar por día y calcular promedio
        const porDia = {};
        data.forEach(bpm => {
            const dia = bpm.fecha ? bpm.fecha.substring(0, 10) : '';
            if (!dia) return;
            if (!porDia[dia]) porDia[dia] = { suma: 0, count: 0, bateria: 0 };
            porDia[dia].suma += bpm.valorBpm;
            porDia[dia].count++;
            if (bpm.bateria) porDia[dia].bateria = bpm.bateria;
        });

        const dias = Object.keys(porDia).sort();
        const promedios = dias.map(d => Math.round(porDia[d].suma / porDia[d].count));
        const baterias = dias.map(d => porDia[d].bateria || 0);

        // KPI: promedio total
        const totalProm = promedios.reduce((a, b) => a + b, 0) / promedios.length;
        document.getElementById('kpi-promedio').innerText = Math.round(totalProm) + ' BPM';

        dibujarHistorico(dias, promedios);
        actualizarUltimoId(data);

    } catch (err) {
        console.error('Error cargando histórico:', err);
        mostrarHistoricoVacio();
    }
}

function mostrarHistoricoVacio() {
    document.getElementById('kpi-promedio').innerText = '--';
    const ctx = document.getElementById('chart-historico').getContext('2d');
    if (chartHistorico) chartHistorico.destroy();
    chartHistorico = new Chart(ctx, {
        type: 'line',
        data: { labels: ['Sin datos'], datasets: [{ label: 'BPM', data: [0], borderColor: '#94a3b8' }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function dibujarHistorico(dias, promedios) {
    const ctx = document.getElementById('chart-historico').getContext('2d');
    if (chartHistorico) chartHistorico.destroy();

    chartHistorico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dias.map(d => {
                const parts = d.split('-');
                return parts[2] + '/' + parts[1];
            }),
            datasets: [{
                label: 'BPM Promedio',
                data: promedios,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, min: 40, max: 180 }
            }
        }
    });
}

// ============== EN VIVO ==============
async function cargarVivoInicial() {
    const ahora = new Date();
    const hace1m = new Date(ahora.getTime() - 60000);

    try {
        const res = await fetch(`${API_URL}/bpm/search?runP=${encodeURIComponent(runP)}&inicio=${hace1m.toISOString()}&fin=${ahora.toISOString()}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data && data.length > 0) {
            data.forEach(bpm => agregarLecturaViva(bpm));
            actualizarUltimoId(data);
        }
    } catch (err) {
        console.error('Error cargando datos vivos iniciales:', err);
    }

    iniciarChartVivo();
}

function iniciarPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        try {
            const ahora = new Date();
            const hace30s = new Date(ahora.getTime() - 30000);

            const res = await fetch(`${API_URL}/bpm/search?runP=${encodeURIComponent(runP)}&inicio=${hace30s.toISOString()}&fin=${ahora.toISOString()}`);
            if (!res.ok) return;
            const data = await res.json();

            if (data && data.length > 0) {
                const nuevos = data.filter(b => b.idBpm > ultimoId);
                nuevos.forEach(bpm => agregarLecturaViva(bpm));
                if (nuevos.length > 0) actualizarUltimoId(nuevos);
            }
        } catch (err) {
            console.error('Error polling:', err);
        }
    }, 3000);
}

function agregarLecturaViva(bpm) {
    const valor = bpm.valorBpm;
    if (!valor) return;

    bpmVivos.push(valor);
    tiemposVivos.push(new Date().toLocaleTimeString());

    if (bpmVivos.length > MAX_VIVOS) {
        bpmVivos.shift();
        tiemposVivos.shift();
    }

    // KPI BPM actual
    document.getElementById('kpi-bpm').innerText = valor;

    // KPI Bateria
    if (bpm.bateria !== undefined && bpm.bateria !== null) {
        const bat = bpm.bateria;
        document.getElementById('kpi-bateria').innerText = bat + '%';
        const fill = document.getElementById('battery-fill');
        fill.style.width = bat + '%';
        fill.style.background = bat > 20 ? '#16a34a' : '#dc2626';
    }

    // KPI Ubicacion
    if (bpm.latitud && bpm.longitud) {
        const lat = parseFloat(bpm.latitud);
        const lng = parseFloat(bpm.longitud);
        document.getElementById('kpi-ubicacion').innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (map && mapMarker) {
            mapMarker.setLatLng([lat, lng]);
            map.setView([lat, lng], 15);
        } else if (map) {
            mapMarker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 15);
        }
    }

    document.getElementById('total-lecturas').innerText = `Lecturas hoy: ${bpmVivos.length}`;
    document.getElementById('ultima-actualizacion').innerText = `Última actualización: ${new Date().toLocaleTimeString()}`;

    if (chartVivo) {
        chartVivo.data.labels = tiemposVivos;
        chartVivo.data.datasets[0].data = bpmVivos;
        chartVivo.update('none');
    }
}

function iniciarChartVivo() {
    const ctx = document.getElementById('chart-vivo').getContext('2d');
    if (chartVivo) chartVivo.destroy();

    chartVivo = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tiemposVivos,
            datasets: [{
                label: 'BPM',
                data: bpmVivos,
                borderColor: '#dc2626',
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 200 },
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 40, max: 180 }
            }
        }
    });
}

// ============== MAPA ==============
function iniciarMapa() {
    map = L.map('map').setView([-33.4489, -70.6693], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

// ============== UTILIDADES ==============
function actualizarUltimoId(data) {
    const ids = data.map(b => b.idBpm).filter(id => id);
    if (ids.length > 0) {
        ultimoId = Math.max(...ids);
    }
}

// Cleanup al salir
window.addEventListener('beforeunload', () => {
    if (pollingInterval) clearInterval(pollingInterval);
    if (chartVivo) chartVivo.destroy();
    if (chartHistorico) chartHistorico.destroy();
});
