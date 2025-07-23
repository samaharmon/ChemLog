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
    const secondarySection = document.getElementById('secondaryPoolSection');
    
    console.log('Pool location changed to:', poolLocation); // Debug log
    console.log('Secondary section element:', secondarySection); // Debug log
    
    if (POOLS_WITH_SECONDARY.includes(poolLocation)) {
        console.log('Showing secondary pool section'); // Debug log
        if (secondarySection) {
            secondarySection.style.display = 'block';
        }
        
        // Make secondary fields required
        const secPH = document.getElementById('secondaryPoolPH');
        const secCl = document.getElementById('secondaryPoolCl');
        if (secPH) secPH.required = true;
        if (secCl) secCl.required = true;
    } else {
        console.log('Hiding secondary pool section'); // Debug log
        if (secondarySection) {
            secondarySection.style.display = 'none';
        }
        
        // Make secondary fields not required and clear values
        const secPH = document.getElementById('secondaryPoolPH');
        const secCl = document.getElementById('secondaryPoolCl');
        if (secPH) {
            secPH.required = false;
            secPH.value = '';
        }
        if (secCl) {
            secCl.required = false;
            secCl.value = '';
        }
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

// Generic modal close function
function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Enhanced handleLocationChange function
function handleLocationChange() {
    const poolLocation = document.getElementById('poolLocation').value;
    const secondarySection = document.getElementById('secondaryPoolSection');
    
    if (POOLS_WITH_SECONDARY.includes(poolLocation)) {
        secondarySection.style.display = 'block';
        document.getElementById('secondaryPoolPH').required = true;
        document.getElementById('secondaryPoolCl').required = true;
    } else {
        secondarySection.style.display = 'none';
        document.getElementById('secondaryPoolPH').required = false;
        document.getElementById('secondaryPoolCl').required = false;
        // Clear values when hiding
        document.getElementById('secondaryPoolPH').value = '';
        document.getElementById('secondaryPoolCl').value = '';
    }
}

// ===================================================
// ADDITIONAL GLOBAL FUNCTION ASSIGNMENTS
// ===================================================

// Ensure all functions are globally accessible
window.showMessage = showMessage;
window.showFeedback = showFeedback;
window.closeModal = closeModal;
window.handleLocationChange = handleLocationChange;
window.sendSMSNotification = sendSMSNotification;
window.deleteSubmission = deleteSubmission;
window.changePage = changePage;
window.handleLoginSubmit = handleLoginSubmit;
window.checkForCriticalAlerts = checkForCriticalAlerts;
window.evaluateFormFeedback = evaluateFormFeedback; // Your detailed version is already there
window.showFeedbackModal = showFeedbackModal; // Your detailed version is already there
window.getClResponse = getClResponse; // Your detailed version is already there
window.areAllCheckboxesChecked = areAllCheckboxesChecked; // Your detailed version is already there
window.createOrShowOverlay = createOrShowOverlay; // Your detailed version is already there
window.removeOverlay = removeOverlay; // Your detailed version is already there
window.showRecipientSelectionInModal = showRecipientSelectionInModal; // Your detailed version is already there
window.chooseAndSendSMS = chooseAndSendSMS; // Your detailed version is already there
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.handleSanitationChange = handleSanitationChange;
window.exportToCSV = exportToCSV;
window.filterData = filterData;
window.goToPreviousPage = goToPreviousPage;
window.goToNextPage = goToNextPage;
window.logout = logout;
window.submitForm = submitForm;
window.showDashboard = showDashboard;
window.toggleMenu = toggleMenu;
window.showSettings = showSettings;
window.clearAllData = clearAllData;

// ===================================================
// FORM FEEDBACK EVALUATION SYSTEM
// ===================================================

function evaluateFormFeedback(formData) {
    const poolLocation = document.getElementById('poolLocation').value;
    const mainPH = document.getElementById('mainPoolPH').value;
    const mainCl = document.getElementById('mainPoolCl').value;
    const secPH = document.getElementById('secondaryPoolPH').value;
    const secCl = document.getElementById('secondaryPoolCl').value;
    
    // DEBUG LOGS - Remove after testing
    console.log('=== DEBUG INFO ===');
    console.log('Pool Location:', `"${poolLocation}"`);
    console.log('Secondary pH:', `"${secPH}"`);
    console.log('Pool Location === "Quail Hollow":', poolLocation === 'Quail Hollow');
    console.log('Secondary pH === "7.8":', secPH === '7.8');
    
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
        // Bleach method for main pool Cl - RESTORED ORIGINAL MESSAGES
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
    
    // Check secondary pool if not Camden CC
    if (poolLocation !== 'Camden CC') {
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
                        messages.push('<strong>Notify a supervisor of the high Cl in the Splash Pad immediately. Wait for assistance.</strong><br>');
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
                        messages.push('<strong>Lower the pH of the Splash Pad.</strong><br>Add 1/6 scoop of acid below a skimmer basket. Always check for suction before pouring.');
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
                        messages.push('<strong>Lower the pH of the Splash Pad.</strong><br>Add 1/3 scoop of acid below a skimmer basket. Always check for suction before pouring.');
                    } else if (poolLocation === 'Winchester') {
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add 1/3 scoop of acid basket. Always check for suction before pouring.');
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
                // Bleach method for Forest Lake secondary pool - RESTORED ORIGINAL MESSAGES
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
                    isGood = false;
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
                    isGood = false;
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
                    isGood = false;
                    break;
            }
        }
    }
    
    // Show feedback modal
    if (messages.length > 0) {
        // If there are messages, show the modal with checkboxes
        showFeedbackModal(messages, false, setpointImgNeeded);
    } else if (isGood) {
        // If all values are good, show the modal without checkboxes
        showFeedbackModal(['All water chemistry values are within acceptable ranges.'], true);
    }
}

