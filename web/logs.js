// Logs Management
// pageSize is defined in routing.js

// Column configuration
const AVAILABLE_COLUMNS = {
    timestamp: { id: 'timestamp', label: 'Timestamp', default: true, required: true },
    device_title: { id: 'device_title', label: 'Device Title', default: false, required: false },
    ip_source: { id: 'ip_source', label: 'IP Message Source', default: false, required: false },
    listener_name: { id: 'listener_name', label: 'Listener Name', default: false, required: false },
    protocol: { id: 'protocol', label: 'Protocol', default: false, required: false },
    listener_id: { id: 'listener_id', label: 'Listener ID', default: false, required: false },
    device_type: { id: 'device_type', label: 'Device Type', default: false, required: false },
    severity: { id: 'severity', label: 'Severity', default: true, required: true },
    event_type: { id: 'event_type', label: 'Event Type', default: true, required: true },
    message: { id: 'message', label: 'Message', default: true, required: true }
};

let columnConfig = null;

function getDefaultColumnWidth(columnId) {
    const widths = {
        timestamp: 180,
        device_title: 150,
        ip_source: 140,
        listener_name: 120,
        protocol: 80,
        listener_id: 100,
        device_type: 120,
        severity: 120,
        event_type: 200,
        message: 300
    };
    return widths[columnId] || 150;
}

function loadColumnConfig() {
    const saved = localStorage.getItem('logsColumnConfig');
    if (saved) {
        try {
            columnConfig = JSON.parse(saved);
            // Validate config
            const validIds = Object.keys(AVAILABLE_COLUMNS);
            columnConfig = columnConfig.filter(col => validIds.includes(col.id));
            
            // Ensure required columns are present and in correct order
            const requiredCols = Object.values(AVAILABLE_COLUMNS).filter(col => col.required);
            requiredCols.forEach(col => {
                if (!columnConfig.find(c => c.id === col.id)) {
                    // Insert required columns at the beginning
                    columnConfig.unshift({ id: col.id, visible: true });
                }
            });
            
            // Ensure severity comes after timestamp if both are present
            const timestampIndex = columnConfig.findIndex(c => c.id === 'timestamp');
            const severityIndex = columnConfig.findIndex(c => c.id === 'severity');
            if (timestampIndex !== -1 && severityIndex !== -1 && severityIndex < timestampIndex) {
                const severity = columnConfig.splice(severityIndex, 1)[0];
                columnConfig.splice(timestampIndex + 1, 0, severity);
            }
            
            // Ensure all columns have width if missing
            columnConfig.forEach(col => {
                if (!col.width) {
                    col.width = getDefaultColumnWidth(col.id);
                }
            });
        } catch (e) {
            columnConfig = getDefaultColumnConfig();
            // Add default widths
            columnConfig.forEach(col => {
                col.width = getDefaultColumnWidth(col.id);
            });
        }
    } else {
        columnConfig = getDefaultColumnConfig();
        // Add default widths
        columnConfig.forEach(col => {
            col.width = getDefaultColumnWidth(col.id);
        });
    }
    saveColumnConfig();
}

function getDefaultColumnConfig() {
    // Define explicit order for default columns
    const defaultOrder = ['timestamp', 'severity', 'event_type', 'message'];
    const defaultCols = defaultOrder
        .map(id => AVAILABLE_COLUMNS[id])
        .filter(col => col && col.default)
        .map(col => ({ id: col.id, visible: true }));
    
    // Add any other default columns that weren't in the explicit order
    Object.values(AVAILABLE_COLUMNS).forEach(col => {
        if (col.default && !defaultOrder.includes(col.id)) {
            defaultCols.push({ id: col.id, visible: true });
        }
    });
    
    return defaultCols;
}

function saveColumnConfig() {
    localStorage.setItem('logsColumnConfig', JSON.stringify(columnConfig));
}

function initLogs() {
    // Load column configuration
    loadColumnConfig();
    
    // Setup column configuration UI
    setupColumnConfig();
    
    // Render column headers
    renderColumnHeaders();
    
    // Setup pagination buttons
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                updateURL();
                fetchLogs();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentPage++;
            updateURL();
            fetchLogs();
        });
    }
}

