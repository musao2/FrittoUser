import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LuReceipt,
  LuFileText,
  LuWallet,
  LuPrinter,
  LuCalendar,
  LuCircleCheck,
  LuSparkles,
  LuCalculator,
  LuHourglass
} from "react-icons/lu"
import {
  payrollFunctions,
  formatMoney,
  formatDuration,
  formatTashkentDateTime,
  supabase
} from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const MONTHS = [
  'Yanvar','Fevral','Mart','Aprel','May','Iyun',
  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'
]

export default function EmployeePayslip() {
  const { profile } = useAuth()
  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth() + 1)
  const [payrollItem, setPayrollItem] = useState(null)
  const [advances, setAdvances] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [hourlyRate, setHourlyRate]   = useState(null)
  const [loading, setLoading]   = useState(true)

  const employeeData = profile?.employee || (Array.isArray(profile?.employees) ? profile.employees[0] : profile?.employees)

  // Tez-tez oy almashtirilsa, faqat oxirgi tanlangan oy javobi ko'rsatilsin
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (!profile) return
    const empId = employeeData?.id
    if (!empId) return

    const req = ++requestRef.current
    // Oy almashganda eski oyning cheki ekranda qolib ketmasligi uchun avval tozalaymiz
    setLoading(true)
    setPayrollItem(null)
    setAdvances([])
    setAdjustments([])

    try {
      // Faqat shu oyning hisobini qidiramiz (xodim yangi oy yarata olmaydi — buni admin qiladi)
      const { data: period, error: periodErr } = await supabase
        .from('payroll_periods')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle()
      if (periodErr) throw periodErr

      const pad = (n) => String(n).padStart(2, '0')
      const lastDay = new Date(year, month, 0).getDate()
      const from = `${year}-${pad(month)}-01T00:00:00+05:00`
      const to   = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+05:00`

      const [items, advRes, adjRes, rateRes] = await Promise.all([
        period ? payrollFunctions.getItems(period.id, empId) : Promise.resolve([]),
        // Avanslar — faqat shu oyda olinganlari
        supabase
          .from('advances')
          .select('*')
          .eq('employee_id', empId)
          .eq('status', 'active')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at', { ascending: false }),
        period
          ? supabase
              .from('payroll_adjustments')
              .select('*')
              .eq('employee_id', empId)
              .eq('period_id', period.id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('salary_rates')
          .select('hourly_rate')
          .eq('employee_id', empId)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (req !== requestRef.current) return

      setPayrollItem((items || []).find(i => i.employee_id === empId) || null)
      setAdvances(advRes.data || [])
      setAdjustments(adjRes.data || [])
      setHourlyRate(rateRes.data?.hourly_rate || null)
    } catch (err) {
      console.error(err)
    } finally {
      if (req === requestRef.current) setLoading(false)
    }
  }, [profile, employeeData, year, month])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      {/* Page Title & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <LuReceipt size={20} className="text-emerald-700" />
            Oylik hisob-kitob va chek
          </h1>
          <p className="page-subtitle">
            Sizning oylik maoshingiz va to'lov kvitansiyangiz
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="input-field flex-1 font-semibold text-xs"
          >
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="input-field w-24 font-semibold text-xs"
          >
            {[0, 1, 2, 3].map(i => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !payrollItem ? (
        <div className="card text-center py-12">
          <LuFileText size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-600 font-bold text-sm">Ushbu oy uchun hisob-kitob mavjud emas</p>
          <p className="text-slate-400 text-xs mt-1">Admin tomonidan hisob-kitob amalga oshirilgach shu yerda chiqadi</p>
        </div>
      ) : (
        /* ======================================================== */
        /* RASMIY OYLIK HISOB-KITOB CHEKI (PAYSLIP RECEIPT CARD)     */
        /* ======================================================== */
        <div
          id="printable-receipt"
          className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden relative font-sans text-slate-800"
        >
          {/* Top Emerald Gradient Line */}
          <div className="h-3 bg-emerald-600" />

          <div className="p-5 sm:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-slate-950 font-semibold text-lg flex items-center justify-center">
                  F
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 leading-none">
                    FRITTO HR MANAGEMENT
                  </h2>
                  <p className="text-xs font-bold text-emerald-700 mt-1">
                    Xodim hisob-kitob kvitansiyasi
                  </p>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors print:hidden"
                title="Chekni chop etish"
              >
                <LuPrinter size={16} />
              </button>
            </div>

            {/* Chek raqami va davri */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-xs">Chek kodi:</span>
                <span className="font-mono font-bold text-slate-800">
                  #CHK-{year}{String(month).padStart(2,'0')}-{payrollItem.id ? payrollItem.id.slice(0,6).toUpperCase() : '0000'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-semibold block text-xs">Davr:</span>
                <span className="font-bold text-emerald-800">
                  {MONTHS[month - 1]} {year}
                </span>
              </div>
            </div>

            {/* Xodim nomi va lavozimi */}
            <div className="space-y-1 pt-1">
              <p className="text-xs font-bold text-slate-400">Xodim:</p>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  {employeeData?.full_name || profile?.full_name || profile?.email}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                  {employeeData?.branch || 'Asosiy filial'}
                </span>
              </div>
              <p className="text-xs font-semibold text-emerald-700">
                {employeeData?.position || 'Xodim'}
                {hourlyRate && (
                  <span className="text-slate-500 font-normal ml-2">
                    (Stavka: {formatMoney(hourlyRate)}/soat)
                  </span>
                )}
              </p>
            </div>

            {/* Dashed line */}
            <div className="border-b-2 border-dashed border-slate-200 my-3" />

            {/* Ish davomati */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-slate-400 block text-xs">Ishlangan kunlar:</span>
                <span className="text-sm font-semibold text-slate-800">{payrollItem.worked_days || 0} kun</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-xs">Ishlangan vaqt:</span>
                <span className="text-sm font-semibold text-slate-800">{formatDuration(payrollItem.total_worked_seconds)}</span>
              </div>
            </div>

            {/* Daromadlar va hisoblangan maosh */}
            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600 font-semibold">Hisoblangan asosiy maosh:</span>
                <span className="font-semibold text-slate-900 text-sm">+{formatMoney(payrollItem.total_earned)}</span>
              </div>

              {/* Bonuslar ro'yxati */}
              {payrollItem.total_bonuses > 0 && (
                <div className="bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-200 space-y-1">
                  <div className="flex justify-between items-center text-emerald-800 font-bold">
                    <span className="flex items-center gap-1">
                      <LuSparkles size={13} className="text-emerald-700" />
                      Bonuslar:
                    </span>
                    <span>+{formatMoney(payrollItem.total_bonuses)}</span>
                  </div>
                  {adjustments.filter(a => a.type === 'bonus').map(b => (
                    <p key={b.id} className="text-xs text-emerald-700 pl-4">
                      • {b.reason}: +{formatMoney(b.amount)}
                    </p>
                  ))}
                </div>
              )}

              {/* Chegirmalar ro'yxati */}
              {payrollItem.total_deductions > 0 && (
                <div className="bg-red-50/70 rounded-xl p-2.5 border border-red-200 space-y-1">
                  <div className="flex justify-between items-center text-red-800 font-bold">
                    <span>Chegirmalar / Jarimalar:</span>
                    <span>-{formatMoney(payrollItem.total_deductions)}</span>
                  </div>
                  {adjustments.filter(a => a.type === 'deduction').map(d => (
                    <p key={d.id} className="text-xs text-red-700 pl-4">
                      • {d.reason}: -{formatMoney(d.amount)}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Dashed line */}
            <div className="border-b-2 border-dashed border-slate-200 my-3" />

            {/* ======================================================== */}
            {/* OLINGAN AVANSLAR RO'YXATI (QACHON OLGAN, QANCHA OLGAN)  */}
            {/* ======================================================== */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <LuWallet size={14} className="text-purple-600" />
                  Olingan avanslar tarixi (Sanalari bilan)
                </p>
                <span className="text-xs font-semibold text-purple-700">
                  {payrollItem.total_advances > 0 ? `-${formatMoney(payrollItem.total_advances)}` : '0 so\'m'}
                </span>
              </div>

              {advances.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {advances.map(adv => (
                    <div
                      key={adv.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-purple-50/60 border border-purple-200/80 text-xs"
                    >
                      <div>
                        {/* Qachon olingan sana va vaqt */}
                        <p className="font-bold text-slate-800 text-xs flex items-center gap-1">
                          <LuCalendar size={11} className="text-purple-600" />
                          {formatTashkentDateTime(adv.created_at)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-semibold bg-white border border-purple-200 text-purple-700 px-1.5 py-0.2 rounded">
                            {adv.payment_type === 'cash' ? 'Naqd pul' : adv.payment_type === 'card' ? 'Karta' : "O'tkazma"}
                          </span>
                          {adv.notes && (
                            <span className="text-xs text-slate-500 italic truncate max-w-44">
                              "{adv.notes}"
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-purple-700 text-xs">
                        -{formatMoney(adv.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-center text-xs text-slate-500 font-medium">
                  Ushbu oyda avans olinmagan (0 so'm)
                </div>
              )}
            </div>

            {/* Dashed line */}
            <div className="border-b-2 border-dashed border-slate-200 my-3" />

            {/* ======================================================= */}
            {/* OYLIK MATEMATIK HISOB-KITOBI (ODDIY VA ANIQ FORMULA) */}
            {/* ======================================================= */}
            {(() => {
              const baseEarned = payrollItem.total_earned || 0
              const bonusSum = payrollItem.total_bonuses || 0
              const grossTotal = baseEarned + bonusSum
              const advSum = payrollItem.total_advances || 0
              const dedSum = payrollItem.total_deductions || 0
              const deductionsTotal = advSum + dedSum
              const netTotal = payrollItem.net_payable

              return (
                <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200 space-y-3 font-sans">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <LuCalculator size={15} className="text-emerald-700" />
                      Oylik matematik formulasi (Tushunarli hisob)
                    </span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                      Oddiy formula
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* 1. Daromadlar */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200/80 space-y-1.5">
                      <p className="text-xs font-bold text-slate-400">
                        1. JAMI ISHLAB TOPILGAN DAROMAD:
                      </p>
                      <div className="flex justify-between items-center text-slate-700">
                        <span>• Asosiy ishlangan soatlar uchun:</span>
                        <span className="font-bold text-slate-900">+{formatMoney(baseEarned)}</span>
                      </div>
                      {bonusSum > 0 && (
                        <div className="flex justify-between items-center text-emerald-700">
                          <span>• Yaxshi ishlagani uchun bonuslar:</span>
                          <span className="font-bold">+{formatMoney(bonusSum)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 font-semibold text-emerald-800">
                        <span>JAMI ISHLAB TOPILDI (A):</span>
                        <span className="text-sm font-semibold">+{formatMoney(grossTotal)}</span>
                      </div>
                    </div>

                    {/* 2. Ayirmalar (Avans + Jarima) */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200/80 space-y-1.5">
                      <p className="text-xs font-bold text-slate-400">
                        2. USHLAB QOLINGAN SUMMALAR (AYIRMALAR):
                      </p>
                      <div className="flex justify-between items-center text-purple-700">
                        <span>• Olingan avanslar (Oldindan to'langan):</span>
                        <span className="font-bold">-{formatMoney(advSum)}</span>
                      </div>
                      {dedSum > 0 && (
                        <div className="flex justify-between items-center text-red-600">
                          <span>• Jarimalar (Kechikish/kamchiliklar):</span>
                          <span className="font-bold">-{formatMoney(dedSum)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 font-semibold text-red-700">
                        <span>JAMI USHLAB QOLINDI (B):</span>
                        <span className="text-sm font-semibold">-{formatMoney(deductionsTotal)}</span>
                      </div>
                    </div>

                    {/* 3. Matematik Tenglama */}
                    <div className="p-3 bg-emerald-50/90 rounded-xl border border-emerald-300 space-y-1">
                      <p className="text-xs font-semibold text-emerald-900 text-center">
                        HISOB-KITOB TENGLAMASI: (A) - (B)
                      </p>
                      <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-slate-800 flex-wrap py-1">
                        <span className="text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                          +{formatMoney(grossTotal)}
                        </span>
                        <span className="text-slate-500 font-semibold text-sm">-</span>
                        <span className="text-red-600 bg-white px-2 py-0.5 rounded-lg border border-red-200">
                          {formatMoney(deductionsTotal)}
                        </span>
                        <span className="text-slate-500 font-semibold text-sm">=</span>
                        <span className="text-emerald-900 font-semibold bg-emerald-200/80 px-2.5 py-0.5 rounded-lg border border-emerald-400 text-sm">
                          {formatMoney(netTotal)}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 text-center font-medium">
                        {payrollItem.status === 'paid'
                          ? "Ushbu sof maosh xodimga to'liq to'lab berilgan"
                          : "Ishlab topilgan maoshdan avans va jarimalar to'liq ayirib ko'rsatildi."}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Dashed line */}
            <div className="border-b-2 border-dashed border-slate-200 my-3" />

            {/* QO'LGA TEGADIGAN SOF SUMMA / QOLDIQ */}
            <div className={`p-4 rounded-xl border-2 text-center space-y-1 ${
              payrollItem.status === 'paid'
                ? 'bg-emerald-50 border-emerald-500'
                : payrollItem.status === 'partial' || (payrollItem.remaining_payable > 0 && payrollItem.paid_amount > 0)
                ? 'bg-amber-50 border-amber-400'
                : 'bg-emerald-50 border-emerald-500'
            }`}>
              <p className="text-xs font-semibold text-slate-700">
                {payrollItem.status === 'paid'
                  ? "To'langan sof summa"
                  : payrollItem.status === 'partial' || (payrollItem.remaining_payable > 0 && payrollItem.paid_amount > 0)
                  ? "To'lash kerak bo'lgan qoldiq summa"
                  : "Qo'lga tegadigan sof summa"}
              </p>
              <p className={`text-3xl font-semibold ${
                payrollItem.status === 'partial' || (payrollItem.remaining_payable > 0 && payrollItem.paid_amount > 0)
                  ? 'text-amber-800'
                  : 'text-emerald-700'
              }`}>
                {formatMoney(
                  payrollItem.remaining_payable !== undefined
                    ? payrollItem.remaining_payable
                    : payrollItem.net_payable
                )}
              </p>
              {payrollItem.paid_amount > 0 && (
                <div className="pt-1 flex items-center justify-center gap-3 text-xs font-bold text-emerald-800 flex-wrap">
                  <span className="inline-flex items-center gap-1"><LuCircleCheck size={12} /> Oldin to'langan: +{formatMoney(payrollItem.paid_amount)}</span>
                  <span>• Jami oylik: {formatMoney(payrollItem.net_payable)}</span>
                </div>
              )}
            </div>

            {/* To'lov Holati */}
            <div className="pt-1">
              {payrollItem.status === 'paid' ? (
                <div className="p-3 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-900 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <LuCircleCheck size={16} className="text-emerald-700" />
                      To'langan
                    </p>
                    {payrollItem.paid_at && (
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Sana: {formatTashkentDateTime(payrollItem.paid_at)}
                      </p>
                    )}
                  </div>
                  <span className="font-bold bg-white text-emerald-800 px-2.5 py-1 rounded-xl border border-emerald-200">
                    Kassadan to'liq berildi
                  </span>
                </div>
              ) : payrollItem.status === 'partial' || (payrollItem.remaining_payable > 0 && payrollItem.paid_amount > 0) ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      TO'LASH KERAK (QOLDIQ)
                    </p>
                    <p className="text-xs text-amber-800 mt-1">
                      Oldin to'langan: <strong>{formatMoney(payrollItem.paid_amount || 0)}</strong> | 
                      Jami oylik: <strong>{formatMoney(payrollItem.net_payable || 0)}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-sm text-amber-950 bg-amber-200/90 border border-amber-300 px-3 py-1.5 rounded-xl block">
                      To'lash kerak: {formatMoney(payrollItem.remaining_payable || 0)}
                    </span>
                    <span className="text-xs text-amber-700 font-bold block mt-0.5">
                      Yangi ishlangan soatlar uchun
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5"><LuHourglass size={14} /> To'lov kutilmoqda</p>
                    <p className="text-xs text-amber-700 mt-0.5">Kassadan hali to'lanmagan</p>
                  </div>
                  <span className="font-bold text-xs text-amber-900 bg-amber-200/80 border border-amber-300 px-3 py-1.5 rounded-xl">
                    To'lash kerak: {formatMoney(payrollItem.net_payable || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Barcode & Shtamp */}
            <div className="pt-2 text-center space-y-1">
              <div className="flex justify-center items-center gap-1 py-1 opacity-70">
                {[4,2,6,1,3,7,2,5,3,6,2,4,8,2,5,3,7,4,2,6,3,5,2,4].map((h, i) => (
                  <div
                    key={i}
                    className="bg-slate-800"
                    style={{ width: i % 3 === 0 ? '3px' : '1.5px', height: `${h * 3 + 12}px` }}
                  />
                ))}
              </div>
              <p className="text-xs font-bold text-slate-400">
                FRITTO HR MANAGEMENT • TASDIQLANGAN KVITANSIYA
              </p>
            </div>

            {/* Print tugmasi */}
            <div className="pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="btn-primary w-full justify-center py-3 font-bold"
              >
                <LuPrinter size={16} /> Chekni chop etish (Print)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
