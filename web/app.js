// Main Application Initialization
// This file coordinates initialization of all modules
// Note: API_BASE is defined in utils.js, autoRefresh is defined in refresh.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log('qLog: Initializing application...');
    console.log('qLog: API_BASE =', API_BASE);
    
    // Check if we're on the shared view page - redirect to dedicated page
    if (window.location.pathname === '/shared' || window.location.pathname.includes('/shared')) {
        // Redirect to dedicated shared view page
        const urlParams = new URLSearchParams(window.location.search);
        const shareViewId = urlParams.get('share') || urlParams.get('id');
        if (shareViewId) {
            window.location.href = `/shared?share=${shareViewId}`;
        }
        return;
    }
    
    // Check for shared view link in main app (legacy support)
    const urlParams = new URLSearchParams(window.location.search);
    const shareViewId = urlParams.get('share');
    if (shareViewId) {
        // Redirect to dedicated shared view page
        window.location.href = `/shared?share=${shareViewId}`;
        return;
    }

    // Wait for authentication check before initializing other modules
    // This prevents API calls from being made before auth is verified
    if (typeof checkAuthStatus === 'function') {
        // Wait for auth.js to initialize if it hasn't yet
        while (!window.authInitialized) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // If auth is ready but we're not authenticated, check again
        if (!window.authReady || !window.authState || !window.authState.authenticated) {
            const isAuthenticated = await checkAuthStatus();
            if (!isAuthenticated) {
                // Auth check will show login/setup modal
                // Don't initialize other modules until authenticated
                console.log('qLog: Waiting for authentication...');
                
                // Set up callback for when auth succeeds
                window.onAuthReady = initializeApp;
                return;
            }
        }
    }
    
    // If we get here, we're authenticated - initialize the app
    initializeApp();
});

// Separate function to initialize the app (called after auth succeeds)
function initializeApp() {

    try {
        initRouting();
        initNavigation();
        initCharts();
        initFilters();
        initSettings();
        initSearch();
        
    // Initialize advanced search
    if (typeof initAdvancedSearch === 'function') {
        console.log('Calling initAdvancedSearch...');
        initAdvancedSearch();
    } else {
        console.error('initAdvancedSearch function not found!');
    }
        initListeners();
        initDevices();
        if (typeof initLogs === 'function') {
            initLogs();
        }
        if (typeof initViews === 'function') {
            initViews();
        } else {
            console.warn('initViews function not available yet');
        }
        if (typeof initModules === 'function') {
            initModules();
        } else {
            console.warn('initModules function not available yet');
        }
        // Event types are now loaded via filters.js - no need to call fetchEventTypes
        
        // Load initial state from URL
        loadStateFromURL();
        
        if (autoRefresh) {
            startAutoRefresh();
        }
        
        // Start live status indicator updates
        if (typeof startStatusUpdates === 'function') {
            startStatusUpdates();
        }
        
        console.log('qLog: Initialization complete');
    } catch (error) {
        console.error('qLog: Initialization error:', error);
    }
}
