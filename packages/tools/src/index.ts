export * as edit from './edit/index.js';
export * as render from './render/index.js';
export * as analyze from './analyze/index.js';
export * as speech from './speech/index.js';
export * as image from './image/index.js';
export * as video from './video/index.js';

// Also re-export the flat surfaces for direct imports.
export { editVideo, probeMedia } from './edit/index.js';
export type { EditOp, ProbeResult } from './edit/index.js';
export type { EditProgressEvent, OnEditProgress, EditRunOptions } from './progress.js';
export { collectProducedSec, resolveProducedPath } from './plan-produced.js';
