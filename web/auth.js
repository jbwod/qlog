// Authentication module
// Handles login, logout, session management, and setup

// Make authState globally accessible
window.authState = {
    authenticated: false,
    setupRequired: false,
    username: null,
    role: null,
    expiresAt: null
};

let authState = window.authState; // Local reference for convenience

// Check authentication status on page load
async function checkAuthStatus() {
    try {
        const response = await apiFetch(`${API_BASE}/api/auth/status`);
        if (!response.ok) {
            throw new Error('Failed to check auth status');
        }
        const data = await response.json();
        
        window.authState = {
            authenticated: data.authenticated || false,
            setupRequired: data.setupRequired || false,
            username: data.username || null,
            role: data.role || null,
            expiresAt: data.expiresAt || null
        };
        authState = window.authState; // Update local reference

        // If setup is required, show setup modal
        if (authState.setupRequired) {
            showSetupModal();
            return false;
        }

        // If not authenticated, show login modal
        if (!authState.authenticated) {
            showLoginModal();
            return false;
        }

        // Authenticated - hide modals and show app
        hideAuthModals();
        return true;
    } catch (error) {
        console.error('Error checking auth status:', error);
        // On error, assume not authenticated
        showLoginModal();
        return false;
    }
}

// Show login modal
async function showLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) {
        await createAuthModal();
    }
    const loginForm = document.getElementById('login-form');
    const setupForm = document.getElementById('setup-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    
    if (loginForm) loginForm.style.display = 'block';
    if (setupForm) setupForm.style.display = 'none';
    if (authTitle) authTitle.textContent = 'Login';
    if (authSubtitle) {
        // Fetch brand name for subtitle
        try {
            const response = await apiFetch(`${API_BASE}/api/customization`);
            if (response.ok) {
                const data = await response.json();
                const customization = data || {};
                const brandName = (customization && customization.brand_name) ? customization.brand_name : 'qLog';
                authSubtitle.textContent = `Enter your credentials to access ${brandName}`;
            } else {
                authSubtitle.textContent = 'Enter your credentials to access qLog';
            }
        } catch (error) {
            authSubtitle.textContent = 'Enter your credentials to access qLog';
        }
    }
    if (modal) modal.style.display = 'flex';
    
    // Hide main app
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'none';
}

// Show setup modal
async function showSetupModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) {
        await createAuthModal();
    }
    const loginForm = document.getElementById('login-form');
    const setupForm = document.getElementById('setup-form');
    const authTitle = document.getElementById('auth-title');
    const authInfo = document.querySelector('.auth-info');
    
    if (loginForm) loginForm.style.display = 'none';
    if (setupForm) setupForm.style.display = 'block';
    if (authTitle) authTitle.textContent = 'Setup Admin Account';
    
    // Update welcome message with brand name
    if (authInfo) {
        try {
            const response = await apiFetch(`${API_BASE}/api/customization`);
            if (response.ok) {
                const customization = await response.json();
                const brandName = customization.brand_name || 'qLog';
                authInfo.textContent = `Welcome to ${brandName}! Please create an admin account to get started.`;
            }
        } catch (error) {
            authInfo.textContent = 'Welcome to qLog! Please create an admin account to get started.';
        }
    }
    
    if (modal) modal.style.display = 'flex';
    
    // Hide main app
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'none';
}

// Hide auth modals
function hideAuthModals() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
    
    // Show main app
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'flex';
}

