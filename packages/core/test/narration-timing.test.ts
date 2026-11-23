import { describe, expect, it } from 'vitest';
import { estimateNarrationDuration, narrationPaceNote, storyboardTiming } from '../src/narration/index.js';

describe('read-only storyboard timing', () => {
  it('keeps exact text identities and reports crowded shots as advisory findings', () => {
    const result = storyboardTiming({ duration_sec: 10, segments: [
      { id: 'opening', text: 'Hello world', start_sec: 0, target_sec: 0.5 },
      { id: 'silent', text: '', start_sec: 1, target_sec: 2 },
    ] });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.kind).toBe('estimate');
    expect(result.timing_review).toMatchObject({ advisory: true, status: 'has_findings', crowded_segments: [{ id: 'opening', over_by_sec: 0.3 }] });
    expect(result.segments[0].text_sha256).toBe('64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c');
    expect(result.segments[1].estimated_sec).toBe(0);
    expect(result.planned_end_sec).toBe(3);
  });
  it('rejects overlapping, ambiguous, unbounded and duplicate segment inputs', () => {
    const shot = { id: 'a', text: 'A', start_sec: 0, target_sec: 2 };
    for (const input of [
      { duration_sec: 3, segments: [shot, { ...shot, id: 'b', start_sec: 1 }] },
      { duration_sec: 3, segments: [shot, { ...shot, start_sec: 2 }] },
      { duration_sec: 3, segments: [{ ...shot, end_sec: 2 }] },
      { duration_sec: Infinity, segments: [shot] },
      { duration_sec: 3, speed: 3, segments: [shot] },
    ]) expect(storyboardTiming(input).ok).toBe(false);
  });
  it('counts Thai and other alphabets and normalizes composed Latin text', () => {
    expect(estimateNarrationDuration('สวัสดี').breakdown.thaiCharacters).toBe(6);
    expect(estimateNarrationDuration('Привет мир').breakdown.otherWords).toBe(2);
    expect(estimateNarrationDuration('Tiếng Việt rất đẹp').unitsPerSec).toBe(4.9);
    expect(estimateNarrationDuration('café')).toEqual(estimateNarrationDuration('cafe\u0301'));
    expect(estimateNarrationDuration('你好，GPT 3.5!').breakdown).toMatchObject({ cjkCharacters: 2, numericDigits: 2, numericSeparators: 1, minorPauses: 1, majorPauses: 1 });
  });
  it('detects a crowded four-second line even when total speech fits twenty seconds; revisions change the receipt', () => {
    const input = { duration_sec: 20, segments: [
      { id: 'end', text: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五', start_sec: 16, target_sec: 4 },
    ] };
    const result = storyboardTiming(input);
    if (!result.ok) throw new Error(result.message);
    expect(result).toMatchObject({ kind: 'estimate', planned_end_sec: 20, remaining_timeline_sec: 0 });
    expect(result.sum_estimated_speech_sec).toBeLessThan(20);
    expect(result.segments[0]).toMatchObject({ estimated_sec: 7.78, remaining_sec: -3.78 });
    expect(result.timing_review).toEqual({ advisory: true, status: 'has_findings',
      crowded_segments: [{ id: 'end', over_by_sec: 3.78 }], timeline_over_by_sec: 0 });
    const revised = storyboardTiming({ ...input, segments: [{ ...input.segments[0]!, text: '提起倒掉，冲洗收好。' }] });
    if (!revised.ok) throw new Error(revised.message);
    expect(revised.segments[0]!.remaining_sec).toBeGreaterThan(0);
    expect(revised.segments[0]!.text_sha256).not.toBe(result.segments[0]!.text_sha256);
    expect(revised.timing_review).toEqual({ advisory: true, status: 'no_findings', crowded_segments: [], timeline_over_by_sec: 0 });
  });
  it('keeps exact, shorter and longer estimates advisory', () => {
    // Nine Han characters without pauses estimate two seconds at natural speed.
    for (const [duration, remainder, status] of [[2.01, 0.01, 'no_findings'], [2, 0, 'no_findings'], [1.99, -0.01, 'has_findings']] as const) {
      const result = storyboardTiming({ duration_sec: 20, segments: [{ id: 'line', text: '一二三四五六七八九', start_sec: 4, target_sec: duration }] });
      if (!result.ok) throw new Error(result.message);
      expect(result).toMatchObject({ kind: 'estimate', speed: 1 });
      expect(result.segments[0]).toMatchObject({ estimated_sec: 2, remaining_sec: remainder });
      expect(result.timing_review).toEqual({ advisory: true, status,
        crowded_segments: remainder < 0 ? [{ id: 'line', over_by_sec: 0.01 }] : [], timeline_over_by_sec: 0 });
    }
  });
});

