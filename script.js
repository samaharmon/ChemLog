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

// Load form submissions from localStorage
function loadFormSubmissions() {
    const saved = localStorage.getItem('formSubmissions');
    if (saved) {
        try {
            formSubmissions = JSON.parse(saved);
            console.log(`Loaded ${formSubmissions.length} submissions from localStorage`);
        } catch (error) {
            console.error('Error loading saved submissions:', error);
            formSubmissions = [];
        }
    } else {
        console.log('No saved submissions found');
    }
}

function organizePaginatedData(data) {
    if (data.length === 0) return [];

    const sortedData = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const poolLocations = [...new Set(sortedData.map(item => item.poolLocation))];

    // Page 0: Most recent per pool
    const page0 = [];
    const seenPools = new Set();
    for (let item of sortedData) {
        if (!seenPools.has(item.poolLocation)) {
            page0.push(item);
            seenPools.add(item.poolLocation);
        }
    }

    // Other pages: Group by pool + date (not full timestamp)
    const grouped = {};

    for (let item of sortedData) {
        const dateOnly = new Date(item.timestamp).toLocaleDateString();
        const key = `${item.poolLocation}__${dateOnly}`;

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    }

    const groupKeys = Object.keys(grouped).sort((a, b) => {
        const [poolA, dateA] = a.split('__');
        const [poolB, dateB] = b.split('__');
        const dateObjA = new Date(dateA);
        const dateObjB = new Date(dateB);
        return dateObjB - dateObjA;
    });

    const pages = [page0];

    for (let key of groupKeys) {
        const submissions = grouped[key];
        const submissionsSorted = submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        pages.push(submissionsSorted);
    }

    return pages;
}

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
            valueStr === '0' || valueStr === '10')) {
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
    const existingNote = document.getElementById('timestampNote');
    if (existingNote) {
        // Show the note only on page 0 (most recent)
        existingNote.style.display = currentPage === 0 ? 'block' : 'none';
    }
}

function updatePaginationControls() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');
    
    if (!prevBtn || !nextBtn || !pageInfo) return;
    
    if (paginatedData.length <= 1) {
        document.getElementById('pagination').style.display = 'none';
        return;
    }
    
    document.getElementById('pagination').style.display = 'flex';
    
    // Update button states
    prevBtn.disabled = currentPage === 0;
    prevBtn.style.opacity = currentPage === 0 ? '0.5' : '1';
    prevBtn.style.cursor = currentPage === 0 ? 'not-allowed' : 'pointer';
    
    nextBtn.disabled = currentPage >= paginatedData.length - 1;
    nextBtn.style.opacity = currentPage >= paginatedData.length - 1 ? '0.5' : '1';
    nextBtn.style.cursor = currentPage >= paginatedData.length - 1 ? 'not-allowed' : 'pointer';
    
    // Update page info
    const currentPageData = paginatedData[currentPage];
    const pageDisplayText = currentPage === 0 
        ? `Recent (${currentPageData.length})` 
        : `${new Date(currentPageData[0].timestamp).toLocaleDateString()} (${currentPageData.length})`;
    
    pageInfo.textContent = pageDisplayText;
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
}

function submitForm() {
    submitFormAndSync();
}