function setupColumnConfig() {
    const configBtn = document.getElementById('logsColumnConfigBtn');
    const configMenu = document.getElementById('logsColumnConfigMenu');
    
    if (!configBtn || !configMenu) return;
    
    // Toggle menu
    configBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = configMenu.style.display !== 'none';
        configMenu.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            renderColumnConfigMenu();
        }
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!configMenu.contains(e.target) && !configBtn.contains(e.target)) {
            configMenu.style.display = 'none';
        }
    });
    
    // Prevent menu click from closing
    configMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

let isReordering = false; // Flag to prevent animation replay

function renderColumnConfigMenu() {
    const list = document.getElementById('columnConfigList');
    if (!list) return;
    
    const wasReordering = isReordering;
    isReordering = false;
    
    list.innerHTML = '';
    
    // Create draggable list
    const sortedColumns = [...columnConfig];
    const availableColumns = Object.values(AVAILABLE_COLUMNS);
    
    sortedColumns.forEach((colConfig, index) => {
        const colDef = AVAILABLE_COLUMNS[colConfig.id];
        if (!colDef) return;
        
        const item = document.createElement('div');
        item.className = 'column-config-item';
        if (wasReordering) {
            item.classList.add('no-animate');
        }
        item.draggable = true;
        item.dataset.columnId = colConfig.id;
        item.dataset.index = index;
        
        item.innerHTML = `
            <i class="fas fa-grip-vertical"></i>
            <label>
                <input type="checkbox" ${colConfig.visible ? 'checked' : ''} ${colDef.required ? 'disabled' : ''} 
                       onchange="toggleColumnVisibility('${colConfig.id}', this.checked)">
                <span>${colDef.label}</span>
            </label>
        `;
        
        // Drag and drop handlers
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', colConfig.id);
            item.classList.add('dragging');
            // Create a ghost image
            const dragImage = item.cloneNode(true);
            dragImage.style.width = item.offsetWidth + 'px';
            dragImage.style.opacity = '0.8';
            document.body.appendChild(dragImage);
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            e.dataTransfer.setDragImage(dragImage, 0, 0);
            setTimeout(() => {
                document.body.removeChild(dragImage);
                item.style.opacity = '0.5';
            }, 0);
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            item.style.opacity = '';
            // Remove drag-over class from all items
            list.querySelectorAll('.column-config-item').forEach(i => {
                i.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
            });
        });
        
        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (!item.classList.contains('dragging')) {
                const rect = item.getBoundingClientRect();
                const y = e.clientY;
                const midpoint = rect.top + rect.height / 2;
                
                item.classList.remove('drag-over-top', 'drag-over-bottom');
                if (y < midpoint) {
                    item.classList.add('drag-over', 'drag-over-top');
                } else {
                    item.classList.add('drag-over', 'drag-over-bottom');
                }
            }
        });
        
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = item.getBoundingClientRect();
            const y = e.clientY;
            const midpoint = rect.top + rect.height / 2;
            
            item.classList.remove('drag-over-top', 'drag-over-bottom');
            if (y < midpoint) {
                item.classList.add('drag-over-top');
            } else {
                item.classList.add('drag-over-bottom');
            }
            
            // Visual feedback only - don't move DOM elements during dragover
            // The actual reordering happens on drop
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedIdFromData = e.dataTransfer.getData('text/plain');
            let draggingItem = list.querySelector('.dragging');
            
            if (!draggingItem) {
                // Try to find by data attribute
                const allItems = Array.from(list.querySelectorAll('.column-config-item'));
                draggingItem = allItems.find(item => item.dataset.columnId === draggedIdFromData);
            }
            
            if (!draggingItem) {
                item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
                return;
            }
            
            // Get indices from dataset (set during render)
            const draggedId = draggingItem.dataset.columnId || draggedIdFromData;
            const targetId = item.dataset.columnId;
            
            const draggedIndex = columnConfig.findIndex(c => c.id === draggedId);
            const targetIndex = columnConfig.findIndex(c => c.id === targetId);
            
            if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
                // Calculate new index based on drop position
                const rect = item.getBoundingClientRect();
                const y = e.clientY;
                const midpoint = rect.top + rect.height / 2;
                
                // Determine insert position
                let insertIndex;
                if (y < midpoint) {
                    // Insert before target
                    insertIndex = targetIndex;
                } else {
                    // Insert after target
                    insertIndex = targetIndex + 1;
                }
                
                // Adjust if dragging from before the target
                if (draggedIndex < insertIndex) {
                    insertIndex -= 1;
                }
                
                // Only reorder if position actually changed
                if (draggedIndex !== insertIndex) {
                    isReordering = true;
                    const [removed] = columnConfig.splice(draggedIndex, 1);
                    columnConfig.splice(insertIndex, 0, removed);
                    saveColumnConfig();
                    renderColumnHeaders();
                    renderColumnConfigMenu();
                    // Don't refetch logs on reorder
                }
            }
            item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
        
        list.appendChild(item);
    });
    
    // Add available but not yet added columns
    const addedIds = new Set(columnConfig.map(c => c.id));
    Object.values(AVAILABLE_COLUMNS).forEach(colDef => {
            if (!addedIds.has(colDef.id) && !colDef.required) {
            const item = document.createElement('div');
            item.className = 'column-config-item';
            if (wasReordering) {
                item.classList.add('no-animate');
            }
            item.style.opacity = '0.7';
            item.innerHTML = `
                <i class="fas fa-grip-vertical" style="opacity: 0.3;"></i>
                <label>
                    <input type="checkbox" onchange="addColumn('${colDef.id}', this.checked)">
                    <span>${colDef.label}</span>
                </label>
            `;
            list.appendChild(item);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.column-config-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function toggleColumnVisibility(columnId, visible) {
    const col = columnConfig.find(c => c.id === columnId);
    if (col) {
        col.visible = visible;
        saveColumnConfig();
        renderColumnHeaders();
        if (typeof fetchLogs === 'function') {
            fetchLogs();
        }
    }
}

function addColumn(columnId, visible) {
    if (!columnConfig.find(c => c.id === columnId)) {
        columnConfig.push({ 
            id: columnId, 
            visible: visible,
            width: getDefaultColumnWidth(columnId)
        });
        saveColumnConfig();
        renderColumnConfigMenu();
        renderColumnHeaders();
        if (typeof fetchLogs === 'function') {
            fetchLogs();
        }
    }
}

function resetColumnConfig() {
    columnConfig = getDefaultColumnConfig();
    saveColumnConfig();
    renderColumnConfigMenu();
    renderColumnHeaders();
    if (typeof fetchLogs === 'function') {
        fetchLogs();
    }
}

function renderColumnHeaders() {
    const container = document.getElementById('logsColumnsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const visibleColumns = columnConfig.filter(c => c.visible);
    
    visibleColumns.forEach((colConfig, index) => {
        const colDef = AVAILABLE_COLUMNS[colConfig.id];
        if (!colDef) return;
        
        const header = document.createElement('div');
        header.className = `col-${colConfig.id} log-column-header`;
        header.dataset.columnId = colConfig.id;
        
        // Get saved width or use default
        const savedWidth = colConfig.width || getDefaultColumnWidth(colConfig.id);
        header.style.cssText = getColumnStyle(colConfig.id) + `width: ${savedWidth}px; position: relative;`;
        
        header.innerHTML = `
            <span>${colDef.label}</span>
            ${colDef.required ? '' : '<i class="fas fa-sort" style="opacity: 0.3; font-size: 10px; margin-left: 4px;"></i>'}
            <div class="column-resize-handle" data-column-id="${colConfig.id}" style="position: absolute; right: 0; top: 0; bottom: 0; width: 4px; cursor: col-resize; opacity: 0; transition: opacity 0.2s ease; background: var(--accent);"></div>
        `;
        
        // Setup resize handler
        setupColumnResize(header, colConfig.id);
        
        container.appendChild(header);
    });
}

function setupColumnResize(headerElement, columnId) {
    const resizeHandle = headerElement.querySelector('.column-resize-handle');
    if (!resizeHandle) return;
    
    let isResizing = false;
    let startX, startWidth;
    
    // Show resize handle on hover
    headerElement.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '0.6';
    });
    
    headerElement.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.opacity = '0';
        }
    });
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        
        const rect = headerElement.getBoundingClientRect();
        startX = e.clientX;
        startWidth = rect.width;
        
        resizeHandle.style.opacity = '1';
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
    });
    
    function handleResize(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(80, startWidth + deltaX); // Minimum width of 80px
        
        // Update header width
        headerElement.style.width = `${newWidth}px`;
        
        // Update all log entry columns with this column ID
        const logEntries = document.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            const colElement = entry.querySelector(`.col-${columnId}`);
            if (colElement) {
                colElement.style.width = `${newWidth}px`;
                colElement.style.minWidth = `${newWidth}px`;
                colElement.style.maxWidth = `${newWidth}px`;
            }
        });
    }
    
    function stopResize() {
        if (!isResizing) return;
        
        isResizing = false;
        resizeHandle.style.opacity = '0';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Save width to config
        const colConfig = columnConfig.find(c => c.id === columnId);
        if (colConfig) {
            const currentWidth = parseInt(headerElement.style.width) || getDefaultColumnWidth(columnId);
            colConfig.width = currentWidth;
            saveColumnConfig();
        }
        
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }
}

