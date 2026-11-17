import { capabilities } from '../speech/speech.js';

/** Only advertise voices known by the configured executable profile. */
export async function listTtsCapabilities() {
  const profile = capabilities();
  return profile.configured ? [{ routeRef: profile.route_ref, displayName: profile.route_ref,
    voices: [{ voiceRef: profile.voice, displayName: profile.voice }] }] : [];
}
export const publicTtsCapabilities = <T>(routes: T) => routes;
export function listableTtsVoices<T>(voices: T[], _options: { language: string; limit: number }) { return { voices }; }
