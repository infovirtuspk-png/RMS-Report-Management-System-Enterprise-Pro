-- RMS Database Schema
-- Complete relational database structure for Report Management System

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- COMPANY & SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    legal_company_name TEXT,
    trade_name TEXT,
    company_type TEXT,
    business_activity TEXT,
    registration_number TEXT,
    trade_license_number TEXT,
    tax_vat_number TEXT,
    establishment_number TEXT,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    alternate_phone TEXT,
    website TEXT,
    address TEXT,
    area TEXT,
    city TEXT,
    state_province TEXT,
    country TEXT,
    postal_code TEXT,
    currency TEXT,
    currency_symbol TEXT,
    time_zone TEXT,
    company_logo_path TEXT,
    company_stamp_path TEXT,
    authorized_person TEXT,
    authorized_person_designation TEXT,
    invoice_prefix TEXT DEFAULT 'INV',
    report_prefix TEXT DEFAULT 'REP',
    financial_year_start TEXT,
    invoice_footer TEXT,
    report_footer TEXT,
    terms_conditions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role_id INTEGER,
    status TEXT DEFAULT 'active',
    last_login DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until DATETIME,
    must_change_password INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_name TEXT UNIQUE NOT NULL,
    permission_key TEXT UNIQUE NOT NULL,
    module TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    can_view INTEGER DEFAULT 0,
    can_create INTEGER DEFAULT 0,
    can_edit INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    can_print INTEGER DEFAULT 0,
    can_export INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    record_id INTEGER,
    record_type TEXT,
    description TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- STAFF MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS staff_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_designations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation_name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    fathers_name TEXT,
    mothers_name TEXT,
    gender TEXT,
    date_of_birth DATE,
    age INTEGER,
    marital_status TEXT,
    nationality TEXT,
    religion TEXT,
    blood_group TEXT,
    profile_image_path TEXT,
    
    -- Contact Information
    whatsapp_number TEXT,
    calling_number TEXT,
    alternate_number TEXT,
    email TEXT,
    current_address TEXT,
    permanent_address TEXT,
    city TEXT,
    country TEXT,
    
    -- Identification
    national_id_number TEXT,
    national_id_issue_date DATE,
    national_id_expiry_date DATE,
    passport_number TEXT,
    passport_issue_date DATE,
    passport_expiry_date DATE,
    visa_number TEXT,
    visa_expiry_date DATE,
    labour_card_number TEXT,
    work_permit_number TEXT,
    
    -- Employment
    department_id INTEGER,
    designation_id INTEGER,
    joining_date DATE,
    employment_type TEXT,
    contract_type TEXT,
    basic_salary DECIMAL(10,2),
    allowance DECIMAL(10,2),
    total_salary DECIMAL(10,2),
    payment_frequency TEXT,
    bank_name TEXT,
    account_number TEXT,
    salary_payment_method TEXT,
    status TEXT DEFAULT 'active',
    
    -- Audit
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    deleted_by INTEGER,
    
    FOREIGN KEY (department_id) REFERENCES staff_departments(id),
    FOREIGN KEY (designation_id) REFERENCES staff_designations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS staff_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    document_category TEXT NOT NULL,
    document_name TEXT NOT NULL,
    document_path TEXT NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- ============================================
-- ATTENDANCE
-- ============================================

CREATE TABLE IF NOT EXISTS attendance_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_start_time TEXT DEFAULT '09:00',
    work_end_time TEXT DEFAULT '18:00',
    grace_period_minutes INTEGER DEFAULT 15,
    half_day_hours DECIMAL(4,2) DEFAULT 4.0,
    full_day_hours DECIMAL(4,2) DEFAULT 8.0,
    overtime_rate_multiplier DECIMAL(4,2) DEFAULT 1.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    date DATE NOT NULL,
    check_in DATETIME,
    check_out DATETIME,
    total_hours DECIMAL(4,2),
    status TEXT DEFAULT 'present',
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(staff_id, date)
);

-- ============================================
-- SALARIES
-- ============================================

