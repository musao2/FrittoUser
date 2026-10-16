import { useEffect, useRef, useState } from 'react'
import { LuCamera, LuCameraOff, LuX, LuRefreshCw, LuScanFace } from 'react-icons/lu'

// Yuzni aniqlash modeli (Google MediaPipe — BlazeFace, ~230 KB)
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
const MIN_SCORE = 0.7        // yuz ekanligiga ishonch (0..1)
const MIN_FACE_WIDTH = 0.22  // yuz kadr kengligining kamida 22% bo'lsin (yaqin tursin)
const STABLE_MS = 700        // yuz shuncha vaqt barqaror ko'rinsa — rasmga olish mumkin

// Detektor bir marta yuklanadi va qayta ishlatiladi
let detectorPromise = null
async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks('/mediapipe')
      const make = (delegate) => FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      })
      try { return await make('GPU') } catch { return await make('CPU') }
    })().catch((e) => { detectorPromise = null; throw e })
  }
  return detectorPromise
}

const HINTS = {
  loading:   'Kamera tayyorlanmoqda...',
  noface:    "Yuzingizni ramka ichiga joylashtiring",
  many:      "Kadrda faqat bitta odam bo'lishi kerak",
  far:       'Telefonni yuzingizga yaqinroq tuting',
  weak:      "Yuzingiz aniq ko'rinmayapti — yorug'roq joyga o'ting",
  ok:        'Yuz aniqlandi — rasmga olishingiz mumkin',
}

/**
 * Selfi: old kamera + inson yuzini aniqlash.
 * Buyum, bo'sh kadr yoki bir nechta odam bo'lsa — rasmga olib bo'lmaydi.
 * onCaptured(blob) — JPEG rasm.
 */
export default function SelfieCapture({ title = 'Yuzingizni rasmga oling', onCaptured, onCancel }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [hint, setHint] = useState('loading')
  const [ready, setReady] = useState(false)     // yuz barqaror aniqlandi
  const [error, setError] = useState(null)      // 'denied' | 'nocamera' | 'model'
  const [attempt, setAttempt] = useState(0)
  const okSince = useRef(0)

  useEffect(() => {
    let stream = null
    let raf = 0
    let stopped = false
    let lastTs = 0

    const stop = () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach(t => t.stop())
    }

    const start = async () => {
      setError(null)
      setHint('loading')
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('nocamera')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        })
      } catch (e) {
        setError(e?.name === 'NotAllowedError' ? 'denied' : 'nocamera')
        return
      }
      if (stopped) return stop()
      const video = videoRef.current
      video.srcObject = stream
      await video.play().catch(() => {})

      let detector
      try {
        detector = await getDetector()
      } catch {
        if (!stopped) setError('model')
        return
      }
      if (stopped) return

      const tick = () => {
        if (stopped) return
        const now = performance.now()
        // ~8 marta soniyada tekshiramiz (telefon qizib ketmasin)
        if (now - lastTs > 120 && video.readyState >= 2) {
          lastTs = now
          let faces = []
          try {
            faces = detector.detectForVideo(video, now).detections || []
          } catch { /* bitta kadr o'tkazib yuboriladi */ }

          let state
          if (faces.length === 0) state = 'noface'
          else if (faces.length > 1) state = 'many'
          else {
            const f = faces[0]
            const score = f.categories?.[0]?.score ?? 0
            const width = (f.boundingBox?.width || 0) / (video.videoWidth || 1)
            if (score < MIN_SCORE) state = 'weak'
            else if (width < MIN_FACE_WIDTH) state = 'far'
            else state = 'ok'
          }

          if (state === 'ok') {
            if (!okSince.current) okSince.current = now
          } else {
            okSince.current = 0
          }
          setHint(state)
          setReady(state === 'ok' && now - okSince.current >= STABLE_MS)
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    start()
    return stop
  }, [attempt])

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !ready) return
    // 640 px gacha kichraytiramiz (tez yuklanadi, 2 MB dan kichik)
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    // oldingi kamera ko'zgu kabi ko'rsatiladi — rasm ham shunday saqlansin
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => blob && onCaptured(blob), 'image/jpeg', 0.82)
    if (navigator.vibrate) navigator.vibrate(60)
  }

  const ok = hint === 'ok'

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="h-14 px-4 flex items-center justify-between text-white flex-shrink-0">
        <p className="text-base font-medium">{title}</p>
        {onCancel && (
          <button onClick={onCancel} className="p-2 -mr-2 text-white/80 hover:text-white cursor-pointer" aria-label="Bekor qilish">
            <LuX size={24} />
          </button>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {!error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-64 h-80 rounded-[50%] border-4 transition-colors shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ${
                ok ? 'border-[#FCA914]' : 'border-white/80'
              }`}
            />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-white rounded-xl p-6 text-center max-w-sm">
              <LuCameraOff size={36} className="mx-auto text-red-500 mb-3" />
              <p className="text-base font-semibold text-slate-900">
                {{ denied: 'Kameraga ruxsat berilmagan', nocamera: 'Kamera ochilmadi', model: "Yuzni aniqlash yuklanmadi" }[error]}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {{
                  denied: "Davomat uchun yuzingiz rasmga olinishi shart. Brauzer sozlamalarida shu saytga kameradan foydalanishga ruxsat bering.",
                  nocamera: "Old kamera topilmadi yoki sayt https orqali ochilmagan.",
                  model: "Internet aloqasini tekshiring va qayta urinib ko'ring.",
                }[error]}
              </p>
              <button onClick={() => setAttempt(a => a + 1)} className="btn-primary w-full mt-5">
                <LuRefreshCw size={16} /> Qayta urinish
              </button>
              {onCancel && <button onClick={onCancel} className="btn-secondary w-full mt-2">Bekor qilish</button>}
            </div>
          </div>
        )}
      </div>

      {!error && (
        <div className="px-6 pt-4 pb-8 flex-shrink-0 text-center">
          <p className={`text-base flex items-center justify-center gap-2 ${ok ? 'text-[#FCA914]' : 'text-white'}`}>
            <LuScanFace size={18} />
            {HINTS[hint]}
          </p>
          <button
            id="selfie-capture"
            onClick={capture}
            disabled={!ready}
            className="mt-5 mx-auto w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-opacity disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Rasmga olish"
          >
            <span className={`w-14 h-14 rounded-full flex items-center justify-center ${ready ? 'bg-[#FCA914] text-[#111111]' : 'bg-white/80 text-slate-500'}`}>
              <LuCamera size={24} />
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
