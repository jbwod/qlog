// Utility Functions
const API_BASE = window.location.origin;

// Wrapper for fetch that includes credentials (cookies) by default
// Make it globally available immediately
window.apiFetch = async (url, options = {}) => {
    const fetchOptions = {
        ...options,
        credentials: 'include', // Always include cookies for authentication
    };
    return fetch(url, fetchOptions);
};

// Also create a local const for convenience
const apiFetch = window.apiFetch;

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

// Get appropriate icon for event type
function getEventTypeIcon(eventType) {
    if (!eventType || eventType === 'unknown') {
        return '<i class="fas fa-question-circle" style="margin-right: 4px; color: #9ca3af;"></i>';
    }
    
    const eventTypeLower = eventType.toLowerCase();
    
    // Security events
    if (eventTypeLower.includes('security') || eventTypeLower.includes('ids') || eventTypeLower.includes('alert') || eventTypeLower.includes('threat')) {
        return '<i class="fas fa-shield-alt" style="margin-right: 4px; color: #ef4444;"></i>';
    }
    if (eventTypeLower.includes('firewall') || eventTypeLower.includes('block') || eventTypeLower.includes('deny')) {
        return '<i class="fas fa-firewall" style="margin-right: 4px; color: #f59e0b;"></i>';
    }
    if (eventTypeLower.includes('malware') || eventTypeLower.includes('virus') || eventTypeLower.includes('malicious')) {
        return '<i class="fas fa-virus" style="margin-right: 4px; color: #ef4444;"></i>';
    }
    
    // Network events
    if (eventTypeLower.includes('vpn') || eventTypeLower.includes('ipsec') || eventTypeLower.includes('ike')) {
        return '<i class="fas fa-lock" style="margin-right: 4px; color: #6366f1;"></i>';
    }
    if (eventTypeLower.includes('flow') || eventTypeLower.includes('traffic') || eventTypeLower.includes('connection')) {
        return '<i class="fas fa-network-wired" style="margin-right: 4px; color: #3b82f6;"></i>';
    }
    if (eventTypeLower.includes('url') || eventTypeLower.includes('http') || eventTypeLower.includes('web')) {
        return '<i class="fas fa-globe" style="margin-right: 4px; color: #10b981;"></i>';
    }
    if (eventTypeLower.includes('dhcp') || eventTypeLower.includes('lease') || eventTypeLower.includes('ip')) {
        return '<i class="fas fa-network-wired" style="margin-right: 4px; color: #8b5cf6;"></i>';
    }
    if (eventTypeLower.includes('uplink') || eventTypeLower.includes('connectivity') || eventTypeLower.includes('failover')) {
        return '<i class="fas fa-exchange-alt" style="margin-right: 4px; color: #f59e0b;"></i>';
    }
    
    // Wireless events
    if (eventTypeLower.includes('wifi') || eventTypeLower.includes('wireless') || eventTypeLower.includes('wlan')) {
        return '<i class="fas fa-wifi" style="margin-right: 4px; color: #10b981;"></i>';
    }
    if (eventTypeLower.includes('association') || eventTypeLower.includes('connect') || eventTypeLower.includes('disconnect')) {
        return '<i class="fas fa-link" style="margin-right: 4px; color: #6366f1;"></i>';
    }
    if (eventTypeLower.includes('rogue') || eventTypeLower.includes('spoofing') || eventTypeLower.includes('airmarshal')) {
        return '<i class="fas fa-ghost" style="margin-right: 4px; color: #ef4444;"></i>';
    }
    
    // Switch events
    if (eventTypeLower.includes('port') || eventTypeLower.includes('stp') || eventTypeLower.includes('spanning')) {
        return '<i class="fas fa-plug" style="margin-right: 4px; color: #8b5cf6;"></i>';
    }
    if (eventTypeLower.includes('power') || eventTypeLower.includes('poe')) {
        return '<i class="fas fa-bolt" style="margin-right: 4px; color: #f59e0b;"></i>';
    }
    
    // Authentication events
    if (eventTypeLower.includes('auth') || eventTypeLower.includes('login') || eventTypeLower.includes('8021x')) {
        return '<i class="fas fa-key" style="margin-right: 4px; color: #6366f1;"></i>';
    }
    if (eventTypeLower.includes('ssh') || eventTypeLower.includes('telnet')) {
        return '<i class="fas fa-terminal" style="margin-right: 4px; color: #3b82f6;"></i>';
    }
    
    // System events
    if (eventTypeLower.includes('admin') || eventTypeLower.includes('config') || eventTypeLower.includes('change')) {
        return '<i class="fas fa-cog" style="margin-right: 4px; color: #9ca3af;"></i>';
    }
    if (eventTypeLower.includes('device') || eventTypeLower.includes('adopt') || eventTypeLower.includes('offline')) {
        return '<i class="fas fa-server" style="margin-right: 4px; color: #6366f1;"></i>';
    }
    if (eventTypeLower.includes('event') || eventTypeLower.includes('log')) {
        return '<i class="fas fa-clipboard-list" style="margin-right: 4px; color: #9ca3af;"></i>';
    }
    
    // Default icon
    return '<i class="fas fa-info-circle" style="margin-right: 4px; color: #9ca3af;"></i>';
}

function getSeverityColor(severity) {
    const colors = {
        0: '#ef4444', 1: '#f97316', 2: '#f59e0b', 3: '#eab308',
        4: '#84cc16', 5: '#22c55e', 6: '#10b981', 7: '#14b8a6'
    };
    return colors[severity] || '#9ca3af';
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function closeModal() {
    const modal = document.getElementById('logModal');
    if (modal) modal.style.display = 'none';
}

function closeListenerModal() {
    const modal = document.getElementById('addListenerModal');
    if (modal) modal.style.display = 'none';
}

function closeDeviceModal() {
    const modal = document.getElementById('addDeviceModal');
    if (modal) modal.style.display = 'none';
}

function closeViewBuilder() {
    const modal = document.getElementById('viewBuilderModal');
    if (modal) {
        modal.style.display = 'none';
        // Reset view builder state (if views.js is loaded)
        if (typeof window.currentEditingViewId !== 'undefined') {
            window.currentEditingViewId = null;
        }
        if (typeof window.isReadOnlyMode !== 'undefined') {
            window.isReadOnlyMode = false;
        }
    }
}

function closeWidgetConfig() {
    const modal = document.getElementById('widgetConfigModal');
    if (modal) modal.style.display = 'none';
}

