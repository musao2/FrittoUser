// Yuzni aniqlash (MediaPipe) dvigateli fayllarini node_modules'dan public/ ga nusxalash.
// npm run dev / build oldidan avtomatik ishga tushadi (package.json → predev, prebuild).
import { cpSync, existsSync, mkdirSync } from 'node:fs'

const src = 'node_modules/@mediapipe/tasks-vision/wasm'
const dest = 'public/mediapipe'
const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

if (!existsSync(src)) {
  console.error(`[mediapipe] ${src} topilmadi — avval "npm install" qiling`)
  process.exit(1)
}
mkdirSync(dest, { recursive: true })
for (const f of files) cpSync(`${src}/${f}`, `${dest}/${f}`)
console.log(`[mediapipe] ${files.length} ta fayl → ${dest}`)
