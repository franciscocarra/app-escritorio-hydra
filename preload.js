const { contextBridge } = require('electron');

const CRUD_URL = 'https://hydra-crud.onrender.com';
const SECURITY_URL = 'https://hydra-arm-security.onrender.com';

function getBaseUrl(endpoint) {
  if (endpoint.startsWith('/api/auth') ||
      endpoint.startsWith('/api/user/cripto') ||
      /\/api\/pacientes\/[^/]+\/documentos/.test(endpoint) ||
      /\/api\/pacientes\/[^/]+\/perfil/.test(endpoint)) {
    return SECURITY_URL;
  }
  return CRUD_URL;
}

// ── Safe API exposed to renderer ──
contextBridge.exposeInMainWorld('hydraAPI', {
  // Platform info (no PII)
  platform: process.platform,
  isPackaged: process.env.ELECTRON_IS_PACKAGED === 'true',

  // ── HTTP API calls ──
  async apiCall(endpoint, options = {}) {
    const baseUrl = getBaseUrl(endpoint);
    const url = `${baseUrl}${endpoint}`;

    const token = localStorage.getItem('hydra_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (res.status === 401) {
      const refreshToken = localStorage.getItem('hydra_refresh');
      if (refreshToken) {
        const refreshRes = await fetch(`${SECURITY_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('hydra_token', data.accessToken);
          localStorage.setItem('hydra_refresh', data.refreshToken);

          const retryRes = await fetch(url, {
            ...options,
            headers: {
              ...headers,
              'Authorization': `Bearer ${data.accessToken}`
            }
          });
          return retryRes.json();
        } else {
          localStorage.removeItem('hydra_token');
          localStorage.removeItem('hydra_refresh');
          window.location.href = 'login.html';
          return null;
        }
      } else {
        localStorage.removeItem('hydra_token');
        window.location.href = 'login.html';
        return null;
      }
    }

    return res.json();
  },

  // ── Login (JWT) ──
  async login(email, password, rol, runP) {
    const res = await fetch(`${SECURITY_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rol, runP })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login fallo');
    }

    const data = await res.json();
    localStorage.setItem('hydra_token', data.accessToken);
    localStorage.setItem('hydra_refresh', data.refreshToken);
    localStorage.setItem('hydraUser', JSON.stringify({ email, role: data.role }));
    return data;
  },

  // ── Logout ──
  logout() {
    localStorage.removeItem('hydra_token');
    localStorage.removeItem('hydra_refresh');
    localStorage.removeItem('hydraUser');
    window.location.href = 'login.html';
  },

  // ── Crypto calls ──
  async encrypt(texto) {
    const url = `${SECURITY_URL}/api/user/cripto/encrypt?texto=${encodeURIComponent(texto)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Encrypt failed');
    return res.text();
  },

  async decrypt(codigo) {
    const url = `${SECURITY_URL}/api/user/cripto/decrypt?codigo=${encodeURIComponent(codigo)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Decrypt failed');
    return res.text();
  },

  // ── Pacientes ──
  async getPacientes() {
    return this.apiCall('/api/pacientes');
  },

  async getPaciente(run) {
    return this.apiCall(`/api/pacientes/${run}`);
  },

  // ── BPM ──
  async getBpmPorRango(runP, inicio, fin) {
    return this.apiCall(`/api/bpm/search?runP=${encodeURIComponent(runP)}&inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`);
  },

  async postBpm(data) {
    return this.apiCall('/api/bpm', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // ── Empleados ──
  async getEmpleados() {
    return this.apiCall('/api/empleados');
  },

  async postEmpleado(data) {
    return this.apiCall('/api/empleados', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // ── Familiares ──
  async getFamiliares() {
    return this.apiCall('/api/familiares');
  },

  async getFamiliar(run) {
    return this.apiCall(`/api/familiares/${run}`);
  },

  async getPacientesDeFamiliar(run) {
    return this.apiCall(`/api/familiares/${run}/pacientes`);
  },

  // ── Documentos ──
  async getDocumentos(runP) {
    return this.apiCall(`/api/pacientes/${runP}/documentos`);
  },

  async uploadDocumento(runP, archivo) {
    const token = localStorage.getItem('hydra_token');

    const formData = new FormData();
    formData.append('archivo', archivo, archivo.name);

    const res = await fetch(`${SECURITY_URL}/api/pacientes/${runP}/documentos`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Error al subir documento');
    }
    return res.json();
  },

  // ── Foto perfil ──
  async getFoto(runP) {
    return this.apiCall(`/api/pacientes/${runP}/perfil`);
  }
});
