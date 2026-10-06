import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { faceDescriptorsMatch, facialEmbeddingFromPhoto } from './face'

export type Role = 'LECTURER' | 'STUDENT'
export type User = { id: string; name: string; email: string; role: Role; department: string; matricNo?: string; emailVerified: boolean; faceEnrolled?: boolean; faceMode?: 'camera' | 'demo' }
export type RosterStudent = { name: string; matricNo: string; email: string }
export type Course = { id: string; code: string; title: string; semester: string; lecturerId: string; room: string; schedule: string; enrolledCount: number; color: string; roster: RosterStudent[]; supportingLecturerEmails: string[]; isAssigned?: boolean; isManaged?: boolean }
export type CheckIn = { userId: string; name: string; at: string; email?: string; matricNo?: string }
export type Session = { id: string; courseId: string; startedAt: string; expiresAt: string; endedAt?: string; status: 'active' | 'ended'; code: string; latitude: number; longitude: number; checkIns: CheckIn[]; rosterSnapshot?: RosterStudent[]; isEligible?: boolean; presentCount?: number }
export type AttendanceRecord = { sessionId: string; courseId: string; userId: string; status: 'PRESENT' | 'ABSENT'; at?: string }
type Enrollment = { userId: string; courseId: string; enrolledAt: string }
export type Database = { users: User[]; currentUserId: string | null; courses: Course[]; enrollments: Enrollment[]; sessions: Session[]; attendance: AttendanceRecord[]; verificationTokens: Record<string, string> }

const STORAGE_KEY = 'smartattend-demo-v1'
const AUTH_KEY = 'smartattend-demo-user-v1'
const faceTemplates = new Map<string, { kind: 'camera'; embedding: string } | { kind: 'demo' }>()
const minute = 60_000
const uid = () => Math.random().toString(36).slice(2, 10)

