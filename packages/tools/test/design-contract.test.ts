import { describe, expect, it } from 'vitest';
import { designContractIssues } from '../src/render/composition-qa';

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
});
