import { STAGES } from './domain.js';

export const STORAGE_KEY = 'hireboard-demo-v1';
export const DATA_VERSION = 2;

export const seedData = {
  version: DATA_VERSION,
  jobs: [
    { id: 'job-1', title: 'Frontend Engineer', department: 'Engineering', location: 'Remote · India', description: 'Build thoughtful product experiences for a growing team.', requirements: ['React', 'TypeScript', 'Accessibility', 'CSS'], status: 'Open', createdAt: '2026-10-28' },
    { id: 'job-2', title: 'Product Designer', department: 'Design', location: 'Bengaluru · Hybrid', description: 'Shape clear, inclusive workflows from discovery to delivery.', requirements: ['Figma', 'Prototyping', 'Design systems', 'Research'], status: 'Open', createdAt: '2026-11-02' },
    { id: 'job-3', title: 'People Operations Associate', department: 'People', location: 'Mumbai · Hybrid', description: 'Help make the employee experience welcoming and reliable.', requirements: ['Coordination', 'Communication', 'HRIS', 'Onboarding'], status: 'Open', createdAt: '2026-11-06' }
  ],
  candidates: [
    { id: 'cand-1', name: 'Avery Shah', email: 'avery.shah@example.test', role: 'Frontend Engineer', stage: 'Interview', appliedAt: '2026-11-16', resumeText: 'Frontend engineer building React and TypeScript applications. Focused on accessible interfaces and CSS systems.', interview: { date: '2026-11-19', time: '10:30', type: 'Portfolio review' } },
    { id: 'cand-2', name: 'Noah Iyer', email: 'noah.iyer@example.test', role: 'Frontend Engineer', stage: 'Screening', appliedAt: '2026-11-15', resumeText: 'JavaScript developer with experience shipping product UI and collaborating across teams.' },
    { id: 'cand-3', name: 'Mira Kapoor', email: 'mira.kapoor@example.test', role: 'Product Designer', stage: 'Offer', appliedAt: '2026-11-14', resumeText: 'Product designer using Figma, prototyping and research to build design systems.' },
    { id: 'cand-4', name: 'Leo Fernandes', email: 'leo.fernandes@example.test', role: 'People Operations Associate', stage: 'Applied', appliedAt: '2026-11-17', resumeText: 'People operations coordinator with onboarding and communication experience.' },
    { id: 'cand-5', name: 'Zara Menon', email: 'zara.menon@example.test', role: 'Product Designer', stage: 'Interview', appliedAt: '2026-11-12', resumeText: 'Designer working across user research, Figma and collaborative prototyping.', interview: { date: '2026-11-20', time: '14:00', type: 'Team conversation' } },
    { id: 'cand-6', name: 'Ishaan Rao', email: 'ishaan.rao@example.test', role: 'Frontend Engineer', stage: 'Applied', appliedAt: '2026-11-18', resumeText: 'Early-career developer learning React, CSS and web accessibility.' },
    { id: 'cand-7', name: 'Tara Joseph', email: 'tara.joseph@example.test', role: 'People Operations Associate', stage: 'Screening', appliedAt: '2026-11-10', resumeText: 'Operations associate supporting HRIS workflows, onboarding and scheduling.' }
  ],
  activities: [
    { id: 'act-1', text: 'Mira Kapoor moved to Offer', time: 'Today · 10:24 AM', tone: 'green' },
    { id: 'act-2', text: 'Ishaan Rao applied for Frontend Engineer', time: 'Today · 9:12 AM', tone: 'blue' },
    { id: 'act-3', text: 'Avery Shah moved to Interview', time: 'Yesterday · 4:38 PM', tone: 'purple' },
    { id: 'act-4', text: 'Product Designer role published', time: 'Nov 16 · 11:05 AM', tone: 'amber' }
  ]
};

export function loadData(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    if (parsed && Array.isArray(parsed.jobs) && Array.isArray(parsed.candidates) && parsed.candidates.every((candidate) => STAGES.includes(candidate.stage))) {
      if ((parsed.version || 1) < DATA_VERSION) {
        const samples = new Map(seedData.candidates.map((candidate) => [candidate.id, candidate]));
        parsed.candidates = parsed.candidates.map((candidate) => {
          const sample = samples.get(candidate.id);
          return sample?.interview && candidate.stage === 'Interview' && !candidate.interview ? { ...candidate, interview: structuredClone(sample.interview) } : candidate;
        });
        parsed.version = DATA_VERSION;
        try { storage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch { /* Keep migrated data available for this session when storage is unavailable. */ }
      }
      return parsed;
    }
  } catch { /* Use the synthetic starter workspace when storage is unavailable or invalid. */ }
  const initial = structuredClone(seedData);
  try { storage.setItem(STORAGE_KEY, JSON.stringify(initial)); } catch { /* The app remains usable for this session when storage is unavailable. */ }
  return initial;
}

export function saveData(data, storage = globalThis.localStorage) {
  data.version = DATA_VERSION;
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}
