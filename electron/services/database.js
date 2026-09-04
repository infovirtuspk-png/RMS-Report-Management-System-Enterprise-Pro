const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = null;
        this.rmsDataPath = null;
    }

    getAppDataPath() {
        if (this.rmsDataPath) return this.rmsDataPath;
        let appDataPath;
        try {
            const { app } = require('electron');
            if (app && typeof app.getPath === 'function') {
                appDataPath = app.getPath('userData') || app.getPath('appData');
            }
        } catch (e) {
            // Not in electron or app not ready
        }
        if (!appDataPath) {
            appDataPath = path.join(process.env.APPDATA || process.env.USERPROFILE || process.cwd(), 'RMS_Data');
        }
        this.rmsDataPath = path.join(appDataPath, 'RMS');
        return this.rmsDataPath;
    }

    initialize() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                return resolve(this.db);
            }

            const rmsDataPath = this.getAppDataPath();

            // Create directories if they don't exist
            if (!fs.existsSync(rmsDataPath)) {
                fs.mkdirSync(rmsDataPath, { recursive: true });
            }

            // Create subdirectories
            const subdirs = [
                'database',
                'storage',
                'storage/staff',
                'storage/company',
                'storage/invoices',
                'storage/reports',
                'storage/backups',
                'logs'
            ];
            subdirs.forEach(dir => {
                const fullPath = path.join(rmsDataPath, dir);
                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                }
            });

            // Database path
            this.dbPath = path.join(rmsDataPath, 'database', 'rms.db');

            // Initialize database
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Database connection error:', err);
                    return reject(err);
                }
                console.log('Connected to SQLite database at:', this.dbPath);
                this.db.run('PRAGMA journal_mode = WAL');
                this.db.run('PRAGMA foreign_keys = ON');
                this.db.run('PRAGMA busy_timeout = 5000');

                // Guarantee settings and app_settings tables are created
                this.db.serialize(() => {
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS app_settings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            setting_key TEXT UNIQUE NOT NULL,
                            setting_value TEXT,
                            category TEXT DEFAULT 'general',
                            description TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS settings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            setting_key TEXT UNIQUE NOT NULL,
                            setting_value TEXT,
                            category TEXT DEFAULT 'general',
                            description TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    this.runMigrations((migErr) => {
                        if (migErr) {
                            console.error('Migration error:', migErr);
                            return reject(migErr);
                        }
                        resolve(this.db);
                    });
                });
            });
        });
    }

    getDatabase() {
        if (!this.db) {
            throw new Error('Database is not initialized. Call initialize() first.');
        }
        return this.db;
    }

    getDatabasePath() {
        return this.dbPath;
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('SQL query error:', err, 'SQL:', sql);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('SQL get error:', err, 'SQL:', sql);
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.error('SQL run error:', err, 'SQL:', sql);
                    reject(err);
                } else {
                    resolve({ lastInsertRowid: this.lastID, changes: this.changes });
                }
            });
        });
    }

    exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) {
                    console.error('SQL exec error:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async transaction(operations) {
        await this.run('BEGIN TRANSACTION');
        try {
            const results = [];
            for (const op of operations) {
                const res = await this.run(op.sql, op.params || []);
                results.push(res);
            }
            await this.run('COMMIT');
            return results;
        } catch (error) {
            await this.run('ROLLBACK').catch(() => {});
            throw error;
        }
    }

    runMigrations(callback) {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating migrations table:', err);
                if (callback) callback(err);
                return;
            }

            this.db.get('SELECT MAX(version) as version FROM schema_migrations', (verErr, row) => {
                if (verErr) {
                    console.error('Error getting migration version:', verErr);
                    if (callback) callback(verErr);
                    return;
                }

                const currentVersion = row?.version || 0;
                if (currentVersion === 0) {
                    const schemaPath = path.join(__dirname, '../../database/schema/schema.sql');
                    if (fs.existsSync(schemaPath)) {
                        const schema = fs.readFileSync(schemaPath, 'utf8');
                        this.db.exec(schema, (execErr) => {
                            if (execErr) {
                                console.error('Error applying initial schema:', execErr);
                                if (callback) callback(execErr);
                            } else {
                                this.db.run('INSERT INTO schema_migrations (version) VALUES (1)', (insErr) => {
                                    if (insErr) {
                                        if (callback) callback(insErr);
                                    } else {
                                        console.log('Database initial schema applied successfully.');
                                        if (callback) callback(null);
                                    }
                                });
                            }
                        });
                    } else {
                        if (callback) callback(null);
                    }
                } else {
                    if (callback) callback(null);
                }
            });
        });
    }

    async getHealth() {
        const integrity = await this.get('PRAGMA integrity_check');
        const stats = {};
        if (this.dbPath && fs.existsSync(this.dbPath)) {
            const fileStat = fs.statSync(this.dbPath);
            stats.sizeBytes = fileStat.size;
            stats.sizeFormatted = (fileStat.size / (1024 * 1024)).toFixed(2) + ' MB';
            stats.lastModified = fileStat.mtime;
        }
        
        // Count records across primary tables
        const tables = [
            'companies', 'users', 'staff', 'attendance', 'salaries',
            'salary_advances', 'income', 'expenses', 'invoices', 'customers',
            'currencies', 'audit_logs', 'backup_history'
        ];
        
        const counts = {};
        for (const tbl of tables) {
            try {
                const res = await this.get(`SELECT COUNT(*) as count FROM ${tbl}`);
                counts[tbl] = res ? res.count : 0;
            } catch (e) {
                counts[tbl] = 0;
            }
        }

        return {
            integrity: integrity ? integrity.integrity_check : 'unknown',
            stats,
            counts,
            dbPath: this.dbPath
        };
    }

    async hardReset() {
        console.log('Performing Database Hard Reset...');
        await this.close();

        // Delete rms.db and WAL files if they exist
        const dbFiles = [
            this.dbPath,
            this.dbPath + '-wal',
            this.dbPath + '-shm'
        ];

        for (const file of dbFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log('Deleted database file:', file);
                }
            } catch (err) {
                console.error('Error deleting file during hard reset:', file, err);
            }
        }

        // Re-initialize a completely fresh database with initial schema and default seeds
        await this.initialize();
        console.log('Database Hard Reset completed successfully.');
        return true;
    }

    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) console.error('Error closing database:', err);
                    this.db = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new DatabaseService();
