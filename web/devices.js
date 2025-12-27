// Devices Management

let deviceIpAddresses = []; // Track IP addresses for the device being added

function initDevices() {
    // Setup event listeners for devices page
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', () => {
            openAddDeviceModal();
        });
    }
}

function fetchDeviceTypes() {
    apiFetch(`${API_BASE}/api/device-types`)
        .then(res => res.json())
        .then(data => {
            populateDeviceTypeSelect(data || []);
        })
        .catch(err => {
            console.error('Error fetching device types:', err);
        });
}

function populateDeviceTypeSelect(deviceTypes) {
    const select = document.getElementById('deviceType');
    if (!select) {
        console.error('Device type select element not found');
        return;
    }
    
    // Clear existing options except the first placeholder
    select.innerHTML = '<option value="">Select device type...</option>';
    
    // Add device types
    deviceTypes.forEach(deviceType => {
        const option = document.createElement('option');
        option.value = deviceType.id || deviceType.device_type || '';
        option.textContent = deviceType.name || deviceType.id || 'Unknown';
        if (deviceType.description) {
            option.title = deviceType.description;
        }
        select.appendChild(option);
    });
}

function fetchListenersForDevice() {
    apiFetch(`${API_BASE}/api/listeners`)
        .then(res => res.json())
        .then(data => {
            populateListenerSelect(data || []);
        })
        .catch(err => {
            console.error('Error fetching listeners:', err);
        });
}

function populateListenerSelect(listeners) {
    const select = document.getElementById('deviceListener');
    if (!select) {
        console.error('Device listener select element not found');
        return;
    }
    
    // Clear existing options except the first placeholder
    select.innerHTML = '<option value="">Select a listener...</option>';
    
    // Add listeners
    listeners.forEach(listener => {
        const option = document.createElement('option');
        option.value = listener.id || '';
        option.textContent = `${listener.name || 'Unnamed Listener'} (${listener.protocol}:${listener.port})`;
        select.appendChild(option);
    });
}

function fetchDevices() {
    apiFetch(`${API_BASE}/api/devices`)
        .then(res => res.json())
        .then(data => {
            renderDevices(data || []);
        })
        .catch(err => {
            console.error('Error fetching devices:', err);
            const container = document.getElementById('devicesList');
            if (container) {
                container.innerHTML = '<div class="empty-state">Error loading devices</div>';
            }
        });
}

