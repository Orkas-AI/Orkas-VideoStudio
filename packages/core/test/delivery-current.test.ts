import { describe, expect, it } from 'vitest';
import {
  assessDeliveredExpectations, assessCutsOffBeat, assessHeldShot, assessMotionAgainstReference, assessNarrationOverSpeech, assessSilentStretches,
  heardFrameSamples, heldStillScenes, heldStillsDeliveredMessage, heldStillsFinding, heldStillsMessage, linePlaybacks, narrationPlaybackFindings,
  NARRATION_PLAYBACK_RATE, originalAudioComparable, originalAudioHeard, originalAudioUnverifiedIssue, parseDeliveredAudioMeasurement,
  parseMotionSamples, parseVisualHints, quarterMedians, REFERENCE_MOTION_CODE, referenceComparisonReport, referenceMoments, referenceMotionIssue,
  spreadIndexes, type LinePlayback,
} from '../src/delivery/index.js';
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
  // 2026-11-19: a tutorial told only that "one of them stops early" (picture 30.6 s, sound 22.2 s)
  // stopped to ask for its narration to be recorded again.
  it('says which end of a delivery lacks sound or picture and what to cut or add', () => {
    const input = { expectedDurationSec: null, expectedAspect: null, expectsAudio: true, expectsCaptions: false, integratedLufs: null, sidecarSubtitleFound: false, digitalSilence: false };
    const short = assessDeliveredExpectations({ ...input, spec: { ...spec, videoDurationSec: 4, audioDurationSec: 2 } });
    expect(short).toEqual([{ code: 'DELIVERY_AV_DURATION_MISMATCH', severity: 'error', message: 'The picture runs 4.00s and the sound 2.00s, so the last 2.00s have no sound. Give that stretch sound, such as another narration line or music under the end, or cut the picture to 2.00s, then deliver again.' }]);
    const long = assessDeliveredExpectations({ ...input, spec: { ...spec, videoDurationSec: 2, audioDurationSec: 4 } });
    expect(long[0].message).toBe('The picture runs 2.00s and the sound 4.00s, so the sound runs 2.00s past the picture. Cut the sound to 2.00s or extend the picture, then deliver again.');
    expect(assessDeliveredExpectations({ ...input, spec: { ...spec, videoDurationSec: 4, audioDurationSec: 3.6 } })).toEqual([]);
  });
  // 2026-11-24: a 15.10 s recap was asked for at 30 s. A length that differs from what was asked
  // for may be the right cut, so it is reported for the caller to judge; the timeline length still blocks.
  const lengths = { expectedAspect: null, expectsAudio: false, expectsCaptions: false, integratedLufs: null, sidecarSubtitleFound: false, digitalSilence: false };
  it.each([29.6, 29.5, 30.5, 0, Number.POSITIVE_INFINITY])('omits a length advisory for a matching or unusable requested length (%s)', (requested) => {
    expect(assessDeliveredExpectations({ ...lengths, spec: { ...spec, durationSec: 30 }, expectedDurationSec: null, requestedDurationSec: requested })).toEqual([]);
  });
  it('reports a requested length apart from a timeline length that blocks', () => {
    expect(assessDeliveredExpectations({ ...lengths, spec: { ...spec, durationSec: 15 }, expectedDurationSec: 20, requestedDurationSec: 30 })).toEqual([
      { code: 'DELIVERY_DURATION_DRIFT', severity: 'error', message: 'The delivered video is 15.00s but it should be 20s (off by 5.00s). Narration and captions are timed against that length, so the two have to agree before delivery.' },
      { code: 'DELIVERY_REQUESTED_DURATION_DRIFT', severity: 'warning', message: 'The delivered video is 15.00s. The requested length was 30s (a difference of 15.00s). Use the editing context to decide whether to keep this cut or revise it.' },
    ]);
    expect(assessDeliveredExpectations({ ...lengths, spec: { ...spec, durationSec: 15 }, expectedDurationSec: null, requestedDurationSec: 30 }).map((issue) => issue.severity)).toEqual(['warning']);
  });
});

