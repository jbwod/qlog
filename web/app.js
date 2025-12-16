const API_BASE = window.location.origin;
let currentView = 'dashboard';
let currentPage = 0;
let pageSize = 50;
let autoRefresh = true;
let refreshInterval;
let refreshIntervalMs = 2000;
let severityChart, protocolChart, trendsChart;
let filters = {
    severity: null,
    hostname: '',
    appname: '',
    search: ''
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('qLog: Initializing application...');
    console.log('qLog: API_BASE =', API_BASE);
    
    try {
        initNavigation();
        initCharts();
        initFilters();
        initSettings();
        initSearch();
        fetchDashboard();
        if (autoRefresh) {
            startAutoRefresh();
        }
        console.log('qLog: Initialization complete');
    } catch (error) {
        console.error('qLog: Initialization error:', error);
    }
});

// Search functionality
function initSearch() {
    const searchInput = document.getElementById('globalSearch');
    const searchClear = document.getElementById('searchClear');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            searchClear.style.display = value ? 'flex' : 'none';
            filters.search = value;
            if (currentView === 'logs') {
                fetchLogs();
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && currentView !== 'logs') {
                showView('logs');
            }
        });
    }
    
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            filters.search = '';
            if (currentView === 'logs') {
                fetchLogs();
            }
        });
    }
}

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            showView(view);
        });
    });
}

function showView(view) {
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
        analytics: { title: 'Analytics', subtitle: 'Insights and statistics from your logs' },
        settings: { title: 'Settings', subtitle: 'Configure your syslog server preferences' }
    };
    const pageInfo = titles[view] || titles.dashboard;
    document.getElementById('pageTitle').textContent = pageInfo.title;
    const subtitleEl = document.getElementById('pageSubtitle');
    if (subtitleEl) {
        subtitleEl.textContent = pageInfo.subtitle;
    }
    
    // Load view data
    if (view === 'dashboard') {
        fetchDashboard();
    } else if (view === 'logs') {
        fetchLogs();
    } else if (view === 'analytics') {
        fetchAnalytics();
    }
    
    // Force a refresh when switching to logs view
    if (view === 'logs') {
        setTimeout(() => fetchLogs(), 100);
    }
}

// Charts
function initCharts() {
    const severityCtx = document.getElementById('severityChart');
    const protocolCtx = document.getElementById('protocolChart');
    const trendsCtx = document.getElementById('trendsChart');
    
    if (severityCtx) {
        severityChart = new Chart(severityCtx, {
            type: 'doughnut',
            data: {
                labels: ['Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notice', 'Informational', 'Debug'],
                datasets: [{
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: [
                        '#ef4444', '#f97316', '#f59e0b', '#eab308',
                        '#84cc16', '#22c55e', '#10b981', '#14b8a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }
    
    if (protocolCtx) {
        protocolChart = new Chart(protocolCtx, {
            type: 'pie',
            data: {
                labels: ['UDP', 'TCP', 'TLS'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }
    
    if (trendsCtx) {
        trendsChart = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Messages',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#9ca3af'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af' },
                        grid: { color: '#2d3441' }
                    },
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: '#2d3441' }
                    }
                }
            }
        });
    }
}

// Filters
function initFilters() {
    document.getElementById('applyFilters')?.addEventListener('click', () => {
        filters.severity = document.getElementById('severityFilter').value || null;
        filters.hostname = document.getElementById('hostnameFilter').value;
        filters.appname = document.getElementById('appnameFilter').value;
        currentPage = 0;
        fetchLogs();
    });
    
    document.getElementById('clearFilters')?.addEventListener('click', () => {
        document.getElementById('severityFilter').value = '';
        document.getElementById('hostnameFilter').value = '';
        document.getElementById('appnameFilter').value = '';
        filters = { severity: null, hostname: '', appname: '', search: '' };
        currentPage = 0;
        fetchLogs();
    });
    
    document.getElementById('clearLogs')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all logs?')) {
            clearLogs();
        }
    });
    
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            fetchLogs();
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        currentPage++;
        fetchLogs();
    });
    
    document.getElementById('globalSearch')?.addEventListener('input', (e) => {
        filters.search = e.target.value;
        if (currentView === 'logs') {
            currentPage = 0;
            fetchLogs();
        }
    });
}

