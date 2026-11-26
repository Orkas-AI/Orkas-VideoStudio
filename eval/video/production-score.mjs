import { readFileSync, statSync, realpathSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import {
    alignAudio, audibleSeconds, colourShares, coverage, sourceFootage, toneIntervals, unchangedAudio, visualTimeline,
} from './evidence.mjs';
import { decodePcm } from './media.mjs';
import { narrationEvidence, verifiedNarration } from './narration.mjs';
import { TUTORIAL_COLORS } from './production-fixtures.mjs';
import { stockRoute } from './fixture-server.mjs';
import { NARRATION_PILOT_HZ } from './voice.mjs';

const seconds = spans => spans.reduce((sum, span) => sum + span.end - span.start, 0);
const portrait = video => video.width > 0 && video.height > video.width;
const aspect = (video, ratio) => Math.abs(video.width / video.height - ratio) <= 0.02;
const inRange = (value, min, max) => value >= min && value <= max;

const PROMO_FORMATS = {
    'site-promo': [9 / 16, 10, 22],
    'service-promo': [9 / 16, 20, 42],
    'booking-promo': [9 / 16, 14, 28],
    'ledger-promo': [16 / 9, 20, 42],
};

async function pictureShare(tools, file, pictures) {
    const colors = Object.fromEntries(Object.entries(pictures).flatMap(([key, bands]) =>
        bands.map((color, index) => [key + index, color])));
    const { fps, shares } = await colourShares(tools, file, colors, 4, 34, { darkened: true });
    return Object.fromEntries(Object.keys(pictures).map(key => {
        const times = shares.flatMap((row, index) => row[key + '0'] >= 0.014 && row[key + '1'] >= 0.014 ? [index / fps] : []);
        return [key, { seconds: times.length / fps, first: times[0], last: times.at(-1) }];
    }));
}

export async function scorePodcast(tools, truth, versions, check) {
    const byVideo = new Map(versions.map(version => [
        join(version.production, version.videoId || basename(version.file).replace(/-v\d+-[\da-f]{8}\.mp4$/i, '')),
        version,
    ]));
    const clips = [...byVideo.values()];
    check('three-clips', clips.length === 3, clips.length);
    const results = [];
    for (const clip of clips) {
        const alignment = await alignAudio(tools, clip.file, truth.file);
        const coverageByLine = new Map(truth.lines.map(line => [line.id, coverage(alignment, line)]));
        const stories = truth.stories.filter(story => story.lines.some(id => coverageByLine.get(id) > 0.2));
        const story = stories.length === 1 && stories[0].payoff ? stories[0] : null;
        const complete = [...coverageByLine.values()].every(share => share <= 0.2 || share >= 0.9);
        results.push({
            version: clip.id, story: story?.id, vertical: portrait(clip.probe), wholeLines: complete,
            question: !!story && (!story.question || coverageByLine.get(story.question) >= 0.9),
            payoff: !!story && coverageByLine.get(story.payoff) >= 0.9,
            lines: truth.lines.filter(line => coverageByLine.get(line.id) > 0.2)
                .map(line => ({ text: line.text, coverage: coverageByLine.get(line.id) })),
        });
    }
    check('distinct-complete-stories', results.length === 3 && results.every(result =>
        result.story && result.vertical && result.wholeLines && result.question && result.payoff)
        && new Set(results.map(result => result.story)).size === 3, results);
}

async function scoreRecap(tools, truth, last, narration, check) {
    check('vertical', portrait(last.probe));
    check('about-thirty-seconds', inRange(last.probe.duration, 20, 45), last.probe.duration);
    const footage = await sourceFootage(tools, last.file, truth.episodes.map(episode => ({ file: episode.file, fps: truth.fps })),
        value => ({ source: value >= 2048 ? 1 : 0, frame: value % 2048 }));
    const offending = footage.runs.flatMap(run => truth.episodes[run.source].segments
        .filter(segment => segment.kind !== 'scene' && Math.min(run.outEnd + run.offset, segment.end - 0.12)
            > Math.max(run.outStart + run.offset, segment.start + 0.12)).map(segment => segment.kind));
    check('skips-cards-recaps-and-previews', footage.readable >= 10 && !offending.length, { readableFrames: footage.readable, offending });
    const narrationSpans = toneIntervals(await decodePcm(tools, last.file, 32000), NARRATION_PILOT_HZ);
    const heard = truth.episodes.flatMap((episode, source) => episode.lines.filter(line => line.segment === 'scene')
        .map(line => ({ ...line, source, heard: 0, overlap: 0 })));
    for (const run of footage.runs) {
        for (const [index, audible] of run.audible.entries()) {
            if (!audible) continue;
            const time = run.outStart + index * 0.1 + 0.05;
            const at = time + run.offset;
            const line = heard.find(line => line.source === run.source && line.start <= at && at < line.end);
            if (!line) continue;
            line.heard += 0.1;
            if (narrationSpans.some(span => span.start <= time && time < span.end)) line.overlap += 0.1;
        }
    }
    check('keeps-dialogue-clear-of-narration', footage.readable >= 10 && heard.some(line =>
        line.heard >= (line.end - line.start) * 0.8 && line.overlap < 0.2) && heard.every(line => line.overlap <= 0.5),
    heard.filter(line => line.heard > 0).map(({ text, heard, overlap }) => ({ text, heard, overlap })));
    check('names-from-subtitles', narration.length > 0 && !narration.some(line => truth.misheard.some(name => line.includes(name))), narration);
}

function timelineWords(version) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(version.videoId ?? '')) return '';
    const directory = join(version.production, 'videos', version.videoId);
    return ['manifest.json', 'index.html'].map(name => {
        try {
            const output = join(directory, name);
            if (!realpathSync(output).startsWith(version.production + sep) || statSync(output).size > 1024 * 1024) return '';
            const text = readFileSync(output, 'utf8');
            if (name.endsWith('.html')) return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]*>/g, ' ');
            const { scenes = [], metadata = {} } = JSON.parse(text);
            return JSON.stringify({ scenes, metadata });
        } catch { return ''; }
    }).join('\n');
}

