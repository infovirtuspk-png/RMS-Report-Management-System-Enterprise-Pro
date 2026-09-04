// ============================================
// RMS - Invoices Module Controller
// ============================================

window.InvoicesModule = {
    modalInstance: null,
    printModalInstance: null,
    paymentModalInstance: null,
    customers: [],
    currencies: [],
    selectedInvoice: null,
    company: null,

    async init() {
        console.log('Initializing Invoices Module...');
        this.bindEvents();
        await this.loadDependencies();
        await this.loadInvoicesList();
    },

    bindEvents() {
        const btnNew = document.getElementById('btnNewInvoice');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openNewInvoiceModal());
        }

        const btnAddItem = document.getElementById('btnAddInvoiceItem');
        if (btnAddItem) {
            btnAddItem.addEventListener('click', () => this.addItemRow());
        }

        const form = document.getElementById('invoiceForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveInvoice(e));
        }

        const payForm = document.getElementById('paymentForm');
        if (payForm) {
            payForm.addEventListener('submit', (e) => this.handleSavePayment(e));
        }

        const searchInput = document.getElementById('invoiceSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.debounce(() => this.loadInvoicesList(), 300));
        }

        const statusFilter = document.getElementById('invoiceStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.loadInvoicesList());
        }

        const dateFilter = document.getElementById('invoiceDateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', () => this.loadInvoicesList());
        }

        const btnReset = document.getElementById('btnResetInvoiceFilters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (statusFilter) statusFilter.value = '';
                if (dateFilter) dateFilter.value = '';
                this.loadInvoicesList();
            });
        }

        const paidInput = document.getElementById('invPaidAmountInput');
        if (paidInput) {
            paidInput.addEventListener('input', () => this.recalculateTotals());
        }

        // Print buttons
        document.getElementById('btnPrintA4')?.addEventListener('click', () => this.printInvoiceDoc('a4'));
        document.getElementById('btnPrintThermal80')?.addEventListener('click', () => this.printInvoiceDoc('thermal80'));
        document.getElementById('btnPrintThermal58')?.addEventListener('click', () => this.printInvoiceDoc('thermal58'));
    },

    async loadDependencies() {
        try {
            this.customers = await window.electronAPI.customer.getAll({});
            this.currencies = await window.electronAPI.currency.getAll();
            this.company = await window.electronAPI.company.getCompany();

            const custSelect = document.getElementById('invCustomerSelect');
            if (custSelect) {
                custSelect.innerHTML = '<option value="">Select Customer</option>' + 
                    this.customers.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)} (${Utils.escapeHtml(c.company || 'Individual')})</option>`).join('');
            }

            const currSelect = document.getElementById('invCurrencySelect');
            if (currSelect) {
                currSelect.innerHTML = this.currencies.map(c => 
                    `<option value="${c.currency_code}" ${c.is_base_currency ? 'selected' : ''}>${c.currency_code} (${c.currency_symbol})</option>`
                ).join('');
            }
        } catch (err) {
            console.error('Error loading invoice dependencies:', err);
        }
    },

    async loadInvoicesList() {
        const tbody = document.getElementById('invoicesTableBody');
        if (!tbody) return;

        const filters = {
            search: document.getElementById('invoiceSearchInput')?.value || '',
            payment_status: document.getElementById('invoiceStatusFilter')?.value || ''
        };

        try {
            const rows = await window.electronAPI.invoice.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-5 text-muted">
                            <i class="fas fa-file-invoice-dollar fa-3x mb-3 text-secondary"></i>
                            <p>No invoices created yet.</p>
                            <button class="btn btn-sm btn-primary" onclick="InvoicesModule.openNewInvoiceModal()">Create First Invoice</button>
                        </td>
                    </tr>
                `;
                this.updateStats([]);
                return;
            }

            tbody.innerHTML = rows.map(inv => {
                const isPaid = inv.payment_status === 'paid';
                const isPartial = inv.payment_status === 'partially_paid';
                const statusBadge = isPaid ? '<span class="badge bg-success">PAID</span>' : 
                    (isPartial ? '<span class="badge bg-info text-dark">PARTIAL</span>' : '<span class="badge bg-danger">PENDING</span>');

                return `
                    <tr>
                        <td><strong class="text-primary">${Utils.escapeHtml(inv.invoice_number)}</strong></td>
                        <td>${Utils.formatDate(inv.date)}</td>
                        <td><div class="fw-bold">${Utils.escapeHtml(inv.customer_name)}</div></td>
                        <td class="fw-bold">${Utils.formatCurrency(inv.total_amount, inv.currency)}</td>
                        <td class="text-success">${Utils.formatCurrency(inv.paid_amount, inv.currency)}</td>
                        <td class="text-danger fw-bold">${Utils.formatCurrency(inv.balance_amount, inv.currency)}</td>
                        <td>${statusBadge}</td>
                        <td class="text-end">
                            ${!isPaid ? `<button class="btn btn-sm btn-outline-success me-1" onclick="InvoicesModule.openPaymentModal(${inv.id})" title="Receive Payment"><i class="fas fa-hand-holding-usd"></i></button>` : ''}
                            <button class="btn btn-sm btn-outline me-1" onclick="InvoicesModule.openPrintModal(${inv.id})" title="Print / Thermal"><i class="fas fa-print"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');

            this.updateStats(rows);
        } catch (err) {
            console.error('Error fetching invoices:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load invoices.</td></tr>';
        }
    },

    updateStats(rows) {
        let total = 0, paid = 0, outstanding = 0;
        rows.forEach(r => {
            total += parseFloat(r.base_currency_total) || 0;
            paid += parseFloat(r.paid_amount / (r.exchange_rate || 1)) || 0;
            outstanding += parseFloat(r.balance_amount / (r.exchange_rate || 1)) || 0;
        });

        document.getElementById('statTotalInvoiced').textContent = Utils.formatCurrency(total);
        document.getElementById('statPaidInvoiced').textContent = Utils.formatCurrency(paid);
        document.getElementById('statOutstandingInvoiced').textContent = Utils.formatCurrency(outstanding);
    },

    async openNewInvoiceModal() {
        document.getElementById('invoiceForm').reset();
        const nextNumber = await window.electronAPI.invoice.generateNumber();
        document.getElementById('invNumberInput').value = nextNumber;
        document.getElementById('invDateInput').value = new Date().toISOString().split('T')[0];
        document.getElementById('invTermsInput').value = this.company?.terms_conditions || 'Payment is due within 30 days. Thank you for your business!';

        const tbody = document.getElementById('invoiceItemsBody');
        tbody.innerHTML = '';
        this.addItemRow(); // Start with 1 row

        const modalEl = document.getElementById('invoiceModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    addItemRow() {
        const tbody = document.getElementById('invoiceItemsBody');
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.innerHTML = `
            <td><input type="text" class="form-control form-control-sm item-desc" placeholder="Product or service description" required></td>
            <td><input type="number" step="0.01" min="0.01" class="form-control form-control-sm item-qty" value="1.00" required></td>
            <td><input type="number" step="0.01" min="0" class="form-control form-control-sm item-price" value="0.00" required></td>
            <td><input type="number" step="0.01" min="0" class="form-control form-control-sm item-disc" value="0.00"></td>
            <td><input type="number" step="0.01" min="0" class="form-control form-control-sm item-tax" value="0.00"></td>
            <td><input type="number" step="0.01" class="form-control form-control-sm item-total bg-light" value="0.00" readonly></td>
            <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); InvoicesModule.recalculateTotals();"><i class="fas fa-trash"></i></button></td>
        `;

        const inputs = tr.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.recalculateTotals());
        });

        tbody.appendChild(tr);
        this.recalculateTotals();
    },

    recalculateTotals() {
        const rows = document.querySelectorAll('.item-row');
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            const disc = parseFloat(row.querySelector('.item-disc').value) || 0;
            const tax = parseFloat(row.querySelector('.item-tax').value) || 0;

            const rowGross = qty * price;
            const rowTotal = Math.max(0, rowGross - disc + tax);

            row.querySelector('.item-total').value = rowTotal.toFixed(2);
            subtotal += rowGross;
            totalDiscount += disc;
            totalTax += tax;
        });

        const grandTotal = Math.max(0, subtotal - totalDiscount + totalTax);
        const paid = parseFloat(document.getElementById('invPaidAmountInput').value) || 0;
        const balance = Math.max(0, grandTotal - paid);

        document.getElementById('invSummarySubtotal').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('invSummaryDiscount').textContent = `-${Utils.formatCurrency(totalDiscount)}`;
        document.getElementById('invSummaryTax').textContent = `+${Utils.formatCurrency(totalTax)}`;
        document.getElementById('invSummaryTotal').textContent = Utils.formatCurrency(grandTotal);
        document.getElementById('invSummaryBalance').textContent = Utils.formatCurrency(balance);
    },

    async handleSaveInvoice(e) {
        e.preventDefault();
        const rows = document.querySelectorAll('.item-row');
        if (rows.length === 0) {
            UI.showToast('Please add at least one line item to the invoice.', 'warning');
            return;
        }

        const items = [];
        let subtotal = 0, totalDisc = 0, totalTax = 0;

        rows.forEach(row => {
            const desc = row.querySelector('.item-desc').value.trim();
            const qty = parseFloat(row.querySelector('.item-qty').value) || 1;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            const disc = parseFloat(row.querySelector('.item-disc').value) || 0;
            const tax = parseFloat(row.querySelector('.item-tax').value) || 0;
            const total = parseFloat(row.querySelector('.item-total').value) || (qty * price - disc + tax);

            subtotal += (qty * price);
            totalDisc += disc;
            totalTax += tax;

            items.push({
                description: desc,
                quantity: qty,
                unit_price: price,
                discount_amount: disc,
                tax_amount: tax,
                line_total: total
            });
        });

        const selectedCurrency = document.getElementById('invCurrencySelect').value;
        const curr = this.currencies.find(c => c.currency_code === selectedCurrency);
        const grandTotal = subtotal - totalDisc + totalTax;
        const paid = parseFloat(document.getElementById('invPaidAmountInput').value) || 0;

        const payload = {
            invoice_number: document.getElementById('invNumberInput').value,
            customer_id: parseInt(document.getElementById('invCustomerSelect').value),
            date: document.getElementById('invDateInput').value,
            currency: selectedCurrency,
            exchange_rate: curr ? curr.exchange_rate : 1.0,
            subtotal,
            discount_amount: totalDisc,
            tax_amount: totalTax,
            total_amount: grandTotal,
            paid_amount: paid,
            payment_method: document.getElementById('invPaymentMethodSelect').value,
            terms_conditions: document.getElementById('invTermsInput').value.trim(),
            items
        };

        try {
            const inv = await window.electronAPI.invoice.create(payload);
            UI.showToast(`Invoice ${inv.invoice_number} created successfully.`, 'success');
            if (this.modalInstance) this.modalInstance.hide();
            await this.loadInvoicesList();
            this.openPrintModal(inv.id);
        } catch (err) {
            console.error('Error saving invoice:', err);
            UI.showToast(err.message || 'Failed to create invoice.', 'error');
        }
    },

    async openPrintModal(invoiceId) {
        try {
            this.selectedInvoice = await window.electronAPI.invoice.getById(invoiceId);
            if (!this.selectedInvoice) return;

            const preview = document.getElementById('printPreviewContainer');
            preview.innerHTML = this.generateA4Html(this.selectedInvoice, this.company);

            const modalEl = document.getElementById('invoicePrintModal');
            this.printModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            this.printModalInstance.show();
        } catch (err) {
            console.error('Error opening print modal:', err);
        }
    },

    async printInvoiceDoc(format) {
        if (!this.selectedInvoice) return;
        let htmlContent;
        if (format === 'a4') {
            htmlContent = this.generateA4Html(this.selectedInvoice, this.company);
        } else if (format === 'thermal80') {
            htmlContent = this.generateThermalHtml(this.selectedInvoice, this.company, 80);
        } else {
            htmlContent = this.generateThermalHtml(this.selectedInvoice, this.company, 58);
        }

        await window.electronAPI.print.printContent(htmlContent, { silent: false });
    },

    generateA4Html(inv, comp) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice - ${inv.invoice_number}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; color: #333; font-size: 13px; line-height: 1.4; }
                    .header-table { width: 100%; margin-bottom: 25px; }
                    .company-title { font-size: 24px; font-weight: bold; color: #0d6efd; }
                    .invoice-title { font-size: 26px; font-weight: bold; text-align: right; color: #333; }
                    .info-box { width: 100%; margin-bottom: 20px; }
                    .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    .items-table th, .items-table td { padding: 10px; border: 1px solid #ddd; }
                    .items-table th { background: #f8f9fa; font-weight: bold; }
                    .text-end { text-align: right; }
                    .summary-table { width: 350px; margin-left: auto; margin-top: 20px; border-collapse: collapse; }
                    .summary-table td { padding: 6px 12px; border: 1px solid #eee; }
                    .grand-total { background: #e9ecef; font-size: 16px; font-weight: bold; }
                    .footer { margin-top: 40px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 11px; color: #777; }
                </style>
            </head>
            <body>
                <table class="header-table">
                    <tr>
                        <td>
                            <div class="company-title">${Utils.escapeHtml(comp?.company_name || 'RMS Business')}</div>
                            <div>${Utils.escapeHtml(comp?.address || '')} ${Utils.escapeHtml(comp?.city || '')}</div>
                            <div>Phone: ${Utils.escapeHtml(comp?.phone || '')} | Email: ${Utils.escapeHtml(comp?.email || '')}</div>
                            <div>Tax/VAT Reg: ${Utils.escapeHtml(comp?.tax_vat_number || 'N/A')}</div>
                        </td>
                        <td style="text-align: right; vertical-align: top;">
                            <div class="invoice-title">TAX INVOICE</div>
                            <div><strong>Invoice #:</strong> ${inv.invoice_number}</div>
                            <div><strong>Date:</strong> ${Utils.formatDate(inv.date)}</div>
                            <div><strong>Payment Status:</strong> ${inv.payment_status.toUpperCase()}</div>
                        </td>
                    </tr>
                </table>

                <table class="info-box">
                    <tr>
                        <td style="background: #fdfdfd; padding: 10px; border: 1px solid #eee; border-radius: 4px;">
                            <strong>BILLED TO:</strong><br>
                            <strong>${Utils.escapeHtml(inv.customer_name)}</strong><br>
                            ${inv.customer_company ? Utils.escapeHtml(inv.customer_company) + '<br>' : ''}
                            ${inv.customer_phone ? 'Phone: ' + Utils.escapeHtml(inv.customer_phone) + '<br>' : ''}
                            ${inv.customer_tax ? 'TRN / Tax: ' + Utils.escapeHtml(inv.customer_tax) : ''}
                        </td>
                    </tr>
                </table>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 5%;">#</th>
                            <th style="width: 45%;">Description</th>
                            <th class="text-end" style="width: 10%;">Qty</th>
                            <th class="text-end" style="width: 15%;">Unit Price</th>
                            <th class="text-end" style="width: 10%;">Tax</th>
                            <th class="text-end" style="width: 15%;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.items.map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${Utils.escapeHtml(item.description)}</td>
                                <td class="text-end">${item.quantity}</td>
                                <td class="text-end">${Utils.formatCurrency(item.unit_price, inv.currency)}</td>
                                <td class="text-end">${Utils.formatCurrency(item.tax_amount, inv.currency)}</td>
                                <td class="text-end fw-bold">${Utils.formatCurrency(item.line_total, inv.currency)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <table class="summary-table">
                    <tr><td>Subtotal:</td><td class="text-end">${Utils.formatCurrency(inv.subtotal, inv.currency)}</td></tr>
                    <tr><td>Discount:</td><td class="text-end">-${Utils.formatCurrency(inv.discount_amount, inv.currency)}</td></tr>
                    <tr><td>Tax / VAT:</td><td class="text-end">+${Utils.formatCurrency(inv.tax_amount, inv.currency)}</td></tr>
                    <tr class="grand-total"><td>Total Payable:</td><td class="text-end">${Utils.formatCurrency(inv.total_amount, inv.currency)}</td></tr>
                    <tr><td>Amount Paid:</td><td class="text-end" style="color: green;">${Utils.formatCurrency(inv.paid_amount, inv.currency)}</td></tr>
                    <tr><td>Balance Due:</td><td class="text-end" style="color: red; font-weight: bold;">${Utils.formatCurrency(inv.balance_amount, inv.currency)}</td></tr>
                </table>

                ${inv.terms_conditions ? `<div style="margin-top: 20px; font-size: 11px;"><strong>Terms:</strong> ${Utils.escapeHtml(inv.terms_conditions)}</div>` : ''}

                <div class="footer">
                    ${Utils.escapeHtml(comp?.invoice_footer || 'Thank you for choosing our business!')}
                </div>
            </body>
            </html>
        `;
    },

    generateThermalHtml(inv, comp, widthMm = 80) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - ${inv.invoice_number}</title>
                <style>
                    @page { margin: 0; size: ${widthMm}mm auto; }
                    body { font-family: 'Courier New', Courier, monospace; width: ${widthMm}mm; margin: 0 auto; padding: 6px; font-size: ${widthMm === 58 ? '10px' : '12px'}; color: #000; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .company-header { font-size: ${widthMm === 58 ? '13px' : '15px'}; font-weight: bold; }
                    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
                    .double-divider { border-bottom: 2px solid #000; margin: 6px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    td { vertical-align: top; padding: 2px 0; }
                    .text-end { text-align: right; }
                </style>
            </head>
            <body>
                <div class="center company-header">${Utils.escapeHtml(comp?.company_name || 'RMS')}</div>
                <div class="center">${Utils.escapeHtml(comp?.address || '')}</div>
                <div class="center">Phone: ${Utils.escapeHtml(comp?.phone || '')}</div>
                ${comp?.tax_vat_number ? `<div class="center">TRN: ${Utils.escapeHtml(comp.tax_vat_number)}</div>` : ''}
                <div class="divider"></div>
                <div class="center bold">SALES RECEIPT</div>
                <div>Invoice #: ${inv.invoice_number}</div>
                <div>Date: ${inv.date} ${inv.time || ''}</div>
                <div>Customer: ${Utils.escapeHtml(inv.customer_name)}</div>
                <div class="double-divider"></div>

                <table>
                    <thead>
                        <tr class="bold"><td>Item</td><td class="text-end">Qty</td><td class="text-end">Total</td></tr>
                    </thead>
                    <tbody>
                        ${inv.items.map(item => `
                            <tr>
                                <td>${Utils.escapeHtml(item.description)}</td>
                                <td class="text-end">${item.quantity}</td>
                                <td class="text-end">${item.line_total.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="divider"></div>
                <table>
                    <tr><td>Subtotal:</td><td class="text-end">${inv.subtotal.toFixed(2)}</td></tr>
                    ${inv.discount_amount > 0 ? `<tr><td>Discount:</td><td class="text-end">-${inv.discount_amount.toFixed(2)}</td></tr>` : ''}
                    ${inv.tax_amount > 0 ? `<tr><td>Tax:</td><td class="text-end">+${inv.tax_amount.toFixed(2)}</td></tr>` : ''}
                    <tr class="bold"><td>TOTAL (${inv.currency}):</td><td class="text-end">${inv.total_amount.toFixed(2)}</td></tr>
                    <tr><td>Paid:</td><td class="text-end">${inv.paid_amount.toFixed(2)}</td></tr>
                    <tr class="bold"><td>Balance:</td><td class="text-end">${inv.balance_amount.toFixed(2)}</td></tr>
                </table>

                <div class="divider"></div>
                <div class="center">${Utils.escapeHtml(comp?.invoice_footer || 'Thank you for your business!')}</div>
                <div class="center bold" style="margin-top: 4px;">*** POWERED BY RMS ***</div>
            </body>
            </html>
        `;
    },

    openPaymentModal(invoiceId) {
        document.getElementById('paymentForm').reset();
        document.getElementById('paymentInvoiceId').value = invoiceId;
        document.getElementById('payDateInput').value = new Date().toISOString().split('T')[0];

        const modalEl = document.getElementById('paymentModal');
        this.paymentModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.paymentModalInstance.show();
    },

    async handleSavePayment(e) {
        e.preventDefault();
        const invoiceId = parseInt(document.getElementById('paymentInvoiceId').value);
        const amount = parseFloat(document.getElementById('payAmountInput').value);
        const date = document.getElementById('payDateInput').value;
        const method = document.getElementById('payMethodSelect').value;
        const ref = document.getElementById('payRefInput').value.trim();

        try {
            await window.electronAPI.invoice.addPayment(invoiceId, {
                amount,
                date,
                payment_method: method,
                reference: ref
            });

            UI.showToast('Payment received and added to invoice.', 'success');
            if (this.paymentModalInstance) this.paymentModalInstance.hide();
            await this.loadInvoicesList();
        } catch (err) {
            console.error('Error adding payment:', err);
            UI.showToast(err.message || 'Failed to record payment.', 'error');
        }
    },

    debounceTimer: null,
    debounce(fn, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(fn, delay);
    }
};
