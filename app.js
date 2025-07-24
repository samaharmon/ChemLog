// ===================================================
// POOL CHEMISTRY LOG - UNIFIED APPLICATION
// Capital City Aquatics - 2025
// ===================================================

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

// Add this right after your global variables:

// Error handling to catch JavaScript errors
window.addEventListener('error', function(e) {
    console.error('JavaScript Error:', e.error);
    console.error('At line:', e.lineno);
    console.error('In file:', e.filename);
});

// Add console log to verify script is loading
console.log('🔥 Pool Chemistry App - Script Starting to Load 🔥');

// ===================================================
// FIXED DASHBOARD DATA TABLE FUNCTIONS
// ===================================================

// Initialize form submissions on app start
function initializeFormSubmissions() {
    loadFormSubmissions(); // Load from localStorage
    console.log(`Initialized with ${formSubmissions.length} form submissions`);
}

// Firebase v9 initialization using globally available modules
function initializeFirebase() {
    try {
        // Check if Firebase v9 modules are loaded
        if (typeof window.firebaseModules === 'undefined') {
            updateFirebaseStatus('Firebase v9 SDK not loaded', true);
            console.error('Firebase v9 not loaded - check script tags');
            return false;
        }
        
        // Initialize Firebase app using v9 syntax
        app = window.firebaseModules.initializeApp(firebaseConfig);
        
        // Initialize Firestore using v9 syntax
        db = window.firebaseModules.getFirestore(app);
        
        updateFirebaseStatus('✅ Firebase v9 connected successfully');
        console.log('Firebase v9 initialized successfully');
        
        initializeSanitationSettings();
        
        return true;
    } catch (error) {
        console.error('Firebase v9 initialization error:', error);
        updateFirebaseStatus(`❌ Firebase error: ${error.message}`, true);
        return false;
    }
}

// Updated loadDashboardData to work with both Firebase and localStorage
function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    // First, ensure we have local data loaded
    loadFormSubmissions();
    
    if (db) {
        try {
            // Create query using v9 syntax
            const q = window.firebaseModules.query(
                window.firebaseModules.collection(db, 'poolSubmissions'),
                window.firebaseModules.orderBy('timestamp', 'desc')
            );
            
            // Set up real-time listener using v9 syntax
            const unsubscribe = window.firebaseModules.onSnapshot(q, (querySnapshot) => {
                const firebaseSubmissions = [];
                querySnapshot.forEach((docSnapshot) => {
                    const data = docSnapshot.data();
                    data.id = docSnapshot.id;
                    // Convert Firestore timestamp to JavaScript Date
                    if (data.timestamp && data.timestamp.toDate) {
                        data.timestamp = data.timestamp.toDate();
                    }
                    firebaseSubmissions.push(data);
                });
                
                console.log('Loaded from Firebase v9:', firebaseSubmissions.length);
                
                // Combine Firebase data with local formSubmissions
                allSubmissions = [...firebaseSubmissions];
                
                // Add local submissions that might not be in Firebase yet
                formSubmissions.forEach(localSubmission => {
                    const exists = allSubmissions.find(sub => sub.id === localSubmission.id);
                    if (!exists) {
                        // Convert timestamp string to Date object if needed
                        if (typeof localSubmission.timestamp === 'string') {
                            localSubmission.timestamp = new Date(localSubmission.timestamp);
                        }
                        allSubmissions.push(localSubmission);
                    }
                });
                
                updateFirebaseStatus(`Loaded ${allSubmissions.length} total submissions`);
                
                // Apply current filters and update display
                if (isLoggedIn) {
                    filterAndDisplayData();
                }
            }, (error) => {
                console.error('Error loading from Firebase v9: ', error);
                updateFirebaseStatus('Using local data only', true);
                // Fall back to local data only
                useLocalDataOnly();
            });
            
        } catch (error) {
            console.error('Error setting up Firebase v9 listener: ', error);
            updateFirebaseStatus('Using local data only', true);
            useLocalDataOnly();
        }
    } else {
        console.log('No Firebase connection, using local data only');
        useLocalDataOnly();
    }
}

