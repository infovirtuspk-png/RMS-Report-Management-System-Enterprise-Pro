// ============================================
// RMS - Main Application JavaScript
// ============================================

class RMSApp {
    constructor() {
        this.currentUser = null;
        this.company = null;
        this.currentTheme = 'professional-light';
        this.currentPage = 'dashboard';
        this.lastActivePage = 'dashboard';
        this.sidebarCollapsed = false;
        this.isLocked = false;
        this.inactivityTimer = null;
        this.autoLockMinutes = 0;
        this.isUnlocking = false;
        this.pendingTrayTarget = null;
    }

    async init() {
        console.log('Initializing RMS Application...');
        
        // Initialize UI components
        this.initTheme();
        this.initSidebar();
        this.initNavigation();
        this.initDateTime();
        this.initGlobalSearch();
        this.initNotifications();
        this.initUserMenu();
        this.initKeyboardShortcuts();
        this.initAppNavbar();
        
        // Load initial data
        await this.loadCompanyInfo();
        await this.loadCurrentUser();
        
        // Restore last active page or default to dashboard
        const resumePage = sessionStorage.getItem('rms_last_active_page') || 'dashboard';
        await this.navigateTo(resumePage);
        
        // Setup event listeners
        this.setupEventListeners();
        this.initInactivityTimer();
        
        console.log('RMS Application initialized successfully');
    }

    initTheme() {
        // Load saved theme or use default
        const savedTheme = localStorage.getItem('rms_theme') || 'professional-light';
        this.setTheme(savedTheme);
    }

    setTheme(themeName) {
        // Remove all theme classes
        document.body.className = '';
        
        // Add new theme class
        document.body.classList.add(`theme-${themeName}`);
        
        // Save to localStorage
        localStorage.setItem('rms_theme', themeName);
        
        this.currentTheme = themeName;
        
        // Notify IPC about theme change
        if (window.electronAPI && window.electronAPI.theme) {
            window.electronAPI.theme.setActive(themeName);
        }
    }

    initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');

