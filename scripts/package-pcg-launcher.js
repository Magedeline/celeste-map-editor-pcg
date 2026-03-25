const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const publishScript = path.join(repoRoot, 'scripts', 'publish-pcg-launcher.js');
const publishDir = path.join(repoRoot, 'pcg-launcher', 'publish');
const outputZip = path.join(repoRoot, 'pcg-launcher', 'CelestePcgLauncher-win-x64.zip');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [publishScript]);

if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

run('powershell', [
  '-NoProfile',
  '-Command',
  `Compress-Archive -Path '${publishDir}\\*' -DestinationPath '${outputZip}' -Force`,
]);

console.log(`PCG launcher zip created at ${outputZip}`);