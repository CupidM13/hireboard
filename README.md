# Hireboard

Hireboard is a lightweight applicant tracking demo for a recruiter or small hiring team. It brings open roles, candidate stages, and recent activity into one simple workspace, with an explainable phrase comparison for candidate entered text.

> **Demo safety:** Hireboard uses synthetic sample data and is not production hiring software. Do not enter real candidate information. Candidate data and any text entered in Match review stay in this browser's local storage or page memory; there is no shared server or account system.

## Features

- Recruiting dashboard with open job, active candidate, interview, and offer counts.
- Job list with role details, requirements, and applicant totals. Create jobs in the browser.
- Candidate pipeline with search, role and stage filters, stage changes, and CSV export.
- Match review that displays listed phrases found and not found in entered text.
- Responsive layout, keyboard focus indicators, and synthetic starter records.

## Tech and structure

The app uses native HTML, CSS, and JavaScript modules with no runtime dependencies. A small Node.js static server serves the files. Domain rules are in `src/domain.js`, sample and local persistence in `src/data.js`, and screen composition and browser interactions in `src/app.js`.

## Run locally

Requires Node.js 20 or newer.

```sh
npm start
```

Open [http://localhost:4173](http://localhost:4173). To use another port, set `PORT` before starting, for example `PORT=8080 npm start`.

## Tests

Run the domain and CSV tests with:

```sh
npm test
```

The tests cover empty and partial matching, stage validation, candidate filtering, and CSV escaping.

## Sample data and persistence

The included roles, applicants, dates, names, and `.test` email addresses are fictional. The initial workspace is copied into browser storage on first use; job additions, stage changes, and activity persist in this browser under `hireboard-demo-v1`. Data is local to the browser profile and is not shared between users or devices. Use the browser's site data controls to clear it and restore the starter dataset.

## Match calculation and responsible use

The review compares each role's explicitly listed requirement phrase with the text entered by the user, ignoring letter case. A phrase is counted as found when it appears as a literal substring. Duplicate and blank requirements are removed. The displayed percentage is `found requirement phrases ÷ total listed requirement phrases × 100`, rounded to the nearest whole percent. If there are no requirements, no percentage is shown.

This simple phrase overlap is only a review aid. It does not infer equivalent terms, verify a skill, or evaluate a person's quality. A missing phrase is not evidence that a candidate lacks a skill. The score must not be used to rank, reject, or make hiring decisions. No protected or sensitive traits are used.

## Limitations

- This is a local, single-browser demo without authentication, shared storage, or a production database.
- Resume text is entered manually; there is no file upload or document parsing.
- The phrase check is literal and can miss synonyms or context.
- The app is not production HR software and has not been designed for handling real candidate data.

## Deployment

No live demo has been deployed yet. The static files can be hosted on a Node-compatible platform that supports `npm start`; set `PORT` if the host provides one. Add the verified URL here after deployment.

## Portfolio description

> I built Hireboard as a hands-on HR-tech portfolio project: a lightweight applicant-tracking demo with job and candidate pipeline management, plus an explainable resume-to-requirement phrase review. It gave me practical exposure to recruiting workflows and software design considerations. I have not worked professionally in HR tech.
