// Listeners Management

// Get protocol icon
function getProtocolIcon(protocol) {
    const icons = {
        'UDP': '<i class="fas fa-broadcast-tower"></i>',
        'TCP': '<i class="fas fa-exchange-alt"></i>',
        'TLS': '<i class="fas fa-lock"></i>'
    };
    return icons[protocol] || '<i class="fas fa-network-wired"></i>';
}

// Get protocol color
function getProtocolColor(protocol) {
    const colors = {
        'UDP': '#10b981',
        'TCP': '#3b82f6',
        'TLS': '#8b5cf6'
    };
    return colors[protocol] || '#9ca3af';
}

function initListeners() {
    // Setup event listeners for listeners page
    const addListenerBtn = document.getElementById('addListenerBtn');
    if (addListenerBtn) {
        addListenerBtn.addEventListener('click', () => {
            openAddListenerModal();
        });
    }
    
    // Setup protocol change handler for wizard
    const protocolSelect = document.getElementById('listenerProtocol');
    if (protocolSelect) {
        protocolSelect.addEventListener('change', handleProtocolChange);
        // Trigger once to set initial state
        handleProtocolChange();
    }
}

// Store certificate information
let certificateInfo = {
    cert: null,
    key: null,
    caCert: null
};

function handleCertUpload(input, type) {
    const file = input.files[0];
    if (!file) return;
    
    // Update file name display
    const fileNameId = type === 'cert' ? 'listenerCertFileName' : 
                       type === 'key' ? 'listenerKeyFileName' : 
                       'listenerCaCertFileName';
    const fileNameEl = document.getElementById(fileNameId);
    if (fileNameEl) {
        fileNameEl.textContent = file.name;
    }
    
    // Store file info
    certificateInfo[type === 'cert' ? 'cert' : type === 'key' ? 'key' : 'caCert'] = {
        name: file.name,
        size: file.size,
        type: file.type
    };
    
    // If certificate file, try to validate and get info
    if (type === 'cert') {
        validateAndGetCertInfo(file);
    }
}

async function validateAndGetCertInfo(file) {
    // Upload certificate temporarily to validate
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'cert');
    
    try {
        const uploadRes = await apiFetch(`${API_BASE}/api/certs/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!uploadRes.ok) {
            throw new Error('Failed to upload certificate');
        }
        
        const uploadData = await uploadRes.json();
        
        // Try to validate certificate (key file may not be uploaded yet)
        const validateRes = await apiFetch(`${API_BASE}/api/certs/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cert_file: uploadData.path,
                key_file: certificateInfo.key ? 'temp' : '' // Empty if key not uploaded yet
            })
        });
        
        if (validateRes.ok) {
            const validateData = await validateRes.json();
            // Even if key pair validation fails, we can still show cert info if available
            if (validateData.info) {
                // Show certificate info
                const certInfoEl = document.getElementById('listenerCertInfo');
                const certDetailsEl = document.getElementById('listenerCertDetails');
                if (certInfoEl && certDetailsEl) {
                    certInfoEl.style.display = 'block';
                    const info = validateData.info;
                    // Format dates
                    const notBefore = info.not_before ? new Date(info.not_before).toLocaleDateString() : 'N/A';
                    const notAfter = info.not_after ? new Date(info.not_after).toLocaleDateString() : 'N/A';
                    certDetailsEl.innerHTML = `
                        <div><strong>Subject:</strong> ${info.subject || 'N/A'}</div>
                        <div><strong>Issuer:</strong> ${info.issuer || 'N/A'}</div>
                        <div><strong>Valid From:</strong> ${notBefore}</div>
                        <div><strong>Valid To:</strong> ${notAfter}</div>
                        ${info.serial_number ? `<div><strong>Serial:</strong> ${info.serial_number}</div>` : ''}
                        ${!validateData.valid ? '<div style="color: var(--warning); margin-top: 8px;"><strong>Note:</strong> Key pair validation pending</div>' : ''}
                    `;
                }
                
                // Store certificate info for review
                certificateInfo.certInfo = validateData.info;
            }
        }
    } catch (err) {
        console.error('Error validating certificate:', err);
        // Don't show error, just continue - file is still selected
    }
}