describe('Chinese natural pace', () => {
  // Chinese narration measured on ten voices on 2026-11-15: script, seconds; the first three share the default voice.
  const chinese: Array<[string, number, boolean]> = [
    ['调料瓶总是挤成一堆？试试这款旋转调料盒，轻轻一转，常用的那瓶就到手边，做饭再也不用翻来翻去。', 9.07, true],
    ['打开设置页面，先点右上角的头像，再选择账号与安全，就能看到修改密码的入口，按提示操作就行。', 9.22, true],
    ['那天晚上下着大雨，他一个人站在车站门口，手里攥着那张旧车票，犹豫了很久，始终没有走进去。', 8.66, true],
    ['很多人以为跑步伤膝盖，其实只要控制好步频和落地方式，适量跑步反而能让关节变得更加灵活。', 8.45, false],
    ['这座大桥全长三十多公里，从开工到通车整整用了九年，它让两座城市之间的车程缩短到半小时。', 11.86, false],
    ['三年后两人在医院重逢，她早已认不出他，而他只是笑了笑，把那封信悄悄放回了外套的口袋里。', 9.05, false],
    ['分格设计容量大，酱油、醋、盐和胡椒都能各归其位，台面一下子清爽了不少，承重也足够稳当。', 8.83, false],
    ['现在下单只要39.9元，还送两个备用调料瓶，库存不多了，喜欢的朋友赶紧点击下方的链接下单吧。', 8.04, false],
    ['今天带大家看看这家开了二十年的老面馆，汤底每天凌晨四点开始熬，一碗面只要十五块钱就能吃饱。', 7.63, false],
    ['周末我们来到海边的小镇，街上到处是卖海鲜的小摊，随便找一家坐下来，就能吃到当天的渔获。', 8.45, false],
  ];

  it('stays within 10% of measured Chinese voices, and closer for the default voice', () => {
    const ratios = chinese.map(([script, seconds]) => estimateNarrationDuration(script).estimatedSec / seconds).sort((a, b) => a - b);
    const median = (ratios[4]! + ratios[5]!) / 2;
    expect(median).toBeGreaterThan(0.9);
    expect(median).toBeLessThan(1.1);
    for (const [script, seconds] of chinese.filter(([, , defaultVoice]) => defaultVoice)) {
      const ratio = estimateNarrationDuration(script).estimatedSec / seconds;
      expect(ratio, script).toBeGreaterThan(0.9);
      expect(ratio, script).toBeLessThan(1.15);
    }
  });

  it('keeps the Chinese and English rates', () => {
    // 18 Han characters at 4.5 per second, one comma (0.12s) and one full stop (0.28s).
    expect(estimateNarrationDuration('这是一条测试旁白，确认时长估算没有变化。')).toMatchObject({
      estimatedSec: 4.4,
      unit: 'characters',
      units: 18,
      unitsPerSec: 4.5,
    });
    expect(estimateNarrationDuration('White ceramic, a blue wave, and room for 350 mL of coffee or tea.')).toMatchObject({
      estimatedSec: 6.26,
      unit: 'words',
      unitsPerSec: 2.5,
    });
  });

  it('keeps a long mixed-language script within 10% of its measured length', () => {
    // A paid synthesis of this script measured 140.9s for a 117s target.
    const text = '2017年，Attention Is All You Need——Transformer 架构诞生，改写 AI 历史。'
      + '自注意力机制让模型同时看见整个序列，成为所有大模型的共同起点。'
      + '2018年，GPT-1 与 BERT 确立预训练范式，BERT 双向理解横扫 11 项基准。'
      + '2019年，GPT-2 用 15 亿参数证明：规模越大，能力越强。'
      + '2020年，GPT-3 的 1750 亿参数带来涌现能力：上下文学习、代码生成。'
      + 'DALL·E、Codex、CLIP——AI 开始看懂图像、写代码、融合多感官。'
      + '2022年，ChatGPT 上线，两月一亿用户，史上最快增长，AI 走入每个人生活。'
      + '2023年，GPT-4 多模态理解，律师考试超 90% 人类，从聊天到理解世界。'
      + 'Llama 2、Mistral 开源崛起，大模型不再是巨头专利。'
      + '2024年，Sora 用文字生成 60 秒视频，模型开始理解物理世界。'
      + 'Gemini 1.5 Pro 突破百万上下文，模型从读完就忘到记住整本书。'
      + 'GPT-4o 原生多模态，o1 推理模型开辟思考时间越长答案越好的新方向。'
      + 'DeepSeek-V2 和 Mixtral 证明 MoE 效率——更少激活参数，更低成本。'
      + '2025年，DeepSeek-R1 开源推理链，o3-mini 证明高密度推理可在小模型实现。'
      + 'AI 从回答问题进化为完成任务——MCP 协议、Computer Use、Agent 自主工作。'
      + 'GPT-5 和 Claude 4 将推理 Scaling 推向新高度，思考过程可见可控。'
      + '2026年，GPT-5.5 和 5.6 Sol 以更少激活参数定义推理密度新标杆。'
      + 'DeepSeek-V4 开源对标顶级闭源，Gemini 3.5 Flash 百万上下文实时速度。'
      + 'Claude Opus 4.8 安全与能力平衡，Grok 4.5 实时社交风格独树一帜。'
      + 'Agent AI 自主编码企业落地。密度法则取代参数竞赛——大模型成为基础设施。';
    const estimate = estimateNarrationDuration(text);
    expect(estimate.breakdown).toMatchObject({ cjkCharacters: 375, latinWords: 55, numericDigits: 73 });
    expect(estimate.estimatedSec).toBeGreaterThan(117 * 1.05);
    expect(estimate.estimatedSec / 140.9).toBeGreaterThan(0.9);
    expect(estimate.estimatedSec / 140.9).toBeLessThan(1.1);
  });
});

