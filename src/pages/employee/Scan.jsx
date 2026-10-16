import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LuLogIn, LuLogOut, LuCircleAlert, LuClock, LuMapPin, LuRefreshCw, LuMapPinOff, LuCamera } from 'react-icons/lu'
import { supabase, formatDuration, formatMoney } from '../../lib/supabase'
import { getDeviceId } from '../../lib/device'
import { useAuth } from '../../context/AuthContext'
import SelfieCapture from '../../components/SelfieCapture'

// Tizimga kirmasdan skanerlansa — QR shu yerda eslab qolinadi (masalan "?b=..." yoki "?t=...")
export const PENDING_QR_KEY = 'fritto_pending_qr'

const ERRORS = {
  QR_EXPIRED:          { title: 'QR kod eskirgan',            text: "Ekrandagi QR kod tez yangilanadi. Ekran oldida turib qayta skanerlang." },
  QR_INVALID:          { title: 'QR kod yaroqsiz',            text: "Bu QR kod yangilangan yoki filial o'chirilgan. Administratorga murojaat qiling." },
  PHOTO_REQUIRED:      { title: 'Rasm kerak', selfie: true,
                         text: "Davomat uchun yuzingiz rasmga olinishi shart. Qayta rasmga oling." },
  PHOTO_UPLOAD:        { title: 'Rasm yuklanmadi', selfie: true,
                         text: "Internet aloqasini tekshirib, qayta rasmga oling." },
  TOO_SOON:            { title: 'Hozirgina skanerladingiz',   text: "Bir daqiqadan keyin qayta urinib ko'ring." },
  NOT_EMPLOYEE:        { title: 'Xodim topilmadi',            text: "Bu hisob xodimga bog'lanmagan. Administratorga murojaat qiling." },
  DEVICE_NOT_APPROVED: { title: 'Qurilma tasdiqlanmagan',     text: "Bu telefondan davomat qilish uchun admin ruxsat berishi kerak." },
  EMPLOYEE_INACTIVE:   { title: 'Hisobingiz faol emas',       text: "Siz ishdan bo'shatilgansiz yoki hisobingiz yopilgan. Administratorga murojaat qiling." },
  LOCATION_REQUIRED:   { title: 'Joylashuv kerak',            text: "Davomat uchun telefon joylashuvi (GPS) yoqilgan bo'lishi kerak.", retry: true },
  LOCATION_DENIED:     { title: 'Joylashuvga ruxsat berilmadi', retry: true, location: true,
                         text: "Davomat faqat filial ichida qabul qilinadi, shuning uchun joylashuv kerak." },
  LOCATION_UNAVAILABLE:{ title: 'Joylashuv aniqlanmadi', retry: true,
                         text: "Telefonda GPS (Joylashuv) yoqilganini tekshiring va qayta urinib ko'ring." },
  LOW_ACCURACY:        { title: 'GPS aniqligi past', retry: true,
                         text: (m) => `Joylashuv ±${m} metr aniqlikda topildi — bu yetarli emas. Deraza yoki eshik yoniga o'tib qayta urinib ko'ring.` },
  TOO_FAR:             { title: 'Siz filialdan uzoqdasiz', retry: true,
                         text: (d, r) => `Siz filialdan taxminan ${d} metr uzoqdasiz (ruxsat etilgan: ${r} m). Filial ichida turib qayta skanerlang.` },
}

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })

// Bino ichida GPS birinchi o'lchovda xato beradi — bir necha soniya kuzatib, eng aniq natijani olamiz
function getBestPosition({ maxWaitMs = 10000, goodEnoughM = 20 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 'LOCATION_UNAVAILABLE' })
    let best = null
    let done = false
    const finish = (err) => {
      if (done) return
      done = true
      navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)
      if (best) resolve(best)
      else reject(err || { code: 'LOCATION_UNAVAILABLE' })
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos
        if (pos.coords.accuracy <= goodEnoughM) finish()
      },
      (err) => finish({ code: err.code === 1 ? 'LOCATION_DENIED' : 'LOCATION_UNAVAILABLE' }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
    )
    const timer = setTimeout(() => finish(), maxWaitMs)
  })
}

