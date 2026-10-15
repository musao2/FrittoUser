import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LuClock, LuScanLine, LuCircleAlert, LuCircleCheck,
  LuTrendingUp, LuDollarSign, LuWallet, LuCalendar, LuChevronRight,
  LuBriefcase,
  LuCoffee,
  LuClipboardList
} from "react-icons/lu"
import {
  attendanceFunctions, salaryRateFunctions, employeeFunctions,
  advanceFunctions, formatDuration, formatMoney, formatTashkentDateTime, formatTashkentTime, supabase
} from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

const WEEK_DAYS = [
  { key: 'Mon', short: 'Du', full: 'Dushanba' },
  { key: 'Tue', short: 'Se', full: 'Seshanba' },
  { key: 'Wed', short: 'Chor', full: 'Chorshanba' },
  { key: 'Thu', short: 'Pay', full: 'Payshanba' },
  { key: 'Fri', short: 'Ju', full: 'Juma' },
  { key: 'Sat', short: 'Sha', full: 'Shanba' },
  { key: 'Sun', short: 'Yak', full: 'Yakshanba' },
]

function calculateShiftHours(start, end) {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff <= 0) diff += 24 * 60
  return (diff / 60).toFixed(diff % 60 === 0 ? 0 : 1)
}

function getScheduleBadge(schedule) {
  if (!schedule) return null
  const days = schedule.work_days || []
  const isEven = days.length === 3 && days.includes('Mon') && days.includes('Wed') && days.includes('Fri')
  const isOdd = days.length === 3 && days.includes('Tue') && days.includes('Thu') && days.includes('Sat')
  const is52 = days.length === 5 && days.includes('Mon') && days.includes('Tue') && days.includes('Wed') && days.includes('Thu') && days.includes('Fri')

  if (isEven) return 'Juft kunlar (10:00 — 00:00)'
  if (isOdd) return 'Toq kunlar (08:00 — 16:00)'
  if (is52) return 'Standart 5/2'
  return `${days.length} kunlik grafik`
}