// Settings
function initSettings() {
    const toggle = document.getElementById('autoRefreshToggle');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            autoRefresh = e.target.checked;
            if (autoRefresh) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }
    
    const interval = document.getElementById('refreshInterval');
    if (interval) {
        interval.addEventListener('change', (e) => {
            refreshIntervalMs = parseInt(e.target.value);
            if (autoRefresh) {
                stopAutoRefresh();
                startAutoRefresh();
            }
        });
    }
}

function startAutoRefresh() {
    stopAutoRefresh();
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

// API Calls
async function fetchDashboard() {
    try {
        console.log('qLog: Fetching dashboard stats from', `${API_BASE}/api/stats`);
        const response = await fetch(`${API_BASE}/api/stats`);
        
        if (!response.ok) {
            console.error('qLog: Stats API error:', response.status, response.statusText);
            return;
        }
        
        const stats = await response.json();
        console.log('qLog: Received stats:', stats);
        updateDashboard(stats);
        
        // Fetch recent logs
        console.log('qLog: Fetching recent logs from', `${API_BASE}/api/logs?limit=10`);
        const logsResponse = await fetch(`${API_BASE}/api/logs?limit=10`);
        
        if (!logsResponse.ok) {
            console.error('qLog: Logs API error:', logsResponse.status, logsResponse.statusText);
            return;
        }
        
        const logs = await logsResponse.json();
        console.log('qLog: Received', logs.length, 'recent logs');
        updateRecentLogs(logs);
    } catch (error) {
        console.error('qLog: Error fetching dashboard:', error);
    }
}

function updateDashboard(stats) {
    document.getElementById('statTotal').textContent = formatNumber(stats.total || 0);
    document.getElementById('statRecent').textContent = formatNumber(stats.recent_hour || 0);
    
    const errors = (stats.by_severity?.Error || 0) + (stats.by_severity?.Critical || 0) + 
                   (stats.by_severity?.Alert || 0) + (stats.by_severity?.Emergency || 0);
    document.getElementById('statErrors').textContent = formatNumber(errors);
    
    const hostCount = Object.keys(stats.by_hostname || {}).length;
    document.getElementById('statHosts').textContent = formatNumber(hostCount);
    
    // Update charts
    if (severityChart && stats.by_severity) {
        severityChart.data.datasets[0].data = [
            stats.by_severity.Emergency || 0,
            stats.by_severity.Alert || 0,
            stats.by_severity.Critical || 0,
            stats.by_severity.Error || 0,
            stats.by_severity.Warning || 0,
            stats.by_severity.Notice || 0,
            stats.by_severity.Informational || 0,
            stats.by_severity.Debug || 0
        ];
        severityChart.update();
    }
    
    if (protocolChart && stats.by_protocol) {
        protocolChart.data.datasets[0].data = [
            stats.by_protocol.UDP || 0,
            stats.by_protocol.TCP || 0,
            stats.by_protocol.TLS || 0
        ];
        protocolChart.update();
    }
}

function updateRecentLogs(logs) {
    const container = document.getElementById('recentLogsList');
    if (!container) return;
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent logs</div>';
        return;
    }
    
    container.innerHTML = logs.map(log => {
        const severity = getSeverityName(log.severity);
        const severityColor = getSeverityColor(log.severity);
        
        // Get device icon if available
        let deviceIcon = '';
        if (log.device_type === 'meraki') {
            deviceIcon = '📡';
        }
        
        return `
            <div class="log-entry-compact" onclick="showLogDetail(${log.id})">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span class="severity-badge" style="background: ${severityColor}20; color: ${severityColor}; border: 1px solid ${severityColor}40; margin-right: 8px;">
                            ${severity}
                        </span>
                        <span style="color: #9ca3af; font-size: 11px;">${formatTimestamp(log.timestamp)}</span>
                    </div>
                    <span style="color: #9ca3af; font-size: 11px;">${deviceIcon} ${log.hostname || '-'}</span>
                </div>
                <div style="margin-top: 8px; color: #e4e7eb;">${log.message || log.raw_message || '-'}</div>
            </div>
        `;
    }).join('');
}

