import test from 'node:test';
import assert from 'node:assert/strict';
import { changeStage, createCandidate, filterCandidates, reviewRequirements, scheduleInterview, toggleJobStatus, toCsv } from '../src/domain.js';
import { loadData, saveData, seedData, STORAGE_KEY } from '../src/data.js';

const candidates = [
  { id: '1', name: 'Avery Shah', email: 'avery@example.test', role: 'Frontend Engineer', stage: 'Applied', appliedAt: '2026-11-16' },
  { id: '2', name: 'Mira Kapoor', email: 'mira@example.test', role: 'Product Designer', stage: 'Interview', appliedAt: '2026-11-15' }
];

test('requirement review reports exact phrase evidence and rounded overlap', () => {
  assert.deepEqual(reviewRequirements(['React', 'TypeScript', 'React'], 'React and typeScript projects'), {
    required: ['React', 'TypeScript'], found: ['React', 'TypeScript'], missing: [], score: 100
  });
  const partial = reviewRequirements(['React', 'TypeScript', 'Accessibility'], 'Built React interfaces');
  assert.equal(partial.score, 33);
  assert.deepEqual(partial.missing, ['TypeScript', 'Accessibility']);
});

test('requirement review handles empty requirements and text', () => {
  assert.deepEqual(reviewRequirements([], 'anything'), { required: [], found: [], missing: [], score: null });
  assert.deepEqual(reviewRequirements(['SQL'], ''), { required: ['SQL'], found: [], missing: ['SQL'], score: 0 });
});

test('candidate stage changes accept supported stages and reject unsupported values', () => {
  assert.equal(changeStage(candidates[0], 'Screening').stage, 'Screening');
  assert.throws(() => changeStage(candidates[0], 'Shortlisted'), /supported pipeline stage/);
  assert.throws(() => changeStage(null, 'Applied'), /Candidate not found/);
});

test('candidate creation requires synthetic email, a known open role, and unique email', () => {
  const jobs = [{ id: 'job-1', title: 'Frontend Engineer', status: 'Open' }];
  const input = { id: '3', name: 'Sam Example', email: 'sam@example.test', role: 'Frontend Engineer', stage: 'Applied', appliedAt: '2026-11-18', resumeText: 'Fictional text' };
  assert.equal(createCandidate(input, jobs, candidates).email, 'sam@example.test');
  assert.throws(() => createCandidate({ ...input, email: 'sam@realmail.com' }, jobs, candidates), /fictional email/);
  assert.throws(() => createCandidate({ ...input, email: candidates[0].email }, jobs, candidates), /already exists/);
  assert.throws(() => createCandidate(input, [], candidates), /existing open role/);
  assert.throws(() => createCandidate(input, [{ ...jobs[0], status: 'Closed' }], candidates), /existing open role/);
});

test('interview scheduling is limited to interview stage candidates', () => {
  const candidate = { id: 'int-1', stage: 'Interview' };
  assert.equal(scheduleInterview(candidate, { date: '2026-11-20', time: '14:00', type: 'Team conversation' }).interview.date, '2026-11-20');
  assert.throws(() => scheduleInterview(candidates[0], { date: '2026-11-20', time: '14:00', type: 'Call' }), /Move the candidate to Interview/);
  assert.throws(() => scheduleInterview(candidate, { date: 'bad-date', time: '99:00', type: 'Call' }), /valid interview date and time/);
});

test('jobs can be closed and reopened', () => {
  const job = { id: 'job-1', status: 'Open' };
  assert.equal(toggleJobStatus(job).status, 'Closed');
  assert.equal(toggleJobStatus({ ...job, status: 'Closed' }).status, 'Open');
});

test('candidate filtering combines name, role, and stage filters', () => {
  assert.deepEqual(filterCandidates(candidates, { query: 'avery' }).map((candidate) => candidate.id), ['1']);
  assert.deepEqual(filterCandidates(candidates, { role: 'Product Designer', stage: 'Interview' }).map((candidate) => candidate.id), ['2']);
  assert.deepEqual(filterCandidates(candidates, { query: 'no match' }), []);
});

test('CSV exports named fields and safely quotes commas and quotes', () => {
  const csv = toCsv([{ name: 'Avery "Ace" Shah', email: 'avery@example.test', role: 'Frontend, Platform', stage: 'Applied', appliedAt: '2026-11-16' }]);
  assert.equal(csv, 'name,email,role,stage,appliedAt\r\n"Avery ""Ace"" Shah","avery@example.test","Frontend, Platform","Applied","2026-11-16"');
});

test('CSV export neutralizes formula-like cell values', () => {
  const csv = toCsv([{ name: '=HYPERLINK("https://bad.test")', email: 'a@example.test', role: '+CMD', stage: 'Applied', appliedAt: '2026-11-18' }]);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.test""\)"/);
  assert.match(csv, /"'\+CMD"/);
});

test('local data loads synthetic defaults once and persists edits', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const initial = loadData(storage);
  assert.equal(initial.jobs.length, seedData.jobs.length);
  assert.equal(JSON.parse(values.get(STORAGE_KEY)).candidates.length, seedData.candidates.length);
  initial.jobs[0].title = 'Edited role';
  saveData(initial, storage);
  assert.equal(loadData(storage).jobs[0].title, 'Edited role');
});

test('legacy sample workspace receives the new fictional interview dates once', () => {
  const values = new Map();
  const legacy = structuredClone(seedData);
  delete legacy.version;
  legacy.candidates.forEach((candidate) => delete candidate.interview);
  values.set(STORAGE_KEY, JSON.stringify(legacy));
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const migrated = loadData(storage);
  assert.deepEqual(migrated.candidates.find((candidate) => candidate.id === 'cand-1').interview, { date: '2026-11-19', time: '10:30', type: 'Portfolio review' });
  assert.equal(migrated.version, 2);
  assert.equal(JSON.parse(values.get(STORAGE_KEY)).version, 2);
});
