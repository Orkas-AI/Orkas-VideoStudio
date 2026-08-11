import { describe, expect, it } from 'vitest';
import {
  applyQaFindingWaivers,
  designContractIssues,
  designContractReadiness,
  htmlCopySearch,
  qaFindingIsWaivable,
  runSourceAlignmentQa,
  type Issue,
} from '../src/render/composition-qa';

const FULL = {
  aesthetic: {
    subject_world: 'battery lab oscilloscope traces',
    one_job: 'show the charge curve flattening',
    signature_device: 'the trace becomes the progress line',
    aesthetic_risk: 'no product shot until the payoff',
    anti_template_check: 'rejected a centered title card',
  },
  visual_direction: {
    visual_tradition: 'Swiss Pulse precision grid',
    lazy_defaults_rejected: 'rejected neon circles; using instrument traces',
    video_scale: '1920x1080: headline 88-132px, body 44-56px',
    depth_layer_rule: 'BG grid, MG trace, FG metadata ticks',
    motion_verb_rule: 'the trace draws, the value counts up',
    rhythm_pattern: 'hook-build-HOLD-resolve',
  },
  cover: {
    scene_id: 's1',
    headline: 'Charge curve',
    content_signals: ['battery', 'oscilloscope trace'],
    hero_visual: 'battery and trace',
    composition_strategy: 'hero left, result right',
    frame_time_sec: 0,
  },
  layout_boxes: { focal: 'left two thirds' },
  typography_tokens: { title: '96px', body: '44px' },
  color_tokens: { bg: '#081018' },
  motion_budget: 'the trace draws once; everything else holds still',
  scene_variation: 'no two adjacent scenes share a layout grammar',
  scenes: [{ id: 's1', depth_layers: 'BG grid / MG trace / FG ticks', motion_verbs: 'trace draws' }],
};

const codes = (issues: ReturnType<typeof designContractIssues>) => issues.map((i) => i.code);
const errors = (issues: ReturnType<typeof designContractIssues>) => issues.filter((i) => i.severity === 'error');

describe('designContractIssues', () => {
  it('passes a contract that meets its budget', () => {
    expect(designContractIssues(FULL, null)).toEqual([]);
  });

  it('has no opinion when there is no contract', () => {
    expect(designContractIssues(null, null)).toEqual([]);
    expect(designContractIssues(undefined, null)).toEqual([]);
    // A scene map alone must not conjure design findings.
    expect(designContractIssues(null, { scenes: [{ id: 's1' }] })).toEqual([]);
  });

  it('blocks when preview-required budget sections are absent', () => {
    const { aesthetic, visual_direction, motion_budget, scene_variation, ...rest } = FULL;
    const issues = designContractIssues(rest, null);
    expect(codes(issues)).toContain('DESIGN_CONTRACT_BUDGET_INCOMPLETE');
    expect(errors(issues).length).toBeGreaterThan(0);
  });

  it('only warns when the absent sections are not preview-required', () => {
    const { layout_boxes, color_tokens, ...rest } = FULL;
    const issues = designContractIssues(rest, null);
    expect(codes(issues)).toEqual(['DESIGN_CONTRACT_BUDGET_INCOMPLETE']);
    expect(errors(issues)).toEqual([]);
  });

  it('blocks a thesis that is present but hollow', () => {
    const issues = designContractIssues({ ...FULL, aesthetic: { subject_world: 'a lab' } }, null);
    expect(codes(issues)).toContain('AESTHETIC_THESIS_INCOMPLETE');
    expect(errors(issues).length).toBeGreaterThan(0);
  });

  it('blocks generic style language with no signature device', () => {
    const issues = designContractIssues({
      ...FULL,
      aesthetic: { subject_world: 'sleek modern tech', one_job: 'look premium', aesthetic_risk: 'none really', anti_template_check: 'nothing rejected' },
    }, null);
    expect(codes(issues)).toContain('GENERIC_AESTHETIC_THESIS');
  });

  it('accepts the legacy anti_template spelling as the check', () => {
    const { anti_template_check, ...aesthetic } = FULL.aesthetic;
    const issues = designContractIssues({ ...FULL, aesthetic: { ...aesthetic, anti_template: 'rejected a centered title card' } }, null);
    expect(codes(issues)).not.toContain('AESTHETIC_THESIS_INCOMPLETE');
  });

  it('blocks a partially-filled visual direction', () => {
    const issues = designContractIssues({ ...FULL, visual_direction: { visual_tradition: 'Swiss Pulse precision grid' } }, null);
    expect(codes(issues)).toContain('VISUAL_DIRECTION_INCOMPLETE');
  });

  it('does not report placeholder-length values as real decisions', () => {
    const issues = designContractIssues({ ...FULL, motion_budget: 'x' }, null);
    expect(codes(issues)).toContain('DESIGN_CONTRACT_BUDGET_INCOMPLETE');
  });

  it('blocks scenes with no depth layers or motion verbs, naming them', () => {
    const issues = designContractIssues({ ...FULL, scenes: [{ id: 'intro' }, { id: 'outro' }] }, null);
    expect(codes(issues)).toEqual(expect.arrayContaining(['SCENE_DEPTH_LAYERS_MISSING', 'SCENE_MOTION_VERBS_MISSING']));
    expect(JSON.stringify(issues)).toContain('intro');
  });

  it('falls back to the scene map when the contract does not restate scenes', () => {
    const { scenes, ...noScenes } = FULL;
    const issues = designContractIssues(noScenes, { scenes: [{ id: 'from-map' }] });
    expect(codes(issues)).toContain('SCENE_DEPTH_LAYERS_MISSING');
    expect(JSON.stringify(issues)).toContain('from-map');
  });

  it('accepts motion_choreography as the motion-verb decision', () => {
    const issues = designContractIssues({ ...FULL, scenes: [{ id: 's1', depth_layers: 'BG/MG/FG', motion_choreography: 'the trace draws in' }] }, null);
    expect(codes(issues)).not.toContain('SCENE_MOTION_VERBS_MISSING');
  });

  it('requires a frame-zero cover with approved topic signals', () => {
    const incomplete = designContractIssues({ ...FULL, cover: { scene_id: 's1' } }, null);
    expect(codes(incomplete)).toContain('COVER_CONTRACT_INCOMPLETE');

    const wrongTime = designContractIssues({
      ...FULL,
      cover: { ...FULL.cover, frame_time_sec: 1 },
    }, null);
    expect(codes(wrongTime)).toContain('COVER_FRAME_TIME_INVALID');
  });

  it('validates concrete image and video reference contracts', () => {
    const issues = designContractIssues({
      ...FULL,
      references: [{
        id: 'motion',
        media_type: 'video',
        path: 'assets/references/motion.mp4',
        intent: 'reproduce',
        intent_basis: 'user',
        roles: ['motion', 'timing'],
        required: true,
        preserve: ['camera path', 'timing'],
        may_change: ['subject'],
        target_scene_ids: ['s1'],
      }],
      reference_fidelity: {
        mode: 'exact',
        preserve: ['composition', 'timing'],
        may_change: ['subject'],
        layout_anchors: [],
        verification: { minimum_score: 80 },
      },
    }, null);
    expect(codes(issues)).toEqual(expect.arrayContaining([
      'REFERENCE_EXACT_PRESERVE_THIN',
      'REFERENCE_EXACT_SCORE_FLOOR_LOW',
      'REFERENCE_LAYOUT_ANCHORS_REQUIRED',
      'REFERENCE_VIDEO_TEMPORAL_ANCHORS_REQUIRED',
    ]));
  });
});

