/**
 * ===================================================================================
 * Dependency Injection Container
 * ===================================================================================
 *
 * Mengelola semua dependencies aplikasi dengan pattern Dependency Injection.
 * Memudahkan testing, loose coupling, dan maintainability.
 */
class Container {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
    }

    /**
     * Register service dengan factory function
     * @param {string} name - Nama service
     * @param {Function} factory - Factory function yang return instance
     * @param {boolean} singleton - Apakah service singleton (default: true)
     */
    register(name, factory, singleton = true) {
        this.services.set(name, { factory, singleton });
        return this;
    }

    /**
     * Get service instance
     * @param {string} name - Nama service
     * @returns {any} Service instance
     */
    get(name) {
        // Check singleton cache first
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service not found: ${name}`);
        }

        // Create instance
        const instance = service.factory(this);

        // Cache if singleton
        if (service.singleton) {
            this.singletons.set(name, instance);
        }

        return instance;
    }

    /**
     * Check if service exists
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name);
    }

    /**
     * Clear singleton cache (useful for testing)
     */
    clearSingletons() {
        this.singletons.clear();
    }

    /**
     * Get all registered service names
     * @returns {string[]}
     */
    getRegisteredServices() {
        return Array.from(this.services.keys());
    }
}

// Export untuk global use
if (typeof window !== 'undefined') {
    window.Container = Container;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Container };
}
