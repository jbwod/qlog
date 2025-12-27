// Custom Dropdown Component
// Replaces native select elements with styled custom dropdowns

class CustomDropdown {
    constructor(selectElement, options = {}) {
        this.selectElement = selectElement;
        this.options = {
            searchable: options.searchable || false,
            placeholder: options.placeholder || 'Select...',
            onSelect: options.onSelect || null,
            multiple: selectElement.hasAttribute('multiple') || options.multiple || false,
            ...options
        };
        
        this.isOpen = false;
        this.multiple = this.options.multiple;
        if (this.multiple) {
            this.selectedValues = Array.from(selectElement.selectedOptions).map(opt => opt.value);
            this.selectedText = this.getSelectedText();
        } else {
            this.selectedValue = selectElement.value;
            this.selectedText = this.getSelectedText();
        }
        
        this.init();
    }
    
    init() {
        if (!this.selectElement) return;
        
        // Check if custom dropdown already exists for this select
        const existingWrapper = this.selectElement.parentNode?.querySelector(`[data-dropdown-id="${this.selectElement.id || ''}"]`);
        if (existingWrapper) {
            // Already initialized, don't create duplicate
            return;
        }
        
        // Hide original select completely but keep in DOM for form submission
        this.selectElement.style.position = 'absolute';
        this.selectElement.style.left = '-9999px';
        this.selectElement.style.opacity = '0';
        this.selectElement.style.width = '1px';
        this.selectElement.style.height = '1px';
        this.selectElement.style.overflow = 'hidden';
        this.selectElement.style.pointerEvents = 'none';
        
        // Create custom dropdown
        this.createDropdown();
        
        // Populate options
        this.populateOptions();
        
        // Setup event listeners
        this.setupListeners();
    }
    