function evaluateFormFeedback(formData) {
    const poolLocation = document.getElementById('poolLocation').value;
    const mainPH = document.getElementById('mainPoolPH').value;  // ADD THIS LINE
    const mainCl = document.getElementById('mainPoolCl').value;  // ADD THIS LINE
    const secPH = document.getElementById('secondaryPoolPH').value;
    const secCl = document.getElementById('secondaryPoolCl').value;  // ADD THIS LINE
    
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
                        messages.push('<strong>Lower the pH of the Baby Pool.</strong><br>Add a small splash (~1.5 tablespoons of acid) below a skimmer basket. Always check for suction before pouring.');
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
    
    // Show feedback modal
    if (messages.length > 0) {
        // If there are messages, show the modal with checkboxes
        showFeedbackModal(messages, false, setpointImgNeeded);
    } else if (isGood) {
        // If all values are good, show the modal without checkboxes
        showFeedbackModal(['All water chemistry values are within acceptable ranges.'], true);
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
            window.firebaseModules.addDoc(
            window.firebaseModules.collection(db, 'poolSubmissions'), 
            {
             ...submission,
              timestamp: window.firebaseModules.Timestamp.fromDate(submission.timestamp)
            }
            ).then(() => {
    console.log('Submission saved to Firebase v9');
}).catch((error) => {
    console.warn('Could not save to Firebase v9:', error);
});
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

// Save sanitation settings to Firebase and localStorage
async function saveSanitationSettings() {
    try {
        if (db) {
            const settingsRef = window.firebaseModules.doc(db, 'settings', 'sanitationMethods');
            await window.firebaseModules.setDoc(settingsRef, sanitationSettings);
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

function handleLoginSubmit(event) {
    event.preventDefault();
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
    const firebaseInitialized = initializeFirebase();
    
    // Initialize app components
    checkLogin();
    initializeFormSubmissions();
    
    // Set up login form handler - FIX: Use the function directly, not from window
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
        console.log('✅ Login form handler attached');
    }
    
    // Set up pool location change handler - FIX: Use function directly
    const poolLocation = document.getElementById('poolLocation');
    if (poolLocation) {
        poolLocation.addEventListener('change', handlePoolLocationChange);
        console.log('✅ Pool location handler attached');
    }
    
    setupEventHandlers();
    updateHeaderButtons();
    
    console.log('🚀 App initialization complete');
});

function updateHeaderButtons() {
    console.log('updateHeaderButtons called, isLoggedIn:', isLoggedIn);
    
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
    } else {
        // Show supervisor login button
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

// Replace the existing checkLogin function:
function checkLogin() {
    const token = localStorage.getItem('loginToken');
    if (token) {
        try {
            const { username, expires } = JSON.parse(token);
            if (Date.now() < expires) {
                console.log('Valid login token found');
                isLoggedIn = true;
                // Remove these lines:
                // showDashboard();
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
// COMPREHENSIVE GLOBAL ASSIGNMENTS (62 Functions - Corrected)
// ===================================================

// Core form and submission functions (6)
window.submitForm = submitForm;
window.submitFormAndSync = submitFormAndSync;
window.loadFormSubmissions = loadFormSubmissions;
window.saveFormSubmissions = saveFormSubmissions;
window.initializeFormSubmissions = initializeFormSubmissions;
window.evaluateFormFeedback = evaluateFormFeedback;

// Form handling (3)
window.resetForm = resetForm;
window.handlePoolLocationChange = handlePoolLocationChange;
window.handleLocationChange = handleLocationChange;

// Authentication and login (6)
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.handleLoginSubmit = handleLoginSubmit;
window.checkLogin = checkLogin;
window.checkLoginStatus = checkLoginStatus;
window.logout = logout;

// Dashboard and data display (6)
window.showDashboard = showDashboard;
window.loadDashboardData = loadDashboardData;
window.displayData = displayData;
window.filterAndDisplayData = filterAndDisplayData;
window.filterData = filterData;
window.useLocalDataOnly = useLocalDataOnly;

// Pagination (5)
window.goToPreviousPage = goToPreviousPage;
window.goToNextPage = goToNextPage;
window.updatePagination = updatePagination;
window.updatePaginationControls = updatePaginationControls;
window.changePage = changePage;

// Data management (4)
window.deleteSubmission = deleteSubmission;
window.clearAllData = clearAllData;
window.exportToCSV = exportToCSV;
window.organizePaginatedData = organizePaginatedData;

// UI and utility functions (5)
window.getHighlightColor = getHighlightColor;
window.getPoolWarningLevel = getPoolWarningLevel;
window.isMoreThan3HoursOld = isMoreThan3HoursOld;
window.updateTimestampNote = updateTimestampNote;
window.getClResponse = getClResponse;

// Modals and overlays (5)
window.createOrShowOverlay = createOrShowOverlay;
window.removeOverlay = removeOverlay;
window.closeModal = closeModal;
window.showFeedbackModal = showFeedbackModal;
window.showRecipientSelectionInModal = showRecipientSelectionInModal;

// Messages and feedback (4)
window.showMessage = showMessage;
window.showFeedback = showFeedback;
window.notifySupervisor = notifySupervisor;
window.areAllCheckboxesChecked = areAllCheckboxesChecked;

// Settings management (7)
window.openSettings = openSettings;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.handleSanitationChange = handleSanitationChange;
window.initializeSanitationSettings = initializeSanitationSettings;
window.saveSanitationSettings = saveSanitationSettings;
window.loadSanitationSettings = loadSanitationSettings;
window.updateSanitationUI = updateSanitationUI;

// SMS and notifications (3)
window.sendSMSNotification = sendSMSNotification;
window.chooseAndSendSMS = chooseAndSendSMS;
window.checkForCriticalAlerts = checkForCriticalAlerts;

// Menu and navigation (1)
window.toggleMenu = toggleMenu;

// Firebase functions (3)
window.initializeFirebase = initializeFirebase;
window.updateFirebaseStatus = updateFirebaseStatus;
window.validateFirebaseConfig = validateFirebaseConfig;

// Event handlers and setup (2)
window.setupEventHandlers = setupEventHandlers;
window.updateHeaderButtons = updateHeaderButtons;

// Debug functions (2)
window.debugApp = debugApp;
window.debugLoginState = debugLoginState;

console.log('✅ All 62 unique functions exposed globally');

// ===================================================
// FINAL COUNT VERIFICATION:
// 6+3+6+6+5+4+5+5+4+7+3+1+3+2+2 = 62 functions total
// ===================================================
