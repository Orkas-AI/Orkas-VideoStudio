import { realpathSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { digest } from './delivery.mjs';

const literal = token => {
    if (token?.startsWith("'")) return token.slice(1, -1);
    const value = token?.startsWith('"') ? token.slice(1, -1).replace(/\\(["\\])/g, '$1') : token;
    return value && !/[$`\\<>*?\[\]{}~]/.test(value) ? value : undefined;
};

function frameCommands(command) {
    if (command.length > 65536 || !command.includes('extract-frame')) return [];
    const wrapped = command.match(/^\S*\/(?:zsh|bash|sh) -lc (['"])([\s\S]*)\1$/);
    if (wrapped) command = wrapped[1] === '"' ? wrapped[2].replace(/\\(["\\])/g, '$1') : wrapped[2];
    const segments = [[]];
    for (const [token] of command.matchAll(/"(?:\\.|[^"\\])*"|'[^']*'|&&|\|\||[;|&\r\n]|[^\s"';&|<>]+|[^\s]/g)) {
        if ([';', '&&', '\n', '\r'].includes(token)) segments.push([]);
        else if (['|', '||', '&'].includes(token)) return [];
        else segments.at(-1).push(token);
    }
    if (segments.some(([word]) => ['cd', 'pushd', 'popd'].includes(literal(word)))) return [];
    return segments.flatMap(words => {
        const [program, group, op, input, first, a, second, b] = words.map(literal);
        if (words.length !== 8 || basename(program ?? '') !== 'ovs' || group !== 'edit' || op !== 'extract-frame' || !input) return [];
        const flags = new Map([[first, a], [second, b]]);
        const output = flags.get('--out'), at = flags.get('--at');
        return output && /\.png$/i.test(output) && at && Number.isFinite(Number(at)) && Number(at) >= 0
            ? [{ input, output, at: Number(at) }] : [];
    });
}

export function verifiedReferenceRead(workspace, reference, stages) {
    if (!workspace) return false;
    const root = realpathSync(workspace);
    const expected = digest(reference.file);
    if (!expected) return false;
    const hashes = new Map();
    for (const { events = [] } of stages) {
        for (const { type, item } of events) {
            if (type !== 'item.completed' || item?.type !== 'command_execution' || item.exit_code !== 0) continue;
            const frames = frameCommands(item.command ?? '');
            if (!frames.length) continue;
            const receipts = new Set();
            for (const [body] of (item.aggregated_output ?? '').matchAll(/^\{\s*"output"\s*:\s*"(?:\\.|[^"\\])*"\s*\}/gm)) {
                try { receipts.add(resolve(root, JSON.parse(body).output)); } catch { /* Fragments are not receipts. */ }
            }
            for (const frame of frames) {
                const output = resolve(root, frame.output);
                if (frame.at >= reference.duration || !receipts.has(output)
                    || frames.filter(candidate => resolve(root, candidate.output) === output).length !== 1) continue;
                try {
                    const input = realpathSync(resolve(root, frame.input));
                    const local = relative(root, input);
                    if (isAbsolute(local) || local === '..' || local.startsWith('..' + sep)) continue;
                    if (!hashes.has(input)) hashes.set(input, digest(input));
                    if (hashes.get(input) === expected) return true;
                } catch { /* Missing sources cannot prove frame inspection. */ }
            }
        }
    }
    return false;
}
