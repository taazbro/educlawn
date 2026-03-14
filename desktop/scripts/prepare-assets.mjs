import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(desktopDir, '..')
const sourceImage = path.join(rootDir, 'frontend', 'src', 'assets', 'hero.png')
const buildDir = path.join(desktopDir, 'build')
const iconsetDir = path.join(buildDir, 'icon.iconset')
const iconPng = path.join(buildDir, 'icon.png')
const iconIcns = path.join(buildDir, 'icon.icns')
const iconIco = path.join(buildDir, 'icon.ico')

mkdirSync(buildDir, { recursive: true })
mkdirSync(iconsetDir, { recursive: true })

const metadata = await sharp(sourceImage).metadata()
const sourceWidth = metadata.width ?? 1024
const sourceHeight = metadata.height ?? 1024
const squareSize = Math.min(sourceWidth, sourceHeight)
const left = Math.max(0, Math.floor((sourceWidth - squareSize) / 2))
const top = Math.max(0, Math.floor((sourceHeight - squareSize) / 2))

await sharp(sourceImage)
  .extract({ left, top, width: squareSize, height: squareSize })
  .resize(1024, 1024)
  .png()
  .toFile(iconPng)

const icoBuffer = await pngToIco(iconPng)
writeFileSync(iconIco, icoBuffer)

if (!existsSync(iconIco)) {
  throw new Error('Failed to generate desktop icon.ico.')
}

if (process.platform !== 'darwin') {
  process.exit(0)
}

const sizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

for (const [fileName, size] of sizes) {
  await sharp(iconPng)
    .resize(size, size)
    .png()
    .toFile(path.join(iconsetDir, fileName))
}

const iconutilResult = spawnSync('iconutil', ['-c', 'icns', iconsetDir, '-o', iconIcns], {
  stdio: 'ignore',
})

if (iconutilResult.status !== 0 && !existsSync(iconIcns)) {
  throw new Error('Failed to generate desktop icon.icns with iconutil.')
}
