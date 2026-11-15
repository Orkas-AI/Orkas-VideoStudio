import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
export async function mediaDigest(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
