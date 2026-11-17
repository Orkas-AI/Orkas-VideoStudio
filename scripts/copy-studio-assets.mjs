import { cp, mkdir } from 'node:fs/promises';
const source = new URL('../packages/tools/src/studio/web/', import.meta.url);
const destination = new URL('../packages/tools/dist/studio/web/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
