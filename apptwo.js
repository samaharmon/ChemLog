// ===================================================
// FORM SUBMISSION
// ===================================================

// Form submission function
async function submitForm() {
    console.log('Submit button clicked'); // Debug log
    
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });

    
    const basicRequiredFields = ['firstName', 'lastName', 'poolLocation'];
    let hasErrors = false;
    
    basicRequiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        const formGroup = field.closest('.form-group');
        
        if (!field.value || field.value.trim() === '') {
            formGroup.classList.add('error');
            hasErrors = true;
        }
    });
    
    const mainPoolFields = ['mainPoolPH', 'mainPoolCl'];
    mainPoolFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        const formGroup = field.closest('.form-group');
        
        if (!field.value || field.value.trim() === '') {
            formGroup.classList.add('error');
            hasErrors = true;
        }
    });
    
    const poolLocation = document.getElementById('poolLocation').value;
    if (poolLocation !== 'Camden CC') {
        const secondaryPoolFields = ['secondaryPoolPH', 'secondaryPoolCl'];
        secondaryPoolFields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            const formGroup = field.closest('.form-group');
            
            if (!field.value || field.value.trim() === '') {
                formGroup.classList.add('error');
                hasErrors = true;
            }
        });
    }
    
    if (hasErrors) {
        showMessage('Please fill in all required fields (highlighted in yellow).', 'error');
        const firstError = document.querySelector('.form-group.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const formData = new FormData();
    formData.append('mainPoolPH', document.getElementById('mainPoolPH').value);
    formData.append('mainPoolCl', document.getElementById('mainPoolCl').value);
    formData.append('secondaryPoolPH', document.getElementById('secondaryPoolPH').value);
    formData.append('secondaryPoolCl', document.getElementById('secondaryPoolCl').value);
    
    // Process form submission
    evaluateFormFeedback(formData);
    
    // Save data
    const submission = {
        id: Date.now(),
        timestamp: new Date(), // Change this from string to Date object
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        poolLocation: document.getElementById('poolLocation').value,
        mainPoolPH: document.getElementById('mainPoolPH').value,
        mainPoolCl: document.getElementById('mainPoolCl').value,
        secondaryPoolPH: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolPH').value,
        secondaryPoolCl: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolCl').value
    };
    
    // Save to localStorage first
    formSubmissions.push(submission);
    saveFormSubmissions();
    
    // ADD THIS: Try to save to Firebase v9
    if (db && window.firebaseModules) {
        try {
            await window.firebaseModules.addDoc(
                window.firebaseModules.collection(db, 'poolSubmissions'), 
                {
                    ...submission,
                    timestamp: window.firebaseModules.Timestamp.fromDate(submission.timestamp)
                }
            );
            console.log('Submission saved to Firebase v9');
        } catch (error) {
            console.warn('Could not save to Firebase v9:', error);
        }
    }
    
    showMessage('Submission saved successfully!', 'success');
    
    if (document.getElementById('supervisorDashboard').style.display === 'block') {
        loadDashboardData();
    }
    
    resetForm();
}

// ===================================================
// DATA MANAGEMENT & DASHBOARD
// ===================================================

// Load dashboard data with real-time updates
function showDashboard() {
    console.log('showDashboard called');
    
    // Set login state
    isLoggedIn = true;
    currentView = 'dashboard';
    
    // Hide form, show dashboard
    const mainForm = document.getElementById('mainForm');
    const dashboard = document.getElementById('supervisorDashboard');
    
    if (mainForm) mainForm.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
    
    // Update header buttons
    updateHeaderButtons();
    
    // Load dashboard data
    loadDashboardData();
    
    console.log('Dashboard shown, isLoggedIn set to true');
}


// Filter dashboard data
function filterData() {
    const poolFilter = document.getElementById('poolFilter')?.value || '';
    const dateFilter = document.getElementById('dateFilter')?.value || '';
    
    filteredSubmissions = allSubmissions.filter(submission => {
        let passesFilter = true;
        
        // Pool filter
        if (poolFilter && submission.poolLocation !== poolFilter) {
            passesFilter = false;
        }
        
        // Date filter
        if (dateFilter) {
            const filterDate = new Date(dateFilter);
            const submissionDate = new Date(submission.timestamp);
            if (submissionDate.toDateString() !== filterDate.toDateString()) {
                passesFilter = false;
            }
        }
        
        return passesFilter;
    });
    
    currentPage = 1;
    displayData();
}

// Reset form after submission
function resetForm() {
    document.getElementById('firstName').value = '';
    document.getElementById('lastName').value = '';
    document.getElementById('poolLocation').value = '';
    document.getElementById('mainPoolPH').value = '';
    document.getElementById('mainPoolCl').value = '';
    document.getElementById('secondaryPoolPH').value = '';
    document.getElementById('secondaryPoolCl').value = '';
    
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    // Reset secondary pool visibility
    handlePoolLocationChange();
}

// ===================================================
// PAGINATION
// ===================================================

function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayData();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayData();
    }
}

