import { useEffect, useState, useCallback } from 'react'
import { LuSmartphone, LuShieldCheck, LuCircleX, LuLogOut, LuRefreshCw, LuSend } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { getDeviceId, getDeviceLabel } from '../lib/device'
import { useAuth } from '../context/AuthContext'

const POLL_MS = 5000

/**
 * Xodim faqat admin tasdiqlagan qurilmadan kira oladi.
 * Yangi qurilma bo'lsa — adminga so'rov ketadi va shu ekran ko'rinadi.
 */
export default function DeviceGate({ children }) {
  const { signOut } = useAuth()
  const [status, setStatus] = useState('loading') // loading | approved | pending | rejected | setup | error
  const [sending, setSending] = useState(false)
  const [waitUntil, setWaitUntil] = useState(0)   // qayta so'rov uchun kutish (vaqt belgisi)
  const [now, setNow] = useState(Date.now())
  const [notice, setNotice] = useState('')
  const label = getDeviceLabel()

  const check = useCallback(async () => {
    const { data, error } = await supabase.rpc('device_check_in', {
      p_device_id: getDeviceId(),
      p_label: label,
    })
    if (error) {
      const notInstalled = error.code === 'PGRST202' || error.message?.includes('Could not find the function')
      // Tasdiqlangan xodimni internet bir lahza uzilgani uchun chiqarib yubormaymiz
      setStatus(prev => (prev === 'approved' && !notInstalled ? 'approved' : notInstalled ? 'setup' : 'error'))
      return
    }
    setStatus(data)
  }, [label])

  useEffect(() => {
    check()
  }, [check])

  // Kutayotgan bo'lsa — har 5 soniyada (admin tasdiqlashi bilan o'zi ochiladi).
  // Rad etilgan bo'lsa — har 15 soniyada (admin keyinroq ruxsat bersa, o'zi ochiladi).
  // Tasdiqlangan bo'lsa — har daqiqada (admin ruxsatni olib qo'ysa, darhol yopiladi).
  useEffect(() => {
    if (!['pending', 'rejected', 'approved'].includes(status)) return
    const ms = status === 'pending' ? POLL_MS : status === 'rejected' ? 15000 : 60000
    const id = setInterval(check, ms)
    return () => clearInterval(id)
  }, [status, check])

  // Qayta so'rov uchun teskari sanoq
  useEffect(() => {
    if (waitUntil <= Date.now()) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [waitUntil])
  const secondsLeft = Math.max(0, Math.ceil((waitUntil - now) / 1000))

  // Admin rad etgan qurilma uchun qayta so'rov
  const requestAgain = async () => {
    setSending(true)
    setNotice('')
    const { data, error } = await supabase.rpc('device_request_again', {
      p_device_id: getDeviceId(),
      p_label: label,
    })
    setSending(false)
    if (error) {
      const m = error.message?.match(/TOO_SOON:(\d+)/)
      if (m) {
        setWaitUntil(Date.now() + Number(m[1]) * 1000)
        setNow(Date.now())
      } else if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) {
        setNotice("Qayta so'rov hali yoqilmagan (009_device_rerequest.sql). Administratorga murojaat qiling.")
      } else {
        setNotice("So'rov yuborilmadi. Internetni tekshirib, qayta urinib ko'ring.")
      }
      return
    }
    setStatus(data)
  }

  // 'setup' — bazada 005_device_approval.sql hali ishga tushirilmagan:
  // xodimlar ishsiz qolmasligi uchun tekshiruvsiz kiritamiz (SQL ishga tushgach o'zi yoqiladi)
  if (status === 'approved' || status === 'setup') return children

  if (status === 'loading') {
    return (
      <Screen>
        <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-3">Qurilma tekshirilmoqda...</p>
      </Screen>
    )
  }

  const views = {
    pending: {
      icon: <LuShieldCheck size={36} />,
      tone: 'bg-amber-50 text-amber-600',
      title: 'Admin tasdiqlashini kuting',
      text: "Siz yangi qurilmadan kiryapsiz. Xavfsizlik uchun adminga so'rov yuborildi. Admin tasdiqlashi bilan sahifa o'zi ochiladi.",
    },
    rejected: {
      icon: <LuCircleX size={36} />,
      tone: 'bg-red-50 text-red-600',
      title: 'Kirish rad etildi',
      text: "Admin bu qurilmadan kirishga ruxsat bermadi. Agar bu xato bo'lsa, adminga qayta so'rov yuboring.",
    },
    setup: {
      icon: <LuShieldCheck size={36} />,
      tone: 'bg-slate-100 text-slate-500',
      title: 'Tizim sozlanmagan',
      text: "Supabase'da 005_device_approval.sql fayli hali ishga tushirilmagan. Administratorga murojaat qiling.",
    },
    error: {
      icon: <LuCircleX size={36} />,
      tone: 'bg-red-50 text-red-600',
      title: "Tekshirib bo'lmadi",
      text: "Internet aloqasini tekshirib, qayta urinib ko'ring.",
    },
  }[status]

  return (
    <Screen>
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${views.tone}`}>
        {views.icon}
      </div>
      <p className="text-xl font-semibold text-slate-900">{views.title}</p>
      <p className="text-sm text-slate-500 mt-2">{views.text}</p>

      <div className="mt-6 inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
        <LuSmartphone size={16} className="text-slate-400" />
        <span className="text-sm text-slate-700">{label}</span>
      </div>

      {status === 'pending' && (
        <p className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-4">
          <LuRefreshCw size={12} className="animate-spin" /> Javob kutilmoqda...
        </p>
      )}

      {notice && <p className="text-sm text-red-600 mt-4">{notice}</p>}

      <div className="mt-8 space-y-2">
        {status === 'rejected' && (
          <button
            id="device-request-again"
            onClick={requestAgain}
            disabled={sending || secondsLeft > 0}
            className="btn-primary w-full"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              : <LuSend size={16} />}
            {secondsLeft > 0
              ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} dan keyin qayta yuborish mumkin`
              : "Qayta so'rov yuborish"}
          </button>
        )}
        {status === 'error' && (
          <button onClick={check} className="btn-primary w-full">Qayta urinish</button>
        )}
        <button onClick={signOut} className="btn-secondary w-full">
          <LuLogOut size={16} /> Chiqish
        </button>
      </div>
    </Screen>
  )
}

function Screen({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-8 text-center">
        {children}
      </div>
    </div>
  )
}
