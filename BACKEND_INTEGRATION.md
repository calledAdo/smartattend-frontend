# SmartAttend backend implementation request

> This is the original proposed contract. For the current repository routes and the shortest backend change list, see [BACKEND_API_STATUS.md](BACKEND_API_STATUS.md).

**For:** Backend engineer  
**Status:** Proposed contract; frontend live adapter now targets the agreed routes, but deployed behavior is unverified  
**Frontend:** React SPA with separate live API and browser-local demo modes  
**Reference:** The supplied auth-service repository was reviewed at commit `7e67b1001f5fedd9e58857e0897c46eafc9bf116` on 2026-10-06. Its deployed revision was not confirmed.

Please review the behavior and payloads below, reply with any changes, and provide an OpenAPI specification (or equivalent request/response examples) for the final URLs. Paths here are logical public API paths; the backend may route them across services. The frontend can adapt to agreed names, but the identity, authorization, and data rules need to remain the same.

The frontend currently targets `https://real-time-attendance-auth-service.onrender.com` (or `VITE_API_BASE_URL`). The engineer's current deployment list includes register, verify-email, login, me, face/enroll, courses create/mine/detail, sessions start/active, and check-ins. The frontend sends parsed CSV rows as JSON and generates a face-api.js descriptor for enrollment and check-in. It sends `facialEmbedding` as a JSON string of exactly 128 finite numbers, matching the original backend's `double[]` parser. The check-in request is JSON with `{code,latitude,longitude,accuracyMeters,facialEmbedding}`. Please confirm these request shapes and response envelopes with examples. The deployment list does **not** include resend, manual session end, history, or PDF; live mode does not call those routes. Later sections describe proposed future capabilities, not currently deployed endpoints. Read-only probes of the Render origin timed out during the previous integration, so the deployed API has not passed an end-to-end check.

## 1. Product flow to support

1. The entry page offers **Student sign-up** and **Lecturer sign-up**. Both submit full name, email, and password. A student also submits a matric number. No account reaches a dashboard until its email is verified.
2. The confirmation email links to the SPA, for example `/auth/verify?token=...`. The SPA submits the token to the API. A verified lecturer enters the dashboard. A verified student completes face onboarding first, then enters the dashboard. Login must expose incomplete onboarding so a returning user resumes at the correct step.
3. A lecturer creates a course with code, title, semester, room, schedule, a CSV roster with `name,matricNo,email`, and optional supporting lecturer emails. The frontend parses and previews the CSV, then sends roster rows as JSON. The backend validates them again. CSV rows are course membership records; they do **not** create student accounts.
4. A verified student sees a course only when **both** the account email and matric number match a roster row. A verified supporting lecturer sees a course when the account email is listed on that course. A supporting email can be entered before that lecturer registers; access activates only after registration and verification.
5. A lecturer opens a course and starts a five-minute attendance session. The server generates the code, owns the start/expiry times and lecturer location, and snapshots the eligible roster. Students on that snapshot see the live session. Their UI moves through location, code, and face capture. Only a successful backend check-in returns `PRESENT`.
6. Ending or expiring the session closes check-in. The report lists every snapshot roster row as `PRESENT` or `ABSENT`. Later roster edits must not change an earlier session's report.

There is **no student course search or self-enrollment** in this agreed flow.

## 2. Contract conventions

- Treat the authenticated token subject as the user identity. Do not accept `username`, `studentId`, `lecturerId`, email, or role in a check-in request as authority to act for that person.
- Use stable opaque IDs for users, courses, and sessions. Use UTC ISO 8601 timestamps and return server `startedAt` and `expiresAt`; the browser countdown is display only.
- Use one documented error shape, for example `{ "code": "SESSION_EXPIRED", "message": "Attendance has ended", "details": {} }`. The frontend should branch on `code`, not message text. Include validation errors by field/CSV row.
- Return `401` for missing/invalid authentication, `403` for authenticated users lacking access, `409` for duplicate/conflicting state, `410` for expired sessions, `422` for invalid input or failed attendance checks, and `429` for rate limits. Confirm any different mapping in the API specification.
- For the initial integration, retain the existing bearer JWT approach if that is the backend's choice, but specify token expiry, refresh/re-login behavior, and `GET /api/auth/me`. Never put a JWT in an email URL. If using cookies instead, specify SameSite/CSRF/CORS behavior.
- Expose only the fields needed by each role. A student session response/event must never contain the lecturer's attendance code, exact lecturer coordinates, another student's face data, or the full roster.
- The API must be authoritative. Client-side CSV parsing, route guards, GPS checks, timers, and check-in steps are guidance and cannot grant access or record attendance.

