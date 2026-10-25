import { rm } from 'node:fs/promises';
for (const directory of ['.next', 'build']) await rm(new URL(`../${directory}`, import.meta.url), { recursive: true, force: true });
