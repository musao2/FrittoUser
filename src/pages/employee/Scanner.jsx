import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { LuX, LuCameraOff, LuCircleAlert } from 'react-icons/lu'

// QR ichidagi matndan tokenni ajratib olish: ".../scan?t=TOKEN" yoki tokenning o'zi
function extractToken(text) {
  try {
    const url = new URL(text)
    if (url.pathname.endsWith('/scan')) return url.searchParams.get('t')
  } catch {
    // URL emas
  }
  return /^[0-9a-f]{64}$/.test(text) ? text : null
}

export default function ScannerPage() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState(null) // 'insecure' | 'denied' | 'nocamera' | null
  const [wrongCode, setWrongCode] = useState(false)

  useEffect(() => {
    let stream = null
    let raf = 0
    let stopped = false
    let wrongTimer = 0

    const stop = () => {
      stopped = true
      cancelAnimationFrame(raf)
      clearTimeout(wrongTimer)
      stream?.getTracks().forEach(t => t.stop())
    }

    const tick = () => {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Tezlik uchun kichraytirib o'qiymiz
        const scale = Math.min(1, 640 / video.videoWidth)
        const w = Math.round(video.videoWidth * scale)
        const h = Math.round(video.videoHeight * scale)
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(video, 0, 0, w, h)
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
        if (code?.data) {
          const token = extractToken(code.data)
          if (token) {
            stop()
            if (navigator.vibrate) navigator.vibrate(80)
            navigate(`/scan?t=${token}`, { replace: true })
            return
          }
          setWrongCode(true)
          clearTimeout(wrongTimer)
          wrongTimer = setTimeout(() => setWrongCode(false), 2000)
        }
      }
      raf = requestAnimationFrame(tick)
    }

    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('insecure')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (stopped) return stop()
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        raf = requestAnimationFrame(tick)
      } catch (err) {
        setError(err?.name === 'NotAllowedError' ? 'denied' : 'nocamera')
      }
    }

    start()
    return stop
  }, [navigate])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Yuqori qism */}
      <div className="h-14 px-4 flex items-center justify-between text-white flex-shrink-0">
        <p className="text-base font-medium">QR kodni skanerlash</p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="p-2 -mr-2 text-white/80 hover:text-white cursor-pointer"
          aria-label="Yopish"
        >
          <LuX size={24} />
        </button>
      </div>

      {/* Kamera */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {!error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-white rounded-xl p-6 text-center max-w-sm">
              {error === 'insecure' ? <LuCircleAlert size={36} className="mx-auto text-amber-500 mb-3" /> : <LuCameraOff size={36} className="mx-auto text-red-500 mb-3" />}
              <p className="text-base font-semibold text-slate-900">
                {{ insecure: 'Kamera ochilmadi', denied: 'Kameraga ruxsat berilmagan', nocamera: 'Kamera topilmadi' }[error]}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {{
                  insecure: "Sayt https:// manzil orqali ochilishi kerak. Yoki telefonning oddiy kamerasi bilan QR kodni skanerlang.",
                  denied: "Brauzer sozlamalarida shu saytga kameradan foydalanishga ruxsat bering va qayta urinib ko'ring.",
                  nocamera: "Telefonning oddiy kamerasi bilan QR kodni skanerlang — havola o'zi ochiladi.",
                }[error]}
              </p>
              <button onClick={() => navigate('/', { replace: true })} className="btn-secondary w-full mt-5">
                Orqaga
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pastki yozuv */}
      {!error && (
        <div className="px-6 py-6 text-center flex-shrink-0">
          <p className={`text-base ${wrongCode ? 'text-amber-300' : 'text-white'}`}>
            {wrongCode ? "Bu FRITTO davomat QR kodi emas" : 'Ish joyidagi ekrandagi QR kodni ramka ichiga joylashtiring'}
          </p>
        </div>
      )}
    </div>
  )
}