describe('a video cut to its music whose picture does not change', () => {
  it('names no cut, or one shot over half of it', () => {
    expect(assessHeldShot([], 15.034)).toEqual([{
      code: 'DELIVERY_NO_CUTS',
      severity: 'warning',
      message: 'The delivered file has no cut: one picture runs the whole 15.03s. Check how long each shot was made to last, then render and deliver again.',
    }]);
    // One photo stretched past its beat: 26.8 s of a 30 s video before the next picture.
    expect(assessHeldShot([26.8, 28.2], 30)).toEqual([{
      code: 'DELIVERY_SHOT_HELD',
      severity: 'warning',
      message: 'One shot runs from 0.00s to 26.80s, more than half of this 30.00s video, so the picture does not change on the beat there. Check how long each shot was made to last, then render and deliver again.',
    }]);
    expect(assessHeldShot([4, 26], 30)[0].message).toMatch(/^One shot runs from 4\.00s to 26\.00s, /);
    // A hold of half the video or less, or no length to measure against, is left alone.
    expect(assessHeldShot([7.5], 15)).toEqual([]);
    expect(assessHeldShot([0.94, 1.88, 2.81, 9, 10.3], 15)).toEqual([]);
    expect(assessHeldShot([], 0)).toEqual([]);
  });
});

describe('a video built from held stills', () => {
  it('reads each held stretch from the visual hint pass', () => {
    const stderr = [
      '[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 1',
      '[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 3',
      '[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 8',
    ].join('\n');
    expect(parseVisualHints(stderr, 10).staticShare).toBeCloseTo(0.4, 5);
    expect(parseVisualHints(stderr, 10).frozen).toEqual([{ startSec: 1, endSec: 3 }, { startSec: 8, endSec: 10 }]);
    expect(parseVisualHints('', 10)).toEqual({ staticShare: 0, shots: 1, frozen: [] });
  });

  it('counts only scenes that place a still picture, leaving out the time footage plays, most still first', () => {
    const scenes = [
      { id: 'hook', startSec: 0, endSec: 2, footage: [], pictures: true },
      { id: 'site', startSec: 2, endSec: 5, footage: [], pictures: true },
      { id: 'diagram', startSec: 5, endSec: 7, footage: [], pictures: false },
      { id: 'street', startSec: 7, endSec: 9, footage: [{ startSec: 7, endSec: 9 }], pictures: true },
    ];
    expect(heldStillScenes([{ startSec: 0.5, endSec: 9 }], scenes)).toEqual([{ id: 'site', seconds: 3 }, { id: 'hook', seconds: 1.5 }]);
    expect(heldStillScenes([], scenes)).toEqual([]);
  });

  // 2026-11-23: one stock clip and four screenshots in a single scene went out 69% still.
  it('counts a scene\'s pictures beside its footage, sequential or laid over, and only the footage\'s own time is left out', () => {
    const story = (footage: Array<{ startSec: number; endSec: number }>) => [{ id: 'story', startSec: 0, endSec: 6, footage, pictures: true }];
    expect(heldStillScenes([{ startSec: 0, endSec: 4 }], story([{ startSec: 4, endSec: 6 }]))).toEqual([{ id: 'story', seconds: 4 }]);
    expect(heldStillScenes([{ startSec: 4, endSec: 6 }], story([{ startSec: 4, endSec: 6 }]))).toEqual([]);
    expect(heldStillScenes([{ startSec: 0, endSec: 5 }], story([{ startSec: 2, endSec: 4 }, { startSec: 1, endSec: 3 }]))).toEqual([{ id: 'story', seconds: 2 }]);
  });

  it('gives the canvas the share held and the scenes the message names', () => {
    const held = ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({ id, seconds: 5 - index }));
    expect(heldStillsFinding(0.764, held)).toEqual({ percent: 76, scenes: held.slice(0, 4) });
    expect(heldStillsFinding(1.2, held.slice(0, 1))).toEqual({ percent: 100, scenes: [{ id: 'a', seconds: 5 }] });
  });

  it('says which scenes stand still and how to make them move, then what to say once delivered', () => {
    const held = [{ id: 'hook', seconds: 2 }, { id: 'site', seconds: 2 }];
    expect(heldStillsMessage(0.66, held)).toBe('66% of this video is a still frame held for a second or more, so it plays as a slideshow. It stands still in scenes "hook" (2.0 s), "site" (2.0 s). Make those scenes move, then render and deliver again: where the shot need not be the user\'s own, such as a place or people using this kind of thing, put in footage the user supplies or a generated clip; where it is the user\'s own product or photo, move across it with a slow push in, pan or scroll; on a screen of a site or app, show the step the line names done on it with ./assets/vendor/screen-demo.js (timeline.md).');
    expect(heldStillsMessage(0.7, [{ id: 'screens', seconds: 4 }])).toContain('It stands still in scene "screens" (4.0 s).');
    expect(heldStillsMessage(0.9, ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, seconds: 1 })))).toContain('"d" (1.0 s) and 2 more.');
    expect(heldStillsDeliveredMessage(0.66, held)).toBe('66% of this video still stands still after one round of changes, in scenes "hook" (2.0 s), "site" (2.0 s). It is delivered as it is: say in your reply which scenes still hold still, so the user can ask for more movement.');
  });
});