function seed(): Database {
  const now = Date.now()
  const lecturer: User = { id: 'lecturer-demo', name: 'Dr. Maya Johnson', email: 'maya@smartattend.demo', role: 'LECTURER', department: 'Computer Science', emailVerified: true }
  const student: User = { id: 'student-demo', name: 'Amara Okafor', email: 'amara@smartattend.demo', role: 'STUDENT', department: 'Computer Science', matricNo: 'CSC/2023/0421', emailVerified: true, faceEnrolled: false }
  const courses: Course[] = [
    { id: 'csc301', code: 'CSC 301', title: 'Database Management Systems', semester: 'First semester 2026/27', lecturerId: lecturer.id, room: 'LT 204', schedule: 'Mon, Wed · 10:00 AM', enrolledCount: 48, color: 'mint' },
    { id: 'csc205', code: 'CSC 205', title: 'Data Structures & Algorithms', semester: 'First semester 2026/27', lecturerId: lecturer.id, room: 'Engineering Hall', schedule: 'Tue, Thu · 2:00 PM', enrolledCount: 42, color: 'coral' },
    { id: 'csc412', code: 'CSC 412', title: 'Human Computer Interaction', semester: 'First semester 2026/27', lecturerId: lecturer.id, room: 'ICT Lab 1', schedule: 'Friday · 11:00 AM', enrolledCount: 36, color: 'blue' },
    { id: 'mat204', code: 'MAT 204', title: 'Linear Algebra', semester: 'First semester 2026/27', lecturerId: lecturer.id, room: 'Science Block', schedule: 'Tuesday · 9:00 AM', enrolledCount: 56, color: 'yellow' },
  ].map(course => {
    const roster: RosterStudent[] = Array.from({ length: course.enrolledCount }, (_, index) => ({
      name: `Sample Student ${String(index + 1).padStart(2, '0')}`,
      matricNo: `${course.code.replaceAll(' ', '')}/2023/${String(index + 1).padStart(4, '0')}`,
      email: `student${index + 1}@smartattend.demo`,
    }))
    if (['csc301', 'csc205'].includes(course.id)) roster[0] = { name: student.name, email: student.email, matricNo: student.matricNo! }
    if (course.id === 'csc301') {
      roster[1] = { name: 'Amina Yusuf', email: 'amina@smartattend.demo', matricNo: 'CSC/2023/0422' }
      roster[2] = { name: 'Tunde Bello', email: 'tunde@smartattend.demo', matricNo: 'CSC/2023/0423' }
    }
    return { ...course, roster, supportingLecturerEmails: [] }
  })
  const active: Session = {
    id: 'session-live', courseId: 'csc301', startedAt: new Date(now - 2 * minute).toISOString(), expiresAt: new Date(now + 3 * minute).toISOString(), status: 'active', code: '482916', latitude: 6.5244, longitude: 3.3792,
    checkIns: [{ userId: 'sample-1', name: 'Amina Yusuf', at: new Date(now - minute).toISOString() }, { userId: 'sample-2', name: 'Tunde Bello', at: new Date(now - 25_000).toISOString() }],
  }
  const previous: Session[] = [
    { id: 'session-1', courseId: 'csc301', startedAt: new Date(now - 2 * 86_400_000).toISOString(), expiresAt: new Date(now - 2 * 86_400_000 + 5 * minute).toISOString(), endedAt: new Date(now - 2 * 86_400_000 + 5 * minute).toISOString(), status: 'ended', code: '574120', latitude: 6.5244, longitude: 3.3792, checkIns: [{ userId: student.id, name: student.name, at: new Date(now - 2 * 86_400_000 + 2 * minute).toISOString() }] },
    { id: 'session-2', courseId: 'csc205', startedAt: new Date(now - 5 * 86_400_000).toISOString(), expiresAt: new Date(now - 5 * 86_400_000 + 5 * minute).toISOString(), endedAt: new Date(now - 5 * 86_400_000 + 5 * minute).toISOString(), status: 'ended', code: '825309', latitude: 6.5244, longitude: 3.3792, checkIns: [] },
    { id: 'session-3', courseId: 'csc301', startedAt: new Date(now - 9 * 86_400_000).toISOString(), expiresAt: new Date(now - 9 * 86_400_000 + 5 * minute).toISOString(), endedAt: new Date(now - 9 * 86_400_000 + 5 * minute).toISOString(), status: 'ended', code: '319472', latitude: 6.5244, longitude: 3.3792, checkIns: [{ userId: student.id, name: student.name, at: new Date(now - 9 * 86_400_000 + minute).toISOString() }] },
  ]
  return {
    users: [lecturer, student], currentUserId: null, courses, verificationTokens: {},
    enrollments: [{ userId: student.id, courseId: 'csc301', enrolledAt: new Date(now - 20 * 86_400_000).toISOString() }, { userId: student.id, courseId: 'csc205', enrolledAt: new Date(now - 20 * 86_400_000).toISOString() }],
    sessions: [active, ...previous],
    attendance: [
      { sessionId: 'session-1', courseId: 'csc301', userId: student.id, status: 'PRESENT', at: previous[0].checkIns[0].at },
      { sessionId: 'session-2', courseId: 'csc205', userId: student.id, status: 'ABSENT' },
      { sessionId: 'session-3', courseId: 'csc301', userId: student.id, status: 'PRESENT', at: previous[2].checkIns[0].at },
    ],
  }
}

function readDb(): Database {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const data = saved ? JSON.parse(saved) as Database : seed()
    const users = data.users.map(user => {
      const template = faceTemplates.get(user.id)
      return { ...user, emailVerified: user.emailVerified ?? true, matricNo: user.matricNo ?? (user.id === 'student-demo' ? 'CSC/2023/0421' : undefined), faceEnrolled: user.role === 'STUDENT' ? Boolean(template) : user.faceEnrolled, faceMode: template?.kind }
    })
    const courses = data.courses.map(course => ({ ...course, roster: course.roster ?? data.enrollments.filter(item => item.courseId === course.id).flatMap(item => { const user = users.find(user => user.id === item.userId); return user?.matricNo ? [{ name: user.name, matricNo: user.matricNo, email: user.email }] : [] }), supportingLecturerEmails: course.supportingLecturerEmails ?? [] }))
    return { ...data, users, courses, verificationTokens: data.verificationTokens ?? {}, currentUserId: sessionStorage.getItem(AUTH_KEY) }
  } catch {
    return seed()
  }
}

