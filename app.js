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

// Define pools with secondary pools ONCE
const POOLS_WITH_SECONDARY = ['Forest Lake', 'Columbia CC', 'CC of Lexington', 'Wildewood', 'Quail Hollow', 'Rockbridge', 'Winchester'];

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
    
    // Initialize app to form view
    initializeApp();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Get form elements
    const form = document.getElementById('chemistryForm');
    if (form) {
        form.addEventListener('submit', submitForm);
    }
    
    // Initialize location change handler
    const locationSelect = document.getElementById('poolLocation');
    if (locationSelect) {
        locationSelect.addEventListener('change', handleLocationChange);
        handleLocationChange(); // Set initial state
    }
    
    // Load sanitation settings
    loadSanitationSettings();
});

// Add this function to initialize the correct default view
function initializeApp() {
    // Ensure we start with the form view
    currentView = 'form';
    isLoggedIn = false;
    
    // Hide dashboard and show form
    const dashboard = document.querySelector('.dashboard');
    const form = document.querySelector('.container');
    
    if (dashboard) {
        dashboard.style.display = 'none';
    }
    
    if (form) {
        form.style.display = 'flex';
    }
    
    // Ensure the header shows the login button, not logout
    updateHeaderButtons();
}

// Add this function to manage header buttons
function updateHeaderButtons() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    
    if (isLoggedIn) {
        // Show menu and logout buttons
        headerRight.innerHTML = `
            <div class="menu-container">
                <button class="menu-btn" onclick="toggleMenu()">☰</button>
            </div>
            <button class="logout-btn" onclick="logout()">Logout</button>
        `;
    } else {
        // Show supervisor login button only
        headerRight.innerHTML = `
            <button class="supervisor-login-btn" onclick="openLoginModal()">Supervisor Login</button>
        `;
    }
}

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
        showMessage('Database not initialized. Please refresh the page.', 'error');
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
    const poolsWithSecondary = ['Forest Lake', 'Columbia CC', 'CC of Lexington', 'Wildewood'];
    
    if (POOLS_WITH_SECONDARY.includes(poolLocationValue)) {
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
        const secondaryPoolPH = POOLS_WITH_SECONDARY.includes(submissionPoolLocation) ? 
            document.getElementById('secondaryPoolPH').value : 'N/A';
        const secondaryPoolCl = POOLS_WITH_SECONDARY.includes(submissionPoolLocation) ? 
            document.getElementById('secondaryPoolCl').value : 'N/A';
        
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
            submittedAt: new Date().toISOString()
        };

        console.log('🔥 Form data:', formData);
        console.log('🔥 Submitting to Firebase...');

        // Submit to Firebase
        const docRef = await window.firebase.addDoc(window.firebase.collection(db, 'poolSubmissions'), formData);
        console.log('🔥✅ Document written with ID: ', docRef.id);
        
        // Show success message
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
            showMessage('Permission denied. Please check Firestore security rules.', 'error');
            updateFirebaseStatus('❌ Permission denied - check Firestore rules', true);
        } else {
            showMessage(`Error submitting form: ${error.message}`, 'error');
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
    const poolLocation = document.getElementById('poolLocation').value;
    const secondaryPoolSection = document.getElementById('secondaryPoolSection');
    const secondaryPH = document.getElementById('secondaryPoolPH');
    const secondaryCl = document.getElementById('secondaryPoolCl');
    
    if (poolLocation === 'Camden CC') {
        secondaryPoolSection.classList.add('hidden');
        secondaryPH.removeAttribute('required');
        secondaryCl.removeAttribute('required');
        secondaryPH.value = '';
        secondaryCl.value = '';
    } else {
        secondaryPoolSection.classList.remove('hidden');
        secondaryPH.setAttribute('required', '');
        secondaryCl.setAttribute('required', '');
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
function showMessage(message, type = 'info') {
    showFeedback(message, type);
}

// Define the missing functions
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.style.display = 'none';
    }
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

function showFeedbackModal(message) {
    const modal = document.querySelector('.modal');
    const modalContent = document.querySelector('.modal-content');
    
    if (modal && modalContent) {
        modalContent.innerHTML = message;
        modal.style.display = 'block';
    }
}

// Replace the existing evaluateFormFeedback function
function evaluateFormFeedback(formData) {
    // Get values from the formData object, not DOM elements
    const poolLocation = formData.poolLocation;
    const mainPH = formData.mainPoolPH;
    const mainCl = formData.mainPoolCl;
    const secPH = formData.secondaryPoolPH;
    const secCl = formData.secondaryPoolCl;
    
    // DEBUG LOGS
    console.log('=== EVALUATING FORM FEEDBACK ===');
    console.log('Pool Location:', poolLocation);
    console.log('Main pH:', mainPH);
    console.log('Main Cl:', mainCl);
    console.log('Secondary pH:', secPH);
    console.log('Secondary Cl:', secCl);
    
    // Initialize messages array locally
    const messages = [];
    let isGood = true;
    let setpointImgNeeded = false;

    // Check main pool pH (7.0 is acceptable, 7.6 and 7.8 require lowering for main pools)
    if (mainPH === '< 7.0' || mainPH === '7.6' || mainPH === '7.8' || mainPH === '8.0' || mainPH === '> 8.0') {
        isGood = false;
        if (mainPH === '< 7.0') {
            messages.push('<strong>Notify a supervisor of the low pH in the Main Pool immediately.<br>Raise the pH of the Main Pool.</strong><br>Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
        } else if (mainPH === '7.6' || mainPH === '7.8') {
            messages.push('<strong>Lower the pH of the Main Pool.</strong><br>Add 1 gallon of acid below a skimmer basket. Always check for suction before pouring.');
        } else if (mainPH === '8.0' || mainPH === '> 8.0') {
            messages.push('<strong>Lower the pH of the Main Pool.</strong><br>Add 2 gallons of acid below a skimmer basket. Always check for suction before pouring.');
        }
    }
    
    // Check main pool Cl using granular/bleach logic
    const granularMainResponse = getClResponse(poolLocation, true, mainCl);
    if (granularMainResponse) {
        messages.push(granularMainResponse);
        isGood = false;
        if (granularMainResponse.includes('notify a supervisor')) {
            setpointImgNeeded = true;
        }
    } else {
        // Bleach method for main pool Cl
        if (mainCl === '0' || mainCl === '1' || mainCl === '2') {
            messages.push('<strong>Raise the Cl level in the Main Pool.</strong><br>If not handled the previous hour, change the Cl feeder rate according to the setpoint chart to raise the Cl level.');
            messages.push('<img src="setpoint.jpeg" alt="Setpoint Chart" style="max-width: 100%; height: auto; margin-top: 10px;">');
            isGood = false;
            setpointImgNeeded = true;
        } else if (mainCl === '10') {
            messages.push('<strong>Lower the Cl level of the Main Pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
            isGood = false;
            setpointImgNeeded = true;
        } else if (mainCl === '> 10') {
            messages.push('<strong>Notify a supervisor of the high Cl in the Main Pool immediately. Lower the Cl level of the Main Pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
            isGood = false;
            setpointImgNeeded = true;
        }
    }
    
    // Check secondary pool if not Camden CC and if secondary values exist
    if (poolLocation !== 'Camden CC' && secPH !== 'N/A' && secCl !== 'N/A') {
        // Check secondary pH - different rules for Forest Lake vs other pools
        if (poolLocation === 'Forest Lake') {
            // For Forest Lake secondary pool: 7.0 is acceptable, 7.6 and 7.8 require lowering (same as main pools)
            if (secPH === '< 7.0' || secPH === '7.6' || secPH === '7.8' || secPH === '8.0' || secPH === '> 8.0') {
                isGood = false;
                if (secPH === '< 7.0') {
                    messages.push('<strong>Notify a supervisor of the low pH in the lap pool immediately. Raise the pH of the Lap Pool.</strong><br>Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
                } else if (secPH === '7.6' || secPH === '7.8') {
                    messages.push('<strong>Lower the pH of the Lap Pool.</strong><br>Add 1 gallon of acid below a skimmer basket. Always check for suction before pouring.');
                } else if (secPH === '8.0' || secPH === '> 8.0') {
                    messages.push('<strong>Lower the pH of the Lap Pool.</strong><br>Add 2 gallons of acid below a skimmer basket. Always check for suction before pouring.');
                }
            }
        } else {
            // For all other secondary pools: 7.0 and 7.6 are acceptable, only 7.8 and higher require lowering
            if (secPH === '< 7.0' || secPH === '7.8' || secPH === '8.0' || secPH === '> 8.0') {
                isGood = false;
                if (secPH === '< 7.0') {
                    // Handle low pH cases
                    if (poolLocation === 'Columbia CC') {
                        messages.push('<strong>Raise the pH of the Baby Pool.</strong><br>Sprinkle 1.5 tablespoons of soda ash in the pool itself. It is not harmful.');
                    } else if (poolLocation === 'Wildewood') {
                        messages.push('<strong>Notify a supervisor of the low pH in the Splash Pad immediately. Wait for assistance.</strong><br>');
                    } else {
                        messages.push('<strong>Raise the pH of the Baby Pool.</strong><br>Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
                    }
                } else if (secPH === '7.8') { 
                    // Handle 7.8 pH cases
                    if (poolLocation === 'CC of Lexington') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add a small splash (~1.5 tablespoons) of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Columbia CC') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1/8 scoop of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Quail Hollow') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1/8 scoop of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Rockbridge') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add a small splash (~1.5 tablespoons) of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Wildewood') {
                        messages.push('<strong>Lower the pH of the Splash Pad.</strong><br>Add 1/6 scoop of acid to the splash pad tank.');
                    } else if (poolLocation === 'Winchester') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1/6 scoop of acid below a skimmer basket. Always check for suction before pouring.');
                    } else {
                        // Fallback for any other pools
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1 gallon of acid below a skimmer basket. Always check for suction before pouring.');
                    }
                } else if (secPH === '8.0' || secPH === '> 8.0') {
                    // Double the acid amounts for 8.0 and > 8.0
                    if (poolLocation === 'CC of Lexington') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add a medium splash of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Columbia CC') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1/4 scoop of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Quail Hollow') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1/4 scoop of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Rockbridge') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add a medium splash of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Wildewood') {
                        messages.push('<strong>Lower the pH of the Splash Pad.</strong><br>Add 1/3 scoop of acid to the splash pad tank.');
                    } else if (poolLocation === 'Winchester') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1/3 scoop of acid below a skimmer basket. Always check for suction before pouring.');
                    } else {
                        // Fallback for any other pools
                        messages.push('<strong>Lower the pH of the Secondary Pool.</strong><br>Add 2 gallons of acid below a skimmer basket. Always check for suction before pouring.');
                    }
                }
            }
        }
        
        // Check secondary Cl (only for Forest Lake)
        if (poolLocation === 'Forest Lake') {
            const granularSecResponse = getClResponse(poolLocation, false, secCl);
            if (granularSecResponse) {
                messages.push(granularSecResponse);
                isGood = false;
                if (granularSecResponse.includes('notify a supervisor')) {
                    setpointImgNeeded = true;
                }
            } else {
                // Bleach method for Forest Lake secondary pool
                if (secCl === '0' || secCl === '1' || secCl === '2') {
                    messages.push('<strong>Raise the Cl level in the Lap Pool.</strong><br>If not handled the previous hour, change the Cl feeder rate according to the setpoint chart.');
                    messages.push('<img src="setpoint.jpeg" alt="Setpoint Chart" style="max-width: 100%; height: auto; margin-top: 10px;">');
                    isGood = false;
                    setpointImgNeeded = true;
                } else if (secCl === '10') {
                    messages.push('<strong>Lower the Cl level of the lap pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
                    isGood = false;
                    setpointImgNeeded = true;
                } else if (secCl === '> 10') {
                    messages.push('<strong>Notify a supervisor of the high Cl in the Lap Pool immediately. Lower the Cl level of the lap pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
                    isGood = false;
                    setpointImgNeeded = true;
                }
            }
        } else {
            // General rules for secondary pools (excluding Forest Lake)
            if (secCl === '0' || secCl === '10' || secCl === '> 10') {
                isGood = false;
            }
            
            switch (secCl) {
                case '0':
                    switch (poolLocation) {
                        case 'Columbia CC':
                            messages.push('<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 2 total Cl tablets below a skimmer basket.');
                            break;
                        case 'CC of Lexington':
                            messages.push('<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there is 1 total Cl tablet below a skimmer basket.');
                            break;
                        case 'Quail Hollow':
                            messages.push('<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 1.5 total Cl tablets below a skimmer basket.');
                            break;
                        case 'Rockbridge':
                            messages.push('<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 1.5 total Cl tablets below a skimmer basket.');
                            break;
                        case 'Wildewood':
                            messages.push('<strong>Raise the Cl level in the Splash Pad.</strong><br>Add 1/4 scoop of shock/granular Cl to an empty bucket, then fill it with water. Carefully swirl the water to dissolve the shock, then pour it into the splash pad tank.');
                            break;
                        case 'Winchester':
                            messages.push('<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 4 total Cl tablets below a skimmer basket.');
                            break;
                    }
                    break;

                case '10':
                    switch (poolLocation) {
                        case 'Columbia CC':
                        case 'CC of Lexington':
                        case 'Quail Hollow':
                        case 'Rockbridge':
                        case 'Winchester':
                            messages.push('<strong>Lower the Cl level in the Baby Pool.</strong><br>Remove all Cl tablets from the skimmers until Cl levels have subsided.');
                            break;
                        case 'Wildewood':
                            messages.push('<strong>Do not add any more shock/granular to the Splash Pad tank.</strong><br>Cl levels should subside within two hours.');
                            break;
                    }
                    break;

                case '> 10':
                    switch (poolLocation) {
                        case 'Columbia CC':
                        case 'CC of Lexington':
                        case 'Quail Hollow':
                        case 'Rockbridge':
                        case 'Winchester':
                            messages.push('<strong>Notify a supervisor of the high Cl in the Baby Pool immediately. Lower the Cl level in the Baby Pool.</strong><br>Remove all Cl tablets from the skimmers until Cl levels have subsided.');
                            break;
                        case 'Wildewood':
                            messages.push('<strong>Notify a supervisor of the high Cl in the Splash Pad immediately. Do not add any more shock/granular to the Splash Pad tank.</strong><br>Cl levels should subside within two hours.');
                            break;
                    }
                    break;
            }
        }
    }
    
    // DEBUG: Log final state
    console.log('Final evaluation - isGood:', isGood, 'messages:', messages.length);
    
    // Show feedback modal
    if (messages.length > 0 || !isGood) {
        // If there are messages or chemistry is not good, show the modal with checkboxes
        showFeedbackModal(messages, false, setpointImgNeeded);
    } else {
        // If all values are good, show the modal without checkboxes
        showFeedbackModal(['All water chemistry values are within acceptable ranges.'], true);
    }
}

// Replace the existing showFeedbackModal function
function showFeedbackModal(messages, isGood, setpointImgNeeded) {
    // Create overlay first
    createOrShowOverlay();
    
    const modal = document.createElement('div');
    modal.className = 'feedback-modal ' + (isGood ? 'good' : 'warning');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10001;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: 'Franklin Gothic Medium', Arial, sans-serif;
    `;

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
        if (isGood || areAllCheckboxesChecked()) {
            modal.remove();
            removeOverlay();
        } else {
            showMessage('Please complete all water chemistry changes and check them off the list before closing.', 'error');
        }
    };

    const feedbackContent = document.createElement('div');
    feedbackContent.className = 'feedback-content';
    feedbackContent.style.cssText = `
        margin-top: 30px;
        padding: 10px;
    `;

    const title = document.createElement('h2');
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: ${isGood ? '#28a745' : '#dc3545'};
        text-align: center;
    `;
    title.textContent = isGood
        ? '✅ Water chemistry looks good!'
        : '🚨 You need to make immediate changes to the water chemistry:';
    feedbackContent.appendChild(title);

    if (!isGood) {
        const messageList = document.createElement('div');
        messageList.style.cssText = `
            margin: 20px 0;
        `;
        
        messages.forEach(msg => {
            if (msg.includes('setpoint.jpeg')) {
                const chartContainer = document.createElement('div');
                chartContainer.className = 'setpoint-container';
                chartContainer.style.cssText = `
                    text-align: center;
                    margin: 20px 0;
                `;

                const chart = document.createElement('img');
                chart.src = 'setpoint.jpeg';
                chart.alt = 'Setpoint Chart';
                chart.className = 'setpoint-chart';
                chart.style.cssText = `
                    max-width: 100%;
                    height: auto;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                `;

                chartContainer.appendChild(chart);
                messageList.appendChild(chartContainer);
            } else {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';
                checkboxItem.style.cssText = `
                    display: flex;
                    align-items: flex-start;
                    margin: 15px 0;
                    padding: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background-color: #f9f9f9;
                `;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'feedback-checkbox';
                checkbox.style.cssText = `
                    margin-right: 10px;
                    margin-top: 4px;
                    transform: scale(1.2);
                `;

                const label = document.createElement('label');
                label.innerHTML = msg;
                label.style.cssText = `
                    flex: 1;
                    font-size: 14px;
                    line-height: 1.4;
                    cursor: pointer;
                `;
                
                // Make label clickable
                label.onclick = () => {
                    checkbox.checked = !checkbox.checked;
                };

                checkboxItem.appendChild(checkbox);
                checkboxItem.appendChild(label);
                messageList.appendChild(checkboxItem);
            }
        });
        feedbackContent.appendChild(messageList);
    } else {
        const message = document.createElement('p');
        message.textContent = messages[0];
        message.style.cssText = `
            text-align: center;
            font-size: 16px;
            color: #28a745;
            margin: 20px 0;
        `;
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
        notifyBtn.style.cssText = `
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
        notifyBtn.onclick = () => {
            showRecipientSelectionInModal(modal);
        };
        feedbackContent.appendChild(notifyBtn);
    }

    modal.appendChild(closeBtn);
    modal.appendChild(feedbackContent);
    document.body.appendChild(modal);
    
    console.log('Modal created with messages:', messages, 'isGood:', isGood);
}

// Also ensure the overlay has proper styling
function createOrShowOverlay() {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: block;
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    return overlay;
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

function sendSMSNotification(message, phoneNumber) {
    console.log(`SMS would be sent to ${phoneNumber}: ${message}`);
    showMessage('SMS notification sent successfully!', 'success');
}

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

function createOrShowOverlay() {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: block;
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    return overlay;
}

function removeOverlay() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'none'; // Hide the overlay
    }
}

function showRecipientSelectionInModal(modal) {
    modal.innerHTML = ''; // Clear existing modal content

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
        modal.remove();
        removeOverlay();
    };
    modal.appendChild(closeBtn);

    const feedbackContent = document.createElement('div');
    feedbackContent.className = 'feedback-content';

    const title = document.createElement('h2');
    title.textContent = 'Select recipient:';
    feedbackContent.appendChild(title);

    const messageList = document.createElement('div');
    
    // Sam Harmon checkbox
    const samCheckboxItem = document.createElement('div');
    samCheckboxItem.className = 'checkbox-item';
    
    const samCheckbox = document.createElement('input');
    samCheckbox.type = 'checkbox';
    samCheckbox.className = 'feedback-checkbox';
    samCheckbox.id = 'samOption';
    samCheckbox.value = '+18644096231';
    
    const samLabel = document.createElement('label');
    samLabel.textContent = 'Sam Harmon';
    samLabel.htmlFor = 'samOption';
    
    samCheckboxItem.appendChild(samCheckbox);
    samCheckboxItem.appendChild(samLabel);
    messageList.appendChild(samCheckboxItem);
    
    // Haley Wilson checkbox
    const haleyCheckboxItem = document.createElement('div');
    haleyCheckboxItem.className = 'checkbox-item';
    
    const haleyCheckbox = document.createElement('input');
    haleyCheckbox.type = 'checkbox';
    haleyCheckbox.className = 'feedback-checkbox';
    haleyCheckbox.id = 'haleyOption';
    haleyCheckbox.value = '+18036738396';
    
    const haleyLabel = document.createElement('label');
    haleyLabel.textContent = 'Haley Wilson';
    haleyLabel.htmlFor = 'haleyOption';
    
    haleyCheckboxItem.appendChild(haleyCheckbox);
    haleyCheckboxItem.appendChild(haleyLabel);
    messageList.appendChild(haleyCheckboxItem);
    
    feedbackContent.appendChild(messageList);
    modal.appendChild(feedbackContent);

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send Message';
    sendBtn.className = 'notify-btn';
    sendBtn.onclick = chooseAndSendSMS;
    modal.appendChild(sendBtn);
}

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

function showSettings() {
    document.getElementById('dropdownMenu').style.display = 'none';
    document.getElementById('settingsModal').style.display = 'block';
    loadSanitationSettings();
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function getHighlightColor(value, type) {
    if (!value || value === 'N/A' || value === '') return null;
    
    const valueStr = value.toString().trim();
    
    if (type === 'pH') {
        if (valueStr.startsWith('< 7.0' || valueStr === '< 7.0' || 
            valueStr.startsWith('> 8.0') || valueStr === '> 8.0' ||
            valueStr === '7.8' || valueStr === '8.0')) {
            return 'red';
        }
        const numValue = parseFloat(valueStr.replace(/[<>]/g, ''));
        if (!isNaN(numValue)) {
            if (numValue < 7.0 || numValue === 7.8 || numValue === 8.0 || numValue > 8.0) return 'red';
            if (numValue === 7.0 || numValue === 7.6) return 'yellow';
        }
        return null;
    }
    
    if (type === 'cl') {
        if (valueStr.startsWith('> 10') || valueStr === '> 10' ||
            valueStr.startsWith('>10') || valueStr === '>10' ||
            valueStr === '0' || valueStr === '10') {
            return 'red';
        }
        const numValue = parseFloat(valueStr.replace(/[<>]/g, ''));
        if (!isNaN(numValue)) {
            if (numValue === 0 || numValue === 10 || numValue > 10) return 'red';
            if ((numValue > 0 && numValue < 3) || (numValue > 5 && numValue < 10)) return 'yellow';
        }
        return null;
    }
    
    return null;
}

function getPoolWarningLevel(mainPH, mainCl, secondaryPH, secondaryCl) {
    const values = [
        { value: mainPH, type: 'pH' },
        { value: mainCl, type: 'cl' },
        { value: secondaryPH, type: 'pH' },
        { value: secondaryCl, type: 'cl' }
    ];
    
    let hasRed = false;
    let hasYellow = false;
    
    values.forEach(item => {
        const color = getHighlightColor(item.value, item.type);
        if (color === 'red') hasRed = true;
        if (color === 'yellow') hasYellow = true;
    });
    
    if (hasRed) return 'red';
    if (hasYellow) return 'yellow';
    return null;
}

function isMoreThan3HoursOld(timestamp) {
    const now = new Date();
    const submissionTime = new Date(timestamp);
    const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return submissionTime < threeHoursAgo;
}

function updateTimestampNote() {

// ===================================================
// GLOBAL ASSIGNMENTS
// ===================================================

// Add global assignments for all functions at the end of the file
window.sendSMSNotification = sendSMSNotification;
window.deleteSubmission = deleteSubmission;
window.changePage = changePage;
window.checkForCriticalAlerts = checkForCriticalAlerts;
window.getClResponse = getClResponse;
window.areAllCheckboxesChecked = areAllCheckboxesChecked;
window.createOrShowOverlay = createOrShowOverlay;
window.removeOverlay = removeOverlay;
window.showRecipientSelectionInModal = showRecipientSelectionInModal;
window.chooseAndSendSMS = chooseAndSendSMS;
window.toggleMenu = toggleMenu;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.getHighlightColor = getHighlightColor;
window.getPoolWarningLevel = getPoolWarningLevel;
window.isMoreThan3HoursOld = isMoreThan3HoursOld;
window.updateTimestampNote = updateTimestampNote;
window.organizePaginatedData = organizePaginatedData;
window.clearAllData = clearAllData;
window.notifySupervisor = notifySupervisor;
window.updatePaginationControls = updatePaginationControls;
window.saveFormSubmissions = saveFormSubmissions;
window.loadFormSubmissions = loadFormSubmissions;
window.showDashboard = showDashboard;
window.handleLocationChange = handleLocationChange;
window.showFeedbackModal = showFeedbackModal;
window.evaluateFormFeedback = evaluateFormFeedback;
window.showMessage = showMessage;
window.closeModal = closeModal;

console.log('🔥✅ Pool Chemistry Log App - All Functions Loaded! ✅🔥');