// Fallback function for local data only
function useLocalDataOnly() {
    loadFormSubmissions();
    allSubmissions = [...formSubmissions];
    
    // Convert timestamp strings to Date objects if needed
    allSubmissions.forEach(submission => {
        if (typeof submission.timestamp === 'string') {
            submission.timestamp = new Date(submission.timestamp);
        }
    });
    
    console.log('Using local data:', allSubmissions.length, 'submissions');
    updateFirebaseStatus(`Using local data: ${allSubmissions.length} submissions`);
    
    if (isLoggedIn) {
        filterAndDisplayData();
    }
}

// Updated filter and display function
function filterAndDisplayData() {
    console.log('Filtering and displaying data...');
    
    // Apply filters
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
    
    console.log('Filtered submissions:', filteredSubmissions.length);
    
    // Create paginated data
    paginatedData = organizePaginatedData(filteredSubmissions);
    currentPage = 0; // Start with page 0 (most recent)
    
    console.log('Paginated data pages:', paginatedData.length);
    
    // Display the data
    displayData();
    updatePaginationControls();
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
        if (valueStr.startsWith('> 10' || valueStr === '> 10' ||
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

// Updated displayData function
function displayData() {
    console.log('displayData called');
    console.log('allSubmissions length:', allSubmissions.length);
    console.log('paginatedData length:', paginatedData.length);
    console.log('currentPage:', currentPage);
    
    const tbody1 = document.getElementById('dataTableBody1');
    const tbody2 = document.getElementById('dataTableBody2');
    
    console.log('tbody1 found:', !!tbody1);
    console.log('tbody2 found:', !!tbody2);
    
    if (paginatedData.length === 0 || !paginatedData[currentPage]) {
        tbody1.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #666;">No data found</td></tr>';
        tbody2.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #666;">No data found</td></tr>';
        return;
    }
    
    const data = paginatedData[currentPage];
    let hasSecondaryData = false;
    
    console.log('Displaying', data.length, 'items for page', currentPage);
    
    data.forEach(submission => {
        const mainPHColor = getHighlightColor(submission.mainPoolPH, 'pH');
        const mainClColor = getHighlightColor(submission.mainPoolCl, 'cl');
        const secondaryPHColor = getHighlightColor(submission.secondaryPoolPH, 'pH');
        const secondaryClColor = getHighlightColor(submission.secondaryPoolCl, 'cl');
        const warningLevel = getPoolWarningLevel(submission.mainPoolPH, submission.mainPoolCl, submission.secondaryPoolPH, submission.secondaryPoolCl);
        
        let poolNameDisplay = submission.poolLocation;
        if (warningLevel === 'red') {
            poolNameDisplay = `<u>${submission.poolLocation}</u><span style="color: red;">!!!</span>`;
        } else if (warningLevel === 'yellow') {
            poolNameDisplay = `<u>${submission.poolLocation}</u><span style="color: red;">!</span>`;
        }
        
        // Format timestamp
        let timestampDisplay = submission.timestamp;
        if (submission.timestamp instanceof Date) {
            timestampDisplay = submission.timestamp.toLocaleString();
        } else {
            timestampDisplay = new Date(submission.timestamp).toLocaleString();
        }
        
        if (currentPage === 0 && isMoreThan3HoursOld(submission.timestamp)) {
            timestampDisplay = `<span style="color: red; font-weight: bold;">${timestampDisplay}</span>`;
        }
        
        const createCell = (value, color) => {
            if (color === 'red') {
                return `<td style="background-color: #ffcccc; color: #cc0000; font-weight: bold;">${value || 'N/A'}</td>`;
            } else if (color === 'yellow') {
                return `<td style="background-color: #fff2cc; color: #b8860b; font-weight: bold;">${value || 'N/A'}</td>`;
            } else {
                return `<td>${value || 'N/A'}</td>`;
            }
        };
        
        // Main Pool Table Row
        const row1 = document.createElement('tr');
        row1.innerHTML = `
            <td>${timestampDisplay}</td>
            <td>${poolNameDisplay}</td>
            ${createCell(submission.mainPoolPH, mainPHColor)}
            ${createCell(submission.mainPoolCl, mainClColor)}
        `;
        tbody1.appendChild(row1);
        
        // Secondary Pool Table Row (only if not Camden CC)
        if (submission.poolLocation !== 'Camden CC' && (submission.secondaryPoolPH || submission.secondaryPoolCl)) {
            hasSecondaryData = true;
            const row2 = document.createElement('tr');
            row2.innerHTML = `
                <td>${timestampDisplay}</td>
                <td>${poolNameDisplay}</td>
                ${createCell(submission.secondaryPoolPH, secondaryPHColor)}
                ${createCell(submission.secondaryPoolCl, secondaryClColor)}
            `;
            tbody2.appendChild(row2);
        }
    });
    
    // If no secondary pool data, show a message
    if (!hasSecondaryData) {
        tbody2.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #666;">No secondary pool data for current selection</td></tr>';
    }
    
    updateTimestampNote();
    console.log('Data display completed');
}

// Updated submitForm to save to both systems
// Try to save to Firebase
async function submitFormAndSync() {
    console.log('Submit button clicked');
    
    // Clear any previous error highlighting
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });

    // Validate required fields
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

    // Create form data for feedback evaluation
    const formData = new FormData();
    formData.append('mainPoolPH', document.getElementById('mainPoolPH').value);
    formData.append('mainPoolCl', document.getElementById('mainPoolCl').value);
    formData.append('secondaryPoolPH', document.getElementById('secondaryPoolPH').value);
    formData.append('secondaryPoolCl', document.getElementById('secondaryPoolCl').value);
    
    // Process form submission
    evaluateFormFeedback(formData);
    
    // Create submission object
    const submission = {
        id: Date.now(),
        timestamp: new Date(),
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        poolLocation: document.getElementById('poolLocation').value,
        mainPoolPH: document.getElementById('mainPoolPH').value,
        mainPoolCl: document.getElementById('mainPoolCl').value,
        secondaryPoolPH: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolPH').value,
        secondaryPoolCl: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolCl').value
    };
    
    // Save to local storage first
    formSubmissions.push(submission);
    saveFormSubmissions();
    
    // Try to save to Firebase v9
    if (db) {
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

// Updated showDashboard function
function showDashboard() {
    console.log('showDashboard called');
    document.getElementById('mainForm').style.display = 'none';
    document.getElementById('supervisorDashboard').style.display = 'block';
    
    console.log('Dashboard is now visible, calling loadDashboardData...');
    loadDashboardData();
}

// ===================================================
// SANITATION SETTINGS
// ===================================================

// Initialize default sanitation settings (all pools default to bleach)
async function initializeSanitationSettings() {
    const pools = ['Camden CC', 'CC of Lexington', 'Columbia CC', 'Forest Lake', 'Forest Lake Lap Pool', 'Quail Hollow', 'Rockbridge', 'Wildewood', 'Winchester'];
    const statusDiv = document.getElementById('firebaseStatus');
    
    console.log('Initializing sanitation settings...');
    updateFirebaseStatus('Loading settings from Firebase v9...');
    
    // Set defaults first
    pools.forEach(pool => {
        sanitationSettings[pool] = 'bleach';
    });

    try {
        if (db) {
            // Use Firebase v9 syntax
            const settingsRef = window.firebaseModules.doc(db, 'settings', 'sanitationMethods');
            const settingsDoc = await window.firebaseModules.getDoc(settingsRef);
            
            if (settingsDoc.exists()) {
                const firebaseSettings = settingsDoc.data();
                Object.assign(sanitationSettings, firebaseSettings);
                console.log('Successfully loaded sanitation settings from Firebase v9:', sanitationSettings);
                updateFirebaseStatus('Settings synced with cloud ✓');
            } else {
                console.log('No Firebase settings found, saving defaults');
                await window.firebaseModules.setDoc(settingsRef, sanitationSettings);
                updateFirebaseStatus('Default settings saved to cloud');
            }
        } else {
            throw new Error('Database not initialized');
        }
    } catch (error) {
        console.warn('Could not load settings from Firebase v9, using localStorage fallback:', error);
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
    updateSanitationUI();
    
    // Hide status after 3 seconds
    setTimeout(() => {
        if (statusDiv) statusDiv.style.display = 'none';
    }, 3000);
}

function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    // First, ensure we have local data loaded
    loadFormSubmissions();
    
    if (db) {
        try {
            // Create query using v9 syntax
            const q = window.firebaseModules.query(
                window.firebaseModules.collection(db, 'poolSubmissions'),
                window.firebaseModules.orderBy('timestamp', 'desc')
            );
            
            // Set up real-time listener using v9 syntax
            const unsubscribe = window.firebaseModules.onSnapshot(q, (querySnapshot) => {
                const firebaseSubmissions = [];
                querySnapshot.forEach((docSnapshot) => {
                    const data = docSnapshot.data();
                    data.id = docSnapshot.id;
                    // Convert Firestore timestamp to JavaScript Date
                    if (data.timestamp && data.timestamp.toDate) {
                        data.timestamp = data.timestamp.toDate();
                    }
                    firebaseSubmissions.push(data);
                });
                
                console.log('Loaded from Firebase v9:', firebaseSubmissions.length);
                
                // Combine Firebase data with local formSubmissions
                allSubmissions = [...firebaseSubmissions];
                
                // Add local submissions that might not be in Firebase yet
                formSubmissions.forEach(localSubmission => {
                    const exists = allSubmissions.find(sub => sub.id === localSubmission.id);
                    if (!exists) {
                        // Convert timestamp string to Date object if needed
                        if (typeof localSubmission.timestamp === 'string') {
                            localSubmission.timestamp = new Date(localSubmission.timestamp);
                        }
                        allSubmissions.push(localSubmission);
                    }
                });
                
                updateFirebaseStatus(`Loaded ${allSubmissions.length} total submissions`);
                
                // Apply current filters and update display
                if (isLoggedIn) {
                    filterAndDisplayData();
                }
            }, (error) => {
                console.error('Error loading from Firebase v9: ', error);
                updateFirebaseStatus('Using local data only', true);
                // Fall back to local data only
                useLocalDataOnly();
            });
            
        } catch (error) {
            console.error('Error setting up Firebase v9 listener: ', error);
            updateFirebaseStatus('Using local data only', true);
            useLocalDataOnly();
        }
    } else {
        console.log('No Firebase connection, using local data only');
        useLocalDataOnly();
    }
}

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
        // Correct way - use the db instance you already have
        const settingsRef = db.collection('settings').doc('sanitationMethods');
        const settingsDoc = await settingsRef.get();
        
        if (settingsDoc.exists) {
            const firebaseSettings = settingsDoc.data();
            Object.assign(sanitationSettings, firebaseSettings);
            console.log('Successfully loaded sanitation settings from Firebase:', sanitationSettings);
            updateFirebaseStatus('Settings synced with cloud ✓');
        } else {
            console.log('No Firebase settings found, saving defaults');
            await settingsRef.set(sanitationSettings);
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
            await setDoc(doc(db, 'settings', 'sanitationMethods'), sanitationSettings);
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
// DOM INITIALIZATION
// ===================================================

function handleLoginSubmit(e) {
    e.preventDefault();
    console.log('Login form submitted');
    
    const emailInput = document.querySelector('#loginForm input[name="email"]');
    const passwordInput = document.querySelector('#loginForm input[name="password"]');
    
    if (!emailInput || !passwordInput) {
        console.error('Login inputs not found');
        showMessage('Login form inputs not found.', 'error');
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    console.log('Login attempt with email:', email);
    
    if (email === supervisorCredentials.email && password === supervisorCredentials.password) {
        console.log('Login successful');
        
        // Set login state
        isLoggedIn = true;
        
        // Set persistent login token for 1 month
        const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem('loginToken', JSON.stringify({ username: email, expires }));
        
        // Close modal and show dashboard
        closeLoginModal();
        showDashboard();
        
        // Update header buttons
        updateHeaderButtons();
        
        showMessage('Login successful!', 'success');
    } else {
        console.log('Invalid credentials provided');
        showMessage('Invalid credentials. Please try again.', 'error');
    }
}

function setupEventHandlers() {
    // Pool location change handler
    const poolLocation = document.getElementById('poolLocation');
    if (poolLocation) {
        poolLocation.addEventListener('change', handlePoolLocationChange);
    }
    
    // Form submission (if you have a submit button)
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitForm();
        });
    }
    
    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('loginModal');
        if (modal && e.target === modal) {
            closeLoginModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('loginModal');
            if (modal && modal.style.display === 'block') {
                closeLoginModal();
            }
        }
    });
    
    console.log('Event handlers set up');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔥🔥🔥 UNIFIED APP.JS LOADED - Firebase v9 🔥🔥🔥');
    
    // Initialize Firebase v9 first
    const firebaseInitialized = initializeFirebase(); // Changed from initializeApp()
    
    // Initialize app components
    checkLogin();
    initializeFormSubmissions();
    
    // Set up login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
        console.log('✅ Login form handler attached');
    } else {
        console.warn('⚠️ Login form not found during initialization');
    }
    
    // Set up pool location change handler
    const poolLocation = document.getElementById('poolLocation');
    if (poolLocation) {
        poolLocation.addEventListener('change', handlePoolLocationChange);
        console.log('✅ Pool location handler attached');
    }
    
    // Set up other event handlers
    setupEventHandlers();
    
    // Initial header button setup
    updateHeaderButtons();
    
    console.log('🚀 App initialization complete');
});

