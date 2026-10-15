-- ============================================================
-- FRITTO HR Management System — Database Schema
-- Supabase PostgreSQL Migration
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES — Auth foydalanuvchilari va rollari
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. EMPLOYEES — Xodimlar profili
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name            TEXT NOT NULL,
  phone                TEXT,
  telegram_id          TEXT,
  position             TEXT NOT NULL,
  branch               TEXT DEFAULT 'Asosiy',
  hire_date            DATE NOT NULL,
  status               TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'inactive', 'rejected')),
  confirmed_at         TIMESTAMPTZ,
  deactivated_at       TIMESTAMPTZ,
  deactivation_reason  TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. EMPLOYMENT_TRIALS — 5 kunlik test rejimi
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employment_trials (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id       UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  trial_start_date  DATE NOT NULL,
  trial_end_date    DATE NOT NULL,
  status            TEXT DEFAULT 'in_progress' CHECK (
    status IN ('pending', 'in_progress', 'awaiting_decision', 'confirmed', 'rejected', 'extended')
  ),
  decision          TEXT CHECK (decision IN ('approved', 'rejected')),
  decision_date     TIMESTAMPTZ,
  decision_notes    TEXT,
  confirmed_date    TIMESTAMPTZ,
  extension_reason  TEXT,
  days_count        INTEGER DEFAULT 5,
  use_work_days     BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. WORK_SCHEDULES — Ish jadvali (smenalar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id  UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  shift_start  TIME NOT NULL DEFAULT '09:00',
  shift_end    TIME NOT NULL DEFAULT '18:00',
  branch       TEXT DEFAULT 'Asosiy',
  work_days    TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. SALARY_RATES — Soatlik stavkalar tarixi
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_rates (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id    UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  hourly_rate    NUMERIC(12, 2) NOT NULL CHECK (hourly_rate >= 0),
  effective_from DATE NOT NULL,
  effective_to   DATE,
  created_by     UUID REFERENCES auth.users(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ATTENDANCE_SESSIONS — Check-in / Check-out yozuvlari
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id          UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  check_in_at          TIMESTAMPTZ NOT NULL,
  check_out_at         TIMESTAMPTZ,
  worked_seconds       INTEGER DEFAULT 0 CHECK (worked_seconds >= 0),
  earned_amount        NUMERIC(14, 2) DEFAULT 0,
  hourly_rate_snapshot NUMERIC(12, 2) DEFAULT 0,
  status               TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'corrected')),
  lateness_minutes     INTEGER DEFAULT 0,
  lateness_type        TEXT CHECK (lateness_type IN ('early', 'on_time', 'late')),
  admin_corrected      BOOLEAN DEFAULT FALSE,
  correction_reason    TEXT,
  corrected_by         UUID REFERENCES auth.users(id),
  corrected_at         TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. BREAKS — Tanaffuslar
-- ============================================================
CREATE TABLE IF NOT EXISTS public.breaks (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id  UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  duration_s  INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. ADVANCES — Avanslar
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advances (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id    UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  amount         NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_type   TEXT DEFAULT 'cash' CHECK (payment_type IN ('cash', 'card', 'transfer')),
  notes          TEXT,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  given_by       UUID REFERENCES auth.users(id),
  cancel_reason  TEXT,
  cancelled_by   UUID REFERENCES auth.users(id),
  cancelled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. PAYROLL_PERIODS — Oylik hisob-kitob davrlari
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  status        TEXT DEFAULT 'calculating' CHECK (
    status IN ('calculating', 'pending', 'partial', 'completed')
  ),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

-- ============================================================
-- 10. PAYROLL_ITEMS — Har bir xodim uchun oylik hisob
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_items (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id           UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  period_id             UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE NOT NULL,
  total_worked_seconds  BIGINT DEFAULT 0,
  worked_days           INTEGER DEFAULT 0,
  total_earned          NUMERIC(14, 2) DEFAULT 0,
  total_advances        NUMERIC(14, 2) DEFAULT 0,
  total_bonuses         NUMERIC(14, 2) DEFAULT 0,
  total_deductions      NUMERIC(14, 2) DEFAULT 0,
  net_payable           NUMERIC(14, 2) DEFAULT 0,
  status                TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'partial', 'paid')
  ),
  paid_at               TIMESTAMPTZ,
  paid_by               UUID REFERENCES auth.users(id),
  calculated_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, period_id)
);

-- ============================================================
-- 11. PAYMENTS — Haqiqiy amalga oshirilgan to'lovlar
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id       UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  payroll_item_id   UUID REFERENCES public.payroll_items(id),
  amount            NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_method    TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer')),
  payment_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes             TEXT,
  recorded_by       UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. PAYROLL_ADJUSTMENTS — Bonus, chegirma, tuzatishlar
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id  UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  period_id    UUID REFERENCES public.payroll_periods(id),
  type         TEXT NOT NULL CHECK (type IN ('bonus', 'deduction', 'correction')),
  amount       NUMERIC(14, 2) NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. NOTIFICATIONS — Bildirishnomalar
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id      UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  target_user_id   UUID REFERENCES auth.users(id),
  target_role      TEXT CHECK (target_role IN ('admin', 'employee')),
  type             TEXT NOT NULL,
  title            TEXT NOT NULL,
  message          TEXT,
  is_read          BOOLEAN DEFAULT FALSE,
  data             JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. AUDIT_LOGS — Muhim o'zgarishlar tarixi
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  table_name    TEXT NOT NULL,
  record_id     UUID,
  action        TEXT NOT NULL,
  old_values    JSONB,
  new_values    JSONB,
  changes       JSONB,
  reason        TEXT,
  performed_by  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES — Performans uchun
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_user_id    ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status     ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_branch     ON public.employees(branch);

CREATE INDEX IF NOT EXISTS idx_trials_employee_id   ON public.employment_trials(employee_id);
CREATE INDEX IF NOT EXISTS idx_trials_status        ON public.employment_trials(status);

CREATE INDEX IF NOT EXISTS idx_sessions_employee    ON public.attendance_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status      ON public.attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_checkin     ON public.attendance_sessions(check_in_at);

CREATE INDEX IF NOT EXISTS idx_advances_employee    ON public.advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_created     ON public.advances(created_at);

CREATE INDEX IF NOT EXISTS idx_salary_employee      ON public.salary_rates(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_effective     ON public.salary_rates(effective_from);

CREATE INDEX IF NOT EXISTS idx_payroll_period       ON public.payroll_items(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee     ON public.payroll_items(employee_id);

CREATE INDEX IF NOT EXISTS idx_notif_user           ON public.notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_role           ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notif_read           ON public.notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_audit_table          ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record         ON public.audit_logs(record_id);

-- ============================================================
-- TRIGGERS — Auto-updated timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_employees_updated
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_sessions_updated
    BEFORE UPDATE ON public.attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_trials_updated
    BEFORE UPDATE ON public.employment_trials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- AUTO-CREATE PROFILE on Auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Barcha jadvallarda RLS yoq
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_trials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_rates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;

-- ─── Helper funksiya: Admin tekshiruvi ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── Helper funksiya: Xodim ID olish ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_employee_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.employees
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── PROFILES RLS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ─── EMPLOYEES RLS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_admin_all" ON public.employees;
CREATE POLICY "employees_admin_all" ON public.employees
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "employees_own_select" ON public.employees;
CREATE POLICY "employees_own_select" ON public.employees
  FOR SELECT USING (user_id = auth.uid());

-- ─── EMPLOYMENT_TRIALS RLS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "trials_admin_all" ON public.employment_trials;
CREATE POLICY "trials_admin_all" ON public.employment_trials
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "trials_own_select" ON public.employment_trials;
CREATE POLICY "trials_own_select" ON public.employment_trials
  FOR SELECT USING (employee_id = public.get_employee_id());

-- ─── WORK_SCHEDULES RLS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedules_admin_all" ON public.work_schedules;
CREATE POLICY "schedules_admin_all" ON public.work_schedules
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "schedules_own_select" ON public.work_schedules;
CREATE POLICY "schedules_own_select" ON public.work_schedules
  FOR SELECT USING (employee_id = public.get_employee_id());

-- ─── SALARY_RATES RLS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "salary_admin_all" ON public.salary_rates;
CREATE POLICY "salary_admin_all" ON public.salary_rates
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "salary_own_select" ON public.salary_rates;
CREATE POLICY "salary_own_select" ON public.salary_rates
  FOR SELECT USING (employee_id = public.get_employee_id());

-- ─── ATTENDANCE_SESSIONS RLS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "sessions_admin_all" ON public.attendance_sessions;
CREATE POLICY "sessions_admin_all" ON public.attendance_sessions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "sessions_own_select" ON public.attendance_sessions;
CREATE POLICY "sessions_own_select" ON public.attendance_sessions
  FOR SELECT USING (employee_id = public.get_employee_id());

DROP POLICY IF EXISTS "sessions_own_insert" ON public.attendance_sessions;
CREATE POLICY "sessions_own_insert" ON public.attendance_sessions
  FOR INSERT WITH CHECK (employee_id = public.get_employee_id());

DROP POLICY IF EXISTS "sessions_own_update" ON public.attendance_sessions;
CREATE POLICY "sessions_own_update" ON public.attendance_sessions
  FOR UPDATE USING (employee_id = public.get_employee_id() AND NOT admin_corrected);

-- ─── BREAKS RLS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "breaks_admin_all" ON public.breaks;
CREATE POLICY "breaks_admin_all" ON public.breaks
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "breaks_own" ON public.breaks;
CREATE POLICY "breaks_own" ON public.breaks
  FOR ALL USING (
    session_id IN (
      SELECT id FROM public.attendance_sessions
      WHERE employee_id = public.get_employee_id()
    )
  );

-- ─── ADVANCES RLS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "advances_admin_all" ON public.advances;
CREATE POLICY "advances_admin_all" ON public.advances
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "advances_own_select" ON public.advances;
CREATE POLICY "advances_own_select" ON public.advances
  FOR SELECT USING (employee_id = public.get_employee_id());

-- ─── PAYROLL_PERIODS RLS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "periods_admin_all" ON public.payroll_periods;
CREATE POLICY "periods_admin_all" ON public.payroll_periods
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "periods_select" ON public.payroll_periods;
CREATE POLICY "periods_select" ON public.payroll_periods
  FOR SELECT USING (true);

-- ─── PAYROLL_ITEMS RLS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "items_admin_all" ON public.payroll_items;
CREATE POLICY "items_admin_all" ON public.payroll_items
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "items_own_select" ON public.payroll_items;
CREATE POLICY "items_own_select" ON public.payroll_items
  FOR SELECT USING (employee_id = public.get_employee_id());

-- ─── PAYMENTS RLS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "payments_own_select" ON public.payments;
CREATE POLICY "payments_own_select" ON public.payments
  FOR SELECT USING (employee_id = public.get_employee_id());

-- ─── PAYROLL_ADJUSTMENTS RLS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "adjustments_admin_all" ON public.payroll_adjustments;
CREATE POLICY "adjustments_admin_all" ON public.payroll_adjustments
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "adjustments_own_select" ON public.payroll_adjustments;
CREATE POLICY "adjustments_own_select" ON public.payroll_adjustments
  FOR SELECT USING (employee_id = public.get_employee_id());

-- ─── NOTIFICATIONS RLS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notif_admin_all" ON public.notifications;
CREATE POLICY "notif_admin_all" ON public.notifications
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "notif_own" ON public.notifications;
CREATE POLICY "notif_own" ON public.notifications
  FOR SELECT USING (target_user_id = auth.uid());

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (target_user_id = auth.uid());

-- ─── AUDIT_LOGS RLS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_admin_all" ON public.audit_logs;
CREATE POLICY "audit_admin_all" ON public.audit_logs
  FOR ALL USING (public.is_admin());

-- ============================================================
-- SAMPLE ADMIN USER SETUP (Manual)
-- Supabase Dashboard > Authentication > Users orqali admin yarating,
-- so'ng quyidagi SQL ni ishga tushiring:
--
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@fritto.uz';
--
-- YOKI trigger orqali:
-- INSERT INTO auth.users → metadata: { "role": "admin" }
-- ============================================================
