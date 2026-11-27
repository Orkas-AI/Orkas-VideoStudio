/** Bind managed speech text to the actual delivered mix, never to a synthesis attempt. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { alignPcm, coverage, toneIntervals } from './evidence.mjs';
import { decodePcm } from './media.mjs';
import { NARRATION_PILOT_HZ } from './voice.mjs';
/** Missing or partial references are unknown, never proof that the full request was heard.
 * Silence trimming is allowed. A missing voiced stretch of 150 ms cannot certify the words.
 * Work is bounded by the lane's 300 s delivery limit, 120 requests and 600 s of references. */
export async function narrationEvidence(tools, file, version, requests) {
    const evidence = { version: version.id, sha256: version.sha256,
        verified: null, pilotSeconds: 0, accountedShare: 0, lines: [], unavailable: 0 };
    if (requests.length > 120 || requests.some(r => !Number.isFinite(r.seconds) || r.seconds <= 0)
        || requests.reduce((sum, r) => sum + r.seconds, 0) > 600)
        return evidence;
    const output = await decodePcm(tools, file, 32000);
    if (output.samples.length / output.rate > 301)
        return evidence;
    const pilot = toneIntervals(output, NARRATION_PILOT_HZ);
    evidence.pilotSeconds = pilot.reduce((sum, span) => sum + span.end - span.start, 0);
    if (!requests.length) {
        // Music can have energy in this band too. Without managed requests it cannot
        // establish narration; cases that require a voice check verified words below.
        evidence.accountedShare = 1;
        evidence.verified = true;
        return evidence;
    }
    const mixed = await decodePcm(tools, file, 8000);
    const matched = new Uint8Array(Math.ceil(mixed.samples.length / 80));
    const completeAudio = new Uint8Array(matched.length);
    const candidates = [];
    const seen = new Set();
    for (const request of requests) {
        const audio = request.audio;
        if (!audio) {
            evidence.unavailable += 1;
            continue;
        }
        if (seen.has(audio.sha256))
            continue;
        seen.add(audio.sha256);
        let valid = false;
        try {
            valid = /^[a-f0-9]{64}$/.test(audio.sha256) && fs.statSync(audio.path).isFile() && fs.statSync(audio.path).size <= 32 * 1024 * 1024
                && crypto.createHash('sha256').update(fs.readFileSync(audio.path)).digest('hex') === audio.sha256;
        }
        catch { /* Missing references leave this delivery unverified. */ }
        if (!valid) {
            evidence.unavailable += 1;
            continue;
        }
        const source = await decodePcm(tools, audio.path, 8000);
        if (source.samples.length / source.rate > 301) {
            evidence.unavailable += 1;
            continue;
        }
        const alignment = alignPcm(mixed, source);
        const share = coverage(alignment, { start: 0, end: source.samples.length / source.rate });
        if (share <= 0.02 || !alignment.segments.length)
            continue; // Discarded draft.
        // One constant offset is one playback. Union coverage would falsely certify
        // reordered words, and would hide a request played twice from the judge.
        const groups = [];
        for (const segment of alignment.segments) {
            const group = groups.find(g => Math.abs(g[0].offset - segment.offset) < 0.03);
            if (group)
                group.push(segment);
            else
                groups.push([segment]);
        }
        for (const group of groups) {
            const heard = new Uint8Array(alignment.heard.length);
            for (const s of group) {
                const start = Math.max(0, Math.floor((s.outStart + s.offset) * 100));
                const end = Math.min(heard.length, Math.ceil((s.outEnd + s.offset) * 100));
                for (let i = start; i < end; i += 1)
                    heard[i] = alignment.heard[i];
            }
            const value = coverage({ ...alignment, heard }, { start: 0, end: source.samples.length / source.rate });
            let gap = 0;
            let longestGap = 0;
            for (let i = 0; i < heard.length; i += 1) {
                gap = alignment.sourceSpeech[i] && !heard[i] ? gap + 0.01 : 0;
                longestGap = Math.max(longestGap, gap);
            }
            const line = { text: request.text, coverage: value, complete: value >= 0.9 && longestGap < 0.15,
                firstAt: Math.min(...group.map(s => s.outStart)) };
            const windows = new Uint8Array(matched.length);
            for (const segment of group) {
                // Correlation omits quiet consonants/edges, while the pilot includes them.
                const start = Math.max(0, Math.floor((segment.outStart - 0.12) * 100));
                const end = Math.min(matched.length, Math.ceil((segment.outEnd + 0.12) * 100));
                matched.fill(1, start, end);
                windows.fill(1, start, end);
                if (line.complete)
                    completeAudio.fill(1, start, end);
            }
            candidates.push({ line, windows });
        }
    }
    // Revised drafts often share an identical opening. That opening is not evidence
    // that the discarded draft's different ending plays alongside the complete take.
    evidence.lines = candidates.filter(({ line, windows }) => line.complete
        || windows.reduce((sum, value, i) => sum + (value && !completeAudio[i] ? 1 : 0), 0) >= 15).map(c => c.line);
    let heard = 0;
    let total = 0;
    for (const span of pilot)
        for (let t = span.start; t < span.end; t += 0.01) {
            total += 1;
            if (matched[Math.floor(t * 100)])
                heard += 1;
        }
    evidence.accountedShare = total ? heard / total : 1;
    evidence.lines.sort((a, b) => a.firstAt - b.firstAt);
    evidence.verified = evidence.unavailable || evidence.lines.some(line => !line.complete) || evidence.accountedShare < 0.9 ? null : true;
    return evidence;
}
export function verifiedNarration(evidence) {
    return evidence?.lines.filter(line => line.complete).map(line => line.text) ?? [];
}