async function fetchLogs() {
    try {
        let url = `${API_BASE}/api/logs?limit=${pageSize}&offset=${currentPage * pageSize}`;
        if (filters.severity) url += `&severity=${filters.severity}`;
        if (filters.hostname) url += `&hostname=${filters.hostname}`;
        if (filters.appname) url += `&appname=${filters.appname}`;
        if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
        
        console.log('Fetching logs from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('API error:', response.status, response.statusText);
            return;
        }
        
        const logs = await response.json();
        console.log('Received logs:', logs.length, logs);
        renderLogs(logs);
        
        // Update pagination
        const prevBtn = document.getElementById('prevPage');
        const pageInfo = document.getElementById('pageInfo');
        if (prevBtn) prevBtn.disabled = currentPage === 0;
        if (pageInfo) pageInfo.textContent = `Page ${currentPage + 1}`;
    } catch (error) {
        console.error('Error fetching logs:', error);
        const container = document.getElementById('logsList');
        if (container) {
            container.innerHTML = `<div class="empty-state">Error loading logs: ${error.message}</div>`;
        }
    }
}

function renderLogs(logs) {
    const container = document.getElementById('logsList');
    if (!container) {
        console.error('logsList container not found');
        return;
    }
    
    if (!Array.isArray(logs)) {
        console.error('Logs is not an array:', logs);
        container.innerHTML = '<div class="empty-state">Invalid response format</div>';
        return;
    }
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state">No logs found</div>';
        return;
    }
    
    console.log('Rendering', logs.length, 'logs');
    container.innerHTML = logs.map(log => {
        const severity = getSeverityName(log.severity);
        const severityColor = getSeverityColor(log.severity);
        
        // Get device icon if available
        let deviceIcon = '';
        if (log.device_type === 'meraki') {
            deviceIcon = '📡';
        }
        
        // Get event type badge if available
        let eventBadge = '';
        if (log.event_type && log.event_type !== 'unknown') {
            const eventColors = {
                'vpn_connectivity_change': '#6366f1',
                'firewall': '#f59e0b',
                'ids_alert': '#ef4444',
                'urls': '#3b82f6',
                'port_status': '#8b5cf6',
                '8021x_auth': '#10b981',
                'association': '#10b981',
            };
            const color = eventColors[log.event_type] || '#9ca3af';
            eventBadge = `<span style="font-size: 10px; padding: 2px 6px; background: ${color}20; color: ${color}; border-radius: 4px; margin-left: 4px;">${log.event_type}</span>`;
        }
        
        return `
            <div class="log-entry" onclick="showLogDetail(${log.id})">
                <div class="col-timestamp">${formatTimestamp(log.timestamp)}</div>
                <div class="col-severity">
                    <span class="severity-badge" style="background: ${severityColor}20; color: ${severityColor}; border: 1px solid ${severityColor}40;">
                        ${severity}
                    </span>
                    ${eventBadge}
                </div>
                <div class="col-hostname">${deviceIcon} ${log.hostname || '-'}</div>
                <div class="col-app">${log.appname || '-'}</div>
                <div class="col-message">${log.message || log.raw_message || '-'}</div>
            </div>
        `;
    }).join('');
}

async function fetchAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();
        updateAnalytics(stats);
    } catch (error) {
        console.error('Error fetching analytics:', error);
    }
}

