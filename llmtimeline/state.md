> llmtimeline · cross-agent work record. state.md is the live snapshot — rewrite it in place. sessions/ is append-only history — never edit past files. Any agent: read this file and the newest sessions/ entries before starting.

# Project State — updated 2026-10-06T16:40:00Z by Codex (session 010)

## Goal
Build a responsive SmartAttend frontend for lecturers and students, using a mock data layer until backend endpoints are available.

## Tasks
- [x] Draft the frontend implementation plan and identify backend contract decisions.
- [x] Build the responsive mock-backed SmartAttend UI and core flows.
- [x] Verify build and key desktop/mobile flows in a browser.
- [x] Assess the provided auth-service API against the frontend and document integration blockers.
- [x] Recheck deployed CORS for both local frontend origins.
- [x] Implement verified onboarding, CSV roster matching, supporting lecturer access, and course detail in the mock frontend.
- [x] Verify the revised flows and document the backend API contract.
- [x] Turn BACKEND_INTEGRATION.md into a complete sendable backend implementation request.
- [x] Integrate the agreed API routes into a separate live frontend mode while preserving the demo.
- [!] Verify end-to-end requests against the deployed backend: the Render origin timed out on read-only probes.
- [x] Align live mode with the engineer's deployable routes, including browser facial embeddings and no PDF/manual-end calls.
- [x] Align live authentication and email verification with the current repository source; document remaining backend blockers.
- [~] Publish the frontend source and backend handoff to the user's GitHub account.

## Summary
The Vite/React/TypeScript frontend starts in live API mode against the previous Render origin and keeps a separate local demo. Session 009 aligned auth, course, and session request shapes with backend source commit `f8ceb46`; `BACKEND_API_STATUS.md` documents the missing routes and security fixes. The build passed and the dev server responded at `http://127.0.0.1:5176/`. Session 010 is preparing the first Git commit for GitHub. This directory had no `.git`; GitHub CLI reports an invalid token for account `calledAdo`.

## Next
Initialize and commit the frontend repository, restore GitHub authentication for `calledAdo`, create the frontend GitHub repository, and push. Then send its URL and `BACKEND_API_STATUS.md` to the backend engineer.

## Notes
The backend source's README is stale relative to controllers. `AuthController` places username in JWT but check-in looks up principal as email; location coordinates are parsed but not geofenced; routes accepting numeric IDs lack ownership checks. Browser-generated descriptors are forgeable and do not prove liveness. Demo passwords are not checked or stored, and demo location/photo shortcuts bypass physical verification. Browser screenshot blocking and reliable device fingerprinting cannot be guaranteed by a web frontend. Background web push requires service worker and backend push subscription support. The local dev server is http://127.0.0.1:5176/. An npm audit previously found old Node-fetch advisories through face-api.js and pre-existing jsPDF advisories; no dependency upgrade was part of this endpoint task.