// Create auth modal HTML
async function createAuthModal() {
    // Fetch customization settings
    let customization = {};
    try {
        const response = await apiFetch(`${API_BASE}/api/customization`);
        if (response.ok) {
            const data = await response.json();
            customization = data || {};
        }
    } catch (error) {
        console.error('Error fetching customization:', error);
        customization = {};
    }

    const brandName = (customization && customization.brand_name) ? customization.brand_name : 'qLog';
    const brandSubtitle = (customization && customization.brand_subtitle) ? customization.brand_subtitle : 'Syslog Server';
    const logoPath = (customization && customization.brand_logo) ? customization.brand_logo : null;

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="auth-modal-content">
            <div class="auth-header">
                <div class="auth-logo" id="auth-logo">
                    ${logoPath ? 
                        `<img src="${logoPath}" alt="${brandName}" style="width: 48px; height: 48px; object-fit: contain;">` :
                        `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>`
                    }
                </div>
                <h2 id="auth-title">Login</h2>
                <p id="auth-subtitle">Enter your credentials to access ${brandName}</p>
            </div>

            <!-- Login Form -->
            <form id="login-form" class="auth-form" style="display: none;">
                <div class="auth-form-group">
                    <label for="login-username">Username</label>
                    <input type="text" id="login-username" name="username" required autocomplete="username" placeholder="Enter your username">
                </div>
                <div class="auth-form-group">
                    <label for="login-password">Password</label>
                    <input type="password" id="login-password" name="password" required autocomplete="current-password" placeholder="Enter your password">
                </div>
                <div id="login-error" class="auth-error" style="display: none;"></div>
                <button type="submit" class="auth-button">
                    <span>Login</span>
                    <i class="fas fa-arrow-right"></i>
                </button>
            </form>

            <!-- Setup Form -->
            <form id="setup-form" class="auth-form" style="display: none;">
                <p class="auth-info">Welcome to ${brandName}! Please create an admin account to get started.</p>
                <div class="auth-form-group">
                    <label for="setup-username">Username</label>
                    <input type="text" id="setup-username" name="username" required autocomplete="username" placeholder="Choose a username">
                </div>
                <div class="auth-form-group">
                    <label for="setup-password">Password</label>
                    <input type="password" id="setup-password" name="password" required autocomplete="new-password" placeholder="Create a password">
                </div>
                <div class="auth-form-group">
                    <label for="setup-password-confirm">Confirm Password</label>
                    <input type="password" id="setup-password-confirm" name="password-confirm" required autocomplete="new-password" placeholder="Confirm your password">
                </div>
                <div id="setup-error" class="auth-error" style="display: none;"></div>
                <button type="submit" class="auth-button">
                    <span>Create Admin Account</span>
                    <i class="fas fa-arrow-right"></i>
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // Apply customization colors
    applyAuthCustomization(customization);

    // Setup form handlers
    setupAuthHandlers();
}

// Apply customization to auth modal
function applyAuthCustomization(customization) {
    if (!customization) return;

    // Apply colors
    if (customization.primary_color) {
        document.documentElement.style.setProperty('--accent', customization.primary_color);
    }
    if (customization.accent_color) {
        document.documentElement.style.setProperty('--accent', customization.accent_color);
    }
    if (customization.accent_hover) {
        document.documentElement.style.setProperty('--accent-hover', customization.accent_hover);
    }
    if (customization.background_color) {
        document.documentElement.style.setProperty('--bg-primary', customization.background_color);
    }
    if (customization.bg_card_color) {
        document.documentElement.style.setProperty('--bg-card', customization.bg_card_color);
    }
    if (customization.text_color) {
        document.documentElement.style.setProperty('--text-primary', customization.text_color);
    }
    if (customization.text_secondary_color) {
        document.documentElement.style.setProperty('--text-secondary', customization.text_secondary_color);
    }
    if (customization.logo_color) {
        const authLogo = document.getElementById('auth-logo');
        if (authLogo) {
            authLogo.style.color = customization.logo_color;
        }
    }
}