## 3. Authentication and onboarding endpoints

| Method and proposed path | Request | Required response/behavior |
| --- | --- | --- |
| `POST /api/auth/register` | JSON: `{fullName,email,password,role,matricNo?}` | `201` with `{userId,email,role,emailVerified:false,nextStep:"VERIFY_EMAIL"}`; send verification email. `matricNo` is required only for students. No dashboard access yet. |
| `POST /api/auth/verify-email` | JSON: `{token}` from the SPA confirmation page | Consume a single-use, expiring token; return verified user state and an authorized onboarding/login session or state the required next login step. Student `nextStep:"ENROLL_FACE"`; lecturer `nextStep:"DASHBOARD"`. |
| `POST /api/auth/resend-verification` | JSON: `{email}` | Generic response to avoid account enumeration; replace/expire prior token and enforce cooldown/rate limit. |
| `POST /api/auth/login` | JSON: `{email,password}` | Token/session plus `{id,fullName,email,role,matricNo?,emailVerified,faceEnrolled,nextStep}`. Block dashboard privileges for unverified accounts. |
| `GET /api/auth/me` | Authenticated | Return the same authoritative user/onboarding state after refresh or deep link. |
| `POST /api/face/challenges` | Authenticated; JSON with `purpose` of `ENROLL` or `CHECK_IN` and optional `sessionId` | If active liveness is chosen, return a short-lived `challengeId`, instructions, and `expiresAt`. Bind a check-in challenge to its session and user. Confirm the exact media contract before implementation. |
| `POST /api/auth/face/enroll` | Authenticated student; JSON `{facialEmbedding:"[...128 numbers...]"}` in this phase | Validate the descriptor and bind the template to the JWT subject. Return `faceEnrolled:true` or a stable retry/error code. Client vectors do not establish liveness. |
| `POST /api/auth/refresh` or equivalent | If refresh tokens are used | Document expiry, rotation, logout, and failure behavior. Otherwise confirm that expiry requires login. |

The frontend asks users for **email**, not a separate username. The current register DTO requires `username`; please either generate it server-side or specify a stable derivation. Confirm permitted student/staff email domains and how a `LECTURER` role is approved. Public callers must not be able to assign themselves `ADMIN`, and lecturer self-registration should follow a documented approval/invite or institutional-email policy.

An email provider is reported working. Please confirm a real registration and resend reach a test mailbox, and return a clear state when email delivery fails. The frontend needs no email credentials.

## 4. Course and roster endpoints

| Method and proposed path | Required behavior |
| --- | --- |
| `POST /api/courses` | Authenticated verified lecturer creates a course. Validate the complete roster and supporting emails transactionally; return `201` with course ID and counts or row-level errors without creating a partial course. |
| `GET /api/courses/mine` | Derive the list from the JWT user. Lecturer: courses created by them or listing their verified supporting email. Student: courses with a roster row matching verified email **and** matric number. Return only role-appropriate fields. |
| `GET /api/courses/{courseId}` | Lecturer/authorized supporting lecturer gets course details, roster, and supporting emails. Student gets only non-sensitive course details when eligible. Otherwise `403` or `404`. |
| `GET /api/courses/{courseId}/students` | Authorized lecturers only; roster rows and account/verification status if available. No biometric data. This can be included in the lecturer course-detail response instead. |

Proposed `POST /api/courses` JSON body:

```json
{
  "code": "CSC 410",
  "title": "Software Engineering",
  "semester": "First semester 2026/27",
  "room": "LT 112",
  "schedule": "Monday at 9 AM",
  "roster": [
    {"name": "Amara Okafor", "matricNo": "CSC/2023/0421", "email": "amara@smartattend.demo"}
  ],
  "supportingLecturerEmails": ["ada@university.edu"]
}
```

Normalize emails case-insensitively and apply the same documented normalization to matric numbers in registration and roster matching. Reject empty rows, malformed emails, and duplicate email or matric numbers **within a course**. Agree on course-offering uniqueness (for example, code plus semester, adding a section key if needed) and return a conflict for duplicates. A student can appear on several courses. A roster row may exist before its student account; it becomes visible only after the matching account is verified and face onboarding is complete.

