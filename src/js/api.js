// ============================================
// RMS - API Interface
// ============================================

const API = {
    // Wrapper for Electron API calls with error handling
    async call(apiFunction, ...args) {
        try {
            if (typeof window.electronAPI === 'undefined') {
                throw new Error('Electron API not available');
            }
            
            const result = await apiFunction(...args);
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Database operations
    database: {
        query: (sql, params) => API.call(window.electronAPI.database.query, sql, params),
        execute: (sql, params) => API.call(window.electronAPI.database.execute, sql, params),
        transaction: (operations) => API.call(window.electronAPI.database.transaction, operations)
    },

    // Authentication
    auth: {
        login: (username, password) => API.call(window.electronAPI.auth.login, username, password),
        logout: () => API.call(window.electronAPI.auth.logout),
        changePassword: (userId, oldPassword, newPassword) => API.call(window.electronAPI.auth.changePassword, userId, oldPassword, newPassword),
        getCurrentUser: () => API.call(window.electronAPI.auth.getCurrentUser),
        checkAuth: () => API.call(window.electronAPI.auth.checkAuth)
    },

    // Company
    company: {
        register: (companyData) => API.call(window.electronAPI.company.register, companyData),
        getCompany: () => API.call(window.electronAPI.company.getCompany),
        updateCompany: (companyData) => API.call(window.electronAPI.company.updateCompany, companyData),
        getCompanySettings: () => API.call(window.electronAPI.company.getCompanySettings),
        updateCompanySettings: (settings) => API.call(window.electronAPI.company.updateCompanySettings, settings)
    },

    // Staff
    staff: {
        create: (staffData) => API.call(window.electronAPI.staff.create, staffData),
        update: (staffId, staffData) => API.call(window.electronAPI.staff.update, staffId, staffData),
        delete: (staffId) => API.call(window.electronAPI.staff.delete, staffId),
        getAll: (filters) => API.call(window.electronAPI.staff.getAll, filters),
        getById: (staffId) => API.call(window.electronAPI.staff.getById, staffId),
        uploadImage: (staffId, imagePath) => API.call(window.electronAPI.staff.uploadImage, staffId, imagePath),
        addDocument: (staffId, documentData) => API.call(window.electronAPI.staff.addDocument, staffId, documentData),
        getDocuments: (staffId) => API.call(window.electronAPI.staff.getDocuments, staffId),
        deleteDocument: (documentId) => API.call(window.electronAPI.staff.deleteDocument, documentId)
    },

    // Attendance
    attendance: {
        mark: (attendanceData) => API.call(window.electronAPI.attendance.mark, attendanceData),
        bulkMark: (attendanceData) => API.call(window.electronAPI.attendance.bulkMark, attendanceData),
        getAttendance: (filters) => API.call(window.electronAPI.attendance.getAttendance, filters),
        getStaffAttendance: (staffId, dateRange) => API.call(window.electronAPI.attendance.getStaffAttendance, staffId, dateRange),
        updateAttendance: (attendanceId, data) => API.call(window.electronAPI.attendance.updateAttendance, attendanceId, data),
        getSettings: () => API.call(window.electronAPI.attendance.getSettings),
        updateSettings: (settings) => API.call(window.electronAPI.attendance.updateSettings, settings)
    },

    // Salaries
    salary: {
        create: (salaryData) => API.call(window.electronAPI.salary.create, salaryData),
        update: (salaryId, salaryData) => API.call(window.electronAPI.salary.update, salaryId, salaryData),
        getAll: (filters) => API.call(window.electronAPI.salary.getAll, filters),
        getById: (salaryId) => API.call(window.electronAPI.salary.getById, salaryId),
        calculateSalary: (staffId, month) => API.call(window.electronAPI.salary.calculateSalary, staffId, month),
        processPayment: (salaryId, paymentData) => API.call(window.electronAPI.salary.processPayment, salaryId, paymentData)
    },

    // Salary Advances
    advance: {
        create: (advanceData) => API.call(window.electronAPI.advance.create, advanceData),
        update: (advanceId, advanceData) => API.call(window.electronAPI.advance.update, advanceId, advanceData),
        getAll: (filters) => API.call(window.electronAPI.advance.getAll, filters),
        getById: (advanceId) => API.call(window.electronAPI.advance.getById, advanceId),
        approve: (advanceId, approvalData) => API.call(window.electronAPI.advance.approve, advanceId, approvalData),
        deduct: (advanceId, deductionData) => API.call(window.electronAPI.advance.deduct, advanceId, deductionData),
        getOutstanding: (staffId) => API.call(window.electronAPI.advance.getOutstanding, staffId)
    },

    // Income
    income: {
        create: (incomeData) => API.call(window.electronAPI.income.create, incomeData),
        update: (incomeId, incomeData) => API.call(window.electronAPI.income.update, incomeId, incomeData),
        delete: (incomeId) => API.call(window.electronAPI.income.delete, incomeId),
        getAll: (filters) => API.call(window.electronAPI.income.getAll, filters),
        getById: (incomeId) => API.call(window.electronAPI.income.getById, incomeId),
        getCategories: () => API.call(window.electronAPI.income.getCategories),
        createCategory: (categoryData) => API.call(window.electronAPI.income.createCategory, categoryData)
    },

    // Expenses
    expense: {
        create: (expenseData) => API.call(window.electronAPI.expense.create, expenseData),
        update: (expenseId, expenseData) => API.call(window.electronAPI.expense.update, expenseId, expenseData),
        delete: (expenseId) => API.call(window.electronAPI.expense.delete, expenseId),
        getAll: (filters) => API.call(window.electronAPI.expense.getAll, filters),
        getById: (expenseId) => API.call(window.electronAPI.expense.getById, expenseId),
        getCategories: () => API.call(window.electronAPI.expense.getCategories),
        createCategory: (categoryData) => API.call(window.electronAPI.expense.createCategory, categoryData)
    },

    // Invoices
    invoice: {
        create: (invoiceData) => API.call(window.electronAPI.invoice.create, invoiceData),
        update: (invoiceId, invoiceData) => API.call(window.electronAPI.invoice.update, invoiceId, invoiceData),
        delete: (invoiceId) => API.call(window.electronAPI.invoice.delete, invoiceId),
        getAll: (filters) => API.call(window.electronAPI.invoice.getAll, filters),
        getById: (invoiceId) => API.call(window.electronAPI.invoice.getById, invoiceId),
        addItem: (invoiceId, itemData) => API.call(window.electronAPI.invoice.addItem, invoiceId, itemData),
        updateItem: (itemId, itemData) => API.call(window.electronAPI.invoice.updateItem, itemId, itemData),
        deleteItem: (itemId) => API.call(window.electronAPI.invoice.deleteItem, itemId),
        addPayment: (invoiceId, paymentData) => API.call(window.electronAPI.invoice.addPayment, invoiceId, paymentData),
        getPayments: (invoiceId) => API.call(window.electronAPI.invoice.getPayments, invoiceId),
        generateNumber: () => API.call(window.electronAPI.invoice.generateNumber),
        print: (invoiceId, printerConfig) => API.call(window.electronAPI.invoice.print, invoiceId, printerConfig),
        printThermal: (invoiceId, width) => API.call(window.electronAPI.invoice.printThermal, invoiceId, width)
    },

    // Customers
    customer: {
        create: (customerData) => API.call(window.electronAPI.customer.create, customerData),
        update: (customerId, customerData) => API.call(window.electronAPI.customer.update, customerId, customerData),
        delete: (customerId) => API.call(window.electronAPI.customer.delete, customerId),
        getAll: (filters) => API.call(window.electronAPI.customer.getAll, filters),
        getById: (customerId) => API.call(window.electronAPI.customer.getById, customerId),
        getHistory: (customerId) => API.call(window.electronAPI.customer.getHistory, customerId)
    },

    // Vendors
    vendor: {
        create: (vendorData) => API.call(window.electronAPI.vendor.create, vendorData),
        update: (vendorId, vendorData) => API.call(window.electronAPI.vendor.update, vendorId, vendorData),
        delete: (vendorId) => API.call(window.electronAPI.vendor.delete, vendorId),
        getAll: (filters) => API.call(window.electronAPI.vendor.getAll, filters),
        getById: (vendorId) => API.call(window.electronAPI.vendor.getById, vendorId)
    },

    // Currencies
    currency: {
        getAll: () => API.call(window.electronAPI.currency.getAll),
        getById: (currencyId) => API.call(window.electronAPI.currency.getById, currencyId),
        create: (currencyData) => API.call(window.electronAPI.currency.create, currencyData),
        update: (currencyId, currencyData) => API.call(window.electronAPI.currency.update, currencyId, currencyData),
        delete: (currencyId) => API.call(window.electronAPI.currency.delete, currencyId),
        setBaseCurrency: (currencyId) => API.call(window.electronAPI.currency.setBaseCurrency, currencyId),
        convertAmount: (amount, fromCurrency, toCurrency) => API.call(window.electronAPI.currency.convertAmount, amount, fromCurrency, toCurrency),
        updateExchangeRate: (currencyId, rate) => API.call(window.electronAPI.currency.updateExchangeRate, currencyId, rate)
    },

    // Reports
    report: {
        generate: (reportType, filters) => API.call(window.electronAPI.report.generate, reportType, filters),
        getDailyReport: (date) => API.call(window.electronAPI.report.getDailyReport, date),
        getMonthlyReport: (month, year) => API.call(window.electronAPI.report.getMonthlyReport, month, year),
        getProfitLoss: (dateRange) => API.call(window.electronAPI.report.getProfitLoss, dateRange),
        getStaffReport: (staffId, dateRange) => API.call(window.electronAPI.report.getStaffReport, staffId, dateRange),
        getAttendanceReport: (dateRange) => API.call(window.electronAPI.report.getAttendanceReport, dateRange),
        getInvoiceReport: (dateRange, status) => API.call(window.electronAPI.report.getInvoiceReport, dateRange, status),
        exportReport: (reportId, format) => API.call(window.electronAPI.report.exportReport, reportId, format),
        printReport: (reportId) => API.call(window.electronAPI.report.printReport, reportId)
    },

    // Users
    user: {
        create: (userData) => API.call(window.electronAPI.user.create, userData),
        update: (userId, userData) => API.call(window.electronAPI.user.update, userId, userData),
        delete: (userId) => API.call(window.electronAPI.user.delete, userId),
        getAll: (filters) => API.call(window.electronAPI.user.getAll, filters),
        getById: (userId) => API.call(window.electronAPI.user.getById, userId),
        changeStatus: (userId, status) => API.call(window.electronAPI.user.changeStatus, userId, status)
    },

    // Roles
    role: {
        create: (roleData) => API.call(window.electronAPI.role.create, roleData),
        update: (roleId, roleData) => API.call(window.electronAPI.role.update, roleId, roleData),
        delete: (roleId) => API.call(window.electronAPI.role.delete, roleId),
        getAll: () => API.call(window.electronAPI.role.getAll),
        getById: (roleId) => API.call(window.electronAPI.role.getById, roleId),
        updatePermissions: (roleId, permissions) => API.call(window.electronAPI.role.updatePermissions, roleId, permissions),
        getPermissions: (roleId) => API.call(window.electronAPI.role.getPermissions, roleId)
    },

    // Settings
    settings: {
        getAll: () => API.call(window.electronAPI.settings.getAll),
        getByCategory: (category) => API.call(window.electronAPI.settings.getByCategory, category),
        update: (settings) => API.call(window.electronAPI.settings.update, settings),
        resetToDefault: (category) => API.call(window.electronAPI.settings.resetToDefault, category)
    },

    // Themes
    theme: {
        getAll: () => API.call(window.electronAPI.theme.getAll),
        getActive: () => API.call(window.electronAPI.theme.getActive),
        setActive: (themeId) => API.call(window.electronAPI.theme.setActive, themeId),
        create: (themeData) => API.call(window.electronAPI.theme.create, themeData),
        update: (themeId, themeData) => API.call(window.electronAPI.theme.update, themeId, themeData)
    },

    // Backup
    backup: {
        create: (backupName, options) => API.call(window.electronAPI.backup.create, backupName, options),
        restore: (backupPath) => API.call(window.electronAPI.backup.restore, backupPath),
        getHistory: () => API.call(window.electronAPI.backup.getHistory),
        deleteBackup: (backupId) => API.call(window.electronAPI.backup.deleteBackup, backupId),
        verifyBackup: (backupPath) => API.call(window.electronAPI.backup.verifyBackup, backupPath),
        autoBackup: () => API.call(window.electronAPI.backup.autoBackup)
    },

    // Audit
    audit: {
        getAll: (filters) => API.call(window.electronAPI.audit.getAll, filters),
        getById: (logId) => API.call(window.electronAPI.audit.getById, logId),
        getByUser: (userId, filters) => API.call(window.electronAPI.audit.getByUser, userId, filters),
        getByModule: (module, filters) => API.call(window.electronAPI.audit.getByModule, module, filters)
    },

    // Notifications
    notification: {
        getAll: () => API.call(window.electronAPI.notification.getAll),
        markAsRead: (notificationId) => API.call(window.electronAPI.notification.markAsRead, notificationId),
        markAllAsRead: () => API.call(window.electronAPI.notification.markAllAsRead),
        delete: (notificationId) => API.call(window.electronAPI.notification.delete, notificationId),
        create: (notificationData) => API.call(window.electronAPI.notification.create, notificationData)
    },

    // File operations
    file: {
        selectFile: (filters) => API.call(window.electronAPI.file.selectFile, filters),
        selectDirectory: () => API.call(window.electronAPI.file.selectDirectory),
        saveFile: (defaultName, filters) => API.call(window.electronAPI.file.saveFile, defaultName, filters),
        copyFile: (source, destination) => API.call(window.electronAPI.file.copyFile, source, destination),
        deleteFile: (filePath) => API.call(window.electronAPI.file.deleteFile, filePath),
        fileExists: (filePath) => API.call(window.electronAPI.file.fileExists, filePath)
    },

    // Print
    print: {
        printContent: (content, options) => API.call(window.electronAPI.print.printContent, content, options),
        printPDF: (content, options) => API.call(window.electronAPI.print.printPDF, content, options),
        getPrinters: () => API.call(window.electronAPI.print.getPrinters)
    },

    // Application
    app: {
        getVersion: () => API.call(window.electronAPI.app.getVersion),
        getPath: (name) => API.call(window.electronAPI.app.getPath, name),
        lock: () => window.electronAPI.app.lock(),
        unlock: (password) => window.electronAPI.app.unlock(password),
        minimize: () => API.call(window.electronAPI.app.minimize),
        maximize: () => API.call(window.electronAPI.app.maximize),
        close: () => API.call(window.electronAPI.app.close),
        restart: () => API.call(window.electronAPI.app.restart)
    }
};

// Export to global scope
window.API = API;
