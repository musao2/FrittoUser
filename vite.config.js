import fs from 'node:fs'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Xodimlar sayti:
//   npm run dev        → http://localhost:5174       (kompyuterda ishlash uchun)
//   npm run dev:phone  → https://<kompyuter-IP>:5176 (telefon: QR skaner kamerasi faqat https da ochadi)
// host: true — telefon shu kompyuterdagi saytni Wi-Fi orqali ocha olishi uchun.

// Kompyuterning hozirgi Wi-Fi manzili
function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return a.address
    }
  }
  return '127.0.0.1'
}

// Lokal https sertifikati: Wi-Fi manzili o'zgarsa, avtomatik qayta yaratiladi
function ensureCert() {
  const ip = lanIp()
  const marker = '.cert/ip.txt'
  const fresh = fs.existsSync('.cert/key.pem') && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === ip
  if (!fresh) {
    fs.mkdirSync('.cert', { recursive: true })
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
      '-keyout', '.cert/key.pem', '-out', '.cert/cert.pem',
      '-subj', '/CN=FRITTO local',
      '-addext', `subjectAltName=IP:${ip},IP:127.0.0.1,DNS:localhost`,
    ], { stdio: 'ignore' })
    fs.writeFileSync(marker, ip)
    console.log(`\n  Telefon uchun manzil: https://${ip}:5176\n`)
  }
  return { key: fs.readFileSync('.cert/key.pem'), cert: fs.readFileSync('.cert/cert.pem') }
}

const useHttps = process.env.FRITTO_HTTPS === '1'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: useHttps ? 5176 : 5174,
    strictPort: true,
    https: useHttps ? ensureCert() : undefined,
  },
})
