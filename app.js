// Firebase Configuration
// ⚠️  IMPORTANT: Replace these with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCRxSL2uuH6O5MFvbq0FS02zF2K_lXGvqI",
  authDomain: "chemlog-43c08.firebaseapp.com",
  projectId: "chemlog-43c08",
  storageBucket: "chemlog-43c08.firebasestorage.app",
  messagingSenderId: "554394202059",
  appId: "1:554394202059:web:a8d5824a1d7ccdd871d04e",
  measurementId: "G-QF5ZQ88VS2"
};

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
let app, db;

// Wait for Firebase to be available and DOM to load
document.addEventListener('DOMContentLoaded', function() {
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
});

function initializeFirebase() {
    try {
        // Check if Firebase config is properly set
        if (!validateFirebaseConfig()) {
            updateFirebaseStatus('⚠️ Firebase config not set - update app.js with your project credentials', true);
            return;
        }
        
        // Check if Firebase is available
        if (!window.firebase) {
            updateFirebaseStatus('Firebase SDK not loaded', true);
            return;
        }
        
        app = window.firebase.initializeApp(firebaseConfig);
        db = window.firebase.getFirestore(app);
        updateFirebaseStatus('✅ Firebase connected successfully');
        loadDashboardData();
    } catch (error) {
        console.error('Firebase initialization error:', error);
        updateFirebaseStatus(`❌ Firebase error: ${error.message}`, true);
    }
}

// Global variables
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;
const itemsPerPage = 20;
let isLoggedIn = false;

// Initialize the app
function updateFirebaseStatus(message, isError = false) {
    const statusElement = document.getElementById('firebaseStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? '#ff0000' : '#666';
    }
}

