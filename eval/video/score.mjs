import { alignAudio, coverage, detectCuts, pictureDifference, sourceRanges, toneIntervals, unchangedAudio } from './evidence.mjs';
import { decodePcm } from './media.mjs';

const vertical = ({ width, height }) => height > width;
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

export async function scoreCase(tools, truth, stages, voiceRequests) {
  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) });
  const last = stages.at(-1)?.delivery;
  if (truth.kind === 'clip-montage') {
    stages.forEach(({ delivery }, index) => check(`stage-${index + 1}-delivered`, delivery));
  } else {
    check('delivered', last);
  }
  if (!last) return checks;
  const { file, probe } = last;
  if (truth.kind === 'retakes') {
    check('vertical', vertical(probe));
    const alignment = await alignAudio(tools, file, truth.file);
    const spans = truth.lines.map(line => ({ ...line, coverage: coverage(alignment, line) }));
    const keep = spans.filter(line => line.role === 'keep');
    const drop = spans.filter(line => line.role !== 'keep');
    const summary = lines => Object.fromEntries(lines.map(line => [line.id, line.coverage]));
    check('keeps-every-good-take', keep.every(line => line.coverage >= 0.9), summary(keep));
    check('drops-the-bad-takes', drop.every(line => line.coverage <= 0.2), summary(drop));
    check('no-clipped-words', spans.every(line => line.coverage <= 0.2 || line.coverage >= 0.9));
    const order = sourceRanges(alignment).filter(range => range.outEnd - range.outStart >= 0.3).map(range => range.start);
    check('in-order', order.length && order.every((start, index) => !index || start > order[index - 1]), order);
    const speech = keep.reduce((seconds, line) => seconds + line.end - line.start, 0);
    check('no-dead-air', probe.duration <= speech + 0.7 * keep.length + 1, probe.duration);
  }

  if (truth.kind === 'montage') {
    check('about-fifteen-seconds', probe.duration >= 10 && probe.duration <= 22, probe.duration);
    const alignment = await alignAudio(tools, file, truth.music);
    const groups = alignment.segments.map(({ offset }) => ({
      offset,
      seconds: alignment.segments.filter(s => near(s.offset, offset, 0.005))
        .reduce((total, s) => total + s.outEnd - s.outStart, 0),
    }));
    const [track] = groups.sort((a, b) => b.seconds - a.seconds);
    const share = (track?.seconds ?? 0) / probe.duration;
    check('plays-the-track-unchanged', share >= 0.8, share);
    const { fps, cuts } = await detectCuts(tools, file);
    check('enough-cuts', cuts.length >= 5, cuts);
    const off = cuts.filter(cut => !truth.beats.some(beat => near(beat, cut + (track?.offset ?? 0), 1 / fps + 0.005)));
    check('cuts-on-the-beat', share >= 0.8 && cuts.length >= 5 && off.length <= 1, off);
  }

  if (truth.kind === 'dub') {
    check('vertical', vertical(probe));
    check('keeps-the-length', probe.duration >= truth.duration * 0.8 && probe.duration <= truth.duration * 1.8, probe.duration);
    const source = await alignAudio(tools, file, truth.file);
    const retained = truth.lines.filter(line => coverage(source, line) > 0.2);
    check('replaces-the-chinese-voice', retained.length === 0, retained.map(line => line.id));
    const verified = [];
    for (const request of voiceRequests) {
      const aligned = await alignAudio(tools, file, request.file);
      if (coverage(aligned, { start: 0, end: request.duration }) >= 0.65) verified.push(request.text);
    }
    check('english-narration', verified.length && verified.every(line => !/[\u3400-\u9fff]/u.test(line) && /[a-z]/i.test(line)), verified);
    const numbers = verified.join(' ').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    check('no-new-numbers', verified.length && numbers.every(value => truth.numbers.includes(value)), numbers);
    const dubbed = toneIntervals(await decodePcm(tools, file, 32000), 11600);
    const dubbedSeconds = dubbed.reduce((sum, span) => sum + span.end - span.start, 0);
    check('narrated', dubbedSeconds >= probe.duration * 0.5, dubbedSeconds);
  }

  if (truth.kind === 'clip-montage') {
    const [first, opening, short, square, recovered] = stages.map(stage => stage.delivery);
    if (!first || !opening || !short || !square || !recovered) return checks;
    check('original-format', vertical(first.probe) && near(first.probe.duration, 24, 0.3));
    const music = await alignAudio(tools, first.file, truth.music);
    check('uses-supplied-music', coverage(music, { start: 0, end: 24 }) >= 0.9);
    const sameFormat = (a, b) => a.width === b.width && a.height === b.height && near(a.duration, b.duration, 0.1);
    check('opening-format', sameFormat(first.probe, opening.probe));
    check('short-format', vertical(short.probe) && near(short.probe.duration, 15, 0.3));
    check('square-format', square.probe.width === square.probe.height && near(square.probe.duration, 15, 0.3));
    check('recovered-format', sameFormat(square.probe, recovered.probe));
    const compare = async (a, b, start, end, expectedChange) => {
      const result = await pictureDifference(tools, a.file, b.file, start, end);
      check(`picture-${b.id}-${start}-${end}`, result && (expectedChange ? result.mean >= 4 : result.mean <= 3 && result.max <= 10), result);
    };
    await compare(first, opening, 0, 4, true);
    await compare(first, opening, 4, 24, false);
    await compare(square, recovered, 0, 13, false);
    await compare(square, recovered, 13, 15, true);
    check('opening-keeps-audio', await unchangedAudio(tools, first.file, opening.file, 0, 24));
    check('square-keeps-audio', await unchangedAudio(tools, short.file, square.file, 0, 15));
    check('recovery-keeps-audio', await unchangedAudio(tools, square.file, recovered.file, 0, 15));
    const originalThread = stages[0].thread;
    check('fresh-conversation', originalThread && stages.slice(0, -1).every(stage => stage.thread === originalThread)
      && stages.at(-1).thread && stages.at(-1).thread !== originalThread && square.production === recovered.production);
  }
  return checks;
}
