import { useState } from 'react'
import {
  LuUser, LuMail, LuPhone, LuBriefcase, LuMapPin, LuCalendar,
  LuClock, LuSend, LuCircleCheck,
  LuBadgeCheck,
  LuClipboardList,
  LuCalendarDays,
  LuRefreshCw,
  LuCircleX,
  LuHourglass,
  LuCalendarPlus
} from "react-icons/lu"
import { useAuth } from '../../context/AuthContext'
import { formatTashkentDate, notificationFunctions } from '../../lib/supabase'

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

function getScheduleInfo(schedule) {
  if (!schedule) return null
  const days = schedule.work_days || []
  const isEven = days.length === 3 && days.includes('Mon') && days.includes('Wed') && days.includes('Fri')
  const isOdd = days.length === 3 && days.includes('Tue') && days.includes('Thu') && days.includes('Sat')
  const is52 = days.length === 5 && days.includes('Mon') && days.includes('Tue') && days.includes('Wed') && days.includes('Thu') && days.includes('Fri')

  if (isEven) {
    return {
      title: 'Juft kunlar grafikasi',
      badge: 'Juft kunlar (10:00 — 00:00)',
      desc: 'Dushanba, Chorshanba va Juma kunlari 14 soatlik smena',
      tagColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    }
  }
  if (isOdd) {
    return {
      title: 'Toq kunlar grafikasi',
      badge: 'Toq kunlar (08:00 — 16:00)',
      desc: 'Seshanba, Payshanba va Shanba kunlari 8 soatlik smena',
      tagColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    }
  }
  if (is52) {
    return {
      title: 'Standart haftalik grafik (5/2)',
      badge: 'Standart 5/2 (09:00 — 18:00)',
      desc: 'Dushanbadan Jumagacha 9 soatlik ish kuni',
      tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    }
  }
  return {
    title: 'Maxsus ish grafigi',
    badge: `${days.length} kunlik smena`,
    desc: 'Haftalik maxsus belgilangan ish kunlari',
    tagColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  }
}

