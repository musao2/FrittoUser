import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LuHouse,
  LuClock,
  LuReceipt,
  LuUser,
  LuLogOut,
} from 'react-icons/lu'

const NAV_ITEMS = [
  { path: '/',        label: 'Asosiy',  icon: LuHouse,   end: true },
  { path: '/history', label: 'Davomat', icon: LuClock },
  { path: '/payslip', label: 'Oylik',   icon: LuReceipt },
  { path: '/profile', label: 'Profil',  icon: LuUser },
]

export default function EmployeeLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto sm:border-x sm:border-slate-200">
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">F</span>
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {profile?.full_name || profile?.email}
            </p>
            <p className="text-xs text-slate-500">Xodim</p>
          </div>
        </div>

        <button
          id="employee-menu-btn"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 cursor-pointer"
        >
          <LuLogOut size={16} />
          Chiqish
        </button>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-slate-200 grid grid-cols-4 z-40 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) => `
              flex flex-col items-center justify-center gap-1 h-16 text-xs transition-colors
              ${isActive ? 'text-emerald-700 font-medium' : 'text-slate-500 hover:text-slate-900'}
            `}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
