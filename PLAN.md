# SmartAttend frontend plan

Implementation status: a responsive demo now exists. It uses a focused React Context and browser-local mock store in `src/data.tsx`, plus custom CSS for the interface. TanStack Query, Tailwind, and MSW remain options for the API integration stage; they are not dependencies of the current demo.

## Goal and working assumptions

Build a responsive, role-based SPA for lecturers to manage rostered courses and attendance sessions, and for students to view assigned courses, check in, and review attendance. The frontend is developed against browser-local mock data until backend endpoints are ready. The backend remains the authority for identity, location eligibility, attendance codes, session expiry, device restrictions, face matching, and attendance status.

Initial assumptions to validate with the backend team:

- A student sees a course when the verified account email and matric number match a lecturer-uploaded CSV roster row. CSV rows do not create accounts. Supporting lecturers see a course when their verified email is included on it.
- A lecturer can run one active attendance session per course at a time.
- A session has a server-provided `startsAt` and `expiresAt`; the displayed countdown is derived from `expiresAt`, never owned by the browser.
- The attendance code is shown to the lecturer and entered by students. It is never included in student notifications or student-facing session data.
- The frontend currently captures photos only. The final face embedding/liveness contract must be agreed with the backend; the existing auth service expects a 128-value embedding string.

## Recommended stack

- Vite + React + TypeScript: suits the specified SPA and keeps the initial build simple.
- React Router for protected routes, role redirects, and deep links to active sessions.
- Tailwind CSS and Lucide React for a responsive, consistent interface.
- TanStack Query for API requests, cache invalidation, polling/fallback refresh, and loading/error states.
- React Context for the small amount of client-wide auth state; local component state for check-in steps. Add a wider state library only if cross-page state becomes complex.
- A typed API client with environment-based base URL and Mock Service Worker (MSW) handlers. Screens use the same client in mock and real modes.

Suggested structure: `src/app` (router/providers), `src/features/auth`, `courses`, `sessions`, `check-in`, `reports`, `src/shared/api`, `components`, `types`, and `mocks`. Keep request/response mapping inside the API layer so backend changes do not spread into screens.

## Routes and screen behavior

| Route | Main behavior |
| --- | --- |
| `/` | Redirect to role-choice entry or the authenticated user's next step. |
| `/welcome` | Choose student or lecturer registration. |
| `/auth/login` | Email/password form; show validation and server errors; redirect by returned role. |
| `/auth/register` | Role-specific account form; student form also asks for matric number. |
| `/auth/verify` | Email confirmation, with a local demo inbox until delivery is connected. |
| `/auth/face` | Student-only face setup after email verification. |
| `/lecturer/dashboard` | Course list, course metrics, add-course dialog, and entry to attendance controls. |
| `/lecturer/course/:courseId` | Roster and lecturer access, then start attendance. |
| `/lecturer/session/active/:sessionId` | Course/session context, authoritative countdown, code, check-in count/feed, and end confirmation. A new session navigates here after creation. |
| `/lecturer/reports` | Session history, date/course filters, status, and PDF download. |
| `/student/dashboard` | Roster-assigned courses and live session alert. |
| `/student/check-in/:sessionId` | Location, code, camera, and result steps with deadline and recovery states. |
| `/student/history` | Overall and per-course attendance counts/percentages with session details. |

Route guards enforce the role in the UI; backend authorization must enforce it for every request. Deep links reload their data from the API, including after a refresh. Add an accessible not-found page and an expired-session result page/state.

## Core interaction flows

1. **Authentication and onboarding:** validate role-specific fields, create an unverified account, confirm ownership through an email link, then take the student to face setup. A lecturer skips the face step. Only a fully onboarded user reaches a dashboard.
2. **Courses:** lecturer uploads a validated CSV roster and supporting lecturer emails while creating a course. Verified identity matching determines lecturer and student course lists. Students do not self-enroll in this flow.
3. **Lecturer live session:** choose a course, start a session, then display server session ID, code, expiry, present count, and check-in feed. Subscribe to live events; on disconnect, refetch the session and use a modest polling fallback. On manual end or expiry, refetch final state and link to the report when generated.
4. **Student check-in:** open an active session from an in-app event or dashboard; request location and submit coordinates for server validation; enter the code for server validation; capture a live face image and submit it through the agreed upload format. Show a definitive result only after the backend confirms `PRESENT`. Preserve the completed gates only as long as the backend says they remain valid.
5. **History and reports:** fetch the lecturer's sessions and student's attendance records from the backend. Download PDFs as an authenticated response or short-lived signed URL according to the final contract.

For each hardware step, provide permission-denied, unavailable, timeout, retry, and session-expired states. Require HTTPS or localhost for camera and geolocation. Stop camera tracks when leaving the screen and avoid persisting face images, coordinates, or codes in local storage or analytics.