CREATE TABLE IF NOT EXISTS salaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salary_number TEXT UNIQUE NOT NULL,
    staff_id INTEGER NOT NULL,
    salary_month TEXT NOT NULL,
    basic_salary DECIMAL(10,2) NOT NULL,
    allowances DECIMAL(10,2) DEFAULT 0,
    overtime DECIMAL(10,2) DEFAULT 0,
    bonus DECIMAL(10,2) DEFAULT 0,
    deduction DECIMAL(10,2) DEFAULT 0,
    advance_deduction DECIMAL(10,2) DEFAULT 0,
    other_deduction DECIMAL(10,2) DEFAULT 0,
    net_salary DECIMAL(10,2) NOT NULL,
    payment_date DATE,
    payment_method TEXT,
    currency TEXT,
    payment_status TEXT DEFAULT 'pending',
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS salary_advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advance_number TEXT UNIQUE NOT NULL,
    staff_id INTEGER NOT NULL,
    staff_name TEXT NOT NULL,
    date DATE NOT NULL,
    advance_amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL,
    reason TEXT,
    approved_by INTEGER,
    deduction_month TEXT,
    deduction_amount DECIMAL(10,2) DEFAULT 0,
    remaining_balance DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- INCOME & EXPENSES
-- ============================================

CREATE TABLE IF NOT EXISTS income_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    income_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    category_id INTEGER,
    description TEXT NOT NULL,
    customer_id INTEGER,
    invoice_reference TEXT,
    payment_method TEXT NOT NULL,
    currency TEXT NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    amount DECIMAL(10,2) NOT NULL,
    base_currency_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    deleted_by INTEGER,
    FOREIGN KEY (category_id) REFERENCES income_categories(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    category_id INTEGER,
    description TEXT NOT NULL,
    vendor_id INTEGER,
    payment_method TEXT NOT NULL,
    currency TEXT NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    amount DECIMAL(10,2) NOT NULL,
    base_currency_amount DECIMAL(10,2) NOT NULL,
    receipt_reference TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    deleted_by INTEGER,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (deleted_by) REFERENCES users(id)
);

-- ============================================
-- CUSTOMERS & VENDORS
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    country TEXT,
    tax_vat_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    country TEXT,
    tax_vat_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- ============================================
-- INVOICES
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    due_date DATE,
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    base_currency_total DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    balance_amount DECIMAL(10,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    invoice_status TEXT DEFAULT 'draft',
    notes TEXT,
    terms_conditions TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    deleted_by INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    item_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    line_total DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT UNIQUE NOT NULL,
    invoice_id INTEGER NOT NULL,
    date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    base_currency_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    reference TEXT,
    notes TEXT,
    received_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by) REFERENCES users(id)
);

-- ============================================
-- CURRENCIES
-- ============================================

CREATE TABLE IF NOT EXISTS currencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency_code TEXT UNIQUE NOT NULL,
    currency_name TEXT NOT NULL,
    currency_symbol TEXT NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    is_base_currency INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- REPORTS
