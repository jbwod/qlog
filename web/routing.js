// URL Routing and State Management
let currentView = 'dashboard';
let currentPage = 0;
let pageSize = 50;

function initRouting() {
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        loadStateFromURL();
    });
}

function updateURL() {
    const params = new URLSearchParams();
    
    if (currentView !== 'dashboard') {
        params.set('view', currentView);
    }
    
    // Add filters (check if filters is defined)
    if (typeof filters !== 'undefined') {
        if (filters.severity) {
            params.set('severity', filters.severity);
        }
        if (filters.device) {
            params.set('device', filters.device);
        }
        if (filters.device_type) {
            params.set('device_type', filters.device_type);
        }
        if (filters.event_type) {
            params.set('event_type', filters.event_type);
        }
        if (filters.date_range) {
            params.set('date_range', filters.date_range);
        }
        if (filters.date_from && filters.date_to) {
            params.set('date_from', filters.date_from);
            params.set('date_to', filters.date_to);
        }
        if (filters.search) {
            params.set('search', filters.search);
        }
    }
    
    // Add pagination (only if not first page)
    if (currentPage > 0) {
        params.set('page', currentPage);
    }
    
    const queryString = params.toString();
    const newURL = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    
    // Update URL without reloading
    window.history.pushState({ view: currentView, filters: filters, page: currentPage }, '', newURL);
}

function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    // Check if we're on the shared view page
    if (window.location.pathname === '/shared' || window.location.pathname.includes('/shared')) {
        // Redirect to shared.html if not already there
        if (!window.location.pathname.endsWith('/shared.html') && !window.location.pathname.endsWith('/shared')) {
            // Let shared-view.js handle it
            return;
        }
        return; // Don't load normal UI for shared views
    }
    
    // Check for shared view link in main app (legacy support - redirect to /shared)
    const shareViewId = params.get('share');
    if (shareViewId) {
        // Redirect to dedicated shared view page
        window.location.href = `/shared?share=${shareViewId}`;
        return;
    }
    
    // Check for view display
    const viewDisplayId = params.get('id');
    const viewDisplay = params.get('view');
    if (viewDisplay === 'view-display' && viewDisplayId) {
        if (typeof loadViewDisplay === 'function') {
            loadViewDisplay(viewDisplayId, false);
        }
        return;
    }
    
    // Load view
    const view = params.get('view') || 'dashboard';
    if (view !== currentView) {
        showView(view, false); // false = don't update URL (we're loading from URL)
    }
    
    // Load filters
    filters.severity = params.get('severity') || null;
    filters.device = params.get('device') || '';
    filters.date_range = params.get('date_range') || '24h';
    filters.device_type = params.get('device_type') || '';
    filters.event_type = params.get('event_type') || '';
    filters.search = params.get('search') || '';
    
    // Load pagination
    const pageParam = params.get('page');
    currentPage = pageParam ? parseInt(pageParam, 10) : 0;
    
    // Update filter UI
    if (typeof updateFilterUI === 'function') {
        updateFilterUI();
    }
    
    // Fetch data if on logs view
    if (currentView === 'logs') {
        fetchLogs();
    }
}

