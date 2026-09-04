// ============================================
// RMS - Staff Performance Controller
// ============================================

window.PerformanceModule = {
    currentMonth: null,
    departments: [],

    async init() {
        console.log('Initializing Performance Module...');
        const now = new Date();
        this.currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        const monthInput = document.getElementById('perfMonthFilter');
        if (monthInput) {
            monthInput.value = this.currentMonth;
            monthInput.addEventListener('change', (e) => {
                this.currentMonth = e.target.value;
                this.loadPerformance();
            });
        }

        const deptFilter = document.getElementById('perfDeptFilter');
        if (deptFilter) {
            deptFilter.addEventListener('change', () => this.loadPerformance());
        }

        const btnRefresh = document.getElementById('btnRefreshPerf');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.loadPerformance());
        }

        await this.loadDependencies();
        await this.loadPerformance();
    },

    async loadDependencies() {
        try {
            this.departments = await window.electronAPI.staff.getDepartments();
            const deptFilter = document.getElementById('perfDeptFilter');
            if (deptFilter) {
                deptFilter.innerHTML = '<option value="">All Departments</option>' + 
                    this.departments.map(d => `<option value="${d.id}">${Utils.escapeHtml(d.department_name)}</option>`).join('');
            }
        } catch (err) {
            console.error('Error loading performance dependencies:', err);
        }
    },

    async loadPerformance() {
        const tbody = document.getElementById('performanceTableBody');
        if (!tbody) return;

        const deptId = document.getElementById('perfDeptFilter')?.value || '';

        try {
            const staffList = await window.electronAPI.staff.getAll({
                status: 'active',
                department_id: deptId
            });

            if (!staffList || staffList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No staff found for evaluation.</td></tr>';
                return;
            }

            const attendanceRows = await window.electronAPI.attendance.getAttendance({});
            // Filter attendance by currentMonth
            const monthAtt = attendanceRows.filter(a => a.date && a.date.startsWith(this.currentMonth));

            // Calculate KPIs per staff
            const rows = staffList.map(s => {
                const sAtt = monthAtt.filter(a => a.staff_id === s.id);
                const totalRecordedDays = sAtt.length || 1;
                const presentDays = sAtt.filter(a => a.status === 'present').length;
                const absentDays = sAtt.filter(a => a.status === 'absent').length;
                const lateDays = sAtt.filter(a => a.status === 'late').length;
                const halfDays = sAtt.filter(a => a.status === 'half_day').length;
                const otHours = sAtt.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0);

                const attPct = totalRecordedDays > 0 ? Math.round(((presentDays + halfDays * 0.5) / Math.max(1, totalRecordedDays)) * 100) : 100;
                
                // Score = 100 - (absent * 5) - (late * 2) + (ot * 1)
                let score = Math.max(0, Math.min(100, 100 - (absentDays * 5) - (lateDays * 2) + Math.min(10, otHours * 0.5)));
                score = Math.round(score);

                let rating = '<span class="badge bg-success">EXCELLENT</span>';
                if (score < 60) rating = '<span class="badge bg-danger">NEEDS IMPROVEMENT</span>';
                else if (score < 80) rating = '<span class="badge bg-warning text-dark">AVERAGE</span>';
                else if (score < 90) rating = '<span class="badge bg-info text-dark">GOOD</span>';

                return `
                    <tr>
                        <td><div class="fw-bold">${Utils.escapeHtml(s.full_name)}</div><small class="text-muted">${s.employee_code}</small></td>
                        <td>${Utils.escapeHtml(s.department_name || '—')}</td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <div class="progress flex-grow-1" style="height: 8px;">
                                    <div class="progress-bar ${attPct >= 80 ? 'bg-success' : 'bg-warning'}" style="width: ${attPct}%"></div>
                                </div>
                                <span class="fw-bold fs-6">${attPct}%</span>
                            </div>
                        </td>
                        <td><span class="text-success fw-bold">${presentDays}</span> / <span class="text-danger fw-bold">${absentDays}</span></td>
                        <td>${lateDays > 0 ? `<span class="badge bg-warning text-dark">${lateDays} Days</span>` : '<span class="text-muted">0</span>'}</td>
                        <td><span class="fw-bold text-primary">${otHours.toFixed(1)} Hrs</span></td>
                        <td><strong class="fs-5">${score} / 100</strong></td>
                        <td>${rating}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = rows.join('');
        } catch (err) {
            console.error('Error calculating performance:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Failed to calculate performance.</td></tr>';
        }
    }
};
