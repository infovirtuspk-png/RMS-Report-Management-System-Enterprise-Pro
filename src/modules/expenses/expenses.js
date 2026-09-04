// ============================================
// RMS - Expenses Module Controller
// ============================================

window.ExpensesModule = {
    modalInstance: null,
    categoriesModalInstance: null,
    currencies: [],
    categories: [],
    vendors: [],

    async init() {
        console.log('Initializing Expenses Module...');
        this.bindEvents();
        await this.loadDependencies();
        await this.loadExpensesList();
    },

    bindEvents() {
        const btnAdd = document.getElementById('btnAddExpense');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        const btnManageCats = document.getElementById('btnManageExpenseCats');
        if (btnManageCats) {
            btnManageCats.addEventListener('click', () => this.openCategoriesModal());
        }

        const form = document.getElementById('expenseForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveExpense(e));
        }

        const catForm = document.getElementById('newExpenseCategoryForm');
        if (catForm) {
            catForm.addEventListener('submit', (e) => this.handleCreateCategory(e));
        }

        const searchInput = document.getElementById('expenseSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.debounce(() => this.loadExpensesList(), 300));
        }

        const catFilter = document.getElementById('expenseCategoryFilter');
        if (catFilter) {
            catFilter.addEventListener('change', () => this.loadExpensesList());
        }

        const payFilter = document.getElementById('expensePaymentFilter');
        if (payFilter) {
            payFilter.addEventListener('change', () => this.loadExpensesList());
        }

        const dateFrom = document.getElementById('expenseDateFrom');
        const dateTo = document.getElementById('expenseDateTo');
        if (dateFrom && dateTo) {
            dateFrom.addEventListener('change', () => this.loadExpensesList());
            dateTo.addEventListener('change', () => this.loadExpensesList());
        }

        const btnReset = document.getElementById('btnResetExpenseFilters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (catFilter) catFilter.value = '';
                if (payFilter) payFilter.value = '';
                if (dateFrom) dateFrom.value = '';
                if (dateTo) dateTo.value = '';
                this.loadExpensesList();
            });
        }
    },

    async loadDependencies() {
        try {
            this.currencies = await window.electronAPI.currency.getAll();
            this.categories = await window.electronAPI.expense.getCategories();
            this.vendors = await window.electronAPI.vendor.getAll({});

            this.populateSelects();
        } catch (err) {
            console.error('Error loading expenses dependencies:', err);
        }
    },

    populateSelects() {
        // Category filter & modal select
        const catFilter = document.getElementById('expenseCategoryFilter');
        const catSelect = document.getElementById('expenseCategorySelect');
        if (catFilter) {
            catFilter.innerHTML = '<option value="">All Categories</option>' + 
                this.categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.category_name)}</option>`).join('');
        }
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Select Category</option>' + 
                this.categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.category_name)}</option>`).join('');
        }

        // Vendor select
        const vendSelect = document.getElementById('expenseVendorSelect');
        if (vendSelect) {
            vendSelect.innerHTML = '<option value="">None / General</option>' + 
                this.vendors.map(v => `<option value="${v.id}">${Utils.escapeHtml(v.name)}</option>`).join('');
        }

        // Currency select
        const currSelect = document.getElementById('expenseCurrencySelect');
        if (currSelect) {
            currSelect.innerHTML = this.currencies.map(c => 
                `<option value="${c.currency_code}" ${c.is_base_currency ? 'selected' : ''}>${c.currency_code} (${c.currency_symbol})</option>`
            ).join('');
        }
    },

    async loadExpensesList() {
        const tbody = document.getElementById('expensesTableBody');
        if (!tbody) return;

        const filters = {
            search: document.getElementById('expenseSearchInput')?.value || '',
            category_id: document.getElementById('expenseCategoryFilter')?.value || '',
            payment_method: document.getElementById('expensePaymentFilter')?.value || '',
            date_from: document.getElementById('expenseDateFrom')?.value || '',
            date_to: document.getElementById('expenseDateTo')?.value || ''
        };

        try {
            const rows = await window.electronAPI.expense.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center py-5 text-muted">
                            <i class="fas fa-receipt fa-3x mb-3 text-secondary"></i>
                            <p>No expenses found.</p>
                            <button class="btn btn-sm btn-danger" onclick="ExpensesModule.openAddModal()">Add First Expense</button>
                        </td>
                    </tr>
                `;
                this.updateStats([]);
                return;
            }

            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td><strong class="text-danger">${Utils.escapeHtml(r.expense_number)}</strong></td>
                    <td>${Utils.formatDate(r.date)} <small class="text-muted">${r.time || ''}</small></td>
                    <td><span class="badge bg-light text-dark">${Utils.escapeHtml(r.category_name || 'Uncategorized')}</span></td>
                    <td>${Utils.escapeHtml(r.description)}</td>
                    <td>${r.vendor_name ? Utils.escapeHtml(r.vendor_name) : '<span class="text-muted">—</span>'}</td>
                    <td><span class="badge bg-secondary">${Utils.escapeHtml(r.payment_method)}</span></td>
                    <td class="fw-bold text-danger">${Utils.formatCurrency(r.amount, r.currency)}</td>
                    <td class="text-muted">${Utils.formatCurrency(r.base_currency_amount)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline me-1" onclick="ExpensesModule.openEditModal(${r.id})" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline text-danger" onclick="ExpensesModule.handleDeleteExpense(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');

            this.updateStats(rows);
        } catch (err) {
            console.error('Error fetching expenses records:', err);
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-danger">Failed to load records.</td></tr>';
        }
    },

    updateStats(rows) {
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);

        let todaySum = 0;
        let monthSum = 0;

        rows.forEach(r => {
            if (r.date === today) todaySum += parseFloat(r.base_currency_amount) || 0;
            if (r.date && r.date.startsWith(thisMonth)) monthSum += parseFloat(r.base_currency_amount) || 0;
        });

        const statToday = document.getElementById('statTodayExpense');
        const statMonth = document.getElementById('statMonthExpense');
        const statCount = document.getElementById('statExpenseCount');

        if (statToday) statToday.textContent = Utils.formatCurrency(todaySum);
        if (statMonth) statMonth.textContent = Utils.formatCurrency(monthSum);
        if (statCount) statCount.textContent = rows.length.toString();
    },

    openAddModal() {
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseEditId').value = '';
        document.getElementById('expenseModalTitle').textContent = 'Add Expense';
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('expenseTime').value = new Date().toTimeString().split(' ')[0].substring(0, 5);

        const modalEl = document.getElementById('expenseModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async openEditModal(id) {
        try {
            const rows = await window.electronAPI.expense.getAll({});
            const item = rows.find(r => r.id === id);
            if (!item) return;

            document.getElementById('expenseEditId').value = item.id;
            document.getElementById('expenseModalTitle').textContent = `Edit Expense (${item.expense_number})`;
            document.getElementById('expenseDate').value = item.date;
            document.getElementById('expenseTime').value = item.time ? item.time.substring(0, 5) : '';
            document.getElementById('expenseCategorySelect').value = item.category_id || '';
            document.getElementById('expenseVendorSelect').value = item.vendor_id || '';
            document.getElementById('expenseDescription').value = item.description;
            document.getElementById('expenseAmount').value = item.amount;
            document.getElementById('expenseCurrencySelect').value = item.currency;
            document.getElementById('expensePaymentMethod').value = item.payment_method;
            document.getElementById('expenseReceiptRef').value = item.receipt_reference || '';
            document.getElementById('expenseNotes').value = item.notes || '';

            const modalEl = document.getElementById('expenseModal');
            this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            this.modalInstance.show();
        } catch (err) {
            console.error('Error fetching expense for edit:', err);
        }
    },

    async handleSaveExpense(e) {
        e.preventDefault();
        const editId = document.getElementById('expenseEditId').value;
        const selectedCurrencyCode = document.getElementById('expenseCurrencySelect').value;
        const curr = this.currencies.find(c => c.currency_code === selectedCurrencyCode);
        const exchangeRate = curr ? curr.exchange_rate : 1.0;

        const payload = {
            date: document.getElementById('expenseDate').value,
            time: document.getElementById('expenseTime').value + ':00',
            category_id: document.getElementById('expenseCategorySelect').value || null,
            vendor_id: document.getElementById('expenseVendorSelect').value || null,
            description: document.getElementById('expenseDescription').value.trim(),
            amount: parseFloat(document.getElementById('expenseAmount').value),
            currency: selectedCurrencyCode,
            exchange_rate: exchangeRate,
            payment_method: document.getElementById('expensePaymentMethod').value,
            receipt_reference: document.getElementById('expenseReceiptRef').value.trim(),
            notes: document.getElementById('expenseNotes').value.trim()
        };

        try {
            if (editId) {
                await window.electronAPI.expense.update(parseInt(editId), payload);
                UI.showToast('Expense updated successfully.', 'success');
            } else {
                await window.electronAPI.expense.create(payload);
                UI.showToast('Expense recorded successfully.', 'success');
            }

            if (this.modalInstance) this.modalInstance.hide();
            await this.loadExpensesList();
        } catch (err) {
            console.error('Error saving expense:', err);
            UI.showToast(err.message || 'Failed to save expense record.', 'error');
        }
    },

    async handleDeleteExpense(id) {
        if (!confirm('Are you sure you want to delete this expense record?')) return;
        try {
            await window.electronAPI.expense.delete(id);
            UI.showToast('Expense record deleted.', 'info');
            await this.loadExpensesList();
        } catch (err) {
            console.error('Error deleting expense:', err);
            UI.showToast('Failed to delete expense record.', 'error');
        }
    },

    openCategoriesModal() {
        this.renderCategoriesList();
        const modalEl = document.getElementById('expenseCategoriesModal');
        this.categoriesModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.categoriesModalInstance.show();
    },

    renderCategoriesList() {
        const list = document.getElementById('expenseCategoriesList');
        if (!list) return;
        list.innerHTML = this.categories.map(c => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span><strong>${Utils.escapeHtml(c.category_name)}</strong></span>
                <span class="badge bg-danger">Active</span>
            </div>
        `).join('');
    },

    async handleCreateCategory(e) {
        e.preventDefault();
        const nameInput = document.getElementById('newExpenseCategoryName');
        const name = nameInput.value.trim();
        if (!name) return;

        try {
            await window.electronAPI.expense.createCategory({ category_name: name });
            nameInput.value = '';
            UI.showToast(`Category '${name}' created.`, 'success');
            this.categories = await window.electronAPI.expense.getCategories();
            this.populateSelects();
            this.renderCategoriesList();
        } catch (err) {
            console.error('Error creating expense category:', err);
            UI.showToast(err.message || 'Failed to create category.', 'error');
        }
    },

    debounceTimer: null,
    debounce(fn, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(fn, delay);
    }
};