-- ============================================

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_number TEXT UNIQUE NOT NULL,
    report_type TEXT NOT NULL,
    report_date DATE NOT NULL,
    date_from DATE,
    date_to DATE,
    company_id INTEGER,
    prepared_by INTEGER,
    total_income DECIMAL(10,2) DEFAULT 0,
    total_expenses DECIMAL(10,2) DEFAULT 0,
    net_profit DECIMAL(10,2) DEFAULT 0,
    total_staff INTEGER DEFAULT 0,
    present_staff INTEGER DEFAULT 0,
    absent_staff INTEGER DEFAULT 0,
    leave_staff INTEGER DEFAULT 0,
    total_salary_advance DECIMAL(10,2) DEFAULT 0,
    total_invoices INTEGER DEFAULT 0,
    paid_invoices INTEGER DEFAULT 0,
    pending_invoices INTEGER DEFAULT 0,
    notes TEXT,
    remarks TEXT,
    report_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (prepared_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS report_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- APP SETTINGS & THEMES
-- ============================================

CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    category TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theme_name TEXT UNIQUE NOT NULL,
    theme_key TEXT UNIQUE NOT NULL,
    is_default INTEGER DEFAULT 0,
    theme_variables TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BACKUP & NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_name TEXT UNIQUE NOT NULL,
    backup_path TEXT NOT NULL,
    backup_version TEXT NOT NULL,
    app_version TEXT,
    database_version TEXT,
    company_id INTEGER,
    backup_size INTEGER,
    backup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_automatic INTEGER DEFAULT 0,
    is_valid INTEGER DEFAULT 1,
    notes TEXT,
    created_by INTEGER,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id INTEGER,
    reference_type TEXT,
    priority TEXT DEFAULT 'normal',
    is_read INTEGER DEFAULT 0,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Staff indexes
CREATE INDEX IF NOT EXISTS idx_staff_employee_code ON staff(employee_code);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department_id);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- Salary indexes
CREATE INDEX IF NOT EXISTS idx_salaries_staff_month ON salaries(staff_id, salary_month);
CREATE INDEX IF NOT EXISTS idx_salaries_status ON salaries(payment_status);