export default function EmployeeDashboard() {
  const { profile } = useAuth()
  const [employee, setEmployee]         = useState(null)
  const [openSession, setOpenSession]   = useState(null)
  const [currentRate, setCurrentRate]   = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [monthStats, setMonthStats]     = useState({ worked: 0, earned: 0 })
  const [totalAdvances, setTotalAdvances] = useState(0)
  const [advancesList, setAdvancesList]   = useState([])
  const [totalPaid, setTotalPaid]         = useState(0)
  const [loading, setLoading]           = useState(true)
  const [message, setMessage]           = useState(null)
  const [liveSeconds, setLiveSeconds]   = useState(0)
  const timerRef = useRef(null)

  const now = new Date()

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const load = useCallback(async () => {
    if (!profile?.employees) {
      setLoading(false)
      return
    }
    const empId = profile.employees.id || profile.employees[0]?.id
    if (!empId) { setLoading(false); return }

    try {
      // Har safar hozirgi oyni qaytadan olamiz — oy almashsa, hisob ham yangi oyga o'tadi
      const now = new Date()
      const [emp, session, rate, sessions] = await Promise.all([
        employeeFunctions.getById(empId),
        attendanceFunctions.getOpenSession(empId),
        salaryRateFunctions.getCurrent(empId),
        attendanceFunctions.getByEmployee(empId, {
          from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        }),
      ])

      setEmployee(emp)
      setOpenSession(session)
      setCurrentRate(rate)
      setRecentSessions(sessions.slice(0, 5))

      // Bu oy statistikasi
      const closedSessions = sessions.filter(s => s.status === 'closed' || s.status === 'corrected')
      const totalWorked = closedSessions.reduce((s, sess) => s + (sess.worked_seconds || 0), 0)
      const totalEarned = closedSessions.reduce((s, sess) => s + (sess.earned_amount || 0), 0)
      setMonthStats({ worked: totalWorked, earned: totalEarned })

      // Bu oy avanslar
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      // Bu oy oyligi uchun berilgan pullar — faqat shu oy hisobiga bog'langan to'lovlar
      // (oktabrda sentabr oyligi berilsa, u oktabrga qo'shilib ketmasin)
      const { data: period } = await supabase
        .from('payroll_periods')
        .select('id')
        .eq('year', now.getFullYear())
        .eq('month', now.getMonth() + 1)
        .maybeSingle()
      const { data: item } = period
        ? await supabase.from('payroll_items').select('id').eq('period_id', period.id).eq('employee_id', empId).maybeSingle()
        : { data: null }

      const [advTotal, allAdvs, paymentsRes] = await Promise.all([
        advanceFunctions.getTotalByEmployee(empId, periodStart, periodEnd),
        advanceFunctions.getByEmployee(empId),
        item
          ? supabase.from('payments').select('amount').eq('payroll_item_id', item.id)
          : Promise.resolve({ data: [] }),
      ])
      setTotalAdvances(advTotal)
      setAdvancesList(allAdvs.filter(a =>
        a.status === 'active' &&
        new Date(a.created_at) >= new Date(periodStart) &&
        new Date(a.created_at) <= new Date(periodEnd)
      ))

      const paidSum = (paymentsRes.data || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      setTotalPaid(paidSum)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  // Live timer
  useEffect(() => {
    if (openSession) {
      const updateTimer = () => {
        const diff = Math.floor((Date.now() - new Date(openSession.check_in_at).getTime()) / 1000)
        setLiveSeconds(diff)
      }
      updateTimer()
      timerRef.current = setInterval(updateTimer, 1000)
    } else {
      setLiveSeconds(0)
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [openSession])

  const netBalance = monthStats.earned - totalAdvances
  const remainingPayable = Math.max(0, netBalance - totalPaid)
  const netPayable = Math.max(0, netBalance)

  const greeting = () => {
    const h = now.getHours()
    if (h < 6)  return 'Xayrli tun'
    if (h < 12) return 'Xayrli tong'
    if (h < 18) return 'Xayrli kun'
    return 'Xayrli kech'
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-dark-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <LuCircleAlert size={36} className="mx-auto text-amber-400 mb-3" />
          <p className="text-dark-300 font-medium">Profil topilmadi</p>
          <p className="text-dark-500 text-sm mt-1">
            Administrator bilan bog'laning
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-dark-500 text-sm">{greeting()},</p>
          <h1 className="page-title">{employee.full_name}</h1>
          <p className="page-subtitle">
            {now.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-dark-600">{employee.position}</p>
          <p className="text-xs text-dark-600">{employee.branch}</p>
          {currentRate && (
            <p className="text-xs text-emerald-400 mt-0.5">{formatMoney(currentRate.hourly_rate)}/soat</p>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm animate-fade-in flex items-start gap-2 ${
          message.type === 'error'
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
        }`}>
          {message.type === 'error' ? <LuCircleAlert size={16} className="mt-0.5 flex-shrink-0" /> : <LuCircleCheck size={16} className="mt-0.5 flex-shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Smena va grafik kartasi */}
      {(() => {
        const schedules = employee?.work_schedules || []
        if (schedules.length === 0) return null
        const dayKeyMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const todayKey = dayKeyMap[now.getDay()]
        const todaySchedule = schedules.find(s => (s.work_days || []).includes(todayKey))
        const isTodayWorkDay = !!todaySchedule
        const activeSchedule = todaySchedule || schedules[0]
        const badgeText = getScheduleBadge(activeSchedule)

        return (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LuClock size={15} className="text-cyan-400" />
                <span className="text-xs font-bold text-slate-900">
                  {isTodayWorkDay
                    ? <span className="inline-flex items-center gap-1">Bugun ish kuni <LuBriefcase size={13} className="text-emerald-600" /></span>
                    : <span className="inline-flex items-center gap-1">Bugun dam olish kuni <LuCoffee size={13} className="text-amber-600" /></span>}
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                isTodayWorkDay
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-dark-700 text-dark-400 border-dark-600'
              }`}>
                {isTodayWorkDay ? `${activeSchedule.shift_start} — ${activeSchedule.shift_end}` : badgeText}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
              <span className="text-dark-400 text-xs">
                {isTodayWorkDay ? 'Bugungi smena:' : 'Standart smena:'}
              </span>
              <span className="font-semibold text-dark-100 font-mono">
                {activeSchedule.shift_start} — {activeSchedule.shift_end} ({calculateShiftHours(activeSchedule.shift_start, activeSchedule.shift_end)} soat)
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map(day => {
                const match = schedules.find(s => (s.work_days || []).includes(day.key))
                const isWork = !!match
                const isToday = day.key === todayKey
                return (
                  <div
                    key={day.key}
                    className={`flex flex-col items-center justify-center py-1.5 rounded-lg border text-center transition-all ${
                      isWork
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-dark-900/40 border-dark-700/30 text-dark-600'
                    } ${isToday ? 'ring-1.5 ring-cyan-400 font-bold' : ''}`}
                  >
                    <span className="text-xs">{day.short}</span>
                    <span className={`text-xs mt-0.5 ${isWork ? 'text-emerald-400 font-semibold' : 'text-dark-500'}`}>
                      {isWork ? 'Ish' : 'Dam'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Session status */}
      <div className={`rounded-xl p-5 border transition-all ${
        openSession
          ? 'bg-emerald-500/5 border-emerald-500/20 glow-green'
          : 'bg-dark-800 border-dark-700'
      }`}>
        {openSession ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="live-dot w-2 h-2 bg-emerald-500 rounded-full" />
              <span className="text-emerald-400 text-sm font-medium">Ish vaqti davom etmoqda</span>
            </div>
            <p className="text-4xl font-mono font-semibold text-emerald-800 mb-1">
              {new Date(liveSeconds * 1000).toISOString().substr(11, 8)}
            </p>
            <p className="text-xs text-dark-500 mb-1">
              Boshlangan: {formatTashkentTime(openSession.check_in_at)}
            </p>
            {currentRate && (
              <p className="text-xs text-emerald-400">
                ≈ {formatMoney((liveSeconds / 3600) * currentRate.hourly_rate)} hisoblandi
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            <LuClock size={32} className="mx-auto text-dark-600 mb-2" />
            <p className="text-dark-400 text-sm">Bugun hali ish boshlanmagan</p>
            <p className="text-dark-600 text-xs mt-0.5">Ishni boshlash uchun QR kodni skanerlang</p>
          </div>
        )}
      </div>

      {/* QR orqali kelish / ketish */}
      <Link
        to="/scanner"
        id="employee-scan-btn"
        className="flex items-center justify-center gap-3 w-full h-16 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-base font-semibold transition-colors"
      >
        <LuScanLine size={24} />
        {openSession ? 'Ketdim — QR skanerlash' : 'Keldim — QR skanerlash'}
      </Link>
      <p className="text-xs text-slate-500 text-center -mt-2">
        Ish joyidagi ekrandagi QR kodni skanerlang
      </p>

      {/* Trial status */}
      {employee.employment_trials?.[0] && employee.status === 'trial' && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-amber-600 flex items-center gap-1.5"><LuClipboardList size={14} /> Test rejimi</p>
            <span className="text-xs text-dark-500">
              {employee.employment_trials[0].status === 'in_progress'
                ? `${Math.min(5, Math.floor((Date.now() - new Date(employee.employment_trials[0].trial_start_date)) / (1000 * 60 * 60 * 24)) + 1)}/5 kun`
                : employee.employment_trials[0].status
              }
            </span>
          </div>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((Math.floor((Date.now() - new Date(employee.employment_trials[0].trial_start_date)) / (1000 * 60 * 60 * 24)) + 1) / 5) * 100)}%`
              }}
            />
          </div>
          <p className="text-xs text-dark-500 mt-1.5">
            Tugaydi: {new Date(employee.employment_trials[0].trial_end_date).toLocaleDateString('uz-UZ')}
          </p>
        </div>
      )}

      {/* Monthly Financial Breakdown (Avans ayirib ko'rsatiladi) */}
      <div className="card bg-white border-slate-200 p-4 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <LuDollarSign size={16} className="text-emerald-400" />
            <h2 className="section-title">Bu oylik hisob-kitob va balans</h2>
          </div>
          <span className="text-xs text-dark-500">
            {now.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* 4 ta ixcham ko'rsatkich */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <p className="text-xs text-dark-400">Ishlangan vaqt</p>
            <p className="text-sm font-bold text-dark-100 mt-0.5">{formatDuration(monthStats.worked)}</p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <p className="text-xs text-dark-400">Hisoblangan ish haqi</p>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">+{formatMoney(monthStats.earned)}</p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <p className="text-xs text-dark-400 flex items-center gap-1">
              <LuWallet size={11} className="text-purple-400" /> Olingan avans
            </p>
            <p className="text-sm font-bold text-purple-400 mt-0.5">
              {totalAdvances > 0 ? `-${formatMoney(totalAdvances)}` : '0 so\'m'}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl border ${
            totalPaid > 0 && remainingPayable === 0
              ? 'bg-emerald-50 border-emerald-300'
              : netBalance >= 0
              ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <p className="text-xs text-dark-400">
              {totalPaid > 0 && remainingPayable === 0
                ? "To'langan maosh"
                : netBalance >= 0
                ? "Qo'lga tegadigan summa"
                : "Avans qarzdorligi"}
            </p>
            <p className={`text-sm font-bold mt-0.5 ${
              totalPaid > 0 && remainingPayable === 0
                ? 'text-emerald-700'
                : netBalance >= 0
                ? 'text-amber-500'
                : 'text-red-500'
            }`}>
              {totalPaid > 0 && remainingPayable === 0
                ? <span className="inline-flex items-center gap-1">{formatMoney(totalPaid)} <LuCircleCheck size={14} /></span>
                : formatMoney(Math.abs(remainingPayable))}
            </p>
          </div>
        </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-dark-300">
            <span>Umumiy ishlab topildi:</span>
            <span className="font-medium text-emerald-400">+{formatMoney(monthStats.earned)}</span>
          </div>
          <div className="flex justify-between items-center text-dark-300">
            <span className="text-purple-400">Ushlab qolingan avans:</span>
            <span className="font-medium text-purple-400">-{formatMoney(totalAdvances)}</span>
          </div>
          {totalPaid > 0 && (
            <div className="flex justify-between items-center text-dark-300">
              <span className="text-emerald-400 font-medium">To'langan oylik (Kassadan):</span>
              <span className="font-bold text-emerald-400">-{formatMoney(totalPaid)}</span>
            </div>
          )}
          <div className="pt-1.5 border-t border-dark-800 flex justify-between items-center font-semibold">
            <span className="text-dark-200">
              {totalPaid > 0 && remainingPayable === 0 ? "Holat:" : "Sof qoldiq (To'lanadigan):"}
            </span>
            <span className={totalPaid > 0 && remainingPayable === 0 ? 'text-emerald-400 font-bold' : netBalance >= 0 ? 'text-amber-400' : 'text-red-400'}>
              {totalPaid > 0 && remainingPayable === 0
                ? <span className="inline-flex items-center gap-1">0 so'm (to'liq to'langan) <LuCircleCheck size={14} /></span>
                : formatMoney(remainingPayable)
              }
            </span>
          </div>
        </div>
      </div>

      {/* Olingan avanslar ro'yxati (Agar avans olingan bo'lsa) */}
      {advancesList.length > 0 && (
        <div className="card bg-white border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LuWallet size={16} className="text-purple-400" />
              <h2 className="section-title">Olingan avanslar tarixi</h2>
            </div>
            <span className="badge badge-purple text-xs">{advancesList.length} ta</span>
          </div>

          <div className="space-y-2">
            {advancesList.map(adv => (
              <div key={adv.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl text-xs border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-400">-{formatMoney(adv.amount)}</span>
                    <span className="text-xs bg-dark-900 text-dark-400 px-1.5 py-0.5 rounded">
                      {adv.payment_type === 'cash' ? 'Naqd' : adv.payment_type === 'card' ? 'Karta' : 'O\'tkazma'}
                    </span>
                  </div>
                  <p className="text-xs text-dark-500 mt-1">
                    {formatTashkentDateTime(adv.created_at)}
                  </p>
                  {adv.notes && (
                    <p className="text-xs text-dark-400 mt-0.5 italic">
                      "{adv.notes}"
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    Maoshdan chegirildi
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-dark-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            ℹ️ Olingan avanslar umumiy hisoblangan ish haqingizdan avtomatik ravishda ayirib ko‘rsatiladi.
          </p>
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-dark-200 flex items-center gap-2">
            <LuClock size={14} className="text-cyan-400" />
            Oxirgi smenalar
          </h2>
          <Link to="/history" className="text-xs text-emerald-400 flex items-center gap-1 hover:text-emerald-300">
            Barchasi <LuChevronRight size={12} />
          </Link>
        </div>
        {recentSessions.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-dark-600 text-sm">Hali ish tarixi yo'q</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map(sess => (
              <div key={sess.id} className="card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-dark-400">
                      {new Date(sess.check_in_at).toLocaleDateString('uz-UZ', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </p>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {formatTashkentTime(sess.check_in_at)}
                      {sess.check_out_at && ` → ${formatTashkentTime(sess.check_out_at)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {sess.status === 'open' ? (
                      <span className="badge-yellow text-xs">Ochiq</span>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-dark-300">{formatDuration(sess.worked_seconds)}</p>
                        <p className="text-xs text-emerald-400 font-medium">{formatMoney(sess.earned_amount)}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
