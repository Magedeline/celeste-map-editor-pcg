const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

function resolveCmakeExecutable() {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\CMake\\bin\\cmake.exe',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe',
        'cmake',
      ]
    : ['cmake'];

  for (const candidate of candidates) {
    if (candidate === 'cmake') {
      const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
      if (result.status === 0) {
        return candidate;
      }
      continue;
    }

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('CMake executable not found. Install CMake or update scripts/build-native.js.');
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const cmake = resolveCmakeExecutable();

run(cmake, ['-S', 'cpp', '-B', 'cpp/build', '-DCMAKE_BUILD_TYPE=Release']);
run(cmake, ['--build', 'cpp/build', '--config', 'Release']);