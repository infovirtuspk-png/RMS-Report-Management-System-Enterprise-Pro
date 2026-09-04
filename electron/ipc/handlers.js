const databaseService = require('../services/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, dialog, BrowserWindow } = require('electron');

// Helper function to generate unique alphanumeric IDs
const generateId = (prefix) => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

// Helper function to generate sequential formatted numbers
const generateSequentialNumber = async (tableName, numberColumn, prefix, year) => {
    const y = year || new Date().getFullYear();
    const pattern = `${prefix}-${y}-%`;
    const res = await databaseService.get(
        `SELECT ${numberColumn} FROM ${tableName} WHERE ${numberColumn} LIKE ? ORDER BY id DESC LIMIT 1`,
        [pattern]
    );
    let nextSeq = 1;
    if (res && res[numberColumn]) {
        const parts = res[numberColumn].split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
            nextSeq = lastNum + 1;
        }
    }
    return `${prefix}-${y}-${nextSeq.toString().padStart(6, '0')}`;
};

// Helper function for audit logging
const logAudit = async (userId, action, module, recordId, recordType, description, oldValues, newValues) => {
    try {
        let validUserId = null;
        if (userId) {
            const userExists = await databaseService.get('SELECT id FROM users WHERE id = ?', [userId]);
            if (userExists) validUserId = userExists.id;
        }
        await databaseService.run(`
            INSERT INTO audit_logs (user_id, action, module, record_id, record_type, description, old_values, new_values)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            validUserId,
            action,
            module,
            recordId || null,
            recordType || null,
            description || '',
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null
        ]);
    } catch (err) {
        console.error('Error logging audit:', err);
    }
};

const handlers = {};

// ============================================
// DATABASE & HEALTH HANDLERS
// ============================================
handlers['database:query'] = async (event, sql, params = []) => {
    return await databaseService.query(sql, params);
};

handlers['database:execute'] = async (event, sql, params = []) => {
    return await databaseService.run(sql, params);
};

handlers['database:transaction'] = async (event, operations) => {
    return await databaseService.transaction(operations);
};

handlers['database:health'] = async () => {
    return await databaseService.getHealth();
};

// ============================================
// AUTHENTICATION & USERS
// ============================================
let currentSessionUser = null;

handlers['auth:login'] = async (event, username, password) => {
    const user = await databaseService.get(
        `SELECT u.*, r.role_name 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.username = ? AND u.status = 'active'`,
        [username]
    );

    if (!user) {
        throw new Error('Invalid username or password');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        await databaseService.run(
            'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?',
            [user.id]
        );
        throw new Error('Invalid username or password');
    }

    await databaseService.run(
        'UPDATE users SET failed_login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
    );

    await logAudit(user.id, 'LOGIN', 'AUTH', user.id, 'user', `User '${user.username}' logged in.`);

    const { password_hash, ...userData } = user;
    currentSessionUser = userData;
    return userData;
};

handlers['auth:logout'] = async () => {
    if (currentSessionUser) {
        await logAudit(currentSessionUser.id, 'LOGOUT', 'AUTH', currentSessionUser.id, 'user', `User '${currentSessionUser.username}' logged out.`);
        currentSessionUser = null;
    }
    return { success: true };
};

handlers['auth:getCurrentUser'] = async () => {
    return currentSessionUser;
};

handlers['auth:checkAuth'] = async () => {
    const userCount = await databaseService.get('SELECT COUNT(*) as count FROM users');
    const companyCount = await databaseService.get('SELECT COUNT(*) as count FROM companies');
    return {
        hasUsers: userCount && userCount.count > 0,
        hasCompany: companyCount && companyCount.count > 0,
        authenticated: !!currentSessionUser,
        user: currentSessionUser
    };
};

handlers['auth:changePassword'] = async (event, userId, oldPassword, newPassword) => {
    const user = await databaseService.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');

    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
        throw new Error('Current password is incorrect');
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await databaseService.run(
        'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, userId]
    );

    await logAudit(userId, 'CHANGE_PASSWORD', 'AUTH', userId, 'user', 'Password changed.');
    return { success: true };
};

handlers['auth:registerAdmin'] = async (event, adminData) => {
    const existing = await databaseService.get('SELECT id FROM users WHERE username = ?', [adminData.username]);
    if (existing) throw new Error('Username already exists');

    const hashedPassword = bcrypt.hashSync(adminData.password, 10);
    const superAdminRole = await databaseService.get('SELECT id FROM roles WHERE role_name = ?', ['Super Admin']);
    const roleId = superAdminRole ? superAdminRole.id : 1;

    const res = await databaseService.run(`
        INSERT INTO users (username, password_hash, full_name, email, phone, role_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [
        adminData.username,
        hashedPassword,
        adminData.full_name || 'Administrator',
        adminData.email || '',
        adminData.phone || '',
        roleId
    ]);

    const createdUser = await databaseService.get('SELECT id, username, full_name, email, phone, role_id, status FROM users WHERE id = ?', [res.lastInsertRowid]);
    currentSessionUser = createdUser;
    await logAudit(createdUser.id, 'CREATE', 'USERS', createdUser.id, 'user', 'Initial Administrator account created.');
    return createdUser;
};

handlers['user:updateProfile'] = async (event, profileData) => {
    if (!currentSessionUser) throw new Error('Not authenticated');
    const { full_name, email, phone } = profileData;
    await databaseService.run(`
        UPDATE users 
        SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [full_name || '', email || '', phone || '', currentSessionUser.id]);

    const updated = await databaseService.get('SELECT id, username, full_name, email, phone, role_id, status FROM users WHERE id = ?', [currentSessionUser.id]);
    currentSessionUser = updated;
    await logAudit(currentSessionUser.id, 'UPDATE', 'USERS', currentSessionUser.id, 'user', 'Profile updated.', null, profileData);
    return updated;
};

handlers['user:getAll'] = async () => {
    return await databaseService.query(`
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role_id, u.status, u.last_login, r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.id ASC
    `);
};

handlers['user:create'] = async (event, userData) => {
    const existing = await databaseService.get('SELECT id FROM users WHERE username = ?', [userData.username]);
    if (existing) throw new Error('Username already exists');

    const hashedPassword = bcrypt.hashSync(userData.password || '123456', 10);
    const res = await databaseService.run(`
        INSERT INTO users (username, password_hash, full_name, email, phone, role_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        userData.username,
        hashedPassword,
        userData.full_name || '',
        userData.email || '',
        userData.phone || '',
        userData.role_id || 2,
        userData.status || 'active'
    ]);

    await logAudit(currentSessionUser?.id, 'CREATE', 'USERS', res.lastInsertRowid, 'user', `User '${userData.username}' created.`);
    return await databaseService.get('SELECT id, username, full_name, email, phone, role_id, status FROM users WHERE id = ?', [res.lastInsertRowid]);
};

handlers['user:update'] = async (event, userId, userData) => {
    const user = await databaseService.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');

    let sql = 'UPDATE users SET full_name = ?, email = ?, phone = ?, role_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [userData.full_name || '', userData.email || '', userData.phone || '', userData.role_id || user.role_id, userData.status || user.status];

    if (userData.password && userData.password.trim()) {
        sql += ', password_hash = ?';
        params.push(bcrypt.hashSync(userData.password.trim(), 10));
    }

    sql += ' WHERE id = ?';
    params.push(userId);

    await databaseService.run(sql, params);
    await logAudit(currentSessionUser?.id, 'UPDATE', 'USERS', userId, 'user', `User '${user.username}' updated.`);
    return await databaseService.get('SELECT id, username, full_name, email, phone, role_id, status FROM users WHERE id = ?', [userId]);
};

handlers['user:delete'] = async (event, userId) => {
    if (currentSessionUser && currentSessionUser.id === userId) {
        throw new Error('Cannot delete your own active account.');
    }
    await databaseService.run('DELETE FROM users WHERE id = ?', [userId]);
    await logAudit(currentSessionUser?.id, 'DELETE', 'USERS', userId, 'user', `User id ${userId} deleted.`);
    return { success: true };
};

handlers['app:getLockInfo'] = async () => {
    try {
        const company = await databaseService.get('SELECT company_name, trade_name, company_logo_path, company_logo_path as logo_path FROM companies LIMIT 1');
        const user = currentSessionUser || await databaseService.get('SELECT id, username, full_name, role_id FROM users WHERE status = "active" LIMIT 1');
        const lastPageSetting = await databaseService.get('SELECT setting_value FROM settings WHERE setting_key = "app_last_screen" LIMIT 1');
        return {
            company: company || { company_name: 'RMS' },
            user: user || { username: 'admin', full_name: 'Administrator' },
            lastPage: lastPageSetting ? lastPageSetting.setting_value : 'dashboard'
        };
    } catch (err) {
        console.error('Error in app:getLockInfo:', err);
        return {
            company: { company_name: 'RMS' },
            user: currentSessionUser || { username: 'admin', full_name: 'Administrator' },
            lastPage: 'dashboard'
        };
    }
};

handlers['app:lock'] = async (event, lastPage = 'dashboard') => {
    try {
        await databaseService.run(
            'INSERT INTO settings (setting_key, setting_value) VALUES ("app_is_locked", "1") ON CONFLICT(setting_key) DO UPDATE SET setting_value = "1"'
        );
        if (lastPage) {
            await databaseService.run(
                'INSERT INTO settings (setting_key, setting_value) VALUES ("app_last_screen", ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = ?',
                [lastPage, lastPage]
            );
        }
    } catch (err) {
        console.error('Error saving lock state in database:', err);
    }
    return { success: true };
};

handlers['app:unlock'] = async (event, passwordOrPin) => {
    try {
        const rawInput = (passwordOrPin || '').toString();
        const input = rawInput.trim();
        if (!input) return { success: false, message: 'Password or PIN is required.' };

        let isMatch = false;

        // 1. Check custom quick Lock PIN from settings if configured
        try {
            const pinSetting = await databaseService.get('SELECT setting_value FROM settings WHERE setting_key = "app_lock_pin" LIMIT 1')
                || await databaseService.get('SELECT setting_value FROM app_settings WHERE setting_key = "app_lock_pin" LIMIT 1');
            if (pinSetting && pinSetting.setting_value && pinSetting.setting_value.trim() === input) {
                isMatch = true;
            }
        } catch (_) {}

        // 2. Check current active session user password
        if (!isMatch && currentSessionUser && currentSessionUser.id) {
            try {
                const user = await databaseService.get('SELECT * FROM users WHERE id = ?', [currentSessionUser.id]);
                if (user && user.password_hash) {
                    if (await bcrypt.compare(input, user.password_hash) || await bcrypt.compare(rawInput, user.password_hash)) {
                        isMatch = true;
                    }
                }
            } catch (_) {}
        }

        // 3. Check against all registered users in database
        if (!isMatch) {
            try {
                const users = await databaseService.query('SELECT * FROM users');
                for (const u of users) {
                    if (u.password_hash) {
                        const match = (await bcrypt.compare(input, u.password_hash)) || (await bcrypt.compare(rawInput, u.password_hash));
                        if (match) {
                            currentSessionUser = { id: u.id, username: u.username, full_name: u.full_name, email: u.email, role_id: u.role_id };
                            isMatch = true;
                            break;
                        }
                    }
                }
            } catch (uErr) {
                console.error('Error checking users for unlock:', uErr);
            }
        }

        if (isMatch) {
            try {
                await databaseService.run(
                    'INSERT INTO settings (setting_key, setting_value) VALUES ("app_is_locked", "0") ON CONFLICT(setting_key) DO UPDATE SET setting_value = "0"'
                );
                await databaseService.run(
                    'INSERT INTO app_settings (setting_key, setting_value) VALUES ("app_is_locked", "0") ON CONFLICT(setting_key) DO UPDATE SET setting_value = "0"'
                );
            } catch (_) {}

            let lastPage = 'dashboard';
            try {
                const lastPageSetting = await databaseService.get('SELECT setting_value FROM settings WHERE setting_key = "app_last_screen" LIMIT 1')
                    || await databaseService.get('SELECT setting_value FROM app_settings WHERE setting_key = "app_last_screen" LIMIT 1');
                if (lastPageSetting && lastPageSetting.setting_value) lastPage = lastPageSetting.setting_value;
            } catch (_) {}

            return { success: true, lastPage };
        }

        return { success: false, message: 'Invalid PIN or password.' };
    } catch (err) {
        console.error('Error during unlock verification:', err);
        return { success: false, message: 'Invalid PIN or password.' };
    }
};

// ============================================
// COMPANY & SETTINGS
// ============================================
handlers['company:register'] = async (event, companyData) => {
    const companyId = generateId('CMP');
    const res = await databaseService.run(`
        INSERT INTO companies (
            company_id, company_name, legal_company_name, trade_name, company_type,
            business_activity, registration_number, trade_license_number, tax_vat_number,
            establishment_number, email, phone, whatsapp, alternate_phone, website,
            address, area, city, state_province, country, postal_code, currency,
            currency_symbol, time_zone, company_logo_path, company_stamp_path,
            authorized_person, authorized_person_designation, invoice_prefix, report_prefix,
            financial_year_start, invoice_footer, report_footer, terms_conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        companyId,
        companyData.company_name,
        companyData.legal_company_name || companyData.company_name,
        companyData.trade_name || companyData.company_name,
        companyData.company_type || 'Private Limited',
        companyData.business_activity || 'General Trading',
        companyData.registration_number || '',
        companyData.trade_license_number || '',
        companyData.tax_vat_number || '',
        companyData.establishment_number || '',
        companyData.email || '',
        companyData.phone || '',
        companyData.whatsapp || '',
        companyData.alternate_phone || '',
        companyData.website || '',
        companyData.address || '',
        companyData.area || '',
        companyData.city || '',
        companyData.state_province || '',
        companyData.country || '',
        companyData.postal_code || '',
        companyData.currency || 'AED',
        companyData.currency_symbol || 'AED',
        companyData.time_zone || 'Asia/Dubai',
        companyData.company_logo_path || '',
        companyData.company_stamp_path || '',
        companyData.authorized_person || '',
        companyData.authorized_person_designation || 'Manager',
        companyData.invoice_prefix || 'RMS-INV',
        companyData.report_prefix || 'RMS-REP',
        companyData.financial_year_start || '01-01',
        companyData.invoice_footer || 'Thank you for your business!',
        companyData.report_footer || 'Confidential Business Report - RMS',
        companyData.terms_conditions || 'Payment is due within 30 days.'
    ]);

    // Update base currency in currencies table
    if (companyData.currency) {
        await databaseService.run('UPDATE currencies SET is_base_currency = 0');
        await databaseService.run('UPDATE currencies SET is_base_currency = 1 WHERE currency_code = ?', [companyData.currency]);
    }

    const company = await databaseService.get('SELECT * FROM companies WHERE id = ?', [res.lastInsertRowid]);
    await logAudit(1, 'REGISTER', 'COMPANY', company.id, 'company', `Company '${company.company_name}' registered.`);
    return company;
};

handlers['company:getCompany'] = async () => {
    return await databaseService.get('SELECT * FROM companies ORDER BY id DESC LIMIT 1');
};

handlers['company:updateCompany'] = async (event, companyData) => {
    const current = await databaseService.get('SELECT * FROM companies ORDER BY id DESC LIMIT 1');
    if (!current) {
        return await handlers['company:register'](event, companyData);
    }

    await databaseService.run(`
        UPDATE companies SET
            company_name = ?, legal_company_name = ?, trade_name = ?, company_type = ?,
            business_activity = ?, registration_number = ?, trade_license_number = ?, tax_vat_number = ?,
            establishment_number = ?, email = ?, phone = ?, whatsapp = ?, alternate_phone = ?, website = ?,
            address = ?, area = ?, city = ?, state_province = ?, country = ?, postal_code = ?,
            currency = ?, currency_symbol = ?, time_zone = ?, company_logo_path = ?, company_stamp_path = ?,
            authorized_person = ?, authorized_person_designation = ?, invoice_prefix = ?, report_prefix = ?,
            financial_year_start = ?, invoice_footer = ?, report_footer = ?, terms_conditions = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        companyData.company_name,
        companyData.legal_company_name || companyData.company_name,
        companyData.trade_name || companyData.company_name,
        companyData.company_type || '',
        companyData.business_activity || '',
        companyData.registration_number || '',
        companyData.trade_license_number || '',
        companyData.tax_vat_number || '',
        companyData.establishment_number || '',
        companyData.email || '',
        companyData.phone || '',
        companyData.whatsapp || '',
        companyData.alternate_phone || '',
        companyData.website || '',
        companyData.address || '',
        companyData.area || '',
        companyData.city || '',
        companyData.state_province || '',
        companyData.country || '',
        companyData.postal_code || '',
        companyData.currency || 'AED',
        companyData.currency_symbol || 'AED',
        companyData.time_zone || 'Asia/Dubai',
        companyData.company_logo_path || current.company_logo_path,
        companyData.company_stamp_path || current.company_stamp_path,
        companyData.authorized_person || '',
        companyData.authorized_person_designation || '',
        companyData.invoice_prefix || 'RMS-INV',
        companyData.report_prefix || 'RMS-REP',
        companyData.financial_year_start || '01-01',
        companyData.invoice_footer || '',
        companyData.report_footer || '',
        companyData.terms_conditions || '',
        current.id
    ]);

    await logAudit(currentSessionUser?.id, 'UPDATE', 'COMPANY', current.id, 'company', 'Company profile updated.', current, companyData);
    return await databaseService.get('SELECT * FROM companies WHERE id = ?', [current.id]);
};

// ============================================
// STAFF MANAGEMENT
// ============================================
handlers['staff:getAll'] = async (event, filters = {}) => {
    let sql = `
        SELECT s.*, d.department_name, ds.designation_name
        FROM staff s
        LEFT JOIN staff_departments d ON s.department_id = d.id
        LEFT JOIN staff_designations ds ON s.designation_id = ds.id
        WHERE s.deleted_at IS NULL
    `;
    const params = [];

    if (filters.status) {
        sql += ' AND s.status = ?';
        params.push(filters.status);
    }
    if (filters.department_id) {
        sql += ' AND s.department_id = ?';
        params.push(filters.department_id);
    }
    if (filters.search) {
        sql += ' AND (s.full_name LIKE ? OR s.employee_code LIKE ? OR s.email LIKE ? OR s.calling_number LIKE ?)';
        const q = `%${filters.search}%`;
        params.push(q, q, q, q);
    }

    sql += ' ORDER BY s.id DESC';
    return await databaseService.query(sql, params);
};

handlers['staff:getById'] = async (event, staffId) => {
    const staff = await databaseService.get(`
        SELECT s.*, d.department_name, ds.designation_name
        FROM staff s
        LEFT JOIN staff_departments d ON s.department_id = d.id
        LEFT JOIN staff_designations ds ON s.designation_id = ds.id
        WHERE s.id = ? AND s.deleted_at IS NULL
    `, [staffId]);
    if (!staff) return null;

    staff.documents = await databaseService.query('SELECT * FROM staff_documents WHERE staff_id = ? ORDER BY id DESC', [staffId]);
    staff.salaryHistory = await databaseService.query('SELECT * FROM salaries WHERE staff_id = ? ORDER BY id DESC LIMIT 12', [staffId]);
    staff.advances = await databaseService.query('SELECT * FROM salary_advances WHERE staff_id = ? ORDER BY id DESC', [staffId]);
    staff.attendanceSummary = await databaseService.query(`
        SELECT status, COUNT(*) as count 
        FROM attendance 
        WHERE staff_id = ? 
        GROUP BY status
    `, [staffId]);

    return staff;
};

handlers['staff:create'] = async (event, staffData) => {
    let employeeCode = staffData.employee_code;
    if (!employeeCode) {
        employeeCode = await generateSequentialNumber('staff', 'employee_code', 'EMP', new Date().getFullYear());
    }

    const basicSalary = parseFloat(staffData.basic_salary) || 0;
    const allowance = parseFloat(staffData.allowance) || 0;
    const totalSalary = basicSalary + allowance;

    const res = await databaseService.run(`
        INSERT INTO staff (
            employee_code, full_name, fathers_name, mothers_name, gender, date_of_birth, age,
            marital_status, nationality, religion, blood_group, profile_image_path,
            whatsapp_number, calling_number, alternate_number, email, current_address,
            permanent_address, city, country, national_id_number, national_id_issue_date,
            national_id_expiry_date, passport_number, passport_issue_date, passport_expiry_date,
            visa_number, visa_expiry_date, labour_card_number, work_permit_number,
            department_id, designation_id, joining_date, employment_type, contract_type,
            basic_salary, allowance, total_salary, payment_frequency, bank_name,
            account_number, salary_payment_method, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        employeeCode,
        staffData.full_name,
        staffData.fathers_name || '',
        staffData.mothers_name || '',
        staffData.gender || 'Male',
        staffData.date_of_birth || null,
        staffData.age || null,
        staffData.marital_status || 'Single',
        staffData.nationality || '',
        staffData.religion || '',
        staffData.blood_group || '',
        staffData.profile_image_path || '',
        staffData.whatsapp_number || '',
        staffData.calling_number || '',
        staffData.alternate_number || '',
        staffData.email || '',
        staffData.current_address || '',
        staffData.permanent_address || '',
        staffData.city || '',
        staffData.country || '',
        staffData.national_id_number || '',
        staffData.national_id_issue_date || null,
        staffData.national_id_expiry_date || null,
        staffData.passport_number || '',
        staffData.passport_issue_date || null,
        staffData.passport_expiry_date || null,
        staffData.visa_number || '',
        staffData.visa_expiry_date || null,
        staffData.labour_card_number || '',
        staffData.work_permit_number || '',
        staffData.department_id || null,
        staffData.designation_id || null,
        staffData.joining_date || new Date().toISOString().split('T')[0],
        staffData.employment_type || 'Full Time',
        staffData.contract_type || 'Permanent',
        basicSalary,
        allowance,
        totalSalary,
        staffData.payment_frequency || 'Monthly',
        staffData.bank_name || '',
        staffData.account_number || '',
        staffData.salary_payment_method || 'Bank Transfer',
        staffData.status || 'active',
        currentSessionUser?.id || 1
    ]);

    await logAudit(currentSessionUser?.id, 'CREATE', 'STAFF', res.lastInsertRowid, 'staff', `Staff member '${staffData.full_name}' (${employeeCode}) created.`);
    return await handlers['staff:getById'](event, res.lastInsertRowid);
};

handlers['staff:update'] = async (event, staffId, staffData) => {
    const current = await databaseService.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!current) throw new Error('Staff record not found');

    const basicSalary = parseFloat(staffData.basic_salary) || 0;
    const allowance = parseFloat(staffData.allowance) || 0;
    const totalSalary = basicSalary + allowance;

    await databaseService.run(`
        UPDATE staff SET
            employee_code = ?, full_name = ?, fathers_name = ?, mothers_name = ?, gender = ?,
            date_of_birth = ?, age = ?, marital_status = ?, nationality = ?, religion = ?,
            blood_group = ?, profile_image_path = ?, whatsapp_number = ?, calling_number = ?,
            alternate_number = ?, email = ?, current_address = ?, permanent_address = ?,
            city = ?, country = ?, national_id_number = ?, national_id_issue_date = ?,
            national_id_expiry_date = ?, passport_number = ?, passport_issue_date = ?,
            passport_expiry_date = ?, visa_number = ?, visa_expiry_date = ?,
            labour_card_number = ?, work_permit_number = ?, department_id = ?,
            designation_id = ?, joining_date = ?, employment_type = ?, contract_type = ?,
            basic_salary = ?, allowance = ?, total_salary = ?, payment_frequency = ?,
            bank_name = ?, account_number = ?, salary_payment_method = ?, status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        staffData.employee_code || current.employee_code,
        staffData.full_name || current.full_name,
        staffData.fathers_name || '',
        staffData.mothers_name || '',
        staffData.gender || 'Male',
        staffData.date_of_birth || null,
        staffData.age || null,
        staffData.marital_status || 'Single',
        staffData.nationality || '',
        staffData.religion || '',
        staffData.blood_group || '',
        staffData.profile_image_path || current.profile_image_path,
        staffData.whatsapp_number || '',
        staffData.calling_number || '',
        staffData.alternate_number || '',
        staffData.email || '',
        staffData.current_address || '',
        staffData.permanent_address || '',
        staffData.city || '',
        staffData.country || '',
        staffData.national_id_number || '',
        staffData.national_id_issue_date || null,
        staffData.national_id_expiry_date || null,
        staffData.passport_number || '',
        staffData.passport_issue_date || null,
        staffData.passport_expiry_date || null,
        staffData.visa_number || '',
        staffData.visa_expiry_date || null,
        staffData.labour_card_number || '',
        staffData.work_permit_number || '',
        staffData.department_id || null,
        staffData.designation_id || null,
        staffData.joining_date || current.joining_date,
        staffData.employment_type || 'Full Time',
        staffData.contract_type || 'Permanent',
        basicSalary,
        allowance,
        totalSalary,
        staffData.payment_frequency || 'Monthly',
        staffData.bank_name || '',
        staffData.account_number || '',
        staffData.salary_payment_method || 'Bank Transfer',
        staffData.status || current.status,
        staffId
    ]);

    await logAudit(currentSessionUser?.id, 'UPDATE', 'STAFF', staffId, 'staff', `Staff member '${staffData.full_name}' updated.`, current, staffData);
    return await handlers['staff:getById'](event, staffId);
};