describe('narration pace before lines are written', () => {
  it('says how many characters a scene holds in the language asked for, from the rates the estimate uses', () => {
    expect(narrationPaceNote('zh-CN')).toBe('At speed 1, zh-CN narration runs about 4.5 characters a second, plus 0.28 s at each full stop and 0.12 s at each comma, so a 5 s scene holds about 20 characters. Write each line to fit its scene before ovs speak.');
    // The 20 characters it names, with one comma and one full stop, fit 5 s; one more on each side does not.
    expect(estimateNarrationDuration(`${'字'.repeat(10)}，${'字'.repeat(10)}。`).estimatedSec).toBeLessThanOrEqual(5);
    expect(estimateNarrationDuration(`${'字'.repeat(11)}，${'字'.repeat(11)}。`).estimatedSec).toBeGreaterThan(5);
    expect(narrationPaceNote('en-US')).toBe('At speed 1, en-US narration runs about 2.5 words a second, plus 0.28 s at each full stop and 0.12 s at each comma, so a 5 s scene holds about 11 words. Write each line to fit its scene before ovs speak.');
  });

  it('uses each language family\'s rate and names no pace for something that is not a language tag', () => {
    expect(narrationPaceNote('ja-JP')).toContain('about 5.2 characters a second');
    expect(narrationPaceNote('th')).toContain('about 11.4 characters a second');
    expect(narrationPaceNote('vi_VN')).toContain('about 4.9 words a second');
    expect(narrationPaceNote('ru-RU')).toContain('about 2 words a second');
    expect(narrationPaceNote('fr-FR')).toContain('about 2.5 words a second');
    for (const tag of ['', '  ', 'constructor', '中文', '1a']) expect(narrationPaceNote(tag)).toBeNull();
  });
});
