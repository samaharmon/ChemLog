// ===================================================
// DATA MANAGEMENT
// ===================================================
let formSubmissions = [];
let filteredData = [];
let currentPage = 0;
let paginatedData = [];

// Default supervisor credentials
const supervisorCredentials = {
    email: 'capitalcity',
    password: '$ummer2025'
};


// ===================================================
// SANITATION SETTINGS
// ===================================================

// Declare sanitationSettings globally
let sanitationSettings = {};

// Initialize default sanitation settings (all pools default to bleach)
async function initializeSanitationSettings() {
    const pools = ['Camden CC', 'CC of Lexington', 'Columbia CC', 'Forest Lake', 'Forest Lake Lap Pool', 'Quail Hollow', 'Rockbridge', 'Wildewood', 'Winchester'];
    const statusDiv = document.getElementById('firebaseStatus');
    
    // Set defaults first
    pools.forEach(pool => {
        sanitationSettings[pool] = 'bleach'; // Default to bleach
    });

    // Try to load from Firebase if available
    try {
        if (window.firebase && window.firebase.db) {
            if (statusDiv) statusDiv.textContent = 'Loading settings from cloud...';
            const { db, doc, getDoc } = window.firebase;
            const settingsDoc = await getDoc(doc(db, 'settings', 'sanitationMethods'));
            
            if (settingsDoc.exists()) {
                const firebaseSettings = settingsDoc.data();
                // Merge Firebase settings with defaults
                Object.assign(sanitationSettings, firebaseSettings);
                console.log('Loaded sanitation settings from Firebase');
                if (statusDiv) statusDiv.textContent = 'Settings synced with cloud ✓';
            } else {
                console.log('No Firebase settings found, using defaults');
                if (statusDiv) statusDiv.textContent = 'Using default settings';
            }
        } else {
            // Fallback to localStorage if Firebase not available
            if (statusDiv) statusDiv.textContent = 'Loading local settings...';
            const saved = localStorage.getItem('sanitationSettings');
            if (saved) {
                sanitationSettings = JSON.parse(saved);
                console.log('Loaded sanitation settings from localStorage');
                if (statusDiv) statusDiv.textContent = 'Using local settings';
            } else {
                if (statusDiv) statusDiv.textContent = 'Using default settings';
            }
        }
    } catch (error) {
        console.warn('Could not load settings from Firebase, using defaults:', error);
        if (statusDiv) statusDiv.textContent = 'Using local settings (offline)';
        // Fallback to localStorage
        const saved = localStorage.getItem('sanitationSettings');
        if (saved) {
            sanitationSettings = JSON.parse(saved);
        }
    }
    
    // Hide status after 3 seconds
    setTimeout(() => {
        if (statusDiv) statusDiv.style.display = 'none';
    }, 3000);
}

// ===================================================
// INITIALIZATION
// ===================================================
document.addEventListener('DOMContentLoaded', async function () {
    await initializeSanitationSettings(); // Initialize sanitation settings
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
});

// ===================================================
// FORM HANDLING
// ===================================================
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

function submitForm() {
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
        timestamp: new Date().toLocaleString(),
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        poolLocation: document.getElementById('poolLocation').value,
        mainPoolPH: document.getElementById('mainPoolPH').value,
        mainPoolCl: document.getElementById('mainPoolCl').value,
        secondaryPoolPH: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolPH').value,
        secondaryPoolCl: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolCl').value
    };
    
    formSubmissions.push(submission);
    saveFormSubmissions(); // ADD THIS LINE - Save to localStorage after adding new submission
    
    showMessage('Submission saved successfully!', 'success');
    
    if (document.getElementById('supervisorDashboard').style.display === 'block') {
        loadDashboardData();
    }
    
    resetForm();
}

function resetForm() {
    // Reset all form fields
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
    
    handlePoolLocationChange();
}


// ===================================================
// LOGIN & AUTHENTICATION
// ===================================================
function handleLoginSubmit(e) {
    e.preventDefault();
    console.log('Login form submitted'); // Debug log
    
    const emailInput = document.querySelector('#loginForm input[name="email"]');
    const passwordInput = document.querySelector('#loginForm input[name="password"]');
    
    if (!emailInput || !passwordInput) {
        console.log('Login inputs not found'); // Debug log
        showMessage('Login form inputs not found.', 'error');
        return;
    }
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    console.log('Login attempt with email:', email); // Debug log (remove in production)
    
    if (email === supervisorCredentials.email && password === supervisorCredentials.password) {
        // Set persistent login token for 1 month
        const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem('loginToken', JSON.stringify({ username: email, expires }));
        closeLoginModal();
        showDashboard();
        loadDashboardData();
        showMessage('Login successful!', 'success');
    } else {
        showMessage('Invalid credentials. Please try again.', 'error');
    }
}

function openLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginForm').reset();
}

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
    // Don't automatically show login form - let user click supervisor login button
    return false;
}

function logout() {
    document.getElementById('dropdownMenu').style.display = 'none';
    localStorage.removeItem('loginToken');
    document.getElementById('supervisorDashboard').style.display = 'none';
    document.getElementById('mainForm').style.display = 'block';
    document.getElementById('poolFilter').value = '';
    document.getElementById('dateFilter').value = '';
    currentPage = 0;
    
    // Hide menu container and show login button
    const dashboardHeader = document.querySelector('.header');
    if (dashboardHeader) {
        const menuContainer = dashboardHeader.querySelector('.menu-container');
        if (menuContainer) {
            menuContainer.style.display = 'none';
        }
        
        const loginBtn = dashboardHeader.querySelector('.supervisor-login-btn');
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }
    }
}

// ===================================================
// DASHBOARD & DATA DISPLAY
// ===================================================
function showDashboard() {
    document.getElementById('mainForm').style.display = 'none';
    document.getElementById('supervisorDashboard').style.display = 'block';
    
    // Ensure the menu button is visible in the dashboard
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (dashboardHeader) {
        // Remove supervisor login button if it exists
        const loginBtn = document.querySelector('.supervisor-login-btn');
        if (loginBtn) {
            loginBtn.style.display = 'none';
        }
        
        // Check if menu container already exists
        let menuContainer = dashboardHeader.querySelector('.menu-container');
        if (!menuContainer) {
            // Create new menu container
            menuContainer = document.createElement('div');
            menuContainer.className = 'menu-container';
            menuContainer.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            
            // Create menu button (3 bars)
            const menuButton = document.createElement('button');
            menuButton.className = 'menu-btn';
            menuButton.innerHTML = '☰';
            menuButton.style.cssText = `
                background-color: rgba(255, 255, 255, 0.2);
                color: white;
                border: 2px solid white;
                border-radius: 0;
                padding: 10px 15px;
                cursor: pointer;
                font-size: 18px;
                font-family: 'Franklin Gothic Medium', Arial, sans-serif;
                transition: background-color 0.3s;
            `;
            menuButton.onclick = toggleMenu;
            
            // Create dropdown menu
            const dropdownMenu = document.createElement('div');
            dropdownMenu.id = 'dropdownMenu';
            dropdownMenu.className = 'dropdown-menu';
            dropdownMenu.style.cssText = `
                position: absolute;
                top: 100%;
                right: 0;
                background-color: white;
                border: 1px solid #ccc;
                border-radius: 0px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: none;
                min-width: 150px;
                z-index: 10000;
                overflow: hidden;
            `;
            
            const menuItems = [
                { text: 'Settings', onclick: 'showSettings()' },
                { text: 'Clear All Data', onclick: 'clearAllData()' },
                { text: 'Logout', onclick: 'logout()' }
            ];
            
            menuItems.forEach((item, index) => {
                const menuItem = document.createElement('div');
                menuItem.style.cssText = `
                    padding: 12px 16px;
                    cursor: pointer;
                    font-family: 'Franklin Gothic Medium', Arial, sans-serif;
                    color: #333;
                    font-size: 14px;
                    border-bottom: ${index < menuItems.length - 1 ? '1px solid #eee' : 'none'};
                    background-color: white;
                    transition: background-color 0.2s;
                `;
                menuItem.textContent = item.text;
                menuItem.onclick = () => {
                    eval(item.onclick);
                    dropdownMenu.style.display = 'none';
                };
                menuItem.onmouseover = () => menuItem.style.backgroundColor = '#f5f5f5';
                menuItem.onmouseout = () => menuItem.style.backgroundColor = 'white';
                
                dropdownMenu.appendChild(menuItem);
            });
            
            menuContainer.appendChild(menuButton);
            menuContainer.appendChild(dropdownMenu);
            dashboardHeader.appendChild(menuContainer);
        }
    }
    
    loadDashboardData(); // This will now show all saved data
}

