// Views Management

// Build API URL for logs with filters
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

function initViews() {
    // Setup event listeners for views page
    const addViewBtn = document.getElementById('addViewBtn');
    if (addViewBtn) {
        addViewBtn.addEventListener('click', () => {
            openViewBuilder();
        });
    }
}

function fetchViews() {
    apiFetch(`${API_BASE}/api/views`)
        .then(res => res.json())
        .then(data => {
            renderViews(data || []);
        })
        .catch(err => {
            console.error('Error fetching views:', err);
            const container = document.getElementById('viewsList');
            if (container) {
                container.innerHTML = '<div class="empty-state">Error loading views</div>';
            }
        });
}

function renderViews(views) {
    const container = document.getElementById('viewsList');
    if (!container) return;
    
    if (views.length === 0) {
        container.innerHTML = '<div class="empty-state">No views created. Click "Create View" to create one.</div>';
        return;
    }
    
    container.innerHTML = views.map(view => `
        <div class="view-card">
            <div class="view-header">
                <h3>${escapeHtml(view.name || 'Unnamed View')}</h3>
            </div>
            <div class="view-details">
                ${view.description ? `<p>${escapeHtml(view.description)}</p>` : '<p style="color: var(--text-tertiary); font-style: italic;">No description</p>'}
                <div class="view-actions">
                    <button class="btn-primary btn-sm" onclick="openView('${view.id}', false)" title="Open View">
                        <i class="fas fa-eye"></i> Open
                    </button>
                    <button class="btn-secondary btn-sm" onclick="editView('${view.id}')" title="Edit View">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-secondary btn-sm" onclick="shareView('${view.id}')" title="Share View">
                        <i class="fas fa-share"></i> Share
                    </button>
                    <button class="btn-secondary btn-sm" onclick="exportView('${view.id}')" title="Export as JSON">
                        <i class="fas fa-download"></i> Export
                    </button>
                    <button class="btn-danger btn-sm" onclick="deleteView('${view.id}')" title="Delete View">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

let currentEditingViewId = null;
let isReadOnlyMode = false;

function openView(viewId, readOnly = false) {
    // Navigate to full-screen view display
    if (readOnly) {
        // For shared views, update URL and show view
        window.history.pushState({ view: 'view-display', viewId: viewId, readOnly: true }, '', `?share=${viewId}`);
        loadViewDisplay(viewId, true);
    } else {
        // For regular views, navigate to view display
        window.history.pushState({ view: 'view-display', viewId: viewId, readOnly: false }, '', `?view=view-display&id=${viewId}`);
        loadViewDisplay(viewId, false);
    }
}

function loadViewDisplay(viewId, readOnly = false) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    
    // Show view display
    const viewDisplay = document.getElementById('viewDisplayView');
    if (viewDisplay) {
        viewDisplay.classList.remove('hidden');
    }
    
    // Hide sidebar and header for full-screen experience
    document.body.classList.add('fullscreen-view');
    
    // Fetch the view from the API
    apiFetch(`${API_BASE}/api/views/${viewId}`)
        .then(res => {
            if (!res.ok) {
                throw new Error('View not found');
            }
            return res.json();
        })
        .then(view => {
            // Update header
            const title = document.getElementById('viewDisplayTitle');
            const subtitle = document.getElementById('viewDisplaySubtitle');
            if (title) title.textContent = view.name || 'Unnamed View';
            if (subtitle) subtitle.textContent = view.description || '';
            
            // Show/hide action buttons
            const shareBtn = document.getElementById('viewDisplayShareBtn');
            const editBtn = document.getElementById('viewDisplayEditBtn');
            if (shareBtn) shareBtn.style.display = readOnly ? 'none' : 'inline-block';
            if (editBtn) editBtn.style.display = readOnly ? 'none' : 'inline-block';
            
            // Store current view info
            window.currentDisplayViewId = viewId;
            window.currentDisplayViewReadOnly = readOnly;
            
            // Render widgets
            renderViewDisplay(view, readOnly);
        })
        .catch(err => {
            console.error('Error loading view:', err);
            const grid = document.getElementById('viewDisplayGrid');
            if (grid) {
                grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--error);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>Error loading view: ${err.message}</p>
                </div>`;
            }
        });
}

function renderViewDisplay(view, readOnly = false) {
    const grid = document.getElementById('viewDisplayGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
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
        const widgetElement = createViewDisplayWidget(widget, readOnly);
        grid.appendChild(widgetElement);
        
        // Initialize widget content with real data
        initializeViewDisplayWidget(widget);
    });
}

function createViewDisplayWidget(widget, readOnly = false) {
    const widgetNames = {
        'stat-card': 'Stat Card',
        'chart-severity': 'Severity Chart',
        'chart-protocol': 'Protocol Chart',
        'event-timeline': 'Event Timeline',
        'chart-event-type': 'Event Type Chart',
        'device-stats': 'Device Stats',
        'query-builder': 'Query Builder',
        'data-table': 'Data Table',
        'top-n': 'Top N List'
    };
    
    // Use custom name if provided, otherwise use default
    const widgetName = (widget.config && widget.config.name && widget.config.name.trim()) 
        ? widget.config.name.trim() 
        : (widgetNames[widget.type] || widget.type);
    const gridCols = Math.min(widget.width || 4, 12);
    const gridRows = widget.height || 1;
    
    const div = document.createElement('div');
    div.className = 'view-display-widget';
    div.dataset.widgetId = widget.id;
    div.style.gridColumn = `span ${gridCols}`;
    div.style.gridRow = `span ${gridRows}`;
    
    div.innerHTML = `
        <div class="view-display-widget-header">
            <h3 class="view-display-widget-title">${escapeHtml(widgetName)}</h3>
        </div>
        <div class="view-display-widget-content" id="viewDisplayWidget_${widget.id}">
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary);">
                <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>
                Loading...
            </div>
        </div>
    `;
    
    return div;
}

function initializeViewDisplayWidget(widget) {
    // Initialize widget content with real data from API
    switch (widget.type) {
        case 'stat-card':
            loadStatCardDataForDisplay(widget);
            break;
        case 'chart-severity':
        case 'chart-protocol':
        case 'chart-event-type':
            initializeChartForDisplay(widget);
            break;
        case 'top-n':
            loadTopNDataForDisplay(widget);
            break;
        case 'device-stats':
            loadDeviceStatsForDisplay(widget);
            break;
            case 'data-table':
                loadDataTableForDisplay(widget);
                break;
            case 'query-builder':
                initializeQueryBuilderForDisplay(widget);
                break;
        case 'event-timeline':
            initializeEventTimelineForDisplay(widget);
            break;
        default:
            const container = document.getElementById(`viewDisplayWidget_${widget.id}`);
            if (container) {
                container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-tertiary);">Widget type "${widget.type}" - Configuration needed</div>`;
            }
    }
}

function closeViewDisplay() {
    // Hide view display
    const viewDisplay = document.getElementById('viewDisplayView');
    if (viewDisplay) {
        viewDisplay.classList.add('hidden');
    }
    
    // Show sidebar and header again
    document.body.classList.remove('fullscreen-view');
    
    // Navigate back to views page
    showView('views', true);
    fetchViews();
}

function refreshViewDisplay() {
    const viewId = window.currentDisplayViewId;
    const readOnly = window.currentDisplayViewReadOnly;
    if (viewId) {
        loadViewDisplay(viewId, readOnly);
    }
}

function shareCurrentView() {
    const viewId = window.currentDisplayViewId;
    if (viewId) {
        shareView(viewId);
    }
}

function editCurrentView() {
    const viewId = window.currentDisplayViewId;
    if (viewId) {
        closeViewDisplay();
        // Open in edit mode (builder)
        setTimeout(() => {
            openViewBuilder();
            loadViewIntoBuilder({ id: viewId, name: '', widgets: [] }, false);
            // Fetch the actual view
            apiFetch(`${API_BASE}/api/views/${viewId}`)
                .then(res => res.json())
                .then(view => {
                    loadViewIntoBuilder(view, false);
                });
        }, 100);
    }
}

function editView(viewId) {
    openView(viewId, false);
}

function loadViewIntoBuilder(view, readOnly = false) {
    const modal = document.getElementById('viewBuilderModal');
    if (!modal) return;
    
    currentEditingViewId = view.id;
    isReadOnlyMode = readOnly;
    
    // Update modal title
    const title = document.getElementById('viewBuilderTitle');
    if (title) {
        title.textContent = readOnly ? `View: ${view.name}` : `Edit View: ${view.name}`;
    }
    
    // Set view name input
    const nameInput = document.getElementById('viewNameInput');
    if (nameInput) {
        nameInput.value = view.name || '';
        nameInput.disabled = readOnly;
    }
    
    // Load widgets
    currentViewWidgets = view.widgets || [];
    
    // Clear and rebuild canvas
    const canvasGrid = document.getElementById('viewCanvasGrid');
    if (canvasGrid) {
        canvasGrid.innerHTML = '';
        
        if (currentViewWidgets.length === 0) {
            canvasGrid.innerHTML = `
                <div class="empty-canvas" style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #6b7280;">
                    <i class="fas fa-mouse-pointer" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p style="font-size: 14px;">${readOnly ? 'This view has no widgets' : 'Drag widgets here to build your view'}</p>
                </div>
            `;
        } else {
            // Render all widgets
            currentViewWidgets.forEach(widget => {
                const widgetElement = createWidgetElement(widget, readOnly);
                canvasGrid.appendChild(widgetElement);
                
                // Setup resizing (only if not read-only)
                if (!readOnly) {
                    setupWidgetResize(widgetElement, widget.id);
                }
                
                // Initialize widget content
                initializeWidgetContent(widget);
            });
        }
    }
    
    // Hide/show controls based on read-only mode
    const saveBtn = document.getElementById('saveViewBtn');
    const widgetItems = document.querySelectorAll('.widget-item');
    const configureButtons = document.querySelectorAll('.btn-icon[onclick*="configureWidget"]');
    const removeButtons = document.querySelectorAll('.btn-icon[onclick*="removeWidget"]');
    
    if (readOnly) {
        // Hide edit controls
        if (saveBtn) saveBtn.style.display = 'none';
        widgetItems.forEach(item => item.style.display = 'none');
        configureButtons.forEach(btn => btn.style.display = 'none');
        removeButtons.forEach(btn => btn.style.display = 'none');
    } else {
        // Show edit controls
        if (saveBtn) saveBtn.style.display = 'inline-block';
        widgetItems.forEach(item => item.style.display = 'flex');
        configureButtons.forEach(btn => btn.style.display = 'inline-block');
        removeButtons.forEach(btn => btn.style.display = 'inline-block');
        
        // Setup drag and drop
        setupDragAndDrop();
    }
    
    // Show modal
    modal.style.display = 'flex';
}

