const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname);
process.env.NODE_ENV = 'production';
process.chdir(dir);

const currentPort = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';
let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10);

let nextConfig = {};
try {
  const requiredFilesPath = path.join(dir, '.next', 'required-server-files.json');
  if (fs.existsSync(requiredFilesPath)) {
    const requiredFiles = JSON.parse(fs.readFileSync(requiredFilesPath, 'utf8'));
    if (requiredFiles && requiredFiles.config) {
      nextConfig = requiredFiles.config;
    }
  }
} catch (err) {
  console.warn('Could not load .next/required-server-files.json, falling back to default config:', err);
}

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

require('next');
const { startServer } = require('next/dist/server/lib/start-server');

if (
  Number.isNaN(keepAliveTimeout) ||
  !Number.isFinite(keepAliveTimeout) ||
  keepAliveTimeout < 0
) {
  keepAliveTimeout = undefined;
}

startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