handlers['staff:delete'] = async (event, staffId) => {
    await databaseService.run(
        'UPDATE staff SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?',
        [currentSessionUser?.id || 1, staffId]
    );
    await logAudit(currentSessionUser?.id, 'DELETE', 'STAFF', staffId, 'staff', `Staff ID ${staffId} soft-deleted.`);
    return { success: true };
};

handlers['staff:addDocument'] = async (event, staffId, docData) => {
    const res = await databaseService.run(`
        INSERT INTO staff_documents (staff_id, document_category, document_name, document_path, issue_date, expiry_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        staffId,
        docData.document_category,
        docData.document_name,
        docData.document_path || '',
        docData.issue_date || null,
        docData.expiry_date || null,
        docData.notes || ''
    ]);
    return await databaseService.get('SELECT * FROM staff_documents WHERE id = ?', [res.lastInsertRowid]);
};

handlers['staff:getDocuments'] = async (event, staffId) => {
    return await databaseService.query('SELECT * FROM staff_documents WHERE staff_id = ? ORDER BY id DESC', [staffId]);
};

handlers['staff:deleteDocument'] = async (event, docId) => {
    await databaseService.run('DELETE FROM staff_documents WHERE id = ?', [docId]);
    return { success: true };
};

handlers['staff:getDepartments'] = async () => {
    return await databaseService.query('SELECT * FROM staff_departments WHERE status = "active" ORDER BY department_name ASC');
};

handlers['staff:createDepartment'] = async (event, deptData) => {
    const res = await databaseService.run(
        'INSERT INTO staff_departments (department_name, description) VALUES (?, ?)',
        [deptData.department_name, deptData.description || '']
    );
    return await databaseService.get('SELECT * FROM staff_departments WHERE id = ?', [res.lastInsertRowid]);
};

handlers['staff:getDesignations'] = async () => {
    return await databaseService.query('SELECT * FROM staff_designations WHERE status = "active" ORDER BY designation_name ASC');
};

handlers['staff:createDesignation'] = async (event, desigData) => {
    const res = await databaseService.run(
        'INSERT INTO staff_designations (designation_name, description) VALUES (?, ?)',
        [desigData.designation_name, desigData.description || '']
    );
    return await databaseService.get('SELECT * FROM staff_designations WHERE id = ?', [res.lastInsertRowid]);
};

// ============================================
// ATTENDANCE
// ============================================
handlers['attendance:mark'] = async (event, data) => {
    const existing = await databaseService.get('SELECT id FROM attendance WHERE staff_id = ? AND date = ?', [data.staff_id, data.date]);
    if (existing) {
        await databaseService.run(`
            UPDATE attendance SET 
                check_in = ?, check_out = ?, total_hours = ?, status = ?, overtime_hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            data.check_in || null,
            data.check_out || null,
            data.total_hours || (data.status === 'present' ? 8 : (data.status === 'half_day' ? 4 : 0)),
            data.status || 'present',
            data.overtime_hours || 0,
            data.notes || '',
            existing.id
        ]);
        return await databaseService.get('SELECT * FROM attendance WHERE id = ?', [existing.id]);
    } else {
        const res = await databaseService.run(`
            INSERT INTO attendance (staff_id, date, check_in, check_out, total_hours, status, overtime_hours, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.staff_id,
            data.date,
            data.check_in || null,
            data.check_out || null,
            data.total_hours || (data.status === 'present' ? 8 : (data.status === 'half_day' ? 4 : 0)),
            data.status || 'present',
            data.overtime_hours || 0,
            data.notes || '',
            currentSessionUser?.id || 1
        ]);
        return await databaseService.get('SELECT * FROM attendance WHERE id = ?', [res.lastInsertRowid]);
    }
};

handlers['attendance:bulkMark'] = async (event, entries) => {
    const results = [];
    for (const item of entries) {
        const res = await handlers['attendance:mark'](event, item);
        results.push(res);
    }
    return results;
};

handlers['attendance:getAttendance'] = async (event, filters = {}) => {
    let sql = `
        SELECT a.*, s.full_name as staff_name, s.employee_code, d.department_name
        FROM attendance a
        JOIN staff s ON a.staff_id = s.id
        LEFT JOIN staff_departments d ON s.department_id = d.id
        WHERE 1=1
    `;
    const params = [];

    if (filters.date) {
        sql += ' AND a.date = ?';
        params.push(filters.date);
    }
    if (filters.date_from && filters.date_to) {
        sql += ' AND a.date BETWEEN ? AND ?';
        params.push(filters.date_from, filters.date_to);
    }
    if (filters.staff_id) {
        sql += ' AND a.staff_id = ?';
        params.push(filters.staff_id);
    }
    if (filters.status) {
        sql += ' AND a.status = ?';
        params.push(filters.status);
    }

    sql += ' ORDER BY a.date DESC, s.full_name ASC';
    return await databaseService.query(sql, params);
};

// ============================================
// SALARIES & ADVANCES
// ============================================
handlers['salary:getAll'] = async (event, filters = {}) => {
    let sql = `
        SELECT sal.*, s.full_name as staff_name, s.employee_code, d.department_name
        FROM salaries sal
        JOIN staff s ON sal.staff_id = s.id
        LEFT JOIN staff_departments d ON s.department_id = d.id
        WHERE 1=1
    `;
    const params = [];
    if (filters.salary_month) {
        sql += ' AND sal.salary_month = ?';
        params.push(filters.salary_month);
    }
    if (filters.staff_id) {
        sql += ' AND sal.staff_id = ?';
        params.push(filters.staff_id);
    }
    if (filters.payment_status) {
        sql += ' AND sal.payment_status = ?';
        params.push(filters.payment_status);
    }
    sql += ' ORDER BY sal.id DESC';
    return await databaseService.query(sql, params);
};

handlers['salary:calculateSalary'] = async (event, staffId, month) => {
    const staff = await databaseService.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) throw new Error('Staff member not found');

    const basicSalary = parseFloat(staff.basic_salary) || 0;
    const allowance = parseFloat(staff.allowance) || 0;

    // Get attendance data for the month
    const attRecords = await databaseService.query(`
        SELECT status, SUM(overtime_hours) as total_ot, COUNT(*) as days_count
        FROM attendance
        WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
        GROUP BY status
    `, [staffId, month]);

    let absentDays = 0;
    let overtimeHours = 0;
    attRecords.forEach(r => {
        if (r.status === 'absent') absentDays += r.days_count;
        if (r.total_ot) overtimeHours += parseFloat(r.total_ot);
    });

    // Overtime rate: (basic / 30 / 8) * 1.5
    const hourlyRate = (basicSalary / 240);
    const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5 * 100) / 100;
    const absentDeduction = Math.round((basicSalary / 30) * absentDays * 100) / 100;

    // Check outstanding advances for this month
    const advance = await databaseService.get(`
        SELECT SUM(deduction_amount) as advance_deduction
        FROM salary_advances
        WHERE staff_id = ? AND deduction_month = ? AND status = 'approved' AND remaining_balance > 0
    `, [staffId, month]);

    const advanceDeduction = advance?.advance_deduction || 0;
    const netSalary = basicSalary + allowance + overtimePay - absentDeduction - advanceDeduction;

    return {
        staff_id: staffId,
        staff_name: staff.full_name,
        salary_month: month,
        basic_salary: basicSalary,
        allowances: allowance,
        overtime: overtimePay,
        overtime_hours: overtimeHours,
        absent_days: absentDays,
        bonus: 0,
        deduction: absentDeduction,
        advance_deduction: advanceDeduction,
        other_deduction: 0,
        net_salary: Math.max(0, Math.round(netSalary * 100) / 100)
    };
};

handlers['salary:create'] = async (event, data) => {
    const salaryNumber = await generateSequentialNumber('salaries', 'salary_number', 'SAL', new Date().getFullYear());
    const basic = parseFloat(data.basic_salary) || 0;
    const allowances = parseFloat(data.allowances) || 0;
    const overtime = parseFloat(data.overtime) || 0;
    const bonus = parseFloat(data.bonus) || 0;
    const deduction = parseFloat(data.deduction) || 0;
    const advanceDeduction = parseFloat(data.advance_deduction) || 0;
    const otherDeduction = parseFloat(data.other_deduction) || 0;
    const net = basic + allowances + overtime + bonus - deduction - advanceDeduction - otherDeduction;

    const res = await databaseService.run(`
        INSERT INTO salaries (
            salary_number, staff_id, salary_month, basic_salary, allowances, overtime,
            bonus, deduction, advance_deduction, other_deduction, net_salary,
            payment_date, payment_method, currency, payment_status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        salaryNumber,
        data.staff_id,
        data.salary_month,
        basic,
        allowances,
        overtime,
        bonus,
        deduction,
        advanceDeduction,
        otherDeduction,
        Math.max(0, net),
        data.payment_date || null,
        data.payment_method || 'Bank Transfer',
        data.currency || 'AED',
        data.payment_status || 'pending',
        data.notes || '',
        currentSessionUser?.id || 1
    ]);

    // If paid, create expense entry automatically for salaries
    if (data.payment_status === 'paid') {
        const staff = await databaseService.get('SELECT full_name FROM staff WHERE id = ?', [data.staff_id]);
        const expCat = await databaseService.get('SELECT id FROM expense_categories WHERE category_name LIKE "%Salar%" LIMIT 1');
        const expNum = await generateSequentialNumber('expenses', 'expense_number', 'EXP', new Date().getFullYear());
        await databaseService.run(`
            INSERT INTO expenses (
                expense_number, date, time, category_id, description, vendor_id,
                payment_method, currency, exchange_rate, amount, base_currency_amount,
                receipt_reference, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            expNum,
            data.payment_date || new Date().toISOString().split('T')[0],
            new Date().toTimeString().split(' ')[0],
            expCat ? expCat.id : 1,
            `Salary payment for ${staff?.full_name || 'Staff'} (${data.salary_month})`,
            null,
            data.payment_method || 'Bank Transfer',
            data.currency || 'AED',
            1.0,
            net,
            net,
            salaryNumber,
            'Auto-generated from payroll',
            currentSessionUser?.id || 1
        ]);
    }

    return await databaseService.get('SELECT * FROM salaries WHERE id = ?', [res.lastInsertRowid]);
};

handlers['salary:processPayment'] = async (event, salaryId, paymentData) => {
    const salary = await databaseService.get('SELECT * FROM salaries WHERE id = ?', [salaryId]);
    if (!salary) throw new Error('Salary record not found');

    await databaseService.run(`
        UPDATE salaries SET 
            payment_status = 'paid', payment_date = ?, payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        paymentData.payment_date || new Date().toISOString().split('T')[0],
        paymentData.payment_method || 'Bank Transfer',
        paymentData.notes || salary.notes,
        salaryId
    ]);

    // Create corresponding expense
    const staff = await databaseService.get('SELECT full_name FROM staff WHERE id = ?', [salary.staff_id]);
    const expCat = await databaseService.get('SELECT id FROM expense_categories WHERE category_name LIKE "%Salar%" LIMIT 1');
    const expNum = await generateSequentialNumber('expenses', 'expense_number', 'EXP', new Date().getFullYear());
    await databaseService.run(`
        INSERT INTO expenses (
            expense_number, date, time, category_id, description, vendor_id,
            payment_method, currency, exchange_rate, amount, base_currency_amount,
            receipt_reference, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        expNum,
        paymentData.payment_date || new Date().toISOString().split('T')[0],
        new Date().toTimeString().split(' ')[0],
        expCat ? expCat.id : 1,
        `Salary payment for ${staff?.full_name || 'Staff'} (${salary.salary_month})`,
        null,
        paymentData.payment_method || 'Bank Transfer',
        salary.currency || 'AED',
        1.0,
        salary.net_salary,
        salary.net_salary,
        salary.salary_number,
        'Auto-generated from payroll settlement',
        currentSessionUser?.id || 1
    ]);

    return await databaseService.get('SELECT * FROM salaries WHERE id = ?', [salaryId]);
};

// Advances
handlers['advance:getAll'] = async (event, filters = {}) => {
    let sql = `
        SELECT adv.*, s.employee_code, d.department_name
        FROM salary_advances adv
        JOIN staff s ON adv.staff_id = s.id
        LEFT JOIN staff_departments d ON s.department_id = d.id
        WHERE 1=1
    `;
    const params = [];
    if (filters.staff_id) {
        sql += ' AND adv.staff_id = ?';
        params.push(filters.staff_id);
    }
    if (filters.status) {
        sql += ' AND adv.status = ?';
        params.push(filters.status);
    }
    sql += ' ORDER BY adv.id DESC';
    return await databaseService.query(sql, params);
};

handlers['advance:create'] = async (event, data) => {
    const staff = await databaseService.get('SELECT full_name FROM staff WHERE id = ?', [data.staff_id]);
    const advNumber = await generateSequentialNumber('salary_advances', 'advance_number', 'ADV', new Date().getFullYear());
    const amount = parseFloat(data.advance_amount) || 0;
    const deduction = parseFloat(data.deduction_amount) || amount;

    const res = await databaseService.run(`
        INSERT INTO salary_advances (
            advance_number, staff_id, staff_name, date, advance_amount, currency,
            reason, approved_by, deduction_month, deduction_amount, remaining_balance,
            status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        advNumber,
        data.staff_id,
        staff?.full_name || data.staff_name || 'Staff',
        data.date || new Date().toISOString().split('T')[0],
        amount,
        data.currency || 'AED',
        data.reason || '',
        currentSessionUser?.id || 1,
        data.deduction_month || '',
        deduction,
        amount,
        data.status || 'approved',
        data.notes || '',
        currentSessionUser?.id || 1
    ]);

    return await databaseService.get('SELECT * FROM salary_advances WHERE id = ?', [res.lastInsertRowid]);
};