// ===================================================
// LOGIN & AUTHENTICATION
// ===================================================

// Login modal functions
function openLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// Logout function
// Replace the existing logout function:
function logout() {
    console.log('logout called');
    
    // Reset state
    isLoggedIn = false;
    currentView = 'form';
    
    // Close any open menus
    const dropdown = document.getElementById('dropdownMenu');
    if (dropdown) dropdown.style.display = 'none';
    
    // Remove login token
    localStorage.removeItem('loginToken');
    
    // Hide dashboard and show form
    const dashboard = document.getElementById('supervisorDashboard');
    const form = document.getElementById('mainForm');
    
    if (dashboard) dashboard.style.display = 'none';
    if (form) form.style.display = 'block';
    
    // Clear any filters
    const poolFilter = document.getElementById('poolFilter');
    const dateFilter = document.getElementById('dateFilter');
    if (poolFilter) poolFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    
    // Reset page
    currentPage = 1;
    
    // Update header buttons AFTER setting isLoggedIn to false
    updateHeaderButtons();
    
    console.log('Logged out successfully, isLoggedIn set to false');
}

// ===================================================
// EXPORT FUNCTIONALITY
// ===================================================

function exportToCSV() {
    if (filteredData.length === 0) {
        showMessage('No data to export.', 'error');
        return;
    }
    
    const headers = ['Timestamp', 'First Name', 'Last Name', 'Pool Location', 'Main pH', 'Main Cl', 'Secondary pH', 'Secondary Cl'];
    const csvContent = [
        headers.join(','),
        ...filteredData.map(row => [
            `"${row.timestamp}"`,
            `"${row.firstName}"`,
            `"${row.lastName}"`,
            `"${row.poolLocation}"`,
            `"${row.mainPoolPH}"`,
            `"${row.mainPoolCl}"`,
            `"${row.secondaryPoolPH}"`,
            `"${row.secondaryPoolCl}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-chemistry-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showMessage('Data exported successfully!', 'success');
}

// ===================================================
// SETTINGS & SANITATION MANAGEMENT
// ===================================================

function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    updateSanitationUI(); // Ensure UI reflects current settings
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Handle sanitation method changes
async function handleSanitationChange(checkbox) {
    const pool = checkbox.dataset.pool;
    const method = checkbox.dataset.method;
    
    console.log(`Changing sanitation for ${pool} to ${method}, checked: ${checkbox.checked}`);
    
    if (checkbox.checked) {
        // Uncheck the other method for this pool
        const otherMethod = method === 'bleach' ? 'granular' : 'bleach';
        const otherCheckbox = document.querySelector(`[data-pool="${pool}"][data-method="${otherMethod}"]`);
        if (otherCheckbox) {
            otherCheckbox.checked = false;
        }
        
        // Update settings
        sanitationSettings[pool] = method;
    } else {
        // If unchecking, default to bleach
        sanitationSettings[pool] = 'bleach';
        const bleachCheckbox = document.querySelector(`[data-pool="${pool}"][data-method="bleach"]`);
        if (bleachCheckbox) {
            bleachCheckbox.checked = true;
        }
    }
    
    console.log('Updated sanitationSettings:', sanitationSettings);
    
    // Always save to localStorage first for immediate persistence
    localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
    console.log('Saved sanitation settings to localStorage');
    
    // Try to save to Firebase if available
    try {
        if (db && window.firebaseModules) {
            const settingsRef = window.firebaseModules.doc(db, 'settings', 'sanitationMethods');
            await window.firebaseModules.setDoc(settingsRef, sanitationSettings);
            console.log('Successfully saved sanitation settings to Firebase v9');
        } else {
            console.log('Firebase not available, settings saved to localStorage only');
        }
    } catch (error) {
        console.warn('Could not save to Firebase v9, but settings are saved to localStorage:', error);
    }
}

// ===================================================
// FEEDBACK & NOTIFICATIONS
// ===================================================

function showFeedback(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Create or get existing message container
    let messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'messageContainer';
        messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(messageContainer);
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 5px;
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease-out;
        ${type === 'error' ? 'background-color: #ffebee; color: #c62828; border-left: 4px solid #c62828;' : ''}
        ${type === 'success' ? 'background-color: #e8f5e8; color: #2e7d32; border-left: 4px solid #2e7d32;' : ''}
        ${type === 'warning' ? 'background-color: #fff3e0; color: #f57c00; border-left: 4px solid #f57c00;' : ''}
        ${type === 'info' ? 'background-color: #e3f2fd; color: #1976d2; border-left: 4px solid #1976d2;' : ''}
    `;
    messageElement.textContent = message;
    
    // Add animation keyframes
    if (!document.getElementById('messageAnimations')) {
        const style = document.createElement('style');
        style.id = 'messageAnimations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    messageContainer.appendChild(messageElement);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Define the showMessage function
function showMessage(message, type) {
    // Remove any existing message banner
    const existingBanner = document.getElementById('messageBanner');
    if (existingBanner) {
        existingBanner.remove();
    }
    
    // Create new message banner
    const banner = document.createElement('div');
    banner.id = 'messageBanner';
    banner.textContent = message;
    
    // Style based on type
    if (type === 'error') {
        banner.style.backgroundColor = '#f8d7da';
        banner.style.color = '#721c24';
        banner.style.border = '1px solid #f5c6cb';
    } else if (type === 'success') {
        banner.style.backgroundColor = '#d4edda';
        banner.style.color = '#155724';
        banner.style.border = '1px solid #c3e6cb';
    }
    
    banner.style.cssText += `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        padding: 10px 20px;
        border-radius: 0px;
        font-family: 'Franklin Gothic Medium', Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(banner);
    
   // Auto-remove after 3 seconds
    setTimeout(() => {
        if (banner) {
            banner.remove();
        }
    }, 3000);
}

function notifySupervisor() {
    const feedbackModal = document.getElementById('feedbackModal');
    feedbackModal.style.display = 'block';
}

// Define the missing functions
function closeModal() {
    const feedbackModal = document.getElementById('feedbackModal');
    feedbackModal.style.display = 'none';
}

function handleLocationChange() {
    const poolLocation = document.getElementById('poolLocation').value;
    const secondarySection = document.getElementById('secondaryPoolSection');
    
    if (POOLS_WITH_SECONDARY.includes(poolLocation)) {
        if (secondarySection) {
            secondarySection.style.display = 'block';
        }
    } else {
        if (secondarySection) {
            secondarySection.style.display = 'none';
        }
    }
}

function showFeedbackModal(messages, isGood, setpointImgNeeded) {
    const modal = document.createElement('div');
    modal.className = 'feedback-modal ' + (isGood ? 'good' : 'warning');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
        if (isGood || areAllCheckboxesChecked()) {
            modal.remove();
            removeOverlay();
        } else {
            showMessage('Please complete all water chemistry changes and check them off the list before closing.', 'error');
        }
    };

    const feedbackContent = document.createElement('div');
    feedbackContent.className = 'feedback-content';

    const title = document.createElement('h2');
    title.textContent = isGood
        ? '✅ Water chemistry looks good!'
        : '🚨 You need to make immediate changes to the water chemistry:';
    feedbackContent.appendChild(title);

    if (!isGood) {
        const messageList = document.createElement('div');
        messages.forEach(msg => {
            if (msg.includes('setpoint.jpeg')) {
                const chartContainer = document.createElement('div');
                chartContainer.className = 'setpoint-container';
                chartContainer.style.textAlign = 'center';
                chartContainer.style.margin = '20px 0';

                const chart = document.createElement('img');
                chart.src = 'setpoint.jpeg';
                chart.alt = 'Setpoint Chart';
                chart.className = 'setpoint-chart';
                chart.style.maxWidth = '100%';
                chart.style.height = 'auto';

                chartContainer.appendChild(chart);
                messageList.appendChild(chartContainer);
            } else {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'feedback-checkbox';

                const label = document.createElement('label');
                label.innerHTML = msg;

                checkboxItem.appendChild(checkbox);
                checkboxItem.appendChild(label);
                messageList.appendChild(checkboxItem);
            }
        });
        feedbackContent.appendChild(messageList);
    } else {
        const message = document.createElement('p');
        message.textContent = messages[0];
        feedbackContent.appendChild(message);
    }

    // Add Notify a Supervisor button only if messages contain "notify a supervisor"
    const shouldShowNotifyButton = messages.some(msg => 
        msg.toLowerCase().includes('notify a supervisor')
    );
    
    if (shouldShowNotifyButton) {
        const notifyBtn = document.createElement('button');
        notifyBtn.className = 'notify-btn';
        notifyBtn.textContent = 'Notify a Supervisor';
        notifyBtn.onclick = () => {
            showRecipientSelectionInModal(modal);
        };
        modal.appendChild(notifyBtn);
    }

    modal.appendChild(closeBtn);
    modal.appendChild(feedbackContent);
    document.body.appendChild(modal);
}