// Enhanced Filter Management
let filters = {
    severity: null,
    device: '',
    device_type: '',
    event_type: '',
    date_range: '24h',
    date_from: '',
    date_to: '',
    search: ''
};
let filterDebounceTimer;
let devicesCache = [];
let moduleMetadataCache = {};
let eventTypesByModule = {};

// Initialize filters with enhanced UI
function initFilters() {
    // Ensure filters-grid displays horizontally
    const filtersGrid = document.querySelector('.filters-grid');
    if (filtersGrid) {
        filtersGrid.style.display = 'flex';
        filtersGrid.style.flexDirection = 'row';
        filtersGrid.style.flexWrap = 'wrap';
        filtersGrid.style.gap = '16px';
        filtersGrid.style.alignItems = 'flex-end';
    }
    
    loadDevices();
    loadModuleMetadata();
    
    const severityFilter = document.getElementById('severityFilter');
    const deviceFilter = document.getElementById('deviceFilter');
    const deviceTypeFilter = document.getElementById('deviceTypeFilter');
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const dateRangeFilter = document.getElementById('dateRangeFilter');
    const dateFromInput = document.getElementById('dateFromInput');
    const dateToInput = document.getElementById('dateToInput');
    const searchFilter = document.getElementById('searchFilter');
    
    // Enhanced severity dropdown
    if (severityFilter) {
        enhanceDropdown(severityFilter, { placeholder: 'All Severities' });
        severityFilter.addEventListener('change', () => {
            filters.severity = severityFilter.value || null;
            currentPage = 0;
            updateURL();
            if (currentView === 'logs') {
                fetchLogs();
            }
        });
    }
    
    // Device autocomplete
    if (deviceFilter) {
        initDeviceAutocomplete(deviceFilter);
    }
    
    // Device type dropdown with module icons
    if (deviceTypeFilter) {
        enhanceDropdown(deviceTypeFilter);
        deviceTypeFilter.addEventListener('change', async () => {
            filters.device_type = deviceTypeFilter.value || '';
            filters.event_type = ''; // Reset event type when device type changes
            currentPage = 0;
            
            // Load event types for selected device type
            await loadEventTypesForDeviceType(filters.device_type);
            updateURL();
            if (currentView === 'logs') {
                fetchLogs();
            }
        });
    }
    
    // Event type dropdown (dynamically populated)
    if (eventTypeFilter) {
        enhanceDropdown(eventTypeFilter, { searchable: true, placeholder: 'All Event Types' });
        eventTypeFilter.addEventListener('change', () => {
            filters.event_type = eventTypeFilter.value || '';
            currentPage = 0;
            updateURL();
            if (currentView === 'logs') {
                fetchLogs();
            }
        });
        
        // Load event types on initial load
        loadAllEventTypes();
    }
    
    // Date range selector
    let calendarPicker = null;
    if (dateRangeFilter) {
        enhanceDropdown(dateRangeFilter, { placeholder: 'Select Date Range' });
        dateRangeFilter.addEventListener('change', () => {
            const value = dateRangeFilter.value;
            if (value === 'custom') {
                // Initialize calendar picker (will show as popup)
                initCalendarPicker();
            } else {
                filters.date_range = value;
                filters.date_from = '';
                filters.date_to = '';
                // Hide calendar if open
                const calendarContainer = document.getElementById('calendarPickerContainer');
                if (calendarContainer) {
                    calendarContainer.style.display = 'none';
                }
                currentPage = 0;
                updateURL();
                if (currentView === 'logs') {
                    fetchLogs();
                }
            }
        });
    }
    
    // Initialize calendar picker
    function initCalendarPicker() {
        const calendarContainer = document.getElementById('calendarPickerContainer');
        const dateRangeFilter = document.getElementById('dateRangeFilter');
        const dateFromInput = document.getElementById('dateFromInput');
        const dateToInput = document.getElementById('dateToInput');
        
        if (!calendarContainer) return;
        
        // Position calendar as fixed overlay (like other dropdowns)
        const positionCalendar = () => {
            const filterGroup = dateRangeFilter?.closest('.filter-group');
            if (filterGroup) {
                const rect = filterGroup.getBoundingClientRect();
                // Position calendar below the filter, centered
                const calendarWidth = 400; // Approximate calendar width
                const left = rect.left + (rect.width / 2) - (calendarWidth / 2);
                const top = rect.bottom + 8;
                
                calendarContainer.style.position = 'fixed';
                calendarContainer.style.left = `${Math.max(16, Math.min(left, window.innerWidth - calendarWidth - 16))}px`;
                calendarContainer.style.top = `${top}px`;
                calendarContainer.style.zIndex = '99998';
            }
        };
        
        // Update position when calendar is shown
        if (dateRangeFilter?.value === 'custom') {
            positionCalendar();
            // Reposition on window resize
            window.addEventListener('resize', positionCalendar);
        }
        
        // Create calendar if it doesn't exist
        if (!calendarPicker) {
            calendarPicker = new CalendarPicker(calendarContainer, {
                mode: 'range',
                showTime: true,
                initialStartDate: filters.date_from ? new Date(filters.date_from) : null,
                initialEndDate: filters.date_to ? new Date(filters.date_to) : null,
                onSelect: (dates) => {
                    // Update hidden inputs
                    if (dateFromInput) {
                        dateFromInput.value = dates.startDateString || '';
                    }
                    if (dateToInput) {
                        dateToInput.value = dates.endDateString || '';
                    }
                    
                    // Update filters
                    filters.date_from = dates.startDateString || '';
                    filters.date_to = dates.endDateString || '';
                    filters.date_range = 'custom';
                    
                    // Hide calendar after selection
                    calendarContainer.style.display = 'none';
                    
                    // Apply filters
                    currentPage = 0;
                    updateURL();
                    if (currentView === 'logs') {
                        fetchLogs();
                    }
                }
            });
        } else {
            // Update existing calendar with current filter values
            if (filters.date_from && filters.date_to) {
                calendarPicker.setDates(filters.date_from, filters.date_to);
            } else {
                // Clear dates if no custom range is set
                calendarPicker.clear();
            }
            // Re-render calendar to show updated dates
            calendarPicker.render();
        }
        
        // Always show calendar when custom is selected
        positionCalendar();
        calendarContainer.style.display = 'block';
        
        // Close calendar on outside click
        const closeCalendar = (e) => {
            if (!calendarContainer.contains(e.target) && 
                !dateRangeFilter.contains(e.target) &&
                calendarContainer.style.display === 'block') {
                calendarContainer.style.display = 'none';
            }
        };
        
        // Remove old listener if exists
        document.removeEventListener('click', closeCalendar);
        // Add new listener
        setTimeout(() => {
            document.addEventListener('click', closeCalendar);
        }, 0);
    }
    
    // Update calendar trigger button text (kept for compatibility but not used in new design)
    function updateCalendarTriggerText(startDate, endDate) {
        // This function is kept for compatibility but the trigger button is no longer used
        // The calendar now appears directly as a popup when "custom" is selected
    }
    
    // Enhanced search with fuzzy matching
    if (searchFilter) {
        searchFilter.addEventListener('input', debounce(() => {
            filters.search = searchFilter.value || '';
            currentPage = 0;
            updateURL();
            if (currentView === 'logs') {
                fetchLogs();
            }
        }, 300));
    }
    
    // Apply/Clear filter buttons
    const applyFiltersBtn = document.getElementById('applyFilters');
    const clearFiltersBtn = document.getElementById('clearFilters');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyFilters();
        });
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            clearFilters();
        });
    }
}