function getColumnStyle(columnId) {
    const styles = {
        timestamp: 'min-width: 180px; max-width: 220px;',
        device_title: 'min-width: 150px; max-width: 200px;',
        ip_source: 'min-width: 140px; max-width: 180px; font-family: "SF Mono", "Monaco", "Cascadia Code", "Roboto Mono", monospace;',
        listener_name: 'min-width: 120px; max-width: 160px;',
        protocol: 'min-width: 80px; max-width: 100px;',
        listener_id: 'min-width: 100px; max-width: 140px; font-family: "SF Mono", "Monaco", "Cascadia Code", "Roboto Mono", monospace;',
        device_type: 'min-width: 120px; max-width: 150px;',
        severity: 'min-width: 120px; max-width: 150px;',
        event_type: 'min-width: 200px; max-width: 280px;',
        message: 'flex: 1; min-width: 200px;'
    };
    return styles[columnId] || '';
}

// Make functions globally accessible
window.toggleColumnVisibility = toggleColumnVisibility;
window.addColumn = addColumn;
window.resetColumnConfig = resetColumnConfig;

async function fetchLogs() {
    try {
        let url = `${API_BASE}/api/logs?limit=${pageSize}&offset=${currentPage * pageSize}`;
        if (filters.severity) url += `&severity=${filters.severity}`;
        if (filters.device) url += `&device=${encodeURIComponent(filters.device)}`;
        if (filters.device_type) url += `&device_type=${encodeURIComponent(filters.device_type)}`;
        if (filters.event_type) url += `&event_type=${encodeURIComponent(filters.event_type)}`;
        if (filters.date_range) {
            if (filters.date_range === 'custom' && filters.date_from && filters.date_to) {
                url += `&date_from=${encodeURIComponent(filters.date_from)}`;
                url += `&date_to=${encodeURIComponent(filters.date_to)}`;
            } else {
                url += `&date_range=${encodeURIComponent(filters.date_range)}`;
            }
        }
        if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
        
        console.log('Fetching logs from:', url);
        const response = await apiFetch(url);
        
        if (!response.ok) {
            console.error('API error:', response.status, response.statusText);
            return;
        }
        
        const logs = await response.json();
        console.log('Received logs response:', logs);
        
        if (!logs || !Array.isArray(logs)) {
            console.error('Invalid logs response:', logs);
            const container = document.getElementById('logsList');
            if (container) {
                container.innerHTML = '<div class="empty-state">Invalid response from server</div>';
            }
            return;
        }
        
        console.log('Received', logs.length, 'logs');
        renderLogs(logs);
        
        // Update pagination
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');
        
        if (prevBtn) prevBtn.disabled = currentPage === 0;
        if (nextBtn) {
            // Disable next button if we got fewer logs than pageSize (last page)
            nextBtn.disabled = logs.length < pageSize;
        }
        if (pageInfo) {
            const totalPages = logs.length < pageSize ? currentPage + 1 : '?';
            pageInfo.textContent = `Page ${currentPage + 1}${totalPages !== '?' ? ` of ${totalPages}` : ''}`;
        }
    } catch (error) {
        console.error('Error fetching logs:', error);
        const container = document.getElementById('logsList');
        if (container) {
            container.innerHTML = `<div class="empty-state">Error loading logs: ${error.message}</div>`;
        }
    }
}