    createDropdown() {
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-dropdown-wrapper';
        wrapper.dataset.dropdownId = this.selectElement.id || `dropdown-${Date.now()}`;
        
        const button = document.createElement('button');
        button.className = 'custom-dropdown-button';
        button.type = 'button';
        button.innerHTML = `
            <span class="custom-dropdown-text">${this.selectedText || this.options.placeholder}</span>
            <svg class="custom-dropdown-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-dropdown-menu';
        dropdown.style.display = 'none';
        
        if (this.options.searchable) {
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'custom-dropdown-search';
            searchInput.placeholder = 'Search...';
            dropdown.appendChild(searchInput);
            this.searchInput = searchInput;
        }
        
        const optionsList = document.createElement('div');
        optionsList.className = 'custom-dropdown-options';
        dropdown.appendChild(optionsList);
        this.optionsList = optionsList;
        
        wrapper.appendChild(button);
        wrapper.appendChild(dropdown);
        
        this.button = button;
        this.dropdown = dropdown;
        this.wrapper = wrapper;
        
        // Initialize multiple mode on select element
        if (this.multiple) {
            this.selectElement.multiple = true;
        }
        
        // Replace select element visually by inserting wrapper right after it
        // The select element is hidden but kept in DOM for form submission
        const parent = this.selectElement.parentNode;
        if (parent) {
            parent.insertBefore(wrapper, this.selectElement.nextSibling);
        }
    }
    
    populateOptions() {
        if (!this.optionsList || !this.selectElement) return;
        
        this.optionsList.innerHTML = '';
        
        try {
            const options = Array.from(this.selectElement.options || []);
            const optgroups = Array.from(this.selectElement.querySelectorAll('optgroup') || []);
            
            // Handle optgroups
            if (optgroups.length > 0) {
                optgroups.forEach(optgroup => {
                    if (!optgroup) return;
                    
                    // Safely get options from optgroup
                    // Try multiple methods to get options from optgroup
                    let groupOptions = [];
                    if (optgroup.options && optgroup.options.length > 0) {
                        groupOptions = Array.from(optgroup.options);
                    } else if (optgroup.children && optgroup.children.length > 0) {
                        // Fallback: get direct children
                        groupOptions = Array.from(optgroup.children).filter(child => child.tagName === 'OPTION');
                    } else {
                        // Last resort: querySelectorAll
                        groupOptions = Array.from(optgroup.querySelectorAll('option'));
                    }
                    
                    // Only show optgroup if it has non-disabled options (actual selectable items)
                    const selectableOptions = groupOptions.filter(opt => opt && opt.tagName === 'OPTION' && !opt.disabled);
                    
                    if (selectableOptions.length === 0) {
                        // Skip this optgroup if it has no selectable options
                        return;
                    }
                    
                    // Add group label if there are selectable options
                    const groupLabel = document.createElement('div');
                    groupLabel.className = 'custom-dropdown-group-label';
                    groupLabel.textContent = optgroup.label || '';
                    this.optionsList.appendChild(groupLabel);
                    
                    // Track current category and whether it has items
                    let currentCategoryLabel = null;
                    let categoryHasItems = false;
                    
                    groupOptions.forEach((option, index) => {
                        if (option && option.tagName === 'OPTION') {
                            // Handle disabled options (category labels) differently
                            if (option.disabled) {
                                // Check if previous category had items, if not, don't show it
                                if (currentCategoryLabel && !categoryHasItems) {
                                    // Remove the empty category label
                                    const lastChild = this.optionsList.lastChild;
                                    if (lastChild && lastChild.className === 'custom-dropdown-category-label') {
                                        this.optionsList.removeChild(lastChild);
                                    }
                                }
                                
                                // Check if this category will have items (look ahead)
                                const remainingOptions = groupOptions.slice(index + 1);
                                const hasItemsAfter = remainingOptions.some(opt => 
                                    opt && opt.tagName === 'OPTION' && !opt.disabled
                                );
                                
                                if (hasItemsAfter) {
                                    // Store category label to add later
                                    currentCategoryLabel = option.textContent || option.text || '';
                                    categoryHasItems = false;
                                } else {
                                    // Skip this category label if no items follow
                                    currentCategoryLabel = null;
                                    categoryHasItems = false;
                                }
                            } else {
                                // If we have a pending category label, add it now
                                if (currentCategoryLabel && !categoryHasItems) {
                                    const labelElement = document.createElement('div');
                                    labelElement.className = 'custom-dropdown-category-label';
                                    labelElement.textContent = currentCategoryLabel.trim();
                                    labelElement.style.pointerEvents = 'none';
                                    labelElement.style.cursor = 'default';
                                    this.optionsList.appendChild(labelElement);
                                    categoryHasItems = true;
                                }
                                
                                const optionElement = this.createOptionElement(option);
                                this.optionsList.appendChild(optionElement);
                                categoryHasItems = true;
                            }
                        }
                    });
                    
                    // Clean up any trailing empty category label
                    if (currentCategoryLabel && !categoryHasItems) {
                        const lastChild = this.optionsList.lastChild;
                        if (lastChild && lastChild.className === 'custom-dropdown-category-label') {
                            this.optionsList.removeChild(lastChild);
                        }
                    }
                });
            } else {
                // Regular options
                options.forEach(option => {
                    if (option) {
                        const optionElement = this.createOptionElement(option);
                        this.optionsList.appendChild(optionElement);
                    }
                });
            }
            
            this.filteredOptions = options;
        } catch (err) {
            console.error('Error populating dropdown options:', err);
        }
    }
    
    createOptionElement(option) {
        const optionElement = document.createElement('div');
        optionElement.className = 'custom-dropdown-option';
        optionElement.dataset.value = option.value;
        
        if (this.multiple) {
            // Add checkbox for multiple mode
            const checkbox = document.createElement('span');
            checkbox.className = 'custom-dropdown-checkbox';
            checkbox.innerHTML = '<i class="fas fa-check"></i>';
            optionElement.appendChild(checkbox);
            
            const textSpan = document.createElement('span');
            textSpan.textContent = option.text || option.textContent || '';
            optionElement.appendChild(textSpan);
            
            if (this.selectedValues.includes(option.value)) {
                optionElement.classList.add('selected');
            }
        } else {
            optionElement.textContent = option.text || option.textContent || '';
            if (option.value === this.selectedValue) {
                optionElement.classList.add('selected');
            }
        }
        
        optionElement.addEventListener('click', () => {
            this.selectOption(option.value, option.text);
        });
        
        return optionElement;
    }
    
    setupListeners() {
        // Toggle dropdown
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });
        
        // Keyboard navigation
        this.button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.open();
                this.highlightNext();
            }
        });
        
        // Search functionality
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterOptions(e.target.value);
            });
            
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.highlightNext();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.highlightPrev();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const highlighted = this.optionsList.querySelector('.highlighted');
                    if (highlighted) {
                        highlighted.click();
                    }
                }
            });
        }
        
        // Keyboard navigation in dropdown
        this.dropdown.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightNext();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.highlightPrev();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const highlighted = this.optionsList.querySelector('.highlighted');
                if (highlighted) {
                    highlighted.click();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            }
        });
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.dropdown.style.display = 'block';
        this.button.classList.add('open');
        
        // Focus search input if available
        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 10);
        }
        
        // Scroll to first selected option (for single mode)
        if (!this.multiple) {
            const selected = this.optionsList.querySelector('.selected');
            if (selected) {
                selected.scrollIntoView({ block: 'nearest' });
            }
        }
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.dropdown.style.display = 'none';
        this.button.classList.remove('open');
        
        // Clear search
        if (this.searchInput) {
            this.searchInput.value = '';
            this.filterOptions('');
        }
    }
    
    selectOption(value, text) {
        if (this.multiple) {
            // Toggle selection for multiple mode
            const index = this.selectedValues.indexOf(value);
            if (index > -1) {
                // Deselect
                this.selectedValues.splice(index, 1);
                // Update select element
                const option = this.selectElement.querySelector(`option[value="${value}"]`);
                if (option) option.selected = false;
            } else {
                // Select
                this.selectedValues.push(value);
                // Update select element
                const option = this.selectElement.querySelector(`option[value="${value}"]`);
                if (option) option.selected = true;
            }
            
            // Update selected state in options
            const optionElement = this.optionsList.querySelector(`[data-value="${value}"]`);
            if (optionElement) {
                optionElement.classList.toggle('selected');
            }
            
            // Update button text
            this.selectedText = this.getSelectedText();
            const textSpan = this.button.querySelector('.custom-dropdown-text');
            if (textSpan) {
                textSpan.textContent = this.selectedText || this.options.placeholder;
            }
            
            // Dispatch change event
            this.selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Call custom callback
            if (this.options.onSelect) {
                this.options.onSelect(this.selectedValues, this.getSelectedText());
            }
            
            // Don't close dropdown in multiple mode
        } else {
            // Single selection mode
            this.selectedValue = value;
            this.selectedText = text;
            
            // Update select element
            this.selectElement.value = value;
            this.selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Update button text
            const textSpan = this.button.querySelector('.custom-dropdown-text');
            if (textSpan) {
                textSpan.textContent = text || this.options.placeholder;
            }
            
            // Update selected state in options
            this.optionsList.querySelectorAll('.custom-dropdown-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.value === value) {
                    opt.classList.add('selected');
                }
            });
            
            // Call custom callback
            if (this.options.onSelect) {
                this.options.onSelect(value, text);
            }
            
            this.close();
        }
    }
    
    getSelectedText() {
        if (this.multiple) {
            const selectedOptions = Array.from(this.selectElement.selectedOptions);
            if (selectedOptions.length === 0) {
                return '';
            } else if (selectedOptions.length === 1) {
                return selectedOptions[0].text;
            } else {
                return `${selectedOptions.length} selected`;
            }
        } else {
            const selectedOption = this.selectElement.options[this.selectElement.selectedIndex];
            return selectedOption ? selectedOption.text : '';
        }
    }
    
    filterOptions(query) {
        const queryLower = query.toLowerCase();
        const options = this.optionsList.querySelectorAll('.custom-dropdown-option');
        const groupLabels = this.optionsList.querySelectorAll('.custom-dropdown-group-label');
        
        let hasVisibleOptions = false;
        
        // Filter options
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            if (text.includes(queryLower)) {
                option.style.display = 'block';
                hasVisibleOptions = true;
            } else {
                option.style.display = 'none';
            }
        });
        
        // Hide/show group labels based on visible options
        groupLabels.forEach(label => {
            const group = label.nextElementSibling;
            let groupHasVisible = false;
            let current = label.nextElementSibling;
            
            // Check if any option in this group is visible
            while (current && current.classList.contains('custom-dropdown-option')) {
                if (current.style.display !== 'none') {
                    groupHasVisible = true;
                    break;
                }
                current = current.nextElementSibling;
            }
            
            // Check all options until next group label or end
            let next = label.nextElementSibling;
            while (next && !next.classList.contains('custom-dropdown-group-label')) {
                if (next.classList.contains('custom-dropdown-option') && next.style.display !== 'none') {
                    groupHasVisible = true;
                    break;
                }
                next = next.nextElementSibling;
            }
            
            label.style.display = groupHasVisible ? 'block' : 'none';
        });
    }
    
    highlightNext() {
        const options = Array.from(this.optionsList.querySelectorAll('.custom-dropdown-option:not([style*="display: none"])'));
        const currentIndex = options.findIndex(opt => opt.classList.contains('highlighted'));
        
        options.forEach(opt => opt.classList.remove('highlighted'));
        
        const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        if (options[nextIndex]) {
            options[nextIndex].classList.add('highlighted');
            options[nextIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    highlightPrev() {
        const options = Array.from(this.optionsList.querySelectorAll('.custom-dropdown-option:not([style*="display: none"])'));
        const currentIndex = options.findIndex(opt => opt.classList.contains('highlighted'));
        
        options.forEach(opt => opt.classList.remove('highlighted'));
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        if (options[prevIndex]) {
            options[prevIndex].classList.add('highlighted');
            options[prevIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    getValue() {
        return this.selectedValue;
    }
    
    setValue(value) {
        const option = this.selectElement.querySelector(`option[value="${value}"]`);
        if (option) {
            this.selectOption(value, option.text);
        }
    }
}

// Initialize custom dropdowns for all enhanced selects
function initCustomDropdowns() {
    document.querySelectorAll('.enhanced-select').forEach(select => {
        if (!select.dataset.customDropdown) {
            const dropdown = new CustomDropdown(select, {
                searchable: select.dataset.searchable === 'true',
                placeholder: select.dataset.placeholder || 'Select...'
            });
            select.dataset.customDropdown = 'true';
            select.customDropdown = dropdown;
        }
    });
}

// Export for use in other modules
window.CustomDropdown = CustomDropdown;
window.initCustomDropdowns = initCustomDropdowns;

