const supportedModes = ['revision-journey', 'price-revision', 'late-attachments', 'long-form', 'skill-routing'];
const supportedServices = ['budget', 'page', 'stock'];

export function validateCases(cases, seeds) {
    const ids = new Set();
    const sourceIds = new Set();
    for (const entry of cases) {
        if (typeof entry.id !== 'string' || !/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id)
            || typeof entry.sourceCaseId !== 'string' || sourceIds.has(entry.sourceCaseId)
            || !/^[a-f0-9]{64}$/.test(entry.sourceCaseSha256)
            || !Object.hasOwn(seeds, entry.fixture) || typeof seeds[entry.fixture] !== 'function' || !entry.prompt?.trim() || !entry.review?.trim()) {
            throw new Error(`Invalid or duplicate model evaluation case: ${entry.id}`);
        }
        if ((entry.mode && !supportedModes.includes(entry.mode))
            || (entry.service && !supportedServices.includes(entry.service))
            || (entry.fixture === 'reference' && !['preserve', 'recolor', 'remake'].includes(entry.scenario))
            || (entry.maxDuration !== undefined && (!Number.isInteger(entry.maxDuration) || entry.maxDuration > 300 || entry.maxDuration < 1))
            || (entry.deliveryCount !== undefined && (!Number.isInteger(entry.deliveryCount) || entry.deliveryCount > 8 || entry.deliveryCount < 1))
            || (entry.turnTimeoutSeconds !== undefined && (!Number.isInteger(entry.turnTimeoutSeconds)
                || entry.turnTimeoutSeconds < 30 || entry.turnTimeoutSeconds > 3600))
            || (entry.steps && (!Array.isArray(entry.steps) || entry.steps.length > 5 || entry.steps.some(step =>
                !step.prompt?.trim() || (step.after && !['sample', 'delivery', 'no-delivery'].includes(step.after))
                || (step.attachments && step.attachments !== 'later'))))) {
            throw new Error(`Invalid model evaluation workflow: ${entry.id}`);
        }
        ids.add(entry.id);
        sourceIds.add(entry.sourceCaseId);
    }
}

export function shouldRunStep(step, previous) {
    if (!previous?.completed) return false;
    if (step.after === 'no-delivery') return !previous.delivery;
    if (step.after === 'sample') return previous.versions.length === 1 && previous.delivery?.probe.duration <= 75;
    return !!previous.delivery;
}