describe('frames under each declared narration line', () => {
  const line = (startSec: number, endSec: number, text = 'x') => ({ startSec, endSec, text });

  it('takes a frame just before each line ends, numbered, then the last frame', () => {
    expect(heardFrameSamples(23.2, [line(0, 4.86, 'a'), line(16.64, 21.3, 'saved')])).toEqual([
      { atSec: 4.76, label: '#1 4.8s', heard: 'a' },
      { atSec: 21.2, label: '#2 21.2s', heard: 'saved' },
      { atSec: 23.1, label: '#3 23.1s (last frame)' },
    ]);
  });

  it('does not repeat the last frame when the last line ends there, and has nothing without lines', () => {
    expect(heardFrameSamples(23.2, [line(16.64, 23.3, 'saved')])).toEqual([{ atSec: 23.1, label: '#1 23.1s', heard: 'saved' }]);
    expect(heardFrameSamples(10, [])).toEqual([]);
  });

  it('shows thirteen lines whole, and keeps the first and last of many more', () => {
    const clauses = Array.from({ length: 13 }, (_item, index) => line(index * 2, index * 2 + 1.5, `clause ${index}`));
    expect(heardFrameSamples(30.7, clauses).filter((sample) => sample.heard).map((sample) => sample.heard)).toEqual(clauses.map((clause) => clause.text));
    const many = Array.from({ length: 30 }, (_item, index) => line(index, index + 0.8, `line ${index}`));
    const samples = heardFrameSamples(31, many);
    expect(samples).toHaveLength(17);
    expect(samples[0].heard).toBe('line 0');
    expect(samples[15].heard).toBe('line 29');
    expect(samples[16].heard).toBeUndefined();
    expect(spreadIndexes(30, 16)).toHaveLength(16);
    expect(spreadIndexes(3, 16)).toEqual([0, 1, 2]);
  });
});

