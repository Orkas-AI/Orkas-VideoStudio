import imageAsset from './preparation-engine.cjs';

export interface PrepareImageParams {
  project: string;
  request?: unknown;
  request_file?: string;
}

/** Bounded local preparation; the shared engine validates paths and publishes exclusively. */
export async function prepareImage(params: PrepareImageParams): Promise<Record<string, unknown>> {
  if ((params.request === undefined) === (params.request_file === undefined)) {
    return { ok: false, errorCode: 'E_IMAGE_ASSET_ARGS', message: 'Supply exactly one request or request_file.' };
  }
  const args = ['--project', params.project, params.request_file === undefined ? '--request-json' : '--request-file', params.request_file ?? JSON.stringify(params.request)];
  return imageAsset({ args });
}
