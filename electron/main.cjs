// ROYAL POWER – desktop shell. Loads the built web app (dist/), talks to the same Supabase database,
// and updates itself from GitHub Releases (electron-updater).
const { app, BrowserWindow, protocol, net, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

let autoUpdater = null
try {
  ;({ autoUpdater } = require('electron-updater'))
} catch {
  /* running from source without the package installed – updates are simply disabled */
}

const DIST = path.join(__dirname, '..', 'dist')
const ORIGIN = 'app://royalpower'

// Serve dist/ over a custom, secure scheme so React Router (BrowserRouter) and Supabase auth storage work.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

if (!app.requestSingleInstanceLock()) app.quit()
app.setAppUserModelId('com.royalpower.desktop')

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#F4FAFF',
    title: 'ROYAL POWER',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // admins may leave the app open all day – notification sounds must play without a prior click
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  void win.loadURL(`${ORIGIN}/`)

  // Links to other websites open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault()
      if (/^https?:/i.test(url)) void shell.openExternal(url)
    }
  })
}

/** Checks GitHub Releases on start and every 4 hours; downloads silently; asks to restart when ready. */
function setupAutoUpdate() {
  if (!app.isPackaged || !autoUpdater) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const options = {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `ROYAL POWER ${info.version} is ready to install.`,
      detail: 'Restart to finish updating. If you choose Later, it installs automatically when you close the app.',
    }
    const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
    if (response === 0) autoUpdater.quitAndInstall(true, true)
  })
  autoUpdater.on('error', () => {
    /* offline or no release yet – try again at the next interval */
  })

  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  check()
  setInterval(check, 4 * 60 * 60 * 1000)
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 })
    // Unknown paths (e.g. /admin/tickets) fall back to index.html so client-side routing works.
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return net.fetch(pathToFileURL(file).toString())
  })
  createWindow()
  setupAutoUpdate()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
