// Shared View - Isolated from main application
// This file only handles displaying shared views in read-only mode

// Get view ID from URL
const urlParams = new URLSearchParams(window.location.search);
const shareViewId = urlParams.get('share') || urlParams.get('id');

// Security: Only allow viewing shared views, no other functionality
const SHARED_VIEW_MODE = true;

// API_BASE is defined in utils.js which is loaded before this script
// If for some reason it's not defined, fallback to window.location.origin
if (typeof API_BASE === 'undefined') {
    window.API_BASE = window.location.origin;
}

// Initialize shared view on load
document.addEventListener('DOMContentLoaded', () => {
    if (!shareViewId) {
        showError('No view ID provided');
        return;
    }
    
    loadSharedView(shareViewId);
});

function loadSharedView(viewId) {
    // Fetch view data (read-only)
    fetch(`${API_BASE}/api/views/${viewId}`)
        .then(res => {
            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('View not found');
                }
                throw new Error(`Failed to load view: ${res.statusText}`);
            }
            return res.json();
        })
        .then(view => {
            // Update header
            const title = document.getElementById('sharedViewTitle');
            const subtitle = document.getElementById('sharedViewSubtitle');
            if (title) title.textContent = view.name || 'Unnamed View';
            if (subtitle) subtitle.textContent = view.description || 'Shared View';
            
            // Hide loading
            document.getElementById('sharedViewLoading').style.display = 'none';
            
            // Render widgets
            renderSharedViewWidgets(view);
        })
        .catch(err => {
            console.error('Error loading shared view:', err);
            showError(err.message);
        });
}

function renderSharedViewWidgets(view) {
    const grid = document.getElementById('sharedViewGrid');
    if (!grid) return;
    
    grid.style.display = 'grid';
    
    if (!view.widgets || view.widgets.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: var(--text-tertiary);">
                <i class="fas fa-inbox" style="font-size: 64px; margin-bottom: 16px; opacity: 0.3;"></i>
                <p style="font-size: 16px;">This view has no widgets</p>
            </div>
        `;
        return;
    }
    
    // Render each widget
    view.widgets.forEach(widget => {
        const widgetElement = createSharedWidgetElement(widget);
        grid.appendChild(widgetElement);
        
        // Initialize widget content
        initializeSharedWidget(widget);
    });
}

function createSharedWidgetElement(widget) {
    const div = document.createElement('div');
    div.className = 'shared-view-widget';
    div.id = `sharedWidget_${widget.id}`;
    div.setAttribute('data-widget-id', widget.id);
    
    const config = widget.config || {};
    const widgetName = config.name || getWidgetDisplayName(widget.type);
    
    div.innerHTML = `
        <div class="shared-view-widget-header">
            <h3>
                <i class="fas ${getWidgetIcon(widget.type)}" style="color: var(--accent);"></i>
                ${escapeHtml(widgetName)}
            </h3>
        </div>
        <div class="shared-view-widget-content" id="sharedWidgetContent_${widget.id}">
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin"></i> Loading...
            </div>
        </div>
    `;
    
    return div;
}

function getWidgetDisplayName(type) {
    const names = {
        'stat-card': 'Stat Card',
        'chart-severity': 'Severity Chart',
        'chart-protocol': 'Protocol Chart',
        'log-list': 'Log List',
        'filter-panel': 'Filter Panel',
        'event-timeline': 'Event Timeline',
        'chart-event-type': 'Event Type Chart',
        'device-stats': 'Device Stats',
        'severity-timeline': 'Severity Timeline',
        'query-builder': 'Query Builder',
        'data-table': 'Data Table',
        'top-n': 'Top N List'
    };
    return names[type] || type;
}

function getWidgetIcon(type) {
    const icons = {
        'stat-card': 'fa-chart-bar',
        'chart-severity': 'fa-chart-pie',
        'chart-protocol': 'fa-network-wired',
        'log-list': 'fa-list',
        'filter-panel': 'fa-filter',
        'event-timeline': 'fa-timeline',
        'chart-event-type': 'fa-chart-line',
        'device-stats': 'fa-server',
        'severity-timeline': 'fa-chart-area',
        'query-builder': 'fa-code',
        'data-table': 'fa-table',
        'top-n': 'fa-list-ol'
    };
    return icons[type] || 'fa-square';
}

function initializeSharedWidget(widget) {
    const container = document.getElementById(`sharedWidgetContent_${widget.id}`);
    if (!container) return;
    
    const config = widget.config || {};
    const filters = config.filters || {};
    
    switch (widget.type) {
        case 'stat-card':
            loadSharedStatCard(widget, container);
            break;
        case 'chart-severity':
        case 'chart-protocol':
        case 'chart-event-type':
            loadSharedChart(widget, container);
            break;
        case 'log-list':
            loadSharedLogList(widget, container);
            break;
        case 'top-n':
            loadSharedTopN(widget, container);
            break;
        case 'data-table':
            loadSharedDataTable(widget, container);
            break;
        case 'query-builder':
            loadSharedQueryBuilder(widget, container);
            break;
        default:
            container.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 20px;">Widget type "${widget.type}" not supported in shared view</div>`;
    }
}

