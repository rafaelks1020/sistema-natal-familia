// Service worker só de aviso. Não intercepta navegação nem cache.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let titulo = 'Natal em Família';
  let corpo = '';
  let rota = '/';
  if (event.data) {
    try {
      const dados = event.data.json();
      if (dados && typeof dados.titulo === 'string' && dados.titulo.trim()) titulo = dados.titulo.trim().slice(0, 120);
      if (dados && typeof dados.corpo === 'string') corpo = dados.corpo.slice(0, 400);
      if (dados && typeof dados.rota === 'string') rota = dados.rota;
    } catch {
      try {
        const texto = event.data.text();
        if (texto) corpo = texto.slice(0, 400);
      } catch { /* sem corpo */ }
    }
  }
  const destino = rotaSegura(rota);
  event.waitUntil(self.registration.showNotification(titulo, {
    body: corpo,
    icon: '/icon.png',
    badge: '/icon.png',
    data: { rota: destino },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rota = rotaSegura(event.notification.data && event.notification.data.rota);
  const destino = new URL(rota, self.location.origin).href;
  event.waitUntil(abrir(destino, rota));
});

function rotaSegura(valor) {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return '/';
  try {
    const url = new URL(valor, self.location.origin);
    if (url.origin !== self.location.origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

async function abrir(destino, rota) {
  const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const cliente of janelas) {
    let origem = '';
    try { origem = new URL(cliente.url).origin; } catch { continue; }
    if (origem !== self.location.origin) continue;
    if (typeof cliente.navigate === 'function') {
      try { await cliente.navigate(destino); } catch { /* o recado abaixo troca a rota */ }
    }
    try { cliente.postMessage({ tipo: 'push-rota', rota }); } catch { /* segue o foco */ }
    if (typeof cliente.focus === 'function') {
      await cliente.focus();
      return;
    }
  }
  if (self.clients.openWindow) await self.clients.openWindow(destino);
}
