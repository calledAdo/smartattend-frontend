> llmtimeline · cross-agent work record. state.md is the live snapshot — rewrite it in place. sessions/ is append-only history — never edit past files. Any agent: read this file and the newest sessions/ entries before starting.

# Project State — updated 2026-10-06T17:18:59Z by Codex (session 013)

## Goal
Build a responsive SmartAttend frontend for lecturers and students, with a testable demo and a separate live API mode.

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
- [x] Publish the frontend source and backend handoff to the user's GitHub account.
- [x] Make the frontend GitHub repository public as explicitly requested.
- [x] Deploy the frontend to Vercel and verify public routes and assets.
- [x] Make camera face enrollment and check-in matching testable in the browser-local demo without persisting biometric templates.
- [!] Enable live face enrollment: backend must bind enrollment to the bearer JWT and provide authoritative user state through `/api/auth/me`.

## Summary
The Vite/React/TypeScript frontend is public at `https://github.com/calledAdo/smartattend-frontend` and deployed at `https://smartattend-frontend-jade.vercel.app`. Vercel is connected to GitHub `main`. Session 013 added browser-local face matching: camera enrollment and check-in generate 128-value descriptors, compare them at the backend's cosine threshold, and keep the enrolled template in memory only. A separate demo capture remains explicitly simulated. The backend is still at `f8ceb46`; live enrollment remains blocked by its public username-based endpoint and missing `/api/auth/me`.

## Next
Publish session 013 changes to GitHub and confirm the connected Vercel deployment. Ask the backend engineer for a JWT-bound face enrollment route and `/api/auth/me` before enabling live enrollment. Test camera matching with a real person and a second person on a device with camera access.

## Notes
The backend source's README is stale relative to controllers. `AuthController` places username in JWT but check-in looks up principal as email; location coordinates are parsed but not geofenced; routes accepting numeric IDs lack ownership checks. Browser-generated descriptors are forgeable and do not prove liveness. Demo passwords are not checked or stored, and demo location/photo shortcuts bypass physical verification. Browser screenshot blocking and reliable device fingerprinting cannot be guaranteed by a web frontend. Background web push requires service worker and backend push subscription support. The local dev server is http://127.0.0.1:5178/. An npm audit previously found old Node-fetch advisories through face-api.js and pre-existing jsPDF advisories; no dependency upgrade was part of this endpoint task.