function shareView(viewId) {
    // Generate shareable link - use separate /shared route
    const shareUrl = `${window.location.origin}/shared?share=${viewId}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Shareable link copied to clipboard!\n\n' + shareUrl + '\n\nThis link provides read-only access to the view.');
    }).catch(err => {
        console.error('Error copying to clipboard:', err);
        prompt('Copy this link:', shareUrl);
    });
}

function exportView(viewId) {
    // Fetch the view
    apiFetch(`${API_BASE}/api/views/${viewId}`)
        .then(res => res.json())
        .then(view => {
            // Create export object (exclude internal IDs)
            const exportData = {
                name: view.name,
                description: view.description || '',
                widgets: view.widgets || []
            };
            
            // Create blob and download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${view.name || 'view'}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(err => {
            console.error('Error exporting view:', err);
            alert('Error exporting view: ' + (err.message || 'Unknown error'));
        });
}

function importView() {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importData = JSON.parse(event.target.result);
                
                // Validate import data
                if (!importData.name || !importData.widgets) {
                    throw new Error('Invalid view format: missing name or widgets');
                }
                
                // Confirm import
                const confirmMsg = `Import view "${importData.name}"?\n\nThis will create a new view with ${importData.widgets.length} widget(s).`;
                if (!confirm(confirmMsg)) {
                    return;
                }
                
                // Create the view
                const view = {
                    name: importData.name,
                    description: importData.description || '',
                    widgets: importData.widgets || []
                };
                
                apiFetch(`${API_BASE}/api/views`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(view)
                })
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed to import view: ${res.statusText}`);
                    }
                    return res.json();
                })
                .then(data => {
                    alert('View imported successfully!');
                    fetchViews();
                })
                .catch(err => {
                    console.error('Error importing view:', err);
                    alert('Error importing view: ' + (err.message || 'Unknown error'));
                });
            } catch (err) {
                console.error('Error parsing import file:', err);
                alert('Error parsing import file: ' + (err.message || 'Invalid JSON format'));
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function deleteView(viewId) {
    if (!confirm('Are you sure you want to delete this view?')) {
        return;
    }
    
    apiFetch(`${API_BASE}/api/views/${viewId}`, {
        method: 'DELETE'
    })
    .then(() => {
        fetchViews();
    })
    .catch(err => {
        console.error('Error deleting view:', err);
        alert('Error deleting view');
    });
}

let currentViewWidgets = []; // Track widgets in the current view
let draggedWidgetType = null;
let currentlyConfiguringWidgetId = null;

function openViewBuilder(viewId = null) {
    const modal = document.getElementById('viewBuilderModal');
    if (modal) {
        // Reset state
        currentEditingViewId = null;
        isReadOnlyMode = false;
        currentlyConfiguringWidgetId = null;
        
        // Update modal title
        const title = document.getElementById('viewBuilderTitle');
        if (title) {
            title.textContent = 'Create Custom View';
        }
        
        // Reset canvas
        currentViewWidgets = [];
        const canvas = document.getElementById('viewCanvasGrid');
        if (canvas) {
            canvas.innerHTML = `
                <div class="empty-canvas" style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #6b7280;">
                    <i class="fas fa-mouse-pointer" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p style="font-size: 14px;">Drag widgets here to build your view</p>
                </div>
            `;
        }
        
        // Clear view name input
        const nameInput = document.getElementById('viewNameInput');
        if (nameInput) {
            nameInput.value = '';
            nameInput.disabled = false;
        }
        
        // Show all controls
        const saveBtn = document.getElementById('saveViewBtn');
        if (saveBtn) saveBtn.style.display = 'inline-block';
        const widgetItems = document.querySelectorAll('.widget-item');
        widgetItems.forEach(item => item.style.display = 'flex');
        
        // Setup drag and drop handlers
        setupDragAndDrop();
        
        modal.style.display = 'flex';
    }
}

function closeViewBuilder() {
    const modal = document.getElementById('viewBuilderModal');
    if (modal) {
        modal.style.display = 'none';
        // Reset state
        currentEditingViewId = null;
        isReadOnlyMode = false;
        currentlyConfiguringWidgetId = null;
    }
}

function setupDragAndDrop() {
    // Setup drag start for widget items
    const widgetItems = document.querySelectorAll('.widget-item[draggable="true"]');
    widgetItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
    
    // Setup drop zone for canvas
    const canvas = document.getElementById('viewCanvas');
    if (canvas) {
        canvas.addEventListener('dragover', handleDragOver);
        canvas.addEventListener('drop', handleDrop);
        canvas.addEventListener('dragleave', handleDragLeave);
    }
    
    const canvasGrid = document.getElementById('viewCanvasGrid');
    if (canvasGrid) {
        canvasGrid.addEventListener('dragover', handleDragOver);
        canvasGrid.addEventListener('drop', handleDrop);
        canvasGrid.addEventListener('dragleave', handleDragLeave);
    }
}

function handleDragStart(e) {
    // Get widget type from the element or its parent
    let widgetItem = e.target;
    while (widgetItem && !widgetItem.hasAttribute('data-widget-type')) {
        widgetItem = widgetItem.parentElement;
    }
    
    if (!widgetItem) return;
    
    draggedWidgetType = widgetItem.getAttribute('data-widget-type');
    widgetItem.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedWidgetType);
}

function handleDragEnd(e) {
    // Find the widget item element
    let widgetItem = e.target;
    while (widgetItem && !widgetItem.hasAttribute('data-widget-type')) {
        widgetItem = widgetItem.parentElement;
    }
    
    if (widgetItem) {
        widgetItem.style.opacity = '1';
    }
    draggedWidgetType = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    const canvas = document.getElementById('viewCanvas');
    if (canvas) {
        canvas.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const canvas = document.getElementById('viewCanvas');
    if (canvas) {
        canvas.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = document.getElementById('viewCanvas');
    if (canvas) {
        canvas.classList.remove('drag-over');
    }
    
    const widgetType = e.dataTransfer.getData('text/plain') || draggedWidgetType;
    if (!widgetType) return;
    
    // Remove empty canvas message if it exists
    const emptyCanvas = document.querySelector('.empty-canvas');
    if (emptyCanvas) {
        emptyCanvas.remove();
    }
    
    // Create new widget
    addWidgetToCanvas(widgetType);
}

function addWidgetToCanvas(widgetType) {
    const canvasGrid = document.getElementById('viewCanvasGrid');
    if (!canvasGrid) return;
    
    const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const widget = {
        id: widgetId,
        type: widgetType,
        config: {},
        width: 1, // Grid columns (1-4)
        height: 1 // Grid rows
    };
    
    currentViewWidgets.push(widget);
    
    // Create widget element (not read-only when adding new)
    const widgetElement = createWidgetElement(widget, false);
    canvasGrid.appendChild(widgetElement);
    
    // Setup resizing
    setupWidgetResize(widgetElement, widgetId);
    
    // Initialize widget content
    initializeWidgetContent(widget);
}

function createWidgetElement(widget, readOnly = false) {
    const widgetNames = {
        'stat-card': 'Stat Card',
        'chart-severity': 'Severity Chart',
        'chart-protocol': 'Protocol Chart',
        'event-timeline': 'Event Timeline',
        'chart-event-type': 'Event Type Chart',
        'device-stats': 'Device Stats',
        'query-builder': 'Query Builder',
        'data-table': 'Data Table',
        'top-n': 'Top N List'
    };
    
    // Use custom name if provided, otherwise use default
    const widgetName = (widget.config && widget.config.name && widget.config.name.trim()) 
        ? widget.config.name.trim() 
        : (widgetNames[widget.type] || widget.type);
    const gridCols = widget.width || 1;
    const gridRows = widget.height || 1;
    
    const div = document.createElement('div');
    div.className = 'view-widget';
    div.dataset.widgetId = widget.id;
    div.style.gridColumn = `span ${gridCols}`;
    div.style.gridRow = `span ${gridRows}`;
    
    // Hide edit controls in read-only mode
    const editControls = readOnly ? 'style="display: none;"' : '';
    const resizeHandleStyle = readOnly ? 'display: none;' : 'opacity: 0; transition: opacity 0.2s;';
    
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; color: #e4e7eb; font-size: 14px; font-weight: 600;">${escapeHtml(widgetName)}</h4>
            <div style="display: flex; gap: 8px;" ${editControls}>
                <button class="btn-icon" onclick="configureWidget('${widget.id}')" title="Configure">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn-icon" onclick="removeWidget('${widget.id}')" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        <div class="widget-content" data-widget-type="${widget.type}" style="min-height: 150px;">
            ${renderWidgetContent(widget)}
        </div>
        <div class="widget-resize-handle" style="position: absolute; bottom: 4px; right: 4px; width: 20px; height: 20px; cursor: nwse-resize; ${resizeHandleStyle}">
            <i class="fas fa-grip-lines" style="font-size: 12px; color: #9ca3af;"></i>
        </div>
    `;
    
    return div;
}

function renderWidgetContent(widget) {
    const config = widget.config || {};
    
    switch (widget.type) {
        case 'stat-card':
            return renderStatCard(config);
        case 'chart-severity':
            return renderSeverityChart(config);
        case 'chart-protocol':
            return renderProtocolChart(config);
        case 'event-timeline':
            return renderEventTimeline(config);
        case 'chart-event-type':
            return renderEventTypeChart(config);
        case 'device-stats':
            return renderDeviceStats(config);
        case 'query-builder':
            return renderQueryBuilder(config);
        case 'data-table':
            return renderDataTable(config);
        case 'top-n':
            return renderTopN(config);
        default:
            return `<div style="display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 13px; height: 100%;">${widget.type} - Click configure to set up</div>`;
    }
}

function renderStatCard(config) {
    const field = config.field || 'total';
    const label = config.label || 'Total Messages';
    const timeRange = config.timeRange || '24h';
    
    return `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 36px; font-weight: 700; color: #6366f1; margin-bottom: 8px;" id="stat-card-value-${config.id || ''}">
                Loading...
            </div>
            <div style="font-size: 14px; color: #9ca3af;">${label}</div>
        </div>
    `;
}

function renderSeverityChart(config) {
    const chartId = `chart-severity-${config.id || Date.now()}`;
    return `<canvas id="${chartId}" style="max-height: 300px;"></canvas>`;
}

function renderProtocolChart(config) {
    const chartId = `chart-protocol-${config.id || Date.now()}`;
    return `<canvas id="${chartId}" style="max-height: 300px;"></canvas>`;
}

function renderEventTimeline(config) {
    const timelineId = `event-timeline-${config.id || Date.now()}`;
    return `<canvas id="${timelineId}" style="max-height: 300px;"></canvas>`;
}

function renderEventTypeChart(config) {
    const chartId = `chart-event-type-${config.id || Date.now()}`;
    return `<canvas id="${chartId}" style="max-height: 300px;"></canvas>`;
}

function renderDeviceStats(config) {
    return `
        <div style="padding: 20px;">
            <div style="text-align: center; color: #9ca3af; margin-bottom: 16px;">Device Statistics</div>
            <div id="device-stats-${config.id || ''}" style="text-align: center; color: #6366f1; font-size: 24px; font-weight: 700;">
                Loading...
            </div>
        </div>
    `;
}

function renderQueryBuilder(config) {
    const queryId = config.id || '';
    return `
        <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                <div id="query-builder-editor-${queryId}" style="flex: 1; min-height: 200px; background: #1a1f2e; border: 1px solid #2d3441; border-radius: 8px; padding: 12px; font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace; font-size: 13px; color: #e4e7eb; overflow: auto; position: relative;">
                    <textarea id="query-builder-textarea-${queryId}" 
                              placeholder="Start typing your query... Use Ctrl+Space for autocomplete"
                              style="width: 100%; height: 100%; background: transparent; border: none; color: inherit; font-family: inherit; font-size: inherit; resize: none; outline: none; padding: 0;"
                              spellcheck="false">${escapeHtml(config.query || '')}</textarea>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px; align-items: center;">
                    <button class="btn-primary" onclick="executeQuery('${queryId}')" style="flex: 1; padding: 10px;">
                        <i class="fas fa-play"></i> Execute Query
                    </button>
                    <button class="btn-secondary" onclick="formatQuery('${queryId}')" title="Format Query">
                        <i class="fas fa-align-left"></i>
                    </button>
                    <button class="btn-secondary" onclick="clearQuery('${queryId}')" title="Clear Query">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div id="query-results-${queryId}" style="margin-top: 16px; max-height: 300px; overflow: auto; display: none;">
                <!-- Results will be displayed here -->
            </div>
        </div>
    `;
}

function renderDataTable(config) {
    return `
        <div style="max-height: 400px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;" id="data-table-${config.id || ''}">
                <thead>
                    <tr style="background: #252b3b; border-bottom: 1px solid #2d3441;">
                        <th style="padding: 8px; text-align: left; color: #9ca3af;">Column 1</th>
                        <th style="padding: 8px; text-align: left; color: #9ca3af;">Column 2</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="2" style="padding: 20px; text-align: center; color: #9ca3af;">Configure to set up</td></tr>
                </tbody>
            </table>
        </div>
    `;
}

function renderTopN(config) {
    const field = config.field || 'event_type';
    const limit = config.limit || 10;
    return `
        <div style="max-height: 400px; overflow-y: auto;" id="top-n-${config.id || ''}">
            <div style="text-align: center; padding: 20px; color: #9ca3af;">Loading top ${limit} ${field}...</div>
        </div>
    `;
}

function setupWidgetResize(widgetElement, widgetId) {
    const resizeHandle = widgetElement.querySelector('.widget-resize-handle');
    if (!resizeHandle) return;
    
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startGridCols, startGridRows;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        
        const widget = widgetElement;
        const rect = widget.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        
        // Get current grid span
        const gridCols = parseInt(widget.style.gridColumn.match(/span (\d+)/)?.[1] || '1');
        const gridRows = parseInt(widget.style.gridRow.match(/span (\d+)/)?.[1] || '1');
        startGridCols = gridCols;
        startGridRows = gridRows;
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
    });
    
    function handleResize(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Calculate grid columns/rows based on delta (each grid cell is ~320px)
        const gridCellWidth = 320;
        const gridCellHeight = 200;
        
        const newCols = Math.max(1, Math.min(4, Math.round((startWidth + deltaX) / gridCellWidth)));
        const newRows = Math.max(1, Math.min(4, Math.round((startHeight + deltaY) / gridCellHeight)));
        
        widgetElement.style.gridColumn = `span ${newCols}`;
        widgetElement.style.gridRow = `span ${newRows}`;
        
        // Update widget config
        const widget = currentViewWidgets.find(w => w.id === widgetId);
        if (widget) {
            widget.width = newCols;
            widget.height = newRows;
        }
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }
    
    // Show resize handle on hover
    widgetElement.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
    });
    
    widgetElement.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.opacity = '0';
        }
    });
}

function removeWidget(widgetId) {
    if (!confirm('Remove this widget?')) return;
    
    currentViewWidgets = currentViewWidgets.filter(w => w.id !== widgetId);
    const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (widgetElement) {
        widgetElement.remove();
    }
    
    // Show empty canvas message if no widgets left
    const canvasGrid = document.getElementById('viewCanvasGrid');
    if (canvasGrid && currentViewWidgets.length === 0) {
        canvasGrid.innerHTML = `
            <div class="empty-canvas" style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #6b7280;">
                <i class="fas fa-mouse-pointer" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 14px;">Drag widgets here to build your view</p>
            </div>
        `;
    }
}

function configureWidget(widgetId) {
    const widget = currentViewWidgets.find(w => w.id === widgetId);
    if (!widget) return;
    
    currentlyConfiguringWidgetId = widgetId;
    
    // Open widget configuration modal
    const modal = document.getElementById('widgetConfigModal');
    const configBody = document.getElementById('widgetConfigBody');
    const configTitle = document.getElementById('widgetConfigTitle');
    
    if (modal && configBody && configTitle) {
        configTitle.textContent = `Configure ${getWidgetDisplayName(widget.type)}`;
        
        // Generate config form (async)
        generateConfigForm(widget).then(html => {
            configBody.innerHTML = html;
            
            // Populate device suggestions after form is rendered
            setTimeout(() => {
                populateDeviceSuggestions();
            }, 100);
            
            // Setup device type change handler
            const deviceTypeSelect = document.getElementById('filter-deviceType');
            if (deviceTypeSelect) {
                deviceTypeSelect.addEventListener('change', updateFilterBuilderForDeviceType);
            }
        });
        
        modal.style.display = 'flex';
    }
}

// Update filter builder when device type changes
async function updateFilterBuilderForDeviceType() {
    const deviceType = document.getElementById('filter-deviceType')?.value || '';
    const currentFilters = collectFilters();
    currentFilters.device_type = deviceType;
    
    // Regenerate filter builder section
    const filterBuilder = await generateFilterBuilder({ filters: currentFilters });
    const existingFilterSection = document.querySelector('.filter-builder-section');
    if (existingFilterSection) {
        existingFilterSection.outerHTML = filterBuilder;
        
        // Re-attach event listener
        const deviceTypeSelect = document.getElementById('filter-deviceType');
        if (deviceTypeSelect) {
            deviceTypeSelect.addEventListener('change', updateFilterBuilderForDeviceType);
        }
    }
}

// Make it globally accessible
window.updateFilterBuilderForDeviceType = updateFilterBuilderForDeviceType;

function getWidgetDisplayName(widgetType) {
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
    return names[widgetType] || widgetType;
}

// Module metadata cache
// Use the moduleMetadataCache from filters.js instead of declaring a new one
// let moduleMetadataCache = null; // Removed - using global from filters.js

// Fetch and cache module metadata
async function fetchModuleMetadata() {
    // Use global moduleMetadataCache from filters.js if available
    if (typeof moduleMetadataCache !== 'undefined' && moduleMetadataCache && Object.keys(moduleMetadataCache).length > 0) {
        return moduleMetadataCache;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/api/module-metadata`);
        if (response.ok) {
            const metadata = await response.json();
            // Update global cache if it exists
            if (typeof moduleMetadataCache !== 'undefined') {
                Object.assign(moduleMetadataCache, metadata);
            }
            return metadata;
        }
    } catch (err) {
        console.error('Error fetching module metadata:', err);
    }
    return {};
}