function updateAnalytics(stats) {
    // Top hostnames
    const hostnamesContainer = document.getElementById('topHostnames');
    if (hostnamesContainer && stats.by_hostname) {
        const entries = Object.entries(stats.by_hostname)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        hostnamesContainer.innerHTML = entries.map(([host, count]) => `
            <div style="display: flex; justify-content: space-between; padding: 12px; background: #252b3b; border-radius: 8px; margin-bottom: 8px;">
                <span>${host}</span>
                <span style="color: #6366f1; font-weight: 600;">${formatNumber(count)}</span>
            </div>
        `).join('');
    }
    
    // Top applications would go here if we had that data
}

async function showLogDetail(id) {
    try {
        const response = await fetch(`${API_BASE}/api/logs/${id}`);
        const data = await response.json();
        displayLogDetail(data.log || data, data.display_info);
    } catch (error) {
        console.error('Error fetching log detail:', error);
    }
}

function displayLogDetail(log, displayInfo) {
    const modal = document.getElementById('logModal');
    const details = document.getElementById('logDetails');
    
    const severity = getSeverityName(log.severity);
    const severityColor = getSeverityColor(log.severity);
    
    // If we have device-specific display info, use it
    if (displayInfo) {
        details.innerHTML = renderDeviceSpecificDetail(log, displayInfo, severity, severityColor);
    } else {
        details.innerHTML = renderDefaultDetail(log, severity, severityColor);
    }
    
    modal.style.display = 'block';
}

function renderDeviceSpecificDetail(log, displayInfo, severity, severityColor) {
    let html = `
        <div class="device-header" style="background: linear-gradient(135deg, ${displayInfo.color}20 0%, ${displayInfo.color}05 100%); border-left: 4px solid ${displayInfo.color}; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                <span style="font-size: 32px;">${displayInfo.icon}</span>
                <div>
                    <h3 style="margin: 0; font-size: 20px; color: ${displayInfo.color};">${displayInfo.title}</h3>
                    <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 14px;">${displayInfo.description || ''}</p>
                </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
    `;
    
    // Render badges
    if (displayInfo.badges && displayInfo.badges.length > 0) {
        displayInfo.badges.forEach(badge => {
            html += `
                <span style="padding: 4px 12px; background: ${badge.color}20; color: ${badge.color}; border: 1px solid ${badge.color}40; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    ${badge.label}: ${badge.value}
                </span>
            `;
        });
    }
    
    html += `
            </div>
        </div>
        
        <div class="detail-section">
            <h4 style="margin-bottom: 16px; color: #e4e7eb; font-size: 16px;">Event Details</h4>
    `;
    
    // Render detail items
    if (displayInfo.details && displayInfo.details.length > 0) {
        displayInfo.details.forEach(detail => {
            let valueHtml = detail.value;
            if (detail.type === 'ip') {
                valueHtml = `<span style="font-family: monospace; color: #6366f1;">${detail.value}</span>`;
            } else if (detail.type === 'url' && detail.link) {
                valueHtml = `<a href="${detail.link}" target="_blank" style="color: #3b82f6; text-decoration: none;">${detail.value}</a>`;
            } else if (detail.type === 'signature' && detail.link) {
                valueHtml = `<a href="${detail.link}" target="_blank" style="color: #ef4444; text-decoration: none; font-weight: 600;">${detail.value}</a>`;
            }
            
            html += `
                <div class="log-detail-item">
                    <div class="log-detail-label">${detail.label}</div>
                    <div class="log-detail-value">${valueHtml}</div>
                </div>
            `;
        });
    }
    
    // Render actions
    if (displayInfo.actions && displayInfo.actions.length > 0) {
        html += `
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #2d3441;">
                <h4 style="margin-bottom: 16px; color: #e4e7eb; font-size: 16px;">Actions</h4>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        `;
        displayInfo.actions.forEach(action => {
            html += `
                <button class="btn-primary" onclick="${action.type === 'link' ? `window.open('${action.url}', '_blank')` : 'handleAction(\'' + action.type + '\', ' + log.id + ')'}" style="padding: 8px 16px; font-size: 13px;">
                    ${action.label}
                </button>
            `;
        });
        html += `</div></div>`;
    }
    
    // Add visualizations
    if (displayInfo.visualization && log.parsed_fields) {
        if (displayInfo.visualization === 'flow') {
            html += renderFlowVisualization(log.parsed_fields);
        } else if (displayInfo.visualization === 'vpn_tunnel') {
            html += renderVPNTunnelVisualization(log.parsed_fields, displayInfo);
        } else if (displayInfo.visualization === 'network_topology') {
            html += renderNetworkTopologyVisualization(log.parsed_fields, displayInfo);
        } else if (displayInfo.visualization === 'port_status') {
            html += renderPortStatusVisualization(log.parsed_fields);
        }
    }
    
    html += `</div>`;
    
    // Add raw message section
    html += `
        <div class="detail-section" style="margin-top: 24px;">
            <h4 style="margin-bottom: 16px; color: #e4e7eb; font-size: 16px;">Raw Message</h4>
            <div class="log-detail-item">
                <div class="log-detail-value"><pre style="white-space: pre-wrap; font-size: 12px;">${log.raw_message || '-'}</pre></div>
            </div>
        </div>
    `;
    
    return html;
}

