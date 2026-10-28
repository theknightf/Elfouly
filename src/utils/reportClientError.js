// Sends a crash report to the game server (if there is one) so a player's white screen
// does not go unnoticed. Silent when the server URL is unknown (e.g. Supabase-only deploys).
import { getServerUrl } from './serverUrl';

let lastSentAt = 0;

export function reportClientError(error, extra = {}) {
  try {
    const now = Date.now();
    if (now - lastSentAt < 3000) return; // never spam
    lastSentAt = now;
    const base = getServerUrl();
    if (!base) return;
    const payload = JSON.stringify({
      message: String(error?.message || error || 'unknown error'),
      stack: String(error?.stack || ''),
      url: typeof window !== 'undefined' ? window.location.href : '',
      ...extra
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(`${base}/api/client-error`, new Blob([payload], { type: 'application/json' }));
    } else if (typeof fetch === 'function') {
      fetch(`${base}/api/client-error`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // reporting must never break the app
  }
}
