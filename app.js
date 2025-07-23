// ===================================================
// POOL CHEMISTRY LOG - UNIFIED APPLICATION
// Capital City Aquatics - 2025
// ===================================================

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRxSL2uuH6O5MFvbq0FS02zF2K_lXGvqI",
  authDomain: "chemlog-43c08.firebaseapp.com",
  projectId: "chemlog-43c08",
  storageBucket: "chemlog-43c08.firebasestorage.app",
  messagingSenderId: "554394202059",
  appId: "1:554394202059:web:a8d5824a1d7ccdd871d04e",
  measurementId: "G-QF5ZQ88VS2"
};

// Global variables
let app, db;
let allSubmissions = [];
let filteredSubmissions = [];
let formSubmissions = [];
let filteredData = [];
let paginatedData = [];
let currentPage = 1;
const itemsPerPage = 20;
let isLoggedIn = false;
let sanitationSettings = {};
let currentView = 'form';

// Default supervisor credentials
const supervisorCredentials = {
    email: 'capitalcity',
    password: '$ummer2025'
};

// ===================================================
// FIREBASE INITIALIZATION
// ===================================================

// Validate Firebase config
function validateFirebaseConfig() {
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    for (const field of requiredFields) {
        if (!firebaseConfig[field] || firebaseConfig[field].startsWith('YOUR_')) {
            return false;
        }
    }
    return true;
}

// Initialize Firebase
function initializeFirebase() {
    try {
        if (!validateFirebaseConfig()) {
            updateFirebaseStatus('⚠️ Firebase config not set - update app.js with your project credentials', true);
            return;
        }
        
        if (!window.firebase) {
            updateFirebaseStatus('Firebase SDK not loaded', true);
            return;
        }
        
        app = window.firebase.initializeApp(firebaseConfig);
        db = window.firebase.getFirestore(app);
        updateFirebaseStatus('✅ Firebase connected successfully');
        
        // Initialize sanitation settings and load data
        initializeSanitationSettings();
        loadDashboardData();
    } catch (error) {
        console.error('Firebase initialization error:', error);
        updateFirebaseStatus(`❌ Firebase error: ${error.message}`, true);
    }
}

// ===================================================
// SANITATION SETTINGS MANAGEMENT
// ===================================================

// Initialize sanitation settings with Firebase sync
async function initializeSanitationSettings() {
    const pools = ['Camden CC', 'CC of Lexington', 'Columbia CC', 'Forest Lake', 'Forest Lake Lap Pool', 'Quail Hollow', 'Rockbridge', 'Wildewood', 'Winchester'];
    const statusDiv = document.getElementById('firebaseStatus');
    
    console.log('Initializing sanitation settings...');
    updateFirebaseStatus('Loading settings from Firebase...');
    
    // Set defaults first
    pools.forEach(pool => {
        sanitationSettings[pool] = 'bleach'; // Default to bleach
    });

    try {
        if (db) {
            const settingsDocRef = window.firebase.collection(db, 'settings');
            const settingsQuery = window.firebase.query(settingsDocRef);
            const querySnapshot = await window.firebase.getDocs(settingsQuery);
            
            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    if (doc.id === 'sanitationMethods') {
                        const firebaseSettings = doc.data();
                        Object.assign(sanitationSettings, firebaseSettings);
                        console.log('Successfully loaded sanitation settings from Firebase:', sanitationSettings);
                        updateFirebaseStatus('Settings synced with cloud ✓');
                    }
                });
            } else {
                console.log('No Firebase settings found, saving defaults');
                await saveSanitationSettings();
                updateFirebaseStatus('Default settings saved to cloud');
            }
        } else {
            throw new Error('Database not initialized');
        }
    } catch (error) {
        console.warn('Could not load settings from Firebase, using localStorage fallback:', error);
        updateFirebaseStatus('Using local settings (offline)');
        
        // Fallback to localStorage
        const saved = localStorage.getItem('sanitationSettings');
        if (saved) {
            sanitationSettings = JSON.parse(saved);
            console.log('Loaded sanitation settings from localStorage fallback:', sanitationSettings);
        } else {
            localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
            console.log('Saved default settings to localStorage');
        }
    }
    
    console.log('Final sanitationSettings after initialization:', sanitationSettings);
    
    // Update UI checkboxes based on loaded settings
    updateSanitationUI();
    
    // Hide status after 3 seconds
    setTimeout(() => {
        if (statusDiv) statusDiv.style.display = 'none';
    }, 3000);
}

// Save sanitation settings to Firebase and localStorage
async function saveSanitationSettings() {
    try {
        if (db) {
            await window.firebase.addDoc(window.firebase.collection(db, 'settings'), {
                ...sanitationSettings,
                id: 'sanitationMethods'
            });
            console.log('Saved sanitation settings to Firebase');
        }
    } catch (error) {
        console.warn('Could not save to Firebase:', error);
    }
    
    // Always save to localStorage as backup
    localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
    console.log('Saved sanitation settings to localStorage');
}

// Update UI checkboxes based on settings
function updateSanitationUI() {
    Object.keys(sanitationSettings).forEach(pool => {
        const method = sanitationSettings[pool];
        const bleachCheckbox = document.querySelector(`input[data-pool="${pool}"][data-method="bleach"]`);
        const granularCheckbox = document.querySelector(`input[data-pool="${pool}"][data-method="granular"]`);
        
        if (bleachCheckbox) bleachCheckbox.checked = (method === 'bleach');
        if (granularCheckbox) granularCheckbox.checked = (method === 'granular');
    });
}

