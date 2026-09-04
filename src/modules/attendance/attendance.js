// ============================================
// RMS - Attendance Module Controller
// ============================================

window.AttendanceModule = {
    currentDate: null,
    staffList: [],
    attendanceRecords: [],

    async init() {
        console.log('Initializing Attendance Module...');
        this.currentDate = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('attendanceDatePicker');
        if (dateInput) {
            dateInput.value = this.currentDate;
            dateInput.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                this.loadDailyAttendance();
            });
        }

        this.bindEvents();
        await this.loadDailyAttendance();
    },

    bindEvents() {
        const btnMarkAll = document.getElementById('btnMarkAllPresent');
        if (btnMarkAll) {
            btnMarkAll.addEventListener('click', () => this.markAllPresent());
        }

        const btnSave = document.getElementById('btnSaveAttendance');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveAllAttendance());
        }
    },

    async loadDailyAttendance() {
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;

        try {
            this.staffList = await window.electronAPI.staff.getAll({ status: 'active' });
            this.attendanceRecords = await window.electronAPI.attendance.getAttendance({ date: this.currentDate });

            if (!this.staffList || this.staffList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted">No active staff found. Please add employees first.</td></tr>';
                return;
            }

            // Map existing records by staff_id
            const recordMap = {};
            this.attendanceRecords.forEach(r => {
                recordMap[r.staff_id] = r;
            });

            tbody.innerHTML = this.staffList.map(s => {
                const rec = recordMap[s.id] || {};
                const status = rec.status || 'present';
                const checkIn = rec.check_in ? rec.check_in.substring(11, 16) : '09:00';
                const checkOut = rec.check_out ? rec.check_out.substring(11, 16) : '18:00';
                const totalHours = rec.total_hours !== undefined ? rec.total_hours : 8;
                const otHours = rec.overtime_hours !== undefined ? rec.overtime_hours : 0;
                const notes = rec.notes || '';

                return `
                    <tr data-staff-id="${s.id}">
                        <td><strong class="text-primary">${Utils.escapeHtml(s.employee_code)}</strong></td>
                        <td><div class="fw-bold">${Utils.escapeHtml(s.full_name)}</div></td>
                        <td>${Utils.escapeHtml(s.department_name || '—')}</td>
                        <td>
                            <select class="form-select form-select-sm att-status-select" onchange="AttendanceModule.onStatusChange(this, ${s.id})">
                                <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
                                <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
                                <option value="late" ${status === 'late' ? 'selected' : ''}>Late</option>
                                <option value="half_day" ${status === 'half_day' ? 'selected' : ''}>Half Day</option>
                                <option value="leave" ${status === 'leave' ? 'selected' : ''}>Leave</option>
                                <option value="holiday" ${status === 'holiday' ? 'selected' : ''}>Holiday</option>
                                <option value="off_day" ${status === 'off_day' ? 'selected' : ''}>Off Day</option>
                            </select>
                        </td>
                        <td><input type="time" class="form-control form-control-sm att-check-in" value="${checkIn}"></td>
                        <td><input type="time" class="form-control form-control-sm att-check-out" value="${checkOut}"></td>
                        <td><input type="number" step="0.5" min="0" max="24" class="form-control form-control-sm att-total-hours" value="${totalHours}" style="width: 80px;"></td>
                        <td><input type="number" step="0.5" min="0" max="12" class="form-control form-control-sm att-ot-hours" value="${otHours}" style="width: 80px;"></td>
                        <td><input type="text" class="form-control form-control-sm att-notes" placeholder="Note" value="${Utils.escapeHtml(notes)}"></td>
                    </tr>
                `;
            }).join('');

            this.updateSummaryCounts();
        } catch (err) {
            console.error('Error loading attendance roster:', err);
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-danger">Failed to load attendance sheet.</td></tr>';
        }
    },

    onStatusChange(selectEl, staffId) {
        const row = selectEl.closest('tr');
        const status = selectEl.value;
        const totalHoursInput = row.querySelector('.att-total-hours');
        if (status === 'present' || status === 'late') {
            if (totalHoursInput) totalHoursInput.value = '8';
        } else if (status === 'half_day') {
            if (totalHoursInput) totalHoursInput.value = '4';
        } else {
            if (totalHoursInput) totalHoursInput.value = '0';
        }
        this.updateSummaryCounts();
    },

    markAllPresent() {
        const selects = document.querySelectorAll('.att-status-select');
        selects.forEach(sel => {
            sel.value = 'present';
            this.onStatusChange(sel);
        });
        UI.showToast('Marked all employees as present.', 'info');
    },

    updateSummaryCounts() {
        let present = 0, absent = 0, late = 0, leave = 0;
        const selects = document.querySelectorAll('.att-status-select');
        selects.forEach(sel => {
            if (sel.value === 'present') present++;
            else if (sel.value === 'absent') absent++;
            else if (sel.value === 'late') late++;
            else if (sel.value === 'leave') leave++;
        });

        const elPresent = document.getElementById('attCountPresent');
        const elAbsent = document.getElementById('attCountAbsent');
        const elLate = document.getElementById('attCountLate');
        const elLeave = document.getElementById('attCountLeave');

        if (elPresent) elPresent.textContent = present.toString();
        if (elAbsent) elAbsent.textContent = absent.toString();
        if (elLate) elLate.textContent = late.toString();
        if (elLeave) elLeave.textContent = leave.toString();
    },

    async saveAllAttendance() {
        const rows = document.querySelectorAll('#attendanceTableBody tr[data-staff-id]');
        const entries = [];

        rows.forEach(row => {
            const staffId = parseInt(row.getAttribute('data-staff-id'));
            const status = row.querySelector('.att-status-select').value;
            const checkInTime = row.querySelector('.att-check-in').value;
            const checkOutTime = row.querySelector('.att-check-out').value;
            const totalHours = parseFloat(row.querySelector('.att-total-hours').value) || 0;
            const otHours = parseFloat(row.querySelector('.att-ot-hours').value) || 0;
            const notes = row.querySelector('.att-notes').value.trim();

            entries.push({
                staff_id: staffId,
                date: this.currentDate,
                check_in: checkInTime ? `${this.currentDate}T${checkInTime}:00` : null,
                check_out: checkOutTime ? `${this.currentDate}T${checkOutTime}:00` : null,
                status,
                total_hours: totalHours,
                overtime_hours: otHours,
                notes
            });
        });

        try {
            await window.electronAPI.attendance.bulkMark(entries);
            UI.showToast('Daily attendance saved successfully.', 'success');
            await this.loadDailyAttendance();
        } catch (err) {
            console.error('Error saving attendance:', err);
            UI.showToast(err.message || 'Failed to save attendance.', 'error');
        }
    }
};
