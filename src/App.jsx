import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import EmployeeLayout from './layouts/EmployeeLayout'
import LoginPage from './pages/LoginPage'
import WrongRole from './pages/WrongRole'
import DeviceGate from './components/DeviceGate'

import EmployeeDashboard from './pages/employee/Dashboard'
import EmployeeHistory   from './pages/employee/History'
import EmployeePayslip   from './pages/employee/Payslip'
import EmployeeProfile   from './pages/employee/Profile'
import ScanPage, { PENDING_QR_KEY } from './pages/employee/Scan'
import ScannerPage from './pages/employee/Scanner'

const readPending = () => {
  try { return sessionStorage.getItem(PENDING_QR_KEY) } catch { return null }
}

// Tizimga kirmagan xodim QR ni skanerlasa: tokenni eslab qolib, kirish sahifasiga yuboramiz
function RememberQrThenLogin() {
  const [params] = useSearchParams()
  // Ekrandagi (?t=) yoki qog'ozdagi filial (?b=) QR — kirgandan keyin davom ettirish uchun eslab qolamiz
  const t = params.get('t')
  const b = params.get('b')
  const query = b ? `?b=${b}` : t ? `?t=${t}` : null
  if (query) {
    try { sessionStorage.setItem(PENDING_QR_KEY, query) } catch { /* ahamiyatsiz */ }
  }
  return <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/scan" element={<RememberQrThenLogin />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  const pending = readPending() // kirishdan oldin skanerlangan QR

  // Bu sayt faqat xodimlar uchun
  if (profile.role !== 'employee') {
    return <WrongRole message="Bu sahifa faqat xodimlar uchun. Admin panelga admin sayti orqali kiring." />
  }

  return (
    <DeviceGate>
    <Routes>
      <Route path="/" element={<EmployeeLayout />}>
        <Route index element={<EmployeeDashboard />} />
        <Route path="history" element={<EmployeeHistory />} />
        <Route path="payslip" element={<EmployeePayslip />} />
        <Route path="profile" element={<EmployeeProfile />} />
        <Route path="scan"    element={<ScanPage />} />
        <Route path="scanner" element={<ScannerPage />} />
      </Route>
      <Route path="*" element={<Navigate to={pending ? `/scan${pending.startsWith('?') ? pending : `?t=${pending}`}` : '/'} replace />} />
    </Routes>
    </DeviceGate>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
