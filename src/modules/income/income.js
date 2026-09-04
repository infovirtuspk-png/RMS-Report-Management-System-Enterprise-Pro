// ============================================
// RMS - Income Module Controller
// ============================================

window.IncomeModule = {
    modalInstance: null,
    categoriesModalInstance: null,
    currencies: [],
    categories: [],
    customers: [],

    async init() {
        console.log('Initializing Income Module...');
        this.bindEvents();
        await this.loadDependencies();
        await this.loadIncomeList();
    },

    bindEvents() {
        const btnAdd = document.getElementById('btnAddIncome');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        const btnManageCats = document.getElementById('btnManageCategories');
        if (btnManageCats) {
            btnManageCats.addEventListener('click', () => this.openCategoriesModal());
        }

        const form = document.getElementById('incomeForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveIncome(e));
        }

        const catForm = document.getElementById('newIncomeCategoryForm');
        if (catForm) {
            catForm.addEventListener('submit', (e) => this.handleCreateCategory(e));
        }

        const searchInput = document.getElementById('incomeSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.debounce(() => this.loadIncomeList(), 300));
        }

        const catFilter = document.getElementById('incomeCategoryFilter');
        if (catFilter) {
            catFilter.addEventListener('change', () => this.loadIncomeList());
        }

        const payFilter = document.getElementById('incomePaymentFilter');
        if (payFilter) {
            payFilter.addEventListener('change', () => this.loadIncomeList());
        }

        const dateFrom = document.getElementById('incomeDateFrom');
        const dateTo = document.getElementById('incomeDateTo');
        if (dateFrom && dateTo) {
            dateFrom.addEventListener('change', () => this.loadIncomeList());
            dateTo.addEventListener('change', () => this.loadIncomeList());
        }

        const btnReset = document.getElementById('btnResetIncomeFilters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (catFilter) catFilter.value = '';
                if (payFilter) payFilter.value = '';
                if (dateFrom) dateFrom.value = '';
                if (dateTo) dateTo.value = '';
                this.loadIncomeList();
            });
        }
    },

    async loadDependencies() {
        try {
            this.currencies = await window.electronAPI.currency.getAll();
            this.categories = await window.electronAPI.income.getCategories();
            this.customers = await window.electronAPI.customer.getAll({});

            this.populateSelects();
        } catch (err) {
            console.error('Error loading income dependencies:', err);
        }
    },

    populateSelects() {
        // Category filter & modal select
        const catFilter = document.getElementById('incomeCategoryFilter');
        const catSelect = document.getElementById('incomeCategorySelect');
        if (catFilter) {
            catFilter.innerHTML = '<option value="">All Categories</option>' + 
                this.categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.category_name)}</option>`).join('');
        }
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Select Category</option>' + 
                this.categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.category_name)}</option>`).join('');
        }

        // Customer select
        const custSelect = document.getElementById('incomeCustomerSelect');
        if (custSelect) {
            custSelect.innerHTML = '<option value="">None / Walk-in</option>' + 
                this.customers.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');
        }

        // Currency select
        const currSelect = document.getElementById('incomeCurrencySelect');
        if (currSelect) {
            currSelect.innerHTML = this.currencies.map(c => 
                `<option value="${c.currency_code}" ${c.is_base_currency ? 'selected' : ''}>${c.currency_code} (${c.currency_symbol})</option>`
            ).join('');
        }
    },

    async loadIncomeList() {
        const tbody = document.getElementById('incomeTableBody');
        if (!tbody) return;

        const filters = {
            search: document.getElementById('incomeSearchInput')?.value || '',
            category_id: document.getElementById('incomeCategoryFilter')?.value || '',
            payment_method: document.getElementById('incomePaymentFilter')?.value || '',
            date_from: document.getElementById('incomeDateFrom')?.value || '',
            date_to: document.getElementById('incomeDateTo')?.value || ''
        };

        try {
            const rows = await window.electronAPI.income.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center py-5 text-muted">
                            <i class="fas fa-coins fa-3x mb-3 text-secondary"></i>
                            <p>No income records found.</p>
                            <button class="btn btn-sm btn-primary" onclick="IncomeModule.openAddModal()">Add First Income</button>
                        </td>
                    </tr>
                `;
                this.updateStats([]);
                return;
            }

            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td><strong class="text-primary">${Utils.escapeHtml(r.income_number)}</strong></td>
                    <td>${Utils.formatDate(r.date)} <small class="text-muted">${r.time || ''}</small></td>
                    <td><span class="badge bg-light text-dark">${Utils.escapeHtml(r.category_name || 'Uncategorized')}</span></td>
                    <td>${Utils.escapeHtml(r.description)}</td>
                    <td>${r.customer_name ? Utils.escapeHtml(r.customer_name) : '<span class="text-muted">—</span>'}</td>
                    <td><span class="badge bg-secondary">${Utils.escapeHtml(r.payment_method)}</span></td>
                    <td class="fw-bold text-success">${Utils.formatCurrency(r.amount, r.currency)}</td>
                    <td class="text-muted">${Utils.formatCurrency(r.base_currency_amount)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline me-1" onclick="IncomeModule.openEditModal(${r.id})" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline text-danger" onclick="IncomeModule.handleDeleteIncome(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');

            this.updateStats(rows);
        } catch (err) {
            console.error('Error fetching income records:', err);
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

        const statToday = document.getElementById('statTodayIncome');
        const statMonth = document.getElementById('statMonthIncome');
        const statCount = document.getElementById('statIncomeCount');

        if (statToday) statToday.textContent = Utils.formatCurrency(todaySum);
        if (statMonth) statMonth.textContent = Utils.formatCurrency(monthSum);
        if (statCount) statCount.textContent = rows.length.toString();
    },

    openAddModal() {
        document.getElementById('incomeForm').reset();
        document.getElementById('incomeEditId').value = '';
        document.getElementById('incomeModalTitle').textContent = 'Add Income';
        document.getElementById('incomeDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('incomeTime').value = new Date().toTimeString().split(' ')[0].substring(0, 5);

        const modalEl = document.getElementById('incomeModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async openEditModal(id) {
        try {
            const rows = await window.electronAPI.income.getAll({});
            const item = rows.find(r => r.id === id);
            if (!item) return;

            document.getElementById('incomeEditId').value = item.id;
            document.getElementById('incomeModalTitle').textContent = `Edit Income (${item.income_number})`;
            document.getElementById('incomeDate').value = item.date;
            document.getElementById('incomeTime').value = item.time ? item.time.substring(0, 5) : '';
            document.getElementById('incomeCategorySelect').value = item.category_id || '';
            document.getElementById('incomeCustomerSelect').value = item.customer_id || '';
            document.getElementById('incomeDescription').value = item.description;
            document.getElementById('incomeAmount').value = item.amount;
            document.getElementById('incomeCurrencySelect').value = item.currency;
            document.getElementById('incomePaymentMethod').value = item.payment_method;
            document.getElementById('incomeInvoiceRef').value = item.invoice_reference || '';
            document.getElementById('incomeNotes').value = item.notes || '';

            const modalEl = document.getElementById('incomeModal');
            this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            this.modalInstance.show();
        } catch (err) {
            console.error('Error fetching income for edit:', err);
        }
    },

    async handleSaveIncome(e) {
        e.preventDefault();
        const editId = document.getElementById('incomeEditId').value;
        const selectedCurrencyCode = document.getElementById('incomeCurrencySelect').value;
        const curr = this.currencies.find(c => c.currency_code === selectedCurrencyCode);
        const exchangeRate = curr ? curr.exchange_rate : 1.0;

        const payload = {
            date: document.getElementById('incomeDate').value,
            time: document.getElementById('incomeTime').value + ':00',
            category_id: document.getElementById('incomeCategorySelect').value || null,
            customer_id: document.getElementById('incomeCustomerSelect').value || null,
            description: document.getElementById('incomeDescription').value.trim(),
            amount: parseFloat(document.getElementById('incomeAmount').value),
            currency: selectedCurrencyCode,
            exchange_rate: exchangeRate,
            payment_method: document.getElementById('incomePaymentMethod').value,
            invoice_reference: document.getElementById('incomeInvoiceRef').value.trim(),
            notes: document.getElementById('incomeNotes').value.trim()
        };

        try {
            if (editId) {
                await window.electronAPI.income.update(parseInt(editId), payload);
                UI.showToast('Income updated successfully.', 'success');
            } else {
                await window.electronAPI.income.create(payload);
                UI.showToast('Income recorded successfully.', 'success');
            }

            if (this.modalInstance) this.modalInstance.hide();
            await this.loadIncomeList();
        } catch (err) {
            console.error('Error saving income:', err);
            UI.showToast(err.message || 'Failed to save income record.', 'error');
        }
    },

    async handleDeleteIncome(id) {
        if (!confirm('Are you sure you want to delete this income record?')) return;
        try {
            await window.electronAPI.income.delete(id);
            UI.showToast('Income record deleted.', 'info');
            await this.loadIncomeList();
        } catch (err) {
            console.error('Error deleting income:', err);
            UI.showToast('Failed to delete income record.', 'error');
        }
    },

    openCategoriesModal() {
        this.renderCategoriesList();
        const modalEl = document.getElementById('incomeCategoriesModal');
        this.categoriesModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.categoriesModalInstance.show();
    },

    renderCategoriesList() {
        const list = document.getElementById('incomeCategoriesList');
        if (!list) return;
        list.innerHTML = this.categories.map(c => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span><strong>${Utils.escapeHtml(c.category_name)}</strong></span>
                <span class="badge bg-success">Active</span>
            </div>
        `).join('');
    },

    async handleCreateCategory(e) {
        e.preventDefault();
        const nameInput = document.getElementById('newCategoryName');
        const name = nameInput.value.trim();
        if (!name) return;

        try {
            await window.electronAPI.income.createCategory({ category_name: name });
            nameInput.value = '';
            UI.showToast(`Category '${name}' created.`, 'success');
            this.categories = await window.electronAPI.income.getCategories();
            this.populateSelects();
            this.renderCategoriesList();
        } catch (err) {
            console.error('Error creating income category:', err);
            UI.showToast(err.message || 'Failed to create category.', 'error');
        }
    },

    debounceTimer: null,
    debounce(fn, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(fn, delay);
    }
};
