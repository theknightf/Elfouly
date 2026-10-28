// Guards against the "X is not defined" crash class (e.g. a component using `isHost`
// without taking it from the game context, which white-screened Round 3 for everyone).
import { execSync } from 'node:child_process';

// Browser / Node globals that the linter does not know about in this project.
const KNOWN_GLOBALS = new Set([
  'console', 'process', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'window', 'document',
  'navigator', 'localStorage', 'sessionStorage', 'fetch', 'URL', 'AbortController', 'Audio', 'AudioContext',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'crypto', 'Buffer', 'structuredClone',
  'HTMLElement', 'Intl', 'Image', 'Event', 'location', 'alert', 'atob', 'btoa', 'FileReader', 'Blob',
  'URLSearchParams', 'TextEncoder', 'WebSocket', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver',
  'matchMedia', 'queueMicrotask', 'CustomEvent', 'Notification', 'screen', 'history', 'getComputedStyle',
  'FormData', 'Headers', 'Request', 'Response', 'globalThis', 'webkitAudioContext'
]);

let output = '';
try {
  output = execSync('npx oxlint -D no-undef src server services', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error: any) {
  output = `${error.stdout || ''}${error.stderr || ''}`;
}

const undefinedIdentifiers = output
  .split('\n')
  .filter(line => line.includes('eslint(no-undef)'))
  .map(line => ({ line: line.trim(), name: /'([^']+)' is not defined/.exec(line)?.[1] }))
  .filter(entry => entry.name && !KNOWN_GLOBALS.has(entry.name))
  .map(entry => entry.line);

if (undefinedIdentifiers.length) {
  console.error('Undefined identifiers found:\n' + undefinedIdentifiers.join('\n'));
  process.exit(1);
}
console.log('ok - no undefined identifiers in src, server or services');
