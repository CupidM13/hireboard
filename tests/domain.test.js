import test from 'node:test';
import assert from 'node:assert/strict';
import { changeStage, filterCandidates, reviewRequirements, toCsv } from '../src/domain.js';
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

test('candidate filtering combines name, role, and stage filters', () => {
  assert.deepEqual(filterCandidates(candidates, { query: 'avery' }).map((candidate) => candidate.id), ['1']);
  assert.deepEqual(filterCandidates(candidates, { role: 'Product Designer', stage: 'Interview' }).map((candidate) => candidate.id), ['2']);
  assert.deepEqual(filterCandidates(candidates, { query: 'no match' }), []);
});

test('CSV exports named fields and safely quotes commas and quotes', () => {
  const csv = toCsv([{ name: 'Avery "Ace" Shah', email: 'avery@example.test', role: 'Frontend, Platform', stage: 'Applied', appliedAt: '2026-11-16' }]);
  assert.equal(csv, 'name,email,role,stage,appliedAt\r\n"Avery ""Ace"" Shah","avery@example.test","Frontend, Platform","Applied","2026-11-16"');
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