function handleProtocolChange() {
    const protocol = document.getElementById('listenerProtocol')?.value;
    const tlsGroup = document.getElementById('listenerTlsGroup');
    const framingGroup = document.getElementById('listenerFramingGroup');
    
    // Show/hide TLS certificate fields
    if (tlsGroup) {
        if (protocol === 'TLS') {
            tlsGroup.style.display = 'block';
        } else {
            tlsGroup.style.display = 'none';
        }
    }
    
    // Show/hide framing field (for TCP and TLS)
    if (framingGroup) {
        if (protocol === 'TCP' || protocol === 'TLS') {
            framingGroup.style.display = 'block';
        } else {
            framingGroup.style.display = 'none';
        }
    }
}

function fetchListeners() {
    apiFetch(`${API_BASE}/api/listeners`)
        .then(res => res.json())
        .then(data => {
            renderListeners(data || []);
        })
        .catch(err => {
            console.error('Error fetching listeners:', err);
            const container = document.getElementById('listenersList');
            if (container) {
                container.innerHTML = '<div class="empty-state">Error loading listeners</div>';
            }
        });
}

function renderListeners(listeners) {
    const container = document.getElementById('listenersList');
    if (!container) return;
    
    if (listeners.length === 0) {
        container.innerHTML = '<div class="empty-state">No listeners configured. Click "Add Listener" to create one.</div>';
        return;
    }
    
    container.innerHTML = listeners.map(listener => {
        // Get protocol icon
        const protocolIcon = getProtocolIcon(listener.protocol);
        const protocolColor = getProtocolColor(listener.protocol);
        
        return `
        <div class="listener-card ${listener.enabled ? 'listener-enabled' : 'listener-disabled'}">
            <div class="listener-card-header">
                <div class="listener-header-content">
                    <div class="listener-protocol-icon" style="background: ${protocolColor}15; border-color: ${protocolColor}30; color: ${protocolColor};">
                        ${protocolIcon}
                    </div>
                    <div class="listener-header-text">
                        <h3 class="listener-card-title">${escapeHtml(listener.name || 'Unnamed Listener')}</h3>
                        <div class="listener-header-meta">
                            <span class="listener-card-status ${listener.enabled ? 'status-enabled' : 'status-disabled'}">
                                <i class="fas ${listener.enabled ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                ${listener.enabled ? 'Active' : 'Inactive'}
                            </span>
                            <span class="listener-protocol-badge" style="background: ${protocolColor}15; color: ${protocolColor}; border-color: ${protocolColor}30;">
                                ${listener.protocol}
                            </span>
                        </div>
                    </div>
                </div>
                <label class="switch listener-toggle">
                    <input type="checkbox" ${listener.enabled ? 'checked' : ''} 
                           onchange="toggleListener('${listener.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="listener-card-info">
                <div class="listener-info-grid">
                    <div class="listener-info-item">
                        <div class="listener-info-icon">
                            <i class="fas fa-network-wired"></i>
                        </div>
                        <div class="listener-info-content">
                            <span class="listener-info-label">Port</span>
                            <span class="listener-info-value">${listener.port}</span>
                        </div>
                    </div>
                    <div class="listener-info-item">
                        <div class="listener-info-icon">
                            <i class="fas fa-file-code"></i>
                        </div>
                        <div class="listener-info-content">
                            <span class="listener-info-label">RFC Standard</span>
                            <span class="listener-info-value">${listener.parser || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="listener-info-item">
                        <div class="listener-info-icon">
                            <i class="fas fa-layer-group"></i>
                        </div>
                        <div class="listener-info-content">
                            <span class="listener-info-label">Framing</span>
                            <span class="listener-info-value">${listener.framing || 'N/A'}</span>
                        </div>
                    </div>
                    ${listener.protocol === 'TLS' && listener.cert_file ? `
                    <div class="listener-info-item">
                        <div class="listener-info-icon">
                            <i class="fas fa-lock"></i>
                        </div>
                        <div class="listener-info-content">
                            <span class="listener-info-label">TLS Certificate</span>
                            <span class="listener-info-value">Configured</span>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="listener-card-actions">
                <button class="btn-secondary btn-sm" onclick="deleteListener('${listener.id}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function openAddListenerModal() {
    const modal = document.getElementById('addListenerModal');
    if (modal) {
        modal.style.display = 'flex';
        // Setup protocol change handler when modal opens
        setTimeout(() => {
            const protocolSelect = document.getElementById('listenerProtocol');
            if (protocolSelect) {
                // Remove existing listeners to avoid duplicates
                const newSelect = protocolSelect.cloneNode(true);
                protocolSelect.parentNode.replaceChild(newSelect, protocolSelect);
                // Add event listener to new select
                newSelect.addEventListener('change', handleProtocolChange);
                // Trigger once to set initial state
                handleProtocolChange();
            }
        }, 100);
    }
}

function toggleListener(listenerId, enabled) {
    apiFetch(`${API_BASE}/api/listeners/${listenerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
    })
    .then(res => res.json())
    .then(data => {
        fetchListeners();
    })
    .catch(err => {
        console.error('Error toggling listener:', err);
        alert('Error toggling listener');
    });
}

function deleteListener(listenerId) {
    if (!confirm('Are you sure you want to delete this listener?')) {
        return;
    }
    
    apiFetch(`${API_BASE}/api/listeners/${listenerId}`, {
        method: 'DELETE'
    })
    .then(() => {
        fetchListeners();
    })
    .catch(err => {
        console.error('Error deleting listener:', err);
        alert('Error deleting listener');
    });
}

// Listener Wizard Navigation
let currentWizardStep = 1;
const totalWizardSteps = 3;

function listenerWizardNext() {
    if (currentWizardStep < totalWizardSteps) {
        // Validate current step
        if (currentWizardStep === 1) {
            const name = document.getElementById('listenerName')?.value;
            const port = document.getElementById('listenerPort')?.value;
            if (!name || !port) {
                alert('Please fill in all required fields');
                return;
            }
        }
        
        if (currentWizardStep === 2) {
            const protocol = document.getElementById('listenerProtocol')?.value;
            if (!protocol) {
                alert('Please select a protocol');
                return;
            }
            
            // Validate TLS certificates if protocol is TLS
            if (protocol === 'TLS') {
                const certFile = document.getElementById('listenerCertFile')?.files[0];
                const keyFile = document.getElementById('listenerKeyFile')?.files[0];
                if (!certFile || !keyFile) {
                    alert('TLS requires both certificate and private key files');
                    return;
                }
            }
        }
        
        // Hide current step
        const currentPanel = document.querySelector(`.wizard-panel.active`);
        const currentStep = document.querySelector(`.wizard-step[data-step="${currentWizardStep}"]`);
        if (currentPanel) currentPanel.classList.remove('active');
        if (currentStep) currentStep.classList.remove('active');
        
        // Show next step
        currentWizardStep++;
        const nextPanel = document.getElementById(`listenerStep${currentWizardStep}`);
        const nextStep = document.querySelector(`.wizard-step[data-step="${currentWizardStep}"]`);
        if (nextPanel) nextPanel.classList.add('active');
        if (nextStep) nextStep.classList.add('active');
        
        // Populate review summary if moving to step 3
        if (currentWizardStep === 3) {
            updateReviewSummary();
        }
        
        // Update step indicator
        const stepIndicator = document.getElementById('listenerWizardStep');
        if (stepIndicator) stepIndicator.textContent = currentWizardStep;
        
        // Update buttons
        const prevBtn = document.getElementById('listenerWizardPrev');
        const nextBtn = document.getElementById('listenerWizardNext');
        const saveBtn = document.getElementById('listenerWizardSave');
        
        if (prevBtn) prevBtn.style.display = 'inline-flex';
        if (currentWizardStep === totalWizardSteps) {
            if (nextBtn) nextBtn.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'inline-flex';
        } else {
            if (nextBtn) nextBtn.style.display = 'inline-flex';
            if (saveBtn) saveBtn.style.display = 'none';
        }
    }
}

function updateReviewSummary() {
    const name = document.getElementById('listenerName')?.value || '-';
    const port = document.getElementById('listenerPort')?.value || '-';
    const protocol = document.getElementById('listenerProtocol')?.value || '-';
    const parser = document.getElementById('listenerParser')?.value || '-';
    const framing = document.getElementById('listenerFraming')?.value;
    
    document.getElementById('reviewListenerName').textContent = name;
    document.getElementById('reviewListenerPort').textContent = port;
    document.getElementById('reviewListenerProtocol').textContent = protocol;
    document.getElementById('reviewListenerParser').textContent = parser;
    
    // Show/hide framing based on protocol
    const framingItem = document.getElementById('reviewListenerFraming');
    if (framing && (protocol === 'TCP' || protocol === 'TLS')) {
        framingItem.style.display = 'flex';
        document.getElementById('reviewListenerFramingValue').textContent = framing;
    } else {
        framingItem.style.display = 'none';
    }
    
    // Show/hide certificate info for TLS
    if (protocol === 'TLS') {
        const certItem = document.getElementById('reviewListenerCert');
        const keyItem = document.getElementById('reviewListenerKey');
        const caCertItem = document.getElementById('reviewListenerCaCert');
        
        if (certificateInfo.cert) {
            certItem.style.display = 'flex';
            let certText = certificateInfo.cert.name;
            if (certificateInfo.certInfo) {
                const subject = certificateInfo.certInfo.subject || '';
                if (subject) {
                    // Extract CN from subject if available
                    const cnMatch = subject.match(/CN=([^,]+)/);
                    const cn = cnMatch ? cnMatch[1] : subject.split(',')[0];
                    certText += ` (${cn})`;
                }
            }
            document.getElementById('reviewListenerCertValue').textContent = certText;
        } else {
            certItem.style.display = 'none';
        }
        
        if (certificateInfo.key) {
            keyItem.style.display = 'flex';
            document.getElementById('reviewListenerKeyValue').textContent = certificateInfo.key.name;
        } else {
            keyItem.style.display = 'none';
        }
        
        if (certificateInfo.caCert) {
            caCertItem.style.display = 'flex';
            document.getElementById('reviewListenerCaCertValue').textContent = certificateInfo.caCert.name;
        } else {
            caCertItem.style.display = 'none';
        }
    } else {
        document.getElementById('reviewListenerCert').style.display = 'none';
        document.getElementById('reviewListenerKey').style.display = 'none';
        document.getElementById('reviewListenerCaCert').style.display = 'none';
    }
}

function saveListener() {
    const name = document.getElementById('listenerName')?.value;
    const port = parseInt(document.getElementById('listenerPort')?.value);
    const protocol = document.getElementById('listenerProtocol')?.value;
    const parser = document.getElementById('listenerParser')?.value;
    const framing = document.getElementById('listenerFraming')?.value;
    const description = document.getElementById('listenerDescription')?.value;
    
    if (!name || !port || !protocol || !parser) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Show loading state
    const saveBtn = document.getElementById('listenerWizardSave');
    const originalText = saveBtn?.textContent;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Creating...';
    }
    
    // Upload certificates if TLS
    if (protocol === 'TLS') {
        const certInput = document.getElementById('listenerCertFile');
        const keyInput = document.getElementById('listenerKeyFile');
        const caCertInput = document.getElementById('listenerCaCertFile');
        
        if (!certInput?.files[0] || !keyInput?.files[0]) {
            alert('TLS requires both certificate and private key files');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
            return;
        }
        
        // Upload files one by one
        uploadCertFile(certInput.files[0], 'cert')
            .then(certPath => {
                return uploadCertFile(keyInput.files[0], 'key')
                    .then(keyPath => {
                        let caCertPath = null;
                        if (caCertInput?.files[0]) {
                            return uploadCertFile(caCertInput.files[0], 'ca')
                                .then(caPath => ({ certPath, keyPath, caCertPath: caPath }));
                        }
                        return Promise.resolve({ certPath, keyPath, caCertPath: null });
                    });
            })
            .then(certPaths => {
                createListenerWithCertPaths(name, port, protocol, parser, framing, description, certPaths);
            })
            .catch(err => {
                console.error('Error uploading certificates:', err);
                alert('Error uploading certificates: ' + (err.message || 'Unknown error'));
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                }
            });
    } else {
        // Create listener without TLS
        createListener(name, port, protocol, parser, framing, description);
    }
}

function uploadCertFile(file, type) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    return apiFetch(`${API_BASE}/api/certs/upload`, {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (!res.ok) {
            return res.text().then(text => {
                throw new Error(text || `HTTP ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => data.path);
}

function createListener(name, port, protocol, parser, framing, description) {
    const listenerData = {
        name: name,
        port: port,
        protocol: protocol,
        parser: parser
    };
    
    if (framing && (protocol === 'TCP' || protocol === 'TLS')) {
        listenerData.framing = framing;
    }
    if (description) {
        listenerData.description = description;
    }
    
    fetch(`${API_BASE}/api/listeners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listenerData)
    })
    .then(res => {
        if (!res.ok) {
            return res.text().then(text => {
                throw new Error(text || `HTTP ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => {
        closeListenerModal();
        fetchListeners();
        // Reset form
        document.getElementById('listenerName').value = '';
        document.getElementById('listenerPort').value = '';
        document.getElementById('listenerDescription').value = '';
        document.getElementById('listenerProtocol').value = 'UDP';
        document.getElementById('listenerParser').value = 'RFC5424';
    })
    .catch(err => {
        console.error('Error creating listener:', err);
        alert('Error creating listener: ' + (err.message || 'Unknown error'));
        const saveBtn = document.getElementById('listenerWizardSave');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Create Listener';
        }
    });
}

function createListenerWithCertPaths(name, port, protocol, parser, framing, description, certPaths) {
    const listenerData = {
        name: name,
        port: port,
        protocol: protocol,
        parser: parser
    };
    
    if (framing && (protocol === 'TCP' || protocol === 'TLS')) {
        listenerData.framing = framing;
    }
    if (description) {
        listenerData.description = description;
    }
    if (certPaths.certPath) {
        listenerData.cert_file = certPaths.certPath;
    }
    if (certPaths.keyPath) {
        listenerData.key_file = certPaths.keyPath;
    }
    if (certPaths.caCertPath) {
        listenerData.ca_cert_file = certPaths.caCertPath;
    }
    
    fetch(`${API_BASE}/api/listeners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listenerData)
    })
    .then(res => {
        if (!res.ok) {
            return res.text().then(text => {
                throw new Error(text || `HTTP ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => {
        closeListenerModal();
        fetchListeners();
        // Reset form
        document.getElementById('listenerName').value = '';
        document.getElementById('listenerPort').value = '';
        document.getElementById('listenerDescription').value = '';
        document.getElementById('listenerProtocol').value = 'UDP';
        document.getElementById('listenerParser').value = 'RFC5424';
    })
    .catch(err => {
        console.error('Error creating listener:', err);
        alert('Error creating listener: ' + (err.message || 'Unknown error'));
        const saveBtn = document.getElementById('listenerWizardSave');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Create Listener';
        }
    });
}

