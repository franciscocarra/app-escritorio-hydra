(function (win) {
  const REALTIME_URL = 'https://hydra-realtime.onrender.com';

  let es = null;
  let eventos = [];
  let handlers = {};
  let onOpen = null;
  let onError = null;
  let reconectar = false;
  let conRetraso = false;

  function conectar(opciones) {
    desconectar();
    reconectar = true;
    eventos = opciones.eventos || [
      'hello', 'mensajes', 'bpm', 'geolocalizacion',
      'historial_bpm', 'historial_geolocalizacion'
    ];
    handlers = opciones.handlers || {};
    onOpen = opciones.onOpen || null;
    onError = opciones.onError || null;
    abrir();
  }

  function abrir() {
    if (!reconectar) return;
    try {
      es = new EventSource(REALTIME_URL + '/api/realtime/stream');
      es.onopen = function () {
        conRetraso = false;
        if (onOpen) onOpen();
      };
      es.onerror = function () {
        if (es) { try { es.close(); } catch (e) {} }
        if (onError) onError();
        setTimeout(abrir, conRetraso ? 15000 : 1000);
        conRetraso = true;
      };
      for (const ev of eventos) {
        es.addEventListener(ev, function (e) {
          const data = (e.data || '').toString();
          let json = null;
          try { json = JSON.parse(data); } catch (err) {}
          const lista = handlers[ev];
          if (lista) {
            const fns = Array.isArray(lista) ? lista : [lista];
            fns.forEach(function (cb) {
              try { cb(json, data); } catch (err) { console.error('HydraRT [' + ev + ']', err); }
            });
          }
        });
      }
    } catch (err) {
      setTimeout(abrir, 1500);
    }
  }

  function desconectar() {
    reconectar = false;
    if (es) { try { es.close(); } catch (e) {} es = null; }
  }

  function estado() {
    return es ? es.readyState : -1;
  }

  win.HydraRT = { conectar, desconectar, estado };
})(window);