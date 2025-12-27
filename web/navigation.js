// Navigation Management
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            showView(view);
        });
    });
}

function showView(view, shouldUpdateURL = true) {
    currentView = view;
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('hidden', v.id !== `${view}View`);
    });
    
    // Update title and subtitle
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Monitor and analyze syslog messages in real-time' },
        logs: { title: 'Logs', subtitle: 'Browse and filter all syslog entries' },
        listeners: { title: 'Listeners', subtitle: 'Configure syslog listeners with different protocols and settings' },
        views: { title: 'Views', subtitle: 'Create and manage custom dashboard views' },
        modules: { title: 'Modules', subtitle: 'Enable or disable device detection modules' },
        devices: { title: 'Devices', subtitle: 'Configure devices and bind them to listeners by IP address' },
        settings: { title: 'Settings', subtitle: 'Configure your syslog server preferences' }
    };
    const pageInfo = titles[view] || titles.dashboard;
    document.getElementById('pageTitle').textContent = pageInfo.title;
    const subtitleEl = document.getElementById('pageSubtitle');
    if (subtitleEl) {
        subtitleEl.textContent = pageInfo.subtitle;
    }
    
    // Update URL
    if (shouldUpdateURL) {
        updateURL();
    }
    
    // Load view data
    if (view === 'dashboard') {
        if (typeof fetchDashboard === 'function') {
            fetchDashboard();
        }
    } else if (view === 'logs') {
        if (typeof fetchLogs === 'function') {
            fetchLogs();
        }
    } else if (view === 'listeners') {
        if (typeof fetchListeners === 'function') {
            fetchListeners();
        }
    } else if (view === 'views') {
        if (typeof fetchViews === 'function') {
            fetchViews();
        } else {
            console.warn('fetchViews function not available yet');
        }
    } else if (view === 'devices') {
        if (typeof fetchDevices === 'function') {
            fetchDevices();
        }
        } else if (view === 'modules') {
            if (typeof fetchModules === 'function') {
                fetchModules();
            }
        } else if (view === 'settings') {
            if (typeof fetchSeverityOverrides === 'function') {
                fetchSeverityOverrides();
            }
        }
    
    // Force a refresh when switching to logs view
    if (view === 'logs' && autoRefresh) {
        startAutoRefresh();
    }
}