export default function ScanPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const token  = params.get('t') // ekrandagi (kiosk) QR
  const branch = params.get('b') // qog'ozdagi filial QR
  const [state, setState] = useState(
    token || branch ? { status: 'selfie' } : { status: 'error', code: 'QR_INVALID' }
  )
  const posRef = useRef(null)    // joylashuv (selfi olinayotganda parallel aniqlanadi)
  const photoRef = useRef(null)  // yuklangan rasm yo'li — qayta urinishda qayta ishlatiladi
  const started = useRef(false)

  // Qog'ozdagi QR bo'lsa — joylashuvni darhol aniqlay boshlaymiz
  const startLocating = useCallback(() => {
    posRef.current = getBestPosition()
    posRef.current.catch(() => {}) // xatoni keyin, kerak bo'lganda ko'rsatamiz
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    try { sessionStorage.removeItem(PENDING_QR_KEY) } catch { /* ahamiyatsiz */ }
    if (branch) startLocating()
  }, [branch, startLocating])

  const fail = (msg) => {
    const code = Object.keys(ERRORS).find(c => (msg || '').includes(c))
    // "TOO_FAR:85:50" yoki "LOW_ACCURACY:120" — raqamlarni ajratib olamiz
    const args = (msg || '').split(':').slice(1).map(Number).filter(n => Number.isFinite(n))
    setState({ status: 'error', code, args, message: msg })
  }

  // Rasm yuklangandan keyin — serverga yuborish
  const submit = useCallback(async () => {
    const photoPath = photoRef.current
    let call, legacy
    if (branch) {
      setState({ status: 'loading', step: 'location' })
      let pos
      try {
        pos = await (posRef.current || getBestPosition())
      } catch (e) {
        posRef.current = null
        fail(e.code || 'LOCATION_UNAVAILABLE')
        return
      }
      posRef.current = null
      setState({ status: 'loading', step: 'check' })
      const args = {
        p_code: branch, p_device_id: getDeviceId(),
        p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy,
      }
      call = () => supabase.rpc('branch_check_in_out', { ...args, p_photo_path: photoPath })
      legacy = () => supabase.rpc('branch_check_in_out', args)
    } else {
      setState({ status: 'loading', step: 'check' })
      const args = { p_token: token, p_device_id: getDeviceId() }
      call = () => supabase.rpc('qr_check_in_out', { ...args, p_photo_path: photoPath })
      legacy = () => supabase.rpc('qr_check_in_out', args)
    }

    let { data, error } = await call()
    // Bazada 010_attendance_selfie.sql hali ishga tushirilmagan bo'lsa — eski funksiya
    if (error && (error.code === 'PGRST202' || error.message?.includes('Could not find the function'))) {
      ({ data, error } = await legacy())
    }
    if (error) fail(error.message || '')
    else setState({ status: 'done', result: data })
  }, [token, branch])

  // Selfi olindi — rasmni yuklaymiz
  const onCaptured = async (blob) => {
    setState({ status: 'loading', step: 'upload' })
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
    const path = `${user.id}/${day}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('attendance-photos').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (error) {
      fail('PHOTO_UPLOAD')
      return
    }
    photoRef.current = path
    submit()
  }

  const retry = () => {
    const err = ERRORS[state.code]
    if (err?.selfie || !photoRef.current) {
      photoRef.current = null
      if (branch && !posRef.current) startLocating()
      setState({ status: 'selfie' })
    } else {
      // Rasm allaqachon bor — faqat joylashuv/tekshiruvni qaytaramiz
      if (branch) startLocating()
      submit()
    }
  }

  if (state.status === 'selfie') {
    return (
      <SelfieCapture
        title={branch ? 'Davomat: yuzingizni rasmga oling' : 'Yuzingizni rasmga oling'}
        onCaptured={onCaptured}
        onCancel={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')}
      />
    )
  }

  const err = state.status === 'error' ? (ERRORS[state.code] || null) : null
  const errText = err ? (typeof err.text === 'function' ? err.text(...(state.args || [])) : err.text) : state.message

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full text-center">
        {state.status === 'loading' && (
          <>
            {state.step === 'upload' ? (
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-5 animate-pulse">
                <LuCamera size={36} />
              </div>
            ) : state.step === 'location' ? (
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-5 animate-pulse">
                <LuMapPin size={36} />
              </div>
            ) : (
              <div className="w-12 h-12 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            )}
            <p className="text-base text-slate-900 font-medium">
              {state.step === 'upload' ? 'Rasm yuklanmoqda...' : state.step === 'location' ? 'Joylashuvingiz aniqlanmoqda...' : 'Tekshirilmoqda...'}
            </p>
            {state.step === 'location' && (
              <p className="text-sm text-slate-500 mt-1">Telefon joylashuvga ruxsat so'rasa — «Ruxsat berish»ni bosing</p>
            )}
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
            {state.result.branch && (
              <p className="text-sm text-slate-500 mt-3 flex items-center justify-center gap-1.5">
                <LuMapPin size={14} /> {state.result.branch}
              </p>
            )}
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
              {state.result.branch && <Row label="Filial" value={state.result.branch} />}
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
              {err?.location ? <LuMapPinOff size={36} /> : <LuCircleAlert size={36} />}
            </div>
            <p className="text-2xl font-semibold text-slate-900">{err?.title || 'Xatolik yuz berdi'}</p>
            <p className="text-base text-slate-500 mt-2 max-w-xs mx-auto">{errText}</p>

            {err?.location && (
              <div className="mt-5 text-left bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 space-y-2">
                <p className="font-medium text-slate-900">Joylashuvni qanday yoqish kerak:</p>
                <p><span className="font-medium">iPhone:</span> Sozlamalar → Maxfiylik → Joylashuv xizmatlari → Safari (yoki Chrome) → «Ilovadan foydalanganda».</p>
                <p><span className="font-medium">Android:</span> Brauzer manzil qatoridagi qulf belgisi → Ruxsatlar → Joylashuv → «Ruxsat berish».</p>
              </div>
            )}

            {(err?.retry || err?.selfie) && (
              <button onClick={retry} className="btn-primary w-full mt-6">
                {err?.selfie ? <LuCamera size={16} /> : <LuRefreshCw size={16} />}
                {err?.selfie ? 'Qayta rasmga olish' : 'Qayta urinish'}
              </button>
            )}
          </>
        )}

        {state.status !== 'loading' && (
          <Link to="/" className="btn-secondary w-full mt-3">Bosh sahifaga</Link>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm tabular-nums text-right ${strong ? 'font-semibold text-emerald-700' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
