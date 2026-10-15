import { createClient } from '@supabase/supabase-js'

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL yoki VITE_SUPABASE_ANON_KEY env topilmadi!')
}

// Tarmoq bir lahzaga uzilsa (brauzerda "CORS / ERR_FAILED" bo'lib ko'rinadi),
// faqat o'qish so'rovlarini (GET/HEAD) 2 martagacha qayta yuboramiz.
// Yozish so'rovlari qayta yuborilmaydi — ikki marta saqlanib qolmasligi uchun.
const fetchWithRetry = async (input, init = {}) => {
  const method = (init.method || 'GET').toUpperCase()
  const retries = method === 'GET' || method === 'HEAD' ? 2 : 0
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      if (attempt >= retries || init.signal?.aborted) throw err
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: fetchWithRetry },
})

// Ikkinchi auth klient - Admin paneldan yangi xodim akkauntini ochganda admin sessiyasi uzilib qolmasligi uchun
export const createSecondaryAuthClient = () => {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

// ─── Toshkent vaqt mintaqasi ──────────────────────────────────────────────────
export const TZ = 'Asia/Tashkent'

export function nowTashkent() {
  return new Date().toLocaleString('en-US', { timeZone: TZ })
}

export function toTashkentISO() {
  return new Date().toISOString()
}

export function formatTashkentTime(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('uz-UZ', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatTashkentDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('uz-UZ', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatTashkentDateTime(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('uz-UZ', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0 daqiqa'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h} soat ${m} daqiqa ${s} soniya`
  if (m > 0) return `${m} daqiqa ${s} soniya`
  return `${s} soniya`
}

export function formatMoney(amount) {
  if (!amount && amount !== 0) return '—'
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " so'm"
}

// ─── Auth funksiyalari ────────────────────────────────────────────────────────
export const authFunctions = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// ─── Profil funksiyalari ──────────────────────────────────────────────────────
export const profileFunctions = {
  async getProfile(userId) {
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    // Agar profil profiles jadvalida topilmasa (trigger ishlamagan bo'lsa), avtomatik tiklaymiz
    if (!profile) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.id === userId) {
        const role = user.user_metadata?.role || 'employee'
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Foydalanuvchi'
        
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user.email,
            role: role,
            full_name: fullName,
          })
          .select()
          .maybeSingle()

        profile = newProfile || {
          id: userId,
          email: user.email,
          role: role,
          full_name: fullName,
        }
      }
    }

    if (!profile) {
      return null
    }

    // Agar foydalanuvchi xodim bo'lsa, employees ma'lumotlarini ham olamiz
    if (profile.role === 'employee') {
      const { data: emp } = await supabase
        .from('employees')
        .select(`
          *,
          employment_trials(*),
          salary_rates(*),
          work_schedules(*)
        `)
        .eq('user_id', userId)
        .maybeSingle()

      // Agar xodimlar jadvalida hali yozuv bo'lmasa, uni ham avtomatik yaratamiz
      let employeeRecord = emp
      if (!employeeRecord) {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert({
            user_id: userId,
            full_name: profile.full_name || profile.email?.split('@')[0] || 'Xodim',
            position: 'Xodim',
            branch: 'Asosiy',
            hire_date: new Date().toISOString().split('T')[0],
            status: 'active',
          })
          .select(`
            *,
            employment_trials(*),
            salary_rates(*),
            work_schedules(*)
          `)
          .maybeSingle()

        employeeRecord = newEmp || {
          id: userId,
          full_name: profile.full_name,
          status: 'active',
        }
      }

      const dualEmployee = employeeRecord ? Object.assign([employeeRecord], employeeRecord) : null

      return {
        ...profile,
        employee: employeeRecord,
        employees: dualEmployee,
      }
    }

    return {
      ...profile,
      employee: null,
      employees: [],
    }
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getAllProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },
}

// ─── Xodimlar funksiyalari ────────────────────────────────────────────────────
export const employeeFunctions = {
  async getAll(filters = {}) {
    let query = supabase
      .from('employees')
      .select(`
        *,
        employment_trials(
          id, status, trial_start_date, trial_end_date,
          confirmed_date, decision, decision_date
        ),
        salary_rates(id, hourly_rate, effective_from, effective_to),
        work_schedules(id, shift_start, shift_end, branch, work_days, is_active)
      `)
      .order('created_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.branch)  query = query.eq('branch', filters.branch)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        employment_trials(*),
        salary_rates(*),
        work_schedules(*),
        attendance_sessions(
          id, check_in_at, check_out_at, worked_seconds,
          status, hourly_rate_snapshot, earned_amount, notes
        )
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        employment_trials(*),
        salary_rates(*),
        work_schedules(*)
      `)
      .eq('user_id', userId)
      .single()
    if (error) throw error
    return data
  },

  async create(employeeData) {
    const { data, error } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('employees')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deactivate(id, reason) {
    const { data, error } = await supabase
      .from('employees')
      .update({
        status: 'inactive',
        deactivation_reason: reason,
        deactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async activate(id) {
    const { data, error } = await supabase
      .from('employees')
      .update({
        status: 'active',
        deactivation_reason: null,
        deactivated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getDashboardStats() {
    const { data: employees, error } = await supabase
      .from('employees')
      .select('id, status')
    if (error) throw error

    const total   = employees.length
    const active  = employees.filter(e => e.status === 'active').length
    const inactive = employees.filter(e => e.status === 'inactive').length

    const { data: trials } = await supabase
      .from('employment_trials')
      .select('id, status')
      .in('status', ['pending', 'in_progress', 'awaiting_decision'])

    const { data: todaySessions } = await supabase
      .from('attendance_sessions')
      .select('id, status, check_in_at')
      .gte('check_in_at', new Date().toISOString().split('T')[0])

    return {
      total,
      active,
      inactive,
      onTrial: (trials || []).length,
      todayCheckedIn: (todaySessions || []).length,
      currentlyWorking: (todaySessions || []).filter(s => s.status === 'open').length,
      forgotCheckout: (todaySessions || []).filter(s => s.status === 'open').length,
    }
  },
}

// ─── Trial (Test rejimi) funksiyalari ─────────────────────────────────────────
export const trialFunctions = {
  async create(trialData) {
    const { data, error } = await supabase
      .from('employment_trials')
      .insert(trialData)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('employment_trials')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getByEmployee(employeeId) {
    const { data, error } = await supabase
      .from('employment_trials')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async getAll() {
    const { data, error } = await supabase
      .from('employment_trials')
      .select('*, employees(id, full_name, position, branch)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async approve(id, employeeId, notes) {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('employment_trials')
      .update({
        status: 'confirmed',
        decision: 'approved',
        decision_date: now,
        confirmed_date: now,
        decision_notes: notes,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    await supabase.from('employees').update({
      status: 'active',
      confirmed_at: now,
      updated_at: now,
    }).eq('id', employeeId)

    return data
  },

  async reject(id, employeeId, reason) {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('employment_trials')
      .update({
        status: 'rejected',
        decision: 'rejected',
        decision_date: now,
        decision_notes: reason,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    await supabase.from('employees').update({
      status: 'rejected',
      updated_at: now,
    }).eq('id', employeeId)

    return data
  },

  async extend(id, newEndDate, reason) {
    const { data, error } = await supabase
      .from('employment_trials')
      .update({
        status: 'extended',
        trial_end_date: newEndDate,
        extension_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async assignTrial(employeeId, daysCount = 5, startDate = null) {
    const start = startDate ? new Date(startDate) : new Date()
    const end = new Date(start)
    end.setDate(end.getDate() + (parseInt(daysCount) - 1))

    const startDateStr = start.toISOString().split('T')[0]
    const endDateStr = end.toISOString().split('T')[0]

    // Avvalgi faol test yozuvlarini yakunlash
    await supabase
      .from('employment_trials')
      .update({ status: 'extended', updated_at: new Date().toISOString() })
      .eq('employee_id', employeeId)
      .in('status', ['pending', 'in_progress'])

    const { data: trial, error } = await supabase
      .from('employment_trials')
      .insert({
        employee_id: employeeId,
        trial_start_date: startDateStr,
        trial_end_date: endDateStr,
        status: 'in_progress',
        days_count: parseInt(daysCount),
      })
      .select()
      .single()
    if (error) throw error

    // Xodim statusini 'trial' ga o'tkazamiz
    await supabase
      .from('employees')
      .update({
        status: 'trial',
        updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)

    return trial
  },

  async removeTrial(employeeId) {
    const now = new Date().toISOString()
    await supabase
      .from('employees')
      .update({
        status: 'active',
        confirmed_at: now,
        updated_at: now,
      })
      .eq('id', employeeId)

    await supabase
      .from('employment_trials')
      .update({
        status: 'confirmed',
        decision: 'approved',
        decision_date: now,
        confirmed_date: now,
        updated_at: now,
      })
      .eq('employee_id', employeeId)
      .in('status', ['pending', 'in_progress'])
  },

  getTrialDay(startDate) {
    const start = new Date(startDate)
    const now = new Date()
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24))
    return Math.min(diff + 1, 5)
  },
}

// ─── Davomat (Attendance) funksiyalari ───────────────────────────────────────
export const attendanceFunctions = {
  async checkIn(employeeId, hourlyRateSnapshot) {
    // Avval ochiq sessiya bor-yo'qligini tekshir
    const { data: existing } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('status', 'open')
      .maybeSingle()

    if (existing) {
      throw new Error('Siz allaqachon check-in qilgansiz. Avval check-out qiling.')
    }

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        employee_id: employeeId,
        check_in_at: new Date().toISOString(),
        status: 'open',
        hourly_rate_snapshot: hourlyRateSnapshot,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async checkOut(sessionId, employeeId) {
    const { data: session, error: fetchErr } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('employee_id', employeeId)
      .single()

    if (fetchErr || !session) throw new Error('Sessiya topilmadi')

    const checkOutAt = new Date().toISOString()
    const checkInDate  = new Date(session.check_in_at)
    const checkOutDate = new Date(checkOutAt)

    let workedSeconds = Math.floor((checkOutDate - checkInDate) / 1000)

    // Tanaffus vaqtini olib tashlash
    const { data: breaks } = await supabase
      .from('breaks')
      .select('started_at, ended_at')
      .eq('session_id', sessionId)
      .not('ended_at', 'is', null)

    if (breaks) {
      for (const br of breaks) {
        const bStart = new Date(br.started_at)
        const bEnd   = new Date(br.ended_at)
        workedSeconds -= Math.floor((bEnd - bStart) / 1000)
      }
    }

    workedSeconds = Math.max(0, workedSeconds)
    const earnedAmount = (workedSeconds / 3600) * (session.hourly_rate_snapshot || 0)

    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({
        check_out_at: checkOutAt,
        worked_seconds: workedSeconds,
        earned_amount: Math.round(earnedAmount),
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) throw error

    // Avtomatik ravishda xodimning oylik hisob-kitobini yangi sessiya bilan sinxronlashtiramiz
    try {
      const coDate = new Date(checkOutAt)
      const pYear = coDate.getFullYear()
      const pMonth = coDate.getMonth() + 1
      const period = await payrollFunctions.getOrCreatePeriod(pYear, pMonth)
      const periodStart = `${pYear}-${String(pMonth).padStart(2,'0')}-01T00:00:00`
      const lastDay = new Date(pYear, pMonth, 0).getDate()
      const periodEnd = `${pYear}-${String(pMonth).padStart(2,'0')}-${lastDay}T23:59:59`
      await payrollFunctions.calculateForEmployee(employeeId, period.id, periodStart, periodEnd)
    } catch (calcErr) {
      console.warn('Auto sync on checkout warning:', calcErr)
    }

    return data
  },

  async getOpenSession(employeeId) {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'open')
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getByEmployee(employeeId, filters = {}) {
    let query = supabase
      .from('attendance_sessions')
      .select('*, breaks(*)')
      .eq('employee_id', employeeId)
      .order('check_in_at', { ascending: false })

    if (filters.from) query = query.gte('check_in_at', filters.from)
    if (filters.to)   query = query.lte('check_in_at', filters.to)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getAll(filters = {}) {
    let query = supabase
      .from('attendance_sessions')
      .select(`
        *,
        employees(id, full_name, position, branch)
      `)
      .order('check_in_at', { ascending: false })

    if (filters.from)       query = query.gte('check_in_at', filters.from)
    if (filters.to)         query = query.lte('check_in_at', filters.to)
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters.status)     query = query.eq('status', filters.status)

    const { data, error } = await query.limit(filters.limit || 200)
    if (error) throw error
    return data || []
  },

  async adminCorrect(sessionId, corrections, reason, adminId) {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({
        ...corrections,
        admin_corrected: true,
        correction_reason: reason,
        corrected_by: adminId,
        corrected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()
    if (error) throw error

    // Audit log yoz
    await supabase.from('audit_logs').insert({
      table_name: 'attendance_sessions',
      record_id: sessionId,
      action: 'admin_correction',
      changes: corrections,
      reason,
      performed_by: adminId,
    })

    return data
  },

  async getTodayStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('id, status, employee_id, check_in_at')
      .gte('check_in_at', today.toISOString())

    if (error) throw error
    return data || []
  },

  calculateLatenessStatus(checkInAt, shiftStart, allowedLateMinutes = 10) {
    if (!checkInAt || !shiftStart) return null

    const checkIn = new Date(checkInAt)
    const [h, m]  = shiftStart.split(':').map(Number)

    // Shift vaqtini bugungi sanaga moslashtirish
    const scheduled = new Date(checkIn)
    scheduled.setHours(h, m, 0, 0)

    const diffMinutes = Math.floor((checkIn - scheduled) / 60000)

    if (diffMinutes <= -10) return { type: 'early', minutes: Math.abs(diffMinutes) }
    if (diffMinutes <= allowedLateMinutes)   return { type: 'on_time', minutes: 0 }
    return { type: 'late', minutes: diffMinutes }
  },
}

// ─── Ish haqi stavkasi funksiyalari ──────────────────────────────────────────
export const salaryRateFunctions = {
  async getCurrent(employeeId) {
    const { data, error } = await supabase
      .from('salary_rates')
      .select('*')
      .eq('employee_id', employeeId)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getHistory(employeeId) {
    const { data, error } = await supabase
      .from('salary_rates')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_from', { ascending: false })
    if (error) throw error
    return data || []
  },

  async set(employeeId, hourlyRate, effectiveFrom, adminId) {
    // Avvalgi aktiv stavkani yop
    await supabase
      .from('salary_rates')
      .update({ effective_to: effectiveFrom })
      .eq('employee_id', employeeId)
      .is('effective_to', null)

    const { data, error } = await supabase
      .from('salary_rates')
      .insert({
        employee_id: employeeId,
        hourly_rate: hourlyRate,
        effective_from: effectiveFrom,
        created_by: adminId,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ─── Avans funksiyalari ───────────────────────────────────────────────────────
export const advanceFunctions = {
  async create(advanceData) {
    const { data, error } = await supabase
      .from('advances')
      .insert({
        ...advanceData,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getByEmployee(employeeId) {
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async getAll(filters = {}) {
    let query = supabase
      .from('advances')
      .select('*, employees(id, full_name, branch)')
      .order('created_at', { ascending: false })

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters.status)     query = query.eq('status', filters.status)
    if (filters.from)       query = query.gte('created_at', filters.from)
    if (filters.to)         query = query.lte('created_at', filters.to)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async cancel(id, reason, adminId) {
    const { data, error } = await supabase
      .from('advances')
      .update({
        status: 'cancelled',
        cancel_reason: reason,
        cancelled_by: adminId,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getTotalByEmployee(employeeId, periodStart, periodEnd) {
    let query = supabase
      .from('advances')
      .select('amount')
      .eq('employee_id', employeeId)
      .eq('status', 'active')

    if (periodStart) query = query.gte('created_at', periodStart)
    if (periodEnd)   query = query.lte('created_at', periodEnd)

    const { data, error } = await query
    if (error) throw error
    return (data || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
  },
}

// ─── Oylik hisob-kitob funksiyalari ──────────────────────────────────────────
export const payrollFunctions = {
  async getPeriods(filters = {}) {
    let query = supabase
      .from('payroll_periods')
      .select('*')
      .order('period_start', { ascending: false })

    if (filters.year)  query = query.eq('year', filters.year)
    if (filters.month) query = query.eq('month', filters.month)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getOrCreatePeriod(year, month) {
    const { data: existing } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (existing) return existing

    const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const periodEnd   = new Date(year, month, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('payroll_periods')
      .insert({ year, month, period_start: periodStart, period_end: periodEnd, status: 'calculating' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getItems(periodId, employeeId) {
    const { data: period } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', periodId)
      .maybeSingle()

    let query = supabase
      .from('payroll_items')
      .select('*, employees(id, full_name, position, branch), payments(id, amount, payment_method, payment_date)')
      .eq('period_id', periodId)
      .order('created_at', { ascending: false })

    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query
    if (error) throw error

    // Shu davrga oid barcha to'lovlarni olish (agar to'lov payroll_item_id orqali emas, employee_id orqali bo'lsa ham)
    let allPeriodPayments = []
    if (period) {
      const pStart = `${period.period_start}T00:00:00`
      const pEnd   = `${period.period_end}T23:59:59`
      const { data: pList } = await supabase
        .from('payments')
        .select('*')
        .gte('payment_date', pStart)
        .lte('payment_date', pEnd)
      allPeriodPayments = pList || []
    }

    return (data || []).map(item => {
      const directPayments = item.payments || []
      const empPayments = allPeriodPayments.filter(p => p.employee_id === item.employee_id)
      
      const payMap = new Map()
      directPayments.forEach(p => payMap.set(p.id, p))
      empPayments.forEach(p => payMap.set(p.id, p))
      const combinedPayments = Array.from(payMap.values())

      const paidSum = combinedPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      const net = Math.round(item.net_payable || 0)
      const remaining = Math.max(0, net - paidSum)
      let status = item.status
      if (paidSum > 0) {
        if (remaining === 0 && net > 0) {
          status = 'paid'
        } else if (remaining > 0) {
          status = 'partial'
        }
      } else if (paidSum === 0 && net > 0) {
        status = 'pending'
      }
      return {
        ...item,
        payments: combinedPayments,
        paid_amount: paidSum,
        remaining_payable: remaining,
        status,
      }
    })
  },

  async calculateForEmployee(employeeId, periodId, periodStart, periodEnd) {
    // Davomiylik ma'lumotlarini olish (yopiq va tuzatilgan)
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('check_in_at, worked_seconds, earned_amount, hourly_rate_snapshot')
      .eq('employee_id', employeeId)
      .in('status', ['closed', 'corrected'])
      .gte('check_in_at', periodStart)
      .lte('check_in_at', periodEnd)

    const totalSeconds = (sessions || []).reduce((s, a) => s + (parseInt(a.worked_seconds) || 0), 0)
    const totalEarned  = (sessions || []).reduce((s, a) => s + (parseFloat(a.earned_amount) || 0), 0)
    const workedDays   = new Set((sessions || []).map(s =>
      new Date(s.check_in_at).toDateString()
    )).size

    // Avanslarni olish
    const totalAdvances = await advanceFunctions.getTotalByEmployee(
      employeeId, periodStart, periodEnd
    )

    // Adjustmentlarni olish
    const { data: adjustments } = await supabase
      .from('payroll_adjustments')
      .select('type, amount')
      .eq('employee_id', employeeId)
      .eq('period_id', periodId)
      .eq('status', 'approved')

    let bonuses   = 0
    let deductions = 0
    for (const adj of (adjustments || [])) {
      if (adj.type === 'bonus')     bonuses    += adj.amount
      if (adj.type === 'deduction') deductions += adj.amount
    }

    const netPayable = Math.max(0, totalEarned + bonuses - deductions - totalAdvances)

    // Ushbu davr uchun xodimga oldin kassadan qilingan haqiqiy to'lovlar
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .eq('employee_id', employeeId)
      .gte('payment_date', periodStart)
      .lte('payment_date', periodEnd)

    const alreadyPaidAmount = (existingPayments || []).reduce(
      (s, p) => s + (parseFloat(p.amount) || 0), 0
    )

    // Agar to'lov qilingan bo'lsa, holatni va to'lov vaqtini aniqlaymiz:
    let status = 'pending'
    let paidAt = null
    if (alreadyPaidAmount > 0) {
      if (alreadyPaidAmount >= Math.round(netPayable) && Math.round(netPayable) > 0) {
        status = 'paid'
        paidAt = existingPayments[0]?.payment_date || new Date().toISOString()
      } else {
        status = 'partial'
        paidAt = existingPayments[0]?.payment_date || new Date().toISOString()
      }
    }

    // Upsert payroll item
    const { data, error } = await supabase
      .from('payroll_items')
      .upsert({
        employee_id: employeeId,
        period_id: periodId,
        total_worked_seconds: totalSeconds,
        worked_days: workedDays,
        total_earned: Math.round(totalEarned),
        total_advances: Math.round(totalAdvances),
        total_bonuses: Math.round(bonuses),
        total_deductions: Math.round(deductions),
        net_payable: Math.round(netPayable),
        status: status,
        paid_at: paidAt,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'employee_id,period_id',
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async markPaid(payrollItemId, paymentData, adminId) {
    // 1. Avval mavjud payroll itemni olamiz
    const { data: item, error: fetchErr } = await supabase
      .from('payroll_items')
      .select('employee_id, net_payable')
      .eq('id', payrollItemId)
      .single()
    if (fetchErr) throw fetchErr

    // 2. Yangi to'lovni payments jadvaliga yozamiz
    const { error: payErr } = await supabase.from('payments').insert({
      employee_id: item.employee_id,
      payroll_item_id: payrollItemId,
      amount: paymentData.amount,
      payment_method: paymentData.method,
      payment_date: new Date().toISOString(),
      notes: paymentData.notes,
      recorded_by: adminId,
    })
    if (payErr) throw payErr

    // 3. Jami qilingan to'lovlarni hisoblaymiz
    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('payroll_item_id', payrollItemId)

    const totalPaid = (allPayments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    const newStatus = (totalPaid >= (item.net_payable || 0) && (item.net_payable || 0) > 0) ? 'paid' : 'partial'

    const { data, error } = await supabase
      .from('payroll_items')
      .update({
        status: newStatus,
        paid_at: new Date().toISOString(),
        paid_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payrollItemId)
      .select()
      .single()
    if (error) throw error

    return data
  },

  async getPayments(filters = {}) {
    let query = supabase
      .from('payments')
      .select('*, employees(id, full_name)')
      .order('payment_date', { ascending: false })

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters.from)       query = query.gte('payment_date', filters.from)
    if (filters.to)         query = query.lte('payment_date', filters.to)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },
}

// ─── Hisobotlar funksiyalari ──────────────────────────────────────────────────
export const reportFunctions = {
  async monthlyPayrollSummary(year, month) {
    const period = await payrollFunctions.getOrCreatePeriod(year, month)
    const items  = await payrollFunctions.getItems(period.id)

    return {
      period,
      items,
      totalEarned:    items.reduce((s, i) => s + (i.total_earned || 0), 0),
      totalAdvances:  items.reduce((s, i) => s + (i.total_advances || 0), 0),
      totalNetPayable: items.reduce((s, i) => s + (i.net_payable || 0), 0),
    }
  },

  async attendanceSummary(filters = {}) {
    return attendanceFunctions.getAll(filters)
  },

  async trialReport() {
    return trialFunctions.getAll()
  },
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationFunctions = {
  async create(data) {
    const { error } = await supabase.from('notifications').insert(data)
    if (error) console.error('Notification create error:', error)
  },

  async getForUser(userId, limit = 20) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`target_user_id.eq.${userId},target_role.eq.admin`)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  async getForAdmin(limit = 30) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, employees(full_name)')
      .or('target_role.eq.admin,target_role.is.null')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  async markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  },

  async markAllRead(userId) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .or(`target_user_id.eq.${userId},target_role.eq.admin`)
  },
}

// ─── Audit log ───────────────────────────────────────────────────────────────
export const auditFunctions = {
  async log(data) {
    const { error } = await supabase.from('audit_logs').insert({
      ...data,
      created_at: new Date().toISOString(),
    })
    if (error) console.error('Audit log error:', error)
  },

  async getAll(filters = {}) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filters.tableName) query = query.eq('table_name', filters.tableName)
    if (filters.recordId)  query = query.eq('record_id', filters.recordId)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },
}

// ─── Work Schedule ────────────────────────────────────────────────────────────
export const scheduleFunctions = {
  async getByEmployee(employeeId) {
    const { data, error } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return null
    return Object.assign([...data], data[0], { all: data })
  },

  async upsert(employeeId, scheduleData) {
    // Avvalgi aktiv jadvallarni nofaol qilish
    await supabase
      .from('work_schedules')
      .update({ is_active: false })
      .eq('employee_id', employeeId)
      .eq('is_active', true)

    const list = Array.isArray(scheduleData) ? scheduleData : [scheduleData]
    if (list.length === 0) return []

    const insertRows = list.map(item => ({
      ...item,
      employee_id: employeeId,
      is_active: true,
    }))

    const { data, error } = await supabase
      .from('work_schedules')
      .insert(insertRows)
      .select()

    if (error) throw error
    return data
  },
}

// ─── Adjustments (bonus/chegirma) ─────────────────────────────────────────────
export const adjustmentFunctions = {
  async create(data) {
    const { data: result, error } = await supabase
      .from('payroll_adjustments')
      .insert(data)
      .select()
      .single()
    if (error) throw error
    return result
  },

  async getByEmployee(employeeId, periodId) {
    let query = supabase
      .from('payroll_adjustments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    if (periodId) query = query.eq('period_id', periodId)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },
}

export default supabase
