// ============================================
// RMS - Dashboard Module
// ============================================

const DashboardModule = {
    charts: {},
    currentPeriod: 'today',
    currentDateRange: {
        from: null,
        to: null
    },

    async init() {
        console.log('Initializing Dashboard Module...');
        
        // Set default date range
        this.setDefaultDateRange();
        
        // Load dashboard data
        await this.loadDashboardData();
        
        // Initialize charts
        this.initCharts();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        console.log('Dashboard Module initialized');
    },

    setDefaultDateRange() {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        this.currentDateRange = {
            from: this.formatDate(today),
            to: this.formatDate(today)
        };

        const dateFrom = document.getElementById('dateFrom');
        const dateTo = document.getElementById('dateTo');

        if (dateFrom) dateFrom.value = this.currentDateRange.from;
        if (dateTo) dateTo.value = this.currentDateRange.to;
    },

    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    async loadDashboardData() {
        try {
            window.rmsApp.showLoading('Loading dashboard data...');

            // Load financial data
            await this.loadFinancialData();
            
            // Load staff data
            await this.loadStaffData();
            
            // Load recent transactions
            await this.loadRecentTransactions();
            
            // Update charts
            this.updateCharts();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            window.rmsApp.showError('Failed to load dashboard data');
        } finally {
            window.rmsApp.hideLoading();
        }
    },

    async loadFinancialData() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = new Date().toISOString().slice(0, 7);

            // Get today's financial data
            const todayIncome = await API.income.getAll({ date_from: today, date_to: today });
            const todayExpenses = await API.expense.getAll({ date_from: today, date_to: today });
            const todayInvoices = await API.invoice.getAll({ date_from: today, date_to: today });

            // Calculate totals
            const todayIncomeTotal = todayIncome.reduce((sum, item) => sum + item.base_currency_amount, 0);
            const todayExpensesTotal = todayExpenses.reduce((sum, item) => sum + item.base_currency_amount, 0);
            const todayProfit = todayIncomeTotal - todayExpensesTotal;

            // Update today's cards
            document.getElementById('todayIncome').textContent = Utils.formatCurrency(todayIncomeTotal);
            document.getElementById('todayExpenses').textContent = Utils.formatCurrency(todayExpensesTotal);
            document.getElementById('todayProfit').textContent = Utils.formatCurrency(todayProfit);
            document.getElementById('todayInvoices').textContent = todayInvoices.length;

            // Get monthly financial data
            const monthIncome = await API.income.getAll({ date_from: `${currentMonth}-01`, date_to: `${currentMonth}-31` });
            const monthExpenses = await API.expense.getAll({ date_from: `${currentMonth}-01`, date_to: `${currentMonth}-31` });
            const monthInvoices = await API.invoice.getAll({ date_from: `${currentMonth}-01`, date_to: `${currentMonth}-31` });

            // Calculate monthly totals
            const monthIncomeTotal = monthIncome.reduce((sum, item) => sum + item.base_currency_amount, 0);
            const monthExpensesTotal = monthExpenses.reduce((sum, item) => sum + item.base_currency_amount, 0);
            const monthProfit = monthIncomeTotal - monthExpensesTotal;

            // Update monthly cards
            document.getElementById('monthIncome').textContent = Utils.formatCurrency(monthIncomeTotal);
            document.getElementById('monthExpenses').textContent = Utils.formatCurrency(monthExpensesTotal);
            document.getElementById('monthProfit').textContent = Utils.formatCurrency(monthProfit);
            document.getElementById('monthInvoices').textContent = monthInvoices.length;

            // Calculate percentage changes (compare with previous period)
            this.calculatePercentageChanges(todayIncomeTotal, todayExpensesTotal, todayProfit, todayInvoices.length);

        } catch (error) {
            console.error('Error loading financial data:', error);
        }
    },

    async loadStaffData() {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Get total staff
            const allStaff = await API.staff.getAll({ status: 'active' });
            document.getElementById('totalStaff').textContent = allStaff.length;

            // Get today's attendance
            const attendance = await API.attendance.getAttendance({ date: today });
            
            const presentCount = attendance.filter(a => a.status === 'present').length;
            const absentCount = attendance.filter(a => a.status === 'absent').length;
            const leaveCount = attendance.filter(a => a.status === 'leave').length;

            document.getElementById('presentStaff').textContent = presentCount;
            document.getElementById('absentStaff').textContent = absentCount;
            document.getElementById('onLeaveStaff').textContent = leaveCount;

        } catch (error) {
            console.error('Error loading staff data:', error);
        }
    },

    async loadRecentTransactions() {
        try {
            const today = new Date();
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

            // Get recent income
            const recentIncome = await API.income.getAll({ 
                date_from: this.formatDate(weekAgo), 
                date_to: this.formatDate(today) 
            });

            // Get recent expenses
            const recentExpenses = await API.expense.getAll({ 
                date_from: this.formatDate(weekAgo), 
                date_to: this.formatDate(today) 
            });

            // Update recent income list
            this.updateRecentIncomeList(recentIncome.slice(0, 5));

            // Update recent expenses list
            this.updateRecentExpensesList(recentExpenses.slice(0, 5));

        } catch (error) {
            console.error('Error loading recent transactions:', error);
        }
    },

    updateRecentIncomeList(incomeItems) {
        const container = document.getElementById('recentIncomeList');
        
        if (incomeItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <i class="fas fa-inbox"></i>
                    <p>No recent income</p>
                </div>
            `;
            return;
        }

        container.innerHTML = incomeItems.map(item => `
            <div class="recent-item">
                <div class="recent-item-info">
                    <div class="recent-item-icon income">
                        <i class="fas fa-arrow-down"></i>
                    </div>
                    <div class="recent-item-details">
                        <h6>${item.description}</h6>
                        <p>${Utils.formatDate(item.date)}</p>
                    </div>
                </div>
                <div class="recent-item-amount income">
                    +${Utils.formatCurrency(item.amount, item.currency)}
                </div>
            </div>
        `).join('');
    },

    updateRecentExpensesList(expenseItems) {
        const container = document.getElementById('recentExpensesList');
        
        if (expenseItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <i class="fas fa-inbox"></i>
                    <p>No recent expenses</p>
                </div>
            `;
            return;
        }

        container.innerHTML = expenseItems.map(item => `
            <div class="recent-item">
                <div class="recent-item-info">
                    <div class="recent-item-icon expense">
                        <i class="fas fa-arrow-up"></i>
                    </div>
                    <div class="recent-item-details">
                        <h6>${item.description}</h6>
                        <p>${Utils.formatDate(item.date)}</p>
                    </div>
                </div>
                <div class="recent-item-amount expense">
                    -${Utils.formatCurrency(item.amount, item.currency)}
                </div>
            </div>
        `).join('');
    },

    calculatePercentageChanges(currentIncome, currentExpenses, currentProfit, currentInvoices) {
        // This would compare with previous period data
        // For now, showing placeholder values
        const incomeChange = Math.floor(Math.random() * 20) - 5;
        const expenseChange = Math.floor(Math.random() * 15) - 5;
        const profitChange = Math.floor(Math.random() * 25) - 5;
        const invoiceChange = Math.floor(Math.random() * 15) - 5;

        this.updatePercentageChange('incomeChange', incomeChange);
        this.updatePercentageChange('expenseChange', expenseChange);
        this.updatePercentageChange('profitChange', profitChange);
        this.updatePercentageChange('invoiceChange', invoiceChange);
    },

    updatePercentageChange(elementId, change) {
        const element = document.getElementById(elementId);
        const isPositive = change >= 0;
        
        element.className = `stat-card-change ${isPositive ? 'positive' : 'negative'}`;
        element.innerHTML = `
            <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>
            ${isPositive ? '+' : ''}${change}%
        `;
    },

    initCharts() {
        // Destroy existing chart instances to avoid canvas-reuse errors
        Object.values(this.charts).forEach(c => { if (c && typeof c.destroy === 'function') c.destroy(); });
        this.charts = {};

        // Income vs Expenses Chart
        this.initIncomeExpenseChart();
        
        // Expense Categories Chart
        this.initExpenseCategoriesChart();
        
        // Weekly Revenue Chart
        this.initWeeklyRevenueChart();
        
        // Attendance Chart
        this.initAttendanceChart();
    },

    initIncomeExpenseChart() {
        const ctx = document.getElementById('incomeExpenseChart');
        if (!ctx) return;

        this.charts.incomeExpense = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [
                    {
                        label: 'Income',
                        data: [1200, 1900, 3000, 5000, 2000, 3000, 4500],
                        borderColor: '#198754',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Expenses',
                        data: [800, 1200, 1500, 2000, 1800, 2200, 2500],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    },

    initExpenseCategoriesChart() {
        const ctx = document.getElementById('expenseCategoriesChart');
        if (!ctx) return;

        this.charts.expenseCategories = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Rent', 'Salaries', 'Utilities', 'Marketing', 'Other'],
                datasets: [{
                    data: [30, 25, 15, 20, 10],
                    backgroundColor: [
                        '#0d6efd',
                        '#198754',
                        '#ffc107',
                        '#dc3545',
                        '#6c757d'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    },

    initWeeklyRevenueChart() {
        const ctx = document.getElementById('weeklyRevenueChart');
        if (!ctx) return;

        this.charts.weeklyRevenue = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Revenue',
                    data: [12000, 19000, 15000, 22000],
                    backgroundColor: '#0d6efd',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    },

    initAttendanceChart() {
        const ctx = document.getElementById('attendanceChart');
        if (!ctx) return;

        this.charts.attendance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Present', 'Absent', 'Late', 'Leave'],
                datasets: [{
                    label: 'Staff',
                    data: [25, 3, 2, 5],
                    backgroundColor: [
                        '#198754',
                        '#dc3545',
                        '#ffc107',
                        '#6c757d'
                    ],
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },

    async updateCharts() {
        try {
            // Update income vs expenses chart with real data
            await this.updateIncomeExpenseChart();
            
            // Update expense categories chart with real data
            await this.updateExpenseCategoriesChart();
            
            // Update weekly revenue chart with real data
            await this.updateWeeklyRevenueChart();
            
            // Update attendance chart with real data
            await this.updateAttendanceChart();

        } catch (error) {
            console.error('Error updating charts:', error);
        }
    },

    async updateIncomeExpenseChart() {
        // Get last 7 days data
        const today = new Date();
        const last7Days = [];
        const incomeData = [];
        const expenseData = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateString = this.formatDate(date);
            
            last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));

            const dayIncome = await API.income.getAll({ date_from: dateString, date_to: dateString });
            const dayExpenses = await API.expense.getAll({ date_from: dateString, date_to: dateString });

            incomeData.push(dayIncome.reduce((sum, item) => sum + item.base_currency_amount, 0));
            expenseData.push(dayExpenses.reduce((sum, item) => sum + item.base_currency_amount, 0));
        }

        if (this.charts.incomeExpense) {
            this.charts.incomeExpense.data.labels = last7Days;
            this.charts.incomeExpense.data.datasets[0].data = incomeData;
            this.charts.incomeExpense.data.datasets[1].data = expenseData;
            this.charts.incomeExpense.update();
        }
    },

    async updateExpenseCategoriesChart() {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const monthExpenses = await API.expense.getAll({ 
                date_from: `${currentMonth}-01`, 
                date_to: `${currentMonth}-31` 
            });

            // Group by category
            const categoryTotals = {};
            monthExpenses.forEach(expense => {
                const category = expense.category_name || 'Other';
                categoryTotals[category] = (categoryTotals[category] || 0) + expense.base_currency_amount;
            });

            const labels = Object.keys(categoryTotals);
            const data = Object.values(categoryTotals);

            if (this.charts.expenseCategories) {
                this.charts.expenseCategories.data.labels = labels;
                this.charts.expenseCategories.data.datasets[0].data = data;
                this.charts.expenseCategories.update();
            }
        } catch (error) {
            console.error('Error updating expense categories chart:', error);
        }
    },

    async updateWeeklyRevenueChart() {
        try {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());

            const weeklyData = [];
            const weekLabels = [];

            for (let i = 0; i < 4; i++) {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);

                const weekIncome = await API.income.getAll({ 
                    date_from: this.formatDate(weekStart), 
                    date_to: this.formatDate(weekEnd) 
                });

                const weekTotal = weekIncome.reduce((sum, item) => sum + item.base_currency_amount, 0);
                weeklyData.push(weekTotal);
                weekLabels.push(`Week ${i + 1}`);

                weekStart.setDate(weekStart.getDate() + 7);
            }

            if (this.charts.weeklyRevenue) {
                this.charts.weeklyRevenue.data.labels = weekLabels;
                this.charts.weeklyRevenue.data.datasets[0].data = weeklyData;
                this.charts.weeklyRevenue.update();
            }
        } catch (error) {
            console.error('Error updating weekly revenue chart:', error);
        }
    },

    async updateAttendanceChart() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const attendance = await API.attendance.getAttendance({ date: today });

            const presentCount = attendance.filter(a => a.status === 'present').length;
            const absentCount = attendance.filter(a => a.status === 'absent').length;
            const lateCount = attendance.filter(a => a.status === 'late').length;
            const leaveCount = attendance.filter(a => a.status === 'leave').length;

            if (this.charts.attendance) {
                this.charts.attendance.data.datasets[0].data = [presentCount, absentCount, lateCount, leaveCount];
                this.charts.attendance.update();
            }
        } catch (error) {
            console.error('Error updating attendance chart:', error);
        }
    },

    setupEventListeners() {
        // Date filter buttons
        document.querySelectorAll('.date-filters button').forEach(button => {
            button.addEventListener('click', (e) => {
                document.querySelectorAll('.date-filters button').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.applyDateFilter();
            });
        });

        // Apply date filter
        const applyDateFilter = document.getElementById('applyDateFilter');
        if (applyDateFilter) {
            applyDateFilter.addEventListener('click', () => {
                const dateFrom = document.getElementById('dateFrom').value;
                const dateTo = document.getElementById('dateTo').value;
                
                if (dateFrom && dateTo) {
                    this.currentDateRange = { from: dateFrom, to: dateTo };
                    this.loadDashboardData();
                }
            });
        }

        // Refresh dashboard
        const refreshDashboard = document.getElementById('refreshDashboard');
        if (refreshDashboard) {
            refreshDashboard.addEventListener('click', () => {
                this.loadDashboardData();
            });
        }

        // Quick action button
        const quickActionBtn = document.getElementById('quickActionBtn');
        if (quickActionBtn) {
            quickActionBtn.addEventListener('click', () => {
                this.showQuickActionMenu();
            });
        }

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.handleQuickAction(button.dataset.action);
            });
        });

        // View all links
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.rmsApp.navigateTo(link.dataset.page);
            });
        });
    },

    applyDateFilter() {
        const today = new Date();
        let dateFrom, dateTo;

        switch (this.currentPeriod) {
            case 'today':
                dateFrom = this.formatDate(today);
                dateTo = this.formatDate(today);
                break;
            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                dateFrom = this.formatDate(weekStart);
                dateTo = this.formatDate(today);
                break;
            case 'month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                dateFrom = this.formatDate(monthStart);
                dateTo = this.formatDate(today);
                break;
            case 'year':
                const yearStart = new Date(today.getFullYear(), 0, 1);
                dateFrom = this.formatDate(yearStart);
                dateTo = this.formatDate(today);
                break;
        }

        this.currentDateRange = { from: dateFrom, to: dateTo };

        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');

        if (dateFromInput) dateFromInput.value = dateFrom;
        if (dateToInput) dateToInput.value = dateTo;

        this.loadDashboardData();
    },

    showQuickActionMenu() {
        // Create a dropdown menu with quick actions
        const actions = [
            { key: 'add-income', label: 'Add Income', icon: 'fa-plus-circle' },
            { key: 'add-expense', label: 'Add Expense', icon: 'fa-minus-circle' },
            { key: 'new-invoice', label: 'New Invoice', icon: 'fa-file-invoice-dollar' },
            { key: 'add-staff', label: 'Add Staff', icon: 'fa-user-plus' },
            { key: 'mark-attendance', label: 'Mark Attendance', icon: 'fa-clipboard-check' },
            { key: 'add-advance', label: 'Add Advance', icon: 'fa-hand-holding-usd' },
            { key: 'daily-report', label: 'Generate Daily Report', icon: 'fa-file-alt' },
            { key: 'backup', label: 'Backup Database', icon: 'fa-database' }
        ];

        // For now, just trigger the first action
        this.handleQuickAction('add-income');
    },

    handleQuickAction(action) {
        switch (action) {
            case 'add-income':
                window.rmsApp.navigateTo('income');
                setTimeout(() => {
                    if (window.IncomeModule) {
                        window.IncomeModule.showAddModal();
                    }
                }, 100);
                break;
            case 'add-expense':
                window.rmsApp.navigateTo('expenses');
                setTimeout(() => {
                    if (window.ExpensesModule) {
                        window.ExpensesModule.showAddModal();
                    }
                }, 100);
                break;
            case 'new-invoice':
                window.rmsApp.navigateTo('invoices');
                setTimeout(() => {
                    if (window.InvoicesModule) {
                        window.InvoicesModule.showAddModal();
                    }
                }, 100);
                break;
            case 'add-staff':
                window.rmsApp.navigateTo('staff');
                setTimeout(() => {
                    if (window.StaffModule) {
                        window.StaffModule.showAddModal();
                    }
                }, 100);
                break;
            case 'mark-attendance':
                window.rmsApp.navigateTo('attendance');
                break;
            case 'add-advance':
                window.rmsApp.navigateTo('advances');
                setTimeout(() => {
                    if (window.AdvancesModule) {
                        window.AdvancesModule.showAddModal();
                    }
                }, 100);
                break;
            case 'daily-report':
                window.rmsApp.navigateTo('reports');
                break;
            case 'backup':
                window.rmsApp.navigateTo('backup');
                break;
        }
    },

    startAutoRefresh() {
        // Auto-refresh dashboard every 5 minutes
        setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    },

    destroy() {
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });

        this.charts = {};
    }
};

// Export to global scope
window.DashboardModule = DashboardModule;
