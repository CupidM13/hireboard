export const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

export function changeStage(candidate, nextStage) {
  if (!STAGES.includes(nextStage)) throw new Error('Choose a supported pipeline stage.');
  if (!candidate || !candidate.id) throw new Error('Candidate not found.');
  return { ...candidate, stage: nextStage };
}

export function filterCandidates(candidates, { query = '', role = 'All roles', stage = 'All stages' } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return candidates.filter((candidate) => {
    const searchable = `${candidate.name} ${candidate.email} ${candidate.role}`.toLocaleLowerCase();
    return (!needle || searchable.includes(needle)) && (role === 'All roles' || candidate.role === role) && (stage === 'All stages' || candidate.stage === stage);
  });
}

export function reviewRequirements(requirements, resumeText) {
  const terms = [...new Set(requirements.map((term) => term.trim()).filter(Boolean))];
  const text = resumeText.toLocaleLowerCase();
  const found = terms.filter((term) => text.includes(term.toLocaleLowerCase()));
  const missing = terms.filter((term) => !text.includes(term.toLocaleLowerCase()));
  return { required: terms, found, missing, score: terms.length ? Math.round((found.length / terms.length) * 100) : null };
}

export function toCsv(candidates) {
  const fields = ['name', 'email', 'role', 'stage', 'appliedAt'];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [fields.join(','), ...candidates.map((candidate) => fields.map((field) => quote(candidate[field])).join(','))].join('\r\n');
}