describe('narration played twice or cut off', () => {
  const windows = (from: number, to: number) => { const out = new Uint8Array(1200); out.fill(1, from, to); return out; };
  const playback = (outStart: number, outEnd: number, extra: Partial<LinePlayback> = {}): LinePlayback => ({
    share: 0.9, heardSec: outEnd - outStart, outStart, outEnd, offsetSec: 0, missingTailSec: 0, windows: windows(Math.round(outStart * 100), Math.round(outEnd * 100)), ...extra,
  });

  it('names a line heard at two places, once for two files of the same words', () => {
    const twice = [playback(1, 4), playback(6, 9)];
    expect(narrationPlaybackFindings([{ text: '合同从三十天变成九十天。', playbacks: twice }])).toEqual([{
      code: 'DELIVERY_NARRATION_REPEATED',
      severity: 'error',
      message: 'The narration line "合同从三十天变成九十天。" plays twice, from 1.0 s and from 6.0 s. Keep it once, then deliver again.',
    }]);
    expect(narrationPlaybackFindings([{ text: 'Same words', playbacks: twice }, { text: 'Same  words', playbacks: twice }])).toHaveLength(1);
  });

  it('names a line that stops before its end, but not a draft heard inside another line', () => {
    expect(narrationPlaybackFindings([{ text: 'Cut', playbacks: [playback(1, 2.8, { missingTailSec: 1.2 })] }])).toEqual([{
      code: 'DELIVERY_NARRATION_CUT_OFF',
      severity: 'error',
      message: 'The narration line "Cut" stops at 2.8 s before its end; about 1.2 s of it is not heard. Let it finish or shorten the line, then deliver again.',
    }]);
    // The draft shares the final take's opening; the stretch belongs to the line heard longer there.
    const final = playback(1, 4);
    const draft = playback(1, 2.5, { missingTailSec: 1 });
    expect(narrationPlaybackFindings([{ text: 'draft', playbacks: [draft] }, { text: 'final', playbacks: [final] }])).toEqual([]);
    // Heard too little to have played at all.
    expect(narrationPlaybackFindings([{ text: 'quiet', playbacks: [playback(1, 4, { share: 0.3, missingTailSec: 2 })] }])).toEqual([]);
  });
});

// 2026-11-24: a recap kept a clip's own sound, and the delivered file played other sound there.
describe('kept clip sound in the delivered file', () => {
  const rate = NARRATION_PLAYBACK_RATE;
  /** Deterministic noise, so the same seed is the same sound. */
  const noise = (seconds: number, seed: number, level = 0.3) => {
    let state = seed >>> 0;
    return Float32Array.from({ length: Math.round(seconds * rate) }, () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), state | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1) * level;
    });
  };
  const pcm = (...parts: Float32Array[]) => {
    const samples = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) { samples.set(part, at); at += part.length; }
    return { rate, samples };
  };

  it('says where a line plays against the source, as the source time minus the delivered time', () => {
    const source = noise(3, 7);
    const [played] = linePlaybacks(pcm(new Float32Array(rate), source), pcm(source));
    expect(played.offsetSec).toBeCloseTo(-1, 1);
  });

  it('finds the kept sound only where it plays in step, and compares only a source with sound', () => {
    const source = noise(3, 11);
    expect(originalAudioHeard(pcm(source), pcm(source))).toBe(true);
    expect(originalAudioHeard(pcm(new Float32Array(rate / 2), source.subarray(0, source.length - rate / 2)), pcm(source))).toBe(false);
    expect(originalAudioHeard(pcm(noise(3, 12)), pcm(source))).toBe(false);
    expect(originalAudioComparable(pcm(source))).toBe(true);
    expect(originalAudioComparable(pcm(noise(3, 13, 0.005)))).toBe(false);
    expect(originalAudioComparable(pcm(noise(0.7, 14)))).toBe(false);
  });

  it('names the stretch of the delivery to review', () => {
    expect(originalAudioUnverifiedIssue(2, 3)).toEqual({
      code: 'DELIVERY_ORIGINAL_AUDIO_UNVERIFIED',
      severity: 'warning',
      message: 'Could not verify the original sound marked to keep at 2.00s–5.00s in the delivered file. Review that section to decide whether the original sound needs restoring or the mix needs adjusting.',
    });
  });
});

