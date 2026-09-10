import { expect, it } from 'vitest';
import { assessDeliveredNarration, assessDeliveredSpec, parseIntegratedLufs, parseVoicedSpan, type DeliveryNarrationLine } from '../src/delivery/index.js';
const line = (index: number, start: number, end: number): DeliveryNarrationLine => ({ index, startSec: start, targetSec: end - start, voicedStartSec: start, voicedEndSec: end, textHead: 'Line' });
it('checks voiced overlap and truncation while leaving intentional silence alone', () => {
  expect(assessDeliveredNarration([line(0, 0, 3), line(1, 7, 10)], 10)).toEqual([]);
  expect(assessDeliveredNarration([line(0, 0, 6), line(1, 5.5, 11)], 10).map((x) => x.code)).toEqual(['DELIVERY_NARRATION_OVERLAP', 'DELIVERY_NARRATION_TRUNCATED']);
});
it('compares real duration, aspect, audio, loudness and caption evidence with the plan', () => {
  const args = { spec: { durationSec: 12, width: 1920, height: 1080, fps: 30, hasAudio: false, subtitleStreams: 0 }, planTotalTargetSec: 10, planAspect: '9:16', narrationLineCount: 2, captionLineCount: 2, integratedLufs: -18, sidecarSubtitleFound: false };
  expect(assessDeliveredSpec(args).map((x) => x.code)).toEqual(['DELIVERY_DURATION_DRIFT', 'DELIVERY_ASPECT_MISMATCH', 'DELIVERY_NO_AUDIO', 'DELIVERY_CAPTIONS_MISSING']);
  expect(assessDeliveredSpec({ ...args, spec: { ...args.spec, hasAudio: true }, sidecarSubtitleFound: true }).map((x) => x.code)).toContain('DELIVERY_LOUDNESS_OFF_TARGET');
});
it('reads only the final integrated summary and preserves speech after interior pauses', () => {
  expect(parseIntegratedLufs('t:0 I: -70 LUFS\nSummary:\nI: -19 LUFS\nSummary:\nI: -14.1 LUFS')).toBe(-14.1);
  expect(parseIntegratedLufs('I: -70 LUFS')).toBeNull();
  expect(parseVoicedSpan('silence_start: 0\nsilence_end: 0.2\nsilence_start: 1.5\nsilence_end: 2', 4)).toEqual({ startSec: 0.2, endSec: 4 });
  expect(parseVoicedSpan('silence_start: 3', 4)).toEqual({ startSec: 0, endSec: 3 });
});

it('does not lose an overlong voice behind later nested short lines', () => {
  const issues = assessDeliveredNarration([line(0, 0, 12), line(1, 1, 2), line(2, 3, 4)], 10);
  expect(issues.filter((i) => i.code === 'DELIVERY_NARRATION_OVERLAP')).toHaveLength(2);
  expect(issues.find((i) => i.code === 'DELIVERY_NARRATION_TRUNCATED')?.message).toContain('line 0');
});