// Cache for device and listener information
let deviceCache = null;
let deviceCacheTime = 0;
let listenerCache = null;
let listenerCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute

function getDeviceTypeColor(deviceType) {
    const colors = {
        'meraki': '#10b981',    // Green
        'ubiquiti': '#06b6d4',  // Light Blue (Cyan)
        'cisco': '#3b82f6',     // Blue
        'generic': '#6b7280',   // Gray
    };
    return colors[deviceType] || colors['generic'];
}

async function fetchDeviceInfo() {
    const now = Date.now();
    if (deviceCache && (now - deviceCacheTime) < CACHE_DURATION) {
        return deviceCache;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/api/devices`);
        if (response.ok) {
            deviceCache = await response.json();
            deviceCacheTime = now;
            return deviceCache;
        }
    } catch (error) {
        console.error('Error fetching devices:', error);
    }
    return [];
}

async function fetchListenerInfo() {
    const now = Date.now();
    if (listenerCache && (now - listenerCacheTime) < CACHE_DURATION) {
        return listenerCache;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/api/listeners`);
        if (response.ok) {
            listenerCache = await response.json();
            listenerCacheTime = now;
            return listenerCache;
        }
    } catch (error) {
        console.error('Error fetching listeners:', error);
    }
    return [];
}

function getDeviceByIP(ipAddress, devices) {
    if (!ipAddress || !devices) return null;
    const ip = ipAddress.split(':')[0]; // Remove port if present
    return devices.find(device => 
        device.ip_addresses && device.ip_addresses.includes(ip)
    ) || null;
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
    
    // Fetch device and listener info and render
    Promise.all([fetchDeviceInfo(), fetchListenerInfo()]).then(([devices, listeners]) => {
        renderLogsWithDevices(logs, devices, listeners);
    });
}