// Form submission function
async function submitForm() {
    if (!db) {
        showFeedback('Database not initialized. Please refresh the page.', 'error');
        return;
    }
    
    try {
        // Get form data
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            poolLocation: document.getElementById('poolLocation').value,
            mainPoolPH: document.getElementById('mainPoolPH').value,
            mainPoolCl: document.getElementById('mainPoolCl').value,
            secondaryPoolPH: document.getElementById('secondaryPoolPH').value,
            secondaryPoolCl: document.getElementById('secondaryPoolCl').value,
            timestamp: new Date(),
            submittedBy: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`
        };

        // Validate required fields
        if (!formData.firstName || !formData.lastName || !formData.poolLocation || 
            !formData.mainPoolPH || !formData.mainPoolCl) {
            alert('Please fill in all required fields');
            return;
        }

        // Submit to Firebase
        const docRef = await window.firebase.addDoc(window.firebase.collection(db, 'poolSubmissions'), formData);
        console.log('Document written with ID: ', docRef.id);
        
        // Show success message
        showFeedback('Form submitted successfully!', 'success');
        
        // Reset form
        document.getElementById('firstName').value = '';
        document.getElementById('lastName').value = '';
        document.getElementById('poolLocation').value = '';
        document.getElementById('mainPoolPH').value = '';
        document.getElementById('mainPoolCl').value = '';
        document.getElementById('secondaryPoolPH').value = '';
        document.getElementById('secondaryPoolCl').value = '';
        
        // Reset secondary pool visibility
        handlePoolLocationChange();
        
        // Refresh dashboard if logged in
        if (isLoggedIn) {
            loadDashboardData();
        }
        
    } catch (error) {
        console.error('Error adding document: ', error);
        showFeedback('Error submitting form. Please try again.', 'error');
        updateFirebaseStatus('Error submitting form', true);
    }
}

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

// Login modal functions
function openLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Simple authentication (you should use Firebase Auth for production)
    if (username === 'supervisor' && password === 'poolchem2025') {
        isLoggedIn = true;
        document.getElementById('mainForm').style.display = 'none';
        document.getElementById('supervisorDashboard').style.display = 'block';
        closeLoginModal();
        loadDashboardData();
    } else {
        alert('Invalid credentials');
    }
});

// Filter dashboard data
function filterData() {
    const poolFilter = document.getElementById('poolFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
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
    document.getElementById('dataTableBody1').innerHTML = '';
    document.getElementById('dataTableBody2').innerHTML = '';
    
    pageData.forEach(submission => {
        // Main pool table
        const row1 = document.createElement('tr');
        const timeString = submission.timestamp ? submission.timestamp.toLocaleString() : 'N/A';
        const isOld = submission.timestamp && (new Date() - submission.timestamp) > (3 * 60 * 60 * 1000); // 3 hours
        
        row1.innerHTML = `
            <td>${isOld ? '!!! ' : ''}${timeString}</td>
            <td>${submission.poolLocation || 'N/A'}</td>
            <td>${submission.mainPoolPH || 'N/A'}</td>
            <td>${submission.mainPoolCl || 'N/A'}</td>
        `;
        document.getElementById('dataTableBody1').appendChild(row1);
        
        // Secondary pool table (if data exists)
        if (submission.secondaryPoolPH || submission.secondaryPoolCl) {
            const row2 = document.createElement('tr');
            row2.innerHTML = `
                <td>${isOld ? '!!! ' : ''}${timeString}</td>
                <td>${submission.poolLocation || 'N/A'}</td>
                <td>${submission.secondaryPoolPH || 'N/A'}</td>
                <td>${submission.secondaryPoolCl || 'N/A'}</td>
            `;
            document.getElementById('dataTableBody2').appendChild(row2);
        }
    });
    
    updatePagination();
}

// Pagination functions
function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
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

// Export to CSV
function exportToCSV() {
    if (filteredSubmissions.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = ['Timestamp', 'Pool Location', 'Submitted By', 'Main Pool pH', 'Main Pool Cl', 'Secondary Pool pH', 'Secondary Pool Cl'];
    const csvContent = [
        headers.join(','),
        ...filteredSubmissions.map(submission => [
            submission.timestamp ? submission.timestamp.toLocaleString() : '',
            submission.poolLocation || '',
            submission.submittedBy || '',
            submission.mainPoolPH || '',
            submission.mainPoolCl || '',
            submission.secondaryPoolPH || '',
            submission.secondaryPoolCl || ''
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-chemistry-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Settings functions (placeholder)
function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function handleSanitationChange(checkbox) {
    // Placeholder for sanitation method changes
    console.log('Sanitation method changed:', checkbox.dataset.pool, checkbox.dataset.method, checkbox.checked);
}

// Feedback modal functions
function showFeedback(message, type = 'info') {
    const modal = document.getElementById('feedbackModal');
    const content = document.getElementById('modalContent');
    
    content.textContent = message;
    modal.style.display = 'block';
    modal.style.backgroundColor = type === 'error' ? '#ffebee' : '#e8f5e8';
    modal.style.color = type === 'error' ? '#c62828' : '#2e7d32';
    
    // Auto-close after 3 seconds
    setTimeout(() => {
        closeModal();
    }, 3000);
}

function closeModal() {
    document.getElementById('feedbackModal').style.display = 'none';
}

// SMS functions (placeholder)
function chooseAndSendSMS() {
    const selected = document.querySelector('input[name="smsRecipient"]:checked');
    if (selected) {
        alert(`SMS would be sent to: ${selected.value}`);
    } else {
        alert('Please select a recipient');
    }
}

// Make functions available globally
window.submitForm = submitForm;
window.handlePoolLocationChange = handlePoolLocationChange;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.filterData = filterData;
window.goToPreviousPage = goToPreviousPage;
window.goToNextPage = goToNextPage;
window.exportToCSV = exportToCSV;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.handleSanitationChange = handleSanitationChange;
window.showFeedback = showFeedback;
window.closeModal = closeModal;
window.chooseAndSendSMS = chooseAndSendSMS;
