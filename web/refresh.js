// Auto-refresh functionality
let autoRefresh = true;
let refreshInterval;
let refreshIntervalMs = 2000;

function startAutoRefresh() {
    if (refreshInterval) return;
    
    refreshInterval = setInterval(() => {
        if (currentView === 'dashboard') {
            fetchDashboard();
        } else if (currentView === 'logs') {
            fetchLogs();
        }
    }, refreshIntervalMs);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