// Build API URL for logs with filters (read-only)
function buildLogsApiUrl(filters = {}, limit = 50) {
    let url = `${API_BASE}/api/logs?limit=${limit}&offset=0`;
    
    if (filters.severity) url += `&severity=${encodeURIComponent(filters.severity)}`;
    if (filters.device) url += `&device=${encodeURIComponent(filters.device)}`;
    if (filters.device_type) url += `&device_type=${encodeURIComponent(filters.device_type)}`;
    if (filters.event_type) url += `&event_type=${encodeURIComponent(filters.event_type)}`;
    if (filters.date_range) url += `&date_range=${encodeURIComponent(filters.date_range)}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    
    return url;
}

function loadSharedStatCard(widget, container) {
    const config = widget.config || {};
    const field = config.field || 'total';
    
    fetch(`${API_BASE}/api/stats`)
        .then(res => res.json())
        .then(stats => {
            let value = 0;
            if (field === 'total') {
                value = stats.total || 0;
            } else if (stats.by_severity && stats.by_severity[field]) {
                value = stats.by_severity[field];
            } else if (stats.by_device_type && stats.by_device_type[field]) {
                value = stats.by_device_type[field];
            }
            
            container.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 36px; font-weight: 700; color: var(--accent); margin-bottom: 8px;">
                        ${value.toLocaleString()}
                    </div>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        ${config.label || 'Total Messages'}
                    </div>
                </div>
            `;
        })
        .catch(err => {
            container.innerHTML = `<div style="text-align: center; color: var(--error);">Error loading data</div>`;
        });
}

function loadSharedChart(widget, container) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const groupBy = config.groupBy || 'severity';
    
    const url = buildLogsApiUrl(filters, 10000);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Group data
            const grouped = {};
            logs.forEach(log => {
                let key = '';
                if (groupBy === 'severity') {
                    key = getSeverityName(log.severity);
                } else if (groupBy === 'device_type') {
                    key = log.device_type || 'unknown';
                } else if (groupBy === 'event_type') {
                    key = log.event_type || 'unknown';
                } else if (log.parsed_fields && log.parsed_fields[groupBy]) {
                    key = String(log.parsed_fields[groupBy]);
                }
                
                if (key) {
                    grouped[key] = (grouped[key] || 0) + 1;
                }
            });
            
            const labels = Object.keys(grouped);
            const values = labels.map(label => grouped[label]);
            
            const canvasId = `sharedChart_${widget.id}_${Date.now()}`;
            container.innerHTML = `<canvas id="${canvasId}" style="max-height: 300px;"></canvas>`;
            
            const ctx = document.getElementById(canvasId);
            if (ctx && typeof Chart !== 'undefined') {
                new Chart(ctx, {
                    type: config.chartType || 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
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
                                    color: '#e4e7eb'
                                }
                            }
                        }
                    }
                });
            }
        })
        .catch(err => {
            container.innerHTML = `<div style="text-align: center; color: var(--error);">Error loading chart</div>`;
        });
}

