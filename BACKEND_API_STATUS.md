# SmartAttend API status and required backend changes

Reviewed the current `main` source of [Real-time-Attendance-Auth-service](https://github.com/christopher18-cyber/Real-time-Attendance-Auth-service) at commit `f8ceb46c2190abf58f0a66615be631840bcacd91` on 2026-10-06. The repository README still describes the older auth/face API; the controllers and services are the source for the routes below. Deployment parity has not been confirmed.

## Routes implemented in source

| Flow | Implemented route and request |
| --- | --- |
| Register | `POST /api/auth/register` JSON `{fullName,email,username,password,role,matricNo}`. The frontend currently uses the normalized email as `username`; students must use `@student.oauife.edu.ng`. |
| Verify email | `POST /api/auth/verify-email` JSON `{email,token}`. Email sends a six-digit code, not a clickable link. |
| Resend code | `POST /api/auth/resend-verification?email=...`; success is plain text. |
| Login | `POST /api/auth/login` JSON `{emailOrUsername,password}`; returns `{message,token,role,redirectUrl}`. |
| Create course | `POST /api/courses` JSON `{courseCode,title,semester,lecturerId}`; creates `DRAFT`. |
| Add roster | `POST /api/courses/{courseCode}/roster-upload` multipart `file` containing CSV headers `name,matricNo,email`, then `POST /api/courses/{courseCode}/confirm-roster`. |
| Student courses | `GET /api/courses/student/{studentId}`; returns active courses for a matching matric number. |
| Start session | `POST /api/attendance/sessions` JSON `{courseCode,lecturerId,durationMinutes}`; returns `id,courseCode,sessionCode,createdAt,expiresAt,status`. Code is six alphanumeric characters. Frontend requests five minutes. |
| Close session | `POST /api/attendance/sessions/{sessionId}/close`. |
| Session records | `GET /api/attendance/sessions/{sessionId}/records`. |
| Check in | `POST /api/attendance/sessions/{sessionId}/check-ins` with bearer JWT and JSON `{code,latitude,longitude,facialEmbedding}`. Face processing is deferred in our integration discussion but is still required by this backend method. |
| PDF | `GET /api/reports/sessions/{sessionId}/pdf` exists in source; confirm it is deployed and protected before enabling it in the UI. |

## Minimum changes for the agreed product flow

1. Add `GET /api/auth/me`, authenticated, returning `{id,fullName,email,username,role,matricNo,emailVerified,faceEnrolled}`. Login also needs `nextStep` or equivalent, and must reject unverified email server-side. Registration and verification alone cannot authorize dashboard entry.
2. Add `GET /api/courses/mine`, deriving the lecturer or student from the JWT. Lecturers need both created and supporting courses. Add `GET /api/courses/{courseId}` with role-appropriate roster projection. Current numeric `lecturerId` and `studentId` parameters cannot be safely supplied without `/me`, and must be checked against the JWT on every route.
3. Add `GET /api/attendance/sessions/active` (or a role-filtered session list/detail pair) so students discover their live session and lecturers recover one after refresh. Do not expose `sessionCode` to students. A session history route is needed for reports.
4. Fix JWT identity: `AuthController` puts `username` in the JWT subject, but `AttendanceService.verifyAndRecordAttendanceById` calls `findByEmail(principal.getName())`. Choose one identifier consistently. Check-in will fail for normal accounts until this is fixed.
5. Enforce ownership and roles server-side for course creation, roster upload/confirmation, session start/close/records, access requests, and PDF download. The current controllers accept caller-supplied IDs, and `SecurityConfig` only requires a valid token for these routes. Derive the acting user from the JWT and authorize against the course/session.
6. Add supporting lecturer emails to course creation or a separate authorized assignment route. The frontend's agreed supporting-lecturer flow cannot be saved by the current API.
7. Decide the live face policy. The current check-in requires an enrolled embedding and a live embedding. If face work is deferred, provide a staging-only feature flag or a separate test environment that can check in without it. Do not make the production endpoint silently bypass face verification.
8. Implement actual geofencing if location is part of the attendance guarantee. The current method parses `latitude` and `longitude` but never compares them with a lecturer location; session start stores no lecturer coordinates.
9. Confirm the deployed revision, base URL, and CORS allowlist. Add the production frontend origin `https://smartattend-frontend-jade.vercel.app` to the backend's allowed origins. Source allows only `localhost:5173` and `127.0.0.1:5173`; local Vite currently runs on 5176. The Vite proxy avoids CORS during local development, but production browser requests go directly to the Render API.

## Contract decisions to send back

Please provide example JSON for `/me`, a lecturer course list, an active session as lecturer and student, and session records; state which routes are deployed. Confirm whether semester-specific duplicate course codes should be allowed. The current `Course` table makes `courseCode` globally unique. Confirm whether roster matching should require both verified email and matric number; current student discovery checks matric number only. Confirm error response shape and statuses for `NOT_VERIFIED`, `UNAUTHORIZED`, `SESSION_EXPIRED`, `INVALID_CODE`, and `ALREADY_CHECKED_IN`.

Until these endpoints and fixes land, the browser-local demo remains the complete test flow. Live registration/code verification can be exercised, but the live dashboard cannot be treated as integrated.
