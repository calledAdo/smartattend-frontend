import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiJson, apiText, getApiToken, setApiToken } from './api'
import { StoreContext, isLive, type CheckIn, type Course, type Database, type NewUser, type RosterStudent, type Session, type Store, type User } from './data'
import { enterDemo } from './mode'
import { facialEmbeddingFromPhoto } from './face'

const USER_KEY = 'smartattend-live-user'
const PENDING_KEY = 'smartattend-live-pending'
type Raw = Record<string, unknown>

function object(value: unknown): Raw { return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {} }
function value(raw: Raw, ...keys: string[]): string {
  for (const key of keys) if (typeof raw[key] === 'string' || typeof raw[key] === 'number') return String(raw[key])
  return ''
}
function list(raw: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw
  const body = object(raw)
  for (const key of keys) if (Array.isArray(body[key])) return body[key] as unknown[]
  throw new Error('The attendance service returned an unexpected list format.')
}
function cachedUser(): User | null {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || sessionStorage.getItem(PENDING_KEY) || 'null') as User | null }
  catch { return null }
}
function emptyDb(): Database {
  const user = cachedUser()
  return { users: user ? [user] : [], currentUserId: user?.id ?? null, courses: [], sessions: [], attendance: [], enrollments: [], verificationTokens: {} }
}
function userFrom(rawInput: unknown, fallback?: Partial<User>): User {
  const raw = object(rawInput)
  const role = value(raw, 'role').toUpperCase() || fallback?.role
  if (role !== 'LECTURER' && role !== 'STUDENT') throw new Error('The service did not return a valid account role.')
  const nextStep = value(raw, 'nextStep').toUpperCase()
  const id = value(raw, 'id', 'userId') || fallback?.id || ''
  const email = value(raw, 'email') || fallback?.email || ''
  if (!id || !email) throw new Error('The service did not return a complete account profile.')
  return {
    id, email, role,
    name: value(raw, 'fullName', 'name') || fallback?.name || email,
    department: value(raw, 'department') || fallback?.department || '',
    matricNo: value(raw, 'matricNo') || fallback?.matricNo,
    emailVerified: typeof raw.emailVerified === 'boolean' ? raw.emailVerified : typeof raw.isEmailVerified === 'boolean' ? raw.isEmailVerified : nextStep === 'ENROLL_FACE' || nextStep === 'DASHBOARD' || fallback?.emailVerified || false,
    faceEnrolled: role === 'LECTURER' || (typeof raw.faceEnrolled === 'boolean' ? raw.faceEnrolled : typeof raw.hasFaceTemplate === 'boolean' ? raw.hasFaceTemplate : nextStep === 'DASHBOARD' || fallback?.faceEnrolled || false),
  }
}
function rosterFrom(raw: unknown): RosterStudent[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item => { const row = object(item); return { name: value(row, 'name', 'fullName'), email: value(row, 'email'), matricNo: value(row, 'matricNo') } })
}
function rosterCsv(rows: RosterStudent[]): File {
  const cell = (text: string) => `"${text.replaceAll('"', '""')}"`
  const lines = ['name,matricNo,email', ...rows.map(row => [row.name, row.matricNo, row.email].map(cell).join(','))]
  return new File([lines.join('\r\n')], 'roster.csv', { type: 'text/csv' })
}
function courseFrom(input: unknown, user: User): Course {
  const raw = object(input)
  const id = value(raw, 'id', 'courseId')
  if (!id) throw new Error('The service returned a course without an ID.')
  const roster = rosterFrom(raw.roster ?? raw.students)
  return {
    id,
    code: value(raw, 'code', 'courseCode'),
    title: value(raw, 'title', 'courseTitle'),
    semester: value(raw, 'semester'),
    lecturerId: value(raw, 'lecturerId', 'createdById') || (user.role === 'LECTURER' ? user.id : ''),
    room: value(raw, 'room') || 'Room to be announced',
    schedule: value(raw, 'schedule') || 'Schedule to be announced',
    enrolledCount: Number(raw.rosterCount ?? raw.enrolledCount ?? roster.length),
    color: 'mint',
    roster,
    supportingLecturerEmails: Array.isArray(raw.supportingLecturerEmails) ? raw.supportingLecturerEmails.map(String) : [],
    isAssigned: user.role === 'STUDENT',
    isManaged: user.role === 'LECTURER',
  }
}
function sessionFrom(input: unknown, user: User): Session {
  const raw = object(input)
  const id = value(raw, 'id', 'sessionId')
  const courseId = value(raw, 'courseId') || value(object(raw.course), 'id', 'courseId')
  const startedAt = value(raw, 'startedAt', 'startsAt', 'createdAt')
  const expiresAt = value(raw, 'expiresAt', 'endsAt')
  if (!id || !courseId || !startedAt || !expiresAt) throw new Error('The service returned an incomplete attendance session.')
  const checkIns: CheckIn[] = Array.isArray(raw.checkIns) ? raw.checkIns.map(item => { const row = object(item); return { userId: value(row, 'userId', 'studentId'), name: value(row, 'name', 'studentName'), at: value(row, 'at', 'checkedInAt') } }) : []
  return {
    id, courseId, startedAt, expiresAt, endedAt: value(raw, 'endedAt') || undefined,
    status: ['ENDED', 'CLOSED', 'COMPLETED', 'EXPIRED'].includes(value(raw, 'status').toUpperCase()) || value(raw, 'endedAt') ? 'ended' : 'active',
    code: user.role === 'LECTURER' ? value(raw, 'code', 'attendanceCode', 'sessionCode') : '',
    latitude: Number(raw.latitude ?? NaN), longitude: Number(raw.longitude ?? NaN),
    checkIns, rosterSnapshot: rosterFrom(raw.rosterSnapshot),
    presentCount: Number(raw.presentCount ?? raw.checkedInCount ?? checkIns.length),
    isEligible: user.role === 'STUDENT',
  }
}
function saveUser(user: User | null) {
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(USER_KEY)
}