describe('designContractIssues — severity calibration and accept-by-meaning', () => {
  it('reports generic style language as advisory — authored prose is the user\'s call at the preview', () => {
    const issues = designContractIssues({
      ...FULL,
      aesthetic: { subject_world: 'sleek modern tech', one_job: 'look premium', aesthetic_risk: 'none really', anti_template_check: 'nothing rejected' },
    }, null);
    const generic = issues.find((i) => i.code === 'GENERIC_AESTHETIC_THESIS');
    expect(generic?.severity).toBe('warning');
  });

  it('names each missing section\'s own required fields, not just the section', () => {
    const { aesthetic, visual_direction, ...rest } = FULL;
    const issue = designContractIssues(rest, null).find((i) => i.code === 'DESIGN_CONTRACT_BUDGET_INCOMPLETE');
    expect(issue?.message).toContain('aesthetic{subject_world');
    expect(issue?.message).toContain('visual_direction{visual_tradition');
  });

  it('accepts background/midground/foreground fields — the spelling its own fixHint prescribes', () => {
    const issues = designContractIssues({
      ...FULL,
      scenes: [{ id: 's1', background: 'lab grid', midground: 'the trace', foreground: 'metadata ticks', motion: 'the trace draws in' }],
    }, null);
    expect(codes(issues)).not.toContain('SCENE_DEPTH_LAYERS_MISSING');
    expect(codes(issues)).not.toContain('SCENE_MOTION_VERBS_MISSING');
  });

  it('treats declared-signal count and fidelity-contract completeness as advisory', () => {
    const thin = designContractIssues({ ...FULL, cover: { ...FULL.cover, content_signals: ['battery'] } }, null);
    expect(thin.find((i) => i.code === 'COVER_CONTENT_SIGNALS_THIN')?.severity).toBe('warning');

    const fidelity = designContractIssues({
      ...FULL,
      references: [{
        id: 'style', media_type: 'image', path: 'assets/references/style.png', intent: 'guide',
        roles: ['style'], preserve: ['palette'], may_change: [], target_scene_ids: ['s1'],
      }],
      reference_fidelity: { mode: 'exact', preserve: ['composition', 'timing'], may_change: ['subject'], layout_anchors: [{ id: 'a' }], verification: { minimum_score: 80 } },
    }, null);
    expect(fidelity.find((i) => i.code === 'REFERENCE_EXACT_PRESERVE_THIN')?.severity).toBe('warning');
    expect(fidelity.find((i) => i.code === 'REFERENCE_EXACT_SCORE_FLOOR_LOW')?.severity).toBe('warning');
  });
});

