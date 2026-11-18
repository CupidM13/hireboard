import { STAGES, changeStage, filterCandidates, reviewRequirements, toCsv } from './domain.js';
import { loadData, saveData } from './data.js';

let data = loadData();
let currentView = location.hash.slice(1) || 'dashboard';
let filters = { query: '', role: 'All roles', stage: 'All stages' };
let reviewJobId = data.jobs[0]?.id || '';
let reviewText = '';
let reviewResult = null;
const page = document.querySelector('#page-content');
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const jobByTitle = (title) => data.jobs.find((job) => job.title === title);
const initials = (name) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
const colorFor = (name) => ['mint', 'lavender', 'peach', 'sky', 'lemon'][[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5];

function persist() { try { saveData(data); } catch { toast('Could not save locally. Check browser storage settings.', 'error'); } }
function toast(message, kind = 'success') {
  const item = document.createElement('div'); item.className = `toast ${kind}`; item.textContent = message;
  document.querySelector('#toast-region').append(item); setTimeout(() => item.remove(), 3200);
}
function go(view) { currentView = view; location.hash = view; render(); }
function setHeader() {
  const labels = { dashboard: 'Overview', jobs: 'Jobs', candidates: 'Candidates', review: 'Match review' };
  document.querySelector('#crumb-current').textContent = labels[currentView] || 'Overview';
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === currentView));
  document.querySelector('#job-nav-count').textContent = data.jobs.filter((job) => job.status === 'Open').length;
  document.querySelector('#candidate-nav-count').textContent = data.candidates.length;
  document.querySelector('#today-label').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const welcomeDate = document.querySelector('#welcome-date');
  if (welcomeDate) welcomeDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
}
function stageBadge(stage) { return `<span class="stage-badge stage-${stage.toLowerCase()}"><span></span>${esc(stage)}</span>`; }
function candidateRow(candidate, compact = false) {
  const job = jobByTitle(candidate.role);
  return `<tr><td><div class="person-cell"><span class="avatar ${colorFor(candidate.name)}">${esc(initials(candidate.name))}</span><div><strong>${esc(candidate.name)}</strong><small>${esc(candidate.email)}</small></div></div></td><td><span class="role-cell">${esc(candidate.role)}</span>${compact ? '' : `<small class="sub-cell">${esc(job?.department || 'Role')}</small>`}</td><td>${compact ? stageBadge(candidate.stage) : `<select class="stage-select stage-${candidate.stage.toLowerCase()}" data-stage-select="${esc(candidate.id)}" aria-label="Move ${esc(candidate.name)} to stage">${STAGES.map((stage) => `<option ${stage === candidate.stage ? 'selected' : ''}>${stage}</option>`).join('')}</select>`}</td><td class="date-cell">${formatDate(candidate.appliedAt)}</td>${compact ? '' : `<td><button class="row-more" data-candidate="${esc(candidate.id)}" aria-label="Review ${esc(candidate.name)}" title="Review candidate">↗</button></td>`}</tr>`;
}
function dashboard() {
  const openJobs = data.jobs.filter((job) => job.status === 'Open').length;
  const active = data.candidates.filter((candidate) => !['Hired', 'Rejected'].includes(candidate.stage)).length;
  const interviews = data.candidates.filter((candidate) => candidate.stage === 'Interview').length;
  const offers = data.candidates.filter((candidate) => candidate.stage === 'Offer').length;
  const stats = [['Open jobs', openJobs, '▤', 'soft-green'], ['Active candidates', active, '♧', 'soft-blue'], ['Interviews', interviews, '◷', 'soft-purple'], ['Offers', offers, '✳', 'soft-orange']];
  const maxCount = Math.max(1, ...data.jobs.map((job) => data.candidates.filter((candidate) => candidate.role === job.title).length));
  return `<section class="welcome-row"><div><div class="eyebrow" id="welcome-date"></div><h1>Good morning, Jordan <span class="wave">✦</span></h1><p>Here’s what’s happening across your hiring pipeline.</p></div><button class="button button-primary" data-action="new-job"><span>＋</span> Create job</button></section>
    <section class="stats-grid" aria-label="Recruiting summary">${stats.map(([label, value, icon, color]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${icon}</span></div><strong>${value}</strong><small><span class="trend">↗</span> <b>${label === 'Active candidates' ? `${value} in progress` : `${value} currently`}</b></small></article>`).join('')}</section>
    <section class="dashboard-grid"><article class="panel roles-panel"><div class="panel-heading"><div><h2>Open roles</h2><p>Applicant activity by position</p></div><button class="text-button" data-view-link="jobs">View all <span>→</span></button></div>
      ${data.jobs.length ? `<div class="role-list">${data.jobs.filter((job) => job.status === 'Open').map((job) => { const count = data.candidates.filter((candidate) => candidate.role === job.title).length; const percent = Math.round((count / maxCount) * 100); return `<button class="role-item" data-job="${esc(job.id)}"><span class="role-symbol ${colorFor(job.title)}">${esc(job.title[0])}</span><span class="role-info"><strong>${esc(job.title)}</strong><small>${esc(job.department)} <i>·</i> ${esc(job.location)}</small><span class="progress-track"><i style="width:${percent}%"></i></span></span><span class="role-applicants"><strong>${count}</strong><small>applicants</small></span><span class="chevron">›</span></button>`; }).join('')}</div>` : `<div class="empty-state"><span>▤</span><h3>No open roles yet</h3><p>Create a role to start building your pipeline.</p><button class="button button-primary" data-action="new-job">Create a job</button></div>`}</article>
      <article class="panel activity-panel"><div class="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from your team</p></div><button class="quiet-icon" aria-label="More activity">···</button></div><div class="activity-list">${data.activities.slice(0, 5).map((activity) => `<div class="activity-item"><span class="activity-icon ${esc(activity.tone)}">${activity.tone === 'green' ? '↗' : activity.tone === 'blue' ? '＋' : activity.tone === 'purple' ? '◷' : '▤'}</span><div><strong>${esc(activity.text)}</strong><small>${esc(activity.time)}</small></div></div>`).join('') || '<p class="muted">No activity yet.</p>'}</div><button class="activity-footer" data-view-link="candidates">See candidate pipeline <span>→</span></button></article></section>
    <section class="panel recent-panel"><div class="panel-heading"><div><h2>Recently added candidates</h2><p>Keep track of new applications</p></div><button class="text-button" data-view-link="candidates">View all candidates <span>→</span></button></div><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Applied for</th><th>Stage</th><th>Applied</th></tr></thead><tbody>${data.candidates.slice().sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, 4).map((candidate) => candidateRow(candidate, true)).join('')}</tbody></table></div></section>`;
}
function jobsView() {
  return `<section class="page-heading"><div><div class="eyebrow">YOUR OPENINGS</div><h1>Jobs</h1><p>Manage roles and follow applicant activity.</p></div><button class="button button-primary" data-action="new-job">＋ Create job</button></section>
    <section class="job-cards">${data.jobs.map((job) => { const people = data.candidates.filter((candidate) => candidate.role === job.title); return `<article class="job-card"><div class="job-card-top"><span class="role-symbol ${colorFor(job.title)}">${esc(job.title[0])}</span><span class="job-status">● ${esc(job.status)}</span></div><h2>${esc(job.title)}</h2><p>${esc(job.department)} <span>·</span> ${esc(job.location)}</p><div class="job-desc">${esc(job.description)}</div><div class="skill-list">${job.requirements.map((term) => `<span>${esc(term)}</span>`).join('')}</div><div class="job-card-bottom"><span><strong>${people.length}</strong> applicants</span><button class="text-button" data-role-filter="${esc(job.title)}">View candidates →</button></div></article>`; }).join('')}</section>`;
}
function candidatesView() {
  const roles = [...new Set(data.jobs.map((job) => job.title))]; const filtered = filterCandidates(data.candidates, filters);
  return `<section class="page-heading"><div><div class="eyebrow">TALENT PIPELINE</div><h1>Candidates</h1><p>Review applicants and move them through the process.</p></div><button class="button button-secondary" data-action="export">↓ Export CSV</button></section>
    <section class="panel candidates-panel"><div class="filter-bar"><label class="search-box"><span>⌕</span><input id="candidate-search" type="search" placeholder="Search candidates..." value="${esc(filters.query)}" aria-label="Search candidates" /></label><label class="select-wrap"><span class="sr-only">Filter by role</span><select id="role-filter"><option>All roles</option>${roles.map((role) => `<option ${filters.role === role ? 'selected' : ''}>${esc(role)}</option>`).join('')}</select></label><label class="select-wrap"><span class="sr-only">Filter by stage</span><select id="stage-filter"><option>All stages</option>${STAGES.map((stage) => `<option ${filters.stage === stage ? 'selected' : ''}>${stage}</option>`).join('')}</select></label><span class="result-count">${filtered.length} candidate${filtered.length === 1 ? '' : 's'}</span></div><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Applied for</th><th>Stage</th><th>Applied</th><th></th></tr></thead><tbody id="candidate-rows">${filtered.map((candidate) => candidateRow(candidate)).join('')}</tbody></table>${filtered.length ? '' : `<div class="empty-state compact"><span>⌕</span><h3>No candidates found</h3><p>Try changing your search or filters.</p></div>`}</div></section>`;
}
function reviewView() {
  const selectedJob = data.jobs.find((job) => job.id === reviewJobId) || data.jobs[0];
  return `<section class="page-heading"><div><div class="eyebrow">TRANSPARENT REVIEW AID</div><h1>Match review</h1><p>Compare entered text with one role’s listed requirements.</p></div></section>
    <div class="review-layout"><section class="panel review-input-panel"><div class="panel-heading"><div><h2>Review candidate text</h2><p>Use synthetic sample text or paste text for this demo.</p></div><span class="review-step">01 / 02</span></div><label class="field-label" for="review-job">Select a role</label><select id="review-job" class="field-control">${data.jobs.map((job) => `<option value="${esc(job.id)}" ${job.id === selectedJob?.id ? 'selected' : ''}>${esc(job.title)}</option>`).join('')}</select><div class="requirement-preview"><span>REQUIREMENTS FOR THIS ROLE</span><div>${(selectedJob?.requirements || []).map((term) => `<span class="requirement-chip">${esc(term)}</span>`).join('')}</div></div><label class="field-label" for="resume-text">Resume or evidence text</label><textarea id="resume-text" class="field-control textarea" placeholder="Paste synthetic resume text here...">${esc(reviewText)}</textarea><div class="input-footer"><small>Text is processed in this browser and isn’t uploaded.</small><button class="button button-primary" data-action="run-review">Review keywords <span>→</span></button></div></section>
    <aside class="panel review-info"><span class="info-icon">i</span><h2>A review aid, not a verdict</h2><p>This tool checks whether listed requirement phrases appear in the text you enter. A missing phrase does not prove a person lacks that skill.</p><div class="info-divider"></div><h3>How the score works</h3><p>Found requirement phrases ÷ total listed phrases × 100. Every required phrase counts equally.</p><div class="info-divider"></div><p class="privacy-note"><span>♧</span> Demo only. Use synthetic information.</p></aside></div>
    ${reviewResult ? `<section class="panel review-result"><div class="result-header"><div><div class="eyebrow">KEYWORD EVIDENCE</div><h2>Review for ${esc(selectedJob?.title || 'selected role')}</h2></div><div class="score-ring ${reviewResult.score === null ? 'no-score' : ''}"><strong>${reviewResult.score === null ? '—' : `${reviewResult.score}%`}</strong><small>phrase overlap</small></div></div>${reviewResult.score === null ? '<p class="muted result-empty">This role has no listed requirements to compare yet.</p>' : `<div class="evidence-grid"><div class="evidence-column found-column"><h3><span>✓</span> Found in text <b>${reviewResult.found.length}</b></h3>${reviewResult.found.length ? `<ul>${reviewResult.found.map((term) => `<li>${esc(term)}</li>`).join('')}</ul>` : '<p>No listed phrases were found in this text.</p>'}</div><div class="evidence-column missing-column"><h3><span>−</span> Not found in text <b>${reviewResult.missing.length}</b></h3>${reviewResult.missing.length ? `<ul>${reviewResult.missing.map((term) => `<li>${esc(term)}</li>`).join('')}</ul>` : '<p>All listed phrases appear in the entered text.</p>'}</div></div><p class="result-footnote">This is a literal phrase check for review only. It does not assess qualifications or candidate quality.</p>`}</section>` : ''}`;
}
function render() {
  setHeader();
  page.innerHTML = ({ dashboard, jobs: jobsView, candidates: candidatesView, review: reviewView }[currentView] || dashboard)();
}
function createJobDialog() {
  document.querySelector('#dialog-root').innerHTML = `<div class="dialog-backdrop" data-action="close-dialog"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="dialog-close" data-action="close-dialog" aria-label="Close">×</button><div class="eyebrow">NEW OPENING</div><h2 id="dialog-title">Create a job</h2><p>Add the role details and explicit requirements.</p><form id="job-form"><label class="field-label" for="job-title">Job title <em>*</em></label><input class="field-control" id="job-title" name="title" required maxlength="80" placeholder="e.g. Backend Engineer" /><div class="form-row"><div><label class="field-label" for="job-dept">Department <em>*</em></label><input class="field-control" id="job-dept" name="department" required maxlength="60" placeholder="Engineering" /></div><div><label class="field-label" for="job-location">Location <em>*</em></label><input class="field-control" id="job-location" name="location" required maxlength="80" placeholder="Remote · India" /></div></div><label class="field-label" for="job-description">Description</label><textarea class="field-control textarea short" id="job-description" name="description" maxlength="400" placeholder="What will this person work on?"></textarea><label class="field-label" for="job-requirements">Key requirements <em>*</em></label><input class="field-control" id="job-requirements" name="requirements" required placeholder="Node.js, APIs, SQL (comma separated)" /><small class="field-hint">List specific terms you want to use in the review aid.</small><div class="dialog-actions"><button type="button" class="button button-secondary" data-action="close-dialog">Cancel</button><button class="button button-primary">Create role</button></div></form></section></div>`;
  document.querySelector('#job-title').focus();
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view]'); if (nav) { event.preventDefault(); go(nav.dataset.view); return; }
  const viewLink = event.target.closest('[data-view-link]'); if (viewLink) { go(viewLink.dataset.viewLink); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'new-job') createJobDialog();
  if (action === 'close-dialog' && (event.target.classList.contains('dialog-backdrop') || event.target.closest('.dialog-close, [data-action="close-dialog"]'))) document.querySelector('#dialog-root').innerHTML = '';
  if (action === 'export') {
    const blob = new Blob([toCsv(data.candidates)], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'hireboard-candidates.csv'; link.click(); URL.revokeObjectURL(link.href); toast('Candidate CSV exported.');
  }
  if (action === 'run-review') {
    const job = data.jobs.find((item) => item.id === document.querySelector('#review-job')?.value);
    reviewText = document.querySelector('#resume-text')?.value || '';
    if (!reviewText.trim()) { toast('Enter synthetic text to review.', 'error'); document.querySelector('#resume-text')?.focus(); return; }
    reviewJobId = job?.id || ''; reviewResult = reviewRequirements(job?.requirements || [], reviewText); render(); document.querySelector('.review-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const roleFilter = event.target.closest('[data-role-filter]'); if (roleFilter) { filters.role = roleFilter.dataset.roleFilter; filters.stage = 'All stages'; filters.query = ''; go('candidates'); }
  const job = event.target.closest('[data-job]'); if (job) { filters.role = data.jobs.find((item) => item.id === job.dataset.job)?.title || 'All roles'; go('candidates'); }
  const reviewCandidate = event.target.closest('[data-candidate]'); if (reviewCandidate) { const candidate = data.candidates.find((item) => item.id === reviewCandidate.dataset.candidate); if (candidate) { reviewText = candidate.resumeText; reviewJobId = jobByTitle(candidate.role)?.id || data.jobs[0]?.id; reviewResult = null; go('review'); } }
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'job-form') return;
  event.preventDefault(); const form = new FormData(event.target); const title = String(form.get('title')).trim();
  if (data.jobs.some((job) => job.title.toLocaleLowerCase() === title.toLocaleLowerCase())) { toast('A role with this title already exists.', 'error'); return; }
  const requirements = String(form.get('requirements')).split(',').map((term) => term.trim()).filter(Boolean);
  if (!requirements.length) { toast('Add at least one key requirement.', 'error'); return; }
  data.jobs.unshift({ id: `job-${crypto.randomUUID()}`, title, department: String(form.get('department')).trim(), location: String(form.get('location')).trim(), description: String(form.get('description')).trim(), requirements, status: 'Open', createdAt: new Date().toISOString().slice(0, 10) });
  data.activities.unshift({ id: `act-${crypto.randomUUID()}`, text: `${title} role published`, time: 'Just now', tone: 'amber' }); persist(); document.querySelector('#dialog-root').innerHTML = ''; toast('Job created.'); go('jobs');
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-stage-select]')) {
    const candidate = data.candidates.find((item) => item.id === event.target.dataset.stageSelect); if (!candidate) return;
    try { const previous = candidate.stage; Object.assign(candidate, changeStage(candidate, event.target.value)); data.activities.unshift({ id: `act-${crypto.randomUUID()}`, text: `${candidate.name} moved to ${candidate.stage}`, time: 'Just now', tone: 'green' }); persist(); toast(`${candidate.name} moved from ${previous} to ${candidate.stage}.`); render(); } catch (error) { toast(error.message, 'error'); render(); }
  }
  if (event.target.id === 'role-filter') { filters.role = event.target.value; render(); }
  if (event.target.id === 'stage-filter') { filters.stage = event.target.value; render(); }
  if (event.target.id === 'review-job') { reviewJobId = event.target.value; reviewResult = null; render(); }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'candidate-search') { const cursor = event.target.selectionStart; filters.query = event.target.value; render(); const input = document.querySelector('#candidate-search'); input.focus(); input.setSelectionRange(cursor, cursor); const candidates = filterCandidates(data.candidates, filters); document.querySelector('#candidate-rows').innerHTML = candidates.map((candidate) => candidateRow(candidate)).join(''); document.querySelector('.result-count').textContent = `${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`; document.querySelector('.empty-state')?.remove(); if (!candidates.length) document.querySelector('.table-wrap').insertAdjacentHTML('beforeend', '<div class="empty-state compact"><span>⌕</span><h3>No candidates found</h3><p>Try changing your search or filters.</p></div>'); }
  if (event.target.id === 'resume-text') reviewText = event.target.value;
});
window.addEventListener('hashchange', () => { const next = location.hash.slice(1); if (['dashboard', 'jobs', 'candidates', 'review'].includes(next) && next !== currentView) { currentView = next; render(); } });
render();