function persistDb(db: Database) {
  if (db.currentUserId) sessionStorage.setItem(AUTH_KEY, db.currentUserId)
  else sessionStorage.removeItem(AUTH_KEY)
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...db, users: db.users.map(user => user.role === 'STUDENT' ? { ...user, faceEnrolled: false, faceMode: undefined } : user), currentUserId: null }))
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * radians
  const dLon = (b.longitude - a.longitude) * radians
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value))
}

export type NewUser = { name: string; email: string; role: Role; matricNo?: string; password: string }
export type CaptureSource = 'camera' | 'demo'
type Awaitable<T> = T | Promise<T>
export type Store = {
  db: Database
  user: User | null
  mode: 'demo' | 'live'
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  refreshCourse: (courseId: string) => Promise<void>
  signInDemo: (role: Role) => void
  signIn: (email: string, password: string) => Awaitable<User>
  signOut: () => void
  register: (input: NewUser) => Awaitable<User>
  verifyEmail: (token: string) => Awaitable<User>
  completeFace: (photo: Blob | null, source?: CaptureSource) => Awaitable<void>
  resendVerification: () => Awaitable<string>
  createCourse: (input: { code: string; title: string; semester: string; room: string; schedule: string; roster: RosterStudent[]; supportingLecturerEmails: string[] }) => Awaitable<Course>
  startSession: (courseId: string, position?: { latitude: number; longitude: number; accuracyMeters?: number }) => Awaitable<Session>
  endSession: (sessionId: string) => Awaitable<void>
  verifyLocation: (sessionId: string, position: { latitude: number; longitude: number; accuracyMeters?: number }) => Awaitable<void>
  verifyCode: (sessionId: string, code: string) => Awaitable<void>
  submitCheckIn: (sessionId: string, faceImage: Blob | null, position: { latitude: number; longitude: number; accuracyMeters?: number } | null, code: string, source?: CaptureSource) => Awaitable<void>
}

export const StoreContext = createContext<Store | null>(null)

