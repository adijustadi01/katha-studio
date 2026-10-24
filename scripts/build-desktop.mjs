// Cross-platform desktop build: copies fonts and builds the renderer with relative paths into dist-desktop/.
import { execSync } from 'node:child_process';
process.env.KATHA_TARGET = 'desktop';
execSync('node scripts/copy-fonts.mjs', { stdio: 'inherit' });
execSync('npx vite build', { stdio: 'inherit', env: process.env });