// Get metadata for a specific device type
async function getModuleMetadata(deviceType) {
    const allMetadata = await fetchModuleMetadata();
    if (deviceType && allMetadata[deviceType]) {
        return allMetadata[deviceType];
    }
    return null;
}

// Generate advanced filter builder (reusable across all widgets)
async function generateFilterBuilder(config = {}) {
    const filters = config.filters || {};
    const selectedDeviceType = filters.device_type || '';
    
    // Fetch module metadata
    const metadata = selectedDeviceType ? await getModuleMetadata(selectedDeviceType) : null;
    
    // Count active filters for indicator
    const activeFilters = [];
    if (filters.device) activeFilters.push('Device');
    if (filters.device_type) activeFilters.push('Device Type');
    if (filters.event_type) activeFilters.push('Event Type');
    if (filters.severity) activeFilters.push('Severity');
    if (filters.search) activeFilters.push('Search');
    if (filters.custom_fields && filters.custom_fields.length > 0) {
        activeFilters.push(`${filters.custom_fields.length} Custom Field${filters.custom_fields.length > 1 ? 's' : ''}`);
    }
    
    // Build event type options from metadata, grouped by device type and category
    let eventTypeOptions = '';
    
    // Check both EventTypes (Go struct) and event_types (JSON)
    const eventTypes = metadata?.EventTypes || metadata?.event_types || [];
    if (selectedDeviceType && metadata && Array.isArray(eventTypes) && eventTypes.length > 0) {
        // Single device type: group by category
        const byCategory = {};
        eventTypes.forEach(eventType => {
            const category = eventType.Category || eventType.category || 'Other';
            if (!byCategory[category]) {
                byCategory[category] = [];
            }
            byCategory[category].push(eventType);
        });
        
        Object.keys(byCategory).sort().forEach(category => {
            eventTypeOptions += `<optgroup label="${escapeHtml(category)}">`;
            byCategory[category].forEach(eventType => {
                const id = eventType.ID || eventType.id || '';
                const name = eventType.Name || eventType.name || '';
                const description = eventType.Description || eventType.description || '';
                eventTypeOptions += `<option value="${escapeHtml(id)}" ${filters.event_type === id ? 'selected' : ''}>${escapeHtml(name)}${description ? ` - ${escapeHtml(description)}` : ''}</option>`;
            });
            eventTypeOptions += `</optgroup>`;
        });
    } else if (!selectedDeviceType) {
        // No device type selected: show all event types grouped by device type and category
        // Use global moduleMetadataCache if available, otherwise fetch
        const apiBase = typeof API_BASE !== 'undefined' ? API_BASE : window.location.origin;
        const allMetadata = typeof moduleMetadataCache !== 'undefined' && Object.keys(moduleMetadataCache).length > 0 
            ? moduleMetadataCache 
            : await fetch(`${apiBase}/api/module-metadata`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        
        const byDeviceType = {};
        for (const deviceType in allMetadata) {
            const deviceMetadata = allMetadata[deviceType];
            // Check both EventTypes (Go struct) and event_types (JSON)
            const eventTypes = deviceMetadata?.EventTypes || deviceMetadata?.event_types || [];
            if (Array.isArray(eventTypes) && eventTypes.length > 0) {
                const deviceTypeName = deviceMetadata.DeviceName || deviceMetadata.device_name || deviceType;
                if (!byDeviceType[deviceType]) {
                    byDeviceType[deviceType] = {
                        name: deviceTypeName,
                        categories: {}
                    };
                }
                
                eventTypes.forEach(eventType => {
                    const category = eventType.Category || eventType.category || 'Other';
                    if (!byDeviceType[deviceType].categories[category]) {
                        byDeviceType[deviceType].categories[category] = [];
                    }
                    byDeviceType[deviceType].categories[category].push(eventType);
                });
            }
        }
        
        Object.keys(byDeviceType).sort().forEach(deviceType => {
            const deviceTypeData = byDeviceType[deviceType];
            eventTypeOptions += `<optgroup label="━━━ ${escapeHtml(deviceTypeData.name)} ━━━" class="device-type-optgroup">`;
            
            Object.keys(deviceTypeData.categories).sort().forEach(category => {
                eventTypeOptions += `<option disabled class="category-label">  ${escapeHtml(category)}</option>`;
                deviceTypeData.categories[category].forEach(eventType => {
                    const id = eventType.ID || eventType.id || '';
                    const name = eventType.Name || eventType.name || '';
                    const description = eventType.Description || eventType.description || '';
                    eventTypeOptions += `<option value="${escapeHtml(id)}" ${filters.event_type === id ? 'selected' : ''}>    ${escapeHtml(name)}${description ? ` - ${escapeHtml(description)}` : ''}</option>`;
                });
            });
            
            eventTypeOptions += `</optgroup>`;
        });
    } else {
        // Default options (fallback)
        eventTypeOptions = `
            <option value="vpn_connectivity_change" ${filters.event_type === 'vpn_connectivity_change' ? 'selected' : ''}>VPN Connectivity Change</option>
            <option value="urls" ${filters.event_type === 'urls' ? 'selected' : ''}>URLs</option>
            <option value="flows" ${filters.event_type === 'flows' ? 'selected' : ''}>Flows</option>
            <option value="security_file_scanned" ${filters.event_type === 'security_file_scanned' ? 'selected' : ''}>Security File Scanned</option>
            <option value="ids_alert" ${filters.event_type === 'ids_alert' ? 'selected' : ''}>IDS Alert</option>
            <option value="association" ${filters.event_type === 'association' ? 'selected' : ''}>Association</option>
            <option value="disassociation" ${filters.event_type === 'disassociation' ? 'selected' : ''}>Disassociation</option>
            <option value="wired_client_connected" ${filters.event_type === 'wired_client_connected' ? 'selected' : ''}>Wired Client Connected</option>
            <option value="wired_client_disconnected" ${filters.event_type === 'wired_client_disconnected' ? 'selected' : ''}>Wired Client Disconnected</option>
        `;
    }
    
    // Build common fields suggestions from metadata
    let commonFieldsOptions = '';
    if (metadata && metadata.common_fields && metadata.common_fields.length > 0) {
        commonFieldsOptions = metadata.common_fields.map(field => 
            `<option value="${escapeHtml(field.key)}">${escapeHtml(field.label)} - ${escapeHtml(field.description)}</option>`
        ).join('');
    } else {
        // Default common fields
        commonFieldsOptions = `
            <option value="src">Source IP</option>
            <option value="dst">Destination IP</option>
            <option value="protocol">Protocol</option>
            <option value="signature">Signature</option>
            <option value="priority">Priority</option>
            <option value="UNIFIhost">UNIFI Host</option>
            <option value="UNIFIcategory">UNIFI Category</option>
            <option value="UNIFIsubCategory">UNIFI Sub Category</option>
            <option value="UNIFIclientIp">UNIFI Client IP</option>
            <option value="UNIFIclientMac">UNIFI Client MAC</option>
            <option value="port">Port</option>
            <option value="sport">Source Port</option>
            <option value="dport">Destination Port</option>
        `;
    }
    
    return `
        <div class="filter-builder-section" style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-filter" style="color: var(--accent);"></i>
                    Log Filters
                    ${activeFilters.length > 0 ? `<span style="background: var(--accent); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-left: 8px;">${activeFilters.length} active</span>` : ''}
                </h4>
                ${activeFilters.length > 0 ? `
                    <button type="button" class="btn-secondary btn-sm" onclick="clearAllFilters()" style="padding: 4px 12px; font-size: 11px;">
                        <i class="fas fa-times"></i> Clear All
                    </button>
                ` : ''}
            </div>
            ${activeFilters.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; padding: 8px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="font-size: 11px; color: var(--text-secondary); margin-right: 4px;">Active:</span>
                    ${activeFilters.map(filter => `
                        <span style="font-size: 11px; padding: 4px 8px; background: var(--accent); color: white; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                            ${escapeHtml(filter)}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
                <div class="form-group">
                    <label class="form-label">Device (Hostname/Name)</label>
                    <input type="text" id="filter-device" class="form-input" 
                           value="${escapeHtml(filters.device || '')}" 
                           placeholder="e.g., Jacks Cloud Gateway Ultra, MX67, AP_firstfloor"
                           list="deviceSuggestions">
                    <datalist id="deviceSuggestions">
                        <!-- Will be populated dynamically -->
                    </datalist>
                    <small class="form-hint">Filter by specific device hostname or name (autocomplete available)</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Device Type</label>
                    <select id="filter-deviceType" class="form-select" onchange="updateFilterBuilderForDeviceType()">
                        <option value="">All Device Types</option>
                        <option value="generic" ${filters.device_type === 'generic' ? 'selected' : ''}>Generic</option>
                        <option value="meraki" ${filters.device_type === 'meraki' ? 'selected' : ''}>Meraki</option>
                        <option value="ubiquiti" ${filters.device_type === 'ubiquiti' ? 'selected' : ''}>Ubiquiti</option>
                    </select>
                    <small class="form-hint">${metadata ? metadata.description : 'Select device type to see specific filters and event types'}</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Event Type</label>
                    <select id="filter-eventType" class="form-select">
                        <option value="">All Event Types</option>
                        ${eventTypeOptions}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Severity</label>
                    <select id="filter-severity" class="form-select">
                        <option value="">All Severities</option>
                        <option value="0" ${filters.severity === '0' ? 'selected' : ''}>Emergency (0)</option>
                        <option value="1" ${filters.severity === '1' ? 'selected' : ''}>Alert (1)</option>
                        <option value="2" ${filters.severity === '2' ? 'selected' : ''}>Critical (2)</option>
                        <option value="3" ${filters.severity === '3' ? 'selected' : ''}>Error (3)</option>
                        <option value="4" ${filters.severity === '4' ? 'selected' : ''}>Warning (4)</option>
                        <option value="5" ${filters.severity === '5' ? 'selected' : ''}>Notice (5)</option>
                        <option value="6" ${filters.severity === '6' ? 'selected' : ''}>Informational (6)</option>
                        <option value="7" ${filters.severity === '7' ? 'selected' : ''}>Debug (7)</option>
                    </select>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
                <div class="form-group">
                    <label class="form-label">Time Range</label>
                    <select id="filter-timeRange" class="form-select">
                        <option value="1h" ${filters.timeRange === '1h' ? 'selected' : ''}>Last Hour</option>
                        <option value="24h" ${filters.timeRange === '24h' || !filters.timeRange ? 'selected' : ''}>Last 24 Hours</option>
                        <option value="7d" ${filters.timeRange === '7d' ? 'selected' : ''}>Last 7 Days</option>
                        <option value="30d" ${filters.timeRange === '30d' ? 'selected' : ''}>Last 30 Days</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Search/Keyword</label>
                    <input type="text" id="filter-search" class="form-input" 
                           value="${escapeHtml(filters.search || '')}" 
                           placeholder="Search in messages, hostnames, etc.">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Custom Field Filters</span>
                    <button type="button" class="btn-secondary btn-sm" onclick="addCustomFilter()" style="padding: 4px 8px; font-size: 11px;">
                        <i class="fas fa-plus"></i> Add Filter
                    </button>
                </label>
                <div id="customFiltersList" style="margin-top: 8px;">
                    ${renderCustomFilters(filters.custom_fields || [])}
                </div>
                <small class="form-hint">Filter by fields from parsed_fields (e.g., UNIFIhost, UNIFIcategory, src, dst, protocol, signature, priority)</small>
            </div>
        </div>
    `;
}

function renderCustomFilters(customFields) {
    if (!customFields || customFields.length === 0) {
        return '<div style="color: var(--text-tertiary); font-size: 12px; padding: 8px;">No custom filters. Click "Add Filter" to add one.</div>';
    }
    
    return customFields.map((field, index) => `
        <div class="custom-filter-item" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
            <input type="text" class="form-input" style="flex: 1; font-size: 12px; padding: 6px;" 
                   placeholder="Field name (e.g., src, dst, protocol, UNIFIhost)" 
                   value="${escapeHtml(field.key || '')}"
                   id="customFilterKey_${index}"
                   list="customFieldSuggestions_${index}">
            <datalist id="customFieldSuggestions_${index}">
                <option value="src">Source IP</option>
                <option value="dst">Destination IP</option>
                <option value="protocol">Protocol</option>
                <option value="signature">Signature</option>
                <option value="priority">Priority</option>
                <option value="UNIFIhost">UNIFI Host</option>
                <option value="UNIFIcategory">UNIFI Category</option>
                <option value="UNIFIsubCategory">UNIFI Sub Category</option>
                <option value="UNIFIclientIp">UNIFI Client IP</option>
                <option value="UNIFIclientMac">UNIFI Client MAC</option>
                <option value="port">Port</option>
                <option value="sport">Source Port</option>
                <option value="dport">Destination Port</option>
            </datalist>
            <select class="form-select" style="width: 120px; font-size: 12px; padding: 6px;" id="customFilterOp_${index}">
                <option value="equals" ${field.operator === 'equals' ? 'selected' : ''}>= (Equals)</option>
                <option value="not_equals" ${field.operator === 'not_equals' ? 'selected' : ''}>≠ (Not Equals)</option>
                <option value="contains" ${field.operator === 'contains' || !field.operator ? 'selected' : ''}>Contains</option>
                <option value="not_contains" ${field.operator === 'not_contains' ? 'selected' : ''}>Not Contains</option>
                <option value="starts_with" ${field.operator === 'starts_with' ? 'selected' : ''}>Starts With</option>
                <option value="ends_with" ${field.operator === 'ends_with' ? 'selected' : ''}>Ends With</option>
                <option value="regex" ${field.operator === 'regex' ? 'selected' : ''}>Regex</option>
                <option value="greater_than" ${field.operator === 'greater_than' ? 'selected' : ''}>Greater Than</option>
                <option value="less_than" ${field.operator === 'less_than' ? 'selected' : ''}>Less Than</option>
            </select>
            <input type="text" class="form-input" style="flex: 1; font-size: 12px; padding: 6px;" 
                   placeholder="Value" 
                   value="${escapeHtml(field.value || '')}"
                   id="customFilterValue_${index}">
            <button type="button" class="btn-icon" onclick="window.removeCustomFilter(${index})" style="padding: 6px;">
                <i class="fas fa-times" style="color: var(--error);"></i>
            </button>
        </div>
    `).join('');
}

let customFilterIndex = 0;

// Make functions globally accessible
window.addCustomFilter = function() {
    const list = document.getElementById('customFiltersList');
    if (!list) return;
    
    const index = customFilterIndex++;
    const filterHtml = `
        <div class="custom-filter-item" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
            <input type="text" class="form-input" style="flex: 1; font-size: 12px; padding: 6px;" 
                   placeholder="Field name (e.g., src, dst, protocol, UNIFIhost)" 
                   id="customFilterKey_${index}"
                   list="customFieldSuggestions_${index}">
            <datalist id="customFieldSuggestions_${index}">
                <option value="src">Source IP</option>
                <option value="dst">Destination IP</option>
                <option value="protocol">Protocol</option>
                <option value="signature">Signature</option>
                <option value="priority">Priority</option>
                <option value="UNIFIhost">UNIFI Host</option>
                <option value="UNIFIcategory">UNIFI Category</option>
                <option value="UNIFIsubCategory">UNIFI Sub Category</option>
                <option value="UNIFIclientIp">UNIFI Client IP</option>
                <option value="UNIFIclientMac">UNIFI Client MAC</option>
                <option value="port">Port</option>
                <option value="sport">Source Port</option>
                <option value="dport">Destination Port</option>
            </datalist>
            <select class="form-select" style="width: 120px; font-size: 12px; padding: 6px;" id="customFilterOp_${index}">
                <option value="equals">= (Equals)</option>
                <option value="not_equals">≠ (Not Equals)</option>
                <option value="contains" selected>Contains</option>
                <option value="not_contains">Not Contains</option>
                <option value="starts_with">Starts With</option>
                <option value="ends_with">Ends With</option>
                <option value="regex">Regex</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
            </select>
            <input type="text" class="form-input" style="flex: 1; font-size: 12px; padding: 6px;" 
                   placeholder="Value" 
                   id="customFilterValue_${index}">
            <button type="button" class="btn-icon" onclick="window.removeCustomFilter(${index})" style="padding: 6px;">
                <i class="fas fa-times" style="color: var(--error);"></i>
            </button>
        </div>
    `;
    
    if (list.innerHTML.includes('No custom filters')) {
        list.innerHTML = filterHtml;
    } else {
        list.insertAdjacentHTML('beforeend', filterHtml);
    }
};

window.removeCustomFilter = function(index) {
    const keyInput = document.getElementById(`customFilterKey_${index}`);
    if (keyInput) {
        keyInput.closest('.custom-filter-item').remove();
    } else {
        // Try to find by index in the list
        const items = document.querySelectorAll('.custom-filter-item');
        if (items[index]) {
            items[index].remove();
        }
    }
};

// Populate device suggestions from stats API
function populateDeviceSuggestions() {
    const datalist = document.getElementById('deviceSuggestions');
    if (!datalist) return;
    
    apiFetch(`${API_BASE}/api/stats`)
        .then(res => res.json())
        .then(stats => {
            const hostnames = stats.by_hostname || {};
            const deviceNames = Object.keys(hostnames).sort();
            
            // Also check for UNIFIhost in recent logs
            apiFetch(`${API_BASE}/api/logs?limit=1000`)
                .then(res => res.json())
                .then(logs => {
                    const unifiHosts = new Set();
                    logs.forEach(log => {
                        if (log.hostname) deviceNames.push(log.hostname);
                        if (log.parsed_fields) {
                            if (log.parsed_fields.UNIFIhost) {
                                unifiHosts.add(String(log.parsed_fields.UNIFIhost));
                            }
                            if (log.parsed_fields.host) {
                                unifiHosts.add(String(log.parsed_fields.host));
                            }
                        }
                    });
                    
                    // Combine and deduplicate
                    const allDevices = [...new Set([...deviceNames, ...Array.from(unifiHosts)])].sort();
                    
                    // Update datalist
                    datalist.innerHTML = allDevices.map(device => 
                        `<option value="${escapeHtml(device)}">${escapeHtml(device)}</option>`
                    ).join('');
                })
                .catch(err => console.error('Error fetching logs for device suggestions:', err));
        })
        .catch(err => console.error('Error fetching stats for device suggestions:', err));
}

// Make it globally accessible
window.populateDeviceSuggestions = populateDeviceSuggestions;

// Query Builder Functions
let queryAutocompleteData = {
    keywords: ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DISTINCT', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'UNION', 'ALL'],
    tables: ['logs'],
    fields: ['id', 'timestamp', 'severity', 'message', 'device_type', 'event_type', 'event_category', 'hostname', 'appname', 'raw_message', 'parsed_fields', 'priority', 'facility', 'version', 'remote_addr', 'protocol'],
    operators: ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'],
    functions: ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'UPPER', 'LOWER', 'SUBSTR', 'LENGTH', 'REPLACE', 'TRIM', 'DATE', 'DATETIME', 'json_extract']
};

function setupQueryBuilder(widget) {
    const queryId = widget.id || '';
    const textarea = document.getElementById(`query-builder-textarea-${queryId}`);
    if (!textarea) return;
    
    // Setup autocomplete
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === ' ') {
            e.preventDefault();
            showQueryAutocomplete(textarea, queryId);
        }
    });
    
    textarea.addEventListener('input', (e) => {
        handleQueryInput(e);
    });
}

function initializeQueryBuilderForDisplay(widget) {
    setupQueryBuilder(widget);
}

function handleQueryKeydown(e) {
    if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        const textarea = e.target;
        const queryId = textarea.id.replace('query-builder-textarea-', '').replace('config-query', 'widget');
        showQueryAutocomplete(textarea, queryId);
    }
}

function handleQueryInput(e) {
    // Hide autocomplete on input
    const autocomplete = document.getElementById('query-autocomplete');
    if (autocomplete) {
        autocomplete.style.display = 'none';
    }
}

function showQueryAutocomplete(textarea, queryId) {
    const autocomplete = document.getElementById('query-autocomplete');
    if (!autocomplete) return;
    
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const lastWord = textBefore.match(/\b(\w+)$/)?.[1] || '';
    
    // Get suggestions based on context
    let suggestions = [];
    const textLower = textBefore.toLowerCase();
    
    if (textLower.includes('select') && !textLower.includes('from')) {
        // Suggest fields
        suggestions = queryAutocompleteData.fields.map(f => ({ type: 'field', value: f }));
    } else if (textLower.includes('from')) {
        // Suggest tables
        suggestions = queryAutocompleteData.tables.map(t => ({ type: 'table', value: t }));
    } else if (textLower.match(/\bwhere\b/i) || textLower.match(/\band\b/i) || textLower.match(/\bor\b/i)) {
        // Suggest fields and operators
        suggestions = [
            ...queryAutocompleteData.fields.map(f => ({ type: 'field', value: f })),
            ...queryAutocompleteData.operators.map(o => ({ type: 'operator', value: o }))
        ];
    } else {
        // Suggest keywords
        suggestions = queryAutocompleteData.keywords.map(k => ({ type: 'keyword', value: k }));
    }
    
    // Filter by last word if present
    if (lastWord) {
        suggestions = suggestions.filter(s => s.value.toLowerCase().startsWith(lastWord.toLowerCase()));
    }
    
    if (suggestions.length === 0) {
        autocomplete.style.display = 'none';
        return;
    }
    
    // Render suggestions
    autocomplete.innerHTML = suggestions.slice(0, 20).map((s, idx) => {
        const icon = s.type === 'keyword' ? 'fa-key' : s.type === 'table' ? 'fa-table' : s.type === 'field' ? 'fa-tag' : 'fa-equals';
        return `
            <div class="autocomplete-item" data-value="${escapeHtml(s.value)}" data-index="${idx}" 
                 style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border);"
                 onmouseover="this.style.background='var(--bg-hover)'"
                 onmouseout="this.style.background='transparent'"
                 onclick="insertAutocompleteSuggestion('${queryId}', '${escapeHtml(s.value)}')">
                <i class="fas ${icon}" style="color: var(--accent); width: 16px;"></i>
                <span style="font-weight: 500;">${escapeHtml(s.value)}</span>
                <span style="margin-left: auto; font-size: 11px; color: var(--text-tertiary);">${s.type}</span>
            </div>
        `;
    }).join('');
    
    // Position autocomplete
    const rect = textarea.getBoundingClientRect();
    autocomplete.style.display = 'block';
    autocomplete.style.left = `${rect.left}px`;
    autocomplete.style.top = `${rect.bottom + 4}px`;
    
    // Add keyboard navigation
    let selectedIndex = 0;
    const items = autocomplete.querySelectorAll('.autocomplete-item');
    if (items.length > 0) {
        items[0].style.setProperty('background', 'var(--bg-hover)');
    }
    
    const handleKeydown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[selectedIndex]?.style.setProperty('background', 'transparent');
            selectedIndex = (selectedIndex + 1) % items.length;
            items[selectedIndex]?.style.setProperty('background', 'var(--bg-hover)');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[selectedIndex]?.style.setProperty('background', 'transparent');
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            items[selectedIndex]?.style.setProperty('background', 'var(--bg-hover)');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const value = items[selectedIndex]?.dataset.value;
            if (value) {
                insertAutocompleteSuggestion(queryId, value);
            }
        } else if (e.key === 'Escape') {
            autocomplete.style.display = 'none';
            textarea.removeEventListener('keydown', handleKeydown);
        }
    };
    
    textarea.addEventListener('keydown', handleKeydown);
}

function insertAutocompleteSuggestion(queryId, value) {
    const textarea = document.getElementById(`query-builder-textarea-${queryId}`) || 
                     document.getElementById('config-query');
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    const lastWordMatch = textBefore.match(/\b(\w+)$/);
    
    if (lastWordMatch) {
        const startPos = cursorPos - lastWordMatch[1].length;
        textarea.value = textBefore.substring(0, startPos) + value + ' ' + textAfter;
        textarea.selectionStart = textarea.selectionEnd = startPos + value.length + 1;
    } else {
        textarea.value = textBefore + value + ' ' + textAfter;
        textarea.selectionStart = textarea.selectionEnd = cursorPos + value.length + 1;
    }
    
    const autocomplete = document.getElementById('query-autocomplete');
    if (autocomplete) {
        autocomplete.style.display = 'none';
    }
    
    textarea.focus();
}

function executeQuery(queryId) {
    const textarea = document.getElementById(`query-builder-textarea-${queryId}`) || 
                     document.getElementById('config-query');
    if (!textarea) return;
    
    const query = textarea.value.trim();
    if (!query) {
        alert('Please enter a query');
        return;
    }
    
    const resultsDiv = document.getElementById(`query-results-${queryId}`);
    if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Executing query...</div>';
    }
    
    apiFetch(`${API_BASE}/api/query`, {
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
                renderQueryResults(resultsDiv, data);
            }
        }
    })
    .catch(err => {
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div style="padding: 20px; color: var(--error);"><i class="fas fa-exclamation-triangle"></i> Error: ${escapeHtml(err.message)}</div>`;
        }
    });
}

