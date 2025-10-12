/**
 * ===================================================================================
 * Application Bootstrap
 * ===================================================================================
 *
 * Setup Dependency Injection Container dan register semua services.
 * File ini harus dimuat setelah semua class definitions.
 */

// Create global container instance
const AppContainer = new Container();

// ============================================================================
// CORE SERVICES
// ============================================================================

// Database service (already exists as global DB)
AppContainer.register('db', () => window.DB);

// HTTP service
AppContainer.register('http', () => window.Http);

// Config (already exists as global CONFIG_APPS)
AppContainer.register('config', () => window.CONFIG_APPS);

// ============================================================================
// REPOSITORIES
// ============================================================================

AppContainer.register('coinRepository', (container) => {
    return new CoinRepository(window.DB);
});

AppContainer.register('syncRepository', (container) => {
    return new SyncRepository(window.DB);
});

AppContainer.register('settingsRepository', (container) => {
    return new SettingsRepository(window.DB);
});

AppContainer.register('historyRepository', (container) => {
    return new HistoryRepository(window.DB);
});

// ============================================================================
// SERVICES
// ============================================================================

AppContainer.register('web3Service', (container) => {
    return new Web3Service(container.get('config'));
});

AppContainer.register('cexWalletService', (container) => {
    const secrets = {}; // Will be loaded from settings
    return new CheckWalletExchanger(secrets, container.get('config'), container.get('http'));
});

AppContainer.register('cexPriceFetcher', (container) => {
    return new CexPriceFetcher(container.get('config'), container.get('http'));
});

AppContainer.register('dexQuoteFetcher', (container) => {
    // Will need globalSettings - can be loaded dynamically
    return new DexDataFetcher(container.get('config'), container.get('http'), null);
});

AppContainer.register('realtimeDataFetcher', (container) => {
    return new RealtimeDataFetcher(container.get('config'), container.get('http'));
});

AppContainer.register('pnlCalculator', (container) => {
    return new PnlCalculator(container.get('config'));
});

AppContainer.register('telegramService', (container) => {
    const credentials = { botToken: '', chatId: '' }; // Will be loaded from settings
    return new TelegramService(credentials, container.get('http'));
});

AppContainer.register('priceScanner', (container) => {
    const config = container.get('config');
    const services = {
        cexFetcher: container.get('cexPriceFetcher'),
        dexFetcher: container.get('dexQuoteFetcher'),
        realtimeFetcher: container.get('realtimeDataFetcher'),
        pnlCalculator: container.get('pnlCalculator'),
        telegramService: container.get('telegramService')
    };

    return new PriceScanner(config, services);
});

// ============================================================================
// UTILITIES
// ============================================================================

AppContainer.register('formatters', () => window.Formatters);
AppContainer.register('validators', () => window.Validators);

// Export container ke global scope
if (typeof window !== 'undefined') {
    window.AppContainer = AppContainer;
}

