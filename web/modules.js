// Modules Management

function initModules() {
    fetchModules();
}

async function fetchModules() {
    try {
        // Fetch enabled status
        const modulesRes = await apiFetch(`${API_BASE}/api/modules`);
        const modulesData = await modulesRes.json();
        const enabledStatus = {};
        if (Array.isArray(modulesData)) {
            modulesData.forEach(m => {
                enabledStatus[m.device_type] = m.enabled;
            });
        } else if (typeof modulesData === 'object') {
            Object.assign(enabledStatus, modulesData);
        }
        
        // Fetch metadata
        const metadataRes = await apiFetch(`${API_BASE}/api/module-metadata`);
        const metadataData = await metadataRes.json();
        
        // Combine data
        const modules = [];
        for (const [deviceType, metadata] of Object.entries(metadataData)) {
            modules.push({
                ...metadata,
                enabled: enabledStatus[deviceType] !== false // Default to true if not specified
            });
        }
        
        renderModules(modules);
    } catch (err) {
        console.error('Error fetching modules:', err);
        const container = document.getElementById('modulesList');
        if (container) {
            container.innerHTML = '<div class="empty-state">Error loading modules</div>';
        }
    }
}

function renderModules(modules) {
    const container = document.getElementById('modulesList');
    if (!container) return;
    
    if (modules.length === 0) {
        container.innerHTML = '<div class="empty-state">No modules available</div>';
        return;
    }
    
    container.innerHTML = modules.map(module => {
        const eventTypesCount = module.event_types ? module.event_types.length : 0;
        const commonFieldsCount = module.common_fields ? module.common_fields.length : 0;
        const imageHtml = module.image_url 
            ? `<img src="${escapeHtml(module.image_url)}" alt="${escapeHtml(module.device_name || module.device_type)}" class="module-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`
            : '';
        const fallbackIcon = `<div class="module-image-fallback" style="display: ${module.image_url ? 'none' : 'flex'};"><i class="fas fa-puzzle-piece"></i></div>`;
        
        return `
        <div class="module-card ${module.enabled ? 'module-enabled' : 'module-disabled'}" style="position: relative; overflow: hidden;">
            <div class="module-card-header">
                <div class="module-image-container">
                    ${imageHtml}
                    ${fallbackIcon}
                </div>
                <div class="module-card-content">
                    <div class="module-card-title-row">
                        <h3 class="module-card-title">
                            ${escapeHtml(module.device_name || module.device_type)}
                        </h3>
                        <label class="switch module-toggle">
                            <input type="checkbox" ${module.enabled ? 'checked' : ''} 
                                   onchange="toggleModule('${module.device_type}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <p class="module-description">
                        ${escapeHtml(module.description || 'No description')}
                    </p>
                    <div class="module-stats">
                        <div class="module-stat">
                            <i class="fas fa-list"></i>
                            <span>${eventTypesCount} Event Types</span>
                        </div>
                        <div class="module-stat">
                            <i class="fas fa-tags"></i>
                            <span>${commonFieldsCount} Common Fields</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="module-card-footer">
                <div class="module-status">
                    <span class="module-status-label">Status:</span>
                    <span class="module-status-badge ${module.enabled ? 'status-enabled' : 'status-disabled'}">
                        <i class="fas ${module.enabled ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        ${module.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function toggleModule(deviceType, enabled) {
    // Get current enabled modules
    apiFetch(`${API_BASE}/api/modules`)
        .then(res => res.json())
        .then(modules => {
            const enabledModules = {};
            modules.forEach(m => {
                enabledModules[m.device_type] = m.enabled;
            });
            enabledModules[deviceType] = enabled;
            
            // Update
            return apiFetch(`${API_BASE}/api/modules`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled_modules: enabledModules })
            });
        })
        .then(res => {
            if (!res.ok) {
                throw new Error('Failed to update module');
            }
            return res.json();
        })
        .then(() => {
            fetchModules();
        })
        .catch(err => {
            console.error('Error toggling module:', err);
            alert('Error updating module: ' + err.message);
            // Refresh to show correct state
            fetchModules();
        });
}

// Make functions globally accessible
window.toggleModule = toggleModule;

