// Dashboard Management
let statusUpdateInterval = null;

async function fetchDashboard() {
    try {
        // Fetch server info first
        try {
            const serverInfoResponse = await apiFetch(`${API_BASE}/api/server/info`);
            if (serverInfoResponse.ok) {
                const serverInfo = await serverInfoResponse.json();
                updateServerInfo(serverInfo);
            } else {
                console.error('qLog: Server info API error:', serverInfoResponse.status, serverInfoResponse.statusText);
            }
        } catch (error) {
            console.error('qLog: Error fetching server info:', error);
        }
        
        console.log('qLog: Fetching dashboard stats from', `${API_BASE}/api/stats`);
        const response = await apiFetch(`${API_BASE}/api/stats`);
        
        if (!response.ok) {
            console.error('qLog: Stats API error:', response.status, response.statusText);
            return;
        }
        
        const stats = await response.json();
        console.log('qLog: Received stats:', stats);
        updateDashboard(stats);
        
        // Fetch recent logs
        console.log('qLog: Fetching recent logs from', `${API_BASE}/api/logs?limit=10`);
        const logsResponse = await apiFetch(`${API_BASE}/api/logs?limit=10`);
        
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

function updateServerInfo(info) {
    // Update status indicator with listener count
    const statusText = document.getElementById('statusText');
    const statusDetail = document.getElementById('statusDetail');
    const activeCount = info.active_listeners ? info.active_listeners.length : 0;
    
    const statusIndicator = document.getElementById('statusIndicator');
    
    if (!statusText || !statusDetail || !statusIndicator) return;
    
    // Determine current state
    const currentState = activeCount > 0 ? 'online' : 'offline';
    const currentStateAttr = statusIndicator.getAttribute('data-state');
    
    // Always update text content
    if (activeCount > 0) {
        statusText.textContent = 'Online';
        statusDetail.textContent = `${activeCount} listener${activeCount !== 1 ? 's' : ''} running`;
    } else {
        statusText.textContent = 'Offline';
        statusDetail.textContent = 'No listeners running';
    }
    
    // Always update state attribute (CSS will handle styling)
    // Remove any inline styles that might override CSS
    statusIndicator.removeAttribute('style');
    statusIndicator.setAttribute('data-state', currentState);
    
    // Also remove inline color from status detail (keep other styles)
    const statusDetailStyle = statusDetail.getAttribute('style') || '';
    const cleanedStyle = statusDetailStyle.replace(/color:\s*[^;]+;?/gi, '').trim();
    statusDetail.setAttribute('style', cleanedStyle + '; margin-left: 8px; font-size: 12px; opacity: 0.8;');
    
    if (currentStateAttr !== currentState) {
        console.log('Status indicator state changed:', currentStateAttr, '->', currentState, 'activeCount:', activeCount);
    }
    
    // Update IP addresses
    const ipEl = document.getElementById('serverIPs');
    if (ipEl) {
        if (info.ip_addresses && info.ip_addresses.length > 0) {
            ipEl.innerHTML = info.ip_addresses.map(ip => 
                `<span style="display: inline-block; padding: 4px 8px; background: #252b3b; border-radius: 4px; margin-right: 8px; font-family: monospace;">${ip}</span>`
            ).join('');
        } else {
            ipEl.textContent = 'No IP addresses found';
        }
    }
    
    // Update web port
    const portEl = document.getElementById('webPort');
    if (portEl) {
        portEl.textContent = `:${info.web_port || 'N/A'}`;
    }
    
    // Update database path
    const dbPathEl = document.getElementById('dbPath');
    if (dbPathEl) {
        dbPathEl.textContent = info.database_path || 'N/A';
    }
    
    // Update message limit
    const limitEl = document.getElementById('messageLimit');
    if (limitEl) {
        limitEl.textContent = info.message_limit === 0 ? 'Unlimited' : formatNumber(info.message_limit);
    }
    
    // Update active listeners
    const listenersEl = document.getElementById('activeListenersList');
    if (listenersEl) {
        if (info.active_listeners && info.active_listeners.length > 0) {
            listenersEl.innerHTML = info.active_listeners.map(listener => `
                <div style="padding: 12px; background: #252b3b; border-radius: 8px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="color: #e4e7eb; font-weight: 500; font-size: 14px;">${listener.name}</div>
                            <div style="color: #9ca3af; font-size: 12px; margin-top: 4px;">
                                ${listener.protocol} :${listener.port}
                            </div>
                        </div>
                        <span style="padding: 4px 8px; background: #10b98120; color: #10b981; border-radius: 4px; font-size: 11px; font-weight: 600;">
                            Active
                        </span>
                    </div>
                </div>
            `).join('');
        } else {
            listenersEl.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 20px;">No active listeners</div>';
        }
    }
    
    // Update device summary
    const deviceEl = document.getElementById('deviceSummary');
    if (deviceEl && info.device_summary) {
        const summary = info.device_summary;
        deviceEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div style="text-align: center; padding: 12px; background: #252b3b; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #6366f1; margin-bottom: 4px;">${summary.total || 0}</div>
                    <div style="font-size: 12px; color: #9ca3af;">Total Devices</div>
                </div>
                <div style="text-align: center; padding: 12px; background: #252b3b; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #10b981; margin-bottom: 4px;">${summary.enabled || 0}</div>
                    <div style="font-size: 12px; color: #9ca3af;">Enabled</div>
                </div>
            </div>
            ${summary.by_type && Object.keys(summary.by_type).length > 0 ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #2d3441;">
                    <div style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">By Type:</div>
                    ${Object.entries(summary.by_type).map(([type, count]) => `
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
                            <span style="color: #e4e7eb; text-transform: capitalize;">${type}</span>
                            <span style="color: #6366f1; font-weight: 600;">${count}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
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
        
        // Get event type icon
        const eventTypeIcon = getEventTypeIcon(log.event_type);
        
        // Format event type for display
        let eventTypeDisplay = '-';
        if (log.event_type && log.event_type !== 'unknown') {
            // Convert snake_case to Title Case
            eventTypeDisplay = log.event_type
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
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
                    <span style="color: #9ca3af; font-size: 11px; display: flex; align-items: center;">${eventTypeIcon}${eventTypeDisplay}</span>
                </div>
                <div style="margin-top: 8px; color: #e4e7eb;">${log.message || log.raw_message || '-'}</div>
            </div>
        `;
    }).join('');
}

// Start live status updates
function startStatusUpdates() {
    // Clear any existing interval
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }
    
    // Update immediately
    fetchServerInfo();
    
    // Then update every 5 seconds
    statusUpdateInterval = setInterval(() => {
        fetchServerInfo();
    }, 5000);
}

// Stop live status updates
function stopStatusUpdates() {
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
    }
}

// Fetch only server info for status updates
async function fetchServerInfo() {
    try {
        const serverInfoResponse = await apiFetch(`${API_BASE}/api/server/info`);
        if (serverInfoResponse.ok) {
            const serverInfo = await serverInfoResponse.json();
            updateServerInfo(serverInfo);
        }
    } catch (error) {
        console.error('qLog: Error fetching server info:', error);
    }
}
// Start live status updates
function startStatusUpdates() {
    // Clear any existing interval
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }
    
    // Update immediately
    fetchServerInfo();
    
    // Then update every 5 seconds
    statusUpdateInterval = setInterval(() => {
        fetchServerInfo();
    }, 5000);
}

// Stop live status updates
function stopStatusUpdates() {
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
    }
}

// Fetch only server info for status updates
async function fetchServerInfo() {
    try {
        const serverInfoResponse = await apiFetch(`${API_BASE}/api/server/info`);
        if (serverInfoResponse.ok) {
            const serverInfo = await serverInfoResponse.json();
            updateServerInfo(serverInfo);
        }
    } catch (error) {
        console.error('qLog: Error fetching server info:', error);
    }
}

