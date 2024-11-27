class ContentCalendar {
    constructor() {
        this.currentDate = new Date();
        this.scheduledContent = this.loadFromLocalStorage('scheduledContent') || {};
        this.fileList = this.loadFromLocalStorage('fileList') || {};
        this.hideScheduled = this.loadFromLocalStorage('hideScheduled') || false;
        
        this.initializeCalendar();
        this.initializeDragAndDrop();
        this.initializeFileInputs();
        this.loadSavedFiles(); // Load saved files on startup
         
        // Close edit fields when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.scheduled-file')) {
                document.querySelectorAll('.scheduled-file.editing').forEach(item => {
                    item.classList.remove('editing');
                });
            }
        });
        
        // Load scheduled content from localStorage
        this.scheduledContent = JSON.parse(localStorage.getItem('scheduledContent')) || {};
        
        // Update all file items to reflect their scheduled state
        this.updateFileListScheduledState();
        
        this.initializeClearAll();
        this.initializeExport();
    }

    initializeCalendar() {
        const calendarGrid = document.querySelector('.calendar-grid');
        const currentMonth = document.getElementById('current-month');
        
        // Set current month display
        currentMonth.textContent = this.currentDate.toLocaleString('default', { 
            month: 'long', 
            year: 'numeric' 
        });

        // Generate calendar days
        this.generateCalendarDays();

        // Add month navigation handlers
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.updateCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.updateCalendar();
        });
    }

    generateCalendarDays() {
        const calendarGrid = document.querySelector('.calendar-grid');
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        
        // Clear existing calendar days (except weekday headers)
        const weekdayHeaders = Array.from(calendarGrid.querySelectorAll('.weekday'));
        calendarGrid.innerHTML = '';
        weekdayHeaders.forEach(header => calendarGrid.appendChild(header));

        // Add padding days from previous month
        const startPadding = firstDay.getDay();
        for (let i = 0; i < startPadding; i++) {
            this.createCalendarDay(null, true);
        }

        // Add days of current month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            this.createCalendarDay(day, false);
        }
    }

    createCalendarDay(dayNumber, isDifferentMonth) {
        const calendarGrid = document.querySelector('.calendar-grid');
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day${isDifferentMonth ? ' different-month' : ''}`;
        
        if (dayNumber) {
            dayElement.innerHTML = `<div class="day-number">${dayNumber}</div>`;
            const dateKey = this.getDateKey(new Date(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth(),
                dayNumber
            ));
            
            // Add scheduled content for this day
            if (this.scheduledContent[dateKey]) {
                this.scheduledContent[dateKey].forEach(content => {
                    this.addScheduledContent(dayElement, content);
                });
            }
        }

        calendarGrid.appendChild(dayElement);
        return dayElement;
    }

    initializeDragAndDrop() {
        // Handle draggable items
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('file-item') || e.target.classList.contains('scheduled-file')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    filename: e.target.textContent,
                    platform: e.target.dataset.platform,
                    isScheduled: e.target.classList.contains('scheduled-file')
                }));
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('file-item') || e.target.classList.contains('scheduled-file')) {
                e.target.classList.remove('dragging');
            }
        });

        // Handle calendar day drop zones
        document.addEventListener('dragover', (e) => {
            const calendarDay = e.target.closest('.calendar-day');
            if (calendarDay) {
                e.preventDefault();
                calendarDay.classList.add('dragover');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const calendarDay = e.target.closest('.calendar-day');
            if (calendarDay) {
                calendarDay.classList.remove('dragover');
            }
        });

        document.addEventListener('drop', (e) => {
            const calendarDay = e.target.closest('.calendar-day');
            if (!calendarDay) return;
            
            e.preventDefault();
            calendarDay.classList.remove('dragover');
            
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            
            // Always remove from old location if it was already scheduled
            if (data.isScheduled) {
                this.removeScheduledContent(data.filename);
            }

            // Get the date for the target calendar day
            const dayNumber = calendarDay.querySelector('.day-number')?.textContent;
            if (!dayNumber) return;

            const targetDate = new Date(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth(),
                parseInt(dayNumber)
            );
            
            // Create formatted date string
            const formattedDate = targetDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Log the move action
            console.log(`Moved "${data.filename}" to ${formattedDate}`);


            // Find the file item element and add scheduled attribute
            const fileItem = Array.from(document.querySelectorAll('.file-item .file-name'))
                .find(el => el.textContent === data.filename.replace('📅', ''))
                ?.closest('.file-item');
            
            if (fileItem) {
                console.log("Found fileItem:", fileItem);
                fileItem.classList.add('is-scheduled');
                
                // Also update the calendar icon
                const calendarIcon = fileItem.querySelector('.calendar-icon');
                if (calendarIcon) {
                    calendarIcon.style.display = 'block';
                }
            }
            
            this.scheduleContent(targetDate, data);
        });
    }

    addScheduledContent(dayElement, content) {
        const contentElement = document.createElement('div');
        contentElement.className = `scheduled-file${content.published ? ' published' : ''}`;
        contentElement.dataset.platform = content.platform;
        contentElement.draggable = true;

        // Create content details
        const details = document.createElement('div');
        details.className = 'content-details';
        
        // Display title/filename
        const displayText = document.createElement('div');
        displayText.className = 'content-display';
        displayText.textContent = content.title || content.filename;
        
        details.appendChild(displayText);
        contentElement.appendChild(details);

        // Add buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'content-buttons';

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '×';
        deleteButton.title = 'Delete';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            contentElement.style.transition = 'opacity 0.2s';
            contentElement.style.opacity = '0';
            setTimeout(() => {
                this.removeScheduledContent(content.filename);
                this.saveToLocalStorage('scheduledContent', this.scheduledContent);
                this.updateCalendar();
            }, 200);
        };

        // Publish toggle
        const publishButton = document.createElement('button');
        publishButton.className = 'publish-toggle';
        publishButton.textContent = content.published ? '✓' : '○';
        publishButton.onclick = (e) => {
            e.stopPropagation();
            this.togglePublishState(content.filename, dayElement);
        };

        buttonContainer.appendChild(deleteButton);
        buttonContainer.appendChild(publishButton);
        contentElement.appendChild(buttonContainer);

        // Add click handler to show detail panel
        contentElement.addEventListener('click', (e) => {
            if (!e.target.matches('button')) {
                this.showDetailPanel(content, dayElement);
            }
        });

        dayElement.appendChild(contentElement);
    }

    scheduleContent(date, content) {
        const dateKey = this.getDateKey(date);
        if (!this.scheduledContent[dateKey]) {
            this.scheduledContent[dateKey] = [];
        }
        
        this.scheduledContent[dateKey].push({
            filename: content.filename,
            platform: content.platform,
            published: false
        });
        
        // Update file list item
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            const nameElement = item.querySelector('.file-name');
            if (nameElement && nameElement.textContent === content.filename) {
                // Add both scheduled attribute and class
                item.setAttribute('scheduled', 'true');
                item.classList.add('is-scheduled');
                // Show calendar icon
                const calendarIcon = item.querySelector('.calendar-icon');
                if (calendarIcon) {
                    calendarIcon.style.display = 'block';
                }
                // Apply hide if needed
                if (this.hideScheduled) {
                    item.style.display = 'none';
                }
            }
        });
        
        this.saveToLocalStorage('scheduledContent', this.scheduledContent);
        this.updateCalendar();
        this.updateFileListScheduledState();
    }

    removeScheduledContent(filename) {
        // Remove from calendar
        for (const dateKey in this.scheduledContent) {
            this.scheduledContent[dateKey] = this.scheduledContent[dateKey].filter(
                content => content.filename !== filename
            );
            if (this.scheduledContent[dateKey].length === 0) {
                delete this.scheduledContent[dateKey];
            }
        }
        
        // Update file list item
        if (!this.isFileScheduled(filename)) {
            const fileItems = document.querySelectorAll('.file-item');
            fileItems.forEach(item => {
                const nameElement = item.querySelector('.file-name');
                if (nameElement && nameElement.textContent === filename) {
                    // Remove both scheduled attribute and class
                    item.removeAttribute('scheduled');
                    item.classList.remove('is-scheduled');
                    // Hide calendar icon
                    const calendarIcon = item.querySelector('.calendar-icon');
                    if (calendarIcon) {
                        calendarIcon.style.display = 'none';
                    }
                    // Show item if it was hidden
                    if (this.hideScheduled) {
                        item.style.display = '';
                    }
                }
            });
        }
        
        this.saveToLocalStorage('scheduledContent', this.scheduledContent);
        this.updateFileListScheduledState();
    }

    togglePublishState(filename, dayElement) {
        const dateKey = this.getDateKey(new Date(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth(),
            parseInt(dayElement.querySelector('.day-number').textContent)
        ));

        const content = this.scheduledContent[dateKey].find(c => c.filename === filename);
        if (content) {
            content.published = !content.published;
            this.saveToLocalStorage('scheduledContent', this.scheduledContent);
            this.updateCalendar();
        }
    }

    updateCalendar() {
        const currentMonth = document.getElementById('current-month');
        currentMonth.textContent = this.currentDate.toLocaleString('default', { 
            month: 'long', 
            year: 'numeric' 
        });
        this.generateCalendarDays();
    }

    initializeFileInputs() {
        document.querySelectorAll('.file-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const platform = e.target.dataset.platform;
                const container = document.getElementById(`${platform}-files`);
                
                if (!this.fileList[platform]) {
                    this.fileList[platform] = [];
                }

                Array.from(e.target.files).forEach(file => {
                    const fileData = {
                        name: file.name,
                        type: file.type,
                        lastModified: file.lastModified
                    };
                    this.fileList[platform].push(fileData);
                    this.createFileElement(container, fileData, platform);
                });

                this.saveToLocalStorage('fileList', this.fileList);
            });
        });
    }

    // Helper methods
    getDateKey(date) {
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    loadFromLocalStorage(key) {
        return JSON.parse(localStorage.getItem(key));
    }

    saveToLocalStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // Add this new method
    loadSavedFiles() {
        Object.entries(this.fileList).forEach(([platform, files]) => {
            const container = document.getElementById(`${platform}-files`);
            files.forEach(file => {
                this.createFileElement(container, file, platform);
            });
        });
    }

    // Add this new method
    createFileElement(container, file, platform) {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item';
        fileElement.draggable = true;
        fileElement.dataset.platform = platform;
        
        // Check if file is scheduled by looking through scheduledContent
        const isScheduled = Object.values(this.scheduledContent).some(dateContent => 
            dateContent.some(content => content.filename === file.name)
        );
        
        if (isScheduled) {
            fileElement.setAttribute('scheduled', 'true');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = file.name;
        
        const calendarIcon = document.createElement('span');
        calendarIcon.className = 'calendar-icon';
        calendarIcon.textContent = '📅';
        calendarIcon.style.display = isScheduled ? 'block' : 'none';
        
        fileElement.appendChild(nameSpan);
        fileElement.appendChild(calendarIcon);
        
        container.appendChild(fileElement);
    }

    // Add this new method
    updateContentDetails(content, dayElement, field, value) {
        const dateKey = this.getDateKey(new Date(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth(),
            parseInt(dayElement.querySelector('.day-number').textContent)
        ));

        const contentItem = this.scheduledContent[dateKey].find(c => c.filename === content.filename);
        if (contentItem) {
            contentItem[field] = value;
            this.saveToLocalStorage('scheduledContent', this.scheduledContent);
        }
    }

    showDetailPanel(content, dayElement) {
        const panel = document.querySelector('.detail-panel');
        const overlay = document.querySelector('.panel-overlay');
        
        // Update panel content
        panel.querySelector('.filename-display').textContent = content.filename;
        panel.querySelector('#detail-title').value = content.title || '';
        panel.querySelector('#detail-caption').value = content.caption || '';
        
        const publishToggle = panel.querySelector('.detail-publish-toggle');
        publishToggle.textContent = content.published ? 'Published' : 'Not Published';
        publishToggle.classList.toggle('published', content.published);
        
        // Add scheduled toggle
        const scheduledToggle = panel.querySelector('.detail-scheduled-toggle');
        const isScheduled = this.isFileScheduled(content.filename);
        scheduledToggle.textContent = isScheduled ? 'Scheduled' : 'Not Scheduled';
        scheduledToggle.classList.toggle('scheduled', isScheduled);
        
        // Add event listeners
        const closeButton = panel.querySelector('.close-panel-button');
        const titleInput = panel.querySelector('#detail-title');
        const captionInput = panel.querySelector('#detail-caption');
        
        const closePanel = () => {
            panel.classList.remove('open');
            overlay.classList.remove('active');
            // Remove event listeners
            closeButton.removeEventListener('click', closePanel);
            overlay.removeEventListener('click', closePanel);
            titleInput.removeEventListener('change', updateTitle);
            captionInput.removeEventListener('change', updateCaption);
            publishToggle.removeEventListener('click', togglePublish);
            scheduledToggle.removeEventListener('click', toggleScheduled);
        };
        
        const updateTitle = () => {
            this.updateContentDetails(content, dayElement, 'title', titleInput.value);
            this.updateCalendar();
        };
        
        const updateCaption = () => {
            this.updateContentDetails(content, dayElement, 'caption', captionInput.value);
        };
        
        const togglePublish = () => {
            this.togglePublishState(content.filename, dayElement);
            publishToggle.textContent = content.published ? 'Published' : 'Not Published';
            publishToggle.classList.toggle('published', content.published);
        };
        
        const toggleScheduled = () => {
            if (isScheduled) {
                // Remove from calendar
                this.removeScheduledContent(content.filename);
                scheduledToggle.textContent = 'Not Scheduled';
                scheduledToggle.classList.remove('scheduled');
            } else {
                // Add to current day
                const today = new Date();
                this.scheduleContent(today, {
                    filename: content.filename,
                    platform: content.platform
                });
                scheduledToggle.textContent = 'Scheduled';
                scheduledToggle.classList.add('scheduled');
            }
            this.updateCalendar();
        };
        
        closeButton.addEventListener('click', closePanel);
        overlay.addEventListener('click', closePanel);
        titleInput.addEventListener('change', updateTitle);
        captionInput.addEventListener('change', updateCaption);
        publishToggle.addEventListener('click', togglePublish);
        scheduledToggle.addEventListener('click', toggleScheduled);
        
        // Show panel and overlay
        panel.classList.add('open');
        overlay.classList.add('active');
    }

     

    updateFileListVisibility() {
        document.querySelectorAll('.file-item').forEach(item => {
            const isScheduled = item.classList.contains('is-scheduled');
            item.style.display = this.hideScheduled && isScheduled ? 'none' : '';
        });
    }

    isFileScheduled(filename) {
        for (const dateKey in this.scheduledContent) {
            if (this.scheduledContent[dateKey].some(content => content.filename === filename)) {
                return true;
            }
        }
        return false;
    }

    // Add this new method
    updateFileListScheduledState() {
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            const filename = item.querySelector('.file-name').textContent;
            const isScheduled = Object.values(this.scheduledContent).some(dateContent => 
                dateContent.some(content => content.filename === filename)
            );
            
            if (isScheduled) {
                item.setAttribute('scheduled', 'true');
                item.classList.add('is-scheduled');
                const calendarIcon = item.querySelector('.calendar-icon');
                if (calendarIcon) {
                    calendarIcon.style.display = 'block';
                }
            } else {
                item.removeAttribute('scheduled');
                item.classList.remove('is-scheduled');
                const calendarIcon = item.querySelector('.calendar-icon');
                if (calendarIcon) {
                    calendarIcon.style.display = 'none';
                }
            }
            
            // Apply visibility based on hideScheduled setting
            if (this.hideScheduled && isScheduled) {
                item.style.display = 'none';
            } else {
                item.style.display = '';
            }
        });
    }

    initializeClearAll() {
        const clearButton = document.getElementById('clear-all-button');
        const modal = document.getElementById('clear-modal');
        const overlay = document.getElementById('modal-overlay');
        const confirmButton = document.getElementById('confirm-clear');
        const cancelButton = document.getElementById('cancel-clear');

        clearButton.addEventListener('click', () => {
            modal.style.display = 'block';
            overlay.style.display = 'block';
        });

        const closeModal = () => {
            modal.style.display = 'none';
            overlay.style.display = 'none';
        };

        confirmButton.addEventListener('click', () => {
            // Clear all localStorage
            localStorage.clear();
            
            // Reset all class properties
            this.scheduledContent = {};
            this.fileList = {};
            this.hideScheduled = false;
            
            // Clear all file lists
            document.querySelectorAll('.file-list').forEach(list => {
                list.innerHTML = '';
            });
            
            // Update the calendar
            this.updateCalendar();
            
            closeModal();
        });

        cancelButton.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
    }

    initializeExport() {
        const exportButton = document.getElementById('export-csv');
        exportButton.addEventListener('click', () => this.exportToCSV());
    }

    exportToCSV() {
        // Create CSV header
        const csvRows = [
            ['Date', 'Platform', 'Filename', 'Title', 'Caption', 'Status']
        ];
        
        // Sort dates for chronological order
        const sortedDates = Object.keys(this.scheduledContent).sort();
        
        // Add each scheduled content item
        sortedDates.forEach(dateKey => {
            const date = new Date(dateKey.split('-').join('/'));
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            this.scheduledContent[dateKey].forEach(content => {
                csvRows.push([
                    formattedDate,
                    content.platform,
                    content.filename,
                    content.title || '',
                    content.caption || '',
                    content.published ? 'Published' : 'Scheduled'
                ]);
            });
        });
        
        // Convert to CSV string
        const csvContent = csvRows.map(row => 
            row.map(cell => 
                // Escape quotes and wrap in quotes if contains comma
                typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) 
                    ? `"${cell.replace(/"/g, '""')}"` 
                    : cell
            ).join(',')
        ).join('\n');
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `content-calendar-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    const calendar = new ContentCalendar();
}); 