export function AppStore({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(readDb)
  const user = db.users.find(item => item.id === db.currentUserId) ?? null

  const update = useCallback((change: (current: Database) => Database) => {
    setDb(current => {
      const next = change(current)
      persistDb(next)
      return next
    })
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) setDb(readDb()) }
    window.addEventListener('storage', onStorage)
    const interval = window.setInterval(() => {
      setDb(current => {
        if (!current.sessions.some(session => session.status === 'active' && Date.now() >= Date.parse(session.expiresAt))) return current
        const next = { ...current, sessions: current.sessions.map(session => session.status === 'active' && Date.now() >= Date.parse(session.expiresAt) ? { ...session, status: 'ended' as const, endedAt: session.expiresAt } : session) }
        persistDb(next)
        return next
      })
    }, 1_000)
    return () => { window.removeEventListener('storage', onStorage); window.clearInterval(interval) }
  }, [])

  const store = useMemo<Store>(() => ({
    db, user, mode: 'demo', loading: false, error: null,
    async refresh() {},
    async refreshCourse() {},
    signInDemo(role) { update(current => ({ ...current, currentUserId: role === 'LECTURER' ? 'lecturer-demo' : 'student-demo' })) },
    signIn(email, password) {
      if (!password) throw new Error('Enter your password.')
      const found = db.users.find(item => item.email.toLowerCase() === email.trim().toLowerCase())
      if (!found) throw new Error('No account found for this email. Try a demo account or register.')
      update(current => ({ ...current, currentUserId: found.id }))
      return found
    },
    signOut() {
      faceTemplates.clear()
      update(current => ({ ...current, users: current.users.map(item => item.role === 'STUDENT' ? { ...item, faceEnrolled: false, faceMode: undefined } : item), currentUserId: null }))
    },
    register(input) {
      if (db.users.some(item => item.email.toLowerCase() === input.email.trim().toLowerCase())) throw new Error('An account with this email already exists.')
      if (!input.name.trim() || !input.email.trim() || input.password.length < 8) throw new Error('Complete your details and use a password of at least 8 characters.')
      if (input.role === 'STUDENT' && !input.matricNo?.trim()) throw new Error('Enter your matric number.')
      if (input.role === 'STUDENT' && db.users.some(item => item.role === 'STUDENT' && item.matricNo?.toLowerCase() === input.matricNo?.trim().toLowerCase())) throw new Error('This matric number already belongs to an account.')
      const created: User = { id: uid(), name: input.name.trim(), email: input.email.trim().toLowerCase(), role: input.role, department: '', matricNo: input.role === 'STUDENT' ? input.matricNo?.trim() : undefined, emailVerified: false, faceEnrolled: false }
      const token = uid() + uid()
      update(current => ({ ...current, users: [...current.users, created], verificationTokens: { ...current.verificationTokens, [created.id]: token }, currentUserId: created.id }))
      return created
    },
    verifyEmail(token) {
      const found = db.users.find(item => db.verificationTokens[item.id] === token)
      if (!found) throw new Error('This verification link is invalid or has already been used.')
      update(current => ({ ...current, users: current.users.map(item => item.id === found.id ? { ...item, emailVerified: true } : item), verificationTokens: Object.fromEntries(Object.entries(current.verificationTokens).filter(([id]) => id !== found.id)), currentUserId: found.id }))
      return found
    },
    resendVerification() {
      if (!user || user.emailVerified) throw new Error('No pending email verification.')
      const token = uid() + uid()
      update(current => ({ ...current, verificationTokens: { ...current.verificationTokens, [user.id]: token } }))
      return token
    },
    async completeFace(photo, source = 'camera') {
      if (!user || user.role !== 'STUDENT' || !user.emailVerified) throw new Error('Verify your student email first.')
      if (!photo || !photo.type.startsWith('image/')) throw new Error('Capture a face photo to continue.')
      const template = source === 'demo' ? { kind: 'demo' as const } : { kind: 'camera' as const, embedding: await facialEmbeddingFromPhoto(photo) }
      faceTemplates.set(user.id, template)
      update(current => ({ ...current, users: current.users.map(item => item.id === user.id ? { ...item, faceEnrolled: true, faceMode: source } : item) }))
    },
    createCourse(input) {
      if (!user || user.role !== 'LECTURER' || !user.emailVerified) throw new Error('Verified lecturer access required.')
      if (!input.code.trim() || !input.title.trim() || !input.semester.trim()) throw new Error('Enter the course code, title and semester.')
      if (!input.roster.length) throw new Error('Upload a CSV roster with at least one student.')
      if (db.courses.some(course => course.code.toLowerCase() === input.code.trim().toLowerCase() && course.semester.toLowerCase() === input.semester.trim().toLowerCase())) throw new Error('This course code already exists for this semester.')
      const course: Course = { id: uid(), code: input.code.trim().toUpperCase(), title: input.title.trim(), room: input.room.trim() || 'Room to be announced', schedule: input.schedule.trim() || 'Schedule to be announced', semester: input.semester.trim(), lecturerId: user.id, enrolledCount: input.roster.length, color: 'mint', roster: input.roster, supportingLecturerEmails: input.supportingLecturerEmails }
      update(current => ({ ...current, courses: [course, ...current.courses] }))
      return course
    },
    startSession(courseId, position) {
      const course = db.courses.find(item => item.id === courseId)
      if (!user || !course || !lecturerCanAccess(course, user)) throw new Error('This course is unavailable.')
      if (!position) throw new Error('Allow location access to start attendance.')
      if (db.sessions.some(session => session.courseId === courseId && isLive(session))) throw new Error('This course already has a live session.')
      const now = Date.now()
      const session: Session = { id: uid(), courseId, startedAt: new Date(now).toISOString(), expiresAt: new Date(now + 5 * minute).toISOString(), status: 'active', code: String(Math.floor(100000 + Math.random() * 900000)), latitude: position.latitude, longitude: position.longitude, checkIns: [], rosterSnapshot: [...course.roster] }
      update(current => ({ ...current, sessions: [session, ...current.sessions] }))
      return session
    },
    endSession(sessionId) {
      const session = db.sessions.find(item => item.id === sessionId)
      const course = db.courses.find(item => item.id === session?.courseId)
      if (!user || !course || !lecturerCanAccess(course, user)) throw new Error('This session is unavailable.')
      update(current => ({ ...current, sessions: current.sessions.map(item => item.id === sessionId ? { ...item, status: 'ended', endedAt: new Date().toISOString() } : item) }))
    },
    verifyLocation(sessionId, position) {
      const session = db.sessions.find(item => item.id === sessionId)
      if (!session || !isLive(session)) throw new Error('This attendance session has ended.')
      if (distanceMeters(position, session) > 300) throw new Error('You are outside the permitted lecture hall boundary.')
    },
    verifyCode(sessionId, code) {
      const session = db.sessions.find(item => item.id === sessionId)
      if (!session || !isLive(session)) throw new Error('This attendance session has ended.')
      if (session.code !== code.trim()) throw new Error('That code does not match. Check the code shown in class.')
    },
    async submitCheckIn(sessionId, faceImage, position, code, source = 'camera') {
      const session = db.sessions.find(item => item.id === sessionId)
      if (!user || user.role !== 'STUDENT' || !session || !isLive(session)) throw new Error('This attendance session has ended.')
      if (!studentInRoster(session.rosterSnapshot ?? db.courses.find(item => item.id === session.courseId)?.roster ?? [], user)) throw new Error('You are not on this course roster.')
      if (!position || distanceMeters(position, session) > 300) throw new Error('You are outside the permitted lecture hall boundary.')
      if (session.code !== code.trim()) throw new Error('That code does not match. Check the code shown in class.')
      if (!faceImage || !faceImage.type.startsWith('image/')) throw new Error('Capture a face photo before marking attendance.')
      if (db.attendance.some(item => item.userId === user.id && item.sessionId === sessionId)) throw new Error('Your attendance has already been recorded.')
      const template = faceTemplates.get(user.id)
      if (!template) throw new Error('Set up your face again before checking in.')
      if (template.kind === 'camera') {
        if (source !== 'camera') throw new Error('Use your camera to verify the enrolled face.')
        const captured = await facialEmbeddingFromPhoto(faceImage)
        if (!faceDescriptorsMatch(template.embedding, captured)) throw new Error('Face verification failed. Retake the photo and try again.')
      }
      const at = new Date().toISOString()
      update(current => ({ ...current, sessions: current.sessions.map(item => item.id === sessionId ? { ...item, checkIns: [{ userId: user.id, name: user.name, email: user.email, matricNo: user.matricNo, at }, ...item.checkIns] } : item), attendance: [...current.attendance, { sessionId, courseId: session.courseId, userId: user.id, status: 'PRESENT', at }] }))
    },
  }), [db, user, update])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useApp() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('AppStore is missing')
  return store
}

