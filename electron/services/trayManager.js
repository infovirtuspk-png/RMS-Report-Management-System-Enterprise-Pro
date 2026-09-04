const { app, Tray, Menu, nativeImage, dialog, BrowserWindow } = require('electron');
const path = require('path');
const { ensureIcons } = require('./iconGenerator');

class TrayManager {
    constructor() {
        this.tray = null;
        this.mainWindow = null;
        this.isQuitting = false;
    }

    initialize(mainWindow, onFeatureNavigate) {
        this.mainWindow = mainWindow;
        this.onFeatureNavigate = onFeatureNavigate;

        const { trayPath, iconPath, iconIcoPath } = ensureIcons();
        
        let icon = null;
        if (process.platform === 'win32' && iconIcoPath && require('fs').existsSync(iconIcoPath)) {
            icon = nativeImage.createFromPath(iconIcoPath);
        } else if (trayPath && require('fs').existsSync(trayPath)) {
            icon = nativeImage.createFromPath(trayPath);
        } else if (iconPath && require('fs').existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath);
        }

        if (!icon || icon.isEmpty()) {
            icon = nativeImage.createEmpty();
        }

        try {
            if (this.tray) {
                try { this.tray.destroy(); } catch (_) {}
                this.tray = null;
            }

            this.tray = new Tray(icon);
            this.tray.setToolTip('RMS — Report Management System');

            this.updateContextMenu();

            // Click / Double click on tray icon restores main window
            this.tray.on('click', () => {
                this.restoreWindow();
            });

            this.tray.on('double-click', () => {
                this.restoreWindow();
            });
        } catch (err) {
            console.error('Failed to create tray icon:', err);
        }
    }

    updateContextMenu() {
        if (!this.tray) return;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Open RMS',
                click: () => this.restoreWindow()
            },
            { type: 'separator' },
            {
                label: 'Dashboard',
                click: () => this.openFeature('dashboard')
            },
            {
                label: 'Quick Add Income',
                click: () => this.openFeature('income', 'showAddModal')
            },
            {
                label: 'Quick Add Expense',
                click: () => this.openFeature('expenses', 'showAddModal')
            },
            {
                label: 'New Invoice',
                click: () => this.openFeature('invoices', 'showAddModal')
            },
            {
                label: 'Mark Attendance',
                click: () => this.openFeature('attendance')
            },
            {
                label: "Today's Report",
                click: () => this.openFeature('daily-reports')
            },
            {
                label: 'Backup Now',
                click: () => this.openFeature('backup', 'quickBackup')
            },
            {
                label: 'Lock Application',
                click: () => this.triggerLock()
            },
            {
                label: 'Settings',
                click: () => this.openFeature('settings')
            },
            {
                label: 'About RMS',
                click: () => this.openFeature('about')
            },
            { type: 'separator' },
            {
                label: 'Restart RMS',
                click: () => {
                    app.relaunch();
                    app.exit(0);
                }
            },
            {
                label: 'Exit RMS',
                click: () => this.confirmExit()
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    restoreWindow() {
        if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            }
            this.mainWindow.show();
            this.mainWindow.focus();
        }
    }

    openFeature(moduleName, action = null) {
        this.restoreWindow();
        if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send('tray:open-feature', { module: moduleName, action: action });
        }
    }

    async triggerLock() {
        this.restoreWindow();
        const databaseService = require('./database');
        try {
            await databaseService.run('INSERT INTO settings (setting_key, setting_value) VALUES ("app_is_locked", "1") ON CONFLICT(setting_key) DO UPDATE SET setting_value = "1"');
        } catch (_) {}
        if (this.mainWindow) {
            this.mainWindow.loadFile(path.join(__dirname, '../src/lockapplication.html'));
            this.mainWindow.show();
            this.mainWindow.focus();
        }
    }

    showNotification(title, content) {
        if (this.tray) {
            this.tray.displayBalloon({
                title: title || 'RMS Notification',
                content: content || '',
                iconType: 'info'
            });
        }
    }

    async confirmExit() {
        if (this.mainWindow) {
            const res = await dialog.showMessageBox(this.mainWindow, {
                type: 'question',
                buttons: ['Exit RMS', 'Keep Running in Background'],
                defaultId: 1,
                cancelId: 1,
                title: 'Exit RMS',
                message: 'Are you sure you want to completely exit RMS?',
                detail: 'Closing will terminate background backup and document expiry monitoring services.'
            });

            if (res.response === 0) {
                this.isQuitting = true;
                if (this.tray) {
                    this.tray.destroy();
                    this.tray = null;
                }
                app.quit();
            }
        } else {
            this.isQuitting = true;
            app.quit();
        }
    }

    destroy() {
        if (this.tray) {
            try {
                this.tray.destroy();
            } catch (_) {}
            this.tray = null;
        }
    }
}

module.exports = new TrayManager();
