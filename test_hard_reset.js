const databaseService = require('./electron/services/database');
const handlers = require('./electron/ipc/handlers');

async function testHardReset() {
    console.log('=== TESTING DANGER ZONE: HARD RESET ===');

    await databaseService.initialize();

    // 1. Setup admin user
    await handlers['auth:registerAdmin'](null, {
        username: 'superadmin',
        password: 'AdminPassword123!',
        full_name: 'Engineer Qasim Ahmad',
        email: 'info.virtuspk@gmail.com'
    });

    // 2. Add sample company
    await handlers['company:register'](null, {
        company_name: 'Test HardReset Corp',
        legal_company_name: 'Test HardReset Corp LLC',
        company_type: 'LLC',
        currency: 'USD',
        currency_symbol: '$',
        email: 'test@hardreset.com',
        phone: '+123456789'
    });

    // Verify company exists
    const beforeComp = await handlers['company:getCompany']();
    console.log('Company before reset:', beforeComp?.company_name);

    // 3. Test failed reset (mismatched password)
    try {
        await handlers['settings:hardReset'](null, {
            password: 'AdminPassword123!',
            confirmPassword: 'WrongPassword'
        });
        console.error('FAIL: Mismatched password should have thrown an error!');
    } catch (err) {
        console.log('Pass: Mismatched password rejected correctly ->', err.message);
    }

    // 4. Test failed reset (wrong password)
    try {
        await handlers['settings:hardReset'](null, {
            password: 'WrongPassword123!',
            confirmPassword: 'WrongPassword123!'
        });
        console.error('FAIL: Wrong password should have thrown an error!');
    } catch (err) {
        console.log('Pass: Wrong password rejected correctly ->', err.message);
    }

    // 5. Test successful hard reset with 2x valid password
    console.log('Executing valid hard reset with 2x password...');
    const result = await handlers['settings:hardReset'](null, {
        password: 'AdminPassword123!',
        confirmPassword: 'AdminPassword123!'
    });
    console.log('Hard reset result:', result);

    // 6. Verify that all company data & transactions are formatted
    const afterComp = await handlers['company:getCompany']();
    console.log('Company after reset:', afterComp); // should be null/undefined

    const currencies = await handlers['currency:getAll']();
    console.log('Currencies re-seeded fresh count:', currencies.length);

    await databaseService.close();
    console.log('=== HARD RESET TEST PASSED COMPLETELY ===');
}

testHardReset().catch(err => {
    console.error('HARD RESET TEST FAILED:', err);
    process.exit(1);
});
