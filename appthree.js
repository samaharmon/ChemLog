// ===================================================
// DATA PERSISTENCE
// ===================================================

// Save form submissions to localStorage
function saveFormSubmissions() {
    localStorage.setItem('formSubmissions', JSON.stringify(formSubmissions));
    console.log(`Saved ${formSubmissions.length} submissions to localStorage`);
}

// Optional: Clear all data function for supervisors
function clearAllData() {
    if (confirm('Are you sure you want to clear all form submission data? This cannot be undone.')) {
        formSubmissions = [];
        filteredData = [];
        paginatedData = [];
        saveFormSubmissions(); // Save empty array
        loadDashboardData();
        showMessage('All data cleared successfully.', 'success');
    }
}

// Replace the existing showMessage function
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

// Add these missing functions to app.js

function deleteSubmission(submissionId) {
    if (confirm('Are you sure you want to delete this submission?')) {
        // Remove from formSubmissions array
        formSubmissions = formSubmissions.filter(submission => submission.id !== submissionId);
        saveFormSubmissions();
        loadDashboardData();
        showMessage('Submission deleted successfully!', 'success');
    }
}

function changePage(pageNumber) {
    currentPage = pageNumber;
    displayData();
    updatePaginationControls();
}

function checkForCriticalAlerts() {
    if (!formSubmissions || formSubmissions.length === 0) return;
    
    const criticalAlerts = [];
    const now = new Date();
    
    formSubmissions.forEach(submission => {
        const submissionTime = new Date(submission.timestamp);
        const hoursOld = (now - submissionTime) / (1000 * 60 * 60);
        
        // Check for old submissions (over 3 hours)
        if (hoursOld > 3) {
            criticalAlerts.push(`${submission.poolLocation}: Last reading is ${Math.floor(hoursOld)} hours old`);
        }
        
        // Check for critical chemical levels
        if (submission.mainPoolPH === '< 7.0' || submission.mainPoolPH === '> 8.0') {
            criticalAlerts.push(`${submission.poolLocation}: Critical pH level (${submission.mainPoolPH})`);
        }
        
        if (submission.mainPoolCl === '0' || submission.mainPoolCl === '> 10') {
            criticalAlerts.push(`${submission.poolLocation}: Critical chlorine level (${submission.mainPoolCl})`);
        }
    });
    
    if (criticalAlerts.length > 0) {
        showMessage(`${criticalAlerts.length} critical alert(s) found`, 'warning');
    }
}

function getClResponse(poolLocation, isMainPool, clValue) {
    // Special handling for Forest Lake secondary pool (granular/bleach methods)
    if (poolLocation === 'Forest Lake' && !isMainPool) {
        const sanitationMethod = sanitationSettings['Forest Lake Lap Pool'] || 'bleach';

        if (sanitationMethod === 'granular') {
            if (clValue === '> 10') {
                return `<strong>Notify a supervisor of the high Cl in the Lap Pool immediately. Lower the Cl level of the Lap Pool.</strong><br>Do not add any more shock to the pool. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.`;
            }
            if (clValue === '10') {
                return `<strong>Lower the Cl level of the Lap Pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.`;
            }
            if (['0', '1', '2'].includes(clValue)) {
                return `<strong>Raise the Cl level in the Lap Pool.</strong><br>If not handled the previous hour, change the Cl feeder rate according to the setpoint chart.`;
            }
        }
    }

    // Default fallback for other cases
    return null;
}

function areAllCheckboxesChecked() {
    const checkboxes = document.querySelectorAll('.feedback-checkbox');
    return Array.from(checkboxes).every(checkbox => checkbox.checked);
}

// Replace the incomplete chooseAndSendSMS function that starts around line 2030 with this complete version:

