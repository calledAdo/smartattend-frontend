# SmartAttend backend integration status

The paired frontend and backend changes are implemented locally in this workspace. The backend clone is `backend-service/` on branch `codex/live-integration`, based on the engineer's repository at `3ed3daa`. The public Render API and Vercel frontend have **not** been updated with these changes.

## Tested API contract

All protected routes require `Authorization: Bearer <jwt>`. The server derives the acting user from the JWT subject; numeric IDs and usernames supplied by the browser do not authorize actions.

| Flow | Route | Notes |
| --- | --- | --- |
| Register and verify | `POST /api/auth/register`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification?email=...` | Six-digit verification code. Student email must use `@student.oauife.edu.ng`. |
| Login and profile | `POST /api/auth/login`, `GET /api/auth/me` | Unverified accounts cannot log in. `/me` returns role, ID, email, matric number and face enrollment state. |
| Student face enrollment | `POST /api/auth/onboard-face` | Requires verified student JWT. Body is `{facialEmbedding:"[128 finite numbers]"}`. |
| Course setup | `POST /api/courses`, `POST /api/courses/{courseCode}/roster-upload`, `POST /api/courses/{courseCode}/confirm-roster` | Creator or supporting lecturer manages the draft. CSV headers are `name,matricNo,email`. Reupload replaces staged rows. |
| Course discovery | `GET /api/courses/mine`, `GET /api/courses/{courseId}` | Student assignment requires matching verified email and matric number. Student projection hides roster and supporting lecturer emails. |
| Attendance | `POST /api/attendance/sessions`, `GET /api/attendance/sessions/active`, `GET /api/attendance/sessions/{id}`, `POST /api/attendance/sessions/{id}/check-ins`, `POST /api/attendance/sessions/{id}/close` | Five-minute sessions; lecturer start requires GPS; student check-in validates roster, code, location within 100 m, and descriptor match. Student session projection hides code, coordinates and roster. |
| History and reports | `GET /api/attendance/sessions/history`, `GET /api/attendance/sessions/{id}/records`, `GET /api/reports/sessions/{id}/pdf` | History is role filtered. Student history includes `myStatus` and `myCheckedInAt`. PDF requires course manager and lists all roster members as present or absent. |

## Verification

The React production build and eight backend unit tests pass. A local H2-backed HTTP run covered registration, code verification, login, roster upload/confirmation, student course lookup, face enrollment with a synthetic descriptor, session start, student projection, out-of-range rejection (400), successful check-in, duplicate rejection (409), closure, student history, PDF present/absent rows, and student PDF denial (403).

The local test did not exercise real camera capture, liveness, deployed email delivery, WebSocket push, or a PostgreSQL migration. Browser face descriptors and GPS can be spoofed; this release should be described as face matching and geofencing, not liveness assurance. Before pointing Vercel at the new backend, deploy the paired backend revision and check its PostgreSQL schema and CORS on the production origin.
