# FRITTO — Xodim kabineti

> Bu xodimlar uchun alohida sayt (http://localhost:5174). Admin panel alohida loyihada: `../DavomatCrmFritto` (http://localhost:5173). Ikkalasi bitta Supabase bazasidan foydalanadi.

> Xodimlar davomati, ish vaqti, soatbay ish haqi, 5 kunlik sinov muddati, avanslar va hisobotlarni to'liq avtomatlashtirilgan boshqaruv tizimi.

---

## 🛠 Texnologiyalar to'plami

- **Frontend**: React 19 + Vite 8
- **Dizayn & Uslub**: Tailwind CSS (Dark tema, Toshkent vaqt mintaqasi uchun optimallashtirilgan)
- **Navigatsiya**: React Router DOM v7
- **Backend & DB**: Supabase (PostgreSQL, Realtime, Row Level Security)
- **Autentifikatsiya**: Supabase Auth (Admin & Xodim rollari)
- **Grafiklar**: Recharts
- **Eksport**: SheetJS (XLSX) Excel eksporti
- **Ikonkalar**: React Icons (react-icons)

---

## 🚀 O'rnatish va Ishga Tushirish

### 1. Qaramliklarni o'rnatish
```bash
npm install
```

### 2. Environment o'zgaruvchilarini sozlash
Loyiha ildizidagi `.env.example` faylidan nusxa olib, `.env` faylini yarating:

```bash
cp .env.example .env
```

`.env` fayliga o'zingizning Supabase loyihangiz kalitlarini kiriting:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Supabase Database migratsiyasini ishga tushirish
1. [Supabase Dashboard](https://supabase.com/dashboard) ga kiring.
2. Loyihangizning **SQL Editor** bo'limini oching.
3. [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) faylining to'liq tarkibini nusxalab, SQL Editor'da bajaring (**Run**).
4. *(Ixtiyoriy test uchun)*: [`supabase/seed.sql`](supabase/seed.sql) faylini ham SQL Editor'da bajaring — tizimga namunaviy xodimlar, test rejimlari va smenalar yuklanadi.

### 4. Ilk Admin hisobini yaratish
1. Supabase Dashboard > **Authentication** > **Users** bo'limiga o'ting.
2. **Add User** tugmasini bosing va admin uchun email hamda parol kiriting (masalan: `admin@fritto.uz`).
3. SQL Editor'da ushbu foydalanuvchiga admin huquqini bering:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@fritto.uz';
```

### 5. Dasturni ishga tushirish
```bash
npm run dev
```
Brauzerda `http://localhost:5173` manziliga kiring.

---

## 📱 Tizim Rollari va Imkoniyatlari

### 1. Admin Panel (`/admin`)
- **Dashboard**: Bugungi davomat statistikasi, faol smenalar, kechikkanlar, oylik hisoblangan ish haqi va sinov muddatidagi xodimlar soni.
- **Xodimlar**: Xodimlarni qo'shish, tahrirlash, nofaol qilish, ularning stavkalari tarixi va shaxsiy ma'lumotlarini boshqarish.
- **Test rejimi**: Yangi qabul qilingan xodimlarning 5 kunlik sinov muddatini progress bar orqali kuzatish, tasdiqlash, rad etish yoki muddatini uzaytirish.
- **Davomat**: Kunlik va davriy check-in/check-outlar ro'yxati, kechikish daqiqalari, audit log bilan ma'lumotlarni qo'lda tuzatish, Excelga yuklab olish.
- **Ish haqi (Payroll)**: Oylik smenalarni soatbay stavka bo'yicha hisoblash, bonus va chegirmalar qo'shish, sof to'lanadigan summani aniqlash.
- **Avanslar**: Xodimlarga berilgan naqd yoki karta orqali avanslarni qayd etish va bekor qilish.
- **To'lovlar**: Amalga oshirilgan to'lovlar tarixi, kassa/karta to'lovlari hisoboti.
- **Hisobotlar**: Grafiklar (Pie va Bar chartlar), sana oralig'idagi xodimlar faoliyati tahlili, Excel formatida eksport.
- **Sozlamalar**: Tizim parametrlari va kechikish chegarasi konfiguratsiyasi.

### 2. Xodim Paneli (`/employee`)
- **Asosiy panel**:
  - Jonli smena taymeri (ish vaqtini sekundigacha ko'rsatuvchi interfeys).
  - 1 marta bosish bilan **Ishni boshlash (Check-in)** va **Ishni yakunlash (Check-out)** tugmalari.
  - 5 kunlik test rejimi progress bari (agar sinovda bo'lsa).
  - Joriy oydagi ishlangan umumiy soatlar, hisoblangan mablag', olingan avanslar va qoldiq ish haqi.
  - Oxirgi smenalar ro'yxati.
- **Davomat tarixi (`/employee/history`)**: Barcha ishlangan kunlar, boshlanish va tugash vaqtlari, tanaffuslar va ishlab topilgan mablag'.
- **Ish haqi qog'ozi (`/employee/payslip`)**: Oylik batafsil to'lov varaqasi, avanslar yechilmasi va to'lov holati.
- **Profil (`/employee/profile`)**: Shaxsiy ma'lumotlar, ish grafigi va adminga xabar/ariza yuborish imkoniyati.

---

## 🔒 Xavfsizlik va RLS (Row Level Security)

Barcha 14 ta asosiy database jadvallarida **Row Level Security (RLS)** to'liq yoqilgan:
- Xodimlar faqat o'zlariga tegishli davomat, to'lov, avans va profil ma'lumotlarini o'qiy oladi.
- Xodimlar o'zlarining rolini yoki boshqa xodimlarning ma'lumotlarini ko'ra olmaydi va tahrirlay olmaydi.
- Adminlar barcha ma'lumotlarni boshqarish vakolatiga ega (`public.is_admin()` funksiyasi orqali himoyalangan).
- Har bir muhim tuzatish va ma'lumot o'zgarishi `public.audit_logs` jadvalida qayd etiladi.

---

## 📂 Papkalar Strukturasi

```
DavomatCrmFritto/
├── public/                 # Statik resurslar va favicon
├── src/
│   ├── assets/             # Rasmlar va media
│   ├── components/         # Qayta ishlatiluvchi UI komponentlar
│   │   └── admin/          # NotificationBell va admin komponentlar
│   ├── context/            # AuthContext (Foydalanuvchi va Rol holati)
│   ├── layouts/            # AdminLayout va EmployeeLayout (Sidebar, Header, Responsive)
│   ├── lib/                # supabase.js (Barcha API va hisob-kitob funksiyalari)
│   ├── pages/
│   │   ├── LoginPage.jsx   # Avtorizatsiya sahifasi
│   │   ├── admin/          # 9 ta Admin sahifalari
│   │   └── employee/       # 4 ta Xodim sahifalari
│   ├── App.jsx             # Marshrutlash (Routing) va ruxsatlar
│   ├── index.css           # Tailwind va maxsus stillar
│   └── main.jsx            # Ilova kirish nuqtasi
├── supabase/
│   ├── migrations/         # 001_initial_schema.sql (14 ta jadval, RLS, Triggerlar)
│   └── seed.sql            # Demo ma'lumotlar to'plami
├── index.html              # HTML shablon (Inter shrifti)
├── tailwind.config.js      # Dark tema va ranglar palitrasi
└── vite.config.js          # Vite konfiguratsiyasi
```
# FrittoUser