## Delivery phases and acceptance criteria

| Phase | Deliverable | Done when |
| --- | --- | --- |
| 1. Foundation | App shell, responsive layouts, theme, routing, auth state, API client, mock handlers | Lecturer and student can navigate their own mocked routes on desktop/mobile; refresh and unauthorized redirects work. |
| 2. Onboarding and courses | Role-specific registration, email confirmation, student face setup, lecturer CSV roster course creation | Forms handle valid, invalid, duplicate, denied-camera, loading, and server-error cases. |
| 3. Live attendance | Lecturer create/end session, timer/code/feed, student live alert | Start, live updates, reconnect, manual end, and expiry behave correctly with mocked server times/events. |
| 4. Check-in | Location, code, face capture, submission, result | Student completes a mock success path and can recover from denied permissions, invalid code, out-of-range, failed face match, and expiry. |
| 5. Reporting and integration | History, filters, PDF download, real API wiring, and push notification support | All role flows work against the backend; authenticated PDF download works; with notification permission and backend push support, enrolled students receive a background session alert that opens the correct check-in route. |
| 6. Release QA | Responsive/accessibility pass and browser/device checks | Core flows pass on desktop and a real mobile browser; keyboard navigation, labels, camera lifecycle, refresh, and intermittent network states are checked. |

The first useful demo is phases 1-4 running entirely on mocks. Backend integration can happen endpoint by endpoint without rebuilding screens.

## Proposed backend contract to agree on

These are capabilities and example resources, not assumptions that the final URLs are fixed.

| Capability | Minimum request/response agreement |
| --- | --- |
| Auth | Register/login/logout or refresh/current-user; full name, email, student matric number, role, email-verified and face-enrolled states, token/cookie policy, expiry, and error codes. Email confirmation precedes student face onboarding. |
| Courses | Lecturer course create/list/detail with CSV roster rows and supporting lecturer emails; authorized student course list from JWT identity plus roster match; IDs, code/title, semester, room/schedule, roster validation and duplicate policy. |
| Sessions | Start for course, get active/by ID, end, list history; ID, course ID, status, code only in lecturer response, `startsAt`, `expiresAt`, counts, and report status. |
| Live events | SSE/WebSocket endpoint, auth method, event names/payloads for `session_started`, `check_in_recorded`, `session_ended`, and report readiness; reconnection semantics. |
| Check-in | Location validation; code/device validation; final face submission; session ID, temporary gate token(s) or equivalent, structured failure codes, and idempotent final submission. |
| Reporting | Student record/summary, lecturer session list, report generation status, and authenticated PDF download or signed URL. |

Prefer a shared error shape such as `{ code, message, details? }`. The frontend should branch on stable codes such as `SESSION_EXPIRED`, `OUT_OF_RANGE`, `INVALID_CODE`, `DEVICE_RESTRICTED`, `FACE_MISMATCH`, `ALREADY_CHECKED_IN`, and `PERMISSION_DENIED`, rather than parsing message text. Define timestamp format, server clock offset handling, pagination, and whether an active session can be resumed after reload.

## Decisions needed before final integration

1. **Authentication:** JWT in a bearer header or secure HttpOnly cookies? What are refresh and logout semantics? Prefer HttpOnly cookies when architecture permits.
2. **Registration:** accepted university email domains, whether the backend generates a username from email, email-link expiry/resend policy, image or embedding format/size, and how login exposes incomplete onboarding.
3. **Courses:** semester model, code uniqueness, CSV upload versus parsed JSON, roster edits, and supporting lecturer permissions.
4. **Session policy:** exact duration (3 or 5 minutes, configurable?), code length/rotation, radius, one-active-session rule, and whether the lecturer can restart or extend a session.
5. **Check-in gates:** separate verification endpoints versus one final submission, whether gate tokens expire, acceptable GPS accuracy, retry limits, and duplicate submission response.
6. **Real-time delivery:** SSE or WebSocket for foreground updates; web push needs a service worker, notification permission, push subscription endpoint, and backend support. Build the in-app alert first, then add background push during integration. Define behavior for unsupported browsers and denied notification permission.
7. **Reports:** PDF generation timing, pending/failed statuses, filter behavior, and authorization for downloading a report.

## Web platform constraints

- The browser cannot reliably block screenshots or screen recording. Treat that as a product/security limitation, not an interface feature.
- Browser device fingerprinting is not a dependable single-device guarantee. The backend needs an explicit device/session policy and should document its limits.
- Client-side geofencing and face checks cannot establish attendance. They only guide the user; backend results determine progression and final status.
- GPS accuracy varies indoors. The backend should define an accuracy threshold and a clear error/retry policy to avoid rejecting legitimate students without explanation.
