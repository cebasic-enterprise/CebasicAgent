'use strict';
const input = document.getElementById('url');
const err = document.getElementById('err');
window.cebasic.getSettings().then((s) => {
  if (!s) return;
  input.value = s.serverUrl;
  if (s.envOverride) err.textContent = 'Nota: CEBASIC_AGENT_URL está definida y tiene prioridad.';
  input.select();
});
document.getElementById('cancel').addEventListener('click', () => window.close());
document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await window.cebasic.saveServer(input.value);
  if (!res || !res.ok) err.textContent = (res && res.error) || 'No se pudo guardar';
});
