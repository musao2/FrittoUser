import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LuLogIn, LuLogOut, LuCircleAlert, LuClock } from 'react-icons/lu'
import { supabase, formatDuration, formatMoney } from '../../lib/supabase'
import { getDeviceId } from '../../lib/device'

export const PENDING_QR_KEY = 'fritto_pending_qr'

const ERRORS = {
  QR_EXPIRED:        { title: 'QR kod eskirgan',           text: "Ekrandagi QR kod har 15 soniyada yangilanadi. Ekran oldida turib qayta skanerlang." },
  TOO_SOON:          { title: 'Hozirgina skanerladingiz',  text: "Bir daqiqadan keyin qayta urinib ko'ring." },
  NOT_EMPLOYEE:      { title: 'Xodim topilmadi',           text: "Bu hisob xodimga bog'lanmagan. Administratorga murojaat qiling." },
  DEVICE_NOT_APPROVED: { title: 'Qurilma tasdiqlanmagan', text: "Bu telefondan davomat qilish uchun admin ruxsat berishi kerak." },
  EMPLOYEE_INACTIVE: { title: 'Hisobingiz faol emas',      text: "Siz ishdan bo'shatilgansiz yoki hisobingiz yopilgan. Administratorga murojaat qiling." },
}

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })

export default function ScanPage() {
  const [params] = useSearchParams()
  const token = params.get('t')
  const [state, setState] = useState({ status: 'loading' })
  const started = useRef(false) // StrictMode'da ikki marta yuborilmasligi uchun

  useEffect(() => {
    if (started.current) return
    started.current = true
    try { sessionStorage.removeItem(PENDING_QR_KEY) } catch { /* ahamiyatsiz */ }

    if (!token) {
      setState({ status: 'error', code: 'QR_EXPIRED' })
      return
    }

    supabase.rpc('qr_check_in_out', { p_token: token, p_device_id: getDeviceId() }).then(({ data, error }) => {
      if (error) {
        const code = Object.keys(ERRORS).find(c => error.message?.includes(c))
        setState({ status: 'error', code, message: error.message })
      } else {
        setState({ status: 'done', result: data })
      }
    })
  }, [token])

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full text-center">
        {state.status === 'loading' && (
          <>
            <div className="w-12 h-12 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-base text-slate-600">Tekshirilmoqda...</p>
          </>
        )}

        {state.status === 'done' && state.result.action === 'in' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-5">
              <LuLogIn size={36} />
            </div>
            <p className="text-2xl font-semibold text-slate-900">Ishga keldingiz</p>
            <p className="text-base text-slate-500 mt-1">Xush kelibsiz, {state.result.full_name}!</p>
            <div className="mt-6 inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-5 py-3">
              <LuClock size={18} className="text-slate-400" />
              <span className="text-lg font-semibold text-slate-900 tabular-nums">{fmtTime(state.result.at)}</span>
            </div>
          </>
        )}

        {state.status === 'done' && state.result.action === 'out' && (
          <>
            <div className="w-20 h-20 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-5">
              <LuLogOut size={36} />
            </div>
            <p className="text-2xl font-semibold text-slate-900">Ishdan ketdingiz</p>
            <p className="text-base text-slate-500 mt-1">Xayr, {state.result.full_name}!</p>
            <div className="mt-6 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-left">
              <Row label="Keldi"   value={fmtTime(state.result.check_in_at)} />
              <Row label="Ketdi"   value={fmtTime(state.result.at)} />
              <Row label="Ishladi" value={formatDuration(state.result.worked_seconds)} />
              <Row label="Topdi"   value={formatMoney(state.result.earned_amount)} strong />
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-5">
              <LuCircleAlert size={36} />
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {ERRORS[state.code]?.title || 'Xatolik yuz berdi'}
            </p>
            <p className="text-base text-slate-500 mt-2 max-w-xs mx-auto">
              {ERRORS[state.code]?.text || state.message}
            </p>
          </>
        )}

        {state.status !== 'loading' && (
          <Link to="/" className="btn-secondary w-full mt-8">Bosh sahifaga</Link>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm tabular-nums ${strong ? 'font-semibold text-emerald-700' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