-- Income/Expense indexes
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_income_category ON income(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ============================================
-- INITIAL SEED DATA
-- ============================================

-- Default Roles
INSERT OR IGNORE INTO roles (id, role_name, description, is_system) VALUES 
(1, 'Super Admin', 'Full system access and administrator privileges', 1),
(2, 'Administrator', 'Administrative access to all business modules', 1),
(3, 'Manager', 'Operations and reporting management', 1),
(4, 'Accountant', 'Financial operations, invoices, income, and expenses', 1),
(5, 'HR Manager', 'Staff management, attendance, and payroll', 1),
(6, 'Staff/User', 'Standard user with basic access', 1),
(7, 'Viewer', 'Read-only access to authorized reports and dashboard', 1);

-- Default Currencies
INSERT OR IGNORE INTO currencies (currency_code, currency_name, currency_symbol, decimal_places, exchange_rate, is_base_currency, status) VALUES
('AED', 'UAE Dirham', 'AED', 2, 1.0, 1, 'active'),
('USD', 'US Dollar', '$', 2, 0.2723, 0, 'active'),
('EUR', 'Euro', '€', 2, 0.2500, 0, 'active'),
('GBP', 'British Pound', '£', 2, 0.2150, 0, 'active'),
('SAR', 'Saudi Riyal', 'SAR', 2, 1.0210, 0, 'active'),
('PKR', 'Pakistani Rupee', '₨', 2, 75.80, 0, 'active'),
('INR', 'Indian Rupee', '₹', 2, 22.85, 0, 'active'),
('QAR', 'Qatari Rial', 'QAR', 2, 0.9910, 0, 'active'),
('OMR', 'Omani Rial', 'OMR', 3, 0.1048, 0, 'active'),
('KWD', 'Kuwaiti Dinar', 'KWD', 3, 0.0837, 0, 'active'),
('BHD', 'Bahraini Dinar', 'BHD', 3, 0.1026, 0, 'active'),
('CAD', 'Canadian Dollar', 'CA$', 2, 0.3700, 0, 'active'),
('AUD', 'Australian Dollar', 'AU$', 2, 0.4100, 0, 'active');

-- Default Income Categories
INSERT OR IGNORE INTO income_categories (category_name, description, status) VALUES
('Sales Revenue', 'Income from product or service sales', 'active'),
('Consulting Services', 'Income from consulting and professional advisory', 'active'),
('Maintenance & Support', 'Income from ongoing support and maintenance contracts', 'active'),
('Rental Income', 'Income from equipment or property rental', 'active'),
('Commissions', 'Income from commissions and brokerages', 'active'),
('Other Income', 'Miscellaneous business income', 'active');

-- Default Expense Categories
INSERT OR IGNORE INTO expense_categories (category_name, description, status) VALUES
('Rent', 'Office, warehouse or facility rent', 'active'),
('Electricity & Utilities', 'Power, water, and essential utilities', 'active'),
('Internet & Telecom', 'Broadband, phone lines, and communication', 'active'),
('Transport & Travel', 'Fuel, vehicle maintenance, and business travel', 'active'),
('Office Supplies & Stationery', 'Paper, pens, toner, and general office items', 'active'),
('Salaries & Wages', 'Staff payroll and remuneration', 'active'),
('Marketing & Advertising', 'Promotions, digital ads, and printing flyers', 'active'),
('Software & Subscriptions', 'Offline software licenses and tools', 'active'),
('Maintenance & Repairs', 'Equipment, AC, and hardware repairs', 'active'),
('Government & Visa Fees', 'Trade license renewals, visa fees, and permits', 'active'),
('Other Expenses', 'Miscellaneous day-to-day business expenses', 'active');

-- Default Departments
INSERT OR IGNORE INTO staff_departments (department_name, description, status) VALUES
('Administration', 'Executive and office administrative management', 'active'),
('Finance & Accounts', 'Bookkeeping, invoicing, and financial management', 'active'),
('Human Resources', 'Recruitment, personnel, and payroll', 'active'),
('Operations', 'Daily business operations and logistics', 'active'),
('Sales & Marketing', 'Customer relations, sales, and outreach', 'active'),
('IT & Technical Support', 'Technical infrastructure and maintenance', 'active');

-- Default Designations
INSERT OR IGNORE INTO staff_designations (designation_name, description, status) VALUES
('General Manager', 'Overall business operations leader', 'active'),
('Operations Manager', 'Supervision of daily workflows', 'active'),
('Senior Accountant', 'Financial records and tax accounting', 'active'),
('HR Executive', 'Personnel and attendance coordinator', 'active'),
('Sales Executive', 'Customer sales and order processing', 'active'),
('Administrative Assistant', 'Office paperwork and clerical tasks', 'active'),
('Technician', 'Field operations and repairs', 'active'),
('Driver', 'Logistics and delivery', 'active');

-- Default 7 Themes
INSERT OR IGNORE INTO themes (id, theme_name, theme_key, is_default) VALUES
(1, 'Professional Light', 'professional-light', 1),
(2, 'Professional Dark', 'professional-dark', 0),
(3, 'Ocean Blue', 'ocean-blue', 0),
(4, 'Emerald', 'emerald', 0),
(5, 'Royal Purple', 'royal-purple', 0),
(6, 'Midnight', 'midnight', 0),
(7, 'Graphite', 'graphite', 0);

-- Default Application Settings
INSERT OR IGNORE INTO app_settings (setting_key, setting_value, setting_type, category, description) VALUES
('app_name', 'RMS', 'string', 'general', 'Application Name'),
('app_full_name', 'Report Management System', 'string', 'general', 'Application Full Name'),
('date_format', 'YYYY-MM-DD', 'string', 'general', 'Date Display Format'),
('time_format', 'HH:mm:ss', 'string', 'general', 'Time Display Format'),
('language', 'en', 'string', 'general', 'System Language'),
('first_day_of_week', '1', 'string', 'general', 'First Day of Week (1=Mon, 0=Sun)'),
('active_theme', 'professional-light', 'string', 'appearance', 'Active User Theme'),
('animations_enabled', '1', 'boolean', 'appearance', 'Enable UI Micro-Animations'),
('auto_lock_timeout', '30', 'integer', 'security', 'Auto Lock Inactivity in Minutes (0=disabled)'),
('thermal_printer_width', '80', 'integer', 'invoice', 'Thermal Receipt Width in mm (58 or 80)'),
('invoice_prefix', 'RMS-INV', 'string', 'invoice', 'Invoice Number Prefix'),
('report_prefix', 'RMS-REP', 'string', 'report', 'Report Number Prefix'),
('backup_retention_count', '10', 'integer', 'backup', 'Maximum Local Backups to Retain'),
('auto_backup_on_exit', '1', 'boolean', 'backup', 'Create Local Backup on App Exit');