function chooseAndSendSMS() {
    const checkboxes = document.querySelectorAll('#samOption, #haleyOption');
    const selectedRecipients = [];
    
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedRecipients.push(checkbox.value);
        }
    });

    if (selectedRecipients.length === 0) {
        alert('Please select at least one supervisor to notify.');
        return;
    }

    if (formSubmissions.length === 0) {
        alert("No form submission found to share.");
        return;
    }
    
    const latest = formSubmissions[formSubmissions.length - 1];

    // Determine which values need highlighting
    const mainPH = latest.mainPoolPH;
    const secPH = latest.secondaryPoolPH;
    const mainCl = latest.mainPoolCl;
    const secCl = latest.secondaryPoolCl;
    
    // Create highlighted message parts
    const mainPoolPHText = mainPH === '< 7.0' ? 
        `⚠️ Main Pool pH: ${mainPH} - REQUIRES ATTENTION ⚠️` : 
        `Main Pool pH: ${mainPH}`;
        
    const secPoolPHText = secPH === '< 7.0' ? 
        `⚠️ Secondary Pool pH: ${secPH} - REQUIRES ATTENTION ⚠️` : 
        `Secondary Pool pH: ${secPH}`;
        
    const mainPoolClText = (mainCl === '10' || mainCl === '> 10' || parseFloat(mainCl) > 10) ? 
        `⚠️ Main Pool Cl: ${mainCl} - HIGH LEVEL ⚠️` : 
        `Main Pool Cl: ${mainCl}`;
        
    const secPoolClText = (secCl === '10' || secCl === '> 10' || parseFloat(secCl) > 10) ? 
        `⚠️ Secondary Pool Cl: ${secCl} - HIGH LEVEL ⚠️` : 
        `Secondary Pool Cl: ${secCl}`;
        
    const message =
        `Pool Chemistry Log\n\n` +
        `Submitted by: ${latest.firstName} ${latest.lastName}\n` +
        `Pool Location: ${latest.poolLocation}\n\n` +
        `${mainPoolPHText}\n` +
        `${mainPoolClText}\n` +
        `${secPoolPHText}\n` +
        `${secPoolClText}\n\n` +
        `Time: ${latest.timestamp}`;

    // Send to each selected recipient
    selectedRecipients.forEach(recipient => {
        window.location.href = `sms:${recipient}?body=${encodeURIComponent(message)}`;
    });
    
    // Close modals and remove overlay
    const feedbackModal = document.querySelector('.feedback-modal');
    if (feedbackModal) feedbackModal.remove();
    
    removeOverlay();
}

function removeOverlay() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'none'; // Hide the overlay
    }
}