        // Sidebar toggle button (now in topbar)
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                this.sidebarCollapsed = sidebar.classList.contains('collapsed');
            });
        }

        // Mobile menu toggle (if present)
        if (mobileMenuToggle && sidebar) {
            mobileMenuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
        }

        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar && window.innerWidth <= 768) {
                const clickedInsideSidebar = sidebar.contains(e.target);
                const clickedToggle = (sidebarToggle && sidebarToggle.contains(e.target)) || 
                                      (mobileMenuToggle && mobileMenuToggle.contains(e.target));
                if (!clickedInsideSidebar && !clickedToggle) {
                    sidebar.classList.remove('show');
                }
            }
        });
    }

    initNavigation() {
        const menuItems = document.querySelectorAll('.menu-item[data-page]');
        
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
                
                // Update active state
                menuItems.forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');
                
                // Close mobile menu
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('show');
                }
            });
        });
    }

    async navigateTo(page) {
        this.currentPage = page;
        const pageContent = document.getElementById('pageContent');
        
        // Show loading
        this.showLoading();
        
        try {
            // Load page content
            const content = await this.loadPageContent(page);
            pageContent.innerHTML = content;
            
            // Initialize page-specific scripts
            this.initPageScripts(page);
            
            // Update page title
            this.updatePageTitle(page);

            // Immediate date/time update if page has HUD capsule
            if (this.updateDateTime) this.updateDateTime();
            
        } catch (error) {
            console.error('Error loading page:', error);
            this.showError('Failed to load page. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async loadPageContent(page) {
        // Map page names to content files
        const pageMap = {
            'dashboard': 'modules/dashboard/dashboard.html',
            'daily-reports': 'modules/daily-reports/daily-reports.html',
            'income': 'modules/income/income.html',
            'expenses': 'modules/expenses/expenses.html',
            'profit-loss': 'modules/profit-loss/profit-loss.html',
            'staff': 'modules/staff/staff.html',
            'attendance': 'modules/attendance/attendance.html',
            'salaries': 'modules/salaries/salaries.html',
            'advances': 'modules/advances/advances.html',
            'performance': 'modules/performance/performance.html',
            'invoices': 'modules/invoices/invoices.html',
            'customers': 'modules/customers/customers.html',
            'reports': 'modules/reports/reports.html',
            'currencies': 'modules/currencies/currencies.html',
            'users': 'modules/users/users.html',
            'audit-logs': 'modules/audit-logs/audit-logs.html',
            'backup': 'modules/backup/backup.html',
            'settings': 'modules/settings/settings.html',
            'about': 'modules/about/about.html'
        };

        const pageFile = pageMap[page];
        if (!pageFile) {
            return `<div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Page Not Found</h3>
                <p>The requested page could not be found.</p>
            </div>`;
        }

        try {
            const response = await fetch(pageFile);
            if (!response.ok) {
                throw new Error('Page not found');
            }
            return await response.text();
        } catch (error) {
            console.error('Error loading page content:', error);
            return `<div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Page Not Found</h3>
                <p>The requested page could not be found.</p>
            </div>`;
        }
    }

    initPageScripts(page) {
        // Initialize page-specific functionality
        switch (page) {
            case 'dashboard':
                if (window.DashboardModule) window.DashboardModule.init();
                break;
            case 'daily-reports':
                if (window.DailyReportsModule) window.DailyReportsModule.init();
                break;
            case 'income':
                if (window.IncomeModule) window.IncomeModule.init();
                break;
            case 'expenses':
                if (window.ExpensesModule) window.ExpensesModule.init();
                break;
            case 'profit-loss':
                if (window.ProfitLossModule) window.ProfitLossModule.init();
                break;
            case 'staff':
                if (window.StaffModule) window.StaffModule.init();
                break;
            case 'attendance':
                if (window.AttendanceModule) window.AttendanceModule.init();
                break;
            case 'salaries':
                if (window.SalariesModule) window.SalariesModule.init();
                break;
            case 'advances':
                if (window.AdvancesModule) window.AdvancesModule.init();
                break;
            case 'performance':
                if (window.PerformanceModule) window.PerformanceModule.init();
                break;
            case 'invoices':
                if (window.InvoicesModule) window.InvoicesModule.init();
                break;
            case 'customers':
                if (window.CustomersModule) window.CustomersModule.init();
                break;
            case 'reports':
                if (window.ReportsModule) window.ReportsModule.init();
                break;
            case 'currencies':
                if (window.CurrenciesModule) window.CurrenciesModule.init();
                break;
            case 'users':
                if (window.UsersModule) window.UsersModule.init();
                break;
            case 'audit-logs':
                if (window.AuditLogsModule) window.AuditLogsModule.init();
                break;
            case 'settings':
                if (window.SettingsModule) window.SettingsModule.init();
                break;
            case 'backup':
                if (window.BackupModule) window.BackupModule.init();
                break;
            case 'about':
                if (window.AboutModule) window.AboutModule.init();
                break;
        }
    }

    updatePageTitle(page) {
        const titles = {
            'dashboard': 'Dashboard',
            'income': 'Income Management',
            'expenses': 'Expense Management',
            'profit-loss': 'Profit & Loss',
            'staff': 'Staff Management',
            'attendance': 'Attendance Management',
            'salaries': 'Salary Management',
            'advances': 'Salary Advances',
            'performance': 'Staff Performance',
            'invoices': 'Invoice Management',
            'customers': 'Customer Management',
            'reports': 'Reports',
            'currencies': 'Currency Management',
            'users': 'User Management',
            'audit-logs': 'Audit Logs',
            'backup': 'Backup & Restore',
            'settings': 'Settings',
            'about': 'About'
        };

        document.title = `RMS - ${titles[page] || 'Report Management System'}`;
    }

    initDateTime() {
        let is24Hour = localStorage.getItem('rms_clock_format_24h') === '1';

        // Global delegated click listener for any datetime HUD capsule
        document.addEventListener('click', (e) => {
            const hudCapsule = e.target.closest('#datetimeHud, .datetime-hud-capsule');
            if (hudCapsule) {
                is24Hour = !is24Hour;
                localStorage.setItem('rms_clock_format_24h', is24Hour ? '1' : '0');
                if (typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast(`Clock format switched to ${is24Hour ? '24-Hour (Military)' : '12-Hour (AM/PM)'}.`, 'info');
                }
                updateDateTime();
            }
        });

        const updateDateTime = () => {
            const now = new Date();

            // 1. Day Text
            const dayEls = document.querySelectorAll('#hudDayText, .hud-day-text');
            dayEls.forEach(el => {
                el.textContent = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            });

            // 2. Date Text (e.g. Sep 04, 2026)
            const dateEls = document.querySelectorAll('#hudDateText, .hud-date-text');
            dateEls.forEach(el => {
                el.textContent = now.toLocaleDateString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric'
                });
            });

            // 3. Time Digits & Period
            const digitsEls = document.querySelectorAll('#hudTimeDigits, .hud-time-digits');
            const periodEls = document.querySelectorAll('#hudTimePeriod, .hud-time-period');

            if (is24Hour) {
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const timeStr = `${hours}:${minutes}:${seconds}`;
                digitsEls.forEach(el => el.textContent = timeStr);
                periodEls.forEach(el => el.style.display = 'none');
            } else {
                let hours = now.getHours();
                const period = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12 || 12;
                const hoursStr = String(hours).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const timeStr = `${hoursStr}:${minutes}:${seconds}`;
                digitsEls.forEach(el => el.textContent = timeStr);
                periodEls.forEach(el => {
                    el.textContent = period;
                    el.style.display = 'inline-block';
                });
            }

            // Legacy Elements Backward Compatibility
            const legacyDate = document.getElementById('currentDate');
            const legacyTime = document.getElementById('currentTime');
            if (legacyDate) {
                legacyDate.textContent = now.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
            if (legacyTime) {
                legacyTime.textContent = now.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
        };

        this.updateDateTime = updateDateTime;
        updateDateTime();
        setInterval(updateDateTime, 1000);
    }

    initGlobalSearch() {
        const searchBtn = document.getElementById('globalSearchBtn');
        const searchModal = document.getElementById('globalSearchModal');
        const searchInput = document.getElementById('globalSearchInput');
        const searchResults = document.getElementById('searchResults');

        if (searchBtn && searchModal) {
            searchBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(searchModal);
                modal.show();
                setTimeout(() => searchInput.focus(), 300);
            });

            searchInput.addEventListener('input', async (e) => {
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    await this.performGlobalSearch(query);
                } else {
                    searchResults.innerHTML = `
                        <div class="search-empty">
                            <i class="fas fa-search"></i>
                            <p>Type to search across all modules</p>
                        </div>
                    `;
                }
            });
        }

        // Keyboard shortcut Ctrl+K
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                if (searchBtn) {
                    searchBtn.click();
                }
            }
        });
    }

    async performGlobalSearch(query) {
        const searchResults = document.getElementById('searchResults');
        
        try {
            // Search across different modules
            const results = await Promise.all([
                this.searchStaff(query),
                this.searchInvoices(query),
                this.searchIncome(query),
                this.searchExpenses(query),
                this.searchCustomers(query)
            ]);

            const allResults = results.flat();
            
            if (allResults.length === 0) {
                searchResults.innerHTML = `
                    <div class="search-empty">
                        <i class="fas fa-search"></i>
                        <p>No results found for "${query}"</p>
                    </div>
                `;
                return;
            }

            searchResults.innerHTML = allResults.map(result => `
                <div class="search-result-item" data-type="${result.type}" data-id="${result.id}">
                    <div class="search-result-type">${result.type}</div>
                    <div class="search-result-title">${result.title}</div>
                    <div class="search-result-subtitle">${result.subtitle}</div>
                </div>
            `).join('');

            // Add click handlers to search results
            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const type = item.dataset.type;
                    const id = item.dataset.id;
                    this.handleSearchResultClick(type, id);
                    
                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('globalSearchModal'));
                    if (modal) {
                        modal.hide();
                    }
                });
            });

        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error performing search</p>
                </div>
            `;
        }
    }

    async searchStaff(query) {
        try {
            const staff = await window.electronAPI.staff.getAll({ search: query });
            return staff.map(s => ({
                type: 'Staff',
                id: s.id,
                title: s.full_name,
                subtitle: s.employee_code
            }));
        } catch (error) {
            return [];
        }
    }

    async searchInvoices(query) {
        try {
            const invoices = await window.electronAPI.invoice.getAll({ search: query });
            return invoices.map(i => ({
                type: 'Invoice',
                id: i.id,
                title: i.invoice_number,
                subtitle: `${i.customer_name} - ${i.total_amount} ${i.currency}`
            }));
        } catch (error) {
            return [];
        }
    }

    async searchIncome(query) {
        try {
            const income = await window.electronAPI.income.getAll({ search: query });
            return income.map(i => ({
                type: 'Income',
                id: i.id,
                title: i.description,
                subtitle: `${i.amount} ${i.currency} - ${i.date}`
            }));
        } catch (error) {
            return [];
        }
    }

    async searchExpenses(query) {
        try {
            const expenses = await window.electronAPI.expense.getAll({ search: query });
            return expenses.map(e => ({
                type: 'Expense',
                id: e.id,
                title: e.description,
                subtitle: `${e.amount} ${e.currency} - ${e.date}`
            }));
        } catch (error) {
            return [];
        }
    }

    async searchCustomers(query) {
        try {
            const customers = await window.electronAPI.customer.getAll({ search: query });
            return customers.map(c => ({
                type: 'Customer',
                id: c.id,
                title: c.name,
                subtitle: c.company || 'Individual'
            }));
        } catch (error) {
            return [];
        }
    }

    handleSearchResultClick(type, id) {
        // Navigate to appropriate page and open the record
        switch (type) {
            case 'Staff':
                this.navigateTo('staff');
                setTimeout(() => {
                    if (window.StaffModule) {
                        window.StaffModule.viewStaff(id);
                    }
                }, 100);
                break;
            case 'Invoice':
                this.navigateTo('invoices');
                setTimeout(() => {
                    if (window.InvoicesModule) {
                        window.InvoicesModule.viewInvoice(id);
                    }
                }, 100);
                break;
            case 'Income':
                this.navigateTo('income');
                setTimeout(() => {
                    if (window.IncomeModule) {
                        window.IncomeModule.viewIncome(id);
                    }
                }, 100);
                break;
            case 'Expense':
                this.navigateTo('expenses');
                setTimeout(() => {
                    if (window.ExpensesModule) {
                        window.ExpensesModule.viewExpense(id);
                    }
                }, 100);
                break;
            case 'Customer':
                this.navigateTo('customers');
                setTimeout(() => {
                    if (window.CustomersModule) {
                        window.CustomersModule.viewCustomer(id);
                    }
                }, 100);
                break;
        }
    }

    initNotifications() {
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationPanel = document.getElementById('notificationPanel');
        const markAllReadBtn = document.getElementById('markAllReadBtn');

        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                notificationPanel.classList.toggle('show');
                this.loadNotifications();
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', async () => {
                try {
                    await window.electronAPI.notification.markAllAsRead();
                    this.loadNotifications();
                    this.updateNotificationBadge();
                } catch (error) {
                    console.error('Error marking notifications as read:', error);
                }
            });
        }

        // Close notification panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationPanel.classList.remove('show');
            }
        });

        // Load initial notification count
        this.updateNotificationBadge();
    }

    async loadNotifications() {
        const notificationList = document.getElementById('notificationList');
        
        try {
            const notifications = await window.electronAPI.notification.getAll();
            
            if (notifications.length === 0) {
                notificationList.innerHTML = `
                    <div class="empty-state" style="padding: 20px;">
                        <i class="fas fa-bell-slash"></i>
                        <p>No notifications</p>
                    </div>
                `;
                return;
            }

            notificationList.innerHTML = notifications.map(notification => `
                <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}">
                    <div class="notification-item-header">
                        <span class="notification-item-title">${notification.title}</span>
                        <span class="notification-item-time">${this.formatDateTime(notification.created_at)}</span>
                    </div>
                    <div class="notification-item-message">${notification.message}</div>
                </div>
            `).join('');

            // Add click handlers
            notificationList.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const notificationId = item.dataset.id;
                    await window.electronAPI.notification.markAsRead(notificationId);
                    item.classList.remove('unread');
                    this.updateNotificationBadge();
                });
            });

        } catch (error) {
            console.error('Error loading notifications:', error);
            notificationList.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading notifications</p>
                </div>
            `;
        }
    }

    async updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        
        try {
            const notifications = await window.electronAPI.notification.getAll();
            const unreadCount = notifications.filter(n => !n.is_read).length;
            
            if (badge) {
                // New design: it's a dot, just show/hide
                badge.style.display = unreadCount > 0 ? 'block' : 'none';
                badge.title = `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`;
            }
        } catch (error) {
            // Silently fail — notifications are non-critical
        }
    }

    initUserMenu() {
        const userDropdownToggle = document.getElementById('userDropdownToggle');
        const userDropdownMenu = document.getElementById('userDropdownMenu');
        const logoutBtn = document.getElementById('logoutBtn');
        const lockBtn = document.getElementById('lockBtn');
        const lockAppBtn = document.getElementById('lockAppBtn');

        if (userDropdownToggle) {
            userDropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdownMenu.classList.toggle('show');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await window.electronAPI.auth.logout();
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    this.showError('Failed to logout. Please try again.');
                }
            });
        }

        const doLock = () => {
            this.lockApplication();
            userDropdownMenu.classList.remove('show');
        };
        if (lockBtn) lockBtn.addEventListener('click', (e) => { e.preventDefault(); doLock(); });
        if (lockAppBtn) lockAppBtn.addEventListener('click', doLock);
        const profileBtn = document.getElementById('profileBtn');
        const changePasswordBtn = document.getElementById('changePasswordBtn');

        if (profileBtn) {
            profileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                userDropdownMenu.classList.remove('show');
                this.openProfileModal();
            });
        }

        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                userDropdownMenu.classList.remove('show');
                this.openChangePasswordModal();
            });
        }

        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const payload = {
                        full_name: document.getElementById('profileFullName').value.trim(),
                        email: document.getElementById('profileEmail').value.trim(),
                        phone: document.getElementById('profilePhone').value.trim()
                    };
                    await window.electronAPI.user.updateProfile(payload);
                    await this.loadCurrentUser();
                    UI.showToast('Profile updated successfully.', 'success');
                    const modalEl = document.getElementById('profileModal');
                    const instance = bootstrap.Modal.getInstance(modalEl);
                    if (instance) instance.hide();
                } catch (err) {
                    console.error('Error updating profile:', err);
                    UI.showToast(err.message || 'Failed to update profile.', 'error');
                }
            });
        }

        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const currentPass = document.getElementById('currentPasswordInput').value;
                const newPass = document.getElementById('newPasswordInput').value;
                const confirmPass = document.getElementById('confirmNewPasswordInput').value;

                if (newPass !== confirmPass) {
                    UI.showToast('New passwords do not match.', 'warning');
                    return;
                }

                try {
                    if (!this.currentUser) throw new Error('User session not active');
                    await window.electronAPI.auth.changePassword(this.currentUser.id, currentPass, newPass);
                    UI.showToast('Password changed successfully.', 'success');
                    changePasswordForm.reset();
                    const modalEl = document.getElementById('changePasswordModal');
                    const instance = bootstrap.Modal.getInstance(modalEl);
                    if (instance) instance.hide();
                } catch (err) {
                    console.error('Error changing password:', err);
                    UI.showToast(err.message || 'Failed to change password.', 'error');
                }
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (userDropdownMenu && !userDropdownMenu.contains(e.target) && !userDropdownToggle.contains(e.target)) {
                userDropdownMenu.classList.remove('show');
            }
        });
    }

    openProfileModal() {
        if (this.currentUser) {
            const u = this.currentUser;
            document.getElementById('profileUsername').value = u.username || '';
            document.getElementById('profileFullName').value = u.full_name || '';
            document.getElementById('profileEmail').value = u.email || '';
            document.getElementById('profilePhone').value = u.phone || '';
        }
        const modalEl = document.getElementById('profileModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    openChangePasswordModal() {
        const form = document.getElementById('changePasswordForm');
        if (form) form.reset();
        const modalEl = document.getElementById('changePasswordModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (this.isLocked) return;

            // Ctrl+N - New record (context-dependent)
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.handleNewRecord();
            }

            // Ctrl+S - Save (context-dependent)
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.handleSave();
            }

            // Ctrl+P - Print
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this.handlePrint();
            }

            // Ctrl+B - Backup
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.navigateTo('backup');
            }

            // Ctrl+L - Lock
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                this.lockApplication();
            }

            // Escape - Close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // ============================================
    // Custom Frameless Navbar & Window Controls
    // ============================================
    initAppNavbar() {
        // ── 1. Dropdown toggle logic ────────────────────────────────
        const menuBtns = document.querySelectorAll('.custom-menu-btn');

        const closeAllDropdowns = (exceptMenu = null) => {
            document.querySelectorAll('.custom-menu-dropdown').forEach(wrap => {
                const btn = wrap.querySelector('.custom-menu-btn');
                if (btn && btn.dataset.menu !== exceptMenu) {
                    wrap.classList.remove('active');
                    btn.classList.remove('active');
                }
            });
        };

        menuBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menuKey = btn.dataset.menu;
                const wrap   = btn.closest('.custom-menu-dropdown');
                const isOpen = wrap.classList.contains('active');

                closeAllDropdowns(isOpen ? null : menuKey);

                if (!isOpen) {
                    wrap.classList.add('active');
                    btn.classList.add('active');
                } else {
                    wrap.classList.remove('active');
                    btn.classList.remove('active');
                }
            });
        });

        // ── 2. Navigate from custom menu items (data-nav) ───────────
        document.querySelectorAll('.custom-menu-item[data-nav]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.nav;
                closeAllDropdowns();

                // sync sidebar active state
                document.querySelectorAll('.menu-item[data-page]').forEach(mi => {
                    mi.classList.toggle('active', mi.dataset.page === page);
                });

                this.navigateTo(page);
            });
        });

        // ── 3. Special file-menu actions ────────────────────────────
        const topMenuLock = document.getElementById('topMenuLockApp');
        const topMenuBackup = document.getElementById('topMenuBackup');
        const topMenuExit  = document.getElementById('topMenuExitApp');

        if (topMenuLock) {
            topMenuLock.addEventListener('click', (e) => {
                e.preventDefault();
                closeAllDropdowns();
                this.lockApplication();
            });
        }

        if (topMenuBackup) {
            topMenuBackup.addEventListener('click', (e) => {
                e.preventDefault();
                closeAllDropdowns();
                this.navigateTo('backup');
            });
        }

        if (topMenuExit) {
            topMenuExit.addEventListener('click', (e) => {
                e.preventDefault();
                closeAllDropdowns();
                if (window.electronAPI && window.electronAPI.app && window.electronAPI.app.close) {
                    window.electronAPI.app.close();
                }
            });
        }

        // ── 4. Window control buttons ───────────────────────────────
        const btnMin  = document.getElementById('btnWinMinimize');
        const btnMax  = document.getElementById('btnWinMaximize');
        const btnClose = document.getElementById('btnWinClose');
        const maxIcon  = document.getElementById('winMaxIcon');

        if (btnMin) {
            btnMin.addEventListener('click', () => {
                if (window.electronAPI && window.electronAPI.app) {
                    window.electronAPI.app.minimize();
                }
            });
        }

        if (btnMax) {
            btnMax.addEventListener('click', async () => {
                if (window.electronAPI && window.electronAPI.app) {
                    window.electronAPI.app.maximize();
                    // update icon after a short delay
                    setTimeout(async () => {
                        try {
                            const isMax = await window.electronAPI.app.isMaximized();
                            if (maxIcon) {
                                maxIcon.className = isMax ? 'far fa-window-restore' : 'far fa-square';
                            }
                        } catch (_) {}
                    }, 120);
                }
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                if (window.electronAPI && window.electronAPI.app) {
                    window.electronAPI.app.close();
                }
            });
        }

        // ── 5. Close dropdowns when clicking anywhere else ──────────
        document.addEventListener('click', (e) => {
            const navbar = document.getElementById('customMenuBar');
            if (navbar && !navbar.contains(e.target)) {
                closeAllDropdowns();
            }
        });
    }

    setupEventListeners() {
        // Placeholder for any global event wiring not covered by init* methods.
        // Individual feature event bindings live in their respective init* methods.
    }

    handleNewRecord() {
        // Context-dependent new record creation
        switch (this.currentPage) {
            case 'income':
                if (window.IncomeModule) {
                    window.IncomeModule.showAddModal();
                }
                break;
            case 'expenses':
                if (window.ExpensesModule) {
                    window.ExpensesModule.showAddModal();
                }
                break;
            case 'staff':
                if (window.StaffModule) {
                    window.StaffModule.showAddModal();
                }
                break;
            case 'invoices':
                if (window.InvoicesModule) {
                    window.InvoicesModule.showAddModal();
                }
                break;
            case 'customers':
                if (window.CustomersModule) {
                    window.CustomersModule.showAddModal();
                }
                break;
        }
    }

    handleSave() {
        // Context-dependent save action
        // This would be implemented by individual modules
        console.log('Save action triggered');
    }

    handlePrint() {
        // Print current page/record
        window.print();
    }

    closeAllModals() {
        // Close all open modals
        document.querySelectorAll('.modal.show').forEach(modal => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        });
    }

    lockApplication() {
        this.lastActivePage = this.currentPage || 'dashboard';
        sessionStorage.setItem('rms_last_active_page', this.lastActivePage);

        if (window.electronAPI && window.electronAPI.app && window.electronAPI.app.lock) {
            window.electronAPI.app.lock(this.lastActivePage);
        }
    }

    async initInactivityTimer() {
        try {
            const settings = await window.electronAPI.settings.getAll();
            const timeoutSetting = settings.find(s => s.setting_key === 'auto_lock_timeout');
            this.autoLockMinutes = timeoutSetting ? parseInt(timeoutSetting.setting_value) || 0 : 0;
            this.resetInactivityTimer();
        } catch (_) {}

        // Reset timer on user interaction
        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
            document.addEventListener(evt, () => {
                if (!this.isLocked) {
                    this.resetInactivityTimer();
                }
            }, { passive: true });
        });
    }

    resetInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }

        if (this.autoLockMinutes > 0 && !this.isLocked) {
            const ms = this.autoLockMinutes * 60 * 1000;
            this.inactivityTimer = setTimeout(() => {
                if (!this.isLocked) {
                    console.log(`Auto-locking application after ${this.autoLockMinutes} minutes of inactivity.`);
                    this.lockApplication();
                }
            }, ms);
        }
    }

    async loadCompanyInfo() {
        try {
            const company = await window.electronAPI.company.getCompany();
            this.company = company || {};
            
            // Try to get live currency symbol from currencies table
            try {
                const currencies = await window.electronAPI.currency.getAll();
                const base = currencies.find(c => c.is_base_currency);
                if (base) {
                    this.company.currency = base.currency_code;
                    this.company.currency_symbol = base.currency_symbol;
                }
            } catch (_) {}

            if (this.company) {
                const companyNameEl = document.getElementById('companyName');
                if (companyNameEl && this.company.company_name) {
                    companyNameEl.textContent = this.company.company_name;
                }

                // Currency badge: show clean code & symbol without duplication
                const symEl = document.getElementById('currencySymbol');
                const codeEl = document.getElementById('baseCurrency');
                const code = this.company.currency || 'AED';
                const sym = this.company.currency_symbol || code;

                if (symEl && codeEl) {
                    if (sym === code || !sym) {
                        symEl.textContent = '';
                        codeEl.textContent = code;
                    } else {
                        symEl.textContent = sym;
                        codeEl.textContent = code;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading company info:', error);
        }
    }

    async loadCurrentUser() {
        try {
            const user = await window.electronAPI.auth.getCurrentUser();
            this.currentUser = user;
            
            if (user) {
                const name = user.full_name || user.username || 'Admin';
                const initials = name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();

                const userNameEl = document.getElementById('userName');
                if (userNameEl) userNameEl.textContent = name;

                const userInitialsEl = document.getElementById('userInitials');
                if (userInitialsEl) userInitialsEl.textContent = initials;

                const userRoleEl = document.getElementById('userRole');
                if (userRoleEl) userRoleEl.textContent = user.role_name || 'Administrator';

                const dropdownNameEl = document.getElementById('dropdownUserName');
                if (dropdownNameEl) dropdownNameEl.textContent = name;

                const dropdownEmailEl = document.getElementById('dropdownUserEmail');
                if (dropdownEmailEl) dropdownEmailEl.textContent = user.email || (user.username + '@rms.local');
            }
        } catch (error) {
            console.error('Error loading current user:', error);
        }
    }

    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.cycleTheme();
            });
        }

        // Listen for IPC events
        if (window.electronAPI && window.electronAPI.on) {
            window.electronAPI.on('app:locked', () => {
                this.lockApplication();
            });

            window.electronAPI.on('app:unlocked', () => {
                this.isLocked = false;
                document.getElementById('lockScreen').classList.remove('show');
            });

            window.electronAPI.on('theme:changed', (theme) => {
                this.setTheme(theme);
            });

            window.electronAPI.on('global:search', (query) => {
                // Handle global search from main process
                this.performGlobalSearch(query);
            });

            window.electronAPI.on('backup:completed', (backupInfo) => {
                this.showSuccess('Backup completed successfully');
            });

            window.electronAPI.on('restore:completed', (restoreInfo) => {
                this.showSuccess('Restore completed successfully. Application will restart.');
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            });

            window.electronAPI.on('notification:new', (notification) => {
                this.showNotification(notification);
                this.updateNotificationBadge();
            });

            window.electronAPI.on('data:updated', (module) => {
                // Refresh current page if data in relevant module was updated
                if (this.isModuleRelevant(module)) {
                    this.navigateTo(this.currentPage);
                }
            });

            // Handle feature opening from Windows System Tray
            window.electronAPI.on('tray:open-feature', ({ module, action }) => {
                if (this.isLocked) {
                    this.pendingTrayTarget = { module, action };
                    this.lockApplication();
                    UI.showToast(`Please enter PIN/Password to access ${module.toUpperCase()}.`, 'info');
                } else {
                    this.navigateTo(module);
                    if (action) {
                        setTimeout(() => this.triggerModuleAction(module, action), 250);
                    }
                }
            });
        }
    }

    triggerModuleAction(module, action) {
        try {
            if (module === 'income' && window.IncomeModule && action === 'showAddModal') {
                window.IncomeModule.showAddModal();
            } else if (module === 'expenses' && window.ExpensesModule && action === 'showAddModal') {
                window.ExpensesModule.showAddModal();
            } else if (module === 'invoices' && window.InvoicesModule && action === 'showAddModal') {
                window.InvoicesModule.showAddModal();
            } else if (module === 'backup' && window.BackupModule && action === 'quickBackup') {
                window.BackupModule.createBackup();
            }
        } catch (e) {
            console.error('Error triggering module action:', e);
        }
    }

    cycleTheme() {
        const themes = [
            'professional-light',
            'professional-dark',
            'ocean-blue',
            'emerald',
            'royal-purple',
            'midnight',
            'graphite'
        ];
        
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.setTheme(themes[nextIndex]);
    }

    isModuleRelevant(module) {
        // Check if the updated module is relevant to the current page
        const modulePageMap = {
            'income': 'income',
            'expenses': 'expenses',
            'staff': 'staff',
            'attendance': 'attendance',
            'salaries': 'salaries',
            'advances': 'advances',
            'invoices': 'invoices',
            'customers': 'customers',
            'currencies': 'currencies',
            'users': 'users'
        };

        return modulePageMap[module] === this.currentPage;
    }

    showLoading(message = 'Loading...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = loadingOverlay.querySelector('.loading-text');
        
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        loadingOverlay.classList.add('show');
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.classList.remove('show');
    }

    showSuccess(message, title = 'Success') {
        this.showToast('success', title, message);
    }

    showError(message, title = 'Error') {
        this.showToast('error', title, message);
    }

    showWarning(message, title = 'Warning') {
        this.showToast('warning', title, message);
    }

    showInfo(message, title = 'Information') {
        this.showToast('info', title, message);
    }

    showToast(type, title, message) {
        const toastContainer = document.getElementById('toastContainer');
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);

        // Close button handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }

    showNotification(notification) {
        // Show in-app notification
        this.showToast('info', notification.title, notification.message);
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        // Less than a minute
        if (diff < 60000) {
            return 'Just now';
        }

        // Less than an hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }

        // Less than a day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }

        // Less than a week
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }

        // Otherwise return formatted date
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    formatCurrency(amount, currency = null) {
        return Utils.formatCurrency(amount, currency);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.rmsApp = new RMSApp();
    window.RMSAppInstance = window.rmsApp;
    window.rmsApp.init();
});
