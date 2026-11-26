// Synthetic story scripts adapted from the Orkas production catalog.
export const STORY_SCRIPT = {
    title: 'THE LIGHTHOUSE KEY',
    seconds: [38, 40],
    scenes: [
        { picture: 'A storm over a small harbour at night. Waves break against the pier.',
            line: 'Every night for forty years, the lighthouse on Gull Point came on at nine.' },
        { picture: 'The lighthouse stands dark. A girl in a yellow raincoat runs along the pier toward it.',
            line: 'Tonight, at nine, it stayed dark.' },
        { picture: 'Inside the keeper\'s cottage: an empty chair, a mug still steaming, a brass key on the table.',
            line: 'The keeper was gone. Only his key was left behind.' },
        { picture: 'The girl climbs the spiral stairs and turns the key. The great lamp blazes over the sea, and a fishing boat turns toward the light.',
            line: 'She had never climbed the stairs alone. But someone had to keep the light.' },
    ],
    endCard: 'THE LIGHTHOUSE KEY — Episode 1',
};
export function storyScriptPrompt() {
    const { title, seconds, scenes, endCard } = STORY_SCRIPT;
    return [
        `TITLE: ${title}`,
        `DURATION: ${seconds[0]}–${seconds[1]} SECONDS, vertical 9:16 for TikTok and YouTube Shorts`,
        '',
        ...scenes.flatMap((scene, index) => [
            `[SCENE ${index + 1}] ${scene.picture}`,
            `NARRATOR (V.O.): "${scene.line}"`,
            '',
        ]),
        `END CARD: "${endCard}"`,
        '',
        'Make this video. Keep the narration word for word, and keep it within the duration.',
    ].join('\n');
}
export const EPISODE_SCRIPT = {
    series: 'Komşular',
    maxSeconds: 60,
    scenes: [
        { picture: 'Apartman merdiveni, sabah. Ayşe (60\'lı yaşlarda) elinde bir tencereyle yeni komşunun kapısını çalar.',
            speaker: 'AYŞE', line: 'Yeni komşumuz sen misin? Hoş geldin, sıcak çorba getirdim.' },
        { picture: 'Kapı açılır. Genç bir adam, Emre, şaşkın bir şekilde bakar.',
            speaker: 'EMRE', line: 'Çok teşekkür ederim, burada kimseyi tanımıyorum.' },
        { picture: 'Küçük bir mutfak. İkisi masada karşılıklı çorba içer.',
            speaker: 'AYŞE', line: 'Artık tanıyorsun. Bir şeye ihtiyacın olursa kapım hep açık.' },
        { picture: 'Akşam. Emre, Ayşe\'nin kapısının önüne bir kutu tatlı bırakır ve gülümser.',
            speaker: 'YAZI', line: 'Komşuluk bir tencere çorbayla başlar.' },
    ],
};
export function episodeScriptPrompt() {
    const { series, maxSeconds, scenes } = EPISODE_SCRIPT;
    return [
        `“${series}” adlı kısa dizimin 1. bölümü için 9:16 dikey, Türkçe, en fazla ${maxSeconds} saniyelik bir video yap. Gerçekçi karakterler istiyorum. Diyalogları aynen koru, değiştirme ya da ekleme yapma.`,
        '',
        ...scenes.map((scene, index) => `Sahne ${index + 1} — ${scene.picture} ${scene.speaker}: "${scene.line}"`),
    ].join('\n');
}