handlers['advance:deduct'] = async (event, advanceId, deductionData) => {
    const adv = await databaseService.get('SELECT * FROM salary_advances WHERE id = ?', [advanceId]);
    if (!adv) throw new Error('Advance record not found');

    const deductAmount = parseFloat(deductionData.amount) || 0;
    const newRemaining = Math.max(0, adv.remaining_balance - deductAmount);
    const newStatus = newRemaining === 0 ? 'fully_recovered' : 'partially_recovered';

    await databaseService.run(`
        UPDATE salary_advances SET remaining_balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [newRemaining, newStatus, advanceId]);

    return await databaseService.get('SELECT * FROM salary_advances WHERE id = ?', [advanceId]);
};

// ============================================
// INCOME & EXPENSES
// ============================================
handlers['income:getAll'] = async (event, filters = {}) => {
    let sql = `
        SELECT inc.*, ic.category_name, c.name as customer_name
        FROM income inc
        LEFT JOIN income_categories ic ON inc.category_id = ic.id
        LEFT JOIN customers c ON inc.customer_id = c.id
        WHERE inc.deleted_at IS NULL
    `;
    const params = [];
    if (filters.date_from && filters.date_to) {
        sql += ' AND inc.date BETWEEN ? AND ?';
        params.push(filters.date_from, filters.date_to);
    }
    if (filters.category_id) {
        sql += ' AND inc.category_id = ?';
        params.push(filters.category_id);
    }
    if (filters.payment_method) {
        sql += ' AND inc.payment_method = ?';
        params.push(filters.payment_method);
    }
    if (filters.search) {
        sql += ' AND (inc.description LIKE ? OR inc.income_number LIKE ? OR c.name LIKE ?)';
        const q = `%${filters.search}%`;
        params.push(q, q, q);
    }
    sql += ' ORDER BY inc.date DESC, inc.id DESC';
    return await databaseService.query(sql, params);
};

handlers['income:create'] = async (event, data) => {
    const incomeNumber = await generateSequentialNumber('income', 'income_number', 'INC', new Date().getFullYear());
    const amount = parseFloat(data.amount) || 0;
    const exchangeRate = parseFloat(data.exchange_rate) || 1.0;
    const baseAmount = amount / exchangeRate;

    const res = await databaseService.run(`
        INSERT INTO income (
            income_number, date, time, category_id, description, customer_id,
            invoice_reference, payment_method, currency, exchange_rate, amount,
            base_currency_amount, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        incomeNumber,
        data.date || new Date().toISOString().split('T')[0],
        data.time || new Date().toTimeString().split(' ')[0],
        data.category_id || null,
        data.description,
        data.customer_id || null,
        data.invoice_reference || '',
        data.payment_method || 'Cash',
        data.currency || 'AED',
        exchangeRate,
        amount,
        baseAmount,
        data.notes || '',
        currentSessionUser?.id || 1
    ]);

    await logAudit(currentSessionUser?.id, 'CREATE', 'INCOME', res.lastInsertRowid, 'income', `Income record '${incomeNumber}' created.`);
    return await databaseService.get('SELECT * FROM income WHERE id = ?', [res.lastInsertRowid]);
};

