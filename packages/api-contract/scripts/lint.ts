import { execSync } from 'node:child_process';
execSync('redocly lint openapi.yaml', { stdio: 'inherit', cwd: process.cwd() });
