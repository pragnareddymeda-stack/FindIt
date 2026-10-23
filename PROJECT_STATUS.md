# FindIt: Project Status

**Overall: all eight phases are written. Nothing has been run end to end.** The code was produced in an environment with no network
access (so no `npm install`) and no MongoDB. Treat every "written" below as "code exists", not "works". Run the checks in
"What you need to do" and fix what they reveal.

## Phases
| # | Phase | State |
|---|---|---|
| 1 | Foundation (Express, Vite/React, health endpoint, env validation) | written, not run |
| 2 | Authentication (JWT cookie, CSRF, roles, admin script) | written, not run |
| 3 | Item reports (CRUD, search, filters, pagination, privacy) | written, not run |
| 4 | Matching and claims | written, not run (matching formula itself was executed, see below) |
| 5 | Handover and disputes | written, not run |
| 6 | Messaging, notifications, Socket.IO | written, not run |
| 7 | Admin (dashboard, moderation, users, abuse reports, disputes, audit logs) | written, not run |
| 8 | Final pass: dashboard page, safety page, photo upload, single-origin deployment, rate limit, seed data, docs | written, not run |

## What was actually checked (and what that does and does not prove)
Done in this environment, with real output:
- `node --check` on every server file.
- A TypeScript-parser syntax check of all 160 source and test files: **0 syntax errors**.
- A custom static check over the same 160 files: every relative import resolves, every named import exists as an export, every package
  imported is declared in the right `package.json`, and no undefined identifiers or redeclarations were found.
  I confirmed the checker works by feeding it a deliberately broken file, which it flagged on all four counts.
- The two dependency-free modules were executed directly: the matching formula (`server/src/services/matching.js`: identical reports score 1.0,
  different category 0.65, 7 days apart gives date score 0.5, weak candidates filtered) and the image-type detector
  (`server/src/utils/imageType.js`: PNG and WebP recognised, SVG and text rejected).

**Not done** (could not be, here): `npm install`, any test run, the client production build, starting the server, connecting to MongoDB,
a WebSocket connection, a real Cloudinary upload, a browser. Static checks cannot find logic errors, wrong assumptions about library behaviour,
or test expectations that are subtly off. Expect some failures on the first real run.

## Tests that exist (written, not executed)
About 290 test cases across 20 files: `server/tests` (11 files: health and config, auth, items, matching, claims, handovers,
messaging, sockets, admin, images, static serving) and `client/tests` (9 files: app shell, auth forms and guards, reports and browse,
claims and match suggestions, handovers, messaging and notifications, admin, photos, dashboard and safety page).
Counts come from counting test definitions, not from running them.

## What you need to do
1. `npm install && npm run install:all`
2. `cp server/.env.example server/.env`; set `MONGODB_URI`, `JWT_SECRET` (32+ chars), `CLIENT_URL=http://localhost:5173`
3. `npm run test:server` (first run downloads a MongoDB binary) then `npm run test:client` then `npm run build`.
   Fix failures (paste them to me and I will help). Record the real results here.
4. `npm run dev`, then follow [TESTING_GUIDE.md](TESTING_GUIDE.md) in a browser.
5. Optional: Cloudinary credentials for photos; MongoDB Atlas; deployment (README > Production build and deployment).

Results log (fill in; do not guess):
- [ ] install
- [ ] server tests: ___ passed / ___ failed
- [ ] client tests: ___ passed / ___ failed
- [ ] production build
- [ ] manual walkthrough

## Features by acceptance criterion (all written, none verified by running)
1. Register and log in: Register, Login pages, `/auth/*`
2. Lost report / 3. Found report: `/report/lost`, `/report/found`, `/items`
4. Browse, search, filter: `/items` page and API
5. Rule-based matches: `/items/:id/matches`
6. Ownership claim: `/items/:id/claim`
7. Review and decide with permissions: `/incoming-claims`, `/claims/:id`
8. Private verification data protected: explicit serializer whitelists, role-specific claim views, tests for each leak path
9. Handover: `/handovers/:id`
10. Dashboard: `/dashboard` (reports, claims, claims to review, handovers, unread notifications)
Plus: messaging, notifications, admin moderation and analytics, safety guidelines, optional photos.

## Known gaps and decisions
- **Photo upload** works only with Cloudinary credentials and was tested only against a mock. Without credentials the field is hidden and the endpoint answers 503.
- **No transactions** (they need a replica set): each change is a conditional update ordered to leave a retryable state. A crash between two writes could leave, for example, a completed handover whose report is still ACTIVE.
- **Not built:** email or SMS delivery, password reset, email verification, two-factor login, end-to-end browser tests.
- The chat page sends over REST; the socket `message:send` event exists and is tested on the server but the UI does not use it.
- Admins can read and decide claims (as the brief allows) and every such read is audited; they cannot read private conversations.
- Cross-site cookie deployments (frontend and API on unrelated domains) are fragile in modern browsers; single-origin deployment is the recommended path.
- Not deployed. Nothing in this repository claims otherwise.