export function isLive(session: Session) { return session.status === 'active' && Date.now() < Date.parse(session.expiresAt) }
export function checkedInCount(session: Session) { return session.presentCount ?? session.checkIns.length }
export function studentInRoster(roster: RosterStudent[], user: User) {
  return user.role === 'STUDENT' && user.emailVerified && Boolean(user.matricNo) && roster.some(row => row.email.toLowerCase() === user.email.toLowerCase() && row.matricNo.toLowerCase() === user.matricNo?.toLowerCase())
}
export function studentCourses(db: Database, user: User | null) { return user ? db.courses.filter(course => course.isAssigned || studentInRoster(course.roster, user)) : [] }
export function lecturerCanAccess(course: Course, user: User) { return user.role === 'LECTURER' && user.emailVerified && (course.isManaged || course.lecturerId === user.id || course.supportingLecturerEmails.some(email => email.toLowerCase() === user.email.toLowerCase())) }
export function lecturerCourses(db: Database, user: User | null) { return user ? db.courses.filter(course => lecturerCanAccess(course, user)) : [] }
export function completedStudentSessions(db: Database, userId?: string) {
  const user = db.users.find(item => item.id === userId)
  return db.sessions.filter(session => {
    if (!user || isLive(session)) return false
    return studentInRoster(session.rosterSnapshot ?? db.courses.find(item => item.id === session.courseId)?.roster ?? [], user)
  })
}
export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat('en-NG', options ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) }
export function formatTime(value: string) { return new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
export function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() }