describe('designContractReadiness — the prepare-time hand-off check', () => {
  it('is missing with no contract, incomplete with a thin one, ready with a full one', () => {
    expect(designContractReadiness(null).status).toBe('missing');
    expect(designContractReadiness({}).status).toBe('missing');
    const { aesthetic, ...thin } = FULL;
    expect(designContractReadiness(thin, null).status).toBe('incomplete');
    expect(designContractReadiness(FULL, null).status).toBe('ready');
  });

  it('catches a thin cover CONTRACT at prepare — that gap is fixable before any HTML exists', () => {
    const r = designContractReadiness({ ...FULL, cover: { scene_id: 's1' } }, null);
    expect(r.status).toBe('incomplete');
    expect(r.issues.map((i) => i.code)).toContain('COVER_CONTRACT_INCOMPLETE');
  });
});

describe('htmlCopySearch — copy that survives markup', () => {
  it('finds a CJK line split across per-word reveal elements', () => {
    const contains = htmlCopySearch('<div><span>用</span><span>AI</span> <span>聊过</span><span>很多次</span></div>');
    expect(contains('用AI聊过很多次')).toBe(true);
  });

  it('never claims copy that appears nowhere in the page', () => {
    const contains = htmlCopySearch('<p>team</p><p>work</p>');
    expect(contains('entirely absent line')).toBe(false);
  });

  it('still matches copy carried in attributes and plain text', () => {
    const contains = htmlCopySearch('<img alt="charge curve"/><h1>Hello world</h1>');
    expect(contains('charge curve')).toBe(true);
    expect(contains('hello world')).toBe(true);
  });

  it('does not count copy that only exists in script code', () => {
    const contains = htmlCopySearch('<script>const t = "ghost copy";</script><h1>real</h1>');
    expect(contains('ghost copy')).toBe(false);
  });
});

describe('runSourceAlignmentQa — legacy shotlist activation', () => {
  const load = (value: unknown): { path: string; exists: boolean; value: unknown } =>
    ({ path: 'shotlist.json', exists: true, value });
  const sceneMap = { path: 'composition-manifest.json', exists: true, value: { scenes: [{ id: 's1', start: 0, duration: 5, source_shots: [] }] } };

  it('does not wake the retired layer for a {scenes:[...]} file parked under the name', async () => {
    const r = await runSourceAlignmentQa(sceneMap, load({ scenes: [{ id: 'x' }] }));
    expect(r).toMatchObject({ ok: true, skipped: true, reason: 'no_legacy_shotlist' });
  });

  it('still activates for a real legacy shotlist shape', async () => {
    const r = await runSourceAlignmentQa(sceneMap, load({ shots: [{ id: 'shot-1' }] }));
    expect(r.skipped).toBeFalsy();
  });
});

describe('QA waivers — the user may skip a look they accept, never the evidence', () => {
  it('refuses evidence-integrity and parse-failure codes', () => {
    expect(qaFindingIsWaivable('COVER_HEADLINE_NOT_VISIBLE')).toBe(true);
    expect(qaFindingIsWaivable('VIDEO_SAMPLE_FRAMES_MISSING')).toBe(false);
    expect(qaFindingIsWaivable('SCENE_MAP_REQUIRED_FOR_SOURCE_ALIGNMENT')).toBe(false);
    expect(qaFindingIsWaivable('SHOTLIST_PARSE_FAILED')).toBe(false);
  });

  it('downgrades a waived blocking finding to informational and keeps it in the report', () => {
    const issues: Issue[] = [
      { code: 'COVER_HEADLINE_NOT_VISIBLE', severity: 'error', message: 'headline missing' },
      { code: 'HTML_MISSING_SCENE_COPY', severity: 'error', message: 'copy missing' },
      { code: 'VIDEO_SAMPLE_FRAMES_MISSING', severity: 'error', message: 'no frames' },
      { code: 'COVER_HERO_NOT_DECLARED', severity: 'warning', message: 'no hero' },
    ];
    const { issues: next, applied } = applyQaFindingWaivers(issues, ['COVER_HEADLINE_NOT_VISIBLE', 'VIDEO_SAMPLE_FRAMES_MISSING']);
    expect(applied).toEqual(['COVER_HEADLINE_NOT_VISIBLE']);
    expect(next[0]).toMatchObject({ severity: 'info', waived_by_user: true });
    expect(next[0].message).toContain('[skipped by user decision]');
    // Not waived, not waivable, and non-error findings stay untouched.
    expect(next[1].severity).toBe('error');
    expect(next[2].severity).toBe('error');
    expect(next[3].severity).toBe('warning');
  });
});