function loadSharedLogList(widget, container) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const limit = config.limit || 10;
    
    const url = buildLogsApiUrl(filters, limit);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            if (logs.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No logs found</div>';
                return;
            }
            
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${logs.slice(0, limit).map(log => {
                        const severity = getSeverityName(log.severity);
                        const severityColor = getSeverityColor(log.severity);
                        return `
                            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid ${severityColor};">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                    <span style="font-size: 11px; color: var(--text-tertiary);">${formatTimestamp(log.timestamp)}</span>
                                    <span style="font-size: 11px; padding: 2px 8px; background: ${severityColor}20; color: ${severityColor}; border-radius: 4px;">${severity}</span>
                                </div>
                                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.4;">
                                    ${escapeHtml((log.message || log.raw_message || '-').substring(0, 150))}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        })
        .catch(err => {
            container.innerHTML = `<div style="text-align: center; color: var(--error);">Error loading logs</div>`;
        });
}

function loadSharedTopN(widget, container) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const field = config.field || 'event_type';
    const limit = config.limit || 10;
    
    const url = buildLogsApiUrl(filters, 10000);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            const grouped = {};
            logs.forEach(log => {
                let key = '';
                if (log[field]) {
                    key = String(log[field]);
                } else if (log.parsed_fields && log.parsed_fields[field]) {
                    key = String(log.parsed_fields[field]);
                }
                
                if (key) {
                    grouped[key] = (grouped[key] || 0) + 1;
                }
            });
            
            const sorted = Object.entries(grouped)
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit);
            
            if (sorted.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No data</div>';
                return;
            }
            
            const maxCount = sorted[0][1];
            
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${sorted.map(([key, count]) => {
                        const percentage = (count / maxCount) * 100;
                        return `
                            <div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span style="font-size: 13px; color: var(--text-primary);">${escapeHtml(key)}</span>
                                    <span style="font-size: 13px; font-weight: 600; color: var(--accent);">${count}</span>
                                </div>
                                <div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${percentage}%; background: var(--accent); transition: width 0.3s;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        })
        .catch(err => {
            container.innerHTML = `<div style="text-align: center; color: var(--error);">Error loading data</div>`;
        });
}