function renderQueryResults(container, data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);"><i class="fas fa-info-circle"></i> No results</div>';
        return;
    }
    
    const columns = Object.keys(data[0]);
    const html = `
        <div style="background: var(--bg-tertiary); border-radius: 8px; overflow: hidden;">
            <div style="padding: 12px; background: var(--bg-card); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: var(--text-primary);"><i class="fas fa-table"></i> ${data.length} result${data.length !== 1 ? 's' : ''}</span>
                <button class="btn-secondary btn-sm" onclick="exportQueryResults()" style="padding: 4px 12px;">
                    <i class="fas fa-download"></i> Export
                </button>
            </div>
            <div style="overflow-x: auto;">
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

function formatQuery(queryId) {
    const textarea = document.getElementById(`query-builder-textarea-${queryId}`) || 
                     document.getElementById('config-query');
    if (!textarea) return;
    
    // Simple SQL formatting
    let query = textarea.value;
    query = query.replace(/\bSELECT\b/gi, '\nSELECT');
    query = query.replace(/\bFROM\b/gi, '\nFROM');
    query = query.replace(/\bWHERE\b/gi, '\nWHERE');
    query = query.replace(/\bAND\b/gi, '\n  AND');
    query = query.replace(/\bOR\b/gi, '\n  OR');
    query = query.replace(/\bORDER BY\b/gi, '\nORDER BY');
    query = query.replace(/\bGROUP BY\b/gi, '\nGROUP BY');
    query = query.replace(/\bLIMIT\b/gi, '\nLIMIT');
    query = query.trim();
    
    textarea.value = query;
}

function clearQuery(queryId) {
    if (!confirm('Clear the query?')) return;
    const textarea = document.getElementById(`query-builder-textarea-${queryId}`) || 
                     document.getElementById('config-query');
    if (textarea) {
        textarea.value = '';
        const resultsDiv = document.getElementById(`query-results-${queryId}`);
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        }
    }
}

// Make query builder functions globally accessible
window.executeQuery = executeQuery;
window.formatQuery = formatQuery;
window.clearQuery = clearQuery;
window.handleQueryKeydown = handleQueryKeydown;
window.handleQueryInput = handleQueryInput;
window.insertAutocompleteSuggestion = insertAutocompleteSuggestion;

// Make view functions globally accessible
window.openView = openView;
window.editView = editView;
window.shareView = shareView;
window.exportView = exportView;
window.importView = importView;
window.deleteView = deleteView;
window.openViewBuilder = openViewBuilder;
window.closeViewBuilder = closeViewBuilder;
window.saveView = saveView;

function collectFilters() {
    const filters = {
        device: document.getElementById('filter-device')?.value?.trim() || '',
        device_type: document.getElementById('filter-deviceType')?.value || '',
        event_type: document.getElementById('filter-eventType')?.value?.trim() || '',
        severity: document.getElementById('filter-severity')?.value || '',
        timeRange: document.getElementById('filter-timeRange')?.value || '24h',
        search: document.getElementById('filter-search')?.value?.trim() || '',
        custom_fields: []
    };
    
    // Collect custom field filters
    const customFilterItems = document.querySelectorAll('.custom-filter-item');
    customFilterItems.forEach((item, index) => {
        const key = document.getElementById(`customFilterKey_${index}`)?.value?.trim() || '';
        const op = document.getElementById(`customFilterOp_${index}`)?.value || 'contains';
        const value = document.getElementById(`customFilterValue_${index}`)?.value?.trim() || '';
        
        if (key && value) {
            filters.custom_fields.push({
                key: key,
                operator: op,
                value: value
            });
        }
    });
    
    return filters;
}

// Filter logs by custom field filters with enhanced operators
function filterLogsByCustomFields(logs, customFields) {
    if (!customFields || customFields.length === 0) {
        return logs;
    }
    
    return logs.filter(log => {
        return customFields.every(field => {
            const fieldValue = log.parsed_fields && log.parsed_fields[field.key] 
                ? String(log.parsed_fields[field.key]) 
                : (log[field.key] ? String(log[field.key]) : '');
            
            const filterValue = String(field.value).toLowerCase();
            const value = fieldValue.toLowerCase();
            
            // Try to parse as number for comparison operators
            const numValue = parseFloat(fieldValue);
            const numFilter = parseFloat(field.value);
            const isNumeric = !isNaN(numValue) && !isNaN(numFilter);
            
            switch (field.operator || 'contains') {
                case 'equals':
                    return value === filterValue;
                case 'not_equals':
                    return value !== filterValue;
                case 'contains':
                    return value.includes(filterValue);
                case 'not_contains':
                    return !value.includes(filterValue);
                case 'starts_with':
                    return value.startsWith(filterValue);
                case 'ends_with':
                    return value.endsWith(filterValue);
                case 'regex':
                    try {
                        const regex = new RegExp(filterValue, 'i');
                        return regex.test(fieldValue);
                    } catch (e) {
                        return false;
                    }
                case 'greater_than':
                    return isNumeric ? numValue > numFilter : value > filterValue;
                case 'less_than':
                    return isNumeric ? numValue < numFilter : value < filterValue;
                default:
                    return value.includes(filterValue);
            }
        });
    });
}

async function generateConfigForm(widget) {
    const config = widget.config || {};
    
    // Common filter builder (now async)
    const filterBuilder = await generateFilterBuilder(config);
    
    // Common widget name field (available for all widgets)
    const nameField = `
        <div class="form-group">
            <label class="form-label">Widget Name</label>
            <input type="text" id="config-name" class="form-input" 
                   value="${escapeHtml(config.name || '')}" 
                   placeholder="Leave empty to use default name">
            <small class="form-hint">Custom name for this widget (displayed in the widget header)</small>
        </div>
    `;
    
    switch (widget.type) {
        case 'stat-card':
            return `
                ${nameField}
                ${filterBuilder}
                <div class="form-group">
                    <label class="form-label">Label</label>
                    <input type="text" id="config-label" class="form-input" value="${config.label || 'Total Messages'}" placeholder="Stat label">
                </div>
                <div class="form-group">
                    <label class="form-label">Aggregation</label>
                    <select id="config-field" class="form-select">
                        <option value="total" ${config.field === 'total' ? 'selected' : ''}>Total Count</option>
                        <option value="recent" ${config.field === 'recent' ? 'selected' : ''}>Recent (Last Hour)</option>
                        <option value="errors" ${config.field === 'errors' ? 'selected' : ''}>Error Count</option>
                        <option value="hosts" ${config.field === 'hosts' ? 'selected' : ''}>Unique Hosts</option>
                        <option value="devices" ${config.field === 'devices' ? 'selected' : ''}>Unique Devices</option>
                    </select>
                </div>
            `;
        case 'chart-severity':
        case 'chart-protocol':
        case 'chart-event-type':
            return `
                <div class="form-group">
                    <label class="form-label">Chart Type</label>
                    <select id="config-chartType" class="form-select">
                        <option value="pie" ${config.chartType === 'pie' ? 'selected' : ''}>Pie Chart</option>
                        <option value="doughnut" ${config.chartType === 'doughnut' ? 'selected' : ''}>Doughnut Chart</option>
                        <option value="bar" ${config.chartType === 'bar' ? 'selected' : ''}>Bar Chart</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Time Range</label>
                    <select id="config-timeRange" class="form-select">
                        <option value="1h" ${config.timeRange === '1h' ? 'selected' : ''}>Last Hour</option>
                        <option value="24h" ${config.timeRange === '24h' ? 'selected' : ''}>Last 24 Hours</option>
                        <option value="7d" ${config.timeRange === '7d' ? 'selected' : ''}>Last 7 Days</option>
                        <option value="30d" ${config.timeRange === '30d' ? 'selected' : ''}>Last 30 Days</option>
                    </select>
                </div>
            `;
        case 'top-n':
            return `
                <div class="form-group">
                    <label class="form-label">Field</label>
                    <select id="config-field" class="form-select">
                        <option value="event_type" ${config.field === 'event_type' ? 'selected' : ''}>Event Type</option>
                        <option value="device_type" ${config.field === 'device_type' ? 'selected' : ''}>Device Type</option>
                        <option value="hostname" ${config.field === 'hostname' ? 'selected' : ''}>Hostname/Device Name</option>
                        <option value="src" ${config.field === 'src' ? 'selected' : ''}>Source IP (from parsed_fields)</option>
                        <option value="dst" ${config.field === 'dst' ? 'selected' : ''}>Destination IP (from parsed_fields)</option>
                        <option value="protocol" ${config.field === 'protocol' ? 'selected' : ''}>Protocol (from parsed_fields)</option>
                        <option value="UNIFIhost" ${config.field === 'UNIFIhost' ? 'selected' : ''}>UNIFI Host (Ubiquiti)</option>
                        <option value="UNIFIcategory" ${config.field === 'UNIFIcategory' ? 'selected' : ''}>UNIFI Category (Ubiquiti)</option>
                        <option value="UNIFIsubCategory" ${config.field === 'UNIFIsubCategory' ? 'selected' : ''}>UNIFI Sub Category (Ubiquiti)</option>
                        <option value="source_ip" ${config.field === 'source_ip' ? 'selected' : ''}>Source IP</option>
                        <option value="dest_ip" ${config.field === 'dest_ip' ? 'selected' : ''}>Destination IP</option>
                        <option value="action" ${config.field === 'action' ? 'selected' : ''}>Action (Allow/Deny)</option>
                        <option value="event_category" ${config.field === 'event_category' ? 'selected' : ''}>Event Category</option>
                    </select>
                    <small class="form-hint">You can also use any field from parsed_fields by typing it in custom filters</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Time Range</label>
                    <select id="config-timeRange" class="form-select">
                        <option value="1h" ${config.timeRange === '1h' ? 'selected' : ''}>Last Hour</option>
                        <option value="24h" ${config.timeRange === '24h' ? 'selected' : ''}>Last 24 Hours</option>
                        <option value="7d" ${config.timeRange === '7d' ? 'selected' : ''}>Last 7 Days</option>
                        <option value="30d" ${config.timeRange === '30d' ? 'selected' : ''}>Last 30 Days</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Limit</label>
                    <input type="number" id="config-limit" class="form-input" value="${config.limit || 10}" min="1" max="50">
                </div>
                <div class="form-group">
                    <label class="form-label">Time Range</label>
                    <select id="config-timeRange" class="form-select">
                        <option value="1h" ${config.timeRange === '1h' ? 'selected' : ''}>Last Hour</option>
                        <option value="24h" ${config.timeRange === '24h' ? 'selected' : ''}>Last 24 Hours</option>
                        <option value="7d" ${config.timeRange === '7d' ? 'selected' : ''}>Last 7 Days</option>
                    </select>
                </div>
            `;
        case 'query-builder':
            return `
                <div class="form-group">
                    <label class="form-label">Query</label>
                    <textarea id="config-query" class="form-input" rows="6" placeholder="SELECT * FROM logs WHERE...">${config.query || ''}</textarea>
                </div>
            `;
        case 'data-table':
            return `
                ${filterBuilder}
                <div class="form-group">
                    <label class="form-label">Columns (comma-separated)</label>
                    <input type="text" id="config-columns" class="form-input" 
                           value="${config.columns || 'timestamp,severity,message'}" 
                           placeholder="timestamp,severity,message,event_type,device_type">
                    <small class="form-hint">Available: timestamp, severity, message, event_type, device_type, hostname, and fields from parsed_fields (e.g., src, dst, protocol)</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Limit</label>
                    <input type="number" id="config-limit" class="form-input" value="${config.limit || 20}" min="1" max="100">
                </div>
            `;
        default:
            return `<div style="padding: 20px; color: #9ca3af;">No configuration options available for this widget type.</div>`;
    }
}

function saveWidgetConfig() {
    if (!currentlyConfiguringWidgetId) return;
    
    const widget = currentViewWidgets.find(w => w.id === currentlyConfiguringWidgetId);
    if (!widget) return;
    
    // Collect filters first (common to all widgets)
    const filters = collectFilters();
    
    // Collect form values based on widget type
    const config = {
        filters: filters
    };
    
    // Collect widget name (common to all widgets)
    const widgetName = document.getElementById('config-name')?.value?.trim() || '';
    if (widgetName) {
        config.name = widgetName;
    } else {
        // Remove name if empty (use default)
        delete config.name;
    }
    
    switch (widget.type) {
        case 'stat-card':
            config.label = document.getElementById('config-label')?.value || 'Total Messages';
            config.field = document.getElementById('config-field')?.value || 'total';
            break;
        case 'chart-severity':
        case 'chart-protocol':
        case 'chart-event-type':
            config.chartType = document.getElementById('config-chartType')?.value || 'pie';
            config.groupBy = document.getElementById('config-groupBy')?.value || 'severity';
            break;
        case 'top-n':
            config.field = document.getElementById('config-field')?.value || 'event_type';
            config.limit = parseInt(document.getElementById('config-limit')?.value || '10');
            config.timeRange = document.getElementById('config-timeRange')?.value || '24h';
            break;
        case 'query-builder':
            config.query = document.getElementById('config-query')?.value || '';
            config.query_limit = parseInt(document.getElementById('config-query-limit')?.value || '100');
            config.query_timeout = parseInt(document.getElementById('config-query-timeout')?.value || '30');
            break;
        case 'data-table':
            config.columns = document.getElementById('config-columns')?.value || 'timestamp,severity,message';
            config.limit = parseInt(document.getElementById('config-limit')?.value || '20');
            break;
    }
    
    widget.config = config;
    
    // Update widget display
    const widgetElement = document.querySelector(`[data-widget-id="${currentlyConfiguringWidgetId}"]`);
    if (widgetElement) {
        // Update widget name in header
        const nameHeader = widgetElement.querySelector('h4');
        if (nameHeader) {
            const widgetNames = {
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
            const displayName = (config.name && config.name.trim()) 
                ? config.name.trim() 
                : (widgetNames[widget.type] || widget.type);
            nameHeader.textContent = displayName;
        }
        
        const contentDiv = widgetElement.querySelector('.widget-content');
        if (contentDiv) {
            contentDiv.innerHTML = renderWidgetContent(widget);
            // Re-initialize any charts or dynamic content
            initializeWidgetContent(widget);
        }
    }
    
    closeWidgetConfig();
}

function initializeWidgetContent(widget) {
    // Initialize charts, load data, etc. based on widget type
    switch (widget.type) {
        case 'stat-card':
            loadStatCardData(widget);
            break;
        case 'chart-severity':
        case 'chart-protocol':
        case 'chart-event-type':
            initializeChart(widget);
            break;
        case 'top-n':
            loadTopNData(widget);
            break;
        case 'query-builder':
            setupQueryBuilder(widget);
            break;
    }
}

function loadStatCardData(widget) {
    // Load stat card data in builder mode with filters
    const config = widget.config || {};
    const filters = config.filters || {};
    const field = config.field || 'total';
    const container = document.querySelector(`[data-widget-id="${widget.id}"] .widget-content`);
    
    if (!container) return;
    
    const url = buildLogsApiUrl(filters);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Apply custom field filters
            let filteredLogs = filterLogsByCustomFields(logs, filters.custom_fields || []);
            
            // Filter by specific device (hostname) if specified
            if (filters.device) {
                const deviceFilter = filters.device.toLowerCase();
                filteredLogs = filteredLogs.filter(log => {
                    const hostname = (log.hostname || '').toLowerCase();
                    const rawMsg = (log.raw_message || '').toLowerCase();
                    const parsedFields = log.parsed_fields || {};
                    
                    return hostname.includes(deviceFilter) || 
                           rawMsg.includes(deviceFilter) ||
                           (parsedFields.UNIFIhost && String(parsedFields.UNIFIhost).toLowerCase().includes(deviceFilter)) ||
                           (parsedFields.host && String(parsedFields.host).toLowerCase().includes(deviceFilter));
                });
            }
            
            let value = 0;
            switch (field) {
                case 'total':
                    value = filteredLogs.length;
                    break;
                case 'recent':
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    value = filteredLogs.filter(log => new Date(log.timestamp) > oneHourAgo).length;
                    break;
                case 'errors':
                    value = filteredLogs.filter(log => log.severity <= 3).length;
                    break;
                case 'hosts':
                    const uniqueHosts = new Set(filteredLogs.map(log => log.hostname).filter(h => h));
                    value = uniqueHosts.size;
                    break;
                case 'devices':
                    const uniqueDevices = new Set(filteredLogs.map(log => log.device_type).filter(d => d));
                    value = uniqueDevices.size;
                    break;
            }
            
            const label = config.label || field.charAt(0).toUpperCase() + field.slice(1);
            container.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 36px; font-weight: 700; color: var(--accent); margin-bottom: 8px;">${formatNumber(value)}</div>
                    <div style="font-size: 14px; color: var(--text-secondary);">${escapeHtml(label)}</div>
                </div>
            `;
        })
        .catch(err => {
            console.error('Error loading stat card:', err);
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error);">Error loading data</div>';
        });
}

