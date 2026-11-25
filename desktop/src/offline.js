'use strict';
const q = new URLSearchParams(location.search);
document.getElementById('detail').textContent = `${q.get('url') || ''} — ${q.get('error') || ''}`;
document.getElementById('retry').addEventListener('click', () => window.cebasic.retry());
document.getElementById('settings').addEventListener('click', () => window.cebasic.openSettings());