// Enhance dropdown with better styling and search
function enhanceDropdown(selectElement, options = {}) {
    if (!selectElement) return;
    
    // Check if custom dropdown already exists
    if (selectElement.customDropdown) {
        return; // Already enhanced, don't create duplicate
    }
    
    // Add custom styling class
    selectElement.classList.add('enhanced-select');
    
    // Initialize custom dropdown if available
    if (typeof CustomDropdown !== 'undefined') {
        const dropdown = new CustomDropdown(selectElement, {
            searchable: options.searchable || false,
            placeholder: options.placeholder || 'Select...',
            onSelect: options.onSelect || null
        });
        selectElement.customDropdown = dropdown;
    }
}

// Load devices for autocomplete
async function loadDevices() {
    try {
        const response = await apiFetch(`${API_BASE}/api/devices`);
        if (response.ok) {
            devicesCache = await response.json();
        }
    } catch (err) {
        console.error('Error loading devices:', err);
    }
}

// Initialize device autocomplete
function initDeviceAutocomplete(inputElement) {
    if (!inputElement) return;
    
    let suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'autocomplete-suggestions';
    suggestionsContainer.id = 'deviceSuggestions';
    inputElement.parentElement.appendChild(suggestionsContainer);
    
    let selectedIndex = -1;
    let suggestions = [];
    
    inputElement.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length === 0) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        
        // Fuzzy search devices
        suggestions = fuzzySearchDevices(query, devicesCache);
        selectedIndex = -1;
        
        if (suggestions.length === 0) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        
        renderSuggestions(suggestions, suggestionsContainer, inputElement);
    });
    
    inputElement.addEventListener('keydown', (e) => {
        if (suggestionsContainer.style.display === 'none') return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            highlightSuggestion(selectedIndex, suggestionsContainer);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            highlightSuggestion(selectedIndex, suggestionsContainer);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedIndex], inputElement, suggestionsContainer);
        } else if (e.key === 'Escape') {
            suggestionsContainer.style.display = 'none';
        }
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!inputElement.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

