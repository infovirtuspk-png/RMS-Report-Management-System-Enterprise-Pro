const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const databaseService = require('./services/database');
const ipcHandlers = require('./ipc/handlers');
const trayManager = require('./services/trayManager');
const backgroundTaskManager = require('./services/backgroundTaskManager');
const { ensureIcons } = require('./services/iconGenerator');

// Disable default OS menu bar
Menu.setApplicationMenu(null);

// 1. Single Instance Lock Protection
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('Another instance of RMS is already running. Quitting duplicate.');
    app.quit();
    process.exit(0);
}

let mainWindow = null;
let splashWindow = null;

// Create splash screen
function createSplashScreen() {
    const { iconIcoPath, iconPath } = ensureIcons();
    const appIcon = process.platform === 'win32' && iconIcoPath ? iconIcoPath : iconPath;

    splashWindow = new BrowserWindow({
        width: 520,
        height: 380,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        center: true,
        icon: appIcon,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    splashWindow.loadFile(path.join(__dirname, '../src/splash.html'));
    return splashWindow;
}

// Create main window
function createMainWindow(targetFile = 'index.html', startMinimized = false) {
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, `../src/${targetFile}`));
        if (!startMinimized) {
            mainWindow.show();
            mainWindow.focus();
        }
        return mainWindow;
    }

    const { iconPath, iconIcoPath } = ensureIcons();
    const appIcon = process.platform === 'win32' && iconIcoPath ? iconIcoPath : iconPath;

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1200,
        minHeight: 720,
        frame: false,
        title: 'RMS — Report Management System',
        icon: appIcon,
        backgroundColor: '#0f172a',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, `../src/${targetFile}`));

    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
        if (!startMinimized) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Close = Hide to Tray (unless quitting via Tray Exit)
    mainWindow.on('close', async (event) => {
        if (!trayManager.isQuitting) {
            event.preventDefault();
            
            // Check close_to_tray setting
            let closeAction = 'hide_to_tray';
            try {
                const setting = await databaseService.get("SELECT setting_value FROM settings WHERE setting_key = 'close_to_tray' LIMIT 1");
                if (setting && setting.setting_value) closeAction = setting.setting_value;
            } catch (_) {}

            if (closeAction === 'exit_app') {
                trayManager.isQuitting = true;
                app.quit();
                return;
            }

            mainWindow.hide();
            trayManager.showNotification(
                'RMS Background Mode',
                'RMS is running silently in the Windows System Tray.'
            );
        }
    });

    // Minimize event check
    mainWindow.on('minimize', async (event) => {
        try {
            const minSetting = await databaseService.get("SELECT setting_value FROM settings WHERE setting_key = 'minimize_to_tray' LIMIT 1");
            if (minSetting && minSetting.setting_value === '1') {
                event.preventDefault();
                mainWindow.hide();
            }
        } catch (_) {}
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

// Focus existing instance when user tries to launch second instance
app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

// Determine initial route
async function determineStartupRoute() {
    try {
        await databaseService.initialize();
        const company = await databaseService.get('SELECT id FROM companies LIMIT 1');
        if (!company) {
            return 'setup.html';
        }
        const user = await databaseService.get('SELECT id FROM users LIMIT 1');
        if (!user) {
            return 'admin-setup.html';
        }

        // Check if application was locked when closed/restarted
        const lockSetting = await databaseService.get("SELECT setting_value FROM settings WHERE setting_key = 'app_is_locked' LIMIT 1");
        if (lockSetting && lockSetting.setting_value === '1') {
            return 'lockapplication.html';
        }

        return 'login.html';
    } catch (err) {
        console.error('Error during startup check:', err);
        return 'setup.html';
    }
}

// App lifecycle
app.whenReady().then(async () => {
    createSplashScreen();

    // Register IPC Handlers
    Object.entries(ipcHandlers).forEach(([channel, handler]) => {
        if (channel === 'app:unlock' || channel === 'app:lock') return;

        ipcMain.handle(channel, async (event, ...args) => {
            try {
                return await handler(event, ...args);
            } catch (error) {
                console.error(`IPC Handler Error [${channel}]:`, error);
                throw error;
            }
        });
    });

    // Window navigation & app events
    ipcMain.handle('app:navigate', (event, targetPage) => {
        if (mainWindow) {
            mainWindow.loadFile(path.join(__dirname, `../src/${targetPage}`));
        }
        return { success: true };
    });

    ipcMain.handle('app:minimize', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.handle('app:maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
            return mainWindow.isMaximized();
        }
        return false;
    });

    ipcMain.handle('app:isMaximized', () => {
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    ipcMain.handle('app:close', () => {
        if (mainWindow) mainWindow.close();
    });

    ipcMain.handle('app:restart', () => {
        trayManager.destroy();
        app.relaunch();
        app.exit(0);
    });

    // Lock & Unlock handlers — standalone lock page routing
    ipcMain.handle('app:lock', async (event, lastPage = 'dashboard') => {
        const lockHandler = ipcHandlers['app:lock'];
        if (lockHandler) {
            await lockHandler(event, lastPage);
        }
        if (mainWindow) {
            mainWindow.loadFile(path.join(__dirname, '../src/lockapplication.html'));
            mainWindow.show();
            mainWindow.focus();
        }
        return { success: true };
    });

    ipcMain.handle('app:unlock', async (event, password) => {
        const unlockHandler = ipcHandlers['app:unlock'];
        let result = { success: false };
        if (unlockHandler) {
            result = await unlockHandler(event, password);
        }
        if (result && result.success && mainWindow) {
            mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
            mainWindow.show();
            mainWindow.focus();
        }
        return result;
    });

    // Background & Tray IPC
    ipcMain.handle('tray:getStatus', () => {
        return backgroundTaskManager.getStatus();
    });

    ipcMain.handle('tray:notify', (event, title, content) => {
        trayManager.showNotification(title, content);
        return { success: true };
    });

    ipcMain.handle('app:getStartupSettings', () => {
        const loginSettings = app.getLoginItemSettings();
        return {
            openAtLogin: loginSettings.openAtLogin,
            openAsHidden: loginSettings.openAsHidden
        };
    });

    ipcMain.handle('app:setStartupSettings', (event, settings) => {
        app.setLoginItemSettings({
            openAtLogin: !!settings.openAtLogin,
            openAsHidden: !!settings.openAsHidden
        });
        return { success: true };
    });

    // Delay splash briefly for smooth visual experience
    const initialRoute = await determineStartupRoute();

    // Check if start minimized setting is enabled
    let startMinimized = false;
    try {
        const minStart = await databaseService.get("SELECT setting_value FROM settings WHERE setting_key = 'start_minimized_to_tray' LIMIT 1");
        if (minStart && minStart.setting_value === '1') {
            startMinimized = true;
        }
    } catch (_) {}

    setTimeout(() => {
        const win = createMainWindow(initialRoute, startMinimized);
        
        // Initialize System Tray
        trayManager.initialize(win, (moduleName) => {
            if (win && win.webContents) {
                win.webContents.send('tray:open-feature', { module: moduleName });
            }
        });

        // Initialize Background Services (30m interval, expiry, backups)
        backgroundTaskManager.start(win.webContents);
    }, 1200);
});

app.on('window-all-closed', () => {
    // Keep running in tray on Windows unless explicitly quitting
    if (process.platform !== 'darwin' && trayManager.isQuitting) {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Clean up database & background tasks before quitting
app.on('before-quit', async () => {
    trayManager.isQuitting = true;
    backgroundTaskManager.stop();
    trayManager.destroy();
    await databaseService.close();
});

