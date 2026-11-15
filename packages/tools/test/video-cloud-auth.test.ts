import { afterEach, expect, it, vi } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createVideoCloudCredentials } from '../src/video/cloud-auth.js';
afterEach(() => vi.unstubAllGlobals());
it('signs one bounded service-account grant with the approved audience and reuses the token', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const account = { type: 'service_account', project_id: 'test-project', client_email: 'studio@test-project.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), token_uri: 'https://oauth2.googleapis.com/token' };
  const fetch = vi.fn(async (url: any, init: any) => {
    expect(url).toBe(account.token_uri); expect(init.redirect).toBe('error');
    const assertion = new URLSearchParams(init.body).get('assertion')!, [header, payload, signature] = assertion.split('.');
    expect(verify('RSA-SHA256', Buffer.from(header + '.' + payload), publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toMatchObject({ aud: account.token_uri, iss: account.client_email });
    return Response.json({ access_token: 'local-token', expires_in: 3600 });
  }); vi.stubGlobal('fetch', fetch);
  const credentials = createVideoCloudCredentials(JSON.stringify(account));
  expect(await credentials.token()).toBe('local-token'); expect(await credentials.token()).toBe('local-token'); expect(fetch).toHaveBeenCalledTimes(1);
  expect(() => createVideoCloudCredentials(JSON.stringify({ ...account, token_uri: 'https://collector.invalid' }))).toThrow(/service-account/);
  expect(fetch).toHaveBeenCalledTimes(1);
});