// Fuzzy search devices
function fuzzySearchDevices(query, devices) {
    if (!devices || devices.length === 0) return [];
    
    const results = devices.map(device => {
        const name = (device.name || '').toLowerCase();
        const ip = (device.ip_address || '').toLowerCase();
        const hostname = (device.hostname || '').toLowerCase();
        
        const nameScore = fuzzyMatch(query, name);
        const ipScore = fuzzyMatch(query, ip);
        const hostnameScore = fuzzyMatch(query, hostname);
        
        const maxScore = Math.max(nameScore, ipScore, hostnameScore);
        
        return {
            device: device,
            score: maxScore,
            matchField: maxScore === nameScore ? 'name' : (maxScore === ipScore ? 'ip' : 'hostname')
        };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(result => result.device);
    
    return results;
}

// Fuzzy match algorithm
function fuzzyMatch(pattern, text) {
    if (!pattern || !text) return 0;
    
    pattern = pattern.toLowerCase();
    text = text.toLowerCase();
    
    // Exact match
    if (text === pattern) return 100;
    
    // Starts with
    if (text.startsWith(pattern)) return 90;
    
    // Contains
    if (text.includes(pattern)) return 70;
    
    // Fuzzy character matching
    let patternIdx = 0;
    let matches = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    
    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
        if (text[i] === pattern[patternIdx]) {
            matches++;
            consecutiveMatches++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
            patternIdx++;
        } else {
            consecutiveMatches = 0;
        }
    }
    
    if (patternIdx < pattern.length) return 0; // Not all characters matched
    
    // Score based on matches and consecutive matches
    const matchRatio = matches / pattern.length;
    const consecutiveBonus = maxConsecutive / pattern.length;
    
    return Math.round(50 * matchRatio + 20 * consecutiveBonus);
}

// Render autocomplete suggestions
function renderSuggestions(suggestions, container, inputElement) {
    container.innerHTML = '';
    container.style.display = 'block';
    
    suggestions.forEach((device, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-suggestion';
        item.dataset.index = index;
        
        const name = device.name || 'Unnamed Device';
        const ip = device.ip_address || '';
        const deviceType = device.device_type || 'generic';
        
        item.innerHTML = `
            <div class="suggestion-content">
                <div class="suggestion-name">
                    <i class="fas fa-server" style="margin-right: 8px; color: var(--accent);"></i>
                    ${escapeHtml(name)}
                </div>
                <div class="suggestion-details">
                    <span class="suggestion-ip">${escapeHtml(ip)}</span>
                    <span class="suggestion-type">${escapeHtml(deviceType)}</span>
                </div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            selectSuggestion(device, inputElement, container);
        });
        
        item.addEventListener('mouseenter', () => {
            highlightSuggestion(index, container);
        });
        
        container.appendChild(item);
    });
}

// Highlight suggestion
function highlightSuggestion(index, container) {
    const items = container.querySelectorAll('.autocomplete-suggestion');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// Select suggestion
function selectSuggestion(device, inputElement, container) {
    const displayName = device.name || device.ip_address || '';
    inputElement.value = displayName;
    filters.device = displayName;
    container.style.display = 'none';
    
    currentPage = 0;
    updateURL();
    if (currentView === 'logs') {
        fetchLogs();
    }
}

// Load module metadata
async function loadModuleMetadata() {
    try {
        const response = await apiFetch(`${API_BASE}/api/module-metadata`);
        if (response.ok) {
            const data = await response.json();
            // API returns an object with device types as keys, but ensure it's an object
            if (Array.isArray(data)) {
                // Convert array to object if needed
                moduleMetadataCache = {};
                data.forEach(item => {
                    const deviceType = item.device_type || item.DeviceType;
                    if (deviceType) {
                        moduleMetadataCache[deviceType] = item;
                    }
                });
            } else if (typeof data === 'object' && data !== null) {
                moduleMetadataCache = data;
            } else {
                moduleMetadataCache = {};
            }
        }
    } catch (err) {
        console.error('Error loading module metadata:', err);
        moduleMetadataCache = {};
    }
}

// Populate device types dynamically
async function populateDeviceTypes() {
    const deviceTypeFilter = document.getElementById('deviceTypeFilter');
    if (!deviceTypeFilter) return;
    
    try {
        const response = await apiFetch(`${API_BASE}/api/device-types`);
        if (response.ok) {
            const deviceTypes = await response.json();
            
            // Clear existing options (except "All Device Types")
            deviceTypeFilter.innerHTML = '<option value="">All Device Types</option>';
            
            deviceTypes.forEach(deviceType => {
                const option = document.createElement('option');
                option.value = deviceType.id;
                option.textContent = deviceType.name;
                if (deviceType.description) {
                    option.title = deviceType.description;
                }
                deviceTypeFilter.appendChild(option);
            });
            
            // Restore selected value if it exists
            if (filters.device_type) {
                deviceTypeFilter.value = filters.device_type;
            }
        }
    } catch (err) {
        console.error('Error loading device types:', err);
    }
}

// Load all event types from all modules
async function loadAllEventTypes() {
    try {
        // Wait for module metadata to be loaded
        if (Object.keys(moduleMetadataCache).length === 0) {
            await loadModuleMetadata();
        }
        
        // Aggregate all event types from all modules, preserving device type info
        const allEventTypes = [];
        
        for (const deviceType in moduleMetadataCache) {
            // Skip if deviceType is not a string (e.g., array indices)
            if (typeof deviceType !== 'string') continue;
            
            const metadata = moduleMetadataCache[deviceType];
            if (!metadata || typeof metadata !== 'object') continue;
            
            // Check both EventTypes (Go struct) and event_types (JSON)
            const eventTypes = metadata?.EventTypes || metadata?.event_types || [];
            if (Array.isArray(eventTypes) && eventTypes.length > 0) {
                eventTypes.forEach(eventType => {
                    // Ensure eventType is an object, not a string or other type
                    if (typeof eventType !== 'object' || eventType === null || Array.isArray(eventType)) {
                        console.warn('Invalid event type structure (expected object, got):', typeof eventType, eventType);
                        return;
                    }
                    
                    // Add device type info to event type
                    allEventTypes.push({
                        ...eventType,
                        DeviceType: deviceType,
                        DeviceTypeName: metadata.DeviceName || metadata.device_name || deviceType
                    });
                });
            }
        }
        
        populateEventTypeFilter(allEventTypes, true); // true = show all modules
    } catch (err) {
        console.error('Error loading all event types:', err);
        populateEventTypeFilter([]);
    }
}

// Load event types for a specific device type
async function loadEventTypesForDeviceType(deviceType) {
    if (!deviceType || deviceType === '') {
        // Show all event types from all modules
        await loadAllEventTypes();
        return;
    }
    
    // Check cache first
    if (eventTypesByModule[deviceType]) {
        populateEventTypeFilter(eventTypesByModule[deviceType]);
        return;
    }
    
    try {
        // Ensure module metadata is loaded
        if (Object.keys(moduleMetadataCache).length === 0) {
            await loadModuleMetadata();
        }
        
        const metadata = moduleMetadataCache[deviceType];
        // Check both EventTypes (Go struct) and event_types (JSON)
        const eventTypes = metadata?.EventTypes || metadata?.event_types || [];
        if (Array.isArray(eventTypes) && eventTypes.length > 0) {
            eventTypesByModule[deviceType] = eventTypes;
            populateEventTypeFilter(eventTypes);
        } else {
            // Fetch from API if not in cache
            const response = await apiFetch(`${API_BASE}/api/module-metadata?device_type=${encodeURIComponent(deviceType)}`);
            if (response.ok) {
                const metadata = await response.json();
                // Check both EventTypes (Go struct) and event_types (JSON)
                const fetchedEventTypes = metadata?.EventTypes || metadata?.event_types || [];
                if (Array.isArray(fetchedEventTypes) && fetchedEventTypes.length > 0) {
                    moduleMetadataCache[deviceType] = metadata;
                    eventTypesByModule[deviceType] = fetchedEventTypes;
                    populateEventTypeFilter(fetchedEventTypes);
                } else {
                    // If no event types found, show all
                    await loadAllEventTypes();
                }
            } else {
                // If API call fails, show all
                await loadAllEventTypes();
            }
        }
    } catch (err) {
        console.error('Error loading event types:', err);
        // On error, show all event types
        await loadAllEventTypes();
    }
}

// Populate event type filter dropdown
function populateEventTypeFilter(eventTypes, showAllModules = false) {
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    if (!eventTypeFilter) return;
    
    // Clear existing options (except "All Event Types")
    eventTypeFilter.innerHTML = '<option value="">All Event Types</option>';
    
    if (!eventTypes || eventTypes.length === 0) {
        return;
    }
    
    if (showAllModules) {
        // Group by device type first, then by category
        const byDeviceType = {};
        eventTypes.forEach(eventType => {
            // Ensure eventType is an object, not a string
            if (typeof eventType !== 'object' || eventType === null || Array.isArray(eventType)) {
                console.warn('Skipping invalid event type in populateEventTypeFilter:', eventType);
                return;
            }
            
            const deviceType = eventType.DeviceType || 'generic';
            const deviceTypeName = eventType.DeviceTypeName || deviceType;
            if (!byDeviceType[deviceType]) {
                byDeviceType[deviceType] = {
                    name: deviceTypeName,
                    categories: {}
                };
            }
            
            const category = eventType.Category || eventType.category || 'Other';
            if (!byDeviceType[deviceType].categories[category]) {
                byDeviceType[deviceType].categories[category] = [];
            }
            byDeviceType[deviceType].categories[category].push(eventType);
        });
        
        // Add optgroups for each device type
        Object.keys(byDeviceType).sort().forEach(deviceType => {
            const deviceTypeData = byDeviceType[deviceType];
            
            // Create main device type optgroup
            const deviceTypeOptgroup = document.createElement('optgroup');
            deviceTypeOptgroup.label = `━━━ ${deviceTypeData.name} ━━━`;
            deviceTypeOptgroup.className = 'device-type-optgroup';
            
            // Add categories within this device type (only if they have event types)
            Object.keys(deviceTypeData.categories).sort().forEach(category => {
                // Skip empty categories
                if (!deviceTypeData.categories[category] || deviceTypeData.categories[category].length === 0) {
                    return;
                }
                
                // Add category label as disabled option
                const categoryOption = document.createElement('option');
                categoryOption.disabled = true;
                categoryOption.textContent = `  ${category}`;
                categoryOption.text = categoryOption.textContent; // Ensure text property is set
                categoryOption.className = 'category-label';
                deviceTypeOptgroup.appendChild(categoryOption);
                
                // Add event types in this category
                deviceTypeData.categories[category].forEach(eventType => {
                    const option = document.createElement('option');
                    option.value = eventType.ID || eventType.id || '';
                    const name = eventType.Name || eventType.name || '';
                    const description = eventType.Description || eventType.description || '';
                    option.textContent = `${name}${description ? ` - ${description}` : ''}`;
                    option.text = option.textContent; // Ensure text property is set for custom dropdown
                    deviceTypeOptgroup.appendChild(option);
                });
            });
            
            eventTypeFilter.appendChild(deviceTypeOptgroup);
            
            // Debug: Log optgroup structure
            const optgroupOptions = deviceTypeOptgroup.querySelectorAll('option');
            console.log(`Optgroup "${deviceTypeData.name}" has ${optgroupOptions.length} options`);
        });
        
        // Debug: Log total structure
        const allOptgroups = eventTypeFilter.querySelectorAll('optgroup');
        console.log(`Total optgroups: ${allOptgroups.length}`);
        allOptgroups.forEach((og, idx) => {
            const opts = og.querySelectorAll('option');
            console.log(`  Optgroup ${idx} (${og.label}): ${opts.length} options`);
        });
    } else {
        // Single device type: group by category only
        const byCategory = {};
        eventTypes.forEach(eventType => {
            // Ensure eventType is an object, not a string
            if (typeof eventType !== 'object' || eventType === null || Array.isArray(eventType)) {
                console.warn('Skipping invalid event type in populateEventTypeFilter:', eventType);
                return;
            }
            
            const category = eventType.Category || eventType.category || 'Other';
            if (!byCategory[category]) {
                byCategory[category] = [];
            }
            byCategory[category].push(eventType);
        });
        
        // Add optgroups for each category (only if they have event types)
        Object.keys(byCategory).sort().forEach(category => {
            // Skip empty categories
            if (!byCategory[category] || byCategory[category].length === 0) {
                return;
            }
            
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            
            byCategory[category].forEach(eventType => {
                const option = document.createElement('option');
                option.value = eventType.ID || eventType.id || '';
                const name = eventType.Name || eventType.name || '';
                const description = eventType.Description || eventType.description || '';
                option.textContent = `${name}${description ? ` - ${description}` : ''}`;
                option.text = option.textContent; // Ensure text property is set for custom dropdown
                optgroup.appendChild(option);
            });
            
            eventTypeFilter.appendChild(optgroup);
        });
    }
    
    // Restore selected value if it exists
    if (filters.event_type) {
        eventTypeFilter.value = filters.event_type;
    }
    
    // Refresh custom dropdown if it exists
    if (eventTypeFilter.customDropdown) {
        // Use setTimeout to ensure DOM is fully updated
        setTimeout(() => {
            try {
                // Clear the options list first
                if (eventTypeFilter.customDropdown.optionsList) {
                    eventTypeFilter.customDropdown.optionsList.innerHTML = '';
                }
                
                // Repopulate options from the select element
                eventTypeFilter.customDropdown.populateOptions();
                
                // Update selected text
                const selectedOption = eventTypeFilter.options[eventTypeFilter.selectedIndex];
                if (selectedOption) {
                    eventTypeFilter.customDropdown.selectedText = selectedOption.text || selectedOption.textContent;
                    eventTypeFilter.customDropdown.selectedValue = selectedOption.value;
                    const textSpan = eventTypeFilter.customDropdown.button.querySelector('.custom-dropdown-text');
                    if (textSpan) {
                        textSpan.textContent = selectedOption.text || selectedOption.textContent || 'All Event Types';
                    }
                } else {
                    const textSpan = eventTypeFilter.customDropdown.button.querySelector('.custom-dropdown-text');
                    if (textSpan) {
                        textSpan.textContent = 'All Event Types';
                    }
                }
            } catch (err) {
                console.error('Error repopulating event type dropdown:', err);
                console.error('Select element:', eventTypeFilter);
                console.error('Optgroups:', eventTypeFilter.querySelectorAll('optgroup'));
                console.error('Options:', eventTypeFilter.options);
            }
        }, 0);
    }
}

// Apply filters
function applyFilters() {
    // Update filters from UI
    const severityFilter = document.getElementById('severityFilter');
    const deviceFilter = document.getElementById('deviceFilter');
    const deviceTypeFilter = document.getElementById('deviceTypeFilter');
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const dateRangeFilter = document.getElementById('dateRangeFilter');
    const dateFromInput = document.getElementById('dateFromInput');
    const dateToInput = document.getElementById('dateToInput');
    const searchFilter = document.getElementById('searchFilter');
    
    if (severityFilter) filters.severity = severityFilter.value || null;
    if (deviceFilter) filters.device = deviceFilter.value || '';
    if (deviceTypeFilter) filters.device_type = deviceTypeFilter.value || '';
    if (eventTypeFilter) filters.event_type = eventTypeFilter.value || '';
    if (dateRangeFilter) {
        if (dateRangeFilter.value === 'custom') {
            filters.date_range = 'custom';
            if (dateFromInput) filters.date_from = dateFromInput.value || '';
            if (dateToInput) filters.date_to = dateToInput.value || '';
        } else {
            filters.date_range = dateRangeFilter.value || '24h';
            filters.date_from = '';
            filters.date_to = '';
        }
    }
    if (searchFilter) filters.search = searchFilter.value || '';
    
    currentPage = 0;
    updateURL();
    if (currentView === 'logs') {
        fetchLogs();
    }
}

// Clear filters
function clearFilters() {
    filters = {
        severity: null,
        device: '',
        device_type: '',
        event_type: '',
        date_range: '24h',
        date_from: '',
        date_to: '',
        search: ''
    };
    
    updateFilterUI();
    currentPage = 0;
    updateURL();
    if (currentView === 'logs') {
        fetchLogs();
    }
}

// Update filter UI from filter state
function updateFilterUI() {
    const severityFilter = document.getElementById('severityFilter');
    const deviceFilter = document.getElementById('deviceFilter');
    const deviceTypeFilter = document.getElementById('deviceTypeFilter');
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const dateRangeFilter = document.getElementById('dateRangeFilter');
    const dateFromInput = document.getElementById('dateFromInput');
    const dateToInput = document.getElementById('dateToInput');
    const searchFilter = document.getElementById('searchFilter');
    const customDateContainer = document.getElementById('customDateContainer');
    
    if (severityFilter) severityFilter.value = filters.severity || '';
    if (deviceFilter) deviceFilter.value = filters.device || '';
    if (deviceTypeFilter) {
        deviceTypeFilter.value = filters.device_type || '';
        // Load event types for selected device type
        if (filters.device_type) {
            loadEventTypesForDeviceType(filters.device_type);
        } else {
            // If no device type selected, load all event types
            loadAllEventTypes();
        }
    } else {
        // If device type filter doesn't exist, still load all event types
        loadAllEventTypes();
    }
    if (eventTypeFilter) eventTypeFilter.value = filters.event_type || '';
    if (dateRangeFilter) {
        if (filters.date_from && filters.date_to) {
            dateRangeFilter.value = 'custom';
            // Initialize calendar if not already done
            if (typeof CalendarPicker !== 'undefined') {
                initCalendarPicker();
                // Update calendar with current dates
                if (calendarPicker && filters.date_from && filters.date_to) {
                    calendarPicker.setDates(filters.date_from, filters.date_to);
                }
            }
        } else {
            dateRangeFilter.value = filters.date_range || '24h';
            const calendarContainer = document.getElementById('calendarPickerContainer');
            if (calendarContainer) {
                calendarContainer.style.display = 'none';
            }
        }
    }
    if (dateFromInput) dateFromInput.value = filters.date_from || '';
    if (dateToInput) dateToInput.value = filters.date_to || '';
    if (searchFilter) searchFilter.value = filters.search || '';
}

// Debounce function
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(filterDebounceTimer);
            func(...args);
        };
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = setTimeout(later, wait);
    };
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load - handled by app.js
// Removed auto-initialization to prevent duplicates

