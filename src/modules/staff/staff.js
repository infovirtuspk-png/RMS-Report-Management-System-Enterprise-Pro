// ============================================
// RMS - Staff Module Controller
// ============================================

window.StaffModule = {
    modalInstance: null,
    detailModalInstance: null,
    departments: [],
    designations: [],

    async init() {
        console.log('Initializing Staff Module...');
        this.bindEvents();
        await this.loadDependencies();
        await this.loadStaffList();
    },

    bindEvents() {
        const btnAdd = document.getElementById('btnAddStaff');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        const form = document.getElementById('staffForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveStaff(e));
        }

        const searchInput = document.getElementById('staffSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.debounce(() => this.loadStaffList(), 300));
        }

        const deptFilter = document.getElementById('staffDepartmentFilter');
        if (deptFilter) {
            deptFilter.addEventListener('change', () => this.loadStaffList());
        }

        const statusFilter = document.getElementById('staffStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.loadStaffList());
        }

        const btnReset = document.getElementById('btnResetStaffFilters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (deptFilter) deptFilter.value = '';
                if (statusFilter) statusFilter.value = '';
                this.loadStaffList();
            });
        }
    },

    async loadDependencies() {
        try {
            this.departments = await window.electronAPI.staff.getDepartments();
            this.designations = await window.electronAPI.staff.getDesignations();
            this.populateSelects();
        } catch (err) {
            console.error('Error loading staff dependencies:', err);
        }
    },

    populateSelects() {
        const deptFilter = document.getElementById('staffDepartmentFilter');
        const deptSelect = document.getElementById('staffDeptSelect');
        if (deptFilter) {
            deptFilter.innerHTML = '<option value="">All Departments</option>' + 
                this.departments.map(d => `<option value="${d.id}">${Utils.escapeHtml(d.department_name)}</option>`).join('');
        }
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">Select Department</option>' + 
                this.departments.map(d => `<option value="${d.id}">${Utils.escapeHtml(d.department_name)}</option>`).join('');
        }

        const desigSelect = document.getElementById('staffDesigSelect');
        if (desigSelect) {
            desigSelect.innerHTML = '<option value="">Select Designation</option>' + 
                this.designations.map(d => `<option value="${d.id}">${Utils.escapeHtml(d.designation_name)}</option>`).join('');
        }
    },

    async loadStaffList() {
        const tbody = document.getElementById('staffTableBody');
        if (!tbody) return;

        const filters = {
            search: document.getElementById('staffSearchInput')?.value || '',
            department_id: document.getElementById('staffDepartmentFilter')?.value || '',
            status: document.getElementById('staffStatusFilter')?.value || ''
        };

        try {
            const rows = await window.electronAPI.staff.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-5 text-muted">
                            <i class="fas fa-users fa-3x mb-3 text-secondary"></i>
                            <p>No staff records found.</p>
                            <button class="btn btn-sm btn-primary" onclick="StaffModule.openAddModal()">Register First Employee</button>
                        </td>
                    </tr>
                `;
                this.updateStats([]);
                return;
            }

            tbody.innerHTML = rows.map(s => `
                <tr>
                    <td><strong class="text-primary">${Utils.escapeHtml(s.employee_code)}</strong></td>
                    <td>
                        <div class="fw-bold">${Utils.escapeHtml(s.full_name)}</div>
                        <small class="text-muted">${Utils.escapeHtml(s.email || '')}</small>
                    </td>
                    <td>${Utils.escapeHtml(s.department_name || '—')}</td>
                    <td>${Utils.escapeHtml(s.designation_name || '—')}</td>
                    <td>${Utils.escapeHtml(s.calling_number || '—')}</td>
                    <td class="fw-bold text-success">${Utils.formatCurrency(s.basic_salary)}</td>
                    <td>
                        <span class="badge ${s.status === 'active' ? 'bg-success' : 'bg-secondary'}">${s.status.toUpperCase()}</span>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline me-1" onclick="StaffModule.viewStaffDetail(${s.id})" title="View Details"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-outline me-1" onclick="StaffModule.openEditModal(${s.id})" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline text-danger" onclick="StaffModule.handleDeleteStaff(${s.id})" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');

            this.updateStats(rows);
        } catch (err) {
            console.error('Error fetching staff records:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load staff list.</td></tr>';
        }
    },

    updateStats(rows) {
        let active = 0;
        let expiring = 0;
        const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        rows.forEach(r => {
            if (r.status === 'active') active++;
            if ((r.visa_expiry_date && r.visa_expiry_date <= in30Days) ||
                (r.passport_expiry_date && r.passport_expiry_date <= in30Days)) {
                expiring++;
            }
        });

        const statTotal = document.getElementById('statTotalStaff');
        const statActive = document.getElementById('statActiveStaff');
        const statExpiring = document.getElementById('statExpiringDocs');

        if (statTotal) statTotal.textContent = rows.length.toString();
        if (statActive) statActive.textContent = active.toString();
        if (statExpiring) statExpiring.textContent = expiring.toString();
    },

    openAddModal() {
        document.getElementById('staffForm').reset();
        document.getElementById('staffEditId').value = '';
        document.getElementById('staffModalTitle').textContent = 'Register New Employee';
        document.getElementById('staffJoiningDate').value = new Date().toISOString().split('T')[0];

        // Trigger first tab
        const firstTab = document.querySelector('#staffTabs button[data-bs-target="#tabPersonal"]');
        if (firstTab) bootstrap.Tab.getOrCreateInstance(firstTab).show();

        const modalEl = document.getElementById('staffModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async openEditModal(id) {
        try {
            const staff = await window.electronAPI.staff.getById(id);
            if (!staff) return;

            document.getElementById('staffEditId').value = staff.id;
            document.getElementById('staffModalTitle').textContent = `Edit Employee (${staff.full_name} - ${staff.employee_code})`;

            document.getElementById('staffEmpCode').value = staff.employee_code || '';
            document.getElementById('staffFullName').value = staff.full_name || '';
            document.getElementById('staffFatherName').value = staff.fathers_name || '';
            document.getElementById('staffMotherName').value = staff.mothers_name || '';
            document.getElementById('staffGender').value = staff.gender || 'Male';
            document.getElementById('staffDob').value = staff.date_of_birth || '';
            document.getElementById('staffMaritalStatus').value = staff.marital_status || 'Single';
            document.getElementById('staffNationality').value = staff.nationality || '';
            document.getElementById('staffBloodGroup').value = staff.blood_group || '';
            document.getElementById('staffReligion').value = staff.religion || '';
            document.getElementById('staffStatusSelect').value = staff.status || 'active';

            document.getElementById('staffPhone').value = staff.calling_number || '';
            document.getElementById('staffWhatsapp').value = staff.whatsapp_number || '';
            document.getElementById('staffAltPhone').value = staff.alternate_number || '';
            document.getElementById('staffEmail').value = staff.email || '';
            document.getElementById('staffCity').value = staff.city || '';
            document.getElementById('staffAddress').value = staff.current_address || '';
            document.getElementById('staffPermAddress').value = staff.permanent_address || '';

            document.getElementById('staffNationalId').value = staff.national_id_number || '';
            document.getElementById('staffIdIssue').value = staff.national_id_issue_date || '';
            document.getElementById('staffIdExpiry').value = staff.national_id_expiry_date || '';
            document.getElementById('staffLabourCard').value = staff.labour_card_number || '';
            document.getElementById('staffWorkPermit').value = staff.work_permit_number || '';

            document.getElementById('staffPassportNum').value = staff.passport_number || '';
            document.getElementById('staffPassportIssue').value = staff.passport_issue_date || '';
            document.getElementById('staffPassportExpiry').value = staff.passport_expiry_date || '';
            document.getElementById('staffVisaNum').value = staff.visa_number || '';
            document.getElementById('staffVisaExpiry').value = staff.visa_expiry_date || '';

            document.getElementById('staffDeptSelect').value = staff.department_id || '';
            document.getElementById('staffDesigSelect').value = staff.designation_id || '';
            document.getElementById('staffJoiningDate').value = staff.joining_date || '';
            document.getElementById('staffEmpType').value = staff.employment_type || 'Full Time';
            document.getElementById('staffContractType').value = staff.contract_type || 'Permanent';

            document.getElementById('staffBasicSalary').value = staff.basic_salary || 0;
            document.getElementById('staffAllowance').value = staff.allowance || 0;
            document.getElementById('staffPaymentMethod').value = staff.salary_payment_method || 'Bank Transfer';
            document.getElementById('staffBankName').value = staff.bank_name || '';
            document.getElementById('staffAccountNum').value = staff.account_number || '';

            // Trigger first tab
            const firstTab = document.querySelector('#staffTabs button[data-bs-target="#tabPersonal"]');
            if (firstTab) bootstrap.Tab.getOrCreateInstance(firstTab).show();

            const modalEl = document.getElementById('staffModal');
            this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            this.modalInstance.show();
        } catch (err) {
            console.error('Error opening staff edit modal:', err);
        }
    },

    async handleSaveStaff(e) {
        e.preventDefault();
        const editId = document.getElementById('staffEditId').value;

        const payload = {
            employee_code: document.getElementById('staffEmpCode').value.trim(),
            full_name: document.getElementById('staffFullName').value.trim(),
            fathers_name: document.getElementById('staffFatherName').value.trim(),
            mothers_name: document.getElementById('staffMotherName').value.trim(),
            gender: document.getElementById('staffGender').value,
            date_of_birth: document.getElementById('staffDob').value || null,
            marital_status: document.getElementById('staffMaritalStatus').value,
            nationality: document.getElementById('staffNationality').value.trim(),
            blood_group: document.getElementById('staffBloodGroup').value.trim(),
            religion: document.getElementById('staffReligion').value.trim(),
            status: document.getElementById('staffStatusSelect').value,

            calling_number: document.getElementById('staffPhone').value.trim(),
            whatsapp_number: document.getElementById('staffWhatsapp').value.trim(),
            alternate_number: document.getElementById('staffAltPhone').value.trim(),
            email: document.getElementById('staffEmail').value.trim(),
            city: document.getElementById('staffCity').value.trim(),
            current_address: document.getElementById('staffAddress').value.trim(),
            permanent_address: document.getElementById('staffPermAddress').value.trim(),

            national_id_number: document.getElementById('staffNationalId').value.trim(),
            national_id_issue_date: document.getElementById('staffIdIssue').value || null,
            national_id_expiry_date: document.getElementById('staffIdExpiry').value || null,
            labour_card_number: document.getElementById('staffLabourCard').value.trim(),
            work_permit_number: document.getElementById('staffWorkPermit').value.trim(),

            passport_number: document.getElementById('staffPassportNum').value.trim(),
            passport_issue_date: document.getElementById('staffPassportIssue').value || null,
            passport_expiry_date: document.getElementById('staffPassportExpiry').value || null,
            visa_number: document.getElementById('staffVisaNum').value.trim(),
            visa_expiry_date: document.getElementById('staffVisaExpiry').value || null,

            department_id: document.getElementById('staffDeptSelect').value || null,
            designation_id: document.getElementById('staffDesigSelect').value || null,
            joining_date: document.getElementById('staffJoiningDate').value || null,
            employment_type: document.getElementById('staffEmpType').value,
            contract_type: document.getElementById('staffContractType').value,

            basic_salary: parseFloat(document.getElementById('staffBasicSalary').value) || 0,
            allowance: parseFloat(document.getElementById('staffAllowance').value) || 0,
            salary_payment_method: document.getElementById('staffPaymentMethod').value,
            bank_name: document.getElementById('staffBankName').value.trim(),
            account_number: document.getElementById('staffAccountNum').value.trim()
        };

        try {
            if (editId) {
                await window.electronAPI.staff.update(parseInt(editId), payload);
                UI.showToast('Employee updated successfully.', 'success');
            } else {
                await window.electronAPI.staff.create(payload);
                UI.showToast('Employee registered successfully.', 'success');
            }

            if (this.modalInstance) this.modalInstance.hide();
            await this.loadStaffList();
        } catch (err) {
            console.error('Error saving staff member:', err);
            UI.showToast(err.message || 'Failed to save staff record.', 'error');
        }
    },

    async handleDeleteStaff(id) {
        if (!confirm('Are you sure you want to remove this staff member?')) return;
        try {
            await window.electronAPI.staff.delete(id);
            UI.showToast('Employee deleted.', 'info');
            await this.loadStaffList();
        } catch (err) {
            console.error('Error deleting staff:', err);
            UI.showToast('Failed to delete staff member.', 'error');
        }
    },

    async viewStaffDetail(id) {
        try {
            const staff = await window.electronAPI.staff.getById(id);
            if (!staff) return;

            const content = document.getElementById('staffDetailContent');
            content.innerHTML = `
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title"><i class="fas fa-id-badge me-2"></i> ${Utils.escapeHtml(staff.full_name)} (${Utils.escapeHtml(staff.employee_code)})</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row g-3">
                        <div class="col-md-6"><strong>Department:</strong> ${Utils.escapeHtml(staff.department_name || '—')}</div>
                        <div class="col-md-6"><strong>Designation:</strong> ${Utils.escapeHtml(staff.designation_name || '—')}</div>
                        <div class="col-md-6"><strong>Phone:</strong> ${Utils.escapeHtml(staff.calling_number || '—')}</div>
                        <div class="col-md-6"><strong>Email:</strong> ${Utils.escapeHtml(staff.email || '—')}</div>
                        <div class="col-md-6"><strong>Basic Salary:</strong> ${Utils.formatCurrency(staff.basic_salary)}</div>
                        <div class="col-md-6"><strong>Joining Date:</strong> ${Utils.formatDate(staff.joining_date)}</div>
                        <div class="col-md-6"><strong>Passport Expiry:</strong> ${staff.passport_expiry_date || '—'}</div>
                        <div class="col-md-6"><strong>Visa Expiry:</strong> ${staff.visa_expiry_date || '—'}</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="RMSAppInstance.navigateTo('reports')"><i class="fas fa-file-alt"></i> View Full 360 Report</button>
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            `;

            const modalEl = document.getElementById('staffDetailModal');
            this.detailModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            this.detailModalInstance.show();
        } catch (err) {
            console.error('Error viewing staff detail:', err);
        }
    },

    debounceTimer: null,
    debounce(fn, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(fn, delay);
    }
};
