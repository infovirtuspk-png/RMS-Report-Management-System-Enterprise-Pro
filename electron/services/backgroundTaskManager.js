const databaseService = require('./database');
const trayManager = require('./trayManager');

class BackgroundTaskManager {
    constructor() {
        this.timer = null;
        this.checkIntervalMs = 30 * 60 * 1000; // Efficient 30 minutes interval
        this.isRunning = false;
        this.lastBackupTime = null;
        this.lastCheckTime = null;
    }

    start(webContentsProvider) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.webContentsProvider = webContentsProvider;

        // Run initial check after 10 seconds of startup
        setTimeout(() => {
            this.runBackgroundTasks();
        }, 10000);

        // Schedule periodic low-overhead checks
        this.timer = setInterval(() => {
            this.runBackgroundTasks();
        }, this.checkIntervalMs);

        console.log('Background Task Manager started (interval: 30m).');
    }

    async runBackgroundTasks() {
        if (!this.isRunning) return;
        this.lastCheckTime = new Date().toLocaleTimeString();

        try {
            await this.checkStaffDocumentExpiries();
            await this.checkPendingInvoices();
            await this.checkDatabaseHealth();
        } catch (err) {
            console.error('Error running background services:', err);
        }
    }

    async checkStaffDocumentExpiries() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

            const expiringStaff = await databaseService.query(`
                SELECT full_name, employee_code, visa_expiry_date, passport_expiry_date 
                FROM staff 
                WHERE status = 'active' AND deleted_at IS NULL AND (
                    (visa_expiry_date IS NOT NULL AND visa_expiry_date <= ?) OR
                    (passport_expiry_date IS NOT NULL AND passport_expiry_date <= ?)
                )
            `, [in30Days, in30Days]);

            if (expiringStaff && expiringStaff.length > 0) {
                const count = expiringStaff.length;
                trayManager.showNotification(
                    'Staff Document Expiry Alert',
                    `${count} staff document${count > 1 ? 's are' : ' is'} expiring within 30 days.`
                );
            }
        } catch (err) {
            console.error('Error checking staff expiries:', err);
        }
    }

    async checkPendingInvoices() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const overdue = await databaseService.query(`
                SELECT count(*) as count FROM invoices 
                WHERE payment_status != 'paid' AND due_date IS NOT NULL AND due_date < ? AND deleted_at IS NULL
            `, [today]);

            if (overdue && overdue[0] && overdue[0].count > 0) {
                const count = overdue[0].count;
                // Notify if overdue invoices exist
                trayManager.showNotification(
                    'Pending Invoices Reminder',
                    `You have ${count} overdue sales invoice${count > 1 ? 's' : ''} awaiting settlement.`
                );
            }
        } catch (err) {
            console.error('Error checking pending invoices:', err);
        }
    }

    async checkDatabaseHealth() {
        try {
            const health = await databaseService.getHealth();
            if (health && health.status !== 'healthy') {
                trayManager.showNotification('Database Health Alert', 'Database integrity check warning.');
            }
        } catch (_) {}
    }

    getStatus() {
        return {
            active: this.isRunning,
            lastCheck: this.lastCheckTime || 'Just now',
            lastBackup: this.lastBackupTime || 'None in this session',
            intervalMinutes: 30
        };
    }

    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('Background Task Manager stopped.');
    }
}

module.exports = new BackgroundTaskManager();