// Load sanitation settings into the checkboxes
function loadSanitationSettings() {
    console.log('Loading sanitation settings into checkboxes:', sanitationSettings);
    const checkboxes = document.querySelectorAll('.sanitation-checkbox');
    checkboxes.forEach(checkbox => {
        const pool = checkbox.dataset.pool;
        const method = checkbox.dataset.method;
        const shouldBeChecked = sanitationSettings[pool] === method;
        checkbox.checked = shouldBeChecked;
        console.log(`${pool} - ${method}: ${shouldBeChecked ? 'checked' : 'unchecked'}`);
    });
}

// ===================================================
// DOM INITIALIZATION
// ===================================================

// Wait for Firebase to be available and DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔥🔥🔥 UNIFIED APP.JS LOADED 🔥🔥🔥');
    window.initializeFirebaseApp = initializeFirebase;
    
    if (window.firebaseLoaded) {
        initializeFirebase();
    } else {
        // Wait for Firebase modules to load
        const checkFirebase = setInterval(() => {
            if (window.firebase) {
                clearInterval(checkFirebase);
                initializeFirebase();
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkFirebase);
            if (!window.firebase) {
                updateFirebaseStatus('Firebase failed to load - check internet connection', true);
            }
        }, 10000);
    }
    
    // Initialize settings and load data
    initializeSanitationSettings();
    loadFormSubmissions();
    handlePoolLocationChange();

    // Attach form submission event listener
    const mainForm = document.getElementById('mainForm');
    if (mainForm) {
        mainForm.addEventListener('submit', function (e) {
            e.preventDefault(); // Prevent traditional form submission
            submitForm();
        });
        console.log('Form submit event listener attached');
    }

    // Attach login form submission event listener
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
        console.log('Login form submit event listener attached');
    }

    // Check if user is already logged in
    checkLogin();
    
    // Set up initial UI state
    handlePoolLocationChange();
    
    // Check if user is already logged in
    checkLoginStatus();
});

// ===================================================
// UTILITY FUNCTIONS
// ===================================================

// Initialize the app
function updateFirebaseStatus(message, isError = false) {
    const statusElement = document.getElementById('firebaseStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? '#ff0000' : '#666';
    }
}

// Check login status
function checkLoginStatus() {
    const loginStatus = localStorage.getItem('isLoggedIn');
    if (loginStatus === 'true') {
        isLoggedIn = true;
        document.getElementById('mainForm').style.display = 'none';
        document.getElementById('supervisorDashboard').style.display = 'block';
        loadDashboardData();
    }
}

// Check login with token
function checkLogin() {
    const token = localStorage.getItem('loginToken');
    if (token) {
        const { username, expires } = JSON.parse(token);
        if (Date.now() < expires) {
            showDashboard();
            return true;
        } else {
            localStorage.removeItem('loginToken');
        }
    }
    return false;
}

// ===================================================
// FORM SUBMISSION
// ===================================================

