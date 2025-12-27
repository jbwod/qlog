// Advanced Global Search Functionality
// Provides a comprehensive search across all entities with a modal interface

let searchCache = {
    devices: [],
    listeners: [],
    views: [],
    modules: [],
    eventTypes: [],
    lastUpdated: null
};

let searchDebounceTimer = null;
let selectedResultIndex = -1;
let currentSearchResults = [];

// Initialize advanced search
function initAdvancedSearch() {
    console.log('initAdvancedSearch called');
    
    const globalSearchTrigger = document.getElementById('globalSearchTrigger');
    const globalSearch = document.getElementById('globalSearch');
    const advancedSearchModal = document.getElementById('advancedSearchModal');
    const advancedSearchInput = document.getElementById('advancedSearchInput');
    const advancedSearchClose = document.getElementById('advancedSearchClose');
    const advancedSearchBackdrop = document.querySelector('.advanced-search-backdrop');
    
    console.log('Elements found:', {
        globalSearchTrigger: !!globalSearchTrigger,
        globalSearch: !!globalSearch,
        advancedSearchModal: !!advancedSearchModal,
        advancedSearchInput: !!advancedSearchInput,
        advancedSearchClose: !!advancedSearchClose,
        advancedSearchBackdrop: !!advancedSearchBackdrop
    });
    
    if (!advancedSearchModal) {
        console.error('Advanced search modal not found - cannot initialize');
        return;
    }
    
    if (!globalSearchTrigger && !globalSearch) {
        console.error('Neither globalSearchTrigger nor globalSearch found - cannot initialize');
        return;
    }
    
    console.log('Initializing advanced search event listeners...');
    
    // Open modal when clicking on search box
    // Use a single handler on the container to catch all clicks
    const handleSearchClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Global search clicked', e.target);
        openAdvancedSearch();
    };
    
    if (globalSearchTrigger) {
        // Add click handler to the container
        globalSearchTrigger.addEventListener('click', handleSearchClick, true);
        globalSearchTrigger.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAdvancedSearch();
        }, true);
        
        // Make sure the container is clickable
        globalSearchTrigger.style.cursor = 'pointer';
    }
    
    if (globalSearch) {
        // Add click handler to the input
        globalSearch.addEventListener('click', handleSearchClick, true);
        globalSearch.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAdvancedSearch();
        }, true);
        
        // Also handle focus event (in case readonly doesn't prevent it)
        globalSearch.addEventListener('focus', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAdvancedSearch();
        }, true);
        
        // Make sure the input is clickable
        globalSearch.style.cursor = 'pointer';
    }
    
    // Close modal
    if (advancedSearchClose) {
        advancedSearchClose.addEventListener('click', closeAdvancedSearch);
    }
    
    if (advancedSearchBackdrop) {
        advancedSearchBackdrop.addEventListener('click', closeAdvancedSearch);
    }
    
    // Track shift key presses for double-shift detection
    let lastShiftPress = 0;
    let shiftPressCount = 0;
    let shiftTimeout = null;
    
    // Keyboard shortcuts - use a separate handler function for better control
    const handleKeyDown = (e) => {
        // Double Shift to open search
        // Check specifically for Shift key (not just shiftKey modifier)
        const isShiftKey = (e.key === 'Shift' || e.keyCode === 16) && 
                          !e.ctrlKey && !e.altKey && !e.metaKey;
        
        if (isShiftKey) {
            const now = Date.now();
            const timeSinceLastPress = now - lastShiftPress;
            
            // Clear any existing timeout
            if (shiftTimeout) {
                clearTimeout(shiftTimeout);
                shiftTimeout = null;
            }
            
            // If pressed within 500ms of last press, it's a double press
            if (timeSinceLastPress > 0 && timeSinceLastPress < 500) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                shiftPressCount = 0;
                lastShiftPress = 0;
                
                console.log('Double Shift detected - opening search');
                // Open search modal
                if (advancedSearchModal) {
                    const isHidden = advancedSearchModal.style.display === 'none' || 
                                    advancedSearchModal.style.display === '';
                    if (isHidden) {
                        openAdvancedSearch();
                    }
                }
                return false;
            }
            
            // Record this press
            lastShiftPress = now;
            shiftPressCount = 1;
            
            // Reset after 500ms if no second press
            shiftTimeout = setTimeout(() => {
                shiftPressCount = 0;
                lastShiftPress = 0;
            }, 500);
        } else if (e.key && e.key !== 'Shift' && !e.shiftKey) {
            // Any other key (that's not Shift) resets the shift counter
            // But only if shiftKey is not pressed (to avoid resetting during normal typing)
            if (shiftTimeout) {
                clearTimeout(shiftTimeout);
                shiftTimeout = null;
            }
            // Don't reset immediately - allow for quick double-shift
            setTimeout(() => {
                if (Date.now() - lastShiftPress > 500) {
                    shiftPressCount = 0;
                    lastShiftPress = 0;
                }
            }, 100);
        }
        
        // Cmd/Ctrl + K to open search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = advancedSearchModal.style.display === 'none' || 
                            advancedSearchModal.style.display === '';
            if (isHidden) {
                openAdvancedSearch();
            } else {
                closeAdvancedSearch();
            }
        }
        
        // ESC to close
        if (e.key === 'Escape') {
            const isVisible = advancedSearchModal.style.display !== 'none' && 
                             advancedSearchModal.style.display !== '';
            if (isVisible) {
                e.preventDefault();
                e.stopPropagation();
                closeAdvancedSearch();
            }
        }
        
        // Handle navigation when modal is open
        const isVisible = advancedSearchModal.style.display !== 'none' && 
                         advancedSearchModal.style.display !== '';
        if (isVisible) {
            const results = document.querySelectorAll('.advanced-search-result-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedResultIndex = Math.min(selectedResultIndex + 1, results.length - 1);
                updateSelectedResult(results);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
                updateSelectedResult(results);
            } else if (e.key === 'Enter' && selectedResultIndex >= 0) {
                e.preventDefault();
                const selectedResult = results[selectedResultIndex];
                if (selectedResult) {
                    selectedResult.click();
                }
            } else if (e.key === 'Tab' && results.length > 0) {
                // Tab to cycle through results
                e.preventDefault();
                if (e.shiftKey) {
                    selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
                } else {
                    selectedResultIndex = Math.min(selectedResultIndex + 1, results.length - 1);
                }
                updateSelectedResult(results);
            }
        }
    };
    
    // Add event listener with capture phase for better reliability
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Real-time search as user types
    if (advancedSearchInput) {
        advancedSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                performSearch(query);
            } else {
                showEmptyState();
            }
        });
        
        // Focus input when modal opens
        advancedSearchInput.addEventListener('focus', () => {
            if (advancedSearchInput.value.trim().length > 0) {
                performSearch(advancedSearchInput.value.trim());
            }
        });
    }
    
    // Preload search data
    preloadSearchData();
}

