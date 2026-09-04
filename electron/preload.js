const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Database
    database: {
        query: (sql, params) => ipcRenderer.invoke('database:query', sql, params),
        execute: (sql, params) => ipcRenderer.invoke('database:execute', sql, params),
        transaction: (operations) => ipcRenderer.invoke('database:transaction', operations),
        getHealth: () => ipcRenderer.invoke('database:health')
    },

    // Authentication & Users
    auth: {
        login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
        logout: () => ipcRenderer.invoke('auth:logout'),
        changePassword: (userId, oldPassword, newPassword) => ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword),
        getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
        checkAuth: () => ipcRenderer.invoke('auth:checkAuth'),
        registerAdmin: (adminData) => ipcRenderer.invoke('auth:registerAdmin', adminData)
    },

    user: {
        getAll: () => ipcRenderer.invoke('user:getAll'),
        create: (userData) => ipcRenderer.invoke('user:create', userData),
        update: (userId, userData) => ipcRenderer.invoke('user:update', userId, userData),
        delete: (userId) => ipcRenderer.invoke('user:delete', userId),
        updateProfile: (profileData) => ipcRenderer.invoke('user:updateProfile', profileData)
    },

    // Company
    company: {
        register: (companyData) => ipcRenderer.invoke('company:register', companyData),
        getCompany: () => ipcRenderer.invoke('company:getCompany'),
        updateCompany: (companyData) => ipcRenderer.invoke('company:updateCompany', companyData)
    },

    // Staff
    staff: {
        getAll: (filters) => ipcRenderer.invoke('staff:getAll', filters),
        getById: (staffId) => ipcRenderer.invoke('staff:getById', staffId),
        create: (staffData) => ipcRenderer.invoke('staff:create', staffData),
        update: (staffId, staffData) => ipcRenderer.invoke('staff:update', staffId, staffData),
        delete: (staffId) => ipcRenderer.invoke('staff:delete', staffId),
        addDocument: (staffId, docData) => ipcRenderer.invoke('staff:addDocument', staffId, docData),
        getDocuments: (staffId) => ipcRenderer.invoke('staff:getDocuments', staffId),
        deleteDocument: (docId) => ipcRenderer.invoke('staff:deleteDocument', docId),
        getDepartments: () => ipcRenderer.invoke('staff:getDepartments'),
        createDepartment: (data) => ipcRenderer.invoke('staff:createDepartment', data),
        getDesignations: () => ipcRenderer.invoke('staff:getDesignations'),
        createDesignation: (data) => ipcRenderer.invoke('staff:createDesignation', data)
    },

    // Attendance
    attendance: {
        mark: (data) => ipcRenderer.invoke('attendance:mark', data),
        bulkMark: (entries) => ipcRenderer.invoke('attendance:bulkMark', entries),
        getAttendance: (filters) => ipcRenderer.invoke('attendance:getAttendance', filters)
    },

    // Salaries & Advances
    salary: {
        getAll: (filters) => ipcRenderer.invoke('salary:getAll', filters),
        calculateSalary: (staffId, month) => ipcRenderer.invoke('salary:calculateSalary', staffId, month),
        create: (data) => ipcRenderer.invoke('salary:create', data),
        processPayment: (salaryId, paymentData) => ipcRenderer.invoke('salary:processPayment', salaryId, paymentData)
    },

    advance: {
        getAll: (filters) => ipcRenderer.invoke('advance:getAll', filters),
        create: (data) => ipcRenderer.invoke('advance:create', data),
        deduct: (advanceId, data) => ipcRenderer.invoke('advance:deduct', advanceId, data)
    },

    // Income
    income: {
        getAll: (filters) => ipcRenderer.invoke('income:getAll', filters),
        create: (data) => ipcRenderer.invoke('income:create', data),
        update: (incomeId, data) => ipcRenderer.invoke('income:update', incomeId, data),
        delete: (incomeId) => ipcRenderer.invoke('income:delete', incomeId),
        getCategories: () => ipcRenderer.invoke('income:getCategories'),
        createCategory: (data) => ipcRenderer.invoke('income:createCategory', data)
    },

    // Expenses
    expense: {
        getAll: (filters) => ipcRenderer.invoke('expense:getAll', filters),
        create: (data) => ipcRenderer.invoke('expense:create', data),
        update: (expenseId, data) => ipcRenderer.invoke('expense:update', expenseId, data),
        delete: (expenseId) => ipcRenderer.invoke('expense:delete', expenseId),
        getCategories: () => ipcRenderer.invoke('expense:getCategories'),
        createCategory: (data) => ipcRenderer.invoke('expense:createCategory', data)
    },

    // Customers & Vendors
    customer: {
        getAll: (filters) => ipcRenderer.invoke('customer:getAll', filters),
        getById: (customerId) => ipcRenderer.invoke('customer:getById', customerId),
        create: (data) => ipcRenderer.invoke('customer:create', data)
    },

    vendor: {
        getAll: (filters) => ipcRenderer.invoke('vendor:getAll', filters),
        create: (data) => ipcRenderer.invoke('vendor:create', data)
    },

    // Invoices
    invoice: {
        generateNumber: () => ipcRenderer.invoke('invoice:generateNumber'),
        getAll: (filters) => ipcRenderer.invoke('invoice:getAll', filters),
        getById: (invoiceId) => ipcRenderer.invoke('invoice:getById', invoiceId),
        create: (data) => ipcRenderer.invoke('invoice:create', data),
        addPayment: (invoiceId, paymentData) => ipcRenderer.invoke('invoice:addPayment', invoiceId, paymentData)
    },

    // Currencies
    currency: {
        getAll: () => ipcRenderer.invoke('currency:getAll'),
        getById: (currencyId) => ipcRenderer.invoke('currency:getById', currencyId),
        create: (data) => ipcRenderer.invoke('currency:create', data),
        update: (currencyId, data) => ipcRenderer.invoke('currency:update', currencyId, data),
        delete: (currencyId) => ipcRenderer.invoke('currency:delete', currencyId),
        setBaseCurrency: (currencyId) => ipcRenderer.invoke('currency:setBaseCurrency', currencyId),
        updateExchangeRate: (currencyId, rate) => ipcRenderer.invoke('currency:updateExchangeRate', currencyId, rate)
    },

    // Reports
    report: {
        getProfitLoss: (dateRange) => ipcRenderer.invoke('report:getProfitLoss', dateRange),
        getDailyReport: (date) => ipcRenderer.invoke('report:getDailyReport', date),
        getStaffReport: (staffId, dateRange) => ipcRenderer.invoke('report:getStaffReport', staffId, dateRange)
    },

    // Backup & Restore
    backup: {
        create: (customName, options) => ipcRenderer.invoke('backup:create', customName, options),
        getHistory: () => ipcRenderer.invoke('backup:getHistory'),
        verifyBackup: (backupPath) => ipcRenderer.invoke('backup:verifyBackup', backupPath),
        restore: (backupPath) => ipcRenderer.invoke('backup:restore', backupPath)
    },

    // Themes & Settings
    theme: {
        getAll: () => ipcRenderer.invoke('theme:getAll'),
        setActive: (themeKey) => ipcRenderer.invoke('theme:setActive', themeKey)
    },

    settings: {
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        update: (settingsObj) => ipcRenderer.invoke('settings:update', settingsObj),
        hardReset: (payload) => ipcRenderer.invoke('settings:hardReset', payload)
    },

    // Audit & Notifications
    audit: {
        getAll: (filters) => ipcRenderer.invoke('audit:getAll', filters)
    },

    notification: {
        getAll: () => ipcRenderer.invoke('notification:getAll'),
        markAsRead: (notificationId) => ipcRenderer.invoke('notification:markAsRead', notificationId),
        markAllAsRead: () => ipcRenderer.invoke('notification:markAllAsRead')
    },

    // File & Printing
    file: {
        selectFile: (filters) => ipcRenderer.invoke('file:selectFile', filters),
        saveFile: (defaultName, filters) => ipcRenderer.invoke('file:saveFile', defaultName, filters)
    },

    print: {
        printContent: (htmlContent, options) => ipcRenderer.invoke('print:printContent', htmlContent, options)
    },

    // Tray & Background
    tray: {
        getStatus: () => ipcRenderer.invoke('tray:getStatus'),
        notify: (title, content) => ipcRenderer.invoke('tray:notify', title, content)
    },

    // App controls & Startup
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        navigate: (targetPage) => ipcRenderer.invoke('app:navigate', targetPage),
        minimize: () => ipcRenderer.invoke('app:minimize'),
        maximize: () => ipcRenderer.invoke('app:maximize'),
        isMaximized: () => ipcRenderer.invoke('app:isMaximized'),
        close: () => ipcRenderer.invoke('app:close'),
        restart: () => ipcRenderer.invoke('app:restart'),
        lock: (lastPage) => ipcRenderer.invoke('app:lock', lastPage),
        unlock: (password) => ipcRenderer.invoke('app:unlock', password),
        getLockInfo: () => ipcRenderer.invoke('app:getLockInfo'),
        getStartupSettings: () => ipcRenderer.invoke('app:getStartupSettings'),
        setStartupSettings: (settings) => ipcRenderer.invoke('app:setStartupSettings', settings)
    },

    // Event listeners
    on: (channel, callback) => {
        const allowedChannels = ['app:locked', 'app:unlocked', 'tray:open-feature'];
        if (allowedChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    }
});