function renderFlowVisualization(fields) {
    if (!fields.source_ip && !fields.dest_ip) return '';
    
    return `
        <div style="margin-top: 24px; padding: 20px; background: #1a1f2e; border-radius: 8px; border: 1px solid #2d3441;">
            <h4 style="margin-bottom: 16px; color: #e4e7eb; font-size: 16px;">Traffic Flow</h4>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="padding: 12px; background: #252b3b; border-radius: 6px; border-left: 3px solid #3b82f6;">
                        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Source</div>
                        <div style="font-family: monospace; color: #3b82f6; font-weight: 600;">${fields.source_ip || 'N/A'}</div>
                        ${fields.source_port ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Port: ${fields.source_port}</div>` : ''}
                    </div>
                </div>
                <div style="font-size: 24px; color: #6366f1;">→</div>
                <div style="flex: 1; min-width: 200px;">
                    <div style="padding: 12px; background: #252b3b; border-radius: 6px; border-left: 3px solid #ef4444;">
                        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Destination</div>
                        <div style="font-family: monospace; color: #ef4444; font-weight: 600;">${fields.dest_ip || 'N/A'}</div>
                        ${fields.dest_port ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Port: ${fields.dest_port}</div>` : ''}
                    </div>
                </div>
            </div>
            ${fields.protocol ? `
                <div style="margin-top: 16px; text-align: center;">
                    <span style="padding: 6px 12px; background: #6366f120; color: #6366f1; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        Protocol: ${fields.protocol.toUpperCase()}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

function renderVPNTunnelVisualization(fields, displayInfo) {
    let html = `
        <div style="margin-top: 24px; padding: 20px; background: #1a1f2e; border-radius: 8px; border: 1px solid #2d3441;">
            <h4 style="margin-bottom: 16px; color: #e4e7eb; font-size: 16px;">VPN Tunnel</h4>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
    `;
    
    if (fields.local_ip || fields.local_network) {
        html += `
            <div style="flex: 1; min-width: 200px;">
                <div style="padding: 16px; background: #252b3b; border-radius: 8px; border: 2px solid #6366f1;">
                    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px; text-transform: uppercase;">Local</div>
                    ${fields.local_ip ? `<div style="font-family: monospace; color: #6366f1; font-weight: 600; font-size: 14px;">${fields.local_ip}</div>` : ''}
                    ${fields.local_network ? `<div style="font-family: monospace; color: #6366f1; font-weight: 600; font-size: 14px; margin-top: 4px;">${fields.local_network}</div>` : ''}
                    ${fields.local_port ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Port: ${fields.local_port}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    html += `
        <div style="text-align: center;">
            <div style="font-size: 32px; color: ${displayInfo.color};">🔐</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">VPN</div>
        </div>
    `;
    
    if (fields.remote_ip || fields.remote_network) {
        html += `
            <div style="flex: 1; min-width: 200px;">
                <div style="padding: 16px; background: #252b3b; border-radius: 8px; border: 2px solid #10b981;">
                    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px; text-transform: uppercase;">Remote</div>
                    ${fields.remote_ip ? `<div style="font-family: monospace; color: #10b981; font-weight: 600; font-size: 14px;">${fields.remote_ip}</div>` : ''}
                    ${fields.remote_network ? `<div style="font-family: monospace; color: #10b981; font-weight: 600; font-size: 14px; margin-top: 4px;">${fields.remote_network}</div>` : ''}
                    ${fields.remote_port ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Port: ${fields.remote_port}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    if (fields.spi_inbound || fields.spi_outbound || fields.spi) {
        html += `
            <div style="margin-top: 16px; width: 100%; padding-top: 16px; border-top: 1px solid #2d3441;">
                <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
        `;
        if (fields.spi_inbound) {
            html += `
                <div style="padding: 8px 12px; background: #252b3b; border-radius: 6px;">
                    <div style="font-size: 11px; color: #9ca3af;">SPI Inbound</div>
                    <div style="font-family: monospace; color: #6366f1; font-size: 12px;">${fields.spi_inbound}</div>
                </div>
            `;
        }
        if (fields.spi_outbound) {
            html += `
                <div style="padding: 8px 12px; background: #252b3b; border-radius: 6px;">
                    <div style="font-size: 11px; color: #9ca3af;">SPI Outbound</div>
                    <div style="font-family: monospace; color: #6366f1; font-size: 12px;">${fields.spi_outbound}</div>
                </div>
            `;
        }
        if (fields.spi) {
            html += `
                <div style="padding: 8px 12px; background: #252b3b; border-radius: 6px;">
                    <div style="font-size: 11px; color: #9ca3af;">SPI</div>
                    <div style="font-family: monospace; color: #6366f1; font-size: 12px;">${fields.spi}</div>
                </div>
            `;
        }
        html += `</div></div>`;
    }
    
    html += `</div></div>`;
    return html;
}

function renderNetworkTopologyVisualization(fields, displayInfo) {
    return `
        <div style="margin-top: 24px; padding: 20px; background: #1a1f2e; border-radius: 8px; border: 1px solid #2d3441;">
            <h4 style="margin-bottom: 16px; color: #e4e7eb; font-size: 16px;">Network Topology</h4>
            <div style="display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap;">
                <div style="padding: 16px; background: #252b3b; border-radius: 8px; border: 2px solid ${displayInfo.color};">
                    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px; text-transform: uppercase;">Uplink</div>
                    ${fields.uplink_type ? `<div style="font-weight: 600; color: ${displayInfo.color}; font-size: 16px;">${fields.uplink_type}</div>` : ''}
                    ${fields.status ? `
                        <div style="margin-top: 8px;">
                            <span style="padding: 4px 8px; background: ${fields.status === 'up' ? '#10b98120' : '#ef444420'}; color: ${fields.status === 'up' ? '#10b981' : '#ef4444'}; border-radius: 6px; font-size: 11px; font-weight: 600;">
                                ${fields.status.toUpperCase()}
                            </span>
                        </div>
                    ` : ''}
                    ${fields.failover_to ? `
                        <div style="margin-top: 8px; font-size: 12px; color: #f59e0b;">
                            Failover to: ${fields.failover_to}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderPortStatusVisualization(fields) {
    const statusColor = fields.new_status === 'down' ? '#ef4444' : '#10b981';
    const oldStatusColor = fields.old_status === 'down' ? '#ef4444' : '#10b981';
    
    return `
        <div style="margin-top: 24px; padding: 20px; background: #1a1f2e; border-radius: 8px; border: 1px solid #2d3441;">
            <h4 style="margin-bottom: 16px; color: #e4e7eb; font-size: 16px;">Port Status Change</h4>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 150px; text-align: center;">
                    <div style="padding: 16px; background: #252b3b; border-radius: 8px; border: 2px solid ${oldStatusColor};">
                        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">Previous</div>
                        <div style="font-weight: 600; color: ${oldStatusColor}; font-size: 18px;">${fields.old_status || 'N/A'}</div>
                    </div>
                </div>
                <div style="font-size: 32px; color: #6366f1;">→</div>
                <div style="flex: 1; min-width: 150px; text-align: center;">
                    <div style="padding: 16px; background: #252b3b; border-radius: 8px; border: 2px solid ${statusColor};">
                        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">Current</div>
                        <div style="font-weight: 600; color: ${statusColor}; font-size: 18px;">${fields.new_status || 'N/A'}</div>
                    </div>
                </div>
            </div>
            ${fields.port_number ? `
                <div style="margin-top: 16px; text-align: center;">
                    <span style="padding: 6px 12px; background: #8b5cf620; color: #8b5cf6; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        Port: ${fields.port_number}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

function renderDefaultDetail(log, severity, severityColor) {
    return `
        <div class="log-detail-item">
            <div class="log-detail-label">ID</div>
            <div class="log-detail-value">${log.id}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Timestamp</div>
            <div class="log-detail-value">${formatTimestamp(log.timestamp)}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Severity</div>
            <div class="log-detail-value">
                <span class="severity-badge" style="background: ${severityColor}20; color: ${severityColor}; border: 1px solid ${severityColor}40; padding: 4px 12px; border-radius: 12px;">
                    ${severity} (${log.severity})
                </span>
            </div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Priority</div>
            <div class="log-detail-value">${log.priority} (Facility: ${log.facility}, Severity: ${log.severity})</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Version</div>
            <div class="log-detail-value">${log.version || 'N/A'}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Hostname</div>
            <div class="log-detail-value">${log.hostname || '-'}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">App Name</div>
            <div class="log-detail-value">${log.appname || '-'}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Process ID</div>
            <div class="log-detail-value">${log.procid || '-'}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Message ID</div>
            <div class="log-detail-value">${log.msgid || '-'}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Message</div>
            <div class="log-detail-value">${log.message || '-'}</div>
        </div>
        <div class="log-detail-item">
            <div class="log-detail-label">Remote Address</div>
            <div class="log-detail-value">${log.remote_addr || '-'}</div>
        </div>
        ${log.structured_data && Object.keys(log.structured_data).length > 0 ? `
        <div class="log-detail-item">
            <div class="log-detail-label">Structured Data</div>
            <div class="log-detail-value"><pre style="white-space: pre-wrap;">${JSON.stringify(log.structured_data, null, 2)}</pre></div>
        </div>
        ` : ''}
        <div class="log-detail-item">
            <div class="log-detail-label">Raw Message</div>
            <div class="log-detail-value"><pre style="white-space: pre-wrap;">${log.raw_message || '-'}</pre></div>
        </div>
    `;
}

function handleAction(actionType, logId) {
    // Handle device-specific actions
    console.log('Action:', actionType, 'for log:', logId);
    // Implement action handlers here
}

function closeModal() {
    document.getElementById('logModal').style.display = 'none';
}

async function clearLogs() {
    try {
        const response = await fetch(`${API_BASE}/api/clear`, {
            method: 'POST'
        });
        
        if (response.ok) {
            if (currentView === 'logs') {
                fetchLogs();
            } else {
                fetchDashboard();
            }
        }
    } catch (error) {
        console.error('Error clearing logs:', error);
    }
}

// Utility functions
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function getSeverityName(severity) {
    const names = {
        0: 'Emergency', 1: 'Alert', 2: 'Critical', 3: 'Error',
        4: 'Warning', 5: 'Notice', 6: 'Informational', 7: 'Debug'
    };
    return names[severity] || 'Unknown';
}

function getSeverityColor(severity) {
    const colors = {
        0: '#ef4444', 1: '#f97316', 2: '#f59e0b', 3: '#eab308',
        4: '#84cc16', 5: '#22c55e', 6: '#10b981', 7: '#14b8a6'
    };
    return colors[severity] || '#9ca3af';
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('logModal');
    if (event.target === modal) {
        closeModal();
    }
}