function listenerWizardPrev() {
    if (currentWizardStep > 1) {
        // Hide current step
        const currentPanel = document.querySelector(`.wizard-panel.active`);
        const currentStep = document.querySelector(`.wizard-step[data-step="${currentWizardStep}"]`);
        if (currentPanel) currentPanel.classList.remove('active');
        if (currentStep) currentStep.classList.remove('active');
        
        // Show previous step
        currentWizardStep--;
        const prevPanel = document.getElementById(`listenerStep${currentWizardStep}`);
        const prevStep = document.querySelector(`.wizard-step[data-step="${currentWizardStep}"]`);
        if (prevPanel) prevPanel.classList.add('active');
        if (prevStep) prevStep.classList.add('active');
        
        // Update step indicator
        const stepIndicator = document.getElementById('listenerWizardStep');
        if (stepIndicator) stepIndicator.textContent = currentWizardStep;
        
        // Update buttons
        const prevBtn = document.getElementById('listenerWizardPrev');
        const nextBtn = document.getElementById('listenerWizardNext');
        const saveBtn = document.getElementById('listenerWizardSave');
        
        if (currentWizardStep === 1) {
            if (prevBtn) prevBtn.style.display = 'none';
        } else {
            if (prevBtn) prevBtn.style.display = 'inline-flex';
        }
        if (nextBtn) nextBtn.style.display = 'inline-flex';
        if (saveBtn) saveBtn.style.display = 'none';
    }
}