handlers['income:update'] = async (event, incomeId, data) => {
    const amount = parseFloat(data.amount) || 0;
    const exchangeRate = parseFloat(data.exchange_rate) || 1.0;
    const baseAmount = amount / exchangeRate;

    await databaseService.run(`
        UPDATE income SET
            date = ?, time = ?, category_id = ?, description = ?, customer_id = ?,
            invoice_reference = ?, payment_method = ?, currency = ?, exchange_rate = ?,
            amount = ?, base_currency_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        data.date,
        data.time,
        data.category_id,
        data.description,
        data.customer_id,
        data.invoice_reference,
        data.payment_method,
        data.currency,
        exchangeRate,
        amount,
        baseAmount,
        data.notes,
        incomeId
    ]);

    return await databaseService.get('SELECT * FROM income WHERE id = ?', [incomeId]);
};

handlers['income:delete'] = async (event, incomeId) => {
    await databaseService.run('UPDATE income SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?', [currentSessionUser?.id || 1, incomeId]);
    return { success: true };
};

handlers['income:getCategories'] = async () => {
    return await databaseService.query('SELECT * FROM income_categories WHERE status = "active" ORDER BY category_name ASC');
};

handlers['income:createCategory'] = async (event, data) => {
    const res = await databaseService.run('INSERT INTO income_categories (category_name, description) VALUES (?, ?)', [data.category_name, data.description || '']);
    return await databaseService.get('SELECT * FROM income_categories WHERE id = ?', [res.lastInsertRowid]);
};

// Expenses
handlers['expense:getAll'] = async (event, filters = {}) => {
    let sql = `
        SELECT exp.*, ec.category_name, v.name as vendor_name
        FROM expenses exp
        LEFT JOIN expense_categories ec ON exp.category_id = ec.id
        LEFT JOIN vendors v ON exp.vendor_id = v.id
        WHERE exp.deleted_at IS NULL
    `;
    const params = [];
    if (filters.date_from && filters.date_to) {
        sql += ' AND exp.date BETWEEN ? AND ?';
        params.push(filters.date_from, filters.date_to);
    }
    if (filters.category_id) {
        sql += ' AND exp.category_id = ?';
        params.push(filters.category_id);
    }
    if (filters.payment_method) {
        sql += ' AND exp.payment_method = ?';
        params.push(filters.payment_method);
    }
    if (filters.search) {
        sql += ' AND (exp.description LIKE ? OR exp.expense_number LIKE ? OR v.name LIKE ?)';
        const q = `%${filters.search}%`;
        params.push(q, q, q);
    }
    sql += ' ORDER BY exp.date DESC, exp.id DESC';
    return await databaseService.query(sql, params);
};

handlers['expense:create'] = async (event, data) => {
    const expenseNumber = await generateSequentialNumber('expenses', 'expense_number', 'EXP', new Date().getFullYear());
    const amount = parseFloat(data.amount) || 0;
    const exchangeRate = parseFloat(data.exchange_rate) || 1.0;
    const baseAmount = amount / exchangeRate;

    const res = await databaseService.run(`
        INSERT INTO expenses (
            expense_number, date, time, category_id, description, vendor_id,
            payment_method, currency, exchange_rate, amount, base_currency_amount,
            receipt_reference, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        expenseNumber,
        data.date || new Date().toISOString().split('T')[0],
        data.time || new Date().toTimeString().split(' ')[0],
        data.category_id || null,
        data.description,
        data.vendor_id || null,
        data.payment_method || 'Cash',
        data.currency || 'AED',
        exchangeRate,
        amount,
        baseAmount,
        data.receipt_reference || '',
        data.notes || '',
        currentSessionUser?.id || 1
    ]);

    await logAudit(currentSessionUser?.id, 'CREATE', 'EXPENSE', res.lastInsertRowid, 'expense', `Expense record '${expenseNumber}' created.`);
    return await databaseService.get('SELECT * FROM expenses WHERE id = ?', [res.lastInsertRowid]);
};

