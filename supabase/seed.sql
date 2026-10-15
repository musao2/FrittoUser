-- ============================================================
-- FRITTO HR Management System — Seed Data
-- Ushbu faylni Supabase SQL Editor'da 001_initial_schema.sql'dan keyin ishga tushiring
-- ============================================================

-- 1. Demo xodimlarni qo'shish
INSERT INTO public.employees (id, full_name, phone, position, branch, hire_date, status, confirmed_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ali Valiyev', '+998901234567', 'Bosh oshpaz', 'Asosiy', CURRENT_DATE - INTERVAL '60 days', 'active', NOW() - INTERVAL '55 days'),
  ('22222222-2222-2222-2222-222222222222', 'Zuhra Karimova', '+998902345678', 'Kassir / Operator', 'Asosiy', CURRENT_DATE - INTERVAL '30 days', 'active', NOW() - INTERVAL '25 days'),
  ('33333333-3333-3333-3333-333333333333', 'Jasur Rustamov', '+998903456789', 'Oshpaz yordamchisi', 'Filial 1', CURRENT_DATE - INTERVAL '3 days', 'trial', NULL),
  ('44444444-4444-4444-4444-444444444444', 'Madina Umarova', '+998904567890', 'Kuryer / Yetkazib beruvchi', 'Filial 2', CURRENT_DATE - INTERVAL '15 days', 'active', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- 2. Test rejimi (Trial) ma'lumotlari
INSERT INTO public.employment_trials (employee_id, trial_start_date, trial_end_date, status, days_count)
VALUES
  ('33333333-3333-3333-3333-333333333333', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '2 days', 'in_progress', 5)
ON CONFLICT DO NOTHING;

-- 3. Ish jadvali (Work Schedules)
INSERT INTO public.work_schedules (employee_id, shift_start, shift_end, branch, work_days)
VALUES
  ('11111111-1111-1111-1111-111111111111', '08:00', '17:00', 'Asosiy', ARRAY['Mon','Tue','Wed','Thu','Fri','Sat']),
  ('22222222-2222-2222-2222-222222222222', '09:00', '18:00', 'Asosiy', ARRAY['Mon','Tue','Wed','Thu','Fri']),
  ('33333333-3333-3333-3333-333333333333', '10:00', '19:00', 'Filial 1', ARRAY['Mon','Tue','Wed','Thu','Fri']),
  ('44444444-4444-4444-4444-444444444444', '11:00', '20:00', 'Filial 2', ARRAY['Mon','Tue','Wed','Thu','Fri','Sat'])
ON CONFLICT DO NOTHING;

-- 4. Soatlik stavkalar (Salary Rates)
INSERT INTO public.salary_rates (employee_id, hourly_rate, effective_from)
VALUES
  ('11111111-1111-1111-1111-111111111111', 12000.00, CURRENT_DATE - INTERVAL '60 days'),
  ('22222222-2222-2222-2222-222222222222', 9000.00, CURRENT_DATE - INTERVAL '30 days'),
  ('33333333-3333-3333-3333-333333333333', 7500.00, CURRENT_DATE - INTERVAL '3 days'),
  ('44444444-4444-4444-4444-444444444444', 8500.00, CURRENT_DATE - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- 5. Avanslar (Advances)
INSERT INTO public.advances (employee_id, amount, payment_type, notes, status, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 300000.00, 'cash', 'Oila ehtiyojlari uchun', 'active', NOW() - INTERVAL '5 days'),
  ('22222222-2222-2222-2222-222222222222', 150000.00, 'card', 'Yo''l haqi uchun', 'active', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- 6. Joriy oylik hisob-kitob davri (Payroll Period)
INSERT INTO public.payroll_periods (year, month, period_start, period_end, status)
VALUES
  (
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
    'calculating'
  )
ON CONFLICT (year, month) DO NOTHING;

-- 7. Bildirishnomalar (Notifications)
INSERT INTO public.notifications (target_role, type, title, message)
VALUES
  ('admin', 'trial_ending', 'Sinov muddati tugash arafasida', 'Jasur Rustamovning 5 kunlik sinov muddati tugashiga 2 kun qoldi.'),
  ('admin', 'system_ready', 'Fritto HR tizimi tayyor', 'Tizim muvaffaqiyatli ishga tushirildi va sinov ma''lumotlari yuklandi.')
ON CONFLICT DO NOTHING;