function loadSharedDataTable(widget, container) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const limit = config.limit || 20;
    const columns = (config.columns || 'timestamp,severity,message').split(',').map(c => c.trim());
    
    const url = buildLogsApiUrl(filters, limit);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            if (logs.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No logs found</div>';
                return;
            }
            
            const tableRows = logs.map(log => {
                const cells = columns.map(col => {
                    let value = '-';
                    if (col === 'timestamp') {
                        value = formatTimestamp(log.timestamp);
                    } else if (col === 'severity') {
                        value = getSeverityName(log.severity);
                    } else if (col === 'message') {
                        value = (log.message || log.raw_message || '-').substring(0, 100);
                    } else if (log[col]) {
                        value = String(log[col]);
                    } else if (log.parsed_fields && log.parsed_fields[col]) {
                        value = String(log.parsed_fields[col]);
                    }
                    return `<td style="padding: 8px; border-bottom: 1px solid var(--border); color: var(--text-primary); font-size: 12px;">${escapeHtml(String(value))}</td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            
            container.innerHTML = `
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr>
                                ${columns.map(col => `<th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--border); color: var(--text-secondary); font-weight: 600; text-transform: capitalize;">${escapeHtml(col)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        })
        .catch(err => {
            container.innerHTML = `<div style="text-align: center; color: var(--error);">Error loading data</div>`;
        });
}

function loadSharedQueryBuilder(widget, container) {
    const config = widget.config || {};
    const query = config.query || '';
    
    container.innerHTML = `
        <div style="padding: 16px;">
            <div style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <pre style="margin: 0; font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace; font-size: 12px; color: var(--text-primary); white-space: pre-wrap; word-break: break-word;">${escapeHtml(query || 'No query configured')}</pre>
            </div>
            <button class="btn-primary" onclick="executeSharedQuery('${widget.id}', '${escapeHtml(query)}')" style="width: 100%; padding: 10px;">
                <i class="fas fa-play"></i> Execute Query
            </button>
            <div id="sharedQueryResults_${widget.id}" style="margin-top: 16px; display: none;"></div>
        </div>
    `;
}

function executeSharedQuery(widgetId, query) {
    if (!query || !query.trim()) {
        alert('No query configured');
        return;
    }
    
    const resultsDiv = document.getElementById(`sharedQueryResults_${widgetId}`);
    if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Executing query...</div>';
    }
    
    fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: query })
    })
    .then(res => res.json())
    .then(data => {
        if (resultsDiv) {
            if (data.error) {
                resultsDiv.innerHTML = `<div style="padding: 20px; color: var(--error);"><i class="fas fa-exclamation-triangle"></i> Error: ${escapeHtml(data.error)}</div>`;
            } else {
                renderSharedQueryResults(resultsDiv, data);
            }
        }
    })
    .catch(err => {
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div style="padding: 20px; color: var(--error);"><i class="fas fa-exclamation-triangle"></i> Error: ${escapeHtml(err.message)}</div>`;
        }
    });
}

function renderSharedQueryResults(container, data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);"><i class="fas fa-info-circle"></i> No results</div>';
        return;
    }
    
    const columns = Object.keys(data[0]);
    const html = `
        <div style="background: var(--bg-tertiary); border-radius: 8px; overflow: hidden;">
            <div style="padding: 12px; background: var(--bg-card); border-bottom: 1px solid var(--border);">
                <span style="font-weight: 600; color: var(--text-primary);"><i class="fas fa-table"></i> ${data.length} result${data.length !== 1 ? 's' : ''}</span>
            </div>
            <div style="overflow-x: auto; max-height: 400px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-card);">
                            ${columns.map(col => `<th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border); color: var(--text-primary); font-weight: 600; font-size: 12px; text-transform: uppercase;">${escapeHtml(col)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.slice(0, 100).map(row => `
                            <tr style="border-bottom: 1px solid var(--border-light);">
                                ${columns.map(col => {
                                    const val = row[col];
                                    const displayVal = val === null || val === undefined ? '<span style="color: var(--text-tertiary); font-style: italic;">null</span>' : 
                                                      typeof val === 'object' ? `<pre style="margin: 0; font-size: 11px;">${escapeHtml(JSON.stringify(val, null, 2))}</pre>` :
                                                      escapeHtml(String(val));
                                    return `<td style="padding: 10px; font-size: 12px; color: var(--text-secondary);">${displayVal}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${data.length > 100 ? `<div style="padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 12px;">Showing first 100 of ${data.length} results</div>` : ''}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function refreshSharedView() {
    if (shareViewId) {
        document.getElementById('sharedViewLoading').style.display = 'flex';
        document.getElementById('sharedViewError').style.display = 'none';
        document.getElementById('sharedViewGrid').style.display = 'none';
        loadSharedView(shareViewId);
    }
}

function showError(message) {
    document.getElementById('sharedViewLoading').style.display = 'none';
    document.getElementById('sharedViewError').style.display = 'flex';
    document.getElementById('sharedViewErrorMessage').textContent = message;
}

// Helper functions
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

function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally accessible
window.executeSharedQuery = executeSharedQuery;
window.refreshSharedView = refreshSharedView;