function loadDashboardData() {
    filteredData = [...formSubmissions];
    paginatedData = organizePaginatedData(filteredData);
    currentPage = 0;
    displayData();
    updatePaginationControls();
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

function isMoreThan3HoursOld(timestamp) {
    const now = new Date();
    const submissionTime = new Date(timestamp);
    const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return submissionTime < threeHoursAgo;
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

function displayData() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    
    if (paginatedData.length === 0 || !paginatedData[currentPage]) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #666;">No data found</td></tr>';
        return;
    }
    
    const data = paginatedData[currentPage];
    
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
        
        let timestampDisplay = submission.timestamp;
        if (currentPage === 0 && isMoreThan3HoursOld(submission.timestamp)) {
            timestampDisplay = `<span style="color: red; font-weight: bold;">${submission.timestamp}</span>`;
        }
        
        const createCell = (value, color) => {
            if (color === 'red') {
                return `<td style="background-color: #ffcccc; color: #cc0000; font-weight: bold;">${value}</td>`;
            } else if (color === 'yellow') {
                return `<td style="background-color: #fff2cc; color: #b8860b; font-weight: bold;">${value}</td>`;
            } else {
                return `<td>${value}</td>`;
            }
        };
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${timestampDisplay}</td>
            <td>${submission.firstName} ${submission.lastName}</td>
            <td>${poolNameDisplay}</td>
            ${createCell(submission.mainPoolPH, mainPHColor)}
            ${createCell(submission.mainPoolCl, mainClColor)}
            ${createCell(submission.secondaryPoolPH, secondaryPHColor)}
            ${createCell(submission.secondaryPoolCl, secondaryClColor)}
        `;
        tbody.appendChild(row);
    });
    
    updateTimestampNote();
}

function updateTimestampNote() {
    const existingNote = document.getElementById('timestampNote');
    if (existingNote) {
        existingNote.remove();
    }
    
    if (currentPage === 0) {
        const tableContainer = document.getElementById('dataTable').parentNode;
        const note = document.createElement('div');
        note.id = 'timestampNote';
        note.style.cssText = 'font-size: 12px; color: #666; margin-top: 10px; text-align: center;';
        note.textContent = 'Timestamps highlighted in red are more than 3 hours old';
        tableContainer.appendChild(note);
    }
}

function updatePaginationControls() {
    const existingControls = document.getElementById('paginationControls');
    if (existingControls) {
        existingControls.remove();
    }
    
    if (paginatedData.length <= 1) return;
    
    const tableContainer = document.getElementById('dataTable').parentNode;
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'paginationControls';
    controlsDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; margin-top: 20px; gap: 15px;';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '◀';
    prevButton.style.cssText = `
        padding: 8px 12px; 
        border: 1px solid #ccc; 
        background: ${currentPage === 0 ? '#f0f0f0' : '#f9f9f9'};
        color: ${currentPage === 0 ? '#999' : '#333'};
        border-radius: 0px;
        cursor: ${currentPage === 0 ? 'not-allowed' : 'pointer'};
        font-size: 16px;
    `;
    prevButton.disabled = currentPage === 0;
    prevButton.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            displayData();
            updatePaginationControls();
        }
    });
    
    // Current page display
    const currentPageData = paginatedData[currentPage];
    const pageDisplayText = currentPage === 0 
        ? `Recent (${currentPageData.length})` 
        : `${new Date(currentPageData[0].timestamp).toLocaleDateString()} (${currentPageData.length})`;
    
    const pageDisplay = document.createElement('div');
    pageDisplay.style.cssText = `
        padding: 8px 16px;
        background: #69140e;
        color: white;
        border-radius: 0px;
        font-weight: bold;
        font-family: 'Franklin Gothic Medium', Arial, sans-serif;
        min-width: 200px;
        text-align: center;
    `;
    pageDisplay.textContent = pageDisplayText;
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '▶';
    nextButton.style.cssText = `
        padding: 8px 12px; 
        border: 1px solid #ccc; 
        background: ${currentPage === paginatedData.length - 1 ? '#f0f0f0' : '#f9f9f9'};
        color: ${currentPage === paginatedData.length - 1 ? '#999' : '#333'};
        border-radius: 0px;
        cursor: ${currentPage === paginatedData.length - 1 ? 'not-allowed' : 'pointer'};
        font-size: 16px;
    `;
    nextButton.disabled = currentPage === paginatedData.length - 1;
    nextButton.addEventListener('click', () => {
        if (currentPage < paginatedData.length - 1) {
            currentPage++;
            displayData();
            updatePaginationControls();
        }
    });
    
    controlsDiv.appendChild(prevButton);
    controlsDiv.appendChild(pageDisplay);
    controlsDiv.appendChild(nextButton);
    
    tableContainer.appendChild(controlsDiv);
}

function filterData() {
    const poolFilter = document.getElementById('poolFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    filteredData = formSubmissions.filter(submission => {
        let matchesPool = true;
        let matchesDate = true;
        
        if (poolFilter) {
            matchesPool = submission.poolLocation === poolFilter;
        }
        
        if (dateFilter) {
            const submissionDate = new Date(submission.timestamp).toISOString().split('T')[0];
            matchesDate = submissionDate === dateFilter;
        }
        
        return matchesPool && matchesDate;
    });
    
    paginatedData = organizePaginatedData(filteredData);
    currentPage = 0;
    displayData();
    updatePaginationControls();
}

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
// DATA PERSISTENCE
// ===================================================

// Save form submissions to localStorage
function saveFormSubmissions() {
    localStorage.setItem('formSubmissions', JSON.stringify(formSubmissions));
    console.log(`Saved ${formSubmissions.length} submissions to localStorage`);
}

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

// ===================================================
// FORM FEEDBACK EVALUATION
// ===================================================

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
                            messages.push('<strong>Raise the Cl level in the Baby Pool.</strong><br>Ensure that there are 2 total Cl tablets below a skimmer basket.');
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
}

// ===================================================
// FEEDBACK MODAL
// ===================================================
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

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        createOrShowOverlay(); // Show the overlay
        modal.style.display = 'flex'; // Display the modal
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none'; // Hide the modal
        removeOverlay(); // Remove the overlay
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

// Helper function to check if all checkboxes are checked
function areAllCheckboxesChecked() {
    const checkboxes = document.querySelectorAll('.feedback-checkbox');
    return Array.from(checkboxes).every(checkbox => checkbox.checked);
}

function chooseAndSendSMS() {
    const selectedRecipient = document.querySelector('input[name="smsRecipient"]:checked');
    if (selectedRecipient) {
        const recipientValue = selectedRecipient.value;
        alert(`Message sent successfully to ${recipientValue}`);
    } else {
        alert('Please select a recipient.');
    }
}

// ===================================================
// RECIPIENT SELECTION & SMS
// ===================================================
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


// ===================================================
// MENU AND SETTINGS FUNCTIONALITY
// ===================================================

// Toggle dropdown menu
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

// Show settings modal
function showSettings() {
    document.getElementById('dropdownMenu').style.display = 'none';
    document.getElementById('settingsModal').style.display = 'block';
    loadSanitationSettings();
}

// Close settings modal
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Load sanitation settings into the checkboxes
function loadSanitationSettings() {
    const checkboxes = document.querySelectorAll('.sanitation-checkbox');
    checkboxes.forEach(checkbox => {
        const pool = checkbox.dataset.pool;
        const method = checkbox.dataset.method;
        checkbox.checked = sanitationSettings[pool] === method;
    });
}

// Handle sanitation method changes
async function handleSanitationChange(checkbox) {
    const pool = checkbox.dataset.pool;
    const method = checkbox.dataset.method;
    
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
    
    // Save settings to Firebase (with localStorage fallback)
    try {
        if (window.firebase && window.firebase.db) {
            const { db, doc, setDoc } = window.firebase;
            await setDoc(doc(db, 'settings', 'sanitationMethods'), sanitationSettings);
            console.log('Saved sanitation settings to Firebase');
        } else {
            // Fallback to localStorage
            localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
            console.log('Saved sanitation settings to localStorage');
        }
    } catch (error) {
        console.warn('Could not save to Firebase, using localStorage:', error);
        localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
    }
}

// Updated function to get chlorine responses based on sanitation method
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

// Update your existing logout function to work with the new menu
function logout() {
    document.getElementById('dropdownMenu').style.display = 'none';
    localStorage.removeItem('loginToken');
    document.getElementById('supervisorDashboard').style.display = 'none';
    document.getElementById('mainForm').style.display = 'block';
    document.getElementById('poolFilter').value = '';
    document.getElementById('dateFilter').value = '';
    currentPage = 0;
}

// ===================================================
// MESSAGE BANNER
// ===================================================
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

function closeModal() {
    const feedbackModal = document.getElementById('feedbackModal');
    feedbackModal.style.display = 'none';
}