// Setup auth form handlers
function setupAuthHandlers() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');

            try {
                const response = await apiFetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    errorDiv.textContent = data.error || 'Login failed';
                    errorDiv.style.display = 'block';
                    return;
                }

                // Success - update auth state
                window.authState.authenticated = true;
                window.authState.username = data.username;
                window.authState.role = data.role;
                window.authState.expiresAt = data.expiresAt;
                authState = window.authState; // Update local reference
                window.authReady = true;

                hideAuthModals();
                
                // Trigger app initialization if callback is set
                if (window.onAuthReady) {
                    window.onAuthReady();
                } else {
                    // Fallback: reload page to refresh state
                    window.location.reload();
                }
            } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
            }
        });
    }

    // Setup form
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('setup-username').value;
            const password = document.getElementById('setup-password').value;
            const passwordConfirm = document.getElementById('setup-password-confirm').value;
            const errorDiv = document.getElementById('setup-error');

            // Validate passwords match
            if (password !== passwordConfirm) {
                errorDiv.textContent = 'Passwords do not match';
                errorDiv.style.display = 'block';
                return;
            }

            if (password.length < 8) {
                errorDiv.textContent = 'Password must be at least 8 characters';
                errorDiv.style.display = 'block';
                return;
            }

            try {
                const response = await apiFetch(`${API_BASE}/api/auth/setup`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    errorDiv.textContent = data.error || 'Setup failed';
                    errorDiv.style.display = 'block';
                    return;
                }

                // Success - automatically login
                const loginResponse = await apiFetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const loginData = await loginResponse.json();

                if (!loginResponse.ok) {
                    errorDiv.textContent = 'Account created but login failed. Please login manually.';
                    errorDiv.style.display = 'block';
                    // Switch to login form
                    showLoginModal();
                    return;
                }

                // Success - update auth state
                window.authState.authenticated = true;
                window.authState.setupRequired = false;
                window.authState.username = loginData.username;
                window.authState.role = loginData.role;
                window.authState.expiresAt = loginData.expiresAt;
                authState = window.authState; // Update local reference
                window.authReady = true;

                hideAuthModals();
                
                // Trigger app initialization if callback is set
                if (window.onAuthReady) {
                    window.onAuthReady();
                } else {
                    // Fallback: reload page to refresh state
                    window.location.reload();
                }
            } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
            }
        });
    }
}

// Logout function
async function logout() {
    try {
        await apiFetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Error logging out:', error);
    }

    // Clear auth state
    window.authState = {
        authenticated: false,
        setupRequired: false,
        username: null,
        role: null,
        expiresAt: null
    };
    authState = window.authState; // Update local reference

    // Reload page to show login
    window.location.reload();
}

// Check session expiration periodically
function startSessionCheck() {
    setInterval(() => {
        if (authState.authenticated && authState.expiresAt) {
            const expiresAt = new Date(authState.expiresAt);
            const now = new Date();
            if (now >= expiresAt) {
                // Session expired
                logout();
            }
        }
    }, 60000); // Check every minute
}

// Make checkAuthStatus available globally
window.checkAuthStatus = checkAuthStatus;

// Global flag to track if auth is ready
window.authReady = false;
window.authInitialized = false;

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Skip auth check for shared views
    if (window.location.pathname === '/shared' || window.location.pathname.includes('/shared')) {
        window.authReady = true;
        window.authInitialized = true;
        return;
    }

    // Check auth status
    const isAuthenticated = await checkAuthStatus();
    window.authReady = true;
    window.authInitialized = true;
    
    if (isAuthenticated) {
        startSessionCheck();
        // Add logout button to navigation
        addLogoutButton();
        // Signal that app can initialize
        if (window.onAuthReady) {
            window.onAuthReady();
        }
    }
});

// Add logout button to navigation
function addLogoutButton() {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu || document.getElementById('logout-button')) {
        return; // Already added or nav menu doesn't exist
    }

    const logoutItem = document.createElement('li');
    logoutItem.id = 'logout-button';
    logoutItem.className = 'nav-item';
    logoutItem.innerHTML = `
        <div class="nav-item-content">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span class="nav-text">Logout</span>
        </div>
    `;
    logoutItem.addEventListener('click', logout);
    navMenu.appendChild(logoutItem);
}