export default function EmployeeProfile() {
  const { profile, user } = useAuth()
  const rawEmp = profile?.employees || profile?.employee
  const employee = Array.isArray(rawEmp) ? rawEmp[0] : rawEmp
  const [requestModal, setRequestModal] = useState(false)
  const [requestText, setRequestText]   = useState('')
  const [sending, setSending]           = useState(false)
  const [sent, setSent]                 = useState(false)

  const trial = employee?.employment_trials?.[0]
  const schedule = employee?.work_schedules?.find(s => s.is_active !== false) || employee?.work_schedules?.[0]
  const currentRate = employee?.salary_rates?.find(r => !r.effective_to)
  const schedInfo = getScheduleInfo(schedule)
  const todayDayIndex = new Date().getDay() // 0 = Sun, 1 = Mon ...
  const dayKeyMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayKey = dayKeyMap[todayDayIndex]

  const sendRequest = async () => {
    if (!requestText.trim()) return
    setSending(true)
    try {
      await notificationFunctions.create({
        employee_id:    employee?.id,
        target_role:    'admin',
        type:           'correction_request',
        title:          `Tuzatish so'rovi: ${employee?.full_name}`,
        message:        requestText,
        data:           { employee_id: employee?.id, user_id: user?.id },
      })
      setSent(true)
      setRequestText('')
      setTimeout(() => { setSent(false); setRequestModal(false) }, 2000)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="page-title flex items-center gap-2">
        <LuUser size={18} className="text-blue-400" />
        Mening profilim
      </h1>

      {/* Avatar */}
      <div className="card text-center">
        <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-bold text-gradient">
            {employee?.full_name?.[0] || profile?.email?.[0]?.toUpperCase() || 'X'}
          </span>
        </div>
        <h2 className="text-base font-bold text-dark-100">{employee?.full_name || profile?.email}</h2>
        <p className="page-subtitle">{employee?.position} · {employee?.branch}</p>

        {employee?.status === 'active' && (
          <span className="badge-green mt-2 mx-auto"><LuBadgeCheck size={12} /> Tasdiqlangan xodim</span>
        )}
        {employee?.status === 'trial' && (
          <span className="badge-yellow mt-2 mx-auto"><LuClipboardList size={12} /> Test rejimida</span>
        )}
      </div>

      {/* Info */}
      <div className="card space-y-3">
        <h2 className="section-title">
          Shaxsiy ma'lumotlar
        </h2>

        <InfoItem icon={<LuMail size={14} className="text-dark-500" />} label="Email" value={profile?.email} />
        <InfoItem icon={<LuPhone size={14} className="text-dark-500" />} label="Telefon" value={employee?.phone || '—'} />
        <InfoItem icon={<LuBriefcase size={14} className="text-dark-500" />} label="Lavozim" value={employee?.position} />
        <InfoItem icon={<LuMapPin size={14} className="text-dark-500" />} label="Filial" value={employee?.branch} />
        <InfoItem
          icon={<LuCalendar size={14} className="text-dark-500" />}
          label="Ishga kirgan sana"
          value={employee?.hire_date ? formatTashkentDate(employee.hire_date) : '—'}
        />
        {employee?.confirmed_at && (
          <InfoItem
            icon={<LuCircleCheck size={14} className="text-emerald-400" />}
            label="Tasdiqlangan sana"
            value={formatTashkentDate(employee.confirmed_at)}
          />
        )}
      </div>

      {/* Work schedule - Rich Graphic */}
      {employee?.work_schedules && employee.work_schedules.length > 0 && (
        <div className="card space-y-3.5 border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-slate-900">
              <LuClock size={16} className="text-cyan-400" />
              Ish jadvali va vaqt chegaralari
            </h2>
            {schedInfo && (
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold inline-flex items-center gap-1 ${schedInfo.tagColor}`}>
                <LuCalendarDays size={12} />
                {employee.work_schedules.length > 1 ? 'Har xil vaqt' : schedInfo.badge}
              </span>
            )}
          </div>

          {/* Smena ko'rsatkichlari */}
          <div className="space-y-2">
            {employee.work_schedules.map((s, idx) => {
              const isEven = s.work_days?.includes('Mon') && s.work_days?.includes('Wed')
              const isOdd  = s.work_days?.includes('Tue') && s.work_days?.includes('Thu')
              const title = isEven ? 'Du, Chor, Juma uchun:' : isOdd ? 'Se, Pay, Shan uchun:' : 'Hamma ish kunlari uchun:'
              return (
                <div key={idx} className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-xl p-3.5">
                  <div>
                    <p className="text-xs text-cyan-400 font-semibold mb-0.5">{title}</p>
                    <p className="text-base font-semibold text-slate-900">
                      {s.shift_start} — {s.shift_end}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-dark-500 mb-0.5">Kunlik ish vaqti</p>
                    <p className="text-base font-bold text-emerald-400">
                      {calculateShiftHours(s.shift_start, s.shift_end)} soat
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 7 Kunlik Grafik Bloklari */}
          <div>
            <p className="text-xs font-medium text-dark-400 mb-2">Haftalik grafik taqvimi:</p>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_DAYS.map(day => {
                const match = employee.work_schedules.find(s => (s.work_days || []).includes(day.key))
                const isWork = !!match
                const isToday = day.key === todayKey
                return (
                  <div
                    key={day.key}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-all relative ${
                      isWork
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white border-slate-200 text-slate-400'
                    } ${isToday ? 'ring-2 ring-cyan-400' : ''}`}
                  >
                    {isToday && (
                      <span className="absolute -top-1.5 px-1 bg-cyan-400 text-dark-950 text-xs font-semibold rounded-full">
                        Bugun
                      </span>
                    )}
                    <span className="text-xs font-bold">{day.short}</span>
                    <span className={`text-xs mt-0.5 font-medium ${isWork ? 'text-emerald-400' : 'text-dark-500'}`}>
                      {isWork ? (match.shift_start ? match.shift_start.slice(0, 5) : 'Ish') : 'Dam'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Trial info */}
      {trial && (
        <div className="card space-y-3">
          <h2 className="section-title">
            <LuClipboardList size={16} className="text-amber-500" /> Test rejimi
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
              <p className="text-dark-600 mb-0.5">Boshlandi</p>
              <p className="text-dark-200 font-medium">{formatTashkentDate(trial.trial_start_date)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
              <p className="text-dark-600 mb-0.5">Tugaydi</p>
              <p className="text-dark-200 font-medium">{formatTashkentDate(trial.trial_end_date)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 col-span-2">
              <p className="text-dark-600 mb-0.5">Holat</p>
              <p className={`font-medium flex items-center gap-1.5 ${
                trial.status === 'confirmed' ? 'text-emerald-400' :
                trial.status === 'rejected'  ? 'text-red-400' :
                trial.status === 'in_progress' ? 'text-amber-400' : 'text-dark-300'
              }`}>
                {trial.status === 'in_progress'       ? <><LuRefreshCw size={14} /> Test davom etmoqda</> :
                 trial.status === 'confirmed'          ? <><LuCircleCheck size={14} /> Ishga tasdiqlandi</> :
                 trial.status === 'rejected'           ? <><LuCircleX size={14} /> Qabul qilinmadi</> :
                 trial.status === 'awaiting_decision'  ? <><LuHourglass size={14} /> Qaror kutilmoqda</> :
                 trial.status === 'extended'           ? <><LuCalendarPlus size={14} /> Test muddati uzaytirildi</> :
                 trial.status}
              </p>
              {trial.decision_notes && (
                <p className="text-dark-500 mt-1 italic">"{trial.decision_notes}"</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Request correction */}
      <button
        id="request-correction-btn"
        onClick={() => setRequestModal(true)}
        className="w-full btn-secondary justify-center py-3"
      >
        <LuSend size={14} />
        Administratorga xabar yuborish
      </button>

      {/* Request modal */}
      {requestModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
          onClick={e => e.target === e.currentTarget && setRequestModal(false)}
        >
          <div className="bg-dark-800 border border-dark-700 rounded-t-2xl w-full p-5 space-y-4 animate-slide-in">
            <h2 className="text-base font-semibold text-slate-900">Xabar yuborish</h2>
            <p className="text-xs text-dark-500">
              Ma'lumotlaringizda xatolik bo'lsa yoki tuzatish talab qilsa, administratorga xabar yuboring
            </p>

            {sent ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <LuCircleCheck size={16} className="text-emerald-400" />
                <p className="text-emerald-400 text-sm">Xabar muvaffaqiyatli yuborildi!</p>
              </div>
            ) : (
              <>
                <textarea
                  value={requestText}
                  onChange={e => setRequestText(e.target.value)}
                  placeholder="Nima haqida xabar yubormoqchisiz?"
                  className="input-field resize-none w-full"
                  rows={4}
                />
                <div className="flex gap-2">
                  <button onClick={() => setRequestModal(false)} className="btn-secondary flex-1 justify-center">
                    Bekor qilish
                  </button>
                  <button
                    onClick={sendRequest}
                    disabled={sending || !requestText.trim()}
                    className="btn-primary flex-1 justify-center disabled:opacity-50"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : <LuSend size={14} />}
                    Yuborish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-dark-500">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-xs font-medium text-dark-200 max-w-40 text-right truncate">{value || '—'}</span>
    </div>
  )
}
