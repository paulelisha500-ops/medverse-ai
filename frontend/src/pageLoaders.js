// One import() function per route, shared between App.jsx's React.lazy()
// calls and Layout.jsx's hover-prefetch. Keeping a single source means the
// two can't drift — every lazy-loaded route is automatically prefetchable.
// Runs `loaders` after the current page has had a chance to render and the
// browser is otherwise idle, so a likely-next chunk (e.g. the dashboard,
// right after landing on the login page) is already cached by the time the
// user actually clicks toward it — without competing with this page's own
// render for bandwidth/CPU.
export function idlePrefetch(...loaders) {
  const run = () => loaders.forEach((load) => load())
  if (typeof window === 'undefined') return
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2000 })
  } else {
    setTimeout(run, 300)
  }
}

export const pageLoaders = {
  landing: () => import('./pages/Landing.jsx'),
  login: () => import('./pages/Login.jsx'),
  register: () => import('./pages/Register.jsx'),
  dashboard: () => import('./pages/DashboardHome.jsx'),
  assistant: () => import('./pages/Assistant.jsx'),
  reports: () => import('./pages/Reports.jsx'),
  riskCheck: () => import('./pages/RiskCheck.jsx'),
  medications: () => import('./pages/Medications.jsx'),
  patients: () => import('./pages/Patients.jsx'),
  patientDetail: () => import('./pages/PatientDetail.jsx'),
  profile: () => import('./pages/Profile.jsx'),
  appointments: () => import('./pages/Appointments.jsx'),
  reminders: () => import('./pages/Reminders.jsx'),
  notFound: () => import('./pages/NotFound.jsx'),
}