Please specify how authorized lecturers can correct a roster or supporting email after creation. A replacement/import endpoint is acceptable, but changes must apply only to future sessions. The session roster snapshot is immutable.

## 5. Attendance session and check-in endpoints

| Method and proposed path | Required behavior |
| --- | --- |
| `POST /api/courses/{courseId}/sessions` | Authorized course lecturer sends `{latitude,longitude,accuracyMeters}`. Server validates coordinates, captures them, snapshots the roster, creates a five-minute session, and returns `{id,courseId,status,startedAt,expiresAt,code,rosterCount,presentCount}`. The code is lecturer-only. Reject a second active session for the same course with `409`. |
| `GET /api/sessions/active` | Return only active sessions relevant to the authenticated user. Student projection omits code and exact lecturer coordinates; lecturer projection may include them. |
| `GET /api/sessions/{sessionId}` | Return current status, expiry and counts to an authorized user, with role-specific fields. Supports refresh and reconnect. |
| `POST /api/sessions/{sessionId}/location-check` | Authenticated eligible student submits `{latitude,longitude,accuracyMeters}`; server checks distance/accuracy/expiry and returns pass or `OUT_OF_RANGE`. This is a UX precheck; final submission must repeat validation. |
| `POST /api/sessions/{sessionId}/code-check` | Authenticated eligible student submits `{code}`; server validates code/expiry, rate limits attempts, and returns pass or `INVALID_CODE`. This is a UX precheck; final submission must repeat validation. |
| `POST /api/sessions/{sessionId}/check-ins` | Authenticated student sends JSON `{code,latitude,longitude,accuracyMeters,facialEmbedding}`. In one authoritative operation, verify roster snapshot, session time, geofence, code, face match and duplicate state; then persist attendance and return `{sessionId,status:"PRESENT",checkedInAt}`. Do not accept a caller-supplied student identity. This phase does not establish liveness. |
| `POST /api/sessions/{sessionId}/end` | Authorized course lecturer ends the session; return final status and `endedAt`. Repeated calls should be harmless or return a documented conflict. |

The UI currently uses a fixed five-minute countdown and a six-digit code; please confirm these as server policy. Define geofence radius, treatment of inaccurate indoor GPS, and clock tolerance. Browser geolocation can be spoofed, so it is one signal, not proof of physical presence. If a device-reuse rule is required, specify a server-issued session/device mechanism and its limits; browser fingerprinting is not a reliable unique-device guarantee.

Use a unique `(sessionId, studentId)` attendance constraint. A second attempt should return the original result or `ALREADY_CHECKED_IN`, never create another record. Two courses on the same day must not block each other. The final endpoint must recheck every condition even when the two precheck endpoints previously passed.

## 6. Live updates, history, and reports

| Method and proposed path | Required behavior |
| --- | --- |
| `GET /api/events` (SSE) or documented WebSocket | Authenticated events for relevant users: `session_started`, `check_in_recorded` (lecturer count/feed only), `session_ended`, and optionally `report_ready`. Include stable IDs, event IDs/reconnect behavior, and no student-facing code. A polling fallback through `GET /api/sessions/active` and session detail is acceptable first. |
| `GET /api/attendance/me` | Student's per-course records and summary. Include PRESENT and ABSENT outcomes for completed session snapshots, plus session/course IDs and times. |
| `GET /api/courses/{courseId}/sessions` | Authorized lecturer session history, counts, dates, status, and report availability. Define pagination/date filtering if needed. |
| `GET /api/reports/sessions/{sessionId}/pdf` | Authorized lecturer downloads a PDF showing session/course metadata and every snapshot roster row as PRESENT or ABSENT. Return a PDF response or a short-lived authorized URL. |

Foreground in-app alerts can use SSE/WebSocket or polling. **Background push** requires a service worker, browser permission, subscription endpoint and push delivery service; please treat that as a separately agreed delivery phase. Do not claim browser push works from a foreground socket alone.

## 7. Face-processing decision and security requirements

**Current integration:** The browser captures a JPEG, then uses the self-hosted `face-api.js` tiny face detector, 68-point landmark model, and face recognition model to produce a 128-value descriptor. It rejects zero or multiple detected faces. Enrollment and check-in run through the same `src/face.ts` function and model files, and send only the JSON-stringified descriptor to their protected endpoints. The backend must validate the array length and finite values, bind it to the JWT subject, protect stored templates, calibrate its similarity threshold, and enforce all check-in authorization, location, code, expiry, and duplicate rules.