function openAdvancedSearch() {
    const modal = document.getElementById('advancedSearchModal');
    const input = document.getElementById('advancedSearchInput');
    
    if (!modal) {
        console.error('Advanced search modal not found');
        return;
    }
    
    if (!input) {
        console.error('Advanced search input not found');
        return;
    }
    
    console.log('Opening advanced search modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Clear any existing search
    input.value = '';
    selectedResultIndex = -1;
    if (typeof showEmptyState === 'function') {
        showEmptyState();
    }
    
    // Focus input after animation
    setTimeout(() => {
        input.focus();
    }, 100);
    
    // Preload data if needed
    preloadSearchData();
}

function closeAdvancedSearch() {
    const modal = document.getElementById('advancedSearchModal');
    const input = document.getElementById('advancedSearchInput');
    
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    if (input) {
        input.value = '';
    }
    
    selectedResultIndex = -1;
    currentSearchResults = [];
    showEmptyState();
}

async function preloadSearchData() {
    // Only preload if cache is older than 5 minutes
    const now = Date.now();
    if (searchCache.lastUpdated && (now - searchCache.lastUpdated) < 300000) {
        return;
    }
    
    try {
        // Fetch all data in parallel
        const [devicesRes, listenersRes, viewsRes, modulesRes] = await Promise.all([
            apiFetch(`${API_BASE}/api/devices`).catch(() => null),
            apiFetch(`${API_BASE}/api/listeners`).catch(() => null),
            apiFetch(`${API_BASE}/api/views`).catch(() => null),
            apiFetch(`${API_BASE}/api/modules`).catch(() => null)
        ]);
        
        if (devicesRes && devicesRes.ok) {
            searchCache.devices = await devicesRes.json();
        }
        
        if (listenersRes && listenersRes.ok) {
            searchCache.listeners = await listenersRes.json();
        }
        
        if (viewsRes && viewsRes.ok) {
            searchCache.views = await viewsRes.json();
        }
        
        if (modulesRes && modulesRes.ok) {
            const modulesData = await modulesRes.json();
            searchCache.modules = modulesData || [];
            
            // Extract event types from modules
            searchCache.eventTypes = [];
            if (Array.isArray(modulesData)) {
                modulesData.forEach(module => {
                    if (module.EventTypes && Array.isArray(module.EventTypes)) {
                        module.EventTypes.forEach(eventType => {
                            searchCache.eventTypes.push({
                                ...eventType,
                                moduleName: module.Name || module.name || 'Unknown',
                                deviceType: module.DeviceType || module.device_type || 'unknown'
                            });
                        });
                    }
                });
            }
        }
        
        searchCache.lastUpdated = now;
    } catch (error) {
        console.error('Error preloading search data:', error);
    }
}

function performSearch(query) {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    searchDebounceTimer = setTimeout(() => {
        const results = searchEverything(query);
        displaySearchResults(results, query);
    }, 150); // Fast response time
}

function searchEverything(query) {
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
    const results = {
        logs: [],
        devices: [],
        listeners: [],
        views: [],
        eventTypes: [],
        modules: []
    };
    
    // Helper function for fuzzy matching
    const fuzzyMatch = (text, query) => {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        // Exact match
        if (lowerText.includes(lowerQuery)) return true;
        // Word-by-word match
        if (queryWords.length > 1) {
            return queryWords.every(word => lowerText.includes(word));
        }
        // Character sequence match (fuzzy)
        let textIndex = 0;
        for (let i = 0; i < lowerQuery.length; i++) {
            const char = lowerQuery[i];
            textIndex = lowerText.indexOf(char, textIndex);
            if (textIndex === -1) return false;
            textIndex++;
        }
        return true;
    };
    
    // Search devices with enhanced matching
    if (searchCache.devices && Array.isArray(searchCache.devices)) {
        searchCache.devices.forEach(device => {
            const name = device.name || '';
            const ip = device.ip || '';
            const deviceType = device.device_type || '';
            const description = device.description || '';
            const listenerId = device.listener_id || device.listenerID || '';
            
            const matches = 
                fuzzyMatch(name, lowerQuery) ||
                fuzzyMatch(ip, lowerQuery) ||
                fuzzyMatch(deviceType, lowerQuery) ||
                fuzzyMatch(description, lowerQuery) ||
                fuzzyMatch(listenerId, lowerQuery);
            
            if (matches) {
                // Calculate relevance score (exact matches score higher)
                let score = 0;
                if (name.toLowerCase().includes(lowerQuery)) score += 10;
                if (ip.toLowerCase().includes(lowerQuery)) score += 8;
                if (deviceType.toLowerCase().includes(lowerQuery)) score += 6;
                if (description.toLowerCase().includes(lowerQuery)) score += 4;
                
                results.devices.push({
                    type: 'device',
                    id: device.id || device.ID,
                    title: name || 'Unnamed Device',
                    subtitle: `${ip || 'No IP'} • ${deviceType || 'Unknown Type'}${listenerId ? ` • Listener: ${listenerId}` : ''}`,
                    icon: 'fas fa-server',
                    score: score,
                    action: () => {
                        showView('devices');
                        setTimeout(() => {
                            const deviceCard = document.querySelector(`[data-device-id="${device.id || device.ID}"]`);
                            if (deviceCard) {
                                deviceCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                deviceCard.style.animation = 'pulse 0.5s ease-in-out';
                            }
                        }, 100);
                    }
                });
            }
        });
        
        // Sort by relevance
        results.devices.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    
    // Search listeners with enhanced matching
    if (searchCache.listeners && Array.isArray(searchCache.listeners)) {
        searchCache.listeners.forEach(listener => {
            const name = listener.name || '';
            const protocol = listener.protocol || '';
            const port = listener.port ? listener.port.toString() : '';
            const host = listener.host || '';
            const framing = listener.framing || '';
            
            const matches = 
                fuzzyMatch(name, lowerQuery) ||
                fuzzyMatch(protocol, lowerQuery) ||
                port.includes(query) ||
                fuzzyMatch(host, lowerQuery) ||
                fuzzyMatch(framing, lowerQuery);
            
            if (matches) {
                let score = 0;
                if (name.toLowerCase().includes(lowerQuery)) score += 10;
                if (port.includes(query)) score += 8;
                if (protocol.toLowerCase().includes(lowerQuery)) score += 6;
                
                results.listeners.push({
                    type: 'listener',
                    id: listener.id || listener.ID,
                    title: name || 'Unnamed Listener',
                    subtitle: `${protocol.toUpperCase() || 'Unknown'} • Port ${port || 'N/A'}${host ? ` • ${host}` : ''}${framing ? ` • ${framing}` : ''}`,
                    icon: 'fas fa-network-wired',
                    score: score,
                    action: () => {
                        showView('listeners');
                        setTimeout(() => {
                            const listenerCard = document.querySelector(`[data-listener-id="${listener.id || listener.ID}"]`);
                            if (listenerCard) {
                                listenerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                listenerCard.style.animation = 'pulse 0.5s ease-in-out';
                            }
                        }, 100);
                    }
                });
            }
        });
        
        results.listeners.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    
    // Search views
    if (searchCache.views && Array.isArray(searchCache.views)) {
        searchCache.views.forEach(view => {
            const matches = 
                (view.name && view.name.toLowerCase().includes(lowerQuery)) ||
                (view.description && view.description.toLowerCase().includes(lowerQuery));
            
            if (matches) {
                results.views.push({
                    type: 'view',
                    id: view.id || view.ID,
                    title: view.name || 'Unnamed View',
                    subtitle: view.description || 'No description',
                    icon: 'fas fa-th-large',
                    action: () => {
                        if (typeof openView === 'function') {
                            openView(view.id || view.ID);
                        } else {
                            showView('views');
                        }
                    }
                });
            }
        });
    }
    
    // Search event types
    if (searchCache.eventTypes && Array.isArray(searchCache.eventTypes)) {
        searchCache.eventTypes.forEach(eventType => {
            const name = eventType.Name || eventType.name || '';
            const description = eventType.Description || eventType.description || '';
            const category = eventType.Category || eventType.category || '';
            
            const matches = 
                name.toLowerCase().includes(lowerQuery) ||
                description.toLowerCase().includes(lowerQuery) ||
                category.toLowerCase().includes(lowerQuery) ||
                (eventType.moduleName && eventType.moduleName.toLowerCase().includes(lowerQuery));
            
            if (matches) {
                results.eventTypes.push({
                    type: 'eventType',
                    id: eventType.ID || eventType.id || '',
                    title: name || 'Unknown Event Type',
                    subtitle: `${category || 'Uncategorized'} • ${eventType.moduleName || 'Unknown Module'}`,
                    icon: 'fas fa-tag',
                    action: () => {
                        showView('logs');
                        setTimeout(() => {
                            // Set event type filter
                            const eventTypeFilter = document.getElementById('eventTypeFilter');
                            if (eventTypeFilter) {
                                eventTypeFilter.value = eventType.ID || eventType.id || '';
                                if (eventTypeFilter.dispatchEvent) {
                                    eventTypeFilter.dispatchEvent(new Event('change'));
                                }
                            }
                        }, 100);
                    }
                });
            }
        });
    }
    
    // Search modules
    if (searchCache.modules && Array.isArray(searchCache.modules)) {
        searchCache.modules.forEach(module => {
            const name = module.Name || module.name || '';
            const deviceType = module.DeviceType || module.device_type || '';
            
            const matches = 
                name.toLowerCase().includes(lowerQuery) ||
                deviceType.toLowerCase().includes(lowerQuery);
            
            if (matches) {
                results.modules.push({
                    type: 'module',
                    id: deviceType,
                    title: name || 'Unknown Module',
                    subtitle: `Device Type: ${deviceType}`,
                    icon: 'fas fa-puzzle-piece',
                    action: () => {
                        showView('modules');
                    }
                });
            }
        });
    }
    
    // Search logs - provide quick actions
    if (query.length > 0) {
        // Check if query looks like an IP address
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        const isIP = ipPattern.test(query);
        
        // Check if query looks like a severity level
        const severityLevels = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'informational', 'debug'];
        const isSeverity = severityLevels.some(sev => sev.toLowerCase().includes(lowerQuery));
        
        results.logs.push({
            type: 'log',
            id: 'search-logs',
            title: `Search logs for "${query}"`,
            subtitle: isIP ? 'Filter by IP address' : isSeverity ? 'Filter by severity' : 'View matching log entries',
            icon: 'fas fa-file-alt',
            score: 15,
            action: () => {
                showView('logs');
                setTimeout(() => {
                    const searchFilter = document.getElementById('searchFilter');
                    if (searchFilter) {
                        searchFilter.value = query;
                        if (typeof applyFilters === 'function') {
                            applyFilters();
                        }
                    }
                    
                    // If it's an IP, also set device filter if possible
                    if (isIP) {
                        const deviceFilter = document.getElementById('deviceFilter');
                        if (deviceFilter) {
                            // Try to find device with this IP
                            const device = searchCache.devices?.find(d => (d.ip || '').includes(query));
                            if (device && device.id) {
                                deviceFilter.value = device.id;
                            }
                        }
                    }
                    
                    // If it's a severity, set severity filter
                    if (isSeverity) {
                        const severityFilter = document.getElementById('severityFilter');
                        if (severityFilter) {
                            const matchedSeverity = severityLevels.find(sev => sev.toLowerCase().includes(lowerQuery));
                            if (matchedSeverity) {
                                severityFilter.value = matchedSeverity;
                            }
                        }
                    }
                }, 100);
            }
        });
    }
    
    return results;
}

function displaySearchResults(results, query) {
    const resultsContainer = document.getElementById('advancedSearchResults');
    if (!resultsContainer) return;
    
    selectedResultIndex = -1;
    currentSearchResults = [];
    
    // Flatten and organize results, prioritizing by score
    const allResults = [
        ...results.logs,
        ...results.devices,
        ...results.listeners,
        ...results.views,
        ...results.eventTypes,
        ...results.modules
    ].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    currentSearchResults = allResults;
    
    if (allResults.length === 0) {
        showNoResults(query);
        return;
    }
    
    // Show top results count
    const totalCount = allResults.length;
    
    // Group results by type
    const grouped = {
        logs: results.logs,
        devices: results.devices,
        listeners: results.listeners,
        views: results.views,
        eventTypes: results.eventTypes,
        modules: results.modules
    };
    
    const typeLabels = {
        logs: 'Logs',
        devices: 'Devices',
        listeners: 'Listeners',
        views: 'Views',
        eventTypes: 'Event Types',
        modules: 'Modules'
    };
    
    const typeIcons = {
        logs: 'fas fa-file-alt',
        devices: 'fas fa-server',
        listeners: 'fas fa-network-wired',
        views: 'fas fa-th-large',
        eventTypes: 'fas fa-tag',
        modules: 'fas fa-puzzle-piece'
    };
    
    let html = `<div class="advanced-search-stats" style="padding: 12px 16px; margin-bottom: 16px; background: var(--bg-tertiary); border-radius: 12px; font-size: 13px; color: var(--text-secondary);">
        <i class="fas fa-info-circle" style="margin-right: 8px; color: var(--accent);"></i>
        Found <strong style="color: var(--accent);">${totalCount}</strong> result${totalCount !== 1 ? 's' : ''} for "<strong>${escapeHtml(query)}</strong>"
    </div>`;
    
    Object.keys(grouped).forEach(type => {
        if (grouped[type].length > 0) {
            // Sort by score within each group
            const sortedGroup = [...grouped[type]].sort((a, b) => (b.score || 0) - (a.score || 0));
            
            html += `
                <div class="advanced-search-group">
                    <div class="advanced-search-group-header">
                        <i class="${typeIcons[type]}"></i>
                        <span>${typeLabels[type]}</span>
                        <span class="advanced-search-group-count">${sortedGroup.length}</span>
                    </div>
                    <div class="advanced-search-group-items">
                        ${sortedGroup.map((result, index) => `
                            <div class="advanced-search-result-item" data-index="${index}" data-type="${type}">
                                <div class="advanced-search-result-icon">
                                    <i class="${result.icon}"></i>
                                </div>
                                <div class="advanced-search-result-content">
                                    <div class="advanced-search-result-title">${highlightMatch(result.title, query)}</div>
                                    <div class="advanced-search-result-subtitle">${result.subtitle}</div>
                                </div>
                                <div class="advanced-search-result-action">
                                    <i class="fas fa-arrow-right"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    resultsContainer.innerHTML = html;
    
    // Attach click handlers
    const resultItems = resultsContainer.querySelectorAll('.advanced-search-result-item');
    resultItems.forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            const type = item.dataset.type;
            const result = grouped[type][index];
            if (result && result.action) {
                closeAdvancedSearch();
                result.action();
            }
        });
        
        item.addEventListener('mouseenter', () => {
            selectedResultIndex = Array.from(resultItems).indexOf(item);
            updateSelectedResult(resultItems);
        });
    });
}

function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function updateSelectedResult(results) {
    results.forEach((result, index) => {
        if (index === selectedResultIndex) {
            result.classList.add('selected');
            result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            result.classList.remove('selected');
        }
    });
}

function showEmptyState() {
    const resultsContainer = document.getElementById('advancedSearchResults');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="advanced-search-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <p>Start typing to search across logs, devices, listeners, views, and more...</p>
        </div>
    `;
}

function showNoResults(query) {
    const resultsContainer = document.getElementById('advancedSearchResults');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="advanced-search-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <p>No results found for "<strong>${escapeHtml(query)}</strong>"</p>
            <p class="advanced-search-empty-hint">Try a different search term</p>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally accessible
window.openAdvancedSearch = openAdvancedSearch;
window.closeAdvancedSearch = closeAdvancedSearch;

