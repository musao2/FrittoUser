import { useAuth } from '../context/AuthContext'
import { LuCircleAlert, LuLogOut } from 'react-icons/lu'

export default function WrongRole({ message }) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 text-center">
        <LuCircleAlert size={32} className="mx-auto text-amber-500 mb-3" />
        <p className="text-base font-semibold text-slate-900 mb-1">Kirish mumkin emas</p>
        <p className="text-sm text-slate-500 mb-5">{message}</p>
        <button onClick={signOut} className="btn-secondary w-full">
          <LuLogOut size={16} />
          Boshqa hisob bilan kirish
        </button>
      </div>
    </div>
  )
}
