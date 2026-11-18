import { STAGES, changeStage, createCandidate, filterCandidates, reviewRequirements, scheduleInterview, toggleJobStatus, toCsv } from './domain.js';
import { loadData, saveData, seedData } from './data.js';

let data = loadData();
let currentView = location.hash.slice(1) || 'dashboard';
let filters = { query: '', role: 'All roles', stage: 'All stages' };
let reviewJobId = data.jobs[0]?.id || '';
let reviewText = '';
let reviewResult = null;
let pipelineMode = 'board';
let selectedCandidateId = null;
let overlayTrigger = null;
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
function go(view) { currentView = view; selectedCandidateId = null; overlayTrigger = null; document.querySelector('#dialog-root').innerHTML = ''; location.hash = view; render(); page.focus({ preventScroll: true }); }
function rememberOverlayTrigger() { if (!document.querySelector('#dialog-root [role="dialog"]')) overlayTrigger = document.activeElement; }
function dismissOverlay() { document.querySelector('#dialog-root').innerHTML = ''; selectedCandidateId = null; const trigger = overlayTrigger; overlayTrigger = null; if (trigger?.isConnected) trigger.focus(); }
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
function interviewLabel(interview) {
  const date = new Date(`${interview.date}T12:00:00`);
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${new Date(`2000-01-01T${interview.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
function upcomingInterviews() {
  const today = new Date().toISOString().slice(0, 10);
  return data.candidates.filter((candidate) => candidate.stage === 'Interview' && candidate.interview?.date >= today)
    .sort((a, b) => `${a.interview.date} ${a.interview.time}`.localeCompare(`${b.interview.date} ${b.interview.time}`));
}
function candidateCard(candidate) {
  return `<article class="pipeline-card" draggable="true" data-draggable-candidate="${esc(candidate.id)}"><button class="pipeline-card-open" data-candidate="${esc(candidate.id)}"><span class="avatar ${colorFor(candidate.name)}">${esc(initials(candidate.name))}</span><span class="pipeline-person"><strong>${esc(candidate.name)}</strong><small>${esc(candidate.role)}</small></span><span class="card-arrow" aria-hidden="true">↗</span></button><div class="pipeline-card-meta"><span>Applied ${formatDate(candidate.appliedAt)}</span><button class="candidate-review-link" data-review-candidate="${esc(candidate.id)}">Review text</button></div><label class="sr-only" for="board-stage-${esc(candidate.id)}">Move ${esc(candidate.name)} to stage</label><select id="board-stage-${esc(candidate.id)}" class="mini-stage-select" data-stage-select="${esc(candidate.id)}">${STAGES.map((stage) => `<option ${stage === candidate.stage ? 'selected' : ''}>${stage}</option>`).join('')}</select></article>`;
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
    <section class="dashboard-bottom-grid"><article class="panel upcoming-panel"><div class="panel-heading"><div><h2>Upcoming interviews</h2><p>Scheduled conversations</p></div><span class="count-pill">${upcomingInterviews().length} scheduled</span></div>${upcomingInterviews().length ? `<div class="upcoming-list">${upcomingInterviews().slice(0, 3).map((candidate) => `<button class="upcoming-item" data-candidate="${esc(candidate.id)}"><span class="calendar-tile"><b>${new Date(`${candidate.interview.date}T12:00:00`).getDate()}</b><small>${new Date(`${candidate.interview.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></span><span class="upcoming-person"><strong>${esc(candidate.name)}</strong><small>${esc(candidate.interview.type)} · ${esc(candidate.role)}</small></span><span class="upcoming-time">${interviewLabel(candidate.interview).split(' · ')[1]}</span></button>`).join('')}</div>` : `<div class="empty-inline"><strong>No interviews scheduled</strong><span>Open an interview stage candidate to add a time.</span></div>`}<button class="activity-footer" data-view-link="candidates">Open pipeline <span>→</span></button></article><article class="panel funnel-panel"><div class="panel-heading"><div><h2>Pipeline snapshot</h2><p>Candidate volume by stage</p></div></div><div class="funnel-list">${STAGES.map((stage) => { const count = data.candidates.filter((candidate) => candidate.stage === stage).length; const pct = data.candidates.length ? Math.max(count ? 7 : 0, Math.round((count / data.candidates.length) * 100)) : 0; return `<div class="funnel-row"><span>${stageBadge(stage)}</span><span class="funnel-track"><i style="width:${pct}%"></i></span><strong>${count}</strong></div>`; }).join('')}</div></article></section>
    <section class="panel recent-panel"><div class="panel-heading"><div><h2>Recently added candidates</h2><p>Keep track of new applications</p></div><button class="text-button" data-view-link="candidates">View all candidates <span>→</span></button></div><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Applied for</th><th>Stage</th><th>Applied</th></tr></thead><tbody>${data.candidates.slice().sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, 4).map((candidate) => candidateRow(candidate, true)).join('')}</tbody></table></div></section>`;
}
function jobsView() {
  const openCount = data.jobs.filter((job) => job.status === 'Open').length;
  return `<section class="page-heading"><div><div class="eyebrow">HIRING PLAN</div><h1>Jobs</h1><p>Keep each opening clear, current, and connected to its pipeline.</p></div><button class="button button-primary" data-action="new-job">＋ Create job</button></section>
    <div class="page-summary"><span class="summary-dot"></span><strong>${openCount} open</strong><span>·</span><span>${data.jobs.length - openCount} closed</span><span class="summary-spacer"></span><span>${data.candidates.length} applicants across all roles</span></div>
    <section class="job-cards">${data.jobs.map((job) => { const people = data.candidates.filter((candidate) => candidate.role === job.title); const hired = people.filter((candidate) => candidate.stage === 'Hired').length; return `<article class="job-card ${job.status === 'Closed' ? 'job-closed' : ''}"><div class="job-card-top"><span class="role-symbol ${colorFor(job.title)}">${esc(job.title[0])}</span><span class="job-status ${job.status === 'Closed' ? 'status-closed' : ''}"><i></i>${esc(job.status)}</span></div><h2>${esc(job.title)}</h2><p>${esc(job.department)} <span>·</span> ${esc(job.location)}</p><div class="job-desc">${esc(job.description)}</div><div class="skill-list">${job.requirements.map((term) => `<span>${esc(term)}</span>`).join('')}</div><div class="job-metrics"><span><strong>${people.length}</strong> applicants</span><span><strong>${people.filter((candidate) => candidate.stage === 'Interview').length}</strong> interviewing</span><span><strong>${hired}</strong> hired</span></div><div class="job-card-bottom"><button class="text-button" data-role-filter="${esc(job.title)}">View pipeline <span>→</span></button><button class="button button-quiet" data-toggle-job="${esc(job.id)}">${job.status === 'Open' ? 'Close role' : 'Reopen role'}</button></div></article>`; }).join('')}</section>`;
}
function candidatesView() {
  const roles = [...new Set(data.jobs.map((job) => job.title))]; const filtered = filterCandidates(data.candidates, filters);
  return `<section class="page-heading"><div><div class="eyebrow">TALENT PIPELINE</div><h1>Candidates</h1><p>Move good conversations forward. Keep every stage visible.</p></div><div class="heading-actions"><button class="button button-secondary" data-action="export">↓ Export CSV</button><button class="button button-primary" data-action="new-candidate">＋ Add candidate</button></div></section>
    <section class="panel candidates-panel"><div class="filter-bar"><label class="search-box"><span>⌕</span><input id="candidate-search" type="search" placeholder="Search name, email, or role..." value="${esc(filters.query)}" aria-label="Search candidates" /></label><label class="select-wrap"><span class="sr-only">Filter by role</span><select id="role-filter"><option>All roles</option>${roles.map((role) => `<option ${filters.role === role ? 'selected' : ''}>${esc(role)}</option>`).join('')}</select></label><label class="select-wrap"><span class="sr-only">Filter by stage</span><select id="stage-filter"><option>All stages</option>${STAGES.map((stage) => `<option ${filters.stage === stage ? 'selected' : ''}>${stage}</option>`).join('')}</select></label><span class="result-count">${filtered.length} candidate${filtered.length === 1 ? '' : 's'}</span><div class="view-toggle" role="group" aria-label="Pipeline display"><button class="${pipelineMode === 'board' ? 'selected' : ''}" data-pipeline-mode="board" aria-pressed="${pipelineMode === 'board'}">▦ Board</button><button class="${pipelineMode === 'list' ? 'selected' : ''}" data-pipeline-mode="list" aria-pressed="${pipelineMode === 'list'}">☷ List</button></div></div>${pipelineMode === 'board' ? `<div class="pipeline-board" aria-label="Candidate pipeline board">${STAGES.map((stage) => { const group = filtered.filter((candidate) => candidate.stage === stage); return `<section class="pipeline-column" data-drop-stage="${stage}"><header><span class="stage-marker marker-${stage.toLowerCase()}"></span><h2>${stage}</h2><span class="column-count">${group.length}</span></header><div class="pipeline-stack">${group.map(candidateCard).join('') || `<div class="column-empty">Drop a candidate here</div>`}</div></section>`; }).join('')}</div>` : `<div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Applied for</th><th>Stage</th><th>Applied</th><th></th></tr></thead><tbody id="candidate-rows">${filtered.map((candidate) => candidateRow(candidate)).join('')}</tbody></table>${filtered.length ? '' : `<div class="empty-state compact"><span>⌕</span><h3>No candidates found</h3><p>Try changing your search or filters.</p></div>`}</div>`}</section><p class="pipeline-hint">Tip: drag a card to another stage, or open a profile to update the pipeline.</p>`;
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
  rememberOverlayTrigger();
  document.querySelector('#dialog-root').innerHTML = `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="dialog-close" data-action="close-dialog" aria-label="Close">×</button><div class="eyebrow">NEW OPENING</div><h2 id="dialog-title">Create a job</h2><p>Add the role details and explicit requirements.</p><form id="job-form"><label class="field-label" for="job-title">Job title <em>*</em></label><input class="field-control" id="job-title" name="title" required maxlength="80" placeholder="e.g. Backend Engineer" /><div class="form-row"><div><label class="field-label" for="job-dept">Department <em>*</em></label><input class="field-control" id="job-dept" name="department" required maxlength="60" placeholder="Engineering" /></div><div><label class="field-label" for="job-location">Location <em>*</em></label><input class="field-control" id="job-location" name="location" required maxlength="80" placeholder="Remote · India" /></div></div><label class="field-label" for="job-description">Description</label><textarea class="field-control textarea short" id="job-description" name="description" maxlength="400" placeholder="What will this person work on?"></textarea><label class="field-label" for="job-requirements">Key requirements <em>*</em></label><input class="field-control" id="job-requirements" name="requirements" required placeholder="Node.js, APIs, SQL (comma separated)" /><small class="field-hint">List specific terms you want to use in the review aid.</small><div class="dialog-actions"><button type="button" class="button button-secondary" data-action="close-dialog">Cancel</button><button class="button button-primary">Create role</button></div></form></section></div>`;
  document.querySelector('#job-title').focus();
}
function openCandidateDialog() {
  const openJobs = data.jobs.filter((job) => job.status === 'Open');
  if (!openJobs.length) { toast('Open a role before adding a candidate.', 'error'); return; }
  rememberOverlayTrigger();
  document.querySelector('#dialog-root').innerHTML = `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="candidate-dialog-title"><button class="dialog-close" data-action="close-dialog" aria-label="Close">×</button><div class="eyebrow">SYNTHETIC DEMO RECORD</div><h2 id="candidate-dialog-title">Add a candidate</h2><p>Use fictional details only. This demo stays in this browser.</p><form id="candidate-form"><label class="field-label" for="candidate-name">Full name <em>*</em></label><input class="field-control" id="candidate-name" name="name" required maxlength="80" placeholder="e.g. Sam Example" /><label class="field-label" for="candidate-email">Demo email <em>*</em></label><input class="field-control" id="candidate-email" name="email" required type="email" pattern="[^\\s@]+@example\\.test" title="Use a fictional email ending in @example.test" placeholder="sam@example.test" /><div class="form-row"><div><label class="field-label" for="candidate-role">Role <em>*</em></label><select class="field-control" id="candidate-role" name="role" required>${openJobs.map((job) => `<option>${esc(job.title)}</option>`).join('')}</select></div><div><label class="field-label" for="candidate-date">Application date <em>*</em></label><input class="field-control" id="candidate-date" type="date" name="appliedAt" required value="${new Date().toISOString().slice(0, 10)}" /></div></div><label class="field-label" for="candidate-stage">Stage</label><select class="field-control" id="candidate-stage" name="stage">${STAGES.map((stage) => `<option>${stage}</option>`).join('')}</select><label class="field-label" for="candidate-resume">Synthetic resume text</label><textarea class="field-control textarea short" id="candidate-resume" name="resumeText" maxlength="2400" placeholder="Optional fictional evidence for the review aid"></textarea><label class="synthetic-confirm"><input type="checkbox" name="synthetic" required /><span>I confirm this is fictional demo data, not a real person’s information.</span></label><div class="dialog-actions"><button type="button" class="button button-secondary" data-action="close-dialog">Cancel</button><button class="button button-primary">Add candidate</button></div></form></section></div>`;
  document.querySelector('#candidate-name').focus();
}
function openCandidateDrawer(id) {
  const candidate = data.candidates.find((item) => item.id === id); if (!candidate) return;
  rememberOverlayTrigger();
  selectedCandidateId = id;
  const job = jobByTitle(candidate.role);
  const activity = data.activities.filter((item) => item.text.includes(candidate.name)).slice(0, 5);
  const interview = candidate.interview;
  document.querySelector('#dialog-root').innerHTML = `<div class="drawer-backdrop"><aside class="candidate-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-name"><header class="drawer-header"><span class="eyebrow">CANDIDATE PROFILE</span><button class="dialog-close" data-action="close-drawer" aria-label="Close profile">×</button></header><div class="drawer-person"><span class="avatar avatar-xl ${colorFor(candidate.name)}">${esc(initials(candidate.name))}</span><div><h2 id="drawer-name">${esc(candidate.name)}</h2><a href="mailto:${esc(candidate.email)}">${esc(candidate.email)}</a></div></div><div class="drawer-role"><span>APPLIED FOR</span><strong>${esc(candidate.role)}</strong><small>${esc(job?.department || 'Role')} · ${esc(job?.location || '')}</small></div><div class="drawer-facts"><div><span>Applied</span><strong>${formatDate(candidate.appliedAt)}, ${new Date(`${candidate.appliedAt}T12:00:00`).getFullYear()}</strong></div><div><span>Current stage</span><strong>${stageBadge(candidate.stage)}</strong></div></div><label class="field-label" for="drawer-stage">Move candidate</label><select class="field-control" id="drawer-stage" data-stage-select="${esc(candidate.id)}">${STAGES.map((stage) => `<option ${stage === candidate.stage ? 'selected' : ''}>${stage}</option>`).join('')}</select><div class="drawer-section"><div class="drawer-section-heading"><div><h3>Interview</h3><p>${interview ? 'Scheduled conversation' : 'Add a time for the hiring team'}</p></div><span class="interview-icon">◷</span></div>${candidate.stage !== 'Interview' ? `<p class="inline-note">Move this candidate to Interview to schedule a conversation.</p>` : `<form id="interview-form" data-candidate-id="${esc(candidate.id)}"><div class="interview-form-row"><label>Date<input class="field-control" type="date" name="date" required min="${new Date().toISOString().slice(0, 10)}" value="${esc(interview?.date || '')}" /></label><label>Time<input class="field-control" type="time" name="time" required value="${esc(interview?.time || '')}" /></label></div><label class="field-label" for="interview-type">Format</label><input class="field-control" id="interview-type" name="type" required maxlength="80" placeholder="e.g. Portfolio review" value="${esc(interview?.type || '')}" /><button class="button button-secondary interview-save">${interview ? 'Update interview' : 'Schedule interview'}</button></form>`}${interview ? `<div class="scheduled-note"><span>✓</span><div><strong>${interviewLabel(interview)}</strong><small>${esc(interview.type)}</small></div></div>` : ''}</div><div class="drawer-section"><div class="drawer-section-heading"><div><h3>Candidate-submitted text</h3><p>Manually entered sample evidence</p></div></div><p class="resume-excerpt">${candidate.resumeText ? esc(candidate.resumeText) : 'No text added yet.'}</p><button class="text-button" data-review-candidate="${esc(candidate.id)}">Compare with role requirements →</button></div><div class="drawer-section"><div class="drawer-section-heading"><div><h3>Recent activity</h3><p>Changes in this demo workspace</p></div></div>${activity.length ? `<div class="drawer-timeline">${activity.map((item) => `<div><span></span><p>${esc(item.text)}<small>${esc(item.time)}</small></p></div>`).join('')}</div>` : `<p class="inline-note">No candidate activity recorded yet.</p>`}</div><p class="drawer-disclaimer">Hireboard is a demo. Do not store real candidate information.</p></aside></div>`;
}
function confirmResetDialog() {
  rememberOverlayTrigger();
  document.querySelector('#dialog-root').innerHTML = `<div class="dialog-backdrop"><section class="dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><button class="dialog-close" data-action="close-dialog" aria-label="Close">×</button><span class="info-icon">↻</span><h2 id="reset-title">Restore sample workspace?</h2><p>This replaces local changes in this browser with the original fictional jobs, candidates, and activity.</p><div class="dialog-actions"><button class="button button-secondary" data-action="close-dialog">Keep current data</button><button class="button button-primary" data-action="reset-demo">Restore sample data</button></div></section></div>`;
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view]'); if (nav) { event.preventDefault(); go(nav.dataset.view); return; }
  const viewLink = event.target.closest('[data-view-link]'); if (viewLink) { go(viewLink.dataset.viewLink); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'new-job') createJobDialog();
  if (action === 'new-candidate') openCandidateDialog();
  if (action === 'confirm-reset') confirmResetDialog();
  if (event.target.classList.contains('dialog-backdrop') || (action === 'close-dialog' && event.target.closest('[data-action="close-dialog"]'))) dismissOverlay();
  if (event.target.classList.contains('drawer-backdrop') || (action === 'close-drawer' && event.target.closest('[data-action="close-drawer"]'))) dismissOverlay();
  if (action === 'reset-demo') { data = structuredClone(seedData); persist(); filters = { query: '', role: 'All roles', stage: 'All stages' }; reviewText = ''; reviewResult = null; selectedCandidateId = null; overlayTrigger = null; document.querySelector('#dialog-root').innerHTML = ''; toast('Sample workspace restored.'); go('dashboard'); }
  const pipelineButton = event.target.closest('[data-pipeline-mode]'); if (pipelineButton) { pipelineMode = pipelineButton.dataset.pipelineMode; render(); }
  const toggleJobButton = event.target.closest('[data-toggle-job]'); if (toggleJobButton) { const job = data.jobs.find((item) => item.id === toggleJobButton.dataset.toggleJob); if (job) { const was = job.status; Object.assign(job, toggleJobStatus(job)); data.activities.unshift({ id: `act-${crypto.randomUUID()}`, text: `${job.title} role ${job.status.toLowerCase()}`, time: 'Just now', tone: 'amber' }); persist(); toast(`${job.title} ${was === 'Open' ? 'closed' : 'reopened'}.`); render(); } }
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
  const job = event.target.closest('[data-job]'); if (job) { filters.role = data.jobs.find((item) => item.id === job.dataset.job)?.title || 'All roles'; filters.stage = 'All stages'; filters.query = ''; go('candidates'); }
  const reviewCandidate = event.target.closest('[data-review-candidate]'); if (reviewCandidate) { const candidate = data.candidates.find((item) => item.id === reviewCandidate.dataset.reviewCandidate); if (candidate) { reviewText = candidate.resumeText; reviewJobId = jobByTitle(candidate.role)?.id || data.jobs[0]?.id; reviewResult = null; selectedCandidateId = null; document.querySelector('#dialog-root').innerHTML = ''; go('review'); } }
  const candidateButton = event.target.closest('[data-candidate]'); if (candidateButton) openCandidateDrawer(candidateButton.dataset.candidate);
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'candidate-form') {
    event.preventDefault(); const form = new FormData(event.target);
    try {
      const job = data.jobs.find((item) => item.title === String(form.get('role')));
      const candidate = createCandidate({ id: `cand-${crypto.randomUUID()}`, name: form.get('name'), email: form.get('email'), role: form.get('role'), stage: form.get('stage'), appliedAt: form.get('appliedAt'), resumeText: form.get('resumeText') }, data.jobs.filter((item) => item.status === 'Open'), data.candidates);
      if (!form.get('synthetic')) throw new Error('Confirm this is fictional demo data.');
      data.candidates.unshift(candidate); data.activities.unshift({ id: `act-${crypto.randomUUID()}`, text: `${candidate.name} applied for ${job.title}`, time: 'Just now', tone: 'blue' }); persist(); document.querySelector('#dialog-root').innerHTML = ''; overlayTrigger = null; filters = { query: '', role: 'All roles', stage: 'All stages' }; pipelineMode = 'board'; toast('Synthetic candidate added.'); go('candidates');
    } catch (error) { toast(error.message, 'error'); }
    return;
  }
  if (event.target.id === 'interview-form') {
    event.preventDefault(); const form = new FormData(event.target); const candidate = data.candidates.find((item) => item.id === event.target.dataset.candidateId); if (!candidate) return;
    try { Object.assign(candidate, scheduleInterview(candidate, { date: form.get('date'), time: form.get('time'), type: form.get('type') })); data.activities.unshift({ id: `act-${crypto.randomUUID()}`, text: `${candidate.name} interview scheduled`, time: interviewLabel(candidate.interview), tone: 'purple' }); persist(); toast('Interview time saved to this demo.'); openCandidateDrawer(candidate.id); } catch (error) { toast(error.message, 'error'); }
    return;
  }
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
    try { const previous = candidate.stage; Object.assign(candidate, changeStage(candidate, event.target.value)); data.activities.unshift({ id: `act-${crypto.randomUUID()}`, text: `${candidate.name} moved to ${candidate.stage}`, time: 'Just now', tone: 'green' }); persist(); toast(`${candidate.name} moved from ${previous} to ${candidate.stage}.`); if (selectedCandidateId === candidate.id) openCandidateDrawer(candidate.id); else render(); } catch (error) { toast(error.message, 'error'); render(); }
  }
  if (event.target.id === 'role-filter') { filters.role = event.target.value; render(); }
  if (event.target.id === 'stage-filter') { filters.stage = event.target.value; render(); }
  if (event.target.id === 'review-job') { reviewJobId = event.target.value; reviewResult = null; render(); }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'candidate-search') { const cursor = event.target.selectionStart; filters.query = event.target.value; render(); const input = document.querySelector('#candidate-search'); input.focus(); input.setSelectionRange(cursor, cursor); }
  if (event.target.id === 'resume-text') reviewText = event.target.value;
});
document.addEventListener('dragstart', (event) => { const card = event.target.closest('[data-draggable-candidate]'); if (!card) return; event.dataTransfer.setData('text/plain', card.dataset.draggableCandidate); event.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
document.addEventListener('dragend', (event) => event.target.closest('[data-draggable-candidate]')?.classList.remove('dragging'));
document.addEventListener('dragover', (event) => { const column = event.target.closest('[data-drop-stage]'); if (column) { event.preventDefault(); column.classList.add('drag-over'); } });
document.addEventListener('dragleave', (event) => { const column = event.target.closest('[data-drop-stage]'); if (column && !column.contains(event.relatedTarget)) column.classList.remove('drag-over'); });
document.addEventListener('drop', (event) => { const column = event.target.closest('[data-drop-stage]'); if (!column) return; event.preventDefault(); column.classList.remove('drag-over'); const candidate = data.candidates.find((item) => item.id === event.dataTransfer.getData('text/plain')); if (!candidate || candidate.stage === column.dataset.dropStage) return; const previous = candidate.stage; Object.assign(candidate, changeStage(candidate, column.dataset.dropStage)); data.activities.unshift({ id: `act-${crypto.randomUUID()}`, text: `${candidate.name} moved to ${candidate.stage}`, time: 'Just now', tone: 'green' }); persist(); render(); toast(`${candidate.name} moved from ${previous} to ${candidate.stage}.`); });
window.addEventListener('hashchange', () => { const next = location.hash.slice(1); if (['dashboard', 'jobs', 'candidates', 'review'].includes(next) && next !== currentView) { currentView = next; render(); } });
document.addEventListener('keydown', (event) => {
  const dialog = document.querySelector('#dialog-root [role="dialog"]'); if (!dialog) return;
  if (event.key === 'Escape') { event.preventDefault(); dismissOverlay(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
render();