handlers['expense:update'] = async (event, expenseId, data) => {
    const amount = parseFloat(data.amount) || 0;
    const exchangeRate = parseFloat(data.exchange_rate) || 1.0;
    const baseAmount = amount / exchangeRate;

    await databaseService.run(`
        UPDATE expenses SET
            date = ?, time = ?, category_id = ?, description = ?, vendor_id = ?,
            payment_method = ?, currency = ?, exchange_rate = ?, amount = ?,
            base_currency_amount = ?, receipt_reference = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        data.date,
        data.time,
        data.category_id,
        data.description,
        data.vendor_id,
        data.payment_method,
        data.currency,
        exchangeRate,
        amount,
        baseAmount,
        data.receipt_reference,
        data.notes,
        expenseId
    ]);

    return await databaseService.get('SELECT * FROM expenses WHERE id = ?', [expenseId]);
};

handlers['expense:delete'] = async (event, expenseId) => {
    await databaseService.run('UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?', [currentSessionUser?.id || 1, expenseId]);
    return { success: true };
};

handlers['expense:getCategories'] = async () => {
    return await databaseService.query('SELECT * FROM expense_categories WHERE status = "active" ORDER BY category_name ASC');
};

handlers['expense:createCategory'] = async (event, data) => {
    const res = await databaseService.run('INSERT INTO expense_categories (category_name, description) VALUES (?, ?)', [data.category_name, data.description || '']);
    return await databaseService.get('SELECT * FROM expense_categories WHERE id = ?', [res.lastInsertRowid]);
};

// ============================================
// CUSTOMERS & VENDORS
// ============================================
handlers['customer:getAll'] = async (event, filters = {}) => {
    let sql = 'SELECT * FROM customers WHERE deleted_at IS NULL';
    const params = [];
    if (filters.search) {
        sql += ' AND (name LIKE ? OR customer_code LIKE ? OR phone LIKE ? OR email LIKE ?)';
        const q = `%${filters.search}%`;
        params.push(q, q, q, q);
    }
    sql += ' ORDER BY name ASC';
    return await databaseService.query(sql, params);
};

handlers['customer:create'] = async (event, data) => {
    const code = data.customer_code || await generateSequentialNumber('customers', 'customer_code', 'CUST', new Date().getFullYear());
    const res = await databaseService.run(`
        INSERT INTO customers (customer_code, name, company, phone, whatsapp, email, address, country, tax_vat_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        code,
        data.name,
        data.company || '',
        data.phone || '',
        data.whatsapp || '',
        data.email || '',
        data.address || '',
        data.country || '',
        data.tax_vat_number || '',
        data.notes || ''
    ]);
    return await databaseService.get('SELECT * FROM customers WHERE id = ?', [res.lastInsertRowid]);
};

