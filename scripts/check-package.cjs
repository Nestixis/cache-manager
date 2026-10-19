const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../package.json');
for (const entry of [manifest.main, manifest.types]) {
  if (!fs.statSync(path.resolve(__dirname, '..', entry)).isFile()) {
    throw new Error(`Missing package entry point: ${entry}`);
  }
}
console.log('Package entry points verified');