// Replace the entire showRecipientSelectionInModal function (around lines 1890-1979) with this:
function showRecipientSelectionInModal(modal) {
    modal.innerHTML = ''; // Clear existing modal content

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    `;
    closeBtn.onclick = () => {
        modal.remove();
        removeOverlay();
    };
    modal.appendChild(closeBtn);

    const feedbackContent = document.createElement('div');
    feedbackContent.className = 'feedback-content';
    feedbackContent.style.cssText = `
        margin-top: 30px;
        padding: 10px;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Select recipient:';
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: #dc3545;
        text-align: center;
    `;
    feedbackContent.appendChild(title);

    const messageList = document.createElement('div');
    messageList.style.cssText = `
        margin: 20px 0;
    `;
    
    // Sam Harmon checkbox
    const samCheckboxItem = document.createElement('div');
    samCheckboxItem.className = 'checkbox-item';
    samCheckboxItem.style.cssText = `
        display: flex;
        align-items: flex-start;
        margin: 15px 0;
        padding: 10px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background-color: #f9f9f9;
    `;
    
    const samCheckbox = document.createElement('input');
    samCheckbox.type = 'checkbox';
    samCheckbox.className = 'feedback-checkbox';
    samCheckbox.id = 'samOption';
    samCheckbox.value = '+18644096231';
    samCheckbox.style.cssText = `
        margin-right: 10px;
        margin-top: 4px;
        transform: scale(1.2);
    `;
    
    const samLabel = document.createElement('label');
    samLabel.textContent = 'Sam Harmon';
    samLabel.htmlFor = 'samOption';
    samLabel.style.cssText = `
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
        cursor: pointer;
    `;
    samLabel.onclick = () => {
        samCheckbox.checked = !samCheckbox.checked;
    };
    
    samCheckboxItem.appendChild(samCheckbox);
    samCheckboxItem.appendChild(samLabel);
    messageList.appendChild(samCheckboxItem);
    
    // Haley Wilson checkbox
    const haleyCheckboxItem = document.createElement('div');
    haleyCheckboxItem.className = 'checkbox-item';
    haleyCheckboxItem.style.cssText = `
        display: flex;
        align-items: flex-start;
        margin: 15px 0;
        padding: 10px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background-color: #f9f9f9;
    `;
    
    const haleyCheckbox = document.createElement('input');
    haleyCheckbox.type = 'checkbox';
    haleyCheckbox.className = 'feedback-checkbox';
    haleyCheckbox.id = 'haleyOption';
    haleyCheckbox.value = '+18036738396';
    haleyCheckbox.style.cssText = `
        margin-right: 10px;
        margin-top: 4px;
        transform: scale(1.2);
    `;
    
    const haleyLabel = document.createElement('label');
    haleyLabel.textContent = 'Haley Wilson';
    haleyLabel.htmlFor = 'haleyOption';
    haleyLabel.style.cssText = `
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
        cursor: pointer;
    `;
    haleyLabel.onclick = () => {
        haleyCheckbox.checked = !haleyCheckbox.checked;
    };
    
    haleyCheckboxItem.appendChild(haleyCheckbox);
    haleyCheckboxItem.appendChild(haleyLabel);
    messageList.appendChild(haleyCheckboxItem);
    
    feedbackContent.appendChild(messageList);
    modal.appendChild(feedbackContent);

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send Message';
    sendBtn.className = 'notify-btn';
    sendBtn.style.cssText = `
        background-color: #dc3545;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin: 10px 5px;
        font-family: 'Franklin Gothic Medium', Arial, sans-serif;
    `;
    sendBtn.onclick = chooseAndSendSMS;
    feedbackContent.appendChild(sendBtn);
}

function toggleMenu() {
    const menu = document.getElementById('dropdownMenu');
    if (!menu) return;
    
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.menu-container')) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        }
    });
}

async function showSettings() {
    document.getElementById('dropdownMenu').style.display = 'none';
    
    // Refresh settings from Firebase before showing modal (if available)
    try {
        if (db && window.firebaseModules) {
            console.log('Refreshing settings from Firebase v9 before showing modal...');
            const settingsRef = window.firebaseModules.doc(db, 'settings', 'sanitationMethods');
            const settingsDoc = await window.firebaseModules.getDoc(settingsRef);
            
            if (settingsDoc.exists()) {
                const firebaseSettings = settingsDoc.data();
                Object.assign(sanitationSettings, firebaseSettings);
                console.log('Refreshed sanitation settings from Firebase v9:', sanitationSettings);
            } else {
                console.log('No Firebase settings found when refreshing');
            }
        } else {
            console.log('Firebase not ready when showing settings, using current in-memory settings');
        }
    } catch (error) {
        console.warn('Could not refresh from Firebase v9 when showing settings:', error);
    }
    
    document.getElementById('settingsModal').style.display = 'block';
    loadSanitationSettings();
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function sendSMSNotification(message, phoneNumber) {
    console.log(`SMS would be sent to ${phoneNumber}: ${message}`);
    showMessage('SMS notification sent successfully!', 'success');
}

function debugApp() {
    console.log('=== APP DEBUG INFO ===');
    console.log('Firebase app:', !!app);
    console.log('Firebase db:', !!db);
    console.log('isLoggedIn:', isLoggedIn);
    console.log('currentView:', currentView);
    console.log('formSubmissions length:', formSubmissions.length);
    console.log('allSubmissions length:', allSubmissions.length);
    console.log('Login modal exists:', !!document.getElementById('loginModal'));
    console.log('Login form exists:', !!document.getElementById('loginForm'));
    console.log('openLoginModal function exists:', typeof openLoginModal);
    console.log('submitForm function exists:', typeof submitForm);
    console.log('=====================');
}

window.debugApp = debugApp;

// ===================================================
// GLOBAL ASSIGNMENTS
// ===================================================

// Functions actually defined in appthree.js:
window.sendSMSNotification = sendSMSNotification;
window.deleteSubmission = deleteSubmission;
window.changePage = changePage;
window.checkForCriticalAlerts = checkForCriticalAlerts;
window.getClResponse = getClResponse;
window.areAllCheckboxesChecked = areAllCheckboxesChecked;
window.removeOverlay = removeOverlay;
window.showRecipientSelectionInModal = showRecipientSelectionInModal;
window.chooseAndSendSMS = chooseAndSendSMS;
window.toggleMenu = toggleMenu;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.clearAllData = clearAllData;
window.showMessage = showMessage;
window.debugApp = debugApp;

// Only add these if the functions actually exist in appthree.js:
// window.createOrShowOverlay = createOrShowOverlay; // Verify this exists
// window.notifySupervisor = notifySupervisor; // Verify this exists

console.log('🔥✅ Pool Chemistry Log App - All appthree.js Functions Loaded! ✅🔥');