// Form submission function
async function submitForm(event) {
    if (event) event.preventDefault();
    
    console.log('🔥 Form submission started');
    
    if (!db) {
        console.log('Database not initialized');
        showFeedback('Database not initialized. Please refresh the page.', 'error');
        return;
    }
    
    // Remove existing error highlights
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
    
    const poolLocationValue = document.getElementById('poolLocation').value;
    if (poolLocationValue !== 'Camden CC') {
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

    try {
        // Get form data
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const submissionPoolLocation = document.getElementById('poolLocation').value;
        const mainPoolPH = document.getElementById('mainPoolPH').value;
        const mainPoolCl = document.getElementById('mainPoolCl').value;
        const secondaryPoolPH = submissionPoolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolPH').value;
        const secondaryPoolCl = submissionPoolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolCl').value;
        
        const formData = {
            firstName,
            lastName,
            poolLocation: submissionPoolLocation,
            mainPoolPH,
            mainPoolCl,
            secondaryPoolPH,
            secondaryPoolCl,
            timestamp: new Date(),
            submittedBy: `${firstName} ${lastName}`,
            sanitationMethod: sanitationSettings[submissionPoolLocation] || 'bleach',
            submittedAt: new Date().toISOString() // For sorting
        };

        console.log('🔥 Form data:', formData);

        console.log('🔥 Submitting to Firebase...');

        // Submit to Firebase
        const docRef = await window.firebase.addDoc(window.firebase.collection(db, 'poolSubmissions'), formData);
        console.log('🔥✅ Document written with ID: ', docRef.id);
        
        // Show success message
        showFeedback('Form submitted successfully!', 'success');
        showMessage('Form submitted successfully!', 'success');
        
        // Reset form
        resetForm();
        
        // Refresh dashboard if logged in
        if (isLoggedIn || currentView === 'dashboard') {
            await loadAndDisplayData();
            loadDashboardData();
        }
        
        // Show feedback modal
        evaluateFormFeedback(formData);
        
    } catch (error) {
        console.error('🔥❌ Error adding document: ', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'permission-denied') {
            showFeedback('Permission denied. Please check Firestore security rules.', 'error');
            updateFirebaseStatus('❌ Permission denied - check Firestore rules', true);
        } else {
            showFeedback(`Error submitting form: ${error.message}`, 'error');
            updateFirebaseStatus('Error submitting form', true);
        }
    }
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
// POOL LOCATION HANDLING
// ===================================================

// Handle pool location change
function handlePoolLocationChange() {
    const selectedPool = document.getElementById('poolLocation').value;
    const secondarySection = document.getElementById('secondaryPoolSection');
    
    // Hide secondary pool section for pools that don't have one
    const poolsWithSecondary = ['Forest Lake', 'Columbia CC', 'Camden CC'];
    if (poolsWithSecondary.includes(selectedPool)) {
        secondarySection.style.display = 'block';
        document.getElementById('secondaryPoolPH').required = true;
        document.getElementById('secondaryPoolCl').required = true;
    } else {
        secondarySection.style.display = 'none';
        document.getElementById('secondaryPoolPH').required = false;
        document.getElementById('secondaryPoolCl').required = false;
    }
}

// ===================================================
// DATA MANAGEMENT & DASHBOARD
// ===================================================

// Load dashboard data with real-time updates
function loadDashboardData() {
    if (!db) {
        updateFirebaseStatus('Database not initialized', true);
        return;
    }
    
    try {
        const q = window.firebase.query(
            window.firebase.collection(db, 'poolSubmissions'), 
            window.firebase.orderBy('timestamp', 'desc')
        );
        
        // Set up real-time listener
        window.firebase.onSnapshot(q, (querySnapshot) => {
            allSubmissions = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.id = doc.id;
                // Convert Firestore timestamp to JavaScript Date
                if (data.timestamp && data.timestamp.toDate) {
                    data.timestamp = data.timestamp.toDate();
                }
                allSubmissions.push(data);
            });
            
            console.log('Loaded submissions:', allSubmissions.length);
            updateFirebaseStatus(`Loaded ${allSubmissions.length} submissions`);
            
            // Apply current filters and update display
            if (isLoggedIn) {
                filterData();
            }
        }, (error) => {
            console.error('Error loading data: ', error);
            updateFirebaseStatus('Error loading data', true);
        });
        
    } catch (error) {
        console.error('Error setting up data listener: ', error);
        updateFirebaseStatus('Error connecting to database', true);
    }
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

// Display data in tables
function displayData() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredSubmissions.slice(startIndex, endIndex);
    
    // Clear existing table data
    const tbody1 = document.getElementById('dataTableBody1');
    const tbody2 = document.getElementById('dataTableBody2');
    
    if (tbody1) tbody1.innerHTML = '';
    if (tbody2) tbody2.innerHTML = '';
    
    pageData.forEach(submission => {
        // Main pool table
        if (tbody1) {
            const row1 = document.createElement('tr');
            const timeString = submission.timestamp ? submission.timestamp.toLocaleString() : 'N/A';
            const isOld = submission.timestamp && (new Date() - submission.timestamp) > (3 * 60 * 60 * 1000); // 3 hours
            
            row1.innerHTML = `
                <td>${isOld ? '!!! ' : ''}${timeString}</td>
                <td>${submission.poolLocation || 'N/A'}</td>
                <td>${submission.mainPoolPH || 'N/A'}</td>
                <td>${submission.mainPoolCl || 'N/A'}</td>
                <td>${submission.sanitationMethod || 'N/A'}</td>
            `;
            tbody1.appendChild(row1);
        }
        
        // Secondary pool table (if data exists)
        if ((submission.secondaryPoolPH || submission.secondaryPoolCl) && tbody2) {
            const row2 = document.createElement('tr');
            const timeString = submission.timestamp ? submission.timestamp.toLocaleString() : 'N/A';
            const isOld = submission.timestamp && (new Date() - submission.timestamp) > (3 * 60 * 60 * 1000); // 3 hours
            
            row2.innerHTML = `
                <td>${isOld ? '!!! ' : ''}${timeString}</td>
                <td>${submission.poolLocation || 'N/A'}</td>
                <td>${submission.secondaryPoolPH || 'N/A'}</td>
                <td>${submission.secondaryPoolCl || 'N/A'}</td>
                <td>${submission.sanitationMethod || 'N/A'}</td>
            `;
            tbody2.appendChild(row2);
        }
    });
    
    updatePagination();
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

// Handle login form submission
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Simple authentication (you should use Firebase Auth for production)
            if ((username === 'supervisor' && password === 'poolchem2025') || 
                (username === 'capitalcity' && password === '$ummer2025')) {
                isLoggedIn = true;
                localStorage.setItem('isLoggedIn', 'true');
                document.getElementById('mainForm').style.display = 'none';
                document.getElementById('supervisorDashboard').style.display = 'block';
                closeLoginModal();
                loadDashboardData();
            } else {
                showFeedback('Invalid credentials', 'error');
            }
        });
    }
});

// Logout function
function logout() {
    isLoggedIn = false;
    localStorage.removeItem('isLoggedIn');
    document.getElementById('supervisorDashboard').style.display = 'none';
    document.getElementById('mainForm').style.display = 'block';
}

// ===================================================
// EXPORT FUNCTIONALITY
// ===================================================

