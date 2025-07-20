// Data storage
let formSubmissions = [];
let filteredData = [];
let currentPage = 0;
let paginatedData = [];

// Default supervisor credentials
const supervisorCredentials = {
    email: 'capitalcity',
    password: '$ummer2025'
};

// Handle pool location change to show/hide secondary pool
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

document.addEventListener('DOMContentLoaded', function() {
    handlePoolLocationChange();

    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        if (email === supervisorCredentials.email && password === supervisorCredentials.password) {
            closeLoginModal();
            showDashboard();
            loadDashboardData();
            showMessage('Login successful! Welcome to the supervisor dashboard.', 'success');
        } else {
            showMessage('Invalid credentials. Please try again.', 'error');
        }
    });
});

function openLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginForm').reset();
}

function showMessage(message, type) {
    const successMsg = document.getElementById('successMessage');
    const errorMsg = document.getElementById('errorMessage');
    
    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';
    
    if (type === 'success') {
        successMsg.textContent = message;
        successMsg.style.display = 'block';
        setTimeout(() => {
            successMsg.style.display = 'none';
        }, 5000);
    } else if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 5000);
    }
}

function submitForm() {
    console.log('Form submission started...');
    
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
    evaluateFormFeedback(formData);
    
    const submission = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        poolLocation: poolLocation,
        mainPoolPH: document.getElementById('mainPoolPH').value,
        mainPoolCl: document.getElementById('mainPoolCl').value,
        secondaryPoolPH: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolPH').value,
        secondaryPoolCl: poolLocation === 'Camden CC' ? 'N/A' : document.getElementById('secondaryPoolCl').value
    };
    
    showMessage('Submitting...', 'success');
    
    // Store locally only
    formSubmissions.push(submission);
    
    showMessage('Chemistry log submitted successfully!', 'success');
    
    if (document.getElementById('supervisorDashboard').style.display === 'block') {
        loadDashboardData();
    }
    
    resetForm();
}

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
    
    handlePoolLocationChange();
}

function showDashboard() {
    document.getElementById('mainForm').style.display = 'none';
    document.getElementById('supervisorDashboard').style.display = 'block';
}

function logout() {
    document.getElementById('supervisorDashboard').style.display = 'none';
    document.getElementById('mainForm').style.display = 'block';
    document.getElementById('poolFilter').value = '';
    document.getElementById('dateFilter').value = '';
    currentPage = 0;
    showMessage('Logged out successfully.', 'success');
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

function loadDashboardData() {
    filteredData = [...formSubmissions];
    paginatedData = organizePaginatedData(filteredData);
    currentPage = 0;
    displayData();
    updatePaginationControls();
}

function getHighlightColor(value, type) {
    if (!value || value === 'N/A' || value === '') return null;
    
    const valueStr = value.toString().trim();
    
    if (type === 'pH') {
        if (valueStr.startsWith('< 7.0') || valueStr === '< 7.0' || 
            valueStr.startsWith('> 8.0') || valueStr === '> 8.0' ||
            valueStr === '7.8' || valueStr === '8.0') {
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
    controlsDiv.style.cssText = 'text-align: center; margin-top: 20px;';
    
    paginatedData.forEach((pageData, index) => {
        const button = document.createElement('button');
        button.style.cssText = `
            margin: 0 5px; 
            padding: 8px 12px; 
            border: 1px solid #ccc; 
            background: ${index === currentPage ? '#4CAF50' : '#f9f9f9'};
            color: ${index === currentPage ? 'white' : '#333'};
            border-radius: 4px;
            cursor: pointer;
        `;
        
        if (index === 0) {
            button.textContent = `Recent (${pageData.length})`;
        } else {
            const pageDate = pageData.length > 0 ? new Date(pageData[0].timestamp).toLocaleDateString() : `Page ${index + 1}`;
            button.textContent = `${pageDate} (${pageData.length})`;
        }
        
        button.addEventListener('click', () => {
            currentPage = index;
            displayData();
            updatePaginationControls();
        });
        
        controlsDiv.appendChild(button);
    });
    
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

// Show modal with feedback
function showFeedbackModal(messages, isGood) {
    const existing = document.querySelector('.feedback-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'feedback-modal ' + (isGood ? 'good' : 'warning');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();

    const title = document.createElement('h2');
    title.textContent = isGood
        ? '✅ Water chemistry looks good!'
        : '🚨 You need to make immediate changes to the water chemistry:';

    const messageList = document.createElement('ul');
    messages.forEach(msg => {
        const li = document.createElement('li');
        li.innerHTML = msg;
        messageList.appendChild(li);
    });

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(messageList);

    // Show image if chlorine needs adjusting
    if (!isGood && messages.some(m => m.includes('chlorine feeder'))) {
        const img = document.createElement('img');
        img.src = 'setpoint.jpeg'; // Make sure this file is in your folder
        img.alt = 'Chlorine Setpoint Table';
        img.className = 'setpoint-table';
        modal.appendChild(img);
    }

    document.body.appendChild(modal);
}

// Evaluate submitted form data
function evaluateFormFeedback(formData) {
    const messages = [];
    const mainPH = formData.get('mainPoolPH') || '';
    const mainCl = formData.get('mainPoolCl') || '';
    const secPH = formData.get('secondaryPoolPH') || '';
    const secCl = formData.get('secondaryPoolCl') || '';

    const highPHValues = ['7.6', '7.8', '8.0', '> 8.0'];

    if (highPHValues.includes(mainPH)) {
        messages.push(
            `<strong>Lower the pH of the Main Pool.</strong><br>
            Add 1 gallon to the skimmer to reduce pH by 0.2–0.3 (max 2 gallons per session).`
        );
    }

    if (highPHValues.includes(secPH)) {
        messages.push(
            `<strong>Lower the pH of the Secondary Pool.</strong><br>
            - If baby pool: Add ~1/8 cup to skimmer. Recheck in 30 mins.<br>
            - If splash pad: Add ~1/4 cup to tank. Recheck in 30 mins.`
        );
    }

    if (mainPH === '< 7.0') {
        messages.push(`<strong>Notify a supervisor of the low pH in the Main Pool immediately.</strong>`);
    }

    if (secPH === '< 7.0') {
        messages.push(`<strong>Notify a supervisor of the low pH in the Secondary Pool immediately.</strong>`);
    }

    const validCl = ['3', '5'];
    if (mainCl && !validCl.includes(mainCl)) {
        messages.push(`Change the chlorine feeder rate for the Main Pool based on the setpoint table shown below.`);
    }

    if (secCl && !validCl.includes(secCl)) {
        messages.push(`Change the chlorine feeder rate for the Secondary Pool based on the setpoint table shown below.`);
    }

    showFeedbackModal(messages, messages.length === 0);
}