function initializeChart(widget) {
    // Initialize chart in builder mode (same as display mode)
    const config = widget.config || {};
    const chartType = config.chartType || 'pie';
    const timeRange = config.timeRange || '24h';
    const groupBy = config.groupBy || (widget.type === 'chart-severity' ? 'severity' : widget.type === 'chart-protocol' ? 'protocol' : 'event_type');
    const filters = config.filters || {};
    const container = document.querySelector(`[data-widget-id="${widget.id}"] .widget-content`);
    
    if (!container) return;
    
    const canvasId = `chart-${widget.id}-${Date.now()}`;
    container.innerHTML = `<canvas id="${canvasId}" style="max-height: 300px;"></canvas>`;
    
    const url = buildLogsApiUrl(filters, 10000);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Apply custom field filters
            let filteredLogs = filterLogsByCustomFields(logs, filters.custom_fields || []);
            
            // Filter by specific device (hostname) if specified
            if (filters.device) {
                const deviceFilter = filters.device.toLowerCase();
                filteredLogs = filteredLogs.filter(log => {
                    const hostname = (log.hostname || '').toLowerCase();
                    const rawMsg = (log.raw_message || '').toLowerCase();
                    const parsedFields = log.parsed_fields || {};
                    
                    return hostname.includes(deviceFilter) || 
                           rawMsg.includes(deviceFilter) ||
                           (parsedFields.UNIFIhost && String(parsedFields.UNIFIhost).toLowerCase().includes(deviceFilter)) ||
                           (parsedFields.host && String(parsedFields.host).toLowerCase().includes(deviceFilter));
                });
            }
            
            let data = {};
            
            if (groupBy === 'severity') {
                const severityNames = ['Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notice', 'Informational', 'Debug'];
                filteredLogs.forEach(log => {
                    const severity = severityNames[log.severity] || 'Unknown';
                    data[severity] = (data[severity] || 0) + 1;
                });
            } else if (groupBy === 'protocol') {
                // Extract actual protocol from parsed_fields
                filteredLogs.forEach(log => {
                    const parsedFields = log.parsed_fields || {};
                    let protocol = 'Unknown';
                    
                    if (parsedFields.protocol) {
                        protocol = String(parsedFields.protocol).toUpperCase();
                    } else if (log.version) {
                        protocol = 'RFC5424';
                    } else {
                        protocol = 'RFC3164';
                    }
                    
                    data[protocol] = (data[protocol] || 0) + 1;
                });
            } else if (groupBy === 'event_type') {
                filteredLogs.forEach(log => {
                    const eventType = log.event_type || 'unknown';
                    data[eventType] = (data[eventType] || 0) + 1;
                });
            } else if (groupBy === 'device_type') {
                filteredLogs.forEach(log => {
                    const deviceType = log.device_type || 'unknown';
                    data[deviceType] = (data[deviceType] || 0) + 1;
                });
            } else if (groupBy === 'hostname' || groupBy === 'device') {
                filteredLogs.forEach(log => {
                    let deviceName = log.hostname || 'unknown';
                    const parsedFields = log.parsed_fields || {};
                    
                    if (parsedFields.UNIFIhost) {
                        deviceName = String(parsedFields.UNIFIhost);
                    } else if (parsedFields.host) {
                        deviceName = String(parsedFields.host);
                    } else if (parsedFields.device_model) {
                        deviceName = String(parsedFields.device_model);
                    }
                    
                    data[deviceName] = (data[deviceName] || 0) + 1;
                });
            }
            
            const labels = Object.keys(data);
            const values = Object.values(data);
            const colors = generateChartColors(labels.length);
            
            const ctx = document.getElementById(canvasId);
            if (ctx && labels.length > 0) {
                new Chart(ctx, {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: colors,
                            borderColor: colors.map(c => c.replace('0.8', '1')),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#e4e7eb',
                                    font: { size: 12 }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            } else if (ctx) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">No data available</div>';
            }
        })
        .catch(err => {
            console.error('Error loading chart:', err);
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error);">Error loading chart</div>';
        });
}