handlers['customer:getById'] = async (event, customerId) => {
    const cust = await databaseService.get('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!cust) return null;
    cust.invoices = await databaseService.query('SELECT * FROM invoices WHERE customer_id = ? ORDER BY date DESC', [customerId]);
    cust.payments = await databaseService.query(`
        SELECT p.*, inv.invoice_number 
        FROM invoice_payments p
        JOIN invoices inv ON p.invoice_id = inv.id
        WHERE inv.customer_id = ?
        ORDER BY p.date DESC
    `, [customerId]);
    return cust;
};

handlers['vendor:getAll'] = async (event, filters = {}) => {
    let sql = 'SELECT * FROM vendors WHERE deleted_at IS NULL';
    const params = [];
    if (filters.search) {
        sql += ' AND (name LIKE ? OR vendor_code LIKE ? OR phone LIKE ?)';
        const q = `%${filters.search}%`;
        params.push(q, q, q);
    }
    sql += ' ORDER BY name ASC';
    return await databaseService.query(sql, params);
};

handlers['vendor:create'] = async (event, data) => {
    const code = data.vendor_code || await generateSequentialNumber('vendors', 'vendor_code', 'VEND', new Date().getFullYear());
    const res = await databaseService.run(`
        INSERT INTO vendors (vendor_code, name, company, phone, whatsapp, email, address, country, tax_vat_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        code,
        data.name,
        data.company || '',
        data.phone || '',
        data.whatsapp || '',
        data.email || '',
        data.address || '',
        data.country || '',
        data.tax_vat_number || '',
        data.notes || ''
    ]);
    return await databaseService.get('SELECT * FROM vendors WHERE id = ?', [res.lastInsertRowid]);
};

// ============================================
// INVOICES & THERMAL PRINTING
// ============================================
handlers['invoice:generateNumber'] = async () => {
    const comp = await databaseService.get('SELECT invoice_prefix FROM companies ORDER BY id DESC LIMIT 1');
    const prefix = comp?.invoice_prefix || 'RMS-INV';
    return await generateSequentialNumber('invoices', 'invoice_number', prefix, new Date().getFullYear());
};

handlers['invoice:getAll'] = async (event, filters = {}) => {
    let sql = `
        SELECT inv.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
        FROM invoices inv
        JOIN customers c ON inv.customer_id = c.id
        WHERE inv.deleted_at IS NULL
    `;
    const params = [];
    if (filters.status) {
        sql += ' AND inv.invoice_status = ?';
        params.push(filters.status);
    }
    if (filters.payment_status) {
        sql += ' AND inv.payment_status = ?';
        params.push(filters.payment_status);
    }
    if (filters.date_from && filters.date_to) {
        sql += ' AND inv.date BETWEEN ? AND ?';
        params.push(filters.date_from, filters.date_to);
    }
    if (filters.search) {
        sql += ' AND (inv.invoice_number LIKE ? OR c.name LIKE ?)';
        const q = `%${filters.search}%`;
        params.push(q, q);
    }
    sql += ' ORDER BY inv.id DESC';
    return await databaseService.query(sql, params);
};

handlers['invoice:getById'] = async (event, invoiceId) => {
    const inv = await databaseService.get(`
        SELECT inv.*, c.name as customer_name, c.company as customer_company, c.phone as customer_phone,
               c.email as customer_email, c.address as customer_address, c.tax_vat_number as customer_tax
        FROM invoices inv
        JOIN customers c ON inv.customer_id = c.id
        WHERE inv.id = ? AND inv.deleted_at IS NULL
    `, [invoiceId]);

    if (!inv) return null;
    inv.items = await databaseService.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_number ASC', [invoiceId]);
    inv.payments = await databaseService.query('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY date DESC', [invoiceId]);
    return inv;
};

handlers['invoice:create'] = async (event, data) => {
    const invoiceNumber = data.invoice_number || await handlers['invoice:generateNumber']();
    const subtotal = parseFloat(data.subtotal) || 0;
    const discountAmount = parseFloat(data.discount_amount) || 0;
    const taxAmount = parseFloat(data.tax_amount) || 0;
    const totalAmount = parseFloat(data.total_amount) || (subtotal - discountAmount + taxAmount);
    const exchangeRate = parseFloat(data.exchange_rate) || 1.0;
    const baseTotal = totalAmount / exchangeRate;
    const paidAmount = parseFloat(data.paid_amount) || 0;
    const balanceAmount = totalAmount - paidAmount;

    let paymentStatus = 'pending';
    if (paidAmount >= totalAmount && totalAmount > 0) {
        paymentStatus = 'paid';
    } else if (paidAmount > 0) {
        paymentStatus = 'partially_paid';
    }

    const res = await databaseService.run(`
        INSERT INTO invoices (
            invoice_number, customer_id, date, time, due_date, subtotal, discount_amount,
            discount_percentage, tax_amount, tax_percentage, total_amount, currency,
            exchange_rate, base_currency_total, paid_amount, balance_amount, payment_status,
            invoice_status, notes, terms_conditions, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        invoiceNumber,
        data.customer_id,
        data.date || new Date().toISOString().split('T')[0],
        data.time || new Date().toTimeString().split(' ')[0],
        data.due_date || null,
        subtotal,
        discountAmount,
        parseFloat(data.discount_percentage) || 0,
        taxAmount,
        parseFloat(data.tax_percentage) || 0,
        totalAmount,
        data.currency || 'AED',
        exchangeRate,
        baseTotal,
        paidAmount,
        balanceAmount,
        paymentStatus,
        data.invoice_status || 'issued',
        data.notes || '',
        data.terms_conditions || '',
        currentSessionUser?.id || 1
    ]);

    const invoiceId = res.lastInsertRowid;

    // Insert items
    if (Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            const qty = parseFloat(item.quantity) || 1;
            const price = parseFloat(item.unit_price) || 0;
            const itemDisc = parseFloat(item.discount_amount) || 0;
            const itemTax = parseFloat(item.tax_amount) || 0;
            const lineTotal = parseFloat(item.line_total) || (qty * price - itemDisc + itemTax);

            await databaseService.run(`
                INSERT INTO invoice_items (invoice_id, item_number, description, quantity, unit_price, discount_amount, tax_amount, line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [invoiceId, i + 1, item.description, qty, price, itemDisc, itemTax, lineTotal]);
        }
    }

    // Insert initial payment if provided
    if (paidAmount > 0) {
        const payNum = await generateSequentialNumber('invoice_payments', 'payment_number', 'PAY', new Date().getFullYear());
        await databaseService.run(`
            INSERT INTO invoice_payments (
                payment_number, invoice_id, date, amount, currency, exchange_rate,
                base_currency_amount, payment_method, reference, notes, received_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            payNum,
            invoiceId,
            data.date || new Date().toISOString().split('T')[0],
            paidAmount,
            data.currency || 'AED',
            exchangeRate,
            paidAmount / exchangeRate,
            data.payment_method || 'Cash',
            invoiceNumber,
            'Initial payment upon invoice creation',
            currentSessionUser?.id || 1
        ]);

        // Auto record income
        const incCat = await databaseService.get('SELECT id FROM income_categories WHERE category_name LIKE "%Sale%" LIMIT 1');
        const incNum = await generateSequentialNumber('income', 'income_number', 'INC', new Date().getFullYear());
        await databaseService.run(`
            INSERT INTO income (
                income_number, date, time, category_id, description, customer_id,
                invoice_reference, payment_method, currency, exchange_rate, amount,
                base_currency_amount, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            incNum,
            data.date || new Date().toISOString().split('T')[0],
            new Date().toTimeString().split(' ')[0],
            incCat ? incCat.id : 1,
            `Invoice payment for ${invoiceNumber}`,
            data.customer_id,
            invoiceNumber,
            data.payment_method || 'Cash',
            data.currency || 'AED',
            exchangeRate,
            paidAmount,
            paidAmount / exchangeRate,
            'Auto-generated from invoice payment',
            currentSessionUser?.id || 1
        ]);
    }

    await logAudit(currentSessionUser?.id, 'CREATE', 'INVOICES', invoiceId, 'invoice', `Invoice '${invoiceNumber}' created.`);
    return await handlers['invoice:getById'](event, invoiceId);
};

handlers['invoice:addPayment'] = async (event, invoiceId, paymentData) => {
    const inv = await databaseService.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!inv) throw new Error('Invoice not found');

    const amount = parseFloat(paymentData.amount) || 0;
    const newPaid = inv.paid_amount + amount;
    const newBalance = Math.max(0, inv.total_amount - newPaid);
    const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';

    const payNum = await generateSequentialNumber('invoice_payments', 'payment_number', 'PAY', new Date().getFullYear());
    await databaseService.run(`
        INSERT INTO invoice_payments (
            payment_number, invoice_id, date, amount, currency, exchange_rate,
            base_currency_amount, payment_method, reference, notes, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        payNum,
        invoiceId,
        paymentData.date || new Date().toISOString().split('T')[0],
        amount,
        inv.currency,
        inv.exchange_rate,
        amount / inv.exchange_rate,
        paymentData.payment_method || 'Cash',
        paymentData.reference || inv.invoice_number,
        paymentData.notes || '',
        currentSessionUser?.id || 1
    ]);

    await databaseService.run(`
        UPDATE invoices SET paid_amount = ?, balance_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [newPaid, newBalance, newStatus, invoiceId]);

    // Auto record income
    const incCat = await databaseService.get('SELECT id FROM income_categories WHERE category_name LIKE "%Sale%" LIMIT 1');
    const incNum = await generateSequentialNumber('income', 'income_number', 'INC', new Date().getFullYear());
    await databaseService.run(`
        INSERT INTO income (
            income_number, date, time, category_id, description, customer_id,
            invoice_reference, payment_method, currency, exchange_rate, amount,
            base_currency_amount, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        incNum,
        paymentData.date || new Date().toISOString().split('T')[0],
        new Date().toTimeString().split(' ')[0],
        incCat ? incCat.id : 1,
        `Invoice payment for ${inv.invoice_number}`,
        inv.customer_id,
        inv.invoice_number,
        paymentData.payment_method || 'Cash',
        inv.currency,
        inv.exchange_rate,
        amount,
        amount / inv.exchange_rate,
        'Auto-generated from invoice settlement',
        currentSessionUser?.id || 1
    ]);

    return await handlers['invoice:getById'](event, invoiceId);
};

// ============================================
// CURRENCIES
// ============================================
handlers['currency:getAll'] = async () => {
    return await databaseService.query('SELECT * FROM currencies WHERE status = "active" ORDER BY is_base_currency DESC, currency_code ASC');
};

handlers['currency:create'] = async (event, data) => {
    const res = await databaseService.run(`
        INSERT INTO currencies (currency_code, currency_name, currency_symbol, decimal_places, exchange_rate, is_base_currency, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [
        data.currency_code.toUpperCase(),
        data.currency_name,
        data.currency_symbol,
        parseInt(data.decimal_places) || 2,
        parseFloat(data.exchange_rate) || 1.0,
        data.is_base_currency ? 1 : 0
    ]);
    return await databaseService.get('SELECT * FROM currencies WHERE id = ?', [res.lastInsertRowid]);
};

handlers['currency:setBaseCurrency'] = async (event, currencyId) => {
    await databaseService.run('UPDATE currencies SET is_base_currency = 0');
    await databaseService.run('UPDATE currencies SET is_base_currency = 1, exchange_rate = 1.0 WHERE id = ?', [currencyId]);
    const curr = await databaseService.get('SELECT * FROM currencies WHERE id = ?', [currencyId]);
    if (curr) {
        await databaseService.run('UPDATE companies SET currency = ?, currency_symbol = ?', [curr.currency_code, curr.currency_symbol]);
    }
    return { success: true };
};

handlers['currency:updateExchangeRate'] = async (event, currencyId, rate) => {
    await databaseService.run('UPDATE currencies SET exchange_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [parseFloat(rate), currencyId]);
    return { success: true };
};

handlers['currency:getById'] = async (event, currencyId) => {
    return await databaseService.get('SELECT * FROM currencies WHERE id = ?', [currencyId]);
};

handlers['currency:update'] = async (event, currencyId, data) => {
    await databaseService.run(`
        UPDATE currencies 
        SET currency_code = ?, currency_name = ?, currency_symbol = ?, decimal_places = ?, exchange_rate = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        data.currency_code.toUpperCase(),
        data.currency_name,
        data.currency_symbol,
        parseInt(data.decimal_places) || 2,
        parseFloat(data.exchange_rate) || 1.0,
        currencyId
    ]);
    return await databaseService.get('SELECT * FROM currencies WHERE id = ?', [currencyId]);
};

handlers['currency:delete'] = async (event, currencyId) => {
    const curr = await databaseService.get('SELECT * FROM currencies WHERE id = ?', [currencyId]);
    if (curr && curr.is_base_currency) {
        throw new Error('Cannot delete the active base currency.');
    }
    await databaseService.run('DELETE FROM currencies WHERE id = ?', [currencyId]);
    return { success: true };
};

// ============================================
// REPORTING SYSTEM
// ============================================
handlers['report:getProfitLoss'] = async (event, dateRange = {}) => {
    const from = dateRange.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = dateRange.to || new Date().toISOString().split('T')[0];

    const incomeRows = await databaseService.query(`
        SELECT ic.category_name, SUM(inc.base_currency_amount) as total
        FROM income inc
        LEFT JOIN income_categories ic ON inc.category_id = ic.id
        WHERE inc.deleted_at IS NULL AND inc.date BETWEEN ? AND ?
        GROUP BY inc.category_id
    `, [from, to]);

    const expenseRows = await databaseService.query(`
        SELECT ec.category_name, SUM(exp.base_currency_amount) as total
        FROM expenses exp
        LEFT JOIN expense_categories ec ON exp.category_id = ec.id
        WHERE exp.deleted_at IS NULL AND exp.date BETWEEN ? AND ?
        GROUP BY exp.category_id
    `, [from, to]);

    const totalIncome = incomeRows.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalExpenses = expenseRows.reduce((sum, r) => sum + (r.total || 0), 0);
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
        date_from: from,
        date_to: to,
        total_income: Math.round(totalIncome * 100) / 100,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        net_profit: Math.round(netProfit * 100) / 100,
        profit_margin: Math.round(profitMargin * 10) / 10,
        income_by_category: incomeRows,
        expense_by_category: expenseRows
    };
};

