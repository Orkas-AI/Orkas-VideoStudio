// All companion services listen only on loopback. Paid create attempts are counted and denied.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';

export const stockRoute = entry => '/stock/' + entry.id + (entry.kind === 'video' ? '.mp4' : '.jpg');

export async function startFixtureServer(seeded, service) {
    const requests = [];
    const resources = new Map();
    const track = (url, value) => resources.set(url, value);
    if (service === 'page') {
        track('/product', { type: 'text/html; charset=utf-8', bytes: seeded.page.html });
        for (const [filename, bytes] of Object.entries(seeded.page.assets)) {
            track('/' + filename, { type: 'image/png', bytes });
        }
        track('/music.wav', { type: 'audio/wav', file: seeded.truth.music });
    }
    if (service === 'stock') {
        for (const entry of seeded.truth.library) {
            track(stockRoute(entry), { type: entry.kind === 'video' ? 'video/mp4' : 'image/jpeg', file: entry.file });
        }
        const catalog = seeded.truth.library.map(({ id, label, tags, kind, author, duration }) => ({
            id, label, tags, kind, author, duration,
            url: stockRoute({ id, kind }), attribution: author + ' / Synthetic evaluation library (CC0)',
        }));
        track('/catalog.json', { type: 'application/json', bytes: JSON.stringify(catalog) });
    }
    const server = createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        const route = url.pathname;
        const admitted = request.method === 'GET' || request.method === 'HEAD';
        const resource = admitted && resources.get(route);
        const create = request.method === 'POST' && route === '/contents/generations/tasks';
        if (requests.length >= 200) {
            response.writeHead(429).end();
            return;
        }
        const status = resource ? 200 : create ? 402 : 404;
        requests.push({ method: request.method, route, status });
        response.writeHead(status, { 'Content-Type': resource?.type ?? 'application/json' });
        if (request.method === 'HEAD') response.end();
        else if (resource?.file) {
            const stream = createReadStream(resource.file);
            stream.on('error', () => response.destroy());
            response.on('close', () => stream.destroy());
            stream.pipe(response);
        } else response.end(resource?.bytes ?? JSON.stringify({ error: create ? 'No payment authorized for this case' : 'Fixture route not found' }));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    return {
        requests,
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }),
    };
}