// Replace the existing updateHeaderButtons function:
function updateHeaderButtons() {
    console.log('updateHeaderButtons called, isLoggedIn:', isLoggedIn);
    
    // Remove any existing header buttons first
    document.querySelectorAll('.supervisor-login-btn, .logout-btn, .menu-container').forEach(btn => {
        btn.remove();
    });
    
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) {
        console.error('Header right element not found');
        return;
    }
    
    if (isLoggedIn) {
        // Show menu and logout buttons for dashboard
        headerRight.innerHTML = `
            <div class="menu-container">
                <button class="menu-btn" onclick="toggleMenu()">☰</button>
                <div id="dropdownMenu" class="dropdown-menu" style="display: none;">
                    <div onclick="showSettings()">Settings</div>
                    <div onclick="clearAllData()">Clear All Data</div>
                    <div onclick="logout()">Logout</div>
                </div>
            </div>
        `;
        console.log('Header updated for logged in state');
    } else {
        // Show only supervisor login button for form view
        headerRight.innerHTML = `
            <button class="supervisor-login-btn" onclick="openLoginModal()">Supervisor Login</button>
        `;
        console.log('Header updated for logged out state');
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

// Replace the existing checkLogin function:
function checkLogin() {
    const token = localStorage.getItem('loginToken');
    if (token) {
        try {
            const { username, expires } = JSON.parse(token);
            if (Date.now() < expires) {
                console.log('Valid login token found');
                isLoggedIn = true;
                showDashboard();
                updateHeaderButtons();
                return true;
            } else {
                console.log('Login token expired');
                localStorage.removeItem('loginToken');
            }
        } catch (error) {
            console.error('Error parsing login token:', error);
            localStorage.removeItem('loginToken');
        }
    }
    
    // Ensure we're in logged out state
    isLoggedIn = false;
    updateHeaderButtons();
    return false;
}

function openLoginModal() {
    console.log('openLoginModal called');
    
    const modal = document.getElementById('loginModal');
    if (!modal) {
        console.error('Login modal not found in DOM');
        showMessage('Login modal not found. Please refresh the page.', 'error');
        return;
    }
    
    // Create or show overlay
    createOrShowOverlay();
    
    // Show modal
    modal.style.display = 'block';
    
    // Focus on first input after a short delay
    setTimeout(() => {
        const firstInput = modal.querySelector('input[name="email"]');
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);
    
    console.log('Login modal opened successfully');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.reset();
    }
    
    removeOverlay();
    console.log('Login modal closed');
}

function createOrShowOverlay() {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block'; // Show the overlay
    return overlay;
}

function removeOverlay() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'none'; // Hide the overlay
    }
}

function debugLoginState() {
    console.log('=== LOGIN DEBUG INFO ===');
    console.log('isLoggedIn:', isLoggedIn);
    console.log('currentView:', currentView);
    console.log('Login modal exists:', !!document.getElementById('loginModal'));
    console.log('Login form exists:', !!document.getElementById('loginForm'));
    console.log('Header right exists:', !!document.querySelector('.header-right'));
    console.log('Supervisor login button exists:', !!document.querySelector('.supervisor-login-btn'));
    console.log('Login token:', localStorage.getItem('loginToken'));
    console.log('========================');
}

window.debugLoginState = debugLoginState;

console.log('🔧 Login functionality fixes applied');

window.submitForm = submitFormAndSync;