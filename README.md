# 🚀 RMS — Report Management System (Enterprise Pro)

[![Version](https://img.shields.io/badge/version-1.0.0--Pro-blue.svg)](https://github.com/infovirtuspk-png/RMS-Report-Management-System-Enterprise-Pro-/releases/tag/v1.0.0)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d7.svg)](https://microsoft.com/windows)
[![Database](https://img.shields.io/badge/database-SQLite%203%20(WAL)-003b57.svg)](https://sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Offline](https://img.shields.io/badge/mode-100%25%20Offline%20Desktop-success.svg)]()

## 📥 Download Latest Release

[![Download](https://img.shields.io/badge/Download-Setup%20v1.0.0-brightgreen.svg?style=for-the-badge&logo=windows)](https://github.com/infovirtuspk-png/RMS-Report-Management-System-Enterprise-Pro-/releases/download/v1.0.0/RMS-Report-Management-System-Setup-1.0.0.exe)

**Click the button above to download the Windows installer (.exe)**

> **RMS (Report Management System)** is a state-of-the-art, 100% offline enterprise desktop management and business intelligence suite built for Windows. Designed with an ultra-modern glassmorphic UI, rich animations, real-time telemetry, and an embedded high-concurrency SQLite WAL engine.

---

## 🌟 Key Highlights & Architectural Features

- 🛡️ **100% Offline & Private**: Zero cloud dependency. All financial records, staff profiles, invoices, and system audit logs are stored securely in local SQLite with WAL multi-threaded concurrency.
- 💎 **Modern Glassmorphic UI/UX**: Frosted glass cards (`backdrop-filter`), ambient animated glowing orbs, fluid micro-interactions, and 8 professional themes.
- 🔒 **Dedicated Standalone Lock Sandbox (`lockapplication.html`)**: Complete DOM-isolated security barrier with persistent SQLite state (`app_is_locked`), custom quick PIN, and session memory.
- 🕒 **Real-Time Date, Time & Day HUD Capsule**: Live animated radar beacon (`● LIVE`), glowing day badge, high-precision digital clock, and single-click 12h/24h format toggling.
- 🖨️ **Multi-Format Hardware Printing**: Seamless output for Standard A4 Invoices, 80mm POS Thermal Receipts, and 58mm Mini Slips with full VAT/TRN compliance.
- 📥 **Automated System Tray & Background Engine**: Hibernates silently to the Windows System Tray on close/minimize with instant wake-up and auto-backup timers.

---

## 📦 Complete Business Modules (19 Modules)

### 1. Financial & Commercial Suite
- **📊 Interactive Dashboard**: Real-time revenue, operating expenses, net profit, margin analytics, and responsive Chart.js trends.
- **💵 Income Management**: Categorized revenue tracking, payment methods (Cash, Bank Transfer, Card, Cheque), search, and CSV export.
- **🧾 Expense Tracking**: Categorized operating expenditure, receipt attachments, tax deductions, and expense ledgers.
- **📈 Profit & Loss Statement**: Real-time financial reports across Custom Dates, This Month, Last Month, and Year-to-Date with printable statements.
- **📑 Invoice Engine**: Itemized commercial billing, customer linking, tax calculation, payment status tracking, and multi-format thermal printing.
- **👥 Customer Directory**: Client registry, transaction ledger history, credit tracking, and outstanding balance summaries.
- **💱 Global Multi-Currency Manager**: Live base currency configuration (AED, USD, EUR, GBP, SAR, PKR, INR) with immediate UI synchronization.

### 2. Human Resources & Automated Payroll
- **👨‍💼 Staff Management**: Complete employee directory with departmental tagging, basic salary, document attachments, and visa/passport expiry warnings.
- **📅 Daily Attendance Grid**: Multi-status employee attendance tracking (Present, Absent, Late, Half-Day, Leave) with monthly attendance scoring.
- **💸 Salary Advances**: Advance loan disbursements with automatic deduction linking directly into monthly payroll.
- **💰 Automated Payroll Engine**: One-click salary calculation formula:
  $$\text{Net Salary} = \text{Basic} + \text{Allowances} + \text{Overtime} + \text{Bonuses} - \text{Deductions} - \text{Advance Recoveries}$$
  Includes printable employee pay slips.
- **⭐ Performance & KPI Evaluation**: Staff grading, attendance consistency scoring, and manager performance evaluation records.

### 3. Reporting & Business Intelligence
- **📋 Daily Reports**: Automated end-of-day (EOD) closing statement consolidating daily income, operating expenses, sales, and attendance.
- **📑 Custom Reports Generator**: Cross-module report builder (Financial, HR, Sales, Tax) with instant CSV downloads and print formatting.

### 4. System Administration, Diagnostics & Security
- **🔐 Dedicated Lock Sandbox**: Persistent application locking preventing unauthorized access during operator absence.
- **👤 User Management & RBAC**: Admin/Manager/Staff account creation with bcrypt password hashing and granular permissions.
- **⚙️ Application Settings Center**: Company profiles, 8 themes switcher, tray preferences, lock PIN configuration, and hard reset utilities.
- **🗄️ Database Backup & Restore**: One-click manual backup generation, automated background backup scheduler, and safe file restoration.
- **📜 Immutable Audit Logs**: Chronological audit trail logging user authentication, lock/unlock events, record creations, edits, and deletions.
- **ℹ️ About & System Diagnostics**: Live SQLite database integrity telemetry (`PRAGMA integrity_check`), memory footprint, indexed row counters, and system specs copy tool.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | Electron.js (Context Isolation & Secure Preload Bridge) |
| **Backend Runtime** | Node.js (Asynchronous Native IPC) |
| **Database Engine** | Embedded SQLite 3 (WAL Journal Mode & Foreign Key Constraints) |
| **Frontend Architecture** | Modern Vanilla JavaScript ES6+, HTML5, CSS3 Glassmorphism |
| **Design System** | Bootstrap 5, FontAwesome 6 Pro, Google Inter Typography |
| **Data Visualization** | Chart.js with responsive canvas rendering |
| **Security Architecture** | Bcrypt password hashing, Strict Content Security Policy (CSP) |

---

## 🚀 Installation & Getting Started

### Prerequisites
- **Node.js** (v16.0.0 or higher recommended)
- **npm** (v8.0.0 or higher)
- **OS**: Windows 10 or Windows 11 (x64)

### Quick Start
```powershell
# 1. Clone or navigate to the repository directory
cd g:\App\RMS

# 2. Install project dependencies
npm install

# 3. Launch the application in development mode
npm start
```

### Production Build (Windows Installer)
```powershell
# Generate standalone Windows executable installer (.exe)
npm run build:win
```
The output package will be generated inside the `dist/` or `build/` directory.

---

## 🏁 Initial Setup Wizard Flow

When launched on a clean system, RMS automatically guides you through a 3-step initialization flow:

1. **Company Registration Wizard (`setup.html`)**:
   - Organization name, trade license number, tax/VAT registration (TRN), and contact information.
   - Base operating currency selection (AED, USD, EUR, GBP, SAR, PKR, INR).
   - Document prefixes (`INV`, `REP`) and fiscal calendar configuration.
2. **Master Administrator Setup (`admin-setup.html`)**:
   - Root administrator credentials creation with real-time password strength meter.
3. **Login & Dashboard Initialization (`login.html` &rarr; `index.html`)**:
   - Secure authentication and automatic workspace configuration.

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + K` | Open Global Search modal |
| `Ctrl + L` | Lock Application immediately |
| `Ctrl + S` | Save / Submit active form |
| `Ctrl + P` | Trigger Hardware Print (Invoice / Report) |
| `Ctrl + B` | Quick Database Backup |
| `Esc` | Close active modal dialog |
| `Enter` | Submit Lock / Login screen |

---

## 📁 Local Data Directory Structure

All persistent application data is stored in the user's local Windows AppData directory:
`%APPDATA%\RMS\`

```text
%APPDATA%/RMS/
├── database/
│   └── rms.db               # Primary SQLite Embedded Database
├── storage/
│   ├── staff/               # Employee identity documents & contracts
│   ├── company/             # Company logos and official stamps
│   ├── invoices/            # Generated PDF / print invoice snapshots
│   ├── reports/             # Exported financial statements & reports
│   └── backups/             # Encrypted .bak database backup archives
└── logs/
    └── rms-system.log       # Background task execution logs
```

---

## 🎨 8 Professional Built-in Themes

Switch between themes instantly from the top navbar or Settings Center:
1. ☀️ **Professional Light** — Crisp corporate layout (Default Light)
2. 🌙 **Professional Dark** — Deep indigo dark workspace
3. 🌊 **Ocean Blue** — Modern vibrant navy & sky blue
4. 🌿 **Emerald Green** — Clean mint & forest green
5. 🔮 **Royal Purple** — Ultra-modern glassmorphic purple
6. 🌌 **Midnight Blue** — Sleek dark night environment
7. ⚡ **Cyberpunk Neon** — High-contrast dark with electric accents
8. 🏢 **Corporate Slate** — Minimalist graphite monochrome

---

## 👨‍💻 Developer & Architectural Credits

- **Principal Architect & Lead Developer**: **Engineer Qasim Ahmad**
- **Email**: [info.virtuspk@gmail.com](mailto:info.virtuspk@gmail.com)
- **Organization**: Virtus Enterprise Systems

---

## 📄 License

This project is open-source software licensed under the **[MIT License](LICENSE)**.
You are free to use, modify, and distribute this software in accordance with the license conditions.

---

<p align="center">
  <strong>RMS — Report Management System</strong><br>
  <em>Built for high performance, uncompromising security, and seamless offline operations.</em>
</p>
