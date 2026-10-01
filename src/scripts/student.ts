// Runs on every student page: offline support (service worker + outbox of unsent results).
import { flushOutbox } from '../lib/outbox';

const studentId = document.documentElement.dataset.student ?? '';

async function setup() {
  // A different kid on this device: forget the previous kid's cached pages.
  try {
    if (localStorage.getItem('ck-student') !== studentId) {
      localStorage.setItem('ck-student', studentId);
      if ('caches' in window) await caches.delete('ck-pages');
    }
  } catch { /* storage blocked */ }

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  void flushOutbox();
  window.addEventListener('online', () => void flushOutbox());
}

void setup();

// Logging out: the next kid on a shared tablet must not see these pages offline
// (the service worker also clears them on any login/logout request).
document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  if (form.action?.includes('/api/auth/logout')) {
    try { localStorage.removeItem('ck-student'); } catch { /* ignore */ }
    if ('caches' in window) void caches.delete('ck-pages');
  }
});