export function LiveAppStore({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(emptyDb)
  const [loading, setLoading] = useState(Boolean(getApiToken()))
  const [error, setError] = useState<string | null>(null)
  const user = db.users.find(item => item.id === db.currentUserId) ?? null

  const setCurrentUser = useCallback((next: User | null) => {
    saveUser(next)
    setDb(current => ({ ...current, users: next ? [next] : [], currentUserId: next?.id ?? null, courses: next ? current.courses : [], sessions: next ? current.sessions : [], attendance: next ? current.attendance : [] }))
  }, [])

  const loadWorkspace = useCallback(async (currentUser: User) => {
    if (!getApiToken() || !currentUser.emailVerified || (currentUser.role === 'STUDENT' && !currentUser.faceEnrolled)) return
    if (currentUser.role === 'LECTURER') {
      setError('The backend does not provide a lecturer course-list endpoint yet. Newly created courses are visible only in this tab.')
      return
    }
    if (!/^\d+$/.test(currentUser.id)) {
      setError('The backend profile must include your numeric student ID before courses can load.')
      return
    }
    try {
      const raw = await apiJson('GET', `/api/courses/student/${currentUser.id}`)
      const courses = list(raw, 'courses', 'items', 'data').map(item => courseFrom(item, currentUser))
      setDb(current => ({ ...current, courses }))
      setError('The backend does not provide active-session discovery yet. Ask the backend engineer for a role-filtered active sessions endpoint.')
    } catch (issue) { setError((issue as Error).message) }
  }, [])

  const refresh = useCallback(async () => {
    if (!getApiToken()) { setLoading(false); return }
    setLoading(true)
    try {
      const raw = await apiJson('GET', '/api/auth/me')
      const profile = userFrom(object(raw).user ?? raw, cachedUser() ?? undefined)
      setCurrentUser(profile)
      await loadWorkspace(profile)
    } catch (issue) { setError((issue as Error).message) }
    finally { setLoading(false) }
  }, [loadWorkspace, setCurrentUser])

  const refreshCourse = useCallback(async () => {}, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      const profile = cachedUser()
      if (profile && getApiToken()) void loadWorkspace(profile)
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [refresh, loadWorkspace])

  const store = useMemo<Store>(() => ({
    db, user, mode: 'live', loading, error, refresh, refreshCourse,
    signInDemo: enterDemo,
    async signIn(email, password) {
      const raw = object(await apiJson('POST', '/api/auth/login', { emailOrUsername: email, password }))
      const token = value(raw, 'accessToken', 'token', 'jwt')
      if (!token) throw new Error('Login did not return an access token.')
      setApiToken(token)
      try {
        const profileRaw = await apiJson('GET', '/api/auth/me')
        const profile = userFrom(object(profileRaw).user ?? profileRaw, { email })
        sessionStorage.removeItem(PENDING_KEY)
        setCurrentUser(profile)
        void loadWorkspace(profile)
        return profile
      } catch (issue) {
        setApiToken(null)
        throw new Error(`Sign-in succeeded, but your account profile could not be loaded from /api/auth/me. Dashboard access requires your account ID and verification state. ${(issue as Error).message}`)
      }
    },
    signOut() {
      setApiToken(null)
      sessionStorage.removeItem(PENDING_KEY)
      setCurrentUser(null)
      setError(null)
    },
    async register(input: NewUser) {
      const email = input.email.trim().toLowerCase()
      const raw = object(await apiJson('POST', '/api/auth/register', { fullName: input.name.trim(), email, username: email, password: input.password, role: input.role, matricNo: input.role === 'STUDENT' ? input.matricNo?.trim() : undefined }))
      const pending: User = {
        id: value(raw, 'userId', 'id') || 'pending-email',
        name: input.name.trim(), email, role: input.role,
        department: '', matricNo: input.matricNo?.trim(), emailVerified: false, faceEnrolled: false,
      }
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
      setCurrentUser(pending)
      return pending
    },
    async verifyEmail(token) {
      const pending = cachedUser()
      if (!pending?.email) throw new Error('Your registration email is missing. Register again or contact support.')
      const raw = object(await apiJson('POST', '/api/auth/verify-email', { email: pending.email, token }))
      const verified = { ...pending, role: value(raw, 'role').toUpperCase() === 'LECTURER' ? 'LECTURER' as const : pending.role, emailVerified: true }
      sessionStorage.removeItem(PENDING_KEY)
      setCurrentUser(null)
      return verified
    },
    async resendVerification() {
      const pending = cachedUser()
      if (!pending?.email || pending.emailVerified) throw new Error('No pending email verification was found.')
      return apiText('POST', `/api/auth/resend-verification?email=${encodeURIComponent(pending.email)}`)
    },
    async completeFace() {
      throw new Error('Live face enrollment is paused until the backend binds /api/auth/onboard-face to the signed-in student.')
    },
    async createCourse(input) {
      if (!user) throw new Error('Sign in as a lecturer first.')
      if (!/^\d+$/.test(user.id)) throw new Error('The backend must return your numeric lecturer ID from /api/auth/me before a course can be created.')
      if (input.supportingLecturerEmails.length) throw new Error('The backend has no supporting-lecturer email endpoint yet. Remove these emails before creating this course.')
      const code = input.code.trim().toUpperCase()
      const raw = object(await apiJson('POST', '/api/courses', { courseCode: code, title: input.title.trim(), semester: input.semester.trim(), lecturerId: Number(user.id) }))
      const file = new FormData()
      file.append('file', rosterCsv(input.roster))
      try {
        await apiJson('POST', `/api/courses/${encodeURIComponent(code)}/roster-upload`, file)
        await apiJson('POST', `/api/courses/${encodeURIComponent(code)}/confirm-roster`)
      } catch (issue) {
        throw new Error(`Course ${code} was created as a draft, but its roster was not confirmed: ${(issue as Error).message}`)
      }
      const course = { ...courseFrom(raw.course ?? raw, user), room: input.room || 'Room to be announced', schedule: input.schedule || 'Schedule to be announced', roster: input.roster, enrolledCount: input.roster.length }
      setDb(current => ({ ...current, courses: [course, ...current.courses] }))
      return course
    },
    async startSession(courseId) {
      if (!user) throw new Error('Sign in as a lecturer first.')
      if (!/^\d+$/.test(user.id)) throw new Error('The backend must return your numeric lecturer ID before attendance can start.')
      const course = db.courses.find(item => item.id === courseId)
      if (!course) throw new Error('Course details are unavailable.')
      const raw = object(await apiJson('POST', '/api/attendance/sessions', { courseCode: course.code, lecturerId: Number(user.id), durationMinutes: 5 }))
      const session = { ...sessionFrom({ ...raw, courseId }, user), courseId }
      setDb(current => ({ ...current, sessions: [session, ...current.sessions] }))
      return session
    },
    async endSession(sessionId) {
      await apiJson('POST', `/api/attendance/sessions/${encodeURIComponent(sessionId)}/close`)
      setDb(current => ({ ...current, sessions: current.sessions.map(item => item.id === sessionId ? { ...item, status: 'ended', endedAt: new Date().toISOString() } : item) }))
    },
    verifyLocation(sessionId, position) {
      const session = db.sessions.find(item => item.id === sessionId)
      if (!session || !isLive(session)) throw new Error('This attendance session has ended.')
      if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) throw new Error('Your location could not be read.')
    },
    verifyCode(sessionId, code) {
      if (!db.sessions.some(item => item.id === sessionId && isLive(item))) throw new Error('This attendance session has ended.')
      if (!/^[A-Z0-9]{6}$/i.test(code)) throw new Error('Enter the six-character attendance code.')
    },
    async submitCheckIn(sessionId, faceImage, position, code) {
      if (!faceImage || !position) throw new Error('Capture your face and location first.')
      const facialEmbedding = await facialEmbeddingFromPhoto(faceImage)
      const raw = object(await apiJson('POST', `/api/attendance/sessions/${encodeURIComponent(sessionId)}/check-ins`, {
        code,
        latitude: position.latitude,
        longitude: position.longitude,
        facialEmbedding,
      }))
      if (value(raw, 'status').toUpperCase() !== 'PRESENT') throw new Error('The service did not confirm your attendance.')
      const at = value(raw, 'checkedInAt', 'at') || new Date().toISOString()
      setDb(current => ({
        ...current,
        attendance: [...current.attendance, { sessionId, courseId: current.sessions.find(item => item.id === sessionId)?.courseId ?? '', userId: user?.id ?? '', status: 'PRESENT', at }],
        sessions: current.sessions.map(item => item.id === sessionId ? { ...item, presentCount: (item.presentCount ?? item.checkIns.length) + 1, checkIns: user ? [{ userId: user.id, name: user.name, at }, ...item.checkIns] : item.checkIns } : item),
      }))
    },
  }), [db, user, loading, error, refresh, refreshCourse, loadWorkspace, setCurrentUser])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
