const MODE_KEY = 'smartattend-mode'
const DEMO_USER_KEY = 'smartattend-demo-user-v1'

export function isDemoMode() { return sessionStorage.getItem(MODE_KEY) === 'demo' }
export function enterDemo(role: 'LECTURER' | 'STUDENT') {
  sessionStorage.setItem(MODE_KEY, 'demo')
  sessionStorage.setItem(DEMO_USER_KEY, role === 'LECTURER' ? 'lecturer-demo' : 'student-demo')
  window.location.assign(role === 'LECTURER' ? '/lecturer/dashboard' : '/student/dashboard')
}
export function enterLive() {
  sessionStorage.removeItem(MODE_KEY)
  sessionStorage.removeItem(DEMO_USER_KEY)
  window.location.assign('/auth/login')
}
