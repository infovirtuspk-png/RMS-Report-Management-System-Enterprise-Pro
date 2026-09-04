// ============================================
// RMS - Customers Module Controller
// ============================================

window.CustomersModule = {
    modalInstance: null,

    async init() {
        console.log('Initializing Customers Module...');
        this.bindEvents();
        await this.loadCustomers();
    },

    bindEvents() {
        const btnAdd = document.getElementById('btnAddCustomer');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        const form = document.getElementById('customerForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveCustomer(e));
        }

        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.debounce(() => this.loadCustomers(), 300));
        }

        const btnRefresh = document.getElementById('btnRefreshCustomers');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.loadCustomers());
        }
    },

    async loadCustomers() {
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;

        const filters = {
            search: document.getElementById('customerSearchInput')?.value || ''
        };

        try {
            const rows = await window.electronAPI.customer.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><p>No customers found.</p><button class="btn btn-sm btn-primary" onclick="CustomersModule.openAddModal()">Add First Customer</button></td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(c => `
                <tr>
                    <td><strong class="text-primary">${Utils.escapeHtml(c.customer_code)}</strong></td>
                    <td><div class="fw-bold">${Utils.escapeHtml(c.name)}</div></td>
                    <td>${Utils.escapeHtml(c.company || '—')}</td>
                    <td>${Utils.escapeHtml(c.phone || c.whatsapp || '—')}</td>
                    <td>${Utils.escapeHtml(c.email || '—')}</td>
                    <td>${Utils.escapeHtml(c.country || '—')}</td>
                    <td>${Utils.escapeHtml(c.tax_vat_number || '—')}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="RMSAppInstance.navigateTo('invoices')" title="View Invoices"><i class="fas fa-file-invoice"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Error loading customers:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load customer list.</td></tr>';
        }
    },

    openAddModal() {
        document.getElementById('customerForm').reset();
        const modalEl = document.getElementById('customerModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async handleSaveCustomer(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('custName').value.trim(),
            company: document.getElementById('custCompany').value.trim(),
            phone: document.getElementById('custPhone').value.trim(),
            whatsapp: document.getElementById('custWhatsapp').value.trim(),
            email: document.getElementById('custEmail').value.trim(),
            tax_vat_number: document.getElementById('custTaxNumber').value.trim(),
            country: document.getElementById('custCountry').value.trim(),
            address: document.getElementById('custAddress').value.trim(),
            notes: document.getElementById('custNotes').value.trim()
        };

        try {
            await window.electronAPI.customer.create(payload);
            UI.showToast('Customer saved successfully.', 'success');
            if (this.modalInstance) this.modalInstance.hide();
            await this.loadCustomers();
        } catch (err) {
            console.error('Error creating customer:', err);
            UI.showToast(err.message || 'Failed to save customer.', 'error');
        }
    },

    debounceTimer: null,
    debounce(fn, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(fn, delay);
    }
};