// Data loading functions for view display
function loadStatCardDataForDisplay(widget) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const field = config.field || 'total';
    const container = document.getElementById(`viewDisplayWidget_${widget.id}`);
    
    if (!container) return;
    
    const url = buildLogsApiUrl(filters);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Apply custom field filters
            let filteredLogs = filterLogsByCustomFields(logs, filters.custom_fields || []);
            
            // Filter by specific device (hostname) if specified
            if (filters.device) {
                const deviceFilter = filters.device.toLowerCase();
                filteredLogs = filteredLogs.filter(log => {
                    const hostname = (log.hostname || '').toLowerCase();
                    const rawMsg = (log.raw_message || '').toLowerCase();
                    const parsedFields = log.parsed_fields || {};
                    
                    // Check hostname, raw message, and parsed fields (e.g., UNIFIhost for Ubiquiti)
                    return hostname.includes(deviceFilter) || 
                           rawMsg.includes(deviceFilter) ||
                           (parsedFields.UNIFIhost && String(parsedFields.UNIFIhost).toLowerCase().includes(deviceFilter)) ||
                           (parsedFields.host && String(parsedFields.host).toLowerCase().includes(deviceFilter));
                });
            }
            
            let value = 0;
            switch (field) {
                case 'total':
                    value = filteredLogs.length;
                    break;
                case 'recent':
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    value = filteredLogs.filter(log => new Date(log.timestamp) > oneHourAgo).length;
                    break;
                case 'errors':
                    value = filteredLogs.filter(log => log.severity <= 3).length;
                    break;
                case 'hosts':
                    const uniqueHosts = new Set(filteredLogs.map(log => log.hostname).filter(h => h));
                    value = uniqueHosts.size;
                    break;
                case 'devices':
                    const uniqueDevices = new Set(filteredLogs.map(log => log.device_type).filter(d => d));
                    value = uniqueDevices.size;
                    break;
            }
            
            const label = config.label || field.charAt(0).toUpperCase() + field.slice(1);
            container.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 36px; font-weight: 700; color: var(--accent); margin-bottom: 8px;">${formatNumber(value)}</div>
                    <div style="font-size: 14px; color: var(--text-secondary);">${label}</div>
                </div>
            `;
        })
        .catch(err => {
            console.error('Error loading stat card:', err);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error loading data</div>`;
        });
}