function renderLogsWithDevices(logs, devices, listeners) {
    const container = document.getElementById('logsList');
    if (!container) return;
    
    // Check if this is the first render (no existing log entries)
    const isFirstRender = !container.querySelector('.log-entry');
    
    const visibleColumns = columnConfig.filter(c => c.visible);
    
    console.log('Rendering', logs.length, 'logs');
    container.innerHTML = logs.map(log => {
        const severity = getSeverityName(log.severity);
        const severityColor = getSeverityColor(log.severity);
        
        // Get device information
        const ipAddress = log.remote_addr || (log.parsed_fields && log.parsed_fields.source_ip) || (log.parsed_fields && log.parsed_fields.ip) || '';
        const device = getDeviceByIP(ipAddress, devices);
        const deviceName = device ? device.name : (log.hostname || (log.parsed_fields && log.parsed_fields.device_name) || '-');
        const deviceId = device ? device.id : null;
        const listenerId = device ? device.listener_id : null;
        
        // Get listener information if available
        let listenerName = '-';
        let protocol = '-';
        if (listenerId && listeners) {
            const listener = listeners.find(l => l.id === listenerId);
            if (listener) {
                listenerName = listener.name || '-';
                protocol = listener.protocol || '-';
            }
        }
        
        // Get event type icon
        const eventTypeIcon = getEventTypeIcon(log.event_type);
        
        // Format event type for display
        let eventTypeDisplay = '-';
        if (log.event_type && log.event_type !== 'unknown') {
            eventTypeDisplay = log.event_type
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
        
        // Build columns based on configuration
        const columns = visibleColumns.map(colConfig => {
            const colDef = AVAILABLE_COLUMNS[colConfig.id];
            if (!colDef) return '';
            
            let content = '';
            switch (colConfig.id) {
                case 'timestamp':
                    content = formatTimestamp(log.timestamp);
                    break;
                case 'device_title':
                    const deviceType = device ? device.device_type : (log.device_type || 'generic');
                    const deviceBadgeColor = getDeviceTypeColor(deviceType);
                    content = `<span class="device-badge" style="background: ${deviceBadgeColor}15; color: ${deviceBadgeColor}; border: 1px solid ${deviceBadgeColor}30; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">${escapeHtml(deviceName)}</span>`;
                    break;
                case 'ip_source':
                    content = `<span style="font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace; font-size: 12px; color: var(--text-secondary);">${escapeHtml(ipAddress.split(':')[0] || '-')}</span>`;
                    break;
                case 'listener_name':
                    content = escapeHtml(listenerName);
                    break;
                case 'protocol':
                    content = escapeHtml(protocol);
                    break;
                case 'listener_id':
                    content = escapeHtml(listenerId || '-');
                    break;
                case 'device_type':
                    content = escapeHtml(log.device_type || '-');
                    break;
                case 'severity':
                    content = `<span class="severity-badge" style="background: ${severityColor}20; color: ${severityColor}; border: 1px solid ${severityColor}40;">${severity}</span>`;
                    break;
                case 'event_type':
                    content = `${eventTypeIcon}<span style="color: #9ca3af; font-size: 12px; margin-left: 4px;">${eventTypeDisplay}</span>`;
                    break;
                case 'message':
                    content = escapeHtml(log.message || log.raw_message || '-');
                    break;
                default:
                    content = '-';
            }
            
            const colStyle = getColumnStyle(colConfig.id);
            const savedWidth = colConfig.width || getDefaultColumnWidth(colConfig.id);
            const widthStyle = colConfig.id === 'message' ? '' : `width: ${savedWidth}px; min-width: ${savedWidth}px; max-width: ${savedWidth}px;`;
            return `<div class="col-${colConfig.id}" style="${colStyle} ${widthStyle}">${content}</div>`;
        }).join('');
        
        const animateClass = isFirstRender ? '' : ' no-animate';
        return `
            <div class="log-entry${animateClass}" onclick="showLogDetail(${log.id})">
                ${columns}
            </div>
        `;
    }).join('');
    
    // Update log entry grid template based on visible columns
    const logEntries = container.querySelectorAll('.log-entry');
    
    logEntries.forEach((entry, index) => {
        
        const visibleCols = columnConfig.filter(c => c.visible);
        const gridCols = visibleCols.map(col => {
            if (col.id === 'message') return '1fr';
            const savedWidth = col.width || getDefaultColumnWidth(col.id);
            return `${savedWidth}px`;
        }).join(' ');
        entry.style.gridTemplateColumns = gridCols;
    });
}

async function showLogDetail(id) {
    try {
        const response = await apiFetch(`${API_BASE}/api/logs/${id}`);
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
    
    // Ensure modal is properly centered
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
}

function renderDeviceSpecificDetail(log, displayInfo, severity, severityColor) {
    let iconHtml = '<i class="fas fa-info-circle"></i>';
    
    if (displayInfo.icon) {
        // If it's already HTML with <i class
        if (displayInfo.icon.includes('<i class')) {
            iconHtml = displayInfo.icon;
        }
        // If it's a Font Awesome class name (starts with fa-)
        else if (displayInfo.icon.startsWith('fa-')) {
            iconHtml = `<i class="fas ${displayInfo.icon}"></i>`;
        }
        // If it's an emoji, convert to Font Awesome
        else {
            const emojiMap = {
                '📡': '<i class="fas fa-satellite-dish"></i>',
                '🔐': '<i class="fas fa-lock"></i>',
                '🛡️': '<i class="fas fa-shield-alt"></i>',
                '🦠': '<i class="fas fa-virus"></i>',
                '📋': '<i class="fas fa-clipboard-list"></i>',
                '🔓': '<i class="fas fa-unlock"></i>',
                '🔄': '<i class="fas fa-sync-alt"></i>',
                '🚀': '<i class="fas fa-rocket"></i>',
                '✅': '<i class="fas fa-check-circle"></i>',
                '❌': '<i class="fas fa-times-circle"></i>',
                '🔗': '<i class="fas fa-link"></i>',
                '🔌': '<i class="fas fa-plug"></i>',
                '👤': '<i class="fas fa-user"></i>',
                '🌐': '<i class="fas fa-globe"></i>',
                '⚠️': '<i class="fas fa-exclamation-triangle"></i>',
                '🚫': '<i class="fas fa-ban"></i>',
                '🔥': '<i class="fas fa-fire"></i>',
                '🔑': '<i class="fas fa-key"></i>',
                '⚡': '<i class="fas fa-bolt"></i>',
                '📶': '<i class="fas fa-signal"></i>',
                '🎫': '<i class="fas fa-ticket-alt"></i>',
                '🌊': '<i class="fas fa-water"></i>',
                '👹': '<i class="fas fa-ghost"></i>',
                '🎭': '<i class="fas fa-theater-masks"></i>',
            };
            iconHtml = emojiMap[displayInfo.icon] || '<i class="fas fa-info-circle"></i>';
        }
    }
    
    // Ensure proper styling
    if (iconHtml.includes('<i class')) {
        if (!iconHtml.includes('style=')) {
            iconHtml = iconHtml.replace('>', ' style="font-size: 36px;">');
        } else if (!iconHtml.includes('font-size')) {
            iconHtml = iconHtml.replace('style="', 'style="font-size: 36px; ');
        }
    }
    
    let html = `
        <div class="device-header" style="background: linear-gradient(135deg, ${displayInfo.color}15 0%, ${displayInfo.color}05 100%); border-left: 4px solid ${displayInfo.color}; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 16px;">
                <div style="width: 64px; height: 64px; background: ${displayInfo.color}20; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${displayInfo.color};">
                    ${iconHtml}
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: ${displayInfo.color}; letter-spacing: -0.5px;">${displayInfo.title}</h3>
                    <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">${displayInfo.description || 'No description available'}</p>
                </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding-top: 16px; border-top: 1px solid ${displayInfo.color}20;">
    `;
    
    // Check if severity badge already exists in displayInfo.badges
    const hasSeverityBadge = displayInfo.badges && displayInfo.badges.some(badge => badge.label === "Severity");
    
    if (displayInfo.badges && displayInfo.badges.length > 0) {
        displayInfo.badges.forEach(badge => {
            html += `
                <span style="padding: 6px 14px; background: ${badge.color}15; color: ${badge.color}; border: 1px solid ${badge.color}30; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <span style="opacity: 0.8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${badge.label}:</span>
                    <span>${badge.value}</span>
                </span>
            `;
        });
    }
    
    // Only add severity badge if it's not already in displayInfo.badges
    if (!hasSeverityBadge) {
        html += `
                <span style="padding: 6px 14px; background: ${severityColor}15; color: ${severityColor}; border: 1px solid ${severityColor}30; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <span style="opacity: 0.8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Severity:</span>
                    <span>${severity}</span>
                </span>
        `;
    }
    
    html += `
            </div>
        </div>
        
        <div class="detail-section" style="background: #1a1f2e; padding: 20px; border-radius: 12px; border: 1px solid #2d3441; margin-bottom: 20px;">
            <h4 style="margin: 0 0 20px 0; color: #e4e7eb; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <span style="width: 4px; height: 16px; background: ${displayInfo.color}; border-radius: 2px;"></span>
                Event Details
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
    `;
    
    if (displayInfo.details && displayInfo.details.length > 0) {
        displayInfo.details.forEach(detail => {
            let valueHtml = detail.value;
            let icon = '';
            
            if (detail.type === 'ip') {
                valueHtml = `<span style="font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace; color: #6366f1; font-weight: 600; background: #6366f110; padding: 4px 8px; border-radius: 4px;">${detail.value}</span>`;
                icon = '<i class="fas fa-globe" style="font-size: 12px;"></i>';
            } else if (detail.type === 'mac') {
                valueHtml = `<span style="font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace; color: #8b5cf6; font-weight: 600; background: #8b5cf610; padding: 4px 8px; border-radius: 4px;">${detail.value}</span>`;
                icon = '<i class="fas fa-link" style="font-size: 12px;"></i>';
            } else if (detail.type === 'url' && detail.link) {
                valueHtml = `<a href="${detail.link}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; font-weight: 500; border-bottom: 1px solid #3b82f640; transition: all 0.2s;" onmouseover="this.style.borderBottomColor='#3b82f6'" onmouseout="this.style.borderBottomColor='#3b82f640'">${detail.value}</a>`;
                icon = '<i class="fas fa-external-link-alt" style="font-size: 12px;"></i>';
            } else if (detail.type === 'signature' && detail.link) {
                valueHtml = `<a href="${detail.link}" target="_blank" rel="noopener noreferrer" style="color: #ef4444; text-decoration: none; font-weight: 700; border-bottom: 2px solid #ef444460; transition: all 0.2s;" onmouseover="this.style.borderBottomColor='#ef4444'" onmouseout="this.style.borderBottomColor='#ef444460'">${detail.value}</a>`;
                icon = '<i class="fas fa-shield-alt" style="font-size: 12px;"></i>';
            } else {
                valueHtml = `<span style="color: #e4e7eb;">${detail.value}</span>`;
            }
            
            html += `
                <div style="background: #252b3b; padding: 14px; border-radius: 8px; border: 1px solid #2d3441; transition: all 0.2s;" onmouseover="this.style.borderColor='#3d4451'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#2d3441'; this.style.transform='translateY(0)'">
                    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        ${icon ? icon : ''}
                        ${detail.label}
                    </div>
                    <div style="font-size: 14px; line-height: 1.5; word-break: break-word;">${valueHtml}</div>
                </div>
            `;
        });
    } else {
        html += `<div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 20px;">No additional details available</div>`;
    }
    
    html += `</div></div>`;
    
    if (displayInfo.actions && displayInfo.actions.length > 0) {
        html += `
            <div style="background: #1a1f2e; padding: 20px; border-radius: 12px; border: 1px solid #2d3441; margin-bottom: 20px;">
                <h4 style="margin: 0 0 16px 0; color: #e4e7eb; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <span style="width: 4px; height: 16px; background: ${displayInfo.color}; border-radius: 2px;"></span>
                    Quick Actions
                </h4>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        `;
        displayInfo.actions.forEach(action => {
            const actionColor = action.type === 'link' ? '#3b82f6' : displayInfo.color;
            let actionIcon = '<i class="fas fa-cog"></i>';
            if (action.type === 'link') {
                actionIcon = '<i class="fas fa-external-link-alt"></i>';
            } else if (action.type === 'view_rule') {
                actionIcon = '<i class="fas fa-clipboard-list"></i>';
            }
            html += `
                <button onclick="${action.type === 'link' ? `window.open('${action.url}', '_blank')` : 'handleAction(\'' + action.type + '\', ' + log.id + ')'}" 
                        style="padding: 10px 20px; font-size: 13px; font-weight: 600; background: ${actionColor}15; color: ${actionColor}; border: 1px solid ${actionColor}30; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;"
                        onmouseover="this.style.background='${actionColor}25'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'"
                        onmouseout="this.style.background='${actionColor}15'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    ${actionIcon}
                    ${action.label}
                </button>
            `;
        });
        html += `</div></div>`;
    }
    
    html += `
        <div class="detail-section" style="background: #1a1f2e; padding: 20px; border-radius: 12px; border: 1px solid #2d3441; margin-top: 20px;">
            <h4 style="margin: 0 0 16px 0; color: #e4e7eb; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <span style="width: 4px; height: 16px; background: #9ca3af; border-radius: 2px;"></span>
                Raw Syslog Message
            </h4>
            <div style="background: #0f1419; padding: 16px; border-radius: 8px; border: 1px solid #2d3441; overflow-x: auto;">
                <pre style="white-space: pre-wrap; font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace; font-size: 12px; line-height: 1.6; color: #e4e7eb; margin: 0; word-break: break-word;">${escapeHtml(log.raw_message || '-')}</pre>
            </div>
        </div>
    `;
    
    return html;
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
            <div class="log-detail-value"><pre style="white-space: pre-wrap;">${escapeHtml(log.raw_message || '-')}</pre></div>
        </div>
    `;
}

function handleAction(actionType, logId) {
    console.log('Action:', actionType, 'for log:', logId);
}
