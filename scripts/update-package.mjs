// One-time helper: adds auto-update (Windows), Android (Capacitor) and GitHub release settings to package.json
// without touching anything else. Safe to run more than once.
//   node scripts/update-package.mjs [github-owner] [github-repo]
import fs from 'node:fs'

const [owner = 'Abdalaman123', repo = 'royal-power-app'] = process.argv.slice(2)
const file = 'package.json'
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))

pkg.main = 'electron/main.cjs'
pkg.author ||= 'ROYAL POWER IT'
pkg.scripts = {
  ...pkg.scripts,
  desktop: 'npm run build && electron .',
  'desktop:build': 'npm run build && electron-builder --win --publish never',
}

// Everything React/Vite is bundled into dist/ already, so only electron-updater is needed at runtime.
// Keeping the rest in devDependencies makes the Windows installer smaller.
const deps = pkg.dependencies ?? {}
const dev = pkg.devDependencies ?? {}
for (const [name, ver] of Object.entries(deps)) {
  if (name !== 'electron-updater') {
    dev[name] = ver
    delete deps[name]
  }
}
deps['electron-updater'] = '^6.3.9'
dev.electron ||= '^33.2.1'
dev['electron-builder'] ||= '^25.1.8'
dev['@capacitor/cli'] = '^6.2.0'
dev['@capacitor/core'] = '^6.2.0'
dev['@capacitor/android'] = '^6.2.0'

const sort = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
pkg.dependencies = sort(deps)
pkg.devDependencies = sort(dev)

const b = pkg.build ?? {}
pkg.build = {
  ...b,
  appId: 'com.royalpower.desktop',
  productName: 'ROYAL POWER',
  directories: { output: 'release' },
  files: ['dist/**/*', 'electron/**/*', 'package.json'],
  win: { ...(b.win ?? {}), target: 'nsis', signAndEditExecutable: false, artifactName: 'ROYAL-POWER-Setup.${ext}' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true },
  publish: [{ provider: 'github', owner, repo }],
}

fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
console.log(`package.json updated (GitHub releases: ${owner}/${repo}). Now run: npm install`)