function initializeChartForDisplay(widget) {
    const config = widget.config || {};
    const chartType = config.chartType || 'pie';
    const timeRange = config.timeRange || '24h';
    const groupBy = config.groupBy || (widget.type === 'chart-severity' ? 'severity' : widget.type === 'chart-protocol' ? 'protocol' : 'event_type');
    const filters = config.filters || {};
    const container = document.getElementById(`viewDisplayWidget_${widget.id}`);
    
    if (!container) return;
    
    const canvasId = `chart-${widget.id}-${Date.now()}`;
    container.innerHTML = `<canvas id="${canvasId}" style="max-height: 300px;"></canvas>`;
    
    const url = buildLogsApiUrl(filters, 10000);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Apply custom field filters
            let filteredLogs = filterLogsByCustomFields(logs, filters.custom_fields || []);
            
            // Filter by specific device (hostname) if specified
            if (filters.device) {
                const deviceFilter = filters.device.toLowerCase();
                filteredLogs = filteredLogs.filter(log => {
                    const hostname = (log.hostname || '').toLowerCase();
                    const rawMsg = (log.raw_message || '').toLowerCase();
                    const parsedFields = log.parsed_fields || {};
                    
                    // Check hostname, raw message, and parsed fields (e.g., UNIFIhost for Ubiquiti)
                    return hostname.includes(deviceFilter) || 
                           rawMsg.includes(deviceFilter) ||
                           (parsedFields.UNIFIhost && String(parsedFields.UNIFIhost).toLowerCase().includes(deviceFilter)) ||
                           (parsedFields.host && String(parsedFields.host).toLowerCase().includes(deviceFilter));
                });
            }
            
            let data = {};
            
            if (groupBy === 'severity') {
                const severityNames = ['Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notice', 'Informational', 'Debug'];
                filteredLogs.forEach(log => {
                    const severity = severityNames[log.severity] || 'Unknown';
                    data[severity] = (data[severity] || 0) + 1;
                });
            } else if (groupBy === 'protocol') {
                // Extract actual protocol from parsed_fields
                filteredLogs.forEach(log => {
                    const parsedFields = log.parsed_fields || {};
                    let protocol = 'Unknown';
                    
                    if (parsedFields.protocol) {
                        protocol = String(parsedFields.protocol).toUpperCase();
                    } else if (log.version) {
                        protocol = 'RFC5424';
                    } else {
                        protocol = 'RFC3164';
                    }
                    
                    data[protocol] = (data[protocol] || 0) + 1;
                });
            } else if (groupBy === 'event_type') {
                filteredLogs.forEach(log => {
                    const eventType = log.event_type || 'unknown';
                    data[eventType] = (data[eventType] || 0) + 1;
                });
            } else if (groupBy === 'device_type') {
                filteredLogs.forEach(log => {
                    const deviceType = log.device_type || 'unknown';
                    data[deviceType] = (data[deviceType] || 0) + 1;
                });
            } else if (groupBy === 'hostname' || groupBy === 'device') {
                // Group by device/hostname
                filteredLogs.forEach(log => {
                    // Try to get device name from various sources
                    let deviceName = log.hostname || 'unknown';
                    const parsedFields = log.parsed_fields || {};
                    
                    // For Ubiquiti, check UNIFIhost
                    if (parsedFields.UNIFIhost) {
                        deviceName = String(parsedFields.UNIFIhost);
                    } else if (parsedFields.host) {
                        deviceName = String(parsedFields.host);
                    } else if (parsedFields.device_model) {
                        deviceName = String(parsedFields.device_model);
                    }
                    
                    data[deviceName] = (data[deviceName] || 0) + 1;
                });
            }
            
            const labels = Object.keys(data);
            const values = Object.values(data);
            const colors = generateChartColors(labels.length);
            
            const ctx = document.getElementById(canvasId);
            if (ctx) {
                new Chart(ctx, {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: colors,
                            borderColor: colors.map(c => c.replace('0.8', '1')),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#e4e7eb',
                                    font: { size: 12 }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        })
        .catch(err => {
            console.error('Error loading chart:', err);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error loading chart</div>`;
        });
}

function loadTopNDataForDisplay(widget) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const field = config.field || 'event_type';
    const limit = config.limit || 10;
    const timeRange = config.timeRange || filters.timeRange || '24h';
    const container = document.getElementById(`viewDisplayWidget_${widget.id}`);
    
    if (!container) return;
    
    const url = buildLogsApiUrl({...filters, timeRange}, 10000);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Apply custom field filters
            let filteredLogs = filterLogsByCustomFields(logs, filters.custom_fields || []);
            
            // Filter by specific device (hostname) if specified
            if (filters.device) {
                const deviceFilter = filters.device.toLowerCase();
                filteredLogs = filteredLogs.filter(log => {
                    const hostname = (log.hostname || '').toLowerCase();
                    const rawMsg = (log.raw_message || '').toLowerCase();
                    const parsedFields = log.parsed_fields || {};
                    
                    return hostname.includes(deviceFilter) || 
                           rawMsg.includes(deviceFilter) ||
                           (parsedFields.UNIFIhost && String(parsedFields.UNIFIhost).toLowerCase().includes(deviceFilter)) ||
                           (parsedFields.host && String(parsedFields.host).toLowerCase().includes(deviceFilter));
                });
            }
            
            const counts = {};
            filteredLogs.forEach(log => {
                let value = 'unknown';
                
                // Check if field is in parsed_fields (for fields like src, dst, protocol, UNIFIhost, UNIFIcategory, etc.)
                if (log.parsed_fields && log.parsed_fields[field]) {
                    value = String(log.parsed_fields[field]);
                } else if (log[field]) {
                    value = String(log[field]);
                } else if (field === 'hostname' || field === 'device') {
                    // For device/hostname, check multiple sources
                    const parsedFields = log.parsed_fields || {};
                    if (parsedFields.UNIFIhost) {
                        value = String(parsedFields.UNIFIhost);
                    } else if (parsedFields.host) {
                        value = String(parsedFields.host);
                    } else if (log.hostname) {
                        value = log.hostname;
                    }
                } else if (field === 'source_ip' || field === 'src') {
                    // Extract source IP from various sources
                    const parsedFields = log.parsed_fields || {};
                    if (parsedFields.source_ip) {
                        value = String(parsedFields.source_ip);
                    } else if (parsedFields.src) {
                        const src = String(parsedFields.src);
                        value = src.includes(':') ? src.split(':')[0] : src;
                    } else if (parsedFields.UNIFIclientIp) {
                        value = String(parsedFields.UNIFIclientIp);
                    }
                } else if (field === 'dest_ip' || field === 'dst') {
                    // Extract destination IP
                    const parsedFields = log.parsed_fields || {};
                    if (parsedFields.dest_ip) {
                        value = String(parsedFields.dest_ip);
                    } else if (parsedFields.dst) {
                        const dst = String(parsedFields.dst);
                        value = dst.includes(':') ? dst.split(':')[0] : dst;
                    }
                } else if (field === 'protocol') {
                    const parsedFields = log.parsed_fields || {};
                    value = parsedFields.protocol ? String(parsedFields.protocol) : 'unknown';
                } else if (field === 'action') {
                    // For Meraki flows/firewall - extract allow/deny
                    const parsedFields = log.parsed_fields || {};
                    if (parsedFields.action) {
                        value = String(parsedFields.action);
                    } else {
                        const rawMsg = (log.raw_message || '').toLowerCase();
                        if (rawMsg.includes(' allow ')) value = 'allow';
                        else if (rawMsg.includes(' deny ') || rawMsg.includes(' blocked ')) value = 'deny';
                        else value = 'unknown';
                    }
                } else if (field === 'event_category') {
                    // Extract event category
                    value = log.event_category || 'unknown';
                }
                
                // Skip empty values
                if (value && value !== 'unknown' && value !== '-') {
                    counts[value] = (counts[value] || 0) + 1;
                }
            });
            
            const sorted = Object.entries(counts)
                .filter(([value]) => value && value !== 'unknown' && value !== '-')
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit);
            
            if (sorted.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No data found</div>';
            } else {
                const maxCount = Math.max(...sorted.map(([, count]) => count));
                container.innerHTML = `
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${sorted.map(([value, count], index) => {
                            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border);">
                                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                                    <span style="color: var(--text-tertiary); font-size: 12px; font-weight: 600; min-width: 24px; flex-shrink: 0;">#${index + 1}</span>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="color: var(--text-primary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(value)}">${escapeHtml(value)}</div>
                                        <div style="width: 100%; height: 4px; background: var(--bg-secondary); border-radius: 2px; margin-top: 4px; overflow: hidden;">
                                            <div style="width: ${percentage}%; height: 100%; background: var(--accent); transition: width 0.3s;"></div>
                                        </div>
                                    </div>
                                </div>
                                <span style="color: var(--accent); font-weight: 600; font-size: 14px; margin-left: 12px; flex-shrink: 0;">${formatNumber(count)}</span>
                            </div>
                        `;
                        }).join('')}
                    </div>
                `;
            }
        })
        .catch(err => {
            console.error('Error loading top N:', err);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error loading data</div>`;
        });
}

function loadDeviceStatsForDisplay(widget) {
    const container = document.getElementById(`viewDisplayWidget_${widget.id}`);
    if (!container) return;
    
    apiFetch(`${API_BASE}/api/stats`)
        .then(res => res.json())
        .then(stats => {
            const deviceStats = stats.device_types || {};
            const devices = Object.entries(deviceStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            if (devices.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No device data</div>';
            } else {
                container.innerHTML = `
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${devices.map(([device, count]) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border);">
                                <span style="color: var(--text-primary); font-size: 13px; text-transform: capitalize;">${escapeHtml(device)}</span>
                                <span style="color: var(--accent); font-weight: 600; font-size: 14px;">${formatNumber(count)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        })
        .catch(err => {
            console.error('Error loading device stats:', err);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error loading device stats</div>`;
        });
}

// Helper functions for time-based grouping
function getTimeInterval(timeRange) {
    // Return interval in minutes
    switch (timeRange) {
        case '1h': return 5;   // 5-minute intervals for 1 hour
        case '24h': return 60;  // 1-hour intervals for 24 hours
        case '7d': return 360;  // 6-hour intervals for 7 days
        case '30d': return 1440; // 1-day intervals for 30 days
        default: return 60;
    }
}

function getTimeKey(time, intervalMinutes) {
    const date = new Date(time);
    
    if (intervalMinutes >= 1440) {
        // Daily intervals
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (intervalMinutes >= 360) {
        // 6-hour intervals
        const hour = Math.floor(date.getHours() / 6) * 6;
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hour}:00`;
    } else if (intervalMinutes >= 60) {
        // Hourly intervals
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
        // Minute intervals
        const minutes = Math.floor(date.getMinutes() / intervalMinutes) * intervalMinutes;
        return `${date.getHours()}:${minutes.toString().padStart(2, '0')}`;
    }
}

function generateChartColors(count) {
    const colors = [
        'rgba(99, 102, 241, 0.8)',   // indigo
        'rgba(239, 68, 68, 0.8)',    // red
        'rgba(16, 185, 129, 0.8)',   // green
        'rgba(245, 158, 11, 0.8)',   // amber
        'rgba(59, 130, 246, 0.8)',   // blue
        'rgba(139, 92, 246, 0.8)',   // purple
        'rgba(236, 72, 153, 0.8)',   // pink
        'rgba(34, 197, 94, 0.8)',    // emerald
    ];
    return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
}

function loadTopNData(widget) {
    const config = widget.config || {};
    const field = config.field || 'event_type';
    const limit = config.limit || 10;
    const timeRange = config.timeRange || '24h';
    
    apiFetch(`${API_BASE}/api/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            field: field,
            operation: 'count',
            groupBy: field,
            timeRange: timeRange,
            topN: limit
        })
    })
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById(`top-n-${widget.id}`);
            if (container) {
                if (!data.results || data.results.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">No data found</div>';
                } else {
                    container.innerHTML = data.results.map((item, idx) => `
                        <div style="padding: 8px; border-bottom: 1px solid #2d3441; display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #e4e7eb; font-size: 12px;">${idx + 1}. ${item.group_value || 'N/A'}</span>
                            <span style="color: #6366f1; font-weight: 600; font-size: 12px;">${item.count || 0}</span>
                        </div>
                    `).join('');
                }
            }
        })
        .catch(err => console.error('Error loading top N data:', err));
}

function saveView() {
    if (isReadOnlyMode) {
        alert('This view is in read-only mode. Use Edit to modify it.');
        return;
    }
    
    const nameInput = document.getElementById('viewNameInput');
    
    if (!nameInput || !nameInput.value.trim()) {
        alert('Please enter a view name');
        return;
    }
    
    if (currentViewWidgets.length === 0) {
        alert('Please add at least one widget to the view');
        return;
    }
    
    const view = {
        id: currentEditingViewId || `view_${Date.now()}`,
        name: nameInput.value.trim(),
        description: '',
        widgets: currentViewWidgets
    };
    
    // Determine if this is a new view or an update
    const isUpdate = currentEditingViewId !== null;
    const url = isUpdate ? `${API_BASE}/api/views/${currentEditingViewId}` : `${API_BASE}/api/views`;
    const method = isUpdate ? 'PUT' : 'POST';
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(view)
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`Failed to ${isUpdate ? 'update' : 'create'} view: ${res.statusText}`);
        }
        return res.json();
    })
    .then(data => {
        closeViewBuilder();
        fetchViews();
    })
    .catch(err => {
        console.error('Error saving view:', err);
        alert('Error saving view: ' + err.message);
    });
}

// Load data table widget
function loadDataTableForDisplay(widget) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const limit = config.limit || 20;
    const columns = (config.columns || 'timestamp,severity,message').split(',').map(c => c.trim());
    // Try display mode container first, then builder mode
    let container = document.getElementById(`viewDisplayWidget_${widget.id}`);
    if (!container) {
        container = document.querySelector(`[data-widget-id="${widget.id}"] .widget-content`);
    }
    
    if (!container) return;
    
    const url = buildLogsApiUrl(filters, limit);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Apply custom field filters
            let filteredLogs = filterLogsByCustomFields(logs, filters.custom_fields || []);
            
            // Filter by specific device (hostname) if specified
            if (filters.device) {
                const deviceFilter = filters.device.toLowerCase();
                filteredLogs = filteredLogs.filter(log => {
                    const hostname = (log.hostname || '').toLowerCase();
                    const rawMsg = (log.raw_message || '').toLowerCase();
                    const parsedFields = log.parsed_fields || {};
                    
                    return hostname.includes(deviceFilter) || 
                           rawMsg.includes(deviceFilter) ||
                           (parsedFields.UNIFIhost && String(parsedFields.UNIFIhost).toLowerCase().includes(deviceFilter)) ||
                           (parsedFields.host && String(parsedFields.host).toLowerCase().includes(deviceFilter));
                });
            }
            
            if (filteredLogs.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No logs found</div>';
            } else {
                const tableRows = filteredLogs.slice(0, limit).map(log => {
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
                        return `<td style="padding: 8px; border-bottom: 1px solid var(--border); color: var(--text-primary);">${escapeHtml(String(value))}</td>`;
                    }).join('');
                    return `<tr style="cursor: pointer;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" onclick="if(typeof showLogDetail === 'function') showLogDetail(${log.id})">${cells}</tr>`;
                }).join('');
                
                container.innerHTML = `
                    <div style="overflow-x: auto; max-height: 500px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10;">
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
            }
        })
        .catch(err => {
            console.error('Error loading data table:', err);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error loading data</div>`;
        });
}

// Initialize event timeline widget (for display mode)
function initializeEventTimelineForDisplay(widget) {
    const config = widget.config || {};
    const filters = config.filters || {};
    const timeRange = config.timeRange || '24h';
    const container = document.getElementById(`viewDisplayWidget_${widget.id}`);
    
    if (!container) return;
    
    const url = buildLogsApiUrl(filters, 1000);
    
    fetch(url)
        .then(res => res.json())
        .then(logs => {
            // Apply custom field filters
            let filteredLogs = filterLogsByCustomFields(logs, filters.custom_fields || []);
            
            // Filter by specific device (hostname) if specified
            if (filters.device) {
                const deviceFilter = filters.device.toLowerCase();
                filteredLogs = filteredLogs.filter(log => {
                    const hostname = (log.hostname || '').toLowerCase();
                    const rawMsg = (log.raw_message || '').toLowerCase();
                    const parsedFields = log.parsed_fields || {};
                    
                    return hostname.includes(deviceFilter) || 
                           rawMsg.includes(deviceFilter) ||
                           (parsedFields.UNIFIhost && String(parsedFields.UNIFIhost).toLowerCase().includes(deviceFilter)) ||
                           (parsedFields.host && String(parsedFields.host).toLowerCase().includes(deviceFilter));
                });
            }
            
            // Group by time intervals
            const interval = getTimeInterval(timeRange);
            const data = {};
            
            filteredLogs.forEach(log => {
                const time = new Date(log.timestamp);
                const timeKey = getTimeKey(time, interval);
                
                if (!data[timeKey]) {
                    data[timeKey] = 0;
                }
                data[timeKey]++;
            });
            
            const labels = Object.keys(data).sort();
            const values = labels.map(label => data[label]);
            
            const canvasId = `event-timeline-${widget.id}-${Date.now()}`;
            container.innerHTML = `<canvas id="${canvasId}" style="max-height: 300px;"></canvas>`;
            
            const ctx = document.getElementById(canvasId);
            if (ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Events',
                            data: values,
                            borderColor: 'rgba(99, 102, 241, 0.8)',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: '#2d3441' } },
                            x: { ticks: { color: '#9ca3af' }, grid: { color: '#2d3441' } }
                        }
                    }
                });
            }
        })
        .catch(err => {
            console.error('Error loading event timeline:', err);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error loading timeline</div>`;
        });
}
