// Settings Management

// Color Templates
const COLOR_TEMPLATES = {
    default: {
        name: 'Default Indigo',
        primary: '#6366f1',
        accent: '#6366f1',
        accentHover: '#4f46e5',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    blue: {
        name: 'Ocean Blue',
        primary: '#3b82f6',
        accent: '#3b82f6',
        accentHover: '#2563eb',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4'
    },
    green: {
        name: 'Forest Green',
        primary: '#10b981',
        accent: '#10b981',
        accentHover: '#059669',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    purple: {
        name: 'Royal Purple',
        primary: '#8b5cf6',
        accent: '#8b5cf6',
        accentHover: '#7c3aed',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    orange: {
        name: 'Sunset Orange',
        primary: '#f97316',
        accent: '#f97316',
        accentHover: '#ea580c',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    red: {
        name: 'Crimson Red',
        primary: '#ef4444',
        accent: '#ef4444',
        accentHover: '#dc2626',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    teal: {
        name: 'Teal Cyan',
        primary: '#14b8a6',
        accent: '#14b8a6',
        accentHover: '#0d9488',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4'
    },
    pink: {
        name: 'Rose Pink',
        primary: '#ec4899',
        accent: '#ec4899',
        accentHover: '#db2777',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    amber: {
        name: 'Amber Gold',
        primary: '#f59e0b',
        accent: '#f59e0b',
        accentHover: '#d97706',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    emerald: {
        name: 'Emerald',
        primary: '#059669',
        accent: '#059669',
        accentHover: '#047857',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    }
};

function initSettings() {
    // Setup event listeners for settings first
    setupSettingsListeners();
    
    // Initialize color templates (after DOM is ready)
    setTimeout(() => {
        initColorTemplates();
    }, 100);
    
    // Load customization settings
    fetchCustomization();
    
    // Load severity overrides
    fetchSeverityOverrides();
    
    // Load login history
    fetchLoginHistory();
}

function fetchCustomization() {
    apiFetch(`${API_BASE}/api/customization`)
        .then(res => res.json())
        .then(data => {
            if (data && Object.keys(data).length > 0) {
                applyCustomization(data);
            }
        })
        .catch(err => console.error('Error fetching customization:', err));
}

function applyCustomization(customization) {
    // Apply color scheme/template
    if (customization.color_scheme) {
        // Select the template in UI
        const templateItems = document.querySelectorAll('.color-template-item');
        templateItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.template === customization.color_scheme) {
                item.classList.add('active');
            }
        });
        
        // Show/hide custom colors card
        const customColorsCard = document.getElementById('customColorsCard');
        if (customization.color_scheme === 'custom') {
            if (customColorsCard) customColorsCard.style.display = 'block';
        } else {
            if (customColorsCard) customColorsCard.style.display = 'none';
            applyColorTemplate(customization.color_scheme, customization);
        }
    }
    
    // Apply individual colors if provided (for custom mode)
    if (customization.primary_color) {
        const primaryColorInput = document.getElementById('primaryColorInput');
        const primaryColorText = document.getElementById('primaryColorText');
        if (primaryColorInput) primaryColorInput.value = customization.primary_color;
        if (primaryColorText) primaryColorText.value = customization.primary_color;
        document.documentElement.style.setProperty('--accent', customization.primary_color);
    }
    
    if (customization.accent_color) {
        const accentColorInput = document.getElementById('accentColorInput');
        const accentColorText = document.getElementById('accentColorText');
        if (accentColorInput) accentColorInput.value = customization.accent_color;
        if (accentColorText) accentColorText.value = customization.accent_color;
        document.documentElement.style.setProperty('--accent', customization.accent_color);
    }
    
    if (customization.accent_hover) {
        const accentHoverInput = document.getElementById('accentHoverInput');
        const accentHoverText = document.getElementById('accentHoverText');
        if (accentHoverInput) accentHoverInput.value = customization.accent_hover;
        if (accentHoverText) accentHoverText.value = customization.accent_hover;
        document.documentElement.style.setProperty('--accent-hover', customization.accent_hover);
    }
    
    if (customization.success_color) {
        const successColorInput = document.getElementById('successColorInput');
        const successColorText = document.getElementById('successColorText');
        if (successColorInput) successColorInput.value = customization.success_color;
        if (successColorText) successColorText.value = customization.success_color;
        document.documentElement.style.setProperty('--success', customization.success_color);
    }
    
    if (customization.warning_color) {
        const warningColorInput = document.getElementById('warningColorInput');
        const warningColorText = document.getElementById('warningColorText');
        if (warningColorInput) warningColorInput.value = customization.warning_color;
        if (warningColorText) warningColorText.value = customization.warning_color;
        document.documentElement.style.setProperty('--warning', customization.warning_color);
    }
    
    if (customization.error_color) {
        const errorColorInput = document.getElementById('errorColorInput');
        const errorColorText = document.getElementById('errorColorText');
        if (errorColorInput) errorColorInput.value = customization.error_color;
        if (errorColorText) errorColorText.value = customization.error_color;
        document.documentElement.style.setProperty('--error', customization.error_color);
    }
    
    if (customization.info_color) {
        const infoColorInput = document.getElementById('infoColorInput');
        const infoColorText = document.getElementById('infoColorText');
        if (infoColorInput) infoColorInput.value = customization.info_color;
        if (infoColorText) infoColorText.value = customization.info_color;
        document.documentElement.style.setProperty('--info', customization.info_color);
    }
    
    // Apply brand name
    if (customization.brand_name !== undefined) {
        const brandNameInput = document.getElementById('brandNameInput');
        if (brandNameInput) brandNameInput.value = customization.brand_name || 'qLog';
        // Apply to sidebar immediately
        applyBrandingToSidebar(customization.brand_name, customization.brand_subtitle);
    }
    
    // Apply brand subtitle
    if (customization.brand_subtitle !== undefined) {
        const brandSubtitleInput = document.getElementById('brandSubtitleInput');
        if (brandSubtitleInput) brandSubtitleInput.value = customization.brand_subtitle || 'Syslog Server';
        // Apply to sidebar immediately
        applyBrandingToSidebar(customization.brand_name, customization.brand_subtitle);
    }
    
    // Apply background color
    if (customization.background_color) {
        const backgroundColorInput = document.getElementById('backgroundColorInput');
        const backgroundColorText = document.getElementById('backgroundColorText');
        if (backgroundColorInput) backgroundColorInput.value = customization.background_color;
        if (backgroundColorText) backgroundColorText.value = customization.background_color;
        document.documentElement.style.setProperty('--bg-primary', customization.background_color);
    }
    
    // Apply nav color
    if (customization.nav_color) {
        const navColorInput = document.getElementById('navColorInput');
        const navColorText = document.getElementById('navColorText');
        if (navColorInput) navColorInput.value = customization.nav_color;
        if (navColorText) navColorText.value = customization.nav_color;
        document.documentElement.style.setProperty('--bg-secondary', customization.nav_color);
    }
    
    // Apply text color
    if (customization.text_color) {
        const textColorInput = document.getElementById('textColorInput');
        const textColorText = document.getElementById('textColorText');
        if (textColorInput) textColorInput.value = customization.text_color;
        if (textColorText) textColorText.value = customization.text_color;
        document.documentElement.style.setProperty('--text-primary', customization.text_color);
    }
    
    // Apply text secondary color
    if (customization.text_secondary_color) {
        const textSecondaryColorInput = document.getElementById('textSecondaryColorInput');
        const textSecondaryColorText = document.getElementById('textSecondaryColorText');
        if (textSecondaryColorInput) textSecondaryColorInput.value = customization.text_secondary_color;
        if (textSecondaryColorText) textSecondaryColorText.value = customization.text_secondary_color;
        document.documentElement.style.setProperty('--text-secondary', customization.text_secondary_color);
    }
    
    // Apply text tertiary color
    if (customization.text_tertiary_color) {
        const textTertiaryColorInput = document.getElementById('textTertiaryColorInput');
        const textTertiaryColorText = document.getElementById('textTertiaryColorText');
        if (textTertiaryColorInput) textTertiaryColorInput.value = customization.text_tertiary_color;
        if (textTertiaryColorText) textTertiaryColorText.value = customization.text_tertiary_color;
        document.documentElement.style.setProperty('--text-tertiary', customization.text_tertiary_color);
    }
    
    // Apply bg tertiary color
    if (customization.bg_tertiary_color) {
        const bgTertiaryColorInput = document.getElementById('bgTertiaryColorInput');
        const bgTertiaryColorText = document.getElementById('bgTertiaryColorText');
        if (bgTertiaryColorInput) bgTertiaryColorInput.value = customization.bg_tertiary_color;
        if (bgTertiaryColorText) bgTertiaryColorText.value = customization.bg_tertiary_color;
        document.documentElement.style.setProperty('--bg-tertiary', customization.bg_tertiary_color);
    }
    
    // Apply bg card color
    if (customization.bg_card_color) {
        const bgCardColorInput = document.getElementById('bgCardColorInput');
        const bgCardColorText = document.getElementById('bgCardColorText');
        if (bgCardColorInput) bgCardColorInput.value = customization.bg_card_color;
        if (bgCardColorText) bgCardColorText.value = customization.bg_card_color;
        document.documentElement.style.setProperty('--bg-card', customization.bg_card_color);
    }
    
    // Apply bg hover color
    if (customization.bg_hover_color) {
        const bgHoverColorInput = document.getElementById('bgHoverColorInput');
        const bgHoverColorText = document.getElementById('bgHoverColorText');
        if (bgHoverColorInput) bgHoverColorInput.value = customization.bg_hover_color;
        if (bgHoverColorText) bgHoverColorText.value = customization.bg_hover_color;
        document.documentElement.style.setProperty('--bg-hover', customization.bg_hover_color);
    }
    
    // Update gradient based on primary/accent colors
    const primaryColor = customization.primary_color || customization.accent_color || '#6366f1';
    const accentColor = customization.accent_color || primaryColor;
    const gradientEnd = adjustColorBrightness(accentColor, -10);
    const gradient = `linear-gradient(135deg, ${primaryColor} 0%, ${gradientEnd} 100%)`;
    document.documentElement.style.setProperty('--gradient-primary', gradient);
    
    // Apply logo color
    if (customization.logo_color) {
        const logoColorInput = document.getElementById('logoColorInput');
        const logoColorText = document.getElementById('logoColorText');
        if (logoColorInput) logoColorInput.value = customization.logo_color;
        if (logoColorText) logoColorText.value = customization.logo_color;
        document.documentElement.style.setProperty('--logo-color', customization.logo_color);
        // Apply to logo icon
        const logoIcon = document.querySelector('.logo-icon');
        if (logoIcon) {
            logoIcon.style.color = customization.logo_color;
        }
    }
    
    // Apply logo text color
    if (customization.logo_text_color) {
        const logoTextColorInput = document.getElementById('logoTextColorInput');
        const logoTextColorText = document.getElementById('logoTextColorText');
        if (logoTextColorInput) logoTextColorInput.value = customization.logo_text_color;
        if (logoTextColorText) logoTextColorText.value = customization.logo_text_color;
        document.documentElement.style.setProperty('--logo-text-color', customization.logo_text_color);
        // Apply to logo text
        const logoPrimary = document.querySelector('.logo-primary');
        const logoSubtitle = document.querySelector('.logo-subtitle');
        if (logoPrimary) logoPrimary.style.color = customization.logo_text_color;
        if (logoSubtitle) logoSubtitle.style.color = customization.logo_text_color;
    }
    
    // Apply logo
    if (customization.brand_logo) {
        const logoPreviewImg = document.getElementById('logoPreviewImg');
        const logoPlaceholder = document.getElementById('logoPlaceholder');
        const logoRemoveBtn = document.getElementById('logoRemoveBtn');
        const customLogoPreview = document.getElementById('customLogoPreview');
        const defaultLogoIconPreview = document.getElementById('defaultLogoIconPreview');
        if (logoPreviewImg) {
            logoPreviewImg.src = customization.brand_logo;
            logoPreviewImg.style.display = 'block';
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
            if (logoRemoveBtn) logoRemoveBtn.style.display = 'inline-flex';
        }
        if (customLogoPreview) {
            customLogoPreview.src = customization.brand_logo;
            customLogoPreview.style.display = 'block';
            if (defaultLogoIconPreview) defaultLogoIconPreview.style.display = 'none';
        }
        updatePreview();
        applyLogoToSidebar(customization.brand_logo);
    }
    
    // Apply favicon
    if (customization.favicon) {
        const faviconPreviewImg = document.getElementById('faviconPreviewImg');
        const faviconPlaceholder = document.getElementById('faviconPlaceholder');
        const faviconRemoveBtn = document.getElementById('faviconRemoveBtn');
        if (faviconPreviewImg) {
            faviconPreviewImg.src = customization.favicon;
            faviconPreviewImg.style.display = 'block';
            if (faviconPlaceholder) faviconPlaceholder.style.display = 'none';
            if (faviconRemoveBtn) faviconRemoveBtn.style.display = 'inline-flex';
        }
        applyFavicon(customization.favicon);
    }
    
    // Apply show branding
    if (customization.show_branding !== undefined) {
        const showBrandingToggle = document.getElementById('showBrandingToggle');
        if (showBrandingToggle) showBrandingToggle.checked = customization.show_branding;
        applyShowBranding(customization.show_branding);
    }
}

function applyBrandingToSidebar(brandName, brandSubtitle) {
    const logoPrimary = document.querySelector('.logo-primary');
    const logoSubtitle = document.querySelector('.logo-subtitle');
    if (logoPrimary) logoPrimary.textContent = brandName || 'qLog';
    if (logoSubtitle) logoSubtitle.textContent = brandSubtitle || 'Syslog Server';
}

function applyShowBranding(show) {
    const logo = document.querySelector('.logo');
    const logoText = document.querySelector('.logo-text');
    if (logo && logoText) {
        if (show) {
            logoText.style.display = 'flex';
        } else {
            logoText.style.display = 'none';
        }
    }
}

function updatePreview() {
    const brandName = document.getElementById('brandNameInput')?.value || 'qLog';
    const brandSubtitle = document.getElementById('brandSubtitleInput')?.value || 'Syslog Server';
    const logoPrimaryPreview = document.getElementById('logoPrimaryPreview');
    const logoSubtitlePreview = document.getElementById('logoSubtitlePreview');
    
    if (logoPrimaryPreview) logoPrimaryPreview.textContent = brandName;
    if (logoSubtitlePreview) logoSubtitlePreview.textContent = brandSubtitle;
    
    // Update preview logo if custom logo exists
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    if (logoPreviewImg && logoPreviewImg.src && !logoPreviewImg.src.includes('data:')) {
        const customLogoPreview = document.getElementById('customLogoPreview');
        const defaultLogoIconPreview = document.getElementById('defaultLogoIconPreview');
        if (customLogoPreview) {
            customLogoPreview.src = logoPreviewImg.src;
            customLogoPreview.style.display = 'block';
            if (defaultLogoIconPreview) defaultLogoIconPreview.style.display = 'none';
        }
    }
}

function applyLogoToSidebar(logoPath) {
    const logoIcon = document.querySelector('.logo-icon');
    if (!logoIcon) return;
    
    // Clear existing content
    logoIcon.innerHTML = '';
    
    // Create img element
    const img = document.createElement('img');
    img.src = logoPath;
    img.style.width = '28px';
    img.style.height = '28px';
    img.style.objectFit = 'contain';
    logoIcon.appendChild(img);
}

function applyFavicon(faviconPath) {
    // Remove existing favicon
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (existingFavicon) {
        existingFavicon.remove();
    }
    
    // Add new favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = faviconPath;
    document.head.appendChild(link);
}

function initColorTemplates() {
    const grid = document.getElementById('colorTemplatesGrid');
    if (!grid) return;
    
    // Clear existing templates
    grid.innerHTML = '';
    
    // Add "Custom" option with rainbow gradient
    const customOption = document.createElement('div');
    customOption.className = 'color-template-item';
    customOption.dataset.template = 'custom';
    customOption.innerHTML = `
        <div class="color-template-preview" style="background: linear-gradient(135deg, #ff0000 0%, #ff7f00 14%, #ffff00 28%, #00ff00 42%, #0000ff 57%, #4b0082 71%, #9400d3 85%, #ff0000 100%);"></div>
        <div class="color-template-name">Custom</div>
    `;
    customOption.addEventListener('click', () => selectColorTemplate('custom'));
    grid.appendChild(customOption);
    
    // Add predefined templates
    Object.entries(COLOR_TEMPLATES).forEach(([key, template]) => {
        const item = document.createElement('div');
        item.className = 'color-template-item';
        item.dataset.template = key;
        item.innerHTML = `
            <div class="color-template-preview" style="background: ${template.primary};"></div>
            <div class="color-template-name">${template.name}</div>
        `;
        item.addEventListener('click', () => selectColorTemplate(key));
        grid.appendChild(item);
    });
}

function selectColorTemplate(templateKey) {
    // Update active state
    document.querySelectorAll('.color-template-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.template === templateKey) {
            item.classList.add('active');
        }
    });
    
    const customColorsCard = document.getElementById('customColorsCard');
    
    if (templateKey === 'custom') {
        // Show custom color inputs
        if (customColorsCard) customColorsCard.style.display = 'block';
    } else {
        // Hide custom color inputs
        if (customColorsCard) customColorsCard.style.display = 'none';
        
        // Apply template colors
        const template = COLOR_TEMPLATES[templateKey];
        if (template) {
            applyColorTemplate(templateKey, template);
        }
    }
}

function applyColorTemplate(templateKey, customization = null) {
    let template;
    
    if (customization && customization.color_scheme && COLOR_TEMPLATES[customization.color_scheme]) {
        template = COLOR_TEMPLATES[customization.color_scheme];
    } else if (COLOR_TEMPLATES[templateKey]) {
        template = COLOR_TEMPLATES[templateKey];
    } else {
        return;
    }
    
    // Apply colors to CSS variables
    document.documentElement.style.setProperty('--accent', template.accent);
    document.documentElement.style.setProperty('--accent-hover', template.accentHover);
    document.documentElement.style.setProperty('--accent-light', hexToRgba(template.accent, 0.1));
    document.documentElement.style.setProperty('--success', template.success);
    document.documentElement.style.setProperty('--success-light', hexToRgba(template.success, 0.1));
    document.documentElement.style.setProperty('--warning', template.warning);
    document.documentElement.style.setProperty('--warning-light', hexToRgba(template.warning, 0.1));
    document.documentElement.style.setProperty('--error', template.error);
    document.documentElement.style.setProperty('--error-light', hexToRgba(template.error, 0.1));
    document.documentElement.style.setProperty('--info', template.info);
    document.documentElement.style.setProperty('--info-light', hexToRgba(template.info, 0.1));
    
    // Update logo color to match accent
    document.documentElement.style.setProperty('--logo-color', template.accent);
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon && !logoIcon.querySelector('img')) {
        logoIcon.style.color = template.accent;
    }
    
    // Update gradient based on template colors
    const gradientEnd = adjustColorBrightness(template.accent, -10);
    const gradient = `linear-gradient(135deg, ${template.primary} 0%, ${gradientEnd} 100%)`;
    document.documentElement.style.setProperty('--gradient-primary', gradient);
    
    // Update input fields if they exist
    const primaryColorInput = document.getElementById('primaryColorInput');
    const primaryColorText = document.getElementById('primaryColorText');
    if (primaryColorInput) primaryColorInput.value = template.primary;
    if (primaryColorText) primaryColorText.value = template.primary;
    
    const accentColorInput = document.getElementById('accentColorInput');
    const accentColorText = document.getElementById('accentColorText');
    if (accentColorInput) accentColorInput.value = template.accent;
    if (accentColorText) accentColorText.value = template.accent;
    
    const accentHoverInput = document.getElementById('accentHoverInput');
    const accentHoverText = document.getElementById('accentHoverText');
    if (accentHoverInput) accentHoverInput.value = template.accentHover;
    if (accentHoverText) accentHoverText.value = template.accentHover;
    
    const successColorInput = document.getElementById('successColorInput');
    const successColorText = document.getElementById('successColorText');
    if (successColorInput) successColorInput.value = template.success;
    if (successColorText) successColorText.value = template.success;
    
    const warningColorInput = document.getElementById('warningColorInput');
    const warningColorText = document.getElementById('warningColorText');
    if (warningColorInput) warningColorInput.value = template.warning;
    if (warningColorText) warningColorText.value = template.warning;
    
    const errorColorInput = document.getElementById('errorColorInput');
    const errorColorText = document.getElementById('errorColorText');
    if (errorColorInput) errorColorInput.value = template.error;
    if (errorColorText) errorColorText.value = template.error;
    
    const infoColorInput = document.getElementById('infoColorInput');
    const infoColorText = document.getElementById('infoColorText');
    if (infoColorInput) infoColorInput.value = template.info;
    if (infoColorText) infoColorText.value = template.info;
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setupColorInputListeners() {
    // Helper function to setup color input pair
    const setupColorInput = (colorInputId, colorTextId, cssVar) => {
        const colorInput = document.getElementById(colorInputId);
        const colorText = document.getElementById(colorTextId);
        if (colorInput && colorText) {
            colorInput.addEventListener('input', (e) => {
                colorText.value = e.target.value;
                document.documentElement.style.setProperty(cssVar, e.target.value);
                if (cssVar === '--accent') {
                    document.documentElement.style.setProperty('--accent-light', hexToRgba(e.target.value, 0.1));
                }
            });
            colorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    colorInput.value = e.target.value;
                    document.documentElement.style.setProperty(cssVar, e.target.value);
                    if (cssVar === '--accent') {
                        document.documentElement.style.setProperty('--accent-light', hexToRgba(e.target.value, 0.1));
                    }
                }
            });
        }
    };
    
    setupColorInput('primaryColorInput', 'primaryColorText', '--accent');
    setupColorInput('accentColorInput', 'accentColorText', '--accent');
    setupColorInput('accentHoverInput', 'accentHoverText', '--accent-hover');
    setupColorInput('successColorInput', 'successColorText', '--success');
    setupColorInput('warningColorInput', 'warningColorText', '--warning');
    setupColorInput('errorColorInput', 'errorColorText', '--error');
    setupColorInput('infoColorInput', 'infoColorText', '--info');
    setupColorInput('backgroundColorInput', 'backgroundColorText', '--bg-primary');
    setupColorInput('navColorInput', 'navColorText', '--bg-secondary');
    setupColorInput('textColorInput', 'textColorText', '--text-primary');
    setupColorInput('textSecondaryColorInput', 'textSecondaryColorText', '--text-secondary');
    setupColorInput('textTertiaryColorInput', 'textTertiaryColorText', '--text-tertiary');
    setupColorInput('logoColorInput', 'logoColorText', '--logo-color');
    setupColorInput('logoTextColorInput', 'logoTextColorText', '--logo-text-color');
    setupColorInput('bgTertiaryColorInput', 'bgTertiaryColorText', '--bg-tertiary');
    setupColorInput('bgCardColorInput', 'bgCardColorText', '--bg-card');
    setupColorInput('bgHoverColorInput', 'bgHoverColorText', '--bg-hover');
    
    // Setup gradient update when primary/accent colors change
    const updateGradient = () => {
        const primaryColor = document.getElementById('primaryColorInput')?.value || document.getElementById('accentColorInput')?.value || '#6366f1';
        const accentColor = document.getElementById('accentColorInput')?.value || primaryColor;
        
        // Create a gradient from primary to a slightly shifted accent
        // Shift the accent color towards purple/blue for a nice gradient
        const gradientEnd = adjustColorBrightness(accentColor, -10);
        const gradient = `linear-gradient(135deg, ${primaryColor} 0%, ${gradientEnd} 100%)`;
        document.documentElement.style.setProperty('--gradient-primary', gradient);
    };
    
    // Update gradient when primary or accent colors change
    const primaryInput = document.getElementById('primaryColorInput');
    const accentInput = document.getElementById('accentColorInput');
    if (primaryInput) {
        primaryInput.addEventListener('input', updateGradient);
    }
    if (accentInput) {
        accentInput.addEventListener('input', updateGradient);
    }
}

