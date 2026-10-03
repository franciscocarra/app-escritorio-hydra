// Simulador de geolocalización en movimiento para el módulo GPS de Hydra.
// Envía posiciones tipo random-walk por Santiago a la API cada N segundos.
// Uso: node simulador-gps.js
// Variables opcionales: HYDRA_RUT (por defecto Juan), HYDRA_INTERVAL (seg), HYDRA_URL.
// Para apuntar a producción: HYDRA_URL=https://geolocalizaci-n-1.onrender.com/api/geolocalizacion/actualizar

const crypto = require('crypto');

// La API solo acepta el hash SHA-256 (64 hex) o ciphertext, nunca el RUN plano.
// Replica HashUtils.HASHEO() de Java: quita '.' y ' ', minusculas, SHA-256 hex.
function hashRun(run) {
    const norm = String(run).replace(/\./g, '').replace(/ /g, '').toLowerCase();
    return crypto.createHash('sha256').update(norm, 'utf8').digest('hex');
}

const URL = process.env.HYDRA_URL || 'http://localhost:8082/api/geolocalizacion/actualizar';
const RUT_RAW = process.env.HYDRA_RUT || '15.456.789-K';
const RUT = /^[0-9a-f]{64}$/.test(RUT_RAW) ? RUT_RAW : hashRun(RUT_RAW);
const INTERVALO_MS = (parseInt(process.env.HYDRA_INTERVAL, 10) || 10) * 1000;

let lat = -33.4489;
let lng = -70.6693;

function pasoRandom() {
    const angulo = Math.random() * 2 * Math.PI;
    const dist = 0.0002 + Math.random() * 0.0006;
    lat += Math.cos(angulo) * dist;
    lng += Math.sin(angulo) * dist;
    return { latitud: +(lat.toFixed(6)), longitud: +(lng.toFixed(6)) };
}

async function enviarUbicacion() {
    const punto = pasoRandom();
    try {
        const res = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rutPaciente: RUT, latitud: punto.latitud, longitud: punto.longitud })
        });
        const fecha = new Date().toLocaleTimeString('es-CL');
        if (!res.ok) {
            console.log(`[${fecha}] HTTP ${res.status} -> ${res.statusText}`);
        } else {
            console.log(`[${fecha}] OK ${punto.latitud}, ${punto.longitud}`);
        }
    } catch (e) {
        console.log(`[${new Date().toLocaleTimeString('es-CL')}] ERROR: no se pudo conectar a ${URL} (¿API levantada?)`);
    }
}

console.log(`Simulador GPS iniciado: RUN ${RUT_RAW} -> hash ${RUT.slice(0, 12)}... cada ${INTERVALO_MS / 1000}s -> ${URL}`);
enviarUbicacion();
setInterval(enviarUbicacion, INTERVALO_MS);