function exportToCSV() {
    if (filteredSubmissions.length === 0) {
        showFeedback('No data to export', 'error');
        return;
    }
    
    const headers = ['Timestamp', 'Pool Location', 'Submitted By', 'Main Pool pH', 'Main Pool Cl', 'Secondary Pool pH', 'Secondary Pool Cl', 'Sanitation Method'];
    const csvContent = [
        headers.join(','),
        ...filteredSubmissions.map(submission => [
            submission.timestamp ? submission.timestamp.toLocaleString() : '',
            submission.poolLocation || '',
            submission.submittedBy || '',
            submission.mainPoolPH || '',
            submission.mainPoolCl || '',
            submission.secondaryPoolPH || '',
            submission.secondaryPoolCl || '',
            submission.sanitationMethod || ''
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-chemistry-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showFeedback('Data exported successfully!', 'success');
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
function handleSanitationChange(checkbox) {
    const pool = checkbox.dataset.pool;
    const method = checkbox.dataset.method;
    
    if (checkbox.checked) {
        // Uncheck the other method for this pool
        const otherMethod = method === 'bleach' ? 'granular' : 'bleach';
        const otherCheckbox = document.querySelector(`input[data-pool="${pool}"][data-method="${otherMethod}"]`);
        if (otherCheckbox) otherCheckbox.checked = false;
        
        // Update settings
        sanitationSettings[pool] = method;
    } else {
        // If unchecking, default to bleach
        sanitationSettings[pool] = 'bleach';
        const bleachCheckbox = document.querySelector(`input[data-pool="${pool}"][data-method="bleach"]`);
        if (bleachCheckbox) bleachCheckbox.checked = true;
    }
    
    console.log('Sanitation method changed:', pool, method, checkbox.checked);
    console.log('Current settings:', sanitationSettings);
    
    // Save settings
    saveSanitationSettings();
}

// ===================================================
// FEEDBACK & NOTIFICATIONS
// ===================================================

function showFeedback(message, type = 'info') {
    const modal = document.getElementById('feedbackModal');
    const content = document.getElementById('modalContent');
    
    if (modal && content) {
        content.textContent = message;
        modal.style.display = 'block';
        modal.style.backgroundColor = type === 'error' ? '#ffebee' : '#e8f5e8';
        modal.style.color = type === 'error' ? '#c62828' : '#2e7d32';
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            closeModal();
        }, 3000);
    } else {
        // Fallback to alert if modal not available
        alert(message);
    }
}

function closeModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// SMS functions (placeholder for future implementation)
function chooseAndSendSMS() {
    const selected = document.querySelector('input[name="smsRecipient"]:checked');
    if (selected) {
        showFeedback(`SMS would be sent to: ${selected.value}`, 'info');
    } else {
        showFeedback('Please select a recipient', 'error');
    }
}

// ===================================================
// GLOBAL FUNCTION ASSIGNMENTS
// ===================================================

// Make all functions available globally for HTML onclick handlers
console.log('🔥🔥🔥 ASSIGNING GLOBAL FUNCTIONS 🔥🔥🔥');

// Core functions
window.submitForm = submitForm;
window.handlePoolLocationChange = handlePoolLocationChange;

// Login functions
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.logout = logout;

// Dashboard functions
window.filterData = filterData;
window.goToPreviousPage = goToPreviousPage;
window.goToNextPage = goToNextPage;
window.exportToCSV = exportToCSV;

// Settings functions
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.handleSanitationChange = handleSanitationChange;

// Feedback functions
window.showFeedback = showFeedback;
window.closeModal = closeModal;
window.chooseAndSendSMS = chooseAndSendSMS;

// Firebase utility functions
window.updateFirebaseStatus = updateFirebaseStatus;
window.initializeFirebase = initializeFirebase;

// ===================================================
// FORM VALIDATION AND FEEDBACK SYSTEM
// ===================================================

// Function to evaluate form feedback after submission
function evaluateFormFeedback(data) {
    const { poolLocation, mainPoolPH, mainPoolCl, secondaryPoolPH, secondaryPoolCl, sanitationMethod } = data;
    
    const feedback = {
        alerts: [],
        warnings: [],
        suggestions: []
    };
    
    // Main pool pH evaluation
    const mainPH = parseFloat(mainPoolPH);
    if (mainPH < 7.2) {
        feedback.alerts.push('🚨 Main pool pH is LOW (< 7.2). Add pH increaser immediately.');
    } else if (mainPH > 7.8) {
        feedback.alerts.push('🚨 Main pool pH is HIGH (> 7.8). Add muriatic acid to lower pH.');
    } else if (mainPH < 7.4) {
        feedback.warnings.push('⚠️ Main pool pH is slightly low. Consider adding pH increaser.');
    } else if (mainPH > 7.6) {
        feedback.warnings.push('⚠️ Main pool pH is slightly high. Consider adding acid to lower pH.');
    }
    
    // Main pool chlorine evaluation
    const mainCl = parseFloat(mainPoolCl);
    if (sanitationMethod === 'bleach') {
        if (mainCl < 1.0) {
            feedback.alerts.push('🚨 Main pool chlorine is LOW (< 1.0 ppm). Add liquid bleach immediately.');
        } else if (mainCl > 3.0) {
            feedback.alerts.push('🚨 Main pool chlorine is HIGH (> 3.0 ppm). Stop adding chlorine and retest in 2 hours.');
        } else if (mainCl < 1.5) {
            feedback.warnings.push('⚠️ Main pool chlorine is getting low. Consider adding bleach.');
        } else if (mainCl > 2.5) {
            feedback.warnings.push('⚠️ Main pool chlorine is getting high. Monitor closely.');
        }
    } else if (sanitationMethod === 'granular') {
        if (mainCl < 2.0) {
            feedback.alerts.push('🚨 Main pool chlorine is LOW (< 2.0 ppm). Add granular chlorine immediately.');
        } else if (mainCl > 4.0) {
            feedback.alerts.push('🚨 Main pool chlorine is HIGH (> 4.0 ppm). Stop adding chlorine and retest in 2 hours.');
        } else if (mainCl < 3.0) {
            feedback.warnings.push('⚠️ Main pool chlorine is getting low. Consider adding granular chlorine.');
        } else if (mainCl > 3.5) {
            feedback.warnings.push('⚠️ Main pool chlorine is getting high. Monitor closely.');
        }
    }
    
    // Secondary pool evaluation (if applicable and not N/A)
    if (secondaryPoolPH !== 'N/A' && secondaryPoolCl !== 'N/A') {
        const secondaryPH = parseFloat(secondaryPoolPH);
        const secondaryCl = parseFloat(secondaryPoolCl);
        
        if (secondaryPH < 7.2) {
            feedback.alerts.push('🚨 Secondary pool pH is LOW (< 7.2). Add pH increaser immediately.');
        } else if (secondaryPH > 7.8) {
            feedback.alerts.push('🚨 Secondary pool pH is HIGH (> 7.8). Add muriatic acid to lower pH.');
        } else if (secondaryPH < 7.4) {
            feedback.warnings.push('⚠️ Secondary pool pH is slightly low. Consider adding pH increaser.');
        } else if (secondaryPH > 7.6) {
            feedback.warnings.push('⚠️ Secondary pool pH is slightly high. Consider adding acid to lower pH.');
        }
        
        if (sanitationMethod === 'bleach') {
            if (secondaryCl < 1.0) {
                feedback.alerts.push('🚨 Secondary pool chlorine is LOW (< 1.0 ppm). Add liquid bleach immediately.');
            } else if (secondaryCl > 3.0) {
                feedback.alerts.push('🚨 Secondary pool chlorine is HIGH (> 3.0 ppm). Stop adding chlorine and retest in 2 hours.');
            } else if (secondaryCl < 1.5) {
                feedback.warnings.push('⚠️ Secondary pool chlorine is getting low. Consider adding bleach.');
            } else if (secondaryCl > 2.5) {
                feedback.warnings.push('⚠️ Secondary pool chlorine is getting high. Monitor closely.');
            }
        } else if (sanitationMethod === 'granular') {
            if (secondaryCl < 2.0) {
                feedback.alerts.push('🚨 Secondary pool chlorine is LOW (< 2.0 ppm). Add granular chlorine immediately.');
            } else if (secondaryCl > 4.0) {
                feedback.alerts.push('🚨 Secondary pool chlorine is HIGH (> 4.0 ppm). Stop adding chlorine and retest in 2 hours.');
            } else if (secondaryCl < 3.0) {
                feedback.warnings.push('⚠️ Secondary pool chlorine is getting low. Consider adding granular chlorine.');
            } else if (secondaryCl > 3.5) {
                feedback.warnings.push('⚠️ Secondary pool chlorine is getting high. Monitor closely.');
            }
        }
    }
    
    // Add pool-specific suggestions
    feedback.suggestions.push(`💡 ${poolLocation} uses ${sanitationMethod} sanitation method.`);
    
    if (feedback.alerts.length === 0 && feedback.warnings.length === 0) {
        feedback.suggestions.push('✅ All chemical levels are within acceptable ranges. Great job!');
    }
    
    // Show feedback modal
    showFeedbackModal(feedback);
    
    // Check for critical alerts
    checkForCriticalAlerts(data);
}

// Function to show comprehensive feedback modal
function showFeedbackModal(feedback) {
    const modal = document.getElementById('feedbackModal');
    const alertsList = document.getElementById('alertsList');
    const warningsList = document.getElementById('warningsList');
    const suggestionsList = document.getElementById('suggestionsList');
    
    if (!modal) {
        console.log('Feedback modal not found');
        return;
    }
    
    // Clear previous content
    if (alertsList) alertsList.innerHTML = '';
    if (warningsList) warningsList.innerHTML = '';
    if (suggestionsList) suggestionsList.innerHTML = '';
    
    // Populate alerts
    if (feedback.alerts.length > 0 && alertsList) {
        feedback.alerts.forEach(alert => {
            const li = document.createElement('li');
            li.textContent = alert;
            alertsList.appendChild(li);
        });
        const alertsSection = document.getElementById('alertsSection');
        if (alertsSection) alertsSection.style.display = 'block';
    } else {
        const alertsSection = document.getElementById('alertsSection');
        if (alertsSection) alertsSection.style.display = 'none';
    }
    
    // Populate warnings
    if (feedback.warnings.length > 0 && warningsList) {
        feedback.warnings.forEach(warning => {
            const li = document.createElement('li');
            li.textContent = warning;
            warningsList.appendChild(li);
        });
        const warningsSection = document.getElementById('warningsSection');
        if (warningsSection) warningsSection.style.display = 'block';
    } else {
        const warningsSection = document.getElementById('warningsSection');
        if (warningsSection) warningsSection.style.display = 'none';
    }
    
    // Populate suggestions
    if (feedback.suggestions.length > 0 && suggestionsList) {
        feedback.suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            suggestionsList.appendChild(li);
        });
        const suggestionsSection = document.getElementById('suggestionsSection');
        if (suggestionsSection) suggestionsSection.style.display = 'block';
    } else {
        const suggestionsSection = document.getElementById('suggestionsSection');
        if (suggestionsSection) suggestionsSection.style.display = 'none';
    }
    
    // Show modal
    modal.style.display = 'block';
}

// Function to close feedback modal
function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===================================================
// ENHANCED DASHBOARD AND DATA MANAGEMENT
// ===================================================

// Enhanced dashboard data display with color coding
function displayDashboardData(submissions) {
    const tableBody = document.getElementById('dashboardTableBody');
    if (!tableBody) return;
    
    filteredData = submissions;
    
    // Apply current page and pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    paginatedData = filteredData.slice(startIndex, endIndex);
    
    tableBody.innerHTML = '';
    
    paginatedData.forEach(submission => {
        const row = document.createElement('tr');
        
        // Determine row color based on chemical levels
        const rowClass = getRowColorClass(submission);
        if (rowClass) {
            row.classList.add(rowClass);
        }
        
        // Format timestamp
        const timestamp = submission.timestamp instanceof Date ? 
            submission.timestamp : new Date(submission.timestamp);
        const formattedTime = timestamp.toLocaleString();
        
        // Handle secondary pool data
        const hasSecondaryPool = submission.secondaryPoolPH !== 'N/A' && submission.secondaryPoolCl !== 'N/A';
        const secondaryPoolDisplay = hasSecondaryPool ? 
            `pH: ${submission.secondaryPoolPH}, Cl: ${submission.secondaryPoolCl}` : 'N/A';
        
        row.innerHTML = `
            <td>${submission.submittedBy || 'Unknown'}</td>
            <td>${submission.poolLocation}</td>
            <td>pH: ${submission.mainPoolPH}, Cl: ${submission.mainPoolCl}</td>
            <td>${secondaryPoolDisplay}</td>
            <td>${submission.sanitationMethod || 'Unknown'}</td>
            <td>${formattedTime}</td>
            <td>
                <button onclick="deleteSubmission('${submission.id}')" class="delete-btn">Delete</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update pagination
    updatePaginationControls();
}

// Get row color class based on chemical levels
function getRowColorClass(submission) {
    const mainPH = parseFloat(submission.mainPoolPH);
    const mainCl = parseFloat(submission.mainPoolCl);
    const sanitationMethod = submission.sanitationMethod || 'bleach';
    
    let hasAlert = false;
    let hasWarning = false;
    
    // Check main pool levels
    if (mainPH < 7.2 || mainPH > 7.8) hasAlert = true;
    else if (mainPH < 7.4 || mainPH > 7.6) hasWarning = true;
    
    if (sanitationMethod === 'bleach') {
        if (mainCl < 1.0 || mainCl > 3.0) hasAlert = true;
        else if (mainCl < 1.5 || mainCl > 2.5) hasWarning = true;
    } else if (sanitationMethod === 'granular') {
        if (mainCl < 2.0 || mainCl > 4.0) hasAlert = true;
        else if (mainCl < 3.0 || mainCl > 3.5) hasWarning = true;
    }
    
    // Check secondary pool if applicable
    if (submission.secondaryPoolPH !== 'N/A' && submission.secondaryPoolCl !== 'N/A') {
        const secondaryPH = parseFloat(submission.secondaryPoolPH);
        const secondaryCl = parseFloat(submission.secondaryPoolCl);
        
        if (secondaryPH < 7.2 || secondaryPH > 7.8) hasAlert = true;
        else if (secondaryPH < 7.4 || secondaryPH > 7.6) hasWarning = true;
        
        if (sanitationMethod === 'bleach') {
            if (secondaryCl < 1.0 || secondaryCl > 3.0) hasAlert = true;
            else if (secondaryCl < 1.5 || secondaryCl > 2.5) hasWarning = true;
        } else if (sanitationMethod === 'granular') {
            if (secondaryCl < 2.0 || secondaryCl > 4.0) hasAlert = true;
            else if (secondaryCl < 3.0 || secondaryCl > 3.5) hasWarning = true;
        }
    }
    
    if (hasAlert) return 'alert-row';
    if (hasWarning) return 'warning-row';
    return null;
}

// Delete submission with confirmation
async function deleteSubmission(submissionId) {
    if (!confirm('Are you sure you want to delete this submission?')) {
        return;
    }
    
    try {
        await window.firebase.deleteDoc(window.firebase.doc(db, 'poolSubmissions', submissionId));
        showMessage('Submission deleted successfully', 'success');
        await loadDashboardData();
    } catch (error) {
        console.error('Error deleting submission:', error);
        showMessage('Error deleting submission', 'error');
    }
}

// ===================================================
// ADVANCED PAGINATION SYSTEM
// ===================================================

// Update pagination controls with enhanced features
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginationDiv = document.getElementById('paginationControls');
    
    if (!paginationDiv) return;
    
    paginationDiv.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    paginationDiv.appendChild(prevBtn);
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.classList.toggle('active', i === currentPage);
            pageBtn.onclick = () => changePage(i);
            paginationDiv.appendChild(pageBtn);
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.margin = '0 5px';
            paginationDiv.appendChild(ellipsis);
        }
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    paginationDiv.appendChild(nextBtn);
    
    // Page info
    const pageInfo = document.createElement('div');
    pageInfo.style.marginTop = '10px';
    pageInfo.style.textAlign = 'center';
    pageInfo.style.fontSize = '14px';
    pageInfo.style.color = '#666';
    
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);
    
    pageInfo.textContent = `Showing ${startItem}-${endItem} of ${filteredData.length} submissions`;
    paginationDiv.appendChild(pageInfo);
}

// Change page with validation
function changePage(newPage) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayDashboardData(formSubmissions);
    }
}

// ===================================================
// ENHANCED FILTERING AND SEARCH
// ===================================================

// Filter data by pool location
function filterByPool() {
    const selectedPool = document.getElementById('poolFilter').value;
    
    if (selectedPool === 'all') {
        filteredData = formSubmissions;
    } else {
        filteredData = formSubmissions.filter(submission => 
            submission.poolLocation === selectedPool
        );
    }
    
    currentPage = 1; // Reset to first page
    displayDashboardData(formSubmissions);
}

// Search submissions with enhanced matching
function searchSubmissions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        filteredData = formSubmissions;
    } else {
        filteredData = formSubmissions.filter(submission => 
            submission.submittedBy.toLowerCase().includes(searchTerm) ||
            submission.poolLocation.toLowerCase().includes(searchTerm) ||
            submission.mainPoolPH.toString().includes(searchTerm) ||
            submission.mainPoolCl.toString().includes(searchTerm) ||
            (submission.secondaryPoolPH && submission.secondaryPoolPH.toString().includes(searchTerm)) ||
            (submission.secondaryPoolCl && submission.secondaryPoolCl.toString().includes(searchTerm))
        );
    }
    
    currentPage = 1; // Reset to first page
    displayDashboardData(formSubmissions);
}

// Clear search and filters
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('poolFilter').value = 'all';
    filteredData = formSubmissions;
    currentPage = 1;
    displayDashboardData(formSubmissions);
}

// ===================================================
// ENHANCED AUTHENTICATION SYSTEM
// ===================================================

// Handle login form submission with validation
function handleLoginSubmit(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Check credentials
    if (supervisorCredentials[username] && supervisorCredentials[username] === password) {
        // Set login token with 8-hour expiration
        const loginToken = {
            username: username,
            expires: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
        };
        localStorage.setItem('loginToken', JSON.stringify(loginToken));
        localStorage.setItem('isLoggedIn', 'true');
        
        showDashboard();
        showMessage('Login successful!', 'success');
    } else {
        showMessage('Invalid username or password', 'error');
        document.getElementById('password').value = '';
    }
}

// Show dashboard with enhanced features
function showDashboard() {
    isLoggedIn = true;
    currentView = 'dashboard';
    
    document.getElementById('mainForm').style.display = 'none';
    document.getElementById('supervisorDashboard').style.display = 'block';
    
    // Load dashboard data
    loadDashboardData();
}

// Enhanced logout function
function logout() {
    isLoggedIn = false;
    currentView = 'form';
    
    localStorage.removeItem('loginToken');
    localStorage.removeItem('isLoggedIn');
    
    document.getElementById('mainForm').style.display = 'block';
    document.getElementById('supervisorDashboard').style.display = 'none';
    
    // Clear forms
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    showMessage('Logged out successfully', 'success');
}

// ===================================================
// ENHANCED SETTINGS MANAGEMENT
// ===================================================

// Show settings modal with current values
function showSettings() {
    document.getElementById('settingsModal').style.display = 'block';
    loadSanitationSettings();
}

// Close settings modal
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Handle sanitation method change with validation
function handleSanitationChange(pool, method) {
    // Uncheck other method for this pool
    const otherMethod = method === 'bleach' ? 'granular' : 'bleach';
    const otherCheckbox = document.querySelector(`input[data-pool="${pool}"][data-method="${otherMethod}"]`);
    if (otherCheckbox) {
        otherCheckbox.checked = false;
    }
    
    // Update settings
    sanitationSettings[pool] = method;
    console.log(`Updated ${pool} to ${method} sanitation method`);
    
    // Save settings
    saveSanitationSettings();
}

// Save settings with confirmation
function saveSettings() {
    saveSanitationSettings();
    closeSettings();
    showMessage('Settings saved successfully!', 'success');
}

// ===================================================
// COMPREHENSIVE MODAL MANAGEMENT
// ===================================================

// Close modal when clicking outside
window.onclick = function(event) {
    const settingsModal = document.getElementById('settingsModal');
    const feedbackModal = document.getElementById('feedbackModal');
    
    if (event.target === settingsModal) {
        closeSettings();
    }
    if (event.target === feedbackModal) {
        closeFeedbackModal();
    }
}

// ===================================================
// SMS AND CRITICAL NOTIFICATIONS
// ===================================================

// Check for critical alerts and handle notifications
function checkForCriticalAlerts(formData) {
    const alerts = [];
    const mainPH = parseFloat(formData.mainPoolPH);
    const mainCl = parseFloat(formData.mainPoolCl);
    
    // Critical pH levels
    if (mainPH < 7.0 || mainPH > 8.0) {
        alerts.push(`CRITICAL: ${formData.poolLocation} main pool pH is ${mainPH}`);
    }
    
    // Critical chlorine levels
    if (mainCl < 0.5 || mainCl > 5.0) {
        alerts.push(`CRITICAL: ${formData.poolLocation} main pool chlorine is ${mainCl} ppm`);
    }
    
    // Check secondary pool if applicable
    if (formData.secondaryPoolPH !== 'N/A' && formData.secondaryPoolCl !== 'N/A') {
        const secondaryPH = parseFloat(formData.secondaryPoolPH);
        const secondaryCl = parseFloat(formData.secondaryPoolCl);
        
        if (secondaryPH < 7.0 || secondaryPH > 8.0) {
            alerts.push(`CRITICAL: ${formData.poolLocation} secondary pool pH is ${secondaryPH}`);
        }
        
        if (secondaryCl < 0.5 || secondaryCl > 5.0) {
            alerts.push(`CRITICAL: ${formData.poolLocation} secondary pool chlorine is ${secondaryCl} ppm`);
        }
    }
    
    // For future SMS implementation
    if (alerts.length > 0) {
        console.log('Critical alerts detected:', alerts);
        // Future: sendSMSNotification(alerts.join('\n'), supervisorPhoneNumber);
    }
}

// Send SMS notification (placeholder for future backend integration)
function sendSMSNotification(message, phoneNumber) {
    console.log(`SMS would be sent to ${phoneNumber}: ${message}`);
    // This would integrate with a service like Twilio in a real implementation
    // For now, show as console message and could be enhanced with webhook
}

// ===================================================
// EXPORT AND REPORTING FUNCTIONS
// ===================================================

// Export filtered data to CSV
function exportToCSV() {
    if (filteredData.length === 0) {
        showMessage('No data to export', 'error');
        return;
    }
    
    const headers = ['Submitted By', 'Pool Location', 'Main Pool pH', 'Main Pool Cl', 'Secondary Pool pH', 'Secondary Pool Cl', 'Sanitation Method', 'Timestamp'];
    const csvContent = [
        headers.join(','),
        ...filteredData.map(row => [
            `"${row.submittedBy || ''}"`,
            `"${row.poolLocation || ''}"`,
            row.mainPoolPH || '',
            row.mainPoolCl || '',
            row.secondaryPoolPH || '',
            row.secondaryPoolCl || '',
            `"${row.sanitationMethod || ''}"`,
            `"${row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-submissions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showMessage('Data exported successfully!', 'success');
}

// Generate comprehensive summary report
function generateSummaryReport() {
    if (filteredData.length === 0) {
        showMessage('No data available for report', 'error');
        return;
    }
    
    const poolCounts = {};
    const sanitationCounts = { bleach: 0, granular: 0 };
    let alertCount = 0;
    let warningCount = 0;
    
    filteredData.forEach(submission => {
        // Count by pool
        poolCounts[submission.poolLocation] = (poolCounts[submission.poolLocation] || 0) + 1;
        
        // Count by sanitation method
        const method = submission.sanitationMethod || 'unknown';
        if (sanitationCounts.hasOwnProperty(method)) {
            sanitationCounts[method]++;
        }
        
        // Count alerts and warnings
        const rowClass = getRowColorClass(submission);
        if (rowClass === 'alert-row') alertCount++;
        else if (rowClass === 'warning-row') warningCount++;
    });
    
    const report = `
=== POOL CHEMISTRY SUMMARY REPORT ===
Generated: ${new Date().toLocaleString()}
Total Submissions: ${filteredData.length}

SUBMISSIONS BY POOL:
${Object.entries(poolCounts).map(([pool, count]) => `${pool}: ${count}`).join('\n')}

SANITATION METHODS:
Bleach: ${sanitationCounts.bleach}
Granular: ${sanitationCounts.granular}

ALERT SUMMARY:
Critical Alerts: ${alertCount}
Warnings: ${warningCount}
Normal: ${filteredData.length - alertCount - warningCount}

Alert Rate: ${((alertCount / filteredData.length) * 100).toFixed(1)}%
    `;
    
    // Create modal or alert with report
    alert(report);
}

// ===================================================
// ENHANCED GLOBAL FUNCTION ASSIGNMENTS
// ===================================================

// Override and enhance existing global assignments
console.log('🔥🔥🔥 ASSIGNING COMPREHENSIVE GLOBAL FUNCTIONS 🔥🔥🔥');

// Enhanced core functions
window.submitForm = submitForm;
window.handlePoolLocationChange = handlePoolLocationChange;
window.evaluateFormFeedback = evaluateFormFeedback;
window.showFeedbackModal = showFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;

// Enhanced authentication
window.handleLoginSubmit = handleLoginSubmit;
window.showDashboard = showDashboard;
window.logout = logout;
window.checkLogin = checkLogin;

// Enhanced dashboard functions
window.displayDashboardData = displayDashboardData;
window.getRowColorClass = getRowColorClass;
window.deleteSubmission = deleteSubmission;
window.filterByPool = filterByPool;
window.searchSubmissions = searchSubmissions;
window.clearSearch = clearSearch;

// Enhanced pagination
window.updatePaginationControls = updatePaginationControls;
window.changePage = changePage;

// Enhanced settings
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.handleSanitationChange = handleSanitationChange;
window.saveSettings = saveSettings;

// Enhanced export and reporting
window.exportToCSV = exportToCSV;
window.generateSummaryReport = generateSummaryReport;

// Critical alerts and notifications
window.checkForCriticalAlerts = checkForCriticalAlerts;
window.sendSMSNotification = sendSMSNotification;

// Maintain backward compatibility with existing functions
window.filterData = filterByPool; // Alias for backward compatibility
window.goToPreviousPage = () => changePage(currentPage - 1);
window.goToNextPage = () => changePage(currentPage + 1);
window.openSettings = showSettings; // Alias for backward compatibility
window.openLoginModal = () => showMessage('Please use the login form', 'info');
window.closeLoginModal = () => showMessage('Login form closed', 'info');

console.log('🔥✅ COMPREHENSIVE FUNCTIONALITY FULLY LOADED AND ASSIGNED');
console.log('🔥🔥🔥 UNIFIED APP.JS COMPLETE WITH ALL FEATURES 🔥🔥🔥');
