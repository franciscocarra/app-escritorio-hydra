const { contextBridge } = require('electron');

// ── Safe API exposed to renderer ──
contextBridge.exposeInMainWorld('hydraAPI', {
  // Platform info (no PII)
  platform: process.platform,
  isPackaged: process.env.ELECTRON_IS_PACKAGED === 'true',

  // ── HTTP API calls ──
  async apiCall(endpoint, options = {}) {
    const baseUrl = 'https://api.hydra.cl';
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
      // Try refresh
      const refreshToken = localStorage.getItem('hydra_refresh');
      if (refreshToken) {
        const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('hydra_token', data.accessToken);
          localStorage.setItem('hydra_refresh', data.refreshToken);

          // Retry original request
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
    const res = await fetch('https://api.hydra.cl/api/auth/login', {
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
    localStorage.setItem('hydra_user', JSON.stringify({ email, role: data.role }));
    return data;
  },

  // ── Logout ──
  logout() {
    localStorage.removeItem('hydra_token');
    localStorage.removeItem('hydra_refresh');
    localStorage.removeItem('hydra_user');
    window.location.href = 'login.html';
  },

  // ── Crypto calls ──
  async encrypt(texto) {
    return this.apiCall(`/api/user/cripto/encrypt?texto=${encodeURIComponent(texto)}`);
  },

  async decrypt(codigo) {
    return this.apiCall(`/api/user/cripto/decrypt?codigo=${encodeURIComponent(codigo)}`);
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

  async uploadDocumento(runP, formData) {
    const token = localStorage.getItem('hydra_token');
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/documentos`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    return res.json();
  },

  // ── Foto perfil ──
  async getFoto(runP) {
    return this.apiCall(`/api/pacientes/${runP}/perfil`);
  }
});