const scriptWords = (text, lang) => text.toLocaleLowerCase(lang).normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hasCommand = (stages, match) => stages.some(stage => stage.events?.some(event => event.type === 'item.completed'
    && event.item?.type === 'command_execution' && event.item.exit_code === 0 && match(event.item.command ?? '', event.item.aggregated_output ?? '')));

export async function scoreProduction(tools, truth, stages, requests, options) {
    const { entry, serviceRequests = [] } = options;
    const checks = [];
    const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) });
    const versions = stages.flatMap(stage => stage.versions ?? []);
    const last = versions.at(-1);
    const first = versions[0];
    const { mode } = entry;
    const noPaidRequests = () => {
        const attempts = serviceRequests.filter(item => item.method === 'POST' && item.route === '/contents/generations/tasks');
        check('no-paid-provider-attempts', attempts.length === 0, attempts.length);
    };
    const authorizedFallback = () => {
        check('waits-for-fallback-authorization', stages[1]?.step.after === 'no-delivery' && !stages[0]?.versions.length);
    };
    check('delivered', last);
    if (entry.service === 'budget') {
        noPaidRequests();
        authorizedFallback();
    }
    if (mode === 'late-attachments') {
        const firstStage = stages[0];
        check('waits-for-actual-footage', stages[1]?.step.attachments === 'later'
            && !firstStage?.versions.length && firstStage?.prematureMedia === false);
    }
    if (mode === 'long-form') {
        check('sample-before-approval', first && inRange(first.probe.duration, 1, 75) && stages[0]?.versions.length === 1,
            first?.probe.duration);
        check('full-after-approval', last && stages[1]?.step.after === 'sample' && stages[1].versions.includes(last)
            && inRange(last.probe.duration, 120, 300), last?.probe.duration);
    }
    if (!last) return checks;
    const { file, probe } = last;
    if (truth.kind === 'podcast') {
        await scorePodcast(tools, truth, versions, check);
        return checks;
    }

    const spoken = requests.length ? await narrationEvidence(tools, file, last, requests) : null;
    const narration = verifiedNarration(spoken);
    const requireNarration = minimum => check('verified-narration', spoken?.verified === true && narration.length > 0
        && spoken.pilotSeconds >= minimum, spoken);
    const hasBed = async (minimum, supplied = truth.music) => {
        const alignment = await alignAudio(tools, file, supplied);
        const played = seconds(alignment.segments.map(segment => ({ start: segment.outStart, end: segment.outEnd })));
        check('uses-supplied-music', played >= minimum, played);
    };
    if (truth.kind === 'reference') {
        const referenceName = basename(truth.reference.file);
        const inspected = hasCommand(stages, (command, output) => command.includes(referenceName) && command.includes('edit extract-frame')
            && /"output"\s*:\s*"[^"]+\.png"/.test(output));
        check('inspects-reference', inspected, referenceName);
        const scan = last.visual ?? await visualTimeline(tools, file);
        check('no-black-gaps', scan.black.length === 0, scan.black);
        const remake = truth.scenario === 'remake';
        check('reference-duration', remake
            ? inRange(probe.duration, truth.reference.duration * 0.75, truth.reference.duration * 1.25)
            : Math.abs(probe.duration - 24) <= 0.5, probe.duration);
        if (remake) check('vertical', aspect(probe, 9 / 16));
        const audio = await audibleSeconds(tools, file);
        check('silent-request', audio.audible <= 0.1, audio.audible);
    } else if (truth.kind === 'recap') {
        requireNarration(3);
        await scoreRecap(tools, truth, last, narration, check);
    } else if (truth.kind === 'ad') {
        check('vertical', portrait(probe));
        if (mode === 'price-revision') {
            const fetchedPage = serviceRequests.some(item => item.method === 'GET' && item.route === '/product' && item.status === 200);
            const fetchedProduct = serviceRequests.some(item => item.method === 'GET' && item.route === '/front.png' && item.status === 200);
            check('uses-product-page', fetchedPage && fetchedProduct);
            check('initial-ad-length', inRange(first.probe.duration, 14, 32), first.probe.duration);
            check('separate-price-revision', stages[1]?.versions.includes(last) && first.production === last.production
                && first.videoId === last.videoId && first.sha256 !== last.sha256 && Math.abs(first.probe.duration - probe.duration) <= 0.3);
            await hasBed(4);
            const price = value => /[¥￥]\s*\d+|\d+\s*元/.test(value);
            // Timeline text is supporting evidence. The final price is also reviewed on shipped frames.
            const words = timelineWords(last);
            const prices = [...words.matchAll(/[¥￥]\s*(\d+)|(\d+)\s*元/g)].map(match => Number(match[1] ?? match[2]));
            if (price(words)) check('revised-written-price', prices.includes(truth.revisedPrice)
                && prices.every(value => value === truth.revisedPrice), prices);
            const priceSpeech = narration.filter(line => line.includes(truth.spokenPrice) || line.includes(truth.spokenRevisedPrice) || price(line));
            if (priceSpeech.length) check('revised-spoken-price', !priceSpeech.some(line => line.includes(truth.spokenPrice) || line.includes(String(truth.price))), priceSpeech);
            if (first.file !== file && !requests.length) check('unchanged-audio', await unchangedAudio(tools, first.file, file, 0, Math.min(first.probe.duration, probe.duration)));
        } else {
            check('about-fifteen-seconds', inRange(probe.duration, 10, 25), probe.duration);
            check('no-paid-voice', requests.length === 0);
        }
    } else if (truth.kind === 'explainer') {
        if (mode === 'long-form') check('landscape', aspect(probe, 16 / 9));
        else {
            check('vertical', portrait(probe));
            check('about-forty-five-seconds', inRange(probe.duration, 35, 60), probe.duration);
        }
        requireNarration(probe.duration * 0.5);
    } else if (truth.kind === 'tutorial') {
        check('about-thirty-seconds', inRange(probe.duration, 18, 45), probe.duration);
        requireNarration(probe.duration * 0.35);
        const { fps, shares } = await colourShares(tools, file, TUTORIAL_COLORS);
        const wait = shares.filter(row => row.wait >= 0.08).length / fps;
        const done = shares.filter(row => row.done >= 0.02).length / fps;
        check('skips-the-wait', wait <= 2, wait);
        check('shows-the-result', done >= 1, done);
    } else if (truth.kind === 'promo' || truth.kind === 'brand') {
        const [ratio, min, max] = PROMO_FORMATS[entry.id] ?? [9 / 16, 14, 30];
        check('requested-aspect', aspect(probe, ratio), [probe.width, probe.height]);
        check('requested-length', inRange(probe.duration, min, max), probe.duration);
        const audio = await audibleSeconds(tools, file);
        check('audible', audio.audible >= probe.duration * 0.5, audio);
        if (spoken) check('narrated-text-matches-audio', spoken.verified === true, spoken);
        if (truth.kind === 'brand') await hasBed(4);
        else {
            const scan = last.visual ?? await visualTimeline(tools, file);
            check('avoids-slideshow', seconds(scan.frozen) <= scan.duration * 0.5, scan.frozen);
        }
    } else if (truth.kind === 'lecture') {
        check('landscape', aspect(probe, 16 / 9));
        const kept = seconds(toneIntervals(await decodePcm(tools, file, 32000), truth.pilotHz));
        const source = seconds(truth.lines);
        check('keeps-the-talk', kept >= source * 0.9, { kept, source });
        await hasBed(Math.min(probe.duration * 0.15, 4));
    } else if (truth.kind === 'footage') {
        check('vertical', aspect(probe, 9 / 16));
        check('about-fifteen-seconds', inRange(probe.duration, 10, 20), probe.duration);
        const spread = await colourShares(tools, file, { tap: truth.tapColour }, 4, 45);
        const tap = Math.max(0, ...spread.shares.map(share => share.tap));
        check('shows-the-tap', tap >= 0.005, tap);
        check('original-sound-removed', seconds(toneIntervals(await decodePcm(tools, file, 32000), truth.ambientHz)) <= 1);
        requireNarration(probe.duration * 0.4);
        check('english-narration', narration.length > 0 && narration.every(line => !/[㐀-鿿]/u.test(line) && /[a-z]/i.test(line)));
    } else if (truth.kind === 'script') {
        check('vertical', aspect(probe, 9 / 16));
        check('requested-length', truth.seconds ? inRange(probe.duration, truth.seconds[0] - 1, truth.seconds[1] + 1)
            : inRange(probe.duration, 5, truth.maxSeconds + 1), probe.duration);
        const read = scriptWords(narration.join(' '), truth.language);
        const displayed = truth.voiceOver ? '' : scriptWords(timelineWords(last), truth.language);
        const missing = truth.lines.filter(line => !read.includes(scriptWords(line, truth.language))
            && !displayed.includes(scriptWords(line, truth.language)));
        check('keeps-script-words', missing.length === 0, missing);
        if (truth.voiceOver) requireNarration(3);
    } else if (truth.kind === 'portrait-fallback') {
        check('vertical', aspect(probe, 9 / 16));
        check('about-twenty-seconds', inRange(probe.duration, 14, 30), probe.duration);
        requireNarration(4);
        const visible = await pictureShare(tools, file, truth.pictures);
        check('uses-the-supplied-portrait-and-bread', visible.portrait.seconds >= 1 && visible.bread.seconds >= 1, visible);
    } else if (truth.kind === 'stock') {
        check('vertical', aspect(probe, 9 / 16));
        check('about-fifteen-seconds', inRange(probe.duration, 10, 22), probe.duration);
        const library = truth.library.filter(item => item.kind === 'video');
        const pictures = Object.fromEntries([
            ...library.map((item, index) => ['stock' + index, item.colours]),
            ...truth.photos.map((item, index) => ['shop' + index, item.colours]),
        ]);
        const visible = await pictureShare(tools, file, pictures);
        const good = library.slice(0, 3);
        const downloads = serviceRequests.filter(item => item.method === 'GET' && item.route.startsWith('/stock/') && item.status === 200);
        const lastShop = Math.max(...truth.photos.map((_, index) => visible['shop' + index].last ?? 0));
        check('uses-the-free-catalog-scenes', good.every((item, index) => downloads.some(request => request.route === stockRoute(item))
            && visible['stock' + index].seconds >= 0.5 && visible['stock' + index].last < lastShop), visible);
        const otherShop = library.findIndex(item => item.role === 'other-shop');
        check('closes-on-the-real-shop', lastShop >= probe.duration - 2 && visible['stock' + otherShop].seconds < 0.5, visible);
    } else {
        throw new Error(`No production score for fixture kind ${truth.kind}`);
    }
    return checks;
}