describe('motion against a reference', () => {
  it('takes the middle of each quarter of each video, over the first five minutes', () => {
    expect(referenceMoments(12, 20)).toEqual([
      { row: 1, share: 0.125, referenceSec: 1.5, videoSec: 2.5 },
      { row: 2, share: 0.375, referenceSec: 4.5, videoSec: 7.5 },
      { row: 3, share: 0.625, referenceSec: 7.5, videoSec: 12.5 },
      { row: 4, share: 0.875, referenceSec: 10.5, videoSec: 17.5 },
    ]);
    expect(referenceMoments(1200, 10).at(-1)?.referenceSec).toBe(262.5);
  });

  it('pairs each frame time with its change and takes each quarter\'s median', () => {
    const stderr = [
      '[Parsed_metadata_4 @ 0x1] frame:0    pts:1      pts_time:0.125',
      '[Parsed_metadata_4 @ 0x1] lavfi.signalstats.YAVG=4.5',
      '[Parsed_metadata_4 @ 0x1] frame:1    pts:2      pts_time:0.25',
      '[Parsed_metadata_4 @ 0x1] lavfi.signalstats.YAVG=0',
    ].join('\r\n');
    expect(parseMotionSamples(stderr)).toEqual([{ atSec: 0.125, change: 4.5 }, { atSec: 0.25, change: 0 }]);
    const samples = [0.1, 0.2, 0.3, 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3, 3.9]
      .map((atSec, index) => ({ atSec, change: index === 4 ? 60 : atSec < 2 ? 3 : 0 }));
    expect(quarterMedians(samples, 4)).toEqual([3, 3, 0, 0]);
    expect(quarterMedians([{ atSec: 0.1, change: 2 }, { atSec: 0.2, change: 2 }, { atSec: 3.5, change: 2 }], 4)).toEqual([2, null, null, null]);
  });

  it('names a video much stiller in half or more of the compared quarters, not one held quarter or a still end card', () => {
    const assessment = assessMotionAgainstReference([6, 8, 7, 6], [5, 0.5, 0.2, 6]);
    expect(assessment.stiller).toBe(true);
    expect(assessment.weakRows).toEqual([2, 3]);
    expect(assessment.score).toBeCloseTo((5 / 6 + 0.5 / 8 + 0.2 / 7 + 1) / 4, 5);
    expect(assessMotionAgainstReference([6, 8, 7, 6], [6, 8, 0, 6]).stiller).toBe(false);
    const endCard = assessMotionAgainstReference([6.8, 9, 5.9, 0], [0.5, 9, 6, 0]);
    expect(endCard.rows[3].ratio).toBeNull();
    expect(endCard.stiller).toBe(false);
    expect(assessMotionAgainstReference([0.04, 0.1, 0.6, 0], [0, 0, 0, 0])).toMatchObject({ stiller: false, weakRows: [], score: null });
  });

  it('names the rows, how far through, and how much less they move', () => {
    const moments = referenceMoments(12, 20);
    const assessment = assessMotionAgainstReference([6, 8, 7, 6], [5, 1.6, 0.7, 6]);
    expect(referenceMotionIssue(assessment, moments)).toEqual({
      code: REFERENCE_MOTION_CODE,
      severity: 'warning',
      message: 'Beside the reference at the same point of each, this video moves much less in row 2 (38% through: 20% of the reference\'s movement)'
        + ' and row 3 (63% through: 10% of the reference\'s movement) of the reference comparison.'
        + ' Make those parts move the way the reference does there, with footage, a camera move or animation instead of a held picture, then render.',
    });
    expect(referenceMotionIssue(assessMotionAgainstReference([6, 8, 7, 6], [6, 8, 7, 6]), referenceMoments(4, 4))).toBeNull();
    expect(referenceComparisonReport(moments, assessment)).toEqual({
      rows: [
        { row: 1, reference_at_sec: 1.5, video_at_sec: 2.5, motion_vs_reference: 0.83 },
        { row: 2, reference_at_sec: 4.5, video_at_sec: 7.5, motion_vs_reference: 0.2 },
        { row: 3, reference_at_sec: 7.5, video_at_sec: 12.5, motion_vs_reference: 0.1 },
        { row: 4, reference_at_sec: 10.5, video_at_sec: 17.5, motion_vs_reference: 1 },
      ],
      motion_score: 0.53,
    });
  });
});