function renderDevices(devices) {
    const container = document.getElementById('devicesList');
    if (!container) return;
    
    if (devices.length === 0) {
        container.innerHTML = '<div class="empty-state">No devices configured. Click "Add Device" to create one.</div>';
        return;
    }
    
    container.innerHTML = devices.map(device => `
        <div class="device-card" data-device-id="${device.id}">
            <div class="device-card-header">
                <div>
                    <h3 class="device-card-title">${device.name || 'Unnamed Device'}</h3>
                    <span class="device-card-status ${device.listener_id ? 'enabled' : 'disabled'}">
                        ${device.listener_id ? 'Bound to Listener' : 'Not Bound'}
                    </span>
                </div>
            </div>
            <div class="device-card-info">
                <div class="device-info-item">
                    <span class="device-info-label">Device Type:</span>
                    <span class="device-info-value">${device.device_type || 'generic'}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Listener ID:</span>
                    <span class="device-info-value">${device.listener_id || 'None'}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">IP Addresses:</span>
                    <span class="device-info-value">${(device.ip_addresses || []).join(', ') || 'None'}</span>
                </div>
                ${device.description ? `
                <div class="device-info-item">
                    <span class="device-info-label">Description:</span>
                    <span class="device-info-value">${device.description}</span>
                </div>
                ` : ''}
            </div>
            <div class="device-card-actions">
                <button class="btn-secondary" onclick="deleteDevice('${device.id}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

function openAddDeviceModal() {
    const modal = document.getElementById('addDeviceModal');
    if (modal) {
        // Reset wizard to step 1
        document.getElementById('deviceStep1').classList.add('active');
        document.getElementById('deviceStep2').classList.remove('active');
        document.getElementById('deviceWizardPrev').style.display = 'none';
        document.getElementById('deviceWizardNext').style.display = 'inline-block';
        document.getElementById('deviceWizardSave').style.display = 'none';
        
        // Clear form
        document.getElementById('deviceName').value = '';
        document.getElementById('deviceType').value = '';
        document.getElementById('deviceListener').value = '';
        document.getElementById('deviceDescription').value = '';
        document.getElementById('deviceIpList').innerHTML = '';
        document.getElementById('deviceIpInput').value = '';
        deviceIpAddresses = [];
        
        // Fetch and populate device types and listeners when opening modal
        fetchDeviceTypes();
        fetchListenersForDevice();
        modal.style.display = 'flex';
    }
}

function deviceWizardNext() {
    // Validate step 1
    const name = document.getElementById('deviceName').value.trim();
    const deviceType = document.getElementById('deviceType').value;
    const listener = document.getElementById('deviceListener').value;
    
    if (!name) {
        alert('Please enter a device name');
        return;
    }
    if (!deviceType) {
        alert('Please select a device type');
        return;
    }
    if (!listener) {
        alert('Please select a listener');
        return;
    }
    
    // Move to step 2
    document.getElementById('deviceStep1').classList.remove('active');
    document.getElementById('deviceStep2').classList.add('active');
    document.getElementById('deviceWizardPrev').style.display = 'inline-block';
    document.getElementById('deviceWizardNext').style.display = 'none';
    document.getElementById('deviceWizardSave').style.display = 'inline-block';
    
    // Initialize IP list display
    updateDeviceIpList();
}

function deviceWizardPrev() {
    // Move back to step 1
    document.getElementById('deviceStep1').classList.add('active');
    document.getElementById('deviceStep2').classList.remove('active');
    document.getElementById('deviceWizardPrev').style.display = 'none';
    document.getElementById('deviceWizardNext').style.display = 'inline-block';
    document.getElementById('deviceWizardSave').style.display = 'none';
}

function addDeviceIp() {
    const input = document.getElementById('deviceIpInput');
    const ip = input.value.trim();
    
    if (!ip) {
        alert('Please enter an IP address');
        return;
    }
    
    // Basic IP validation
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ip)) {
        alert('Please enter a valid IP address');
        return;
    }
    
    // Check if already added
    if (deviceIpAddresses.includes(ip)) {
        alert('This IP address is already added');
        return;
    }
    
    // Add to list
    deviceIpAddresses.push(ip);
    input.value = '';
    updateDeviceIpList();
}

function removeDeviceIp(ip) {
    deviceIpAddresses = deviceIpAddresses.filter(i => i !== ip);
    updateDeviceIpList();
}

function updateDeviceIpList() {
    const container = document.getElementById('deviceIpList');
    if (!container) return;
    
    if (deviceIpAddresses.length === 0) {
        container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 12px;">No IP addresses added yet</div>';
        return;
    }
    
    container.innerHTML = deviceIpAddresses.map(ip => `
        <div class="ip-tag">
            <span>${ip}</span>
            <button type="button" class="ip-remove" onclick="removeDeviceIp('${ip}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function saveDevice() {
    // Validate step 2
    if (deviceIpAddresses.length === 0) {
        alert('Please add at least one IP address');
        return;
    }
    
    // Get form values
    const name = document.getElementById('deviceName').value.trim();
    const deviceType = document.getElementById('deviceType').value;
    const listenerId = document.getElementById('deviceListener').value;
    const description = document.getElementById('deviceDescription').value.trim();
    
    // Create device object
    const device = {
        id: `device_${Date.now()}`,
        name: name,
        device_type: deviceType,
        listener_id: listenerId,
        ip_addresses: deviceIpAddresses,
        description: description || ''
    };
    
    // Send to API
    apiFetch(`${API_BASE}/api/devices`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(device)
    })
    .then(res => res.json())
    .then(data => {
        closeDeviceModal();
        fetchDevices();
    })
    .catch(err => {
        console.error('Error saving device:', err);
        alert('Error saving device: ' + err.message);
    });
}

function deleteDevice(deviceId) {
    if (!confirm('Are you sure you want to delete this device?')) {
        return;
    }
    
    apiFetch(`${API_BASE}/api/devices/${deviceId}`, {
        method: 'DELETE'
    })
    .then(() => {
        fetchDevices();
    })
    .catch(err => {
        console.error('Error deleting device:', err);
        alert('Error deleting device');
    });
}
