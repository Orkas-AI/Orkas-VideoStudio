import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { storyboardTiming } from '@orkas/video-studio-core';

/** Read at most 1 MiB, including a concurrent-growth check, before pure validation. */
export function storyboardTimingFile(input: string) {
  let fd: number | undefined;
  try {
    fd = openSync(input, 'r');
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error();
    const buffer = Buffer.alloc(1024 * 1024 + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > 1024 * 1024) throw new Error();
    return storyboardTiming(JSON.parse(buffer.subarray(0, length).toString('utf8')));
  } catch {
    return { ok: false, errorCode: 'E_STORYBOARD_TIMING_INPUT', message: 'Input must be a readable JSON file no larger than 1 MiB.' };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