handlers['report:getDailyReport'] = async (event, targetDate) => {
    const date = targetDate || new Date().toISOString().split('T')[0];

    const inc = await databaseService.get(
        'SELECT SUM(base_currency_amount) as total FROM income WHERE date = ? AND deleted_at IS NULL',
        [date]
    );
    const exp = await databaseService.get(
        'SELECT SUM(base_currency_amount) as total FROM expenses WHERE date = ? AND deleted_at IS NULL',
        [date]
    );

    const totalIncome = inc?.total || 0;
    const totalExpenses = exp?.total || 0;
    const netProfit = totalIncome - totalExpenses;

    const staffCount = await databaseService.get('SELECT COUNT(*) as total FROM staff WHERE status = "active" AND deleted_at IS NULL');
    const attCounts = await databaseService.query('SELECT status, COUNT(*) as count FROM attendance WHERE date = ? GROUP BY status', [date]);

    let present = 0, absent = 0, leave = 0;
    attCounts.forEach(r => {
        if (r.status === 'present') present = r.count;
        if (r.status === 'absent') absent = r.count;
        if (r.status === 'leave') leave = r.count;
    });

    const invStats = await databaseService.get(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid,
               SUM(CASE WHEN payment_status != 'paid' THEN 1 ELSE 0 END) as pending
        FROM invoices WHERE date = ? AND deleted_at IS NULL
    `, [date]);

    const advances = await databaseService.get('SELECT SUM(advance_amount) as total FROM salary_advances WHERE date = ?', [date]);

    return {
        date,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        total_staff: staffCount?.total || 0,
        present_staff: present,
        absent_staff: absent,
        leave_staff: leave,
        total_salary_advance: advances?.total || 0,
        total_invoices: invStats?.total || 0,
        paid_invoices: invStats?.paid || 0,
        pending_invoices: invStats?.pending || 0
    };
};

handlers['report:getStaffReport'] = async (event, staffId, dateRange = {}) => {
    const staff = await handlers['staff:getById'](event, staffId);
    if (!staff) throw new Error('Staff not found');

    const from = dateRange.from || '2000-01-01';
    const to = dateRange.to || '2099-12-31';

    const attendanceRecords = await databaseService.query(
        'SELECT * FROM attendance WHERE staff_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC',
        [staffId, from, to]
    );
    const salaryRecords = await databaseService.query(
        'SELECT * FROM salaries WHERE staff_id = ? ORDER BY salary_month DESC',
        [staffId]
    );
    const advanceRecords = await databaseService.query(
        'SELECT * FROM salary_advances WHERE staff_id = ? ORDER BY date DESC',
        [staffId]
    );

    return {
        staff,
        attendance: attendanceRecords,
        salaries: salaryRecords,
        advances: advanceRecords
    };
};

// ============================================
// BACKUP & RESTORE (.BAK PACKAGE FORMAT)
// ============================================
handlers['backup:create'] = async (event, customName, options = {}) => {
    const rmsPath = databaseService.getAppDataPath();
    const backupDir = path.join(rmsPath, 'storage', 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = customName ? `${customName}.bak` : `RMS_Backup_${timestamp}.bak`;
    const fullBackupPath = path.join(backupDir, filename);

    // Ensure WAL checkpoint
    await databaseService.run('PRAGMA wal_checkpoint(FULL)').catch(() => {});

    const dbPath = databaseService.getDatabasePath();
    if (!fs.existsSync(dbPath)) {
        throw new Error('Database file does not exist to backup');
    }

    const dbData = fs.readFileSync(dbPath);
    const sha256 = crypto.createHash('sha256').update(dbData).digest('hex');
    const company = await databaseService.get('SELECT * FROM companies ORDER BY id DESC LIMIT 1');

    const backupPackage = {
        magic: 'RMS_BAK_PACKAGE',
        version: '1.0.0',
        app_version: '1.0.0',
        created_at: new Date().toISOString(),
        company_id: company?.company_id || 'DEFAULT',
        company_name: company?.company_name || 'RMS Business',
        sha256: sha256,
        database_size: dbData.length,
        is_automatic: options.is_automatic ? 1 : 0,
        notes: options.notes || 'Full database backup',
        database_base64: dbData.toString('base64')
    };

    fs.writeFileSync(fullBackupPath, JSON.stringify(backupPackage, null, 2), 'utf8');
    const stats = fs.statSync(fullBackupPath);

    const res = await databaseService.run(`
        INSERT INTO backup_history (
            backup_name, backup_path, backup_version, app_version, database_version,
            company_id, backup_size, is_automatic, is_valid, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        filename,
        fullBackupPath,
        '1.0.0',
        '1.0.0',
        '1.0.0',
        company?.id || null,
        stats.size,
        options.is_automatic ? 1 : 0,
        1,
        options.notes || 'Full backup',
        currentSessionUser?.id || 1
    ]);

    await logAudit(currentSessionUser?.id, 'CREATE', 'BACKUP', res.lastInsertRowid, 'backup', `Database backup '${filename}' created successfully.`);
    return {
        id: res.lastInsertRowid,
        filename,
        path: fullBackupPath,
        size: stats.size,
        sha256
    };
};

