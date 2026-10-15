import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LuClock, LuChevronLeft, LuChevronRight, LuArrowRight, LuTriangleAlert, LuReceipt } from 'react-icons/lu'
import { attendanceFunctions, formatMoney } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const TZ = 'Asia/Tashkent'
const MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr']
const WEEKDAYS = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba']
const pad = (n) => String(n).padStart(2, '0')

// Toshkent vaqtidagi Date
const local = (iso) => new Date(new Date(iso).toLocaleString('en-US', { timeZone: TZ }))
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const time = (iso) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

// "2 soat 8 daqiqa", "1 daqiqa 15 soniya", "7 soniya"
function duration(secs) {
  secs = Math.max(0, Math.floor(secs || 0))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return m ? `${h} soat ${m} daqiqa` : `${h} soat`
  if (m > 0) return s ? `${m} daqiqa ${s} soniya` : `${m} daqiqa`
  return `${s} soniya`
}

export default function EmployeeHistory() {
  const { profile } = useAuth()
  const empId = profile?.employees?.id || profile?.employees?.[0]?.id

  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tick, setTick]         = useState(Date.now())

  useEffect(() => {
    if (!empId) return
    let alive = true
    setLoading(true)
    const lastDay = new Date(year, month, 0).getDate()
    attendanceFunctions.getByEmployee(empId, {
      from: `${year}-${pad(month)}-01T00:00:00+05:00`,
      to:   `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+05:00`,
    })
      .then(data => alive && setSessions(data || []))
      .catch(err => console.error(err))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [empId, year, month])

  // Ochiq ish bo'lsa, vaqt jonli o'sib borsin
  useEffect(() => {
    if (!sessions.some(s => s.status === 'open')) return
    const id = setInterval(() => setTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [sessions])

  const goMonth = (delta) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // Kunlar bo'yicha guruhlash (yangisi tepada)
  const days = useMemo(() => {
    const map = {}
    for (const s of sessions) (map[dayKey(s.check_in_at)] ||= []).push(s)
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, list]) => {
        list.sort((a, b) => new Date(a.check_in_at) - new Date(b.check_in_at))
        const rows = list.map(s => {
          const open = s.status === 'open'
          const secs = open ? (tick - new Date(s.check_in_at)) / 1000 : s.worked_seconds
          return { ...s, open, secs }
        })
        return {
          key,
          date: local(list[0].check_in_at),
          rows,
          late: list.find(s => s.lateness_type === 'late'),
          secs: rows.reduce((t, r) => t + (r.secs || 0), 0),
          earned: rows.reduce((t, r) => t + (r.open ? 0 : Number(r.earned_amount) || 0), 0),
          open: rows.some(r => r.open),
        }
      })
  }, [sessions, tick])

  const total = {
    days:   days.length,
    secs:   days.reduce((t, d) => t + d.secs, 0),
    earned: days.reduce((t, d) => t + d.earned, 0),
  }
  const rate = sessions.find(s => s.hourly_rate_snapshot > 0)?.hourly_rate_snapshot

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Sarlavha va oy */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Davomat</h1>
        <div className="flex items-center bg-white border border-slate-300 rounded-lg h-10">
          <button onClick={() => goMonth(-1)} className="px-2.5 h-full text-slate-500 hover:text-slate-900 cursor-pointer" aria-label="Oldingi oy">
            <LuChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-slate-900 w-28 text-center capitalize">{MONTHS[month - 1]} {year}</span>
          <button
            onClick={() => goMonth(1)}
            disabled={isCurrentMonth}
            className="px-2.5 h-full text-slate-500 hover:text-slate-900 disabled:text-slate-200 cursor-pointer disabled:cursor-default"
            aria-label="Keyingi oy"
          >
            <LuChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Oy natijasi */}
      <div className="card p-0">
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <Summary label="Ishladi" value={`${total.days} kun`} />
          <Summary label="Vaqt" value={duration(total.secs).replace(/ (\d+ soniya)$/, '')} />
          <Summary label="Topdi" value={formatMoney(total.earned)} accent />
        </div>
        {rate && (
          <p className="text-xs text-slate-500 text-center border-t border-slate-100 py-2">
            Bir soatlik maoshingiz: {formatMoney(rate)}
          </p>
        )}
      </div>

      {/* Kunlar */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : days.length === 0 ? (
        <div className="card text-center py-10">
          <LuClock size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">
            {MONTHS[month - 1].charAt(0).toUpperCase() + MONTHS[month - 1].slice(1)} oyida ishlagan kuningiz yo'q
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map(d => (
            <div key={d.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Kun sarlavhasi */}
              <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">
                    {d.date.getDate()}-{MONTHS[d.date.getMonth()]}
                  </p>
                  <p className="text-xs text-slate-500">{WEEKDAYS[d.date.getDay()]}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-semibold text-slate-900 tabular-nums">
                    {d.open && !d.earned ? '—' : formatMoney(d.earned)}
                  </p>
                  <p className="text-xs text-slate-500">{duration(d.secs)}</p>
                </div>
              </div>

              {d.late && (
                <div className="mx-4 mb-2 inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1">
                  <LuTriangleAlert size={12} /> {d.late.lateness_minutes} daqiqa kechikib keldingiz
                </div>
              )}

              {/* Kelish-ketishlar */}
              <div className="border-t border-slate-100 divide-y divide-slate-100">
                {d.rows.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm text-slate-900 tabular-nums">
                        <span>{time(r.check_in_at)}</span>
                        <LuArrowRight size={13} className="text-slate-400" />
                        {r.open
                          ? <span className="text-emerald-700 font-medium">hali ishdasiz</span>
                          : <span>{time(r.check_out_at)}</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {duration(r.secs)}
                        {r.admin_corrected && ' · admin tuzatgan'}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {r.open ? '' : formatMoney(r.earned_amount)}
                    </p>
                  </div>
                ))}
              </div>

              {d.rows.some(r => r.correction_reason) && (
                <p className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
                  Tuzatish sababi: {d.rows.find(r => r.correction_reason).correction_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* To'lovlar boshqa bo'limda */}
      <Link to="/payslip" className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-slate-300">
        <span className="flex items-center gap-2.5 text-sm text-slate-700">
          <LuReceipt size={18} className="text-slate-400" />
          Qancha pul berilgani va qolgani — «Oylik» bo'limida
        </span>
        <LuChevronRight size={16} className="text-slate-400 flex-shrink-0" />
      </Link>
    </div>
  )
}

function Summary({ label, value, accent }) {
  return (
    <div className="px-3 py-3.5 text-center min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold mt-1 leading-tight ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
