import { describe, expect, it } from 'vitest';
import { assessDeliveredExpectations, assessCutsOffBeat, assessNarrationOverSpeech, assessSilentStretches, parseDeliveredAudioMeasurement } from '../src/delivery/index.js';
describe('artifact-based delivery', () => {
  const spec = { durationSec: 8, width: 640, height: 360, fps: 30, hasAudio: true, subtitleStreams: 0 };
  it('requires expected sound even when there is no narration and refuses proven silent samples', () => {
    const input = { spec, expectedDurationSec: 8, expectedAspect: '16:9', expectsAudio: true, expectsCaptions: false, integratedLufs: null, sidecarSubtitleFound: false };
    expect(assessDeliveredExpectations({ ...input, digitalSilence: true })).toEqual([expect.objectContaining({ code: 'DELIVERY_AUDIO_SILENT', severity: 'error' })]);
    expect(assessDeliveredExpectations({ ...input, digitalSilence: null })).toEqual([expect.objectContaining({ code: 'DELIVERY_AUDIO_UNVERIFIABLE', severity: 'warning' })]);
    expect(assessDeliveredExpectations({ ...input, digitalSilence: false })).toEqual([]);
  });
  it('treats incomplete multi-stream summaries as unknown, keeping opposite-phase sound independent', () => {
    const stats = (id: string, peak: string) => `[Parsed_astats_0 @ ${id}] Overall\n[Parsed_astats_0 @ ${id}] Peak level dB: ${peak}\n[Parsed_astats_0 @ ${id}] Number of samples: 48000`;
    expect(parseDeliveredAudioMeasurement(stats('a', '-inf'), 2).digitalSilence).toBeNull();
    expect(parseDeliveredAudioMeasurement(stats('a', '-inf') + '\n' + stats('b', '-20'), 2).digitalSilence).toBe(false);
    expect(parseDeliveredAudioMeasurement(stats('a', '-inf') + '\n' + stats('b', '-inf'), 2).digitalSilence).toBe(true);
  });
  it('reports measured silent stretches, overlapping dialogue and frame-level beat drift as advice', () => {
    expect(assessSilentStretches([{ startSec: 4, endSec: 8 }], true)[0].code).toBe('DELIVERY_SILENT_STRETCH');
    expect(assessSilentStretches([{ startSec: 4, endSec: 8 }], false)).toEqual([]);
    expect(assessNarrationOverSpeech([{ index: 1, start: 1, end: 2 }], [{ startSec: 1.4, endSec: 2 }])[0].code).toBe('DELIVERY_NARRATION_OVER_SPEECH');
    expect(assessCutsOffBeat([1.1], [1], 30)[0]).toMatchObject({ code: 'DELIVERY_CUTS_OFF_BEAT', severity: 'warning' });
    expect(assessCutsOffBeat([1.02], [1], 30)).toEqual([]);
  });
});