handlers['backup:getHistory'] = async () => {
    return await databaseService.query('SELECT * FROM backup_history ORDER BY id DESC');
};

handlers['backup:verifyBackup'] = async (event, backupPath) => {
    if (!fs.existsSync(backupPath)) throw new Error('Backup file does not exist');
    const content = fs.readFileSync(backupPath, 'utf8');
    let pkg;
    try {
        pkg = JSON.parse(content);
    } catch (e) {
        throw new Error('Invalid backup file format (not a valid RMS .bak package)');
    }

    if (pkg.magic !== 'RMS_BAK_PACKAGE' || !pkg.database_base64 || !pkg.sha256) {
        throw new Error('Corrupted or invalid RMS .bak package structure');
    }

    const dbBuffer = Buffer.from(pkg.database_base64, 'base64');
    const calculatedHash = crypto.createHash('sha256').update(dbBuffer).digest('hex');
    if (calculatedHash !== pkg.sha256) {
        throw new Error('Integrity check failed: Database checksum does not match');
    }

    return {
        valid: true,
        company_name: pkg.company_name,
        created_at: pkg.created_at,
        size: dbBuffer.length,
        version: pkg.version
    };
};

handlers['backup:restore'] = async (event, backupPath) => {
    // 1. Verify selected backup
    const verification = await handlers['backup:verifyBackup'](event, backupPath);
    if (!verification.valid) {
        throw new Error('Cannot restore invalid or corrupt backup package');
    }

    // 2. Create safety backup of current active database
    await handlers['backup:create'](event, `Safety_PreRestore_${Date.now()}`, { notes: 'Automatic safety backup before restore' });

    // 3. Read backup buffer
    const content = fs.readFileSync(backupPath, 'utf8');
    const pkg = JSON.parse(content);
    const dbBuffer = Buffer.from(pkg.database_base64, 'base64');

    // 4. Close existing db connection, overwrite, and re-initialize
    await databaseService.close();
    const activeDbPath = databaseService.getDatabasePath();
    fs.writeFileSync(activeDbPath, dbBuffer);

    // 5. Reinitialize database
    await databaseService.initialize();

    await logAudit(currentSessionUser?.id, 'RESTORE', 'BACKUP', null, 'database', `Database restored from '${path.basename(backupPath)}'.`);
    return { success: true };
};

// ============================================
// THEMES & SETTINGS
// ============================================
handlers['theme:getAll'] = async () => {
    return await databaseService.query('SELECT * FROM themes ORDER BY id ASC');
};

handlers['theme:setActive'] = async (event, themeKey) => {
    await databaseService.run('UPDATE themes SET is_default = 0');
    await databaseService.run('UPDATE themes SET is_default = 1 WHERE theme_key = ?', [themeKey]);
    await databaseService.run('UPDATE app_settings SET setting_value = ? WHERE setting_key = "active_theme"', [themeKey]);
    return { success: true };
};

handlers['settings:getAll'] = async () => {
    return await databaseService.query('SELECT * FROM app_settings ORDER BY category ASC, setting_key ASC');
};

handlers['settings:update'] = async (event, settingsObj) => {
    for (const [key, val] of Object.entries(settingsObj)) {
        await databaseService.run(
            'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = ?, updated_at = CURRENT_TIMESTAMP',
            [key, val.toString(), val.toString()]
        );
    }
    return { success: true };
};

handlers['settings:hardReset'] = async (event, payload = {}) => {
    const { password, confirmPassword } = payload;
    if (!password || !confirmPassword) {
        throw new Error('Please provide your administrator password.');
    }
    if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
    }

    // Verify password against current user or active administrators
    let verified = false;
    if (currentSessionUser && currentSessionUser.id) {
        const userRecord = await databaseService.get('SELECT password_hash FROM users WHERE id = ?', [currentSessionUser.id]);
        if (userRecord && await bcrypt.compare(password, userRecord.password_hash)) {
            verified = true;
        }
    }

    if (!verified) {
        // Check any administrator
        const adminUsers = await databaseService.query(`
            SELECT u.password_hash 
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE r.role_name IN ('Super Admin', 'Administrator', 'Admin') OR u.id = 1
        `);
        for (const admin of adminUsers) {
            if (await bcrypt.compare(password, admin.password_hash)) {
                verified = true;
                break;
            }
        }
    }

    if (!verified) {
        throw new Error('Authentication failed: Invalid administrator password.');
    }

    console.log('HARD RESET AUTHORIZED. Formatting entire application data and database...');
    
    // Create an emergency pre-reset backup before wiping
    try {
        await handlers['backup:create'](event, 'Pre_HardReset_Safety_Backup', { notes: 'Automated backup generated before factory reset' });
    } catch (bErr) {
        console.warn('Pre-reset backup warning:', bErr);
    }

    // Reset session
    currentSessionUser = null;

    // Perform database hard reset
    await databaseService.hardReset();

    return { 
        success: true, 
        message: 'Application has been completely formatted and reset to factory defaults.' 
    };
};


// ============================================
// AUDIT LOGS & NOTIFICATIONS
// ============================================
handlers['audit:getAll'] = async (event, filters = {}) => {
    let sql = `
        SELECT a.*, u.username, u.full_name as user_name
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1
    `;
    const params = [];
    if (filters.module) {
        sql += ' AND a.module = ?';
        params.push(filters.module);
    }
    if (filters.search) {
        sql += ' AND (a.description LIKE ? OR a.action LIKE ? OR u.username LIKE ?)';
        const q = `%${filters.search}%`;
        params.push(q, q, q);
    }
    sql += ' ORDER BY a.id DESC LIMIT 200';
    return await databaseService.query(sql, params);
};

handlers['notification:getAll'] = async () => {
    // Generate real-time dynamic alerts (Visa/Passport expirations, Pending invoices)
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const expiringStaff = await databaseService.query(`
        SELECT id, full_name, passport_expiry_date, visa_expiry_date, national_id_expiry_date
        FROM staff
        WHERE deleted_at IS NULL AND (
            (visa_expiry_date IS NOT NULL AND visa_expiry_date <= ?) OR
            (passport_expiry_date IS NOT NULL AND passport_expiry_date <= ?)
        )
    `, [in30Days, in30Days]);

    const notifs = [];
    expiringStaff.forEach(s => {
        if (s.visa_expiry_date && s.visa_expiry_date <= in30Days) {
            notifs.push({
                id: `visa-${s.id}`,
                title: 'Visa Expiry Warning',
                message: `Staff member ${s.full_name}'s visa expires on ${s.visa_expiry_date}`,
                priority: s.visa_expiry_date <= today ? 'high' : 'medium',
                created_at: today
            });
        }
    });

    const dbNotifs = await databaseService.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 50');
    return [...notifs, ...dbNotifs];
};

handlers['notification:markAsRead'] = async (event, notificationId) => {
    await databaseService.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);
    return { success: true };
};

handlers['notification:markAllAsRead'] = async () => {
    await databaseService.run('UPDATE notifications SET is_read = 1');
    return { success: true };
};

// ============================================
// FILE & PRINTING
// ============================================
handlers['file:selectFile'] = async (event, filters = []) => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: filters.length ? filters : [{ name: 'All Files', extensions: ['*'] }]
    });
    return res.canceled ? null : res.filePaths[0];
};

handlers['file:saveFile'] = async (event, defaultName, filters = []) => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win, {
        defaultPath: defaultName,
        filters: filters.length ? filters : [{ name: 'All Files', extensions: ['*'] }]
    });
    return res.canceled ? null : res.filePath;
};

handlers['print:printContent'] = async (event, htmlContent, options = {}) => {
    const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    return new Promise((resolve) => {
        printWin.webContents.print({
            silent: options.silent || false,
            printBackground: true,
            deviceName: options.deviceName || ''
        }, (success, errorType) => {
            printWin.close();
            if (!success && errorType !== 'cancelled') {
                console.error('Printing failed:', errorType);
                resolve({ success: false, error: errorType });
            } else {
                resolve({ success: true });
            }
        });
    });
};

// App version info
handlers['app:getVersion'] = async () => {
    return '1.0.0';
};

module.exports = handlers;
