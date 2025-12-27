// Calendar Date Picker Component
// Provides a visual calendar for date range selection

class CalendarPicker {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            mode: options.mode || 'range', // 'single' or 'range'
            showTime: options.showTime !== false, // Show time pickers
            minDate: options.minDate || null,
            maxDate: options.maxDate || null,
            onSelect: options.onSelect || null,
            initialStartDate: options.initialStartDate || null,
            initialEndDate: options.initialEndDate || null,
            ...options
        };
        
        this.startDate = this.options.initialStartDate ? new Date(this.options.initialStartDate) : null;
        this.endDate = this.options.initialEndDate ? new Date(this.options.initialEndDate) : null;
        this.currentMonth = new Date();
        this.selectingStart = true;
        this.hoverDate = null;
        
        this.render();
        this.attachEvents();
    }
    
    render() {
        this.container.innerHTML = '';
        this.container.className = 'calendar-picker';
        
        // Quick presets
        const presets = this.createPresets();
        this.container.appendChild(presets);
        
        // Calendar container
        const calendarContainer = document.createElement('div');
        calendarContainer.className = 'calendar-container';
        
        // Calendar header with month/year navigation
        const header = this.createHeader();
        calendarContainer.appendChild(header);
        
        // Calendar grid
        const grid = this.createGrid();
        calendarContainer.appendChild(grid);
        
        // Time pickers (if enabled)
        if (this.options.showTime) {
            const timePickers = this.createTimePickers();
            calendarContainer.appendChild(timePickers);
        }
        
        // Action buttons
        const actions = this.createActions();
        calendarContainer.appendChild(actions);
        
        this.container.appendChild(calendarContainer);
    }
    
    createPresets() {
        const presets = document.createElement('div');
        presets.className = 'calendar-presets';
        
        const presetButtons = [
            { label: 'Today', action: () => this.setPreset('today') },
            { label: 'Yesterday', action: () => this.setPreset('yesterday') },
            { label: 'Last 7 Days', action: () => this.setPreset('7d') },
            { label: 'Last 30 Days', action: () => this.setPreset('30d') },
            { label: 'This Month', action: () => this.setPreset('thisMonth') },
            { label: 'Last Month', action: () => this.setPreset('lastMonth') },
            { label: 'This Year', action: () => this.setPreset('thisYear') },
        ];
        
        presetButtons.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'calendar-preset-btn';
            btn.textContent = preset.label;
            btn.addEventListener('click', preset.action);
            presets.appendChild(btn);
        });
        
        return presets;
    }
    
    createHeader() {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        
        // Previous month button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'calendar-nav-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.addEventListener('click', () => this.navigateMonth(-1));
        header.appendChild(prevBtn);
        
        // Month/Year display
        const monthYear = document.createElement('div');
        monthYear.className = 'calendar-month-year';
        this.monthYearElement = monthYear;
        this.updateMonthYear();
        header.appendChild(monthYear);
        
        // Next month button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'calendar-nav-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.addEventListener('click', () => this.navigateMonth(1));
        header.appendChild(nextBtn);
        
        return header;
    }
    
    createGrid() {
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        
        // Day names header
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });
        
        // Calendar cells
        this.calendarCells = [];
        const daysContainer = document.createElement('div');
        daysContainer.className = 'calendar-days';
        this.daysContainer = daysContainer;
        this.updateGrid();
        grid.appendChild(daysContainer);
        
        return grid;
    }
    
    createTimePickers() {
        const timeContainer = document.createElement('div');
        timeContainer.className = 'calendar-time-pickers';
        
        // Start time
        const startTimeGroup = document.createElement('div');
        startTimeGroup.className = 'calendar-time-group';
        const startLabel = document.createElement('label');
        startLabel.textContent = 'Start Time';
        startLabel.className = 'calendar-time-label';
        startTimeGroup.appendChild(startLabel);
        
        const startTimeInput = document.createElement('input');
        startTimeInput.type = 'time';
        startTimeInput.className = 'calendar-time-input';
        startTimeInput.value = this.startDate ? this.formatTime(this.startDate) : '00:00';
        this.startTimeInput = startTimeInput;
        startTimeGroup.appendChild(startTimeInput);
        timeContainer.appendChild(startTimeGroup);
        
        // End time
        const endTimeGroup = document.createElement('div');
        endTimeGroup.className = 'calendar-time-group';
        const endLabel = document.createElement('label');
        endLabel.textContent = 'End Time';
        endLabel.className = 'calendar-time-label';
        endTimeGroup.appendChild(endLabel);
        
        const endTimeInput = document.createElement('input');
        endTimeInput.type = 'time';
        endTimeInput.className = 'calendar-time-input';
        endTimeInput.value = this.endDate ? this.formatTime(this.endDate) : '23:59';
        this.endTimeInput = endTimeInput;
        endTimeGroup.appendChild(endTimeInput);
        timeContainer.appendChild(endTimeGroup);
        
        return timeContainer;
    }
    
    createActions() {
        const actions = document.createElement('div');
        actions.className = 'calendar-actions';
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'calendar-action-btn calendar-clear-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', () => this.clear());
        actions.appendChild(clearBtn);
        
        const applyBtn = document.createElement('button');
        applyBtn.className = 'calendar-action-btn calendar-apply-btn';
        applyBtn.textContent = 'Apply';
        applyBtn.addEventListener('click', () => this.apply());
        actions.appendChild(applyBtn);
        
        return actions;
    }
    
    updateMonthYear() {
        if (this.monthYearElement) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
            const month = monthNames[this.currentMonth.getMonth()];
            const year = this.currentMonth.getFullYear();
            this.monthYearElement.textContent = `${month} ${year}`;
        }
    }
    
    updateGrid() {
        if (!this.daysContainer) return;
        
        this.daysContainer.innerHTML = '';
        this.calendarCells = [];
        
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        // First day of month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            this.daysContainer.appendChild(emptyCell);
        }
        
        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            cell.textContent = day;
            cell.dataset.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            const cellDate = new Date(year, month, day);
            this.updateCellStyle(cell, cellDate);
            
            // Use mousedown instead of click for better responsiveness
            cell.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectDate(cellDate);
            });
            
            cell.addEventListener('mouseenter', () => {
                this.hoverDate = cellDate;
                this.updateGrid();
            });
            
            this.calendarCells.push(cell);
            this.daysContainer.appendChild(cell);
        }
    }
    
    updateCellStyle(cell, date) {
        // Remove all state classes
        cell.classList.remove('selected', 'start', 'end', 'in-range', 'today', 'hover');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cellDate = new Date(date);
        cellDate.setHours(0, 0, 0, 0);
        
        // Today
        if (cellDate.getTime() === today.getTime()) {
            cell.classList.add('today');
        }
        
        // Selected dates
        if (this.startDate) {
            const start = new Date(this.startDate);
            start.setHours(0, 0, 0, 0);
            if (cellDate.getTime() === start.getTime()) {
                cell.classList.add('selected', 'start');
            }
        }
        
        if (this.endDate) {
            const end = new Date(this.endDate);
            end.setHours(0, 0, 0, 0);
            if (cellDate.getTime() === end.getTime()) {
                cell.classList.add('selected', 'end');
            }
        }
        
        // In range
        if (this.startDate && this.endDate) {
            const start = new Date(this.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(this.endDate);
            end.setHours(0, 0, 0, 0);
            
            if (cellDate > start && cellDate < end) {
                cell.classList.add('in-range');
            }
        }
        
        // Hover preview
        if (this.hoverDate && this.startDate && !this.endDate) {
            const hover = new Date(this.hoverDate);
            hover.setHours(0, 0, 0, 0);
            const start = new Date(this.startDate);
            start.setHours(0, 0, 0, 0);
            
            if (hover > start && cellDate > start && cellDate <= hover) {
                cell.classList.add('hover');
            } else if (hover < start && cellDate >= hover && cellDate < start) {
                cell.classList.add('hover');
            }
        }
    }
    
    navigateMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.updateMonthYear();
        this.updateGrid();
    }
    
    selectDate(date) {
        if (!this.startDate || (this.startDate && this.endDate)) {
            // Start new selection
            this.startDate = new Date(date);
            this.endDate = null;
            this.selectingStart = true;
        } else {
            // Complete selection
            if (date < this.startDate) {
                // Swap if end is before start
                this.endDate = new Date(this.startDate);
                this.startDate = new Date(date);
            } else {
                this.endDate = new Date(date);
            }
            this.selectingStart = false;
        }
        
        // Update time inputs if they exist
        if (this.startTimeInput && this.startDate) {
            this.startTimeInput.value = this.formatTime(this.startDate);
        }
        if (this.endTimeInput && this.endDate) {
            this.endTimeInput.value = this.formatTime(this.endDate);
        }
        
        this.updateGrid();
    }
    
    setPreset(preset) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (preset) {
            case 'today':
                this.startDate = new Date(today);
                this.endDate = new Date(today);
                this.endDate.setHours(23, 59, 59, 999);
                break;
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                this.startDate = new Date(yesterday);
                this.endDate = new Date(yesterday);
                this.endDate.setHours(23, 59, 59, 999);
                break;
            case '7d':
                this.startDate = new Date(today);
                this.startDate.setDate(this.startDate.getDate() - 7);
                this.endDate = new Date(today);
                this.endDate.setHours(23, 59, 59, 999);
                break;
            case '30d':
                this.startDate = new Date(today);
                this.startDate.setDate(this.startDate.getDate() - 30);
                this.endDate = new Date(today);
                this.endDate.setHours(23, 59, 59, 999);
                break;
            case 'thisMonth':
                this.startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                this.endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                this.endDate.setHours(23, 59, 59, 999);
                break;
            case 'lastMonth':
                this.startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                this.endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                this.endDate.setHours(23, 59, 59, 999);
                break;
            case 'thisYear':
                this.startDate = new Date(today.getFullYear(), 0, 1);
                this.endDate = new Date(today.getFullYear(), 11, 31);
                this.endDate.setHours(23, 59, 59, 999);
                break;
        }
        
        // Update current month to show start date
        if (this.startDate) {
            this.currentMonth = new Date(this.startDate);
        }
        
        // Update time inputs
        if (this.startTimeInput && this.startDate) {
            this.startTimeInput.value = this.formatTime(this.startDate);
        }
        if (this.endTimeInput && this.endDate) {
            this.endTimeInput.value = this.formatTime(this.endDate);
        }
        
        this.updateMonthYear();
        this.updateGrid();
    }
    
    clear() {
        this.startDate = null;
        this.endDate = null;
        this.updateGrid();
        
        if (this.startTimeInput) {
            this.startTimeInput.value = '00:00';
        }
        if (this.endTimeInput) {
            this.endTimeInput.value = '23:59';
        }
    }
    
    apply() {
        // Combine date and time
        let startDateTime = null;
        let endDateTime = null;
        
        if (this.startDate) {
            startDateTime = new Date(this.startDate);
            if (this.startTimeInput) {
                const [hours, minutes] = this.startTimeInput.value.split(':').map(Number);
                startDateTime.setHours(hours || 0, minutes || 0, 0, 0);
            } else {
                startDateTime.setHours(0, 0, 0, 0);
            }
        }
        
        if (this.endDate) {
            endDateTime = new Date(this.endDate);
            if (this.endTimeInput) {
                const [hours, minutes] = this.endTimeInput.value.split(':').map(Number);
                endDateTime.setHours(hours || 23, minutes || 59, 59, 999);
            } else {
                endDateTime.setHours(23, 59, 59, 999);
            }
        }
        
        // Format as ISO string for datetime-local inputs
        const formatForInput = (date) => {
            if (!date) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        if (this.options.onSelect) {
            this.options.onSelect({
                startDate: startDateTime,
                endDate: endDateTime,
                startDateString: formatForInput(startDateTime),
                endDateString: formatForInput(endDateTime)
            });
        }
    }
    
    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    attachEvents() {
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target) && !e.target.closest('.calendar-trigger')) {
                // Don't close if clicking the trigger button
            }
        });
    }
    
    // Public methods
    setDates(startDate, endDate) {
        if (startDate) {
            this.startDate = new Date(startDate);
        }
        if (endDate) {
            this.endDate = new Date(endDate);
        }
        if (this.startDate) {
            this.currentMonth = new Date(this.startDate);
        }
        this.updateMonthYear();
        this.updateGrid();
        
        if (this.startTimeInput && this.startDate) {
            this.startTimeInput.value = this.formatTime(this.startDate);
        }
        if (this.endTimeInput && this.endDate) {
            this.endTimeInput.value = this.formatTime(this.endDate);
        }
    }
    
    getDates() {
        return {
            startDate: this.startDate,
            endDate: this.endDate,
            startDateString: this.startDate ? this.formatForInput(this.startDate) : '',
            endDateString: this.endDate ? this.formatForInput(this.endDate) : ''
        };
    }
    
    formatForInput(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
}

