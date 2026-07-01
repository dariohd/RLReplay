import { escapeHtml } from '../src/utils.js';

if (escapeHtml('<script>') !== '&lt;script&gt;') {
  console.error('escapeHtml failed');
  process.exit(1);
}

if (escapeHtml('Tom & Jerry') !== 'Tom &amp; Jerry') {
  process.exit(1);
}

console.log('RL Replay security checks OK');