function adjustColorBrightness(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Adjust brightness
    const newR = Math.max(0, Math.min(255, r + percent));
    const newG = Math.max(0, Math.min(255, g + percent));
    const newB = Math.max(0, Math.min(255, b + percent));
    
    // Convert back to hex
    return '#' + [newR, newG, newB].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function setupSettingsListeners() {
    // Customization save button
    const saveCustomizationBtn = document.getElementById('saveCustomizationBtn');
    if (saveCustomizationBtn) {
        saveCustomizationBtn.addEventListener('click', saveCustomization);
    }
    
    // Customization reset button
    const resetCustomizationBtn = document.getElementById('resetCustomizationBtn');
    if (resetCustomizationBtn) {
        resetCustomizationBtn.addEventListener('click', resetCustomization);
    }
    
    // Clear logs button
    const clearAllLogsBtn = document.getElementById('clearAllLogsBtn');
    if (clearAllLogsBtn) {
        clearAllLogsBtn.addEventListener('click', handleClearAllLogs);
    }
    
    // Refresh login history button
    const refreshLoginHistoryBtn = document.getElementById('refreshLoginHistoryBtn');
    if (refreshLoginHistoryBtn) {
        refreshLoginHistoryBtn.addEventListener('click', fetchLoginHistory);
    }
    
    // Setup color input listeners
    setupColorInputListeners();
    
    // Brand name and subtitle inputs
    const brandNameInput = document.getElementById('brandNameInput');
    const brandSubtitleInput = document.getElementById('brandSubtitleInput');
    if (brandNameInput) {
        brandNameInput.addEventListener('input', (e) => {
            applyBrandingToSidebar(e.target.value, brandSubtitleInput?.value);
        });
    }
    if (brandSubtitleInput) {
        brandSubtitleInput.addEventListener('input', (e) => {
            applyBrandingToSidebar(brandNameInput?.value, e.target.value);
        });
    }
    
    // Show branding toggle
    const showBrandingToggle = document.getElementById('showBrandingToggle');
    if (showBrandingToggle) {
        showBrandingToggle.addEventListener('change', (e) => {
            applyShowBranding(e.target.checked);
        });
    }
    
    // Logo upload
    const logoFileInput = document.getElementById('logoFileInput');
    const logoUploadBtn = document.getElementById('logoUploadBtn');
    const logoRemoveBtn = document.getElementById('logoRemoveBtn');
    
    if (logoUploadBtn && logoFileInput) {
        logoUploadBtn.addEventListener('click', () => logoFileInput.click());
        logoFileInput.addEventListener('change', handleLogoUpload);
    }
    
    if (logoRemoveBtn) {
        logoRemoveBtn.addEventListener('click', removeLogo);
    }
    
    // Favicon upload
    const faviconFileInput = document.getElementById('faviconFileInput');
    const faviconUploadBtn = document.getElementById('faviconUploadBtn');
    const faviconRemoveBtn = document.getElementById('faviconRemoveBtn');
    
    if (faviconUploadBtn && faviconFileInput) {
        faviconUploadBtn.addEventListener('click', () => faviconFileInput.click());
        faviconFileInput.addEventListener('change', handleFaviconUpload);
    }
    
    if (faviconRemoveBtn) {
        faviconRemoveBtn.addEventListener('click', removeFavicon);
    }
}

function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a PNG, JPEG, SVG, GIF, or WebP image.');
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
        const logoPreviewImg = document.getElementById('logoPreviewImg');
        const logoPlaceholder = document.getElementById('logoPlaceholder');
        const logoRemoveBtn = document.getElementById('logoRemoveBtn');
        
        if (logoPreviewImg) {
            logoPreviewImg.src = event.target.result;
            logoPreviewImg.style.display = 'block';
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
            if (logoRemoveBtn) logoRemoveBtn.style.display = 'inline-flex';
        }
    };
    reader.readAsDataURL(file);
    
    // Upload to server
    const formData = new FormData();
    formData.append('logo', file);
    
    apiFetch(`${API_BASE}/api/customization/logo`, {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.path) {
            // Update preview with server path
            const logoPreviewImg = document.getElementById('logoPreviewImg');
            if (logoPreviewImg) {
                logoPreviewImg.src = data.path;
            }
            updatePreview();
            applyLogoToSidebar(data.path);
            // Save customization to update config
            saveCustomization();
        }
    })
    .catch(err => {
        console.error('Error uploading logo:', err);
        alert('Error uploading logo');
    });
}

function handleFaviconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a PNG, ICO, or SVG image.');
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
        const faviconPreviewImg = document.getElementById('faviconPreviewImg');
        const faviconPlaceholder = document.getElementById('faviconPlaceholder');
        const faviconRemoveBtn = document.getElementById('faviconRemoveBtn');
        
        if (faviconPreviewImg) {
            faviconPreviewImg.src = event.target.result;
            faviconPreviewImg.style.display = 'block';
            if (faviconPlaceholder) faviconPlaceholder.style.display = 'none';
            if (faviconRemoveBtn) faviconRemoveBtn.style.display = 'inline-flex';
        }
    };
    reader.readAsDataURL(file);
    
    // Upload to server
    const formData = new FormData();
    formData.append('favicon', file);
    
    apiFetch(`${API_BASE}/api/customization/favicon`, {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.path) {
            // Update preview with server path
            const faviconPreviewImg = document.getElementById('faviconPreviewImg');
            if (faviconPreviewImg) {
                faviconPreviewImg.src = data.path;
            }
            applyFavicon(data.path);
            // Save customization to update config
            saveCustomization();
        }
    })
    .catch(err => {
        console.error('Error uploading favicon:', err);
        alert('Error uploading favicon');
    });
}

function removeLogo() {
    if (!confirm('Remove the custom logo?')) return;
    
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    const logoPlaceholder = document.getElementById('logoPlaceholder');
    const logoRemoveBtn = document.getElementById('logoRemoveBtn');
    
    if (logoPreviewImg) logoPreviewImg.style.display = 'none';
    if (logoPlaceholder) logoPlaceholder.style.display = 'block';
    if (logoRemoveBtn) logoRemoveBtn.style.display = 'none';
    
    // Reset sidebar logo
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) {
        logoIcon.innerHTML = `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
    
    // Clear from config
    apiFetch(`${API_BASE}/api/customization`)
        .then(res => res.json())
        .then(data => {
            if (data) {
                data.brand_logo = '';
                return apiFetch(`${API_BASE}/api/customization`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
        })
        .catch(err => console.error('Error removing logo:', err));
}

function removeFavicon() {
    if (!confirm('Remove the custom favicon?')) return;
    
    const faviconPreviewImg = document.getElementById('faviconPreviewImg');
    const faviconPlaceholder = document.getElementById('faviconPlaceholder');
    const faviconRemoveBtn = document.getElementById('faviconRemoveBtn');
    
    if (faviconPreviewImg) faviconPreviewImg.style.display = 'none';
    if (faviconPlaceholder) faviconPlaceholder.style.display = 'block';
    if (faviconRemoveBtn) faviconRemoveBtn.style.display = 'none';
    
    // Clear from config
    apiFetch(`${API_BASE}/api/customization`)
        .then(res => res.json())
        .then(data => {
            if (data) {
                data.favicon = '';
                return apiFetch(`${API_BASE}/api/customization`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
        })
        .catch(err => console.error('Error removing favicon:', err));
}

function saveCustomization() {
    // Get existing customization to preserve logo/favicon
    apiFetch(`${API_BASE}/api/customization`)
        .then(res => res.json())
        .then(existing => {
            // Get selected template
            const activeTemplate = document.querySelector('.color-template-item.active');
            const templateKey = activeTemplate ? activeTemplate.dataset.template : 'default';
            
            const customization = {
                color_scheme: templateKey,
                primary_color: document.getElementById('primaryColorInput')?.value || '#6366f1',
                accent_color: document.getElementById('accentColorInput')?.value || '#6366f1',
                accent_hover: document.getElementById('accentHoverInput')?.value || '#4f46e5',
                success_color: document.getElementById('successColorInput')?.value || '#10b981',
                warning_color: document.getElementById('warningColorInput')?.value || '#f59e0b',
                error_color: document.getElementById('errorColorInput')?.value || '#ef4444',
                info_color: document.getElementById('infoColorInput')?.value || '#3b82f6',
                background_color: document.getElementById('backgroundColorInput')?.value || '#0a0d14',
                nav_color: document.getElementById('navColorInput')?.value || '#131720',
                text_color: document.getElementById('textColorInput')?.value || '#f0f2f5',
                text_secondary_color: document.getElementById('textSecondaryColorInput')?.value || '#8b92a7',
                text_tertiary_color: document.getElementById('textTertiaryColorInput')?.value || '#6b7280',
                logo_color: document.getElementById('logoColorInput')?.value || '#6366f1',
                logo_text_color: document.getElementById('logoTextColorInput')?.value || '#f0f2f5',
                bg_tertiary_color: document.getElementById('bgTertiaryColorInput')?.value || '#1a1f2e',
                bg_card_color: document.getElementById('bgCardColorInput')?.value || '#1e2432',
                bg_hover_color: document.getElementById('bgHoverColorInput')?.value || '#252b3b',
                brand_name: document.getElementById('brandNameInput')?.value || 'qLog',
                brand_subtitle: document.getElementById('brandSubtitleInput')?.value || 'Syslog Server',
                show_branding: document.getElementById('showBrandingToggle')?.checked !== false
            };
            
            // Preserve logo and favicon if they exist
            if (existing && existing.brand_logo) {
                customization.brand_logo = existing.brand_logo;
            }
            if (existing && existing.favicon) {
                customization.favicon = existing.favicon;
            }
            
            return fetch(`${API_BASE}/api/customization`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customization)
            });
        })
        .then(res => res.json())
        .then(data => {
            console.log('Customization saved:', data);
            applyCustomization(data);
            
            // Apply branding to sidebar
            applyBrandingToSidebar(data.brand_name, data.brand_subtitle);
            
            // Apply show branding
            if (data.show_branding !== undefined) {
                applyShowBranding(data.show_branding);
            }
            
            if (data.brand_logo) {
                applyLogoToSidebar(data.brand_logo);
            }
            if (data.favicon) {
                applyFavicon(data.favicon);
            }
            
            alert('Customization saved successfully!');
        })
        .catch(err => {
            console.error('Error saving customization:', err);
            alert('Error saving customization');
        });
}

function resetCustomization() {
    if (confirm('Reset all customization settings to defaults?')) {
        const defaultTemplate = COLOR_TEMPLATES.default;
        const customization = {
            color_scheme: 'default',
            primary_color: defaultTemplate.primary,
            accent_color: defaultTemplate.accent,
            accent_hover: defaultTemplate.accentHover,
            success_color: defaultTemplate.success,
            warning_color: defaultTemplate.warning,
            error_color: defaultTemplate.error,
            info_color: defaultTemplate.info,
            background_color: '#0a0d14',
            nav_color: '#131720',
            bg_tertiary_color: '#1a1f2e',
            bg_card_color: '#1e2432',
            bg_hover_color: '#252b3b',
            text_color: '#f0f2f5',
            text_secondary_color: '#8b92a7',
            text_tertiary_color: '#6b7280',
            logo_color: defaultTemplate.accent,
            logo_text_color: '#f0f2f5',
            brand_name: 'qLog',
            brand_subtitle: 'Syslog Server',
            brand_logo: '',
            favicon: '',
            show_branding: true
        };
        
        apiFetch(`${API_BASE}/api/customization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customization)
        })
        .then(res => res.json())
        .then(data => {
            applyCustomization(data);
            
            // Reset logo preview
            const logoPreviewImg = document.getElementById('logoPreviewImg');
            const logoPlaceholder = document.getElementById('logoPlaceholder');
            const logoRemoveBtn = document.getElementById('logoRemoveBtn');
            if (logoPreviewImg) logoPreviewImg.style.display = 'none';
            if (logoPlaceholder) logoPlaceholder.style.display = 'block';
            if (logoRemoveBtn) logoRemoveBtn.style.display = 'none';
            
            // Reset favicon preview
            const faviconPreviewImg = document.getElementById('faviconPreviewImg');
            const faviconPlaceholder = document.getElementById('faviconPlaceholder');
            const faviconRemoveBtn = document.getElementById('faviconRemoveBtn');
            if (faviconPreviewImg) faviconPreviewImg.style.display = 'none';
            if (faviconPlaceholder) faviconPlaceholder.style.display = 'block';
            if (faviconRemoveBtn) faviconRemoveBtn.style.display = 'none';
            
            // Reset sidebar logo
            const logoIcon = document.querySelector('.logo-icon');
            if (logoIcon) {
                logoIcon.innerHTML = `
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
            }
            
            // Reset sidebar text
            const logoPrimary = document.querySelector('.logo-primary');
            const logoSubtitle = document.querySelector('.logo-subtitle');
            if (logoPrimary) logoPrimary.textContent = 'qLog';
            if (logoSubtitle) logoSubtitle.textContent = 'Syslog Server';
            
            updatePreview();
            alert('Customization reset to defaults!');
        })
        .catch(err => {
            console.error('Error resetting customization:', err);
            alert('Error resetting customization');
        });
    }
}

function fetchSeverityOverrides() {
    apiFetch(`${API_BASE}/api/severity-overrides`)
        .then(res => res.json())
        .then(data => {
            renderSeverityOverrides(data || {});
        })
        .catch(err => console.error('Error fetching severity overrides:', err));
}

function renderSeverityOverrides(overrides) {
    const container = document.getElementById('severityOverridesList');
    if (!container) return;
    
    if (Object.keys(overrides).length === 0) {
        container.innerHTML = '<div class="empty-state">No severity overrides configured</div>';
        return;
    }
    
    container.innerHTML = Object.entries(overrides).map(([eventType, severity]) => `
        <div class="severity-override-item">
            <span>${eventType}</span>
            <span>${getSeverityName(severity)}</span>
            <button onclick="deleteSeverityOverride('${eventType}')">Delete</button>
        </div>
    `).join('');
}

function handleClearAllLogs() {
    if (!confirm('Are you sure you want to delete ALL logs? This action cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will permanently delete all log entries. Are you absolutely sure?')) {
        return;
    }
    
    apiFetch(`${API_BASE}/api/clear-logs`, {
        method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
        alert('All logs have been cleared.');
        if (currentView === 'logs') {
            fetchLogs();
        } else if (currentView === 'dashboard') {
            fetchDashboard();
        }
    })
    .catch(err => {
        console.error('Error clearing logs:', err);
        alert('Error clearing logs');
    });
}

function deleteSeverityOverride(eventType) {
    apiFetch(`${API_BASE}/api/severity-overrides/${encodeURIComponent(eventType)}`, {
        method: 'DELETE'
    })
    .then(() => {
        fetchSeverityOverrides();
    })
    .catch(err => {
        console.error('Error deleting severity override:', err);
    });
}

// Login History Management
async function fetchLoginHistory() {
    const table = document.getElementById('loginHistoryTable');
    if (table) {
        table.innerHTML = `
            <div class="login-history-loading" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 12px; display: block;"></i>
                Loading login history...
            </div>
        `;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/api/auth/login-history?limit=100`);
        if (!response.ok) {
            throw new Error('Failed to fetch login history');
        }
        const data = await response.json();
        renderLoginHistory(data.attempts || []);
    } catch (error) {
        console.error('Error fetching login history:', error);
        if (table) {
            table.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--error);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 12px; display: block;"></i>
                    <p>Failed to load login history. Please try again.</p>
                </div>
            `;
        }
    }
}

function renderLoginHistory(attempts) {
    const table = document.getElementById('loginHistoryTable');
    if (!table) return;

    if (attempts.length === 0) {
        table.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-history" style="font-size: 24px; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
                <p>No login attempts recorded yet.</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table class="login-history-table-content">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Username</th>
                    <th>IP Address</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${attempts.map(attempt => {
                    const date = new Date(attempt.created_at);
                    const formattedDate = date.toLocaleString();
                    const statusClass = attempt.success ? 'login-success' : 'login-failed';
                    const statusIcon = attempt.success ? 'fa-check-circle' : 'fa-times-circle';
                    const statusText = attempt.success ? 'Success' : 'Failed';
                    
                    return `
                        <tr>
                            <td>${formattedDate}</td>
                            <td>${escapeHtml(attempt.username || '-')}</td>
                            <td><code style="font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace; font-size: 12px; background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px;">${escapeHtml(attempt.ip_address || '-')}</code></td>
                            <td>
                                <span class="login-status-badge ${statusClass}">
                                    <i class="fas ${statusIcon}"></i>
                                    ${statusText}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    table.innerHTML = tableHTML;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

