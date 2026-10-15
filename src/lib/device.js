// Har bir telefon/brauzer uchun doimiy qurilma kodi.
// Brauzer xotirasida saqlanadi: shu brauzerdan qayta kirganda o'zgarmaydi,
// boshqa telefon yoki brauzerdan kirilsa — yangi kod (yangi tasdiq so'rovi).
const KEY = 'fritto_device_id'

function randomId() {
  if (crypto?.randomUUID) return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = randomId()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Xotira yopiq (maxfiy rejim) — har safar yangi kod bo'ladi
    return randomId()
  }
}

// "iPhone · Safari", "Android · Chrome", "Mac · Chrome" kabi oddiy nom
export function getDeviceLabel() {
  const ua = navigator.userAgent || ''
  const os =
    /iPhone/.test(ua) ? 'iPhone' :
    /iPad/.test(ua) ? 'iPad' :
    /Android/.test(ua) ? (ua.match(/Android[^;]*;\s*([^;)]+?)(?:\sBuild|\))/)?.[1]?.trim() || 'Android') :
    /Mac OS X/.test(ua) ? 'Mac' :
    /Windows/.test(ua) ? 'Windows' :
    /Linux/.test(ua) ? 'Linux' : 'Qurilma'
  const browser =
    /YaBrowser/.test(ua) ? 'Yandex' :
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Telegram/.test(ua) ? 'Telegram' :
    /CriOS|Chrome\//.test(ua) ? 'Chrome' :
    /FxiOS|Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Brauzer'
  return `${os} · ${browser}`
}
