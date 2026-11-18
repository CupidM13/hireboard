export const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function changeStage(candidate, nextStage) {
  if (!STAGES.includes(nextStage)) throw new Error('Choose a supported pipeline stage.');
  if (!candidate || !candidate.id) throw new Error('Candidate not found.');
  return { ...candidate, stage: nextStage };
}

export function createCandidate(input, jobs, candidates) {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const role = String(input.role || '').trim();
  const appliedAt = String(input.appliedAt || '').trim();
  const resumeText = String(input.resumeText || '').trim();
  if (!name) throw new Error('Add a candidate name.');
  if (!/^[^\s@]+@example\.test$/i.test(email)) throw new Error('Use a fictional email ending in @example.test.');
  if (!jobs.some((job) => job.title === role && job.status === 'Open')) throw new Error('Choose an existing open role.');
  if (!STAGES.includes(input.stage || 'Applied')) throw new Error('Choose a supported pipeline stage.');
  if (!isValidDate(appliedAt)) throw new Error('Choose a valid application date.');
  if (candidates.some((candidate) => candidate.email.toLowerCase() === email)) throw new Error('A candidate with this demo email already exists.');
  return { id: input.id, name, email, role, stage: input.stage || 'Applied', appliedAt, resumeText, interview: null };
}

export function scheduleInterview(candidate, { date, time, type }) {
  if (!candidate || !candidate.id) throw new Error('Candidate not found.');
  if (candidate.stage !== 'Interview') throw new Error('Move the candidate to Interview before scheduling.');
  if (!isValidDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid interview date and time.');
  const label = String(type || '').trim();
  if (!label || label.length > 80) throw new Error('Add a short interview format.');
  return { ...candidate, interview: { date, time, type: label } };
}

export function toggleJobStatus(job) {
  if (!job || !job.id) throw new Error('Job not found.');
  return { ...job, status: job.status === 'Open' ? 'Closed' : 'Open' };
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
  const quote = (value) => {
    const text = String(value ?? '');
    const safe = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [fields.join(','), ...candidates.map((candidate) => fields.map((field) => quote(candidate[field])).join(','))].join('\r\n');
}