function closeListenerModal() {
    const modal = document.getElementById('addListenerModal');
    if (modal) {
        modal.style.display = 'none';
        // Reset wizard
        currentWizardStep = 1;
        document.querySelectorAll('.wizard-panel').forEach((panel, index) => {
            panel.classList.toggle('active', index === 0);
        });
        document.querySelectorAll('.wizard-step').forEach((step, index) => {
            step.classList.toggle('active', index === 0);
        });
        const stepIndicator = document.getElementById('listenerWizardStep');
        if (stepIndicator) stepIndicator.textContent = '1';
        const prevBtn = document.getElementById('listenerWizardPrev');
        const nextBtn = document.getElementById('listenerWizardNext');
        const saveBtn = document.getElementById('listenerWizardSave');
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'inline-flex';
        if (saveBtn) saveBtn.style.display = 'none';
        
        // Reset certificate info
        certificateInfo = { cert: null, key: null, caCert: null };
    }
}

// Make functions globally accessible
window.toggleListener = toggleListener;
window.deleteListener = deleteListener;
window.listenerWizardNext = listenerWizardNext;
window.listenerWizardPrev = listenerWizardPrev;
window.closeListenerModal = closeListenerModal;
window.saveListener = saveListener;
window.handleCertUpload = handleCertUpload;