This is **face matching, not liveness**. A client-supplied descriptor can be forged or replayed, even when a camera UI is shown. Do not describe this release as an anti-proxy security guarantee. For real campus deployment, move capture processing and liveness verification behind a server-controlled challenge or trusted provider. Enrollment and check-in must then use the same versioned model and preprocessing; define challenge TTL, media retention, retry policy, and stable error codes. The old public `/api/auth/onboard-face` and `/api/attendance/verify-face` endpoints must not be used as a substitute for the protected routes above.

## 8. Existing auth-service changes needed

The reviewed repository currently exposes `POST /api/auth/register`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification?email=`, `POST /api/auth/login`, `POST /api/auth/onboard-face`, and `POST /api/attendance/verify-face`. Its README differs from source for the verification method and login's `redirectUrl` field; please publish one accurate contract.

Before integration, please address these observed gaps:

1. Login currently does not enforce `isEmailVerified`; registration accepts caller-selected privileged roles. Enforce verification and a lecturer approval policy on the server.
2. Face onboarding is public and trusts a supplied `username`. Protect it and bind enrollment to the authenticated account.
3. Face attendance trusts a supplied `username` and `courseCode`; it has no session ID, roster authorization, GPS, code, expiry, or liveness check. Replace it with session-bound check-in.
4. Duplicate attendance is currently checked by matric number and date. Use session plus student identity.
5. The current API has no course, live-session, event, history, or report contract. The auth-service repository may remain one service, but we need the public URLs and shared authentication contract for all services.
6. Email verification currently has no observed expiry/resend throttling; define both. The deployed API reportedly sends email now, so confirm this with one end-to-end test rather than changing providers solely for this request.

Local CORS preflight was confirmed on 2026-10-06 for `http://127.0.0.1:5173` and `http://localhost:5173`. The current Vite demo may use `http://127.0.0.1:5174` when 5173 is occupied; add the agreed local and production origins. Permit the actual auth/content headers and methods; if cookies are used, configure credentials with explicit origins.

## 9. Decisions to confirm before endpoint implementation

Please reply with the chosen answer to each item. These choices affect payloads and frontend routing:

1. **Identity:** Allowed student/staff email domains, whether a verified staff domain or invite grants lecturer access immediately, server-generated username, and whether matric numbers can be corrected after verification. If manual lecturer approval is required, tell us so the UI can add a pending-approval state.
2. **Email/session:** Link token versus typed code, token TTL/single-use behavior, resend cooldown, what verification returns, JWT versus cookie, refresh/logout behavior, and the authoritative `/me` payload.
3. **Face:** Who runs the server-side model, exact capture media and size, liveness method/challenge, embedding/model version, threshold calibration, retention, and retry/error codes. If liveness is deferred, confirm staging-only labeling.
4. **Courses:** JSON roster rows as above, course code uniqueness by semester, roster correction endpoint, and whether supporting lecturers may create/end sessions and download reports (recommended: yes).
5. **Attendance:** Five-minute duration, six-digit code and any rotation, geofence radius/accuracy policy, one-active-session rule, and final check-in idempotency.
6. **Delivery:** Public base URL(s), shared JWT validation across services, SSE/WebSocket or initial polling, event authentication method (native `EventSource` cannot set a bearer header), production CORS origin, and whether background push is in this release.

## 10. Delivery and acceptance

Please deliver the contracts in this order so frontend integration can proceed without waiting for the whole backend:

1. **Auth vertical slice:** Register student/lecturer, receive and confirm email, login/`me`, protected face enrollment, and return onboarding status. Supply a test lecturer and student plus one unverified account.
2. **Course vertical slice:** Create from the sample roster in `public/sample-roster.csv`; verify that the matching student sees it without enrolling, an unmatched student does not, and a verified supporting lecturer can open it.
3. **Session/check-in vertical slice:** Start from course detail, retrieve role-filtered session data, pass/fail location and code, submit a live face capture, reject duplicate/expired/unrostered requests, and preserve the roster snapshot.
4. **Reports/live slice:** Return student history and lecturer PDF with absent rows, then live event delivery (or documented polling fallback).

For each slice, provide base URL, exact request/response examples, auth requirements, stable error codes, and a small set of test fixtures or automated integration tests. Include at least one negative case per authorization boundary. The frontend will replace mock operations in `src/data.tsx` after each slice is demonstrably working; it will continue to label mock-only behavior until then.