function getClResponse(poolLocation, isMainPool, clValue) {
    // Special handling for Forest Lake secondary pool (granular/bleach methods)
    if (poolLocation === 'Forest Lake' && !isMainPool) {
        const sanitationMethod = sanitationSettings['Forest Lake Lap Pool'];
        if (sanitationMethod === 'granular') {
            // Granular chlorine logic
            if (clValue === '0') {
                return '<strong>Raise the Cl level in the Lap Pool.</strong><br>Pour 1 bag of granular chlorine into the deep end of the pool.';
            } else if (clValue === '1') {
                return '<strong>Raise the Cl level in the Lap Pool.</strong><br>Pour 1/2 bag of granular chlorine into the deep end of the pool.';
            } else if (clValue === '2') {
                return '<strong>Raise the Cl level in the Lap Pool.</strong><br>Pour 1/4 bag of granular chlorine into the deep end of the pool.';
            } else if (clValue === '10') {
                return '<strong>Lower the Cl level of the Lap Pool.</strong><br>Stop adding granular chlorine. Wait for levels to decrease.';
            } else if (clValue === '> 10') {
                return '<strong>Notify a supervisor of the high Cl in the Lap Pool immediately. Lower the Cl level of the Lap Pool.</strong><br>Stop adding granular chlorine. Wait for levels to decrease.';
            }
        } else {
            // Bleach chlorine logic (default)
            if (clValue === '0' || clValue === '1' || clValue === '2') {
                return '<strong>Raise the Cl level in the Lap Pool.</strong><br>If not handled the previous hour, change the Cl feeder rate according to the setpoint chart.';
            } else if (clValue === '10') {
                return '<strong>Lower the Cl level of the lap pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.';
            } else if (clValue === '> 10') {
                return '<strong>Notify a supervisor of the high Cl in the Lap Pool immediately. Lower the Cl level of the lap pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.';
            }
        }
    }
    
    // Default behavior for other pools
    if (isMainPool) {
        // Main pool logic
        if (clValue === '0' || clValue === '1' || clValue === '2') {
            return '<strong>Raise the Cl level in the Main Pool.</strong><br>If not handled the previous hour, change the Cl feeder rate according to the setpoint chart to raise the Cl level.';
        } else if (clValue === '10') {
            return '<strong>Lower the Cl level of the Main Pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.';
        } else if (clValue === '> 10') {
            return '<strong>Notify a supervisor of the high Cl in the Main Pool immediately. Lower the Cl level of the Main Pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.';
        }
    } else {
        // Secondary pool logic (excluding Forest Lake)
        if (clValue === '0') {
            switch (poolLocation) {
                case 'Columbia CC':
                    return '<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 2 total Cl tablets below a skimmer basket.';
                case 'CC of Lexington':
                    return '<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there is 1 total Cl tablet below a skimmer basket.';
                case 'Quail Hollow':
                    return '<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 1.5 total Cl tablets below a skimmer basket.';
                case 'Rockbridge':
                    return '<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 1.5 total Cl tablets below a skimmer basket.';
                case 'Wildewood':
                    return '<strong>Raise the Cl level in the Splash Pad.</strong><br>Add 1/4 scoop of shock/granular Cl to an empty bucket, then fill it with water. Carefully swirl the water to dissolve the shock, then pour it into the splash pad tank.';
                case 'Winchester':
                    return '<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 4 total Cl tablets below a skimmer basket.';
            }
        } else if (clValue === '10') {
            switch (poolLocation) {
                case 'Columbia CC':
                case 'CC of Lexington':
                case 'Quail Hollow':
                case 'Rockbridge':
                case 'Winchester':
                    return '<strong>Lower the Cl level in the Baby Pool.</strong><br>Remove all Cl tablets from the skimmers until Cl levels have subsided.';
                case 'Wildewood':
                    return '<strong>Do not add any more shock/granular to the Splash Pad tank.</strong><br>Cl levels should subside within two hours.';
            }
        } else if (clValue === '> 10') {
            switch (poolLocation) {
                case 'Columbia CC':
                case 'CC of Lexington':
                case 'Quail Hollow':
                case 'Rockbridge':
                case 'Winchester':
                    return '<strong>Notify a supervisor of the high Cl in the Baby Pool immediately. Lower the Cl level in the Baby Pool.</strong><br>Remove all Cl tablets from the skimmers until Cl levels have subsided.';
                case 'Wildewood':
                    return '<strong>Notify a supervisor of the high Cl in the Splash Pad immediately. Do not add any more shock/granular to the Splash Pad tank.</strong><br>Cl levels should subside within two hours.';
            }
        }
    }
    
    return null; // Default return value
}

// ===================================================
// APP INITIALIZATION COMPLETE
// ===================================================

console.log('🔥✅ Pool Chemistry Log App - Fully Loaded and Ready! ✅🔥');
