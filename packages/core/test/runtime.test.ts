import { describe, it, expect } from 'vitest';
import {
  findOnPath,
  resolveBinaries,
  doctor,
  buildHyperframesEnv,
  hyperframesNpxArgs,
  DEFAULT_HYPERFRAMES_SPEC,
  resolveInside,
} from '../src/runtime/index';

describe('binary resolution', () => {
  it('finds node on PATH (it is running this test)', () => {
    expect(findOnPath('node')).toBeTruthy();
  });

  it('returns null for a binary that does not exist', () => {
    expect(findOnPath('definitely-not-a-real-binary-xyz')).toBeNull();
  });

  it('doctor reports a binaries map and notes', () => {
    const d = doctor();
    expect(d.binaries).toHaveProperty('ffmpeg');
    expect(Array.isArray(d.notes)).toBe(true);
    expect(typeof d.ok).toBe('boolean');
  });

  it('honors OVS_FFMPEG_PATH override', () => {
    const prev = process.env.OVS_FFMPEG_PATH;
    process.env.OVS_FFMPEG_PATH = '/custom/ffmpeg';
    try {
      expect(resolveBinaries().ffmpeg).toBe('/custom/ffmpeg');
    } finally {
      if (prev === undefined) delete process.env.OVS_FFMPEG_PATH;
      else process.env.OVS_FFMPEG_PATH = prev;
    }
  });
});

describe('hyperframes env', () => {
  it('points HyperFrames at the resolved ffmpeg/ffprobe and keeps fallback fetches quiet', () => {
    const env = buildHyperframesEnv({ ffmpeg: '/x/ffmpeg', ffprobe: '/x/ffprobe' }, {});
    expect(env.HYPERFRAMES_FFMPEG_PATH).toBe('/x/ffmpeg');
    expect(env.HYPERFRAMES_FFPROBE_PATH).toBe('/x/ffprobe');
    expect(env.NPM_CONFIG_PREFER_OFFLINE).toBe('true');
  });

  it('builds the compatibility npx arg vector with -y and the pinned spec', () => {
    const a = hyperframesNpxArgs('render', ['proj', '-o', 'out.mp4']);
    expect(a[0]).toBe('-y');
    expect(a[1]).toBe(DEFAULT_HYPERFRAMES_SPEC);
    expect(a).toEqual(expect.arrayContaining(['render', 'proj', '-o', 'out.mp4']));
  });
});

describe('resolveInside', () => {
  it('resolves a child path and rejects an escape', () => {
    expect(resolveInside('/base', 'a/b.txt')).toBe('/base/a/b.txt');
    expect(() => resolveInside('/base', '../escape.txt')).toThrow(/escape/);
  });
});
