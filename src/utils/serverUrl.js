/**
 * src/utils/serverUrl.js
 *
 * Resolves the backend server URL based on environment and browser location.
 *
 * Rules, in order:
 * 1. If env.VITE_SERVER_URL is set, use it (trim trailing slash).
 * 2. Else if env.DEV is true, use http://${hostname}:3001 (covers localhost and local testing).
 * 3. Else return null. In a production build never guess a URL.
 */

export function getServerUrl({ env, location } = {}) {
  const currentEnv = env !== undefined
    ? env
    : (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {});

  const currentLocation = location !== undefined
    ? location
    : (typeof window !== 'undefined' && window.location ? window.location : {});

  // 1. If env.VITE_SERVER_URL or env.VITE_SOCKET_URL is set, use it (trim trailing slash)
  const envUrl = currentEnv?.VITE_SERVER_URL || currentEnv?.VITE_SOCKET_URL;
  if (typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  const hostname = currentLocation?.hostname || 'localhost';

  // 2. Else if env.DEV is true, use http://${hostname}:3001 (covers localhost and local testing)
  if (Boolean(currentEnv?.DEV)) {
    return `http://${hostname}:3001`;
  }

  // 3. Else return null. In a production build never guess a URL.
  return null;
}
