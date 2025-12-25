import {
  app,
  db,
  auth,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getPools,
  listenPools
} from './firebase.js';



let formSubmissions = [];           // ✅ fixes ReferenceError at line 792
let filteredSubmissions = [];
let allSubmissions = [];
let filteredData = [];
let paginatedData = [];
let currentPage = 1;
const itemsPerPage = 20;
let isLoggedIn = false;
let sanitationSettings = {};        // ✅ fixes ReferenceError at line 695
let currentView = 'form';

// Pools from the Rule Editor (Firestore "pools" collection)
let availablePools = [];

// Markets used both in Metadata and dashboard filters
const MARKET_NAMES = ['Columbia', 'Greenville', 'Charlotte', 'Charleston'];
let marketVisibility = {};  // filled from settings

// ===== Chemistry form: dynamic number of pools =====

const MAX_POOLS_FOR_FORM = 5;

// index 0 = pool 1, etc.
const CHEM_POOL_SECTIONS = [
  { sectionId: 'mainPoolSection',      phId: 'mainPoolPH',      clId: 'mainPoolCl' },      // 1
  { sectionId: 'secondaryPoolSection', phId: 'secondaryPoolPH', clId: 'secondaryPoolCl' }, // 2
  { sectionId: 'pool3Section',         phId: 'pool3PH',         clId: 'pool3Cl' },         // 3
  { sectionId: 'pool4Section',         phId: 'pool4PH',         clId: 'pool4Cl' },         // 4
  { sectionId: 'pool5Section',         phId: 'pool5PH',         clId: 'pool5Cl' },         // 5
];

// ===== Global pool data helpers =====
window.availablePools = window.availablePools || [];
window.poolMetadataByName = window.poolMetadataByName || {};

const MARKET_ORDER = ['Columbia', 'Greenville', 'Charlotte', 'Charleston'];

// Static base list so legacy pools still appear even if no Firestore doc yet
const STATIC_POOLS = [
  { name: 'Camden CC',       markets: ['Columbia'], numPools: 1 },
  { name: 'Columbia CC',     markets: ['Columbia'], numPools: 2 },
  { name: 'Forest Lake',     markets: ['Columbia'], numPools: 2 },
  { name: 'CC of Lexington', markets: ['Columbia'], numPools: 2 },
  { name: 'Quail Hollow',    markets: ['Columbia'], numPools: 2 },
  { name: 'Rockbridge',      markets: ['Columbia'], numPools: 2 },
  { name: 'Wildewood',       markets: ['Columbia'], numPools: 2 },
  { name: 'Winchester',      markets: ['Columbia'], numPools: 2 },
];

function getPoolNameFromDoc(pool) {
  if (!pool || typeof pool !== 'object') return '';

  return (
    pool.name ||                      // preferred field
    pool.poolName ||                  // legacy field
    pool.id ||                        // Firestore doc.id if you ever pass it through
    (pool.metadata &&
      (pool.metadata.name || pool.metadata.poolName)) || // future/alt shape
    ''
  );
}

function getPoolMarketsFromDoc(pool) {
  if (!pool || typeof pool !== 'object') return [];

  // Prefer top-level fields, then metadata, then legacy `market`
  let raw =
    pool.markets ??
    (pool.metadata && pool.metadata.markets) ??
    pool.market ??
    (pool.metadata && pool.metadata.market) ??
    [];

  // Normalize to array<string>
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string' && raw.trim()) {
      raw = [raw.trim()];
    } else {
      return [];
    }
  }

  // Remove falsy values and trim strings
  return raw
    .map((m) => (typeof m === 'string' ? m.trim() : m))
    .filter(Boolean);
}

function toInt(value, fallback) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

// Build the master metadata map (static pools + Firestore pools)
function rebuildPoolMetadataMap(poolsFromFirestore) {
  const map = {};

  // Start with static pools so they always exist
  for (const p of STATIC_POOLS) {
    map[p.name] = {
      numPools: typeof p.numPools === 'number' ? p.numPools : 2,
      markets: Array.isArray(p.markets) && p.markets.length ? p.markets : ['Columbia'],
    };
  }

  // Overlay Firestore data (rule editor)
  const list = Array.isArray(poolsFromFirestore) ? poolsFromFirestore : [];
  for (const pool of list) {
    const name = getPoolNameFromDoc(pool);
    if (!name) continue;

    const existing = map[name] || {};
    const markets = getPoolMarketsFromDoc(pool);
    const numPools = toInt(pool.numPools, existing.numPools || 2);

    map[name] = {
      numPools,
      markets: markets.length ? markets : (existing.markets || ['Columbia']),
    };
  }

  window.poolMetadataByName = map;
  return map;
}

// How many chemistry sections should this pool have?
function getNumPoolsForChemForm(poolName) {
  if (!poolName) return 1;

  const meta = window.poolMetadataByName && window.poolMetadataByName[poolName];
  if (meta && typeof meta.numPools === 'number') {
    return meta.numPools;
  }

  // Fallbacks if metadata is missing
  if (poolName === 'Camden CC') return 1;
  return 2;
}

// Populated when you load pools from Firestore
window.poolMetadataByName = window.poolMetadataByName || {};

/**
 * Show/hide pool chemistry sections so that the number of
 * visible sections equals `numPools`. Also toggles required.
 */
function setChemistrySectionCount(numPools) {
  const enabledCount = Math.min(
    MAX_POOLS_FOR_FORM,
    Math.max(1, Number(numPools) || 1),
  );

  CHEM_POOL_SECTIONS.forEach((cfg, index) => {
    const section = document.getElementById(cfg.sectionId);
    const ph = document.getElementById(cfg.phId);
    const cl = document.getElementById(cfg.clId);
    const shouldShow = index < enabledCount;

    if (section) {
      section.classList.toggle('hidden', !shouldShow);
    }
    if (ph) {
      ph.required = shouldShow;
      if (!shouldShow) ph.value = '';
    }
    if (cl) {
      cl.required = shouldShow;
      if (!shouldShow) cl.value = '';
    }
  });
}

//===================================================
//Hoisted Functions
//===================================================

const SITE_KEY = '6LeuRpIrAAAAAPg8Z6ni-eDSkWSoT8eKCz83m7oQ';

function loadRecaptcha() {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha) return resolve(window.grecaptcha);

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => {
      if (window.grecaptcha) {
        resolve(window.grecaptcha);
      } else {
        reject(new Error("reCAPTCHA failed to load."));
      }
    };
    script.onerror = reject;

    document.head.appendChild(script);
  });
}

async function runRecaptcha(action = 'FORM_SUBMIT') {
  try {
    const grecaptcha = await loadRecaptcha();

    // ✅ Wrap reCAPTCHA in a manual Promise
    return new Promise((resolve, reject) => {
      grecaptcha.enterprise.ready(() => {
        grecaptcha.enterprise.execute(SITE_KEY, { action })
          .then(token => {
            console.log('✅ reCAPTCHA token:', token);
            resolve(token);
          })
          .catch(err => {
            console.warn('⚠️ Failed to execute reCAPTCHA:', err);
            reject(err);
          });
      });
    });

  } catch (err) {
    console.warn('⚠️ reCAPTCHA load failed:', err);
    return null;
  }
}


async function submitForm(event) {
  event?.preventDefault(); // Safely handle missing event

  console.log('📨 Submit button clicked');

  // Clear previous error highlights
  document.querySelectorAll('.form-group.error').forEach(group => {
    group.classList.remove('error');
  });

  // Run validation
  if (typeof validateForm === 'function' && !validateForm()) {
    showMessage('Please fill in all required fields.', 'error');
    return;
  }

  // Run reCAPTCHA
  const token = await runRecaptcha('FORM_SUBMIT');
  if (!token) {
    showMessage('reCAPTCHA verification failed. Please try again.', 'error');
    return;
  }

  // Supervisor login check (optional)
  const supervisorUsernameEl = document.getElementById('supervisorUsername');
  const supervisorPasswordEl = document.getElementById('supervisorPassword');

  if (supervisorUsernameEl && supervisorPasswordEl) {
    const username = supervisorUsernameEl.value.trim();
    const password = supervisorPasswordEl.value.trim();

    try {
      const res = await fetch('/verifySupervisorLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await res.json();

      if (!result.success) {
        showMessage('Invalid supervisor credentials.', 'error');
        return;
      }
    } catch (error) {
      console.error('Login check failed:', error);
      showMessage('Error verifying supervisor login.', 'error');
      return;
    }
  }

  // Evaluate pool chemistry feedback
  if (typeof evaluateFormFeedback === 'function') {
    evaluateFormFeedback();
  }

  // Get form field values safely
  const nameEl = document.querySelector('#name');
  const poolEl = document.querySelector('#poolLocation');
  const phEl = document.querySelector('#pH');
  const clEl = document.querySelector('#chlorine');

  if (!nameEl || !poolEl || !phEl || !clEl) {
    console.warn('❌ One or more form inputs not found');
    showMessage('Missing required form fields.', 'error');
    return;
  }

  const submission = {
    name: nameEl.value.trim(),
    poolLocation: poolEl.value.trim(),
    pH: parseFloat(phEl.value),
    chlorine: parseFloat(clEl.value),
    timestamp: new Date().toISOString(),
    recaptchaToken: token
  };

  // Save submission (local or Firebase)
  if (typeof saveFormSubmissions === 'function') {
    saveFormSubmissions(submission);
    console.log('✅ Submission saved:', submission);
  } else {
    console.warn('⚠️ saveFormSubmissions function not found');
  }

  showMessage('Submission saved successfully!', 'success');
}

window.submitForm = submitForm;

function validateForm() {
    let isValid = true;
    const requiredInputs = document.querySelectorAll('#mainForm input[required], #mainForm select[required]');

    requiredInputs.forEach(input => {
        // Handle select elements specifically
        if (input.tagName === 'SELECT') {
            if (input.value === '' || input.value === 'default') { // Assuming 'default' is your placeholder value
                input.closest('.form-group')?.classList.add('error');
                isValid = false;
            } else {
                input.closest('.form-group')?.classList.remove('error');
            }
        } else {
            // Handle text/number inputs
            if (input.value.trim() === '') {
                input.closest('.form-group')?.classList.add('error');
                isValid = false;
            } else {
                input.closest('.form-group')?.classList.remove('error');
            }
        }
    });

    // Special handling for secondary pool inputs if visible
    const poolLocationSelect = document.getElementById('poolLocation');
    const secondaryPoolSection = document.getElementById('secondaryPoolSection');

if (poolLocationSelect && poolHasSecondary(poolLocationSelect.value) &&
    secondaryPoolSection && !secondaryPoolSection.classList.contains('hidden')) {

        const secondaryPHInput = document.getElementById('secondaryPoolPH');
        const secondaryClInput = document.getElementById('secondaryPoolCl');

        if (secondaryPHInput && secondaryPHInput.value.trim() === '') {
            secondaryPHInput.closest('.form-group')?.classList.add('error');
            isValid = false;
        } else {
            secondaryPHInput.closest('.form-group')?.classList.remove('error');
        }

        if (secondaryClInput && secondaryClInput.value.trim() === '') {
            secondaryClInput.closest('.form-group')?.classList.add('error');
            isValid = false;
        } else {
            secondaryClInput.closest('.form-group')?.classList.remove('error');
        }
    }

    return isValid;
}
function openLoginModal() {
    console.log('openLoginModal called');
    
    if (isLoggedIn) {
        console.log('User already logged in, showing dashboard');
        showDashboard();
        return;
    }

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
        const firstInput = document.getElementById('inputEmail'); // This line is now correct
        // The 'if' statement needs to be on its own line, after the declaration and any comments
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);
    
    console.log('Login modal opened successfully');
}
window.openLoginModal = openLoginModal; 

function handlePoolLocationChange() {
  const select = document.getElementById('poolLocation');
  const selectedPool = select ? select.value : '';

  // Use metadata (and any special‑case logic inside getNumPoolsForChemForm)
  const numPools = getNumPoolsForChemForm(selectedPool);
  setChemistrySectionCount(numPools);

  // If you have any OTHER logic you want to run when the pool changes,
  // you can add it below this comment. Do NOT put any Firestore docSnap
  // or poolMetadataByName assignment code in here.
}



// In your script.js file

function closeLoginModal() {
    console.log('closeLoginModal called');
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Clear the input fields when the modal is closed
    const emailInput = document.getElementById('inputEmail'); // Use the new ID here
    const passwordInput = document.getElementById('password');

    if (emailInput) {
        emailInput.value = '';
    }
    if (passwordInput) {
        passwordInput.value = '';
    }

    removeOverlay(); // Assuming this function is defined elsewhere to remove a dimming overlay
}
async function handleLoginSubmit(event) {
    event.preventDefault();
    console.log('Login form submitted');

    const emailInput = document.getElementById('inputEmail');
    const passwordInput = document.querySelector('#loginForm input[name="password"]');

    if (!emailInput || !passwordInput) {
        console.error('Login inputs not found');
        showMessage('Login form inputs not found.', 'error');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    console.log('Login attempt with email:', email);

    // ✅ Run reCAPTCHA before checking credentials
    const token = await runRecaptcha('LOGIN');
    if (!token) {
        showMessage('reCAPTCHA failed. Please try again.', 'error');
        return;
    }

    // 🔐 Optional: send `token` to your backend or log it for now
    console.log('✅ Using reCAPTCHA token:', token);

    if (email === supervisorCredentials.email && password === supervisorCredentials.password) {
        console.log('Login successful');

        isLoggedIn = true;

        const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem('loginToken', JSON.stringify({ username: email, expires }));

        const dashboard = document.getElementById('supervisorDashboard');
        if (dashboard) {
            dashboard.classList.add('show');
        }

        closeLoginModal();
        showDashboard();
        updateHeaderButtons();
        showMessage('Login successful!', 'success');
    } else {
        console.log('Invalid credentials provided');
        showMessage('Invalid credentials. Please try again.', 'error');
    }
}

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
function saveFormSubmissions() {
    localStorage.setItem('formSubmissions', JSON.stringify(formSubmissions));
    console.log(`Saved ${formSubmissions.length} submissions to localStorage`);
}
function exportToCSV() {
    if (!Array.isArray(filteredSubmissions) || filteredSubmissions.length === 0) {
        showMessage('No data to export.', 'error');
        return;
    }
    
    const headers = ['Timestamp', 'First Name', 'Last Name', 'Pool Location', 'Main pH', 'Main Cl', 'Secondary pH', 'Secondary Cl'];
    
    const csvContent = [
        headers.join(','),
        ...filteredSubmissions.map(row => [
            `"${row.timestamp instanceof Date ? row.timestamp.toLocaleString() : row.timestamp}"`,
            `"${row.firstName || ''}"`,
            `"${row.lastName || ''}"`,
            `"${row.poolLocation || ''}"`,
            `"${row.mainPoolPH || ''}"`,
            `"${row.mainPoolCl || ''}"`,
            `"${row.secondaryPoolPH || ''}"`,
            `"${row.secondaryPoolCl || ''}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-chemistry-data-${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showMessage('Data exported successfully!', 'success');
}

function filterData() {
    filterAndDisplayData();
}


function goToPreviousPage() {
    if (currentPage > 0) {
        currentPage--;
        displayData();
        updatePaginationControls();
    }
}

function goToNextPage() {
    const totalPages = paginatedData.length;
    if (currentPage < totalPages - 1) {
        currentPage++;
        displayData();
        updatePaginationControls();
    }
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
        removeOverlay();
}

// poolName -> { bleach: boolean, granular: boolean }
window.sanitationState = window.sanitationState || {};

/**
 * Build the sanitation table from metadata and current state.
 */
function renderSanitationSettingsTable() {
  const tbody = document.getElementById('sanitationTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Group pools by market
  const byMarket = new Map();

  Object.entries(window.poolMetadataByName || {}).forEach(([poolName, meta]) => {
    const markets = meta.markets && meta.markets.length ? meta.markets : ['Unassigned'];

    markets.forEach((mkt) => {
      if (!byMarket.has(mkt)) byMarket.set(mkt, []);
      byMarket.get(mkt).push(poolName);
    });
  });

  const allMarkets = Array.from(byMarket.keys()).sort((a, b) => {
    const ai = MARKET_ORDER.indexOf(a);
    const bi = MARKET_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  allMarkets.forEach((market) => {
    const pools = (byMarket.get(market) || []).sort();

    // Market heading row
    const marketRow = document.createElement('tr');
    marketRow.classList.add('market-row');
    const marketCell = document.createElement('td');
    marketCell.colSpan = 3;
    marketCell.textContent = market;
    marketCell.style.textAlign = 'left';
    marketCell.style.fontWeight = 'bold';
    marketRow.appendChild(marketCell);
    tbody.appendChild(marketRow);

    // One row per pool
    pools.forEach((poolName) => {
      const row = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = poolName;
      row.appendChild(nameTd);

      ['bleach', 'granular'].forEach((method) => {
        const td = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'sanitation-checkbox';
        cb.dataset.pool = poolName;
        cb.dataset.method = method;
        cb.checked = !!(
          window.sanitationState[poolName] &&
          window.sanitationState[poolName][method]
        );
        cb.addEventListener('change', () => handleSanitationChange(cb));
        td.appendChild(cb);
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });
  });
}

async function handleSanitationChange(checkboxEl) {
  if (!checkboxEl) return;

  const poolName = checkboxEl.dataset.pool;
  const method = checkboxEl.dataset.method; // 'bleach' | 'granular'
  const isChecked = checkboxEl.checked;

  if (!poolName || !method) return;

  if (!window.sanitationState[poolName]) {
    window.sanitationState[poolName] = { bleach: false, granular: false };
  }
  window.sanitationState[poolName][method] = isChecked;

  try {
    // Adjust collection/doc IDs to whatever you’re using now:
    const docRef = doc(db, 'sanitationSettings', poolName);
    await setDoc(docRef, { [method]: isChecked }, { merge: true });
  } catch (err) {
    console.error('Error saving sanitation setting', err);
  }
}

async function loadSanitationSettings() {
  window.sanitationState = {};

  const snap = await getDocs(collection(db, 'sanitationSettings'));
  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    window.sanitationState[docSnap.id] = {
      bleach: !!data.bleach,
      granular: !!data.granular,
    };
  });

  renderSanitationSettingsTable();
}

// =====================
// Pool metadata loader
// =====================

async function loadPoolsMetadata() {
  if (!db) {
    console.warn('⚠️ Firestore not initialized — cannot load pool metadata.');
    return;
  }

  // Reset global containers
  window.poolMetadataByName = {};
  availablePools = [];

  try {
    const snap = await getDocs(collection(db, 'pools')); // adjust collection name if needed

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const poolName = data.poolName || data.name;  // whichever your docs use

      if (!poolName) return;

      // Save the raw doc for dropdowns, etc.
      availablePools.push(data);

      // Save the metadata we care about for the chem form + settings modal
      window.poolMetadataByName[poolName] = {
        numPools: typeof data.numPools === 'number' ? data.numPools : 1,
        markets: Array.isArray(data.markets) ? data.markets : (data.markets ? [data.markets] : []),
      };
    });

    // Refresh any UIs that depend on pools
    updatePoolLocationDropdown?.();
    updatePoolFilterDropdown?.();
    renderSanitationSettingsTable?.();
  } catch (err) {
    console.error('❌ Failed to load pool metadata:', err);
  }
}

function closeModal() {
    const feedbackModal = document.getElementById('feedbackModal');
    feedbackModal.style.display = 'none';
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

  // Highlight certain values
  const mainPH = latest.mainPoolPH;
  const secPH = latest.secondaryPoolPH;
  const mainCl = latest.mainPoolCl;
  const secCl = latest.secondaryPoolCl;

  const mainPoolPHText = mainPH === '< 7.0'
    ? `⚠️ Main Pool pH: ${mainPH} - REQUIRES ATTENTION ⚠️`
    : `Main Pool pH: ${mainPH}`;

  const secPoolPHText = secPH === '< 7.0'
    ? `⚠️ Secondary Pool pH: ${secPH} - REQUIRES ATTENTION ⚠️`
    : `Secondary Pool pH: ${secPH}`;

  const mainPoolClText = (mainCl === '10' || mainCl === '> 10' || parseFloat(mainCl) > 10)
    ? `⚠️ Main Pool Cl: ${mainCl} - HIGH LEVEL ⚠️`
    : `Main Pool Cl: ${mainCl}`;

  const secPoolClText = (secCl === '10' || secCl === '> 10' || parseFloat(secCl) > 10)
    ? `⚠️ Secondary Pool Cl: ${secCl} - HIGH LEVEL ⚠️`
    : `Secondary Pool Cl: ${secCl}`;

  const message =
    `Pool Chemistry Log\n\n` +
    `Submitted by: ${latest.firstName} ${latest.lastName}\n` +
    `Pool Location: ${latest.poolLocation}\n\n` +
    `${mainPoolPHText}\n` +
    `${mainPoolClText}\n` +
    `${secPoolPHText}\n` +
    `${secPoolClText}\n\n` +
    `Time: ${latest.timestamp}`;

  // Send SMS to each selected recipient
  selectedRecipients.forEach(recipient => {
    window.location.href = `sms:${recipient}?body=${encodeURIComponent(message)}`;
  });

  // ✅ Do NOT close modal or overlay — let user manually close it
  console.log('📤 SMS sent — modal remains open for manual dismissal');
}


function areAllCheckboxesChecked(modal) {
  const checkboxes = modal.querySelectorAll('.feedback-checkbox');
  return Array.from(checkboxes).every(cb => cb.checked);
}

function showFeedbackModal(messages, isGood, setpointImgNeeded) {
  // ❌ Prevent duplicate modals
  const existingModal = document.querySelector('.feedback-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // ✅ Create overlay if needed
  if (typeof createOrShowOverlay === 'function') {
    createOrShowOverlay();
  }

  // ✅ Create modal
  const modal = document.createElement('div');
  modal.className = 'feedback-modal ' + (isGood ? 'good' : 'warning');

  // Close button logic
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => {
    if (isGood || areAllCheckboxesChecked(modal)) {
      modal.remove();
      removeOverlay?.();
    } else {
      showMessage(
        'Please complete all water chemistry changes and check them off the list before closing.',
        'error'
      );
    }
  };

  // Feedback content
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
      if (msg.includes('Images/setpoint.jpeg')) {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'setpoint-container';
        chartContainer.style.textAlign = 'center';
        chartContainer.style.margin = '20px 0';

        const chart = document.createElement('img');
        chart.src = 'Images/setpoint.jpeg';
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
    message.textContent = messages[0] || 'Everything looks good.';
    feedbackContent.appendChild(message);
  }

  // Optional: Notify Supervisor Button
  const shouldShowNotifyButton = messages.some(msg =>
    msg.toLowerCase().includes('notify a supervisor')
  );

  if (shouldShowNotifyButton) {
    const notifyBtn = document.createElement('button');
    notifyBtn.className = 'notify-btn';
    notifyBtn.textContent = 'Notify a Supervisor';
    notifyBtn.onclick = () => {
      if (typeof showRecipientSelectionInModal === 'function') {
        showRecipientSelectionInModal(modal);
      }
    };
    modal.appendChild(notifyBtn);
  }

  // Assemble and append modal
  modal.appendChild(closeBtn);
  modal.appendChild(feedbackContent);
  document.body.appendChild(modal);

  console.log('✅ Feedback modal displayed. isGood:', isGood);
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
function getClResponse(poolLocation, isMainPool, clValue) {
    if (poolLocation === 'Forest Lake' && !isMainPool) {
        const sanitationMethod = sanitationSettings['Forest Lake Lap Pool'] || 'bleach';

        if (sanitationMethod === 'granular') {
            if (clValue === '0') {
                return `<strong>Raise the Cl level in the Lap Pool.</strong><br>Make sure that a skimmer has suction, then add 5 scoops of granular/shock to the skimmer. Never add more than 5 scoops to the lap pool at one time.`;
            }
            if (clValue === '1') {
                return `<strong>Raise the Cl level in the Lap Pool.</strong><br>Make sure that a skimmer has suction, then add 4 scoops of granular/shock to the skimmer. Never add more than 5 scoops to the lap pool at one time.`;
            }
            if (clValue === '2') {
                return `<strong>Raise the Cl level in the Lap Pool.</strong><br>Make sure that a skimmer has suction, then add 3 scoops of granular/shock to the skimmer. Never add more than 5 scoops to the lap pool at one time.`;
            }
            if (clValue === '10') {
                return `<strong>Lower the Cl level of the Lap Pool.</strong><br>Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.`;
            }
            if (clValue === '> 10') {
                return `<strong>Notify a supervisor of the high Cl in the Lap Pool immediately. Lower the Cl level of the Main Pool.</strong><br>Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.`;
            }
        }
    }
    return null;
}

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

async function initializeSanitationSettings() {
    const pools = [
        'Camden CC', 'CC of Lexington', 'Columbia CC', 'Forest Lake',
        'Forest Lake Lap Pool', 'Quail Hollow', 'Rockbridge', 'Wildewood', 'Winchester'
    ];
    const statusDiv = document.getElementById('firebaseStatus');

    console.log('Initializing sanitation settings...');
    updateFirebaseStatus('');

    // Set defaults first
    pools.forEach(pool => {
        sanitationSettings[pool] = 'bleach';
    });

    try {
        if (!db) throw new Error('Firestore not initialized');

        const settingsRef = doc(db, 'settings', 'sanitationMethods');
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
            const firebaseSettings = settingsDoc.data();
            Object.assign(sanitationSettings, firebaseSettings);
            console.log('✅ Loaded sanitation settings from Firebase:', sanitationSettings);
            updateFirebaseStatus('');
        } else {
            console.log('⚠️ No Firebase settings found, saving defaults');
            await setDoc(settingsRef, sanitationSettings); // ✅ uses imported setDoc
            updateFirebaseStatus('Default settings saved to cloud');
        }
    } catch (error) {
        console.warn('⚠️ Could not load from Firebase, using localStorage fallback:', error);
        updateFirebaseStatus('Using local settings (offline fallback)');

        const saved = localStorage.getItem('sanitationSettings');
        if (saved) {
            sanitationSettings = JSON.parse(saved);
            console.log('📦 Loaded sanitation settings from localStorage:', sanitationSettings);
        } else {
            localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
            console.log('💾 Saved default settings to localStorage');
        }
    }

    console.log('✅ Final sanitationSettings after initialization:', sanitationSettings);
    updateSanitationUI();

    setTimeout(() => {
        if (statusDiv) statusDiv.style.display = 'none';
    }, 3000);
}

let sanitationUnsubscribe = null; // to store the listener cleanup function if needed

function startSanitationSettingsListener() {
  if (!db) {
    console.warn("⚠️ Firestore not initialized — cannot start sanitation settings listener.");
    return;
  }

  // Prevent duplicate listeners
  if (sanitationUnsubscribe) {
    sanitationUnsubscribe(); // clean up previous listener if it exists
    sanitationUnsubscribe = null;
  }

  try {
    const settingsRef = doc(db, 'settings', 'sanitationMethods');

    sanitationUnsubscribe = onSnapshot(
      settingsRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          sanitationSettings = docSnapshot.data();
          console.log('🔄 Sanitation settings updated from Firestore:', sanitationSettings);

          if (typeof updateSanitationCheckboxesFromSettings === 'function') {
            updateSanitationCheckboxesFromSettings();
          }
        } else {
          console.warn('⚠️ Sanitation settings document does not exist.');
        }
      },
      (error) => {
        console.error('❌ Firestore listener error (sanitation settings):', error);
        // Optional: fallback to localStorage here if you want
        const saved = localStorage.getItem('sanitationSettings');
        if (saved) {
          sanitationSettings = JSON.parse(saved);
          console.log('💾 Fallback to sanitation settings from localStorage:', sanitationSettings);
          updateSanitationCheckboxesFromSettings?.();
        }
      }
    );
  } catch (error) {
    console.error('❌ Failed to start sanitation listener:', error);
  }
}


function applySanitationSettingsToCheckboxes() {
    Object.entries(sanitationSettings).forEach(([pool, method]) => {
        const bleachCheckbox = document.querySelector(`[data-pool="${pool}"][data-method="bleach"]`);
        const granularCheckbox = document.querySelector(`[data-pool="${pool}"][data-method="granular"]`);
        if (bleachCheckbox && granularCheckbox) {
            bleachCheckbox.checked = method === 'bleach';
            granularCheckbox.checked = method === 'granular';
        }
    });
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

function cleanupTestSubmissions() {
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  const badTimestamp = "7/24/2025, 4:58:31 PM";

  formSubmissions = formSubmissions.filter(submission => {
    const isTest = submission.firstName === 'TEST';

    const time = new Date(submission.timestamp).getTime();
    const isExpired = !isNaN(time) && now - time > FIVE_MINUTES;

    const poolNameBlank = !submission.poolLocation || submission.poolLocation.trim() === '';

    const mainPH = submission.mainPoolPH;
    const mainCl = submission.mainPoolCl;
    const secondaryPH = submission.secondaryPoolPH;
    const secondaryCl = submission.secondaryPoolCl;

    const hasInvalidChemistry = [mainPH, mainCl, secondaryPH, secondaryCl].some(value =>
      value === "N/A" || value === "" || value === null || value === undefined
    );

    if (new Date(submission.timestamp).toLocaleString() === badTimestamp) {
      console.log(`🧹 Deleted submission with bad timestamp: ${badTimestamp} (ID: ${submission.id})`);
      return false;
    }

    if (isTest && isExpired) {
      console.log(`🧹 Deleted expired TEST submission (ID: ${submission.id})`);
      return false;
    }

    if (poolNameBlank) {
      console.log(`🧹 Deleted submission with blank pool name (ID: ${submission.id})`);
      return false;
    }

    if (hasInvalidChemistry) {
      console.log(`🧹 Deleted submission with invalid chemistry (ID: ${submission.id})`);
      return false;
    }

    return true; // Keep it
  });

  localStorage.setItem('formSubmissions', JSON.stringify(formSubmissions));
}

function parseLocalDate(dateString) {
    const parts = dateString.split('-'); // ["2025", "08", "07"]
    return new Date(parts[0], parts[1] - 1, parts[2]); // Year, MonthIndex, Day
}

function organizePaginatedData(data) {
    if (data.length === 0) return [];

    // Sort all data descending by timestamp first
    const sortedData = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Page 0: Most recent submission per pool, sorted alphabetically
    const page0Map = new Map();
    for (let item of sortedData) {
        if (!page0Map.has(item.poolLocation)) {
            page0Map.set(item.poolLocation, item);
        }
    }
    const page0 = Array.from(page0Map.values()).sort((a, b) => a.poolLocation.localeCompare(b.poolLocation));

    // Group pages by date only (ignore pool)
    const groupedByDate = {};
    for (let item of sortedData) {
        const dateOnly = new Date(item.timestamp).toLocaleDateString();
        if (!groupedByDate[dateOnly]) groupedByDate[dateOnly] = [];
        groupedByDate[dateOnly].push(item);
    }

    // Sort date keys descending (most recent date first)
    const dateKeys = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

    // Build pages array starting with page 0
    const pages = [page0];

    for (const dateKey of dateKeys) {
        let submissions = groupedByDate[dateKey];

        // Sort submissions by pool name alphabetically, then timestamp descending
        submissions.sort((a, b) => {
            const poolCompare = a.poolLocation.localeCompare(b.poolLocation);
            if (poolCompare !== 0) return poolCompare;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        pages.push(submissions);
    }

    return pages;
}



// Initialize form submissions on app start
function initializeFormSubmissions() {
    loadFormSubmissions(); // Load from localStorage

    // Remove test entries first
    cleanupTestSubmissions();

    // Remove entries with missing or blank pool names
    formSubmissions = formSubmissions.filter(sub => sub.poolLocation && sub.poolLocation.trim() !== '');

    // Save cleaned data back to localStorage
    localStorage.setItem('formSubmissions', JSON.stringify(formSubmissions));

    console.log(`Initialized with ${formSubmissions.length} cleaned form submissions`);
}

// Updated loadDashboardData to work with both Firebase and localStorage
async function loadDashboardData() {
  console.log('📊 Loading dashboard data...');

  // Load local data first
  cleanupTestSubmissions?.();
  loadFormSubmissions?.();

  if (!db) {
    console.warn('❌ No Firebase connection — using local data only');
    updateFirebaseStatus?.('Offline — using local data');
    useLocalDataOnly?.();
    return;
  }

  try {
    const submissionsRef = collection(db, 'poolSubmissions');

    // Check collection exists and has timestamped docs
    const initialSnapshot = await getDocs(submissionsRef);

    if (initialSnapshot.empty) {
      console.warn('⚠️ poolSubmissions collection is empty');
      updateFirebaseStatus?.('No cloud submissions — showing local data');
      useLocalDataOnly?.();
      return;
    }

    const hasValidTimestamp = initialSnapshot.docs.some(doc => {
      const ts = doc.data().timestamp;
      return ts && typeof ts.toDate === 'function';
    });

    if (!hasValidTimestamp) {
      console.warn('❌ No valid timestamps found in poolSubmissions. Skipping real-time listener.');
      updateFirebaseStatus?.('Invalid timestamps — showing local data');
      useLocalDataOnly?.();
      return;
    }

    // All good — set up real-time listener
    const q = query(submissionsRef, orderBy('timestamp', 'desc'));

    onSnapshot(q, (querySnapshot) => {
      const firebaseSubmissions = [];

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        data.id = docSnapshot.id;

        if (data.timestamp?.toDate) {
          data.timestamp = data.timestamp.toDate();
        }

        firebaseSubmissions.push(data);
      });

      console.log(`✅ Loaded ${firebaseSubmissions.length} submissions from Firebase`);

      allSubmissions = [...firebaseSubmissions];

      // Merge in any new local submissions not yet synced
      formSubmissions.forEach(local => {
        const exists = allSubmissions.some(sub => sub.id === local.id);
        if (!exists) {
          if (typeof local.timestamp === 'string') {
            local.timestamp = new Date(local.timestamp);
          }
          allSubmissions.push(local);
        }
      });

      updateFirebaseStatus?.(`Loaded ${allSubmissions.length} total submissions`);

      if (isLoggedIn) {
        filterAndDisplayData?.();
      }
    }, (error) => {
      console.error('🔥 Firestore listener failed:', error);
      updateFirebaseStatus?.('Error loading cloud data — fallback to local', true);
      useLocalDataOnly?.();
    });

  } catch (error) {
    console.error('❌ loadDashboardData() failed:', error);
    updateFirebaseStatus?.('Error loading data — fallback to local', true);
    useLocalDataOnly?.();
  }
}


async function confirmClearData() {
    const input = prompt(
        'WARNING: This will permanently delete ALL chemistry log data.\n\nType "DELETE" (in all caps) to confirm.'
    );

    if (input !== "DELETE") {
        alert("Data purge cancelled.");
        return;
    }

    try {
        if (!db) {
            throw new Error("Firestore is not initialized.");
        }

        const collectionRef = collection(db, 'formSubmissions');

        let totalDeleted = 0;
        let deletedThisRound;

        do {
            const snapshot = await getDocs(
                query(
                    collectionRef,
                    orderBy('timestamp'),
                    limit(500)
                )
            );

            if (snapshot.empty) break;

            const batch = writeBatch(db);

            snapshot.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            await batch.commit();
            deletedThisRound = snapshot.size;
            totalDeleted += deletedThisRound;

            console.log(`🗑️ Deleted ${deletedThisRound} documents in this batch...`);

        } while (deletedThisRound === 500); // Continue if more to delete

        alert(`✅ Deleted ${totalDeleted} chemistry log entries successfully.`);

        // Optional refresh
        if (typeof loadDashboardData === 'function') {
            loadDashboardData();
        }

    } catch (error) {
        console.error("❌ Error clearing dashboard data:", error);
        alert("Failed to delete data. Check the console for details.");
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

function filterAndDisplayData() {
    console.group('🔍 filterAndDisplayData');

    const poolFilter = document.getElementById('poolFilter')?.value || '';
    const dateFilter = document.getElementById('dateFilter')?.value || '';

    function parseLocalDate(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('-');
        if (parts.length !== 3) return null;
        const year  = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day   = Number(parts[2]);
        return new Date(year, month, day);
    }

    function getDateWithoutTime(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    const filterDateObj = parseLocalDate(dateFilter);

    // Market settings: which markets are enabled?
    const enabledMarkets = getEnabledMarkets();
    const hasMarketSettings = MARKET_NAMES.some(m =>
        Object.prototype.hasOwnProperty.call(marketVisibility, m)
    );

    console.log('Pool filter:', poolFilter);
    console.log('Date filter (raw):', dateFilter);
    console.log('Date filter (parsed):', filterDateObj);
    console.log('Enabled markets:', enabledMarkets);
    console.log('Has market settings:', hasMarketSettings);
    console.log('Total submissions before filter:', allSubmissions.length);

    filteredSubmissions = allSubmissions.filter(sub => {
        // 1. Market filter from settings (union of selected markets)
        if (hasMarketSettings) {
            const poolMarkets = getPoolMarketsForName(sub.poolLocation);
            if (enabledMarkets.length > 0) {
                const matchesMarket = poolMarkets.some(m => enabledMarkets.includes(m));
                if (!matchesMarket) {
                    return false;
                }
            }
        }

        // 2. Explicit pool filter from the dropdown
        if (poolFilter && poolFilter !== '' && poolFilter !== 'All Pools') {
            if (sub.poolLocation !== poolFilter) {
                return false;
            }
        }

        // 3. Date filter (normalize both to yyyy-mm-dd)
        if (filterDateObj) {
            let submissionDate;

            if (sub.timestamp instanceof Date) {
                submissionDate = sub.timestamp;
            } else if (sub.timestamp && typeof sub.timestamp.toDate === 'function') {
                submissionDate = sub.timestamp.toDate();   // Firestore Timestamp
            } else if (sub.timestamp) {
                submissionDate = new Date(sub.timestamp);
            } else {
                return false;
            }

            if (Number.isNaN(submissionDate.getTime())) {
                return false;
            }

            const normalizedFilterDate     = getDateWithoutTime(filterDateObj);
            const normalizedSubmissionDate = getDateWithoutTime(submissionDate);

            if (normalizedSubmissionDate.getTime() !== normalizedFilterDate.getTime()) {
                return false;
            }
        }

        // If we got here, the submission passes all active filters
        return true;
    });

    console.log('Filtered submissions count:', filteredSubmissions.length);

    paginatedData = organizePaginatedData(filteredSubmissions || []);
    currentPage = 0;

    displayData();
    updatePaginationControls();

    console.groupEnd();
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
    const pagination = document.getElementById('pagination');

    if (!prevBtn || !nextBtn || !pageInfo || !pagination) return;

    const totalPages = paginatedData.length;

    // Hide pagination if only one or zero pages
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';

    // Enable/disable buttons
    prevBtn.disabled = currentPage === 0;
    prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
    prevBtn.style.cursor = prevBtn.disabled ? 'not-allowed' : 'pointer';

    nextBtn.disabled = currentPage >= totalPages - 1;
    nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
    nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';

    // Show date from first item on the current page
    const currentPageData = paginatedData[currentPage] || [];
    if (currentPageData.length > 0) {
        const dateString = new Date(currentPageData[0].timestamp).toLocaleDateString();
        pageInfo.textContent = dateString;
    } else {
        pageInfo.textContent = '';
    }
}


function displayData() {
    console.group('🖥 displayData');

    const tbody1 = document.getElementById('dataTableBody1');
    const tbody2 = document.getElementById('dataTableBody2');

    if (!tbody1 || !tbody2) {
        console.warn('⚠ Table body elements not found (dataTableBody1 / dataTableBody2).');
        console.groupEnd();
        return;
    }

    // Clear previous rows
    tbody1.innerHTML = '';
    tbody2.innerHTML = '';

    if (!Array.isArray(paginatedData) || paginatedData.length === 0 || !paginatedData[currentPage]) {
        // No data for current page
        tbody1.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:#666;">No data found</td></tr>';
        tbody2.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:#666;">No data found</td></tr>';
        console.warn('⚠ No data to display.');
        console.groupEnd();
        return;
    }

    const data = paginatedData[currentPage];
    console.log('Displaying', data.length, 'items for page', currentPage);

    let hasSecondaryData = false;

    const createCell = (value, color) => {
        const className = color ? `highlight-${color}` : '';
        return `<td class="${className}">${value || 'N/A'}</td>`;
    };

    data.forEach(submission => {
        const mainPHColor = getHighlightColor(submission.mainPoolPH, 'pH');
        const mainClColor = getHighlightColor(submission.mainPoolCl, 'cl');
        const secondaryPHColor = getHighlightColor(submission.secondaryPoolPH, 'pH');
        const secondaryClColor = getHighlightColor(submission.secondaryPoolCl, 'cl');
        const warningLevel = getPoolWarningLevel(submission.mainPoolPH, submission.mainPoolCl, submission.secondaryPoolPH, submission.secondaryPoolCl);

        // Format timestamp
        let timestampDisplay = '';
        try {
            timestampDisplay = submission.timestamp instanceof Date
                ? submission.timestamp.toLocaleString()
                : new Date(submission.timestamp).toLocaleString();
        } catch {
            timestampDisplay = String(submission.timestamp || '');
        }

        // Pool name display + warning markers
        const today = new Date().getDay(); // 1 = Monday
        let poolNameDisplay = submission.poolLocation || '';

        if (warningLevel === 'red') {
            poolNameDisplay = `<u>${submission.poolLocation}</u><span style="color: red;">!!!</span>`;
        } else if (warningLevel === 'yellow') {
            poolNameDisplay = `<u>${submission.poolLocation}</u><span style="color: red;">!</span>`;
        }

        if (submission.poolLocation === 'Columbia CC' && today === 1) {
            poolNameDisplay += `<br><span style="font-size:0.85em;color:#888;">Closed today</span>`;
        }

        // Build main row
        const row1 = document.createElement('tr');
        row1.innerHTML = `
            <td>${timestampDisplay}</td>
            <td>${poolNameDisplay}</td>
            ${createCell(submission.mainPoolPH, mainPHColor)}
            ${createCell(submission.mainPoolCl, mainClColor)}
        `;
        tbody1.appendChild(row1);

        // Secondary row
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

    if (!hasSecondaryData) {
        tbody2.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:#666;">No secondary pool data for current selection</td></tr>';
    }

    updateTimestampNote(); // keep existing behavior
    console.groupEnd();
}



async function evaluateFormFeedback() { // Remove formData parameter
    const poolLocation = document.getElementById('poolLocation').value;
    const mainPH = document.getElementById('mainPoolPH').value;
    const mainCl = document.getElementById('mainPoolCl').value;
    const secPH = document.getElementById('secondaryPoolPH').value;
    const secCl = document.getElementById('secondaryPoolCl').value;
    const mainSanitizer = document.querySelector(
        `.sanitation-checkbox[data-pool="${poolLocation}"]:checked`
        )?.dataset.method || '';
    const secondarySanitizer = document.getElementById('secondarySanitizerMethod')?.value || '';
    
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
// Main pool Cl granular method feedback
if (mainSanitizer === 'granular') {
    if (mainCl === '0') {
        messages.push('<strong>Raise the Cl level in the Main Pool.</strong><br>Make sure that a skimmer has suction, then add 6 scoops of granular/shock to the skimmer. Never add more than 6 scoops at one time.');
        isGood = false;
    } else if (mainCl === '1') {
        messages.push('<strong>Raise the Cl level in the Main Pool.</strong><br>Make sure that a skimmer has suction, then add 5 scoops of granular/shock to the skimmer. Never add more than 6 scoops at one time.');
        isGood = false;
    } else if (mainCl === '2') {
        messages.push('<strong>Raise the Cl level in the Main Pool.</strong><br>Make sure that a skimmer has suction, then add 4 scoops of granular/shock to the skimmer. Never add more than 6 scoops at one time.');
        isGood = false;
    } else if (mainCl === '10') {
        messages.push('<strong>Lower the Cl level of the Main Pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
        isGood = false;
        setpointImgNeeded = true;
    } else if (mainCl === '> 10') {
        messages.push('<strong>Notify a supervisor of the high Cl in the Main Pool immediately. Lower the Cl level of the Main Pool.</strong><br>Turn the Cl feeder off, and set a timer to turn it back on. Ensure that the waterline is at normal height, and turn the fill line on if it is low. Always set a timer when turning on the fill line.');
        isGood = false;
        setpointImgNeeded = true;
    }

} else {
    // Bleach method fallback for main pool Cl
    if (mainCl === '0' || mainCl === '1' || mainCl === '2') {
        messages.push('<strong>Raise the Cl level in the Main Pool.</strong><br>If not handled the previous hour, change the Cl feeder rate according to the setpoint chart to raise the Cl level.');
        messages.push('<img src="Images/setpoint.jpeg" alt="Setpoint Chart" style="max-width: 100%; height: auto; margin-top: 10px;">');
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
                        messages.push('<strong>Notify a supervisor of the low pH in the Splash Pad immediately. Wait for assistance.</strong><br>');
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
                        messages.push('<strong>Lower the pH of the Splash Pad.</strong><br>Add 1/6 scoop of acid into the Splash Pad tank. Always ensure that the pump is on before pouring.');
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
                        messages.push('<strong>Lower the pH of the Splash Pad.</strong><br>Add 1/3 scoop of acid into the Splash Pad tank. Always ensure that the pump is on before pouring.');
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
                    messages.push('<img src="Images/setpoint.jpeg" alt="Setpoint Chart" style="max-width: 100%; height: auto; margin-top: 10px;">');
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
                            messages.push('<strong>Raise the Cl level in the Splash Pad.</strong><br>Add 1/4 scoop of shock/granular Cl to an empty bucket, then fill it with water. Carefully swirl the water to dissolve the shock, then pour it into the Splash Pad tank.');
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
// Try to save to Firebase v9
if (db) {
    try {
        await addDoc(
            collection(db, 'poolSubmissions'),
            {
                ...submission,
                timestamp: Timestamp.fromDate(submission.timestamp)
            }
        );
        console.log('✅ Submission saved to Firebase v9');
    } catch (error) {
        console.warn('❌ Could not save to Firebase v9:', error);
    }
}
    
showMessage('Submission saved successfully!', 'success');

if (document.getElementById('supervisorDashboard').style.display === 'block') {
    loadDashboardData();
}

resetForm();
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
            const settingsRef = doc(db, 'settings', 'sanitationMethods');
            await setDoc(settingsRef, sanitationSettings);
            console.log('✅ Saved sanitation settings to Firebase');
        }
    } catch (error) {
        console.warn('❌ Could not save to Firebase:', error);
    }

    // Always save to localStorage as backup
    localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
    console.log('💾 Saved sanitation settings to localStorage');
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

// ===================================================
// FORM SUBMISSION
// ===================================================

function setupEventHandlers() {
    // Pool location change handler
    const poolLocation = document.getElementById('poolLocation');
    if (poolLocation) {
        poolLocation.addEventListener('change', handlePoolLocationChange);
        console.log('✅ Pool location change handler attached');
    } else {
        console.warn('⚠️ poolLocation not found');
    }

    // Form submission button handler
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitForm();
        });
        console.log('✅ Submit button handler attached');
    } else {
        console.warn('⚠️ submitBtn not found');
    }

    // Clear All Data button
    const clearDataBtn = document.getElementById('clearAllData');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', confirmClearData);
        console.log('✅ Clear All Data button handler attached');
    } else {
        console.warn('⚠️ clearAllData button not found');
    }

    // Export to CSV button
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCsv);
        console.log('✅ Export to CSV button handler attached');
    } else {
        console.warn('⚠️ exportCsvBtn not found');
    }

    // Close login modal on outside click
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('loginModal');
        if (modal && e.target === modal) {
            closeLoginModal();
            console.log('ℹ️ Closed login modal via outside click');
        }
    });

    // Close login modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('loginModal');
            if (modal && modal.style.display === 'block') {
                closeLoginModal();
                console.log('ℹ️ Closed login modal via Escape key');
            }
        }
    });

    console.log('✅ All event handlers set up');
}

async function exportToCsv() {
  try {
    // Adjust this collection name to whatever you use now
    const snap = await getDocs(collection(db, 'chemistryLogs'));

    const rows = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const base = {
        timestamp: data.timestamp?.toDate
          ? data.timestamp.toDate().toISOString()
          : '',
        poolLocation: data.poolLocation || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
      };

      // Preferred: new flexible schema
      let pools = Array.isArray(data.pools) ? data.pools : [];

      // Backwards compat – map the old fields into the same shape
      if (!pools.length) {
        if (data.mainPoolPH || data.mainPoolCl) {
          pools.push({
            index: 1,
            ph: data.mainPoolPH || '',
            cl: data.mainPoolCl || '',
          });
        }
        if (data.secondaryPoolPH || data.secondaryPoolCl) {
          pools.push({
            index: 2,
            ph: data.secondaryPoolPH || '',
            cl: data.secondaryPoolCl || '',
          });
        }
        for (let i = 3; i <= 5; i++) {
          const phKey = `pool${i}PH`;
          const clKey = `pool${i}Cl`;
          if (data[phKey] || data[clKey]) {
            pools.push({
              index: i,
              ph: data[phKey] || '',
              cl: data[clKey] || '',
            });
          }
        }
      }

      if (!pools.length) {
        rows.push({ ...base });
      } else {
        pools.forEach((pool) => {
          rows.push({
            ...base,
            poolIndex: pool.index,
            poolPH: pool.ph,
            poolCl: pool.cl,
          });
        });
      }
    });

    if (!rows.length) {
      alert('No data to export.');
      return;
    }

    const header = Object.keys(rows[0]);
    const lines = [
      header.join(','),
      ...rows.map((row) =>
        header
          .map((key) => {
            const value = row[key] ?? '';
            const str = String(value).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chemistry-log-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error exporting CSV', err);
    alert('There was an error exporting the CSV. Check the console for details.');
  }
}

function goToEditor() {
    window.location.href = "SiteEditor/newRules.html";
}



// ===================================================
// COMPREHENSIVE GLOBAL ASSIGNMENTS (62 Functions - Corrected)
// ===================================================

// Core form and submission functions (6)
window.loadFormSubmissions = loadFormSubmissions;
window.saveFormSubmissions = saveFormSubmissions;
window.initializeFormSubmissions = initializeFormSubmissions;
window.evaluateFormFeedback = evaluateFormFeedback;
window.validateForm = validateForm; // Expose new validation function

// Form handling (3)
window.resetForm = resetForm;
window.handlePoolLocationChange = handlePoolLocationChange;
window.handleLocationChange = handleLocationChange;

// Authentication and login (6)
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
window.closeSettings = closeSettings;
window.handleSanitationChange = handleSanitationChange;
window.initializeSanitationSettings = initializeSanitationSettings;
window.saveSanitationSettings = saveSanitationSettings;
window.loadSanitationSettings = loadSanitationSettings;
window.updateSanitationUI = updateSanitationUI;
window.goToEditor = goToEditor;

// SMS and notifications (3)
window.sendSMSNotification = sendSMSNotification;
window.chooseAndSendSMS = chooseAndSendSMS;
window.checkForCriticalAlerts = checkForCriticalAlerts;

// Menu and navigation (1)
window.toggleMenu = toggleMenu;

// Firebase functions (3)
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

document.addEventListener('DOMContentLoaded', () => {
  console.log('🧪 UNIFIED APP.JS LOADED - Firebase v9');

  // === Dark Mode Toggle Setup ===
  const darkModeToggle = document.getElementById('darkModeToggle');
  const savedTheme = localStorage.getItem('theme');

  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    if (darkModeToggle) darkModeToggle.checked = true;
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark-mode');
      const newTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
    });
  }

  // === App Init Functions (defensive so one failure doesn't break everything) ===
  const dashboard = document.getElementById('supervisorDashboard');
  if (dashboard) {
    dashboard.classList.remove('show');
    console.log('Dashboard force hidden on load');
  }

  const safeCall = (name, fn) => {
    if (typeof fn === 'function') {
      try {
        fn();
      } catch (err) {
        console.error(`❌ Error in ${name}:`, err);
      }
    } else {
      console.warn(`ℹ️ ${name} is not defined on this page.`);
    }
  };

  // Firebase‑driven init pieces
  safeCall('initializeSanitationSettings', initializeSanitationSettings);
  safeCall('startSanitationSettingsListener', startSanitationSettingsListener);
  safeCall('initializeMarketSettings', initializeMarketSettings);
  safeCall('initializePoolsForUI', initializePoolsForUI);
  safeCall('cleanupTestSubmissions', cleanupTestSubmissions);
  safeCall('checkLogin', checkLogin);
  safeCall('initializeFormSubmissions', initializeFormSubmissions);

  // === Login form ===
  const loginForm = document.getElementById('loginForm');
  if (loginForm && typeof handleLoginSubmit === 'function') {
    loginForm.addEventListener('submit', handleLoginSubmit);
    console.log('✅ Login form handler attached');
  }

  // === Pool dropdown change ===
  const poolLocation = document.getElementById('poolLocation');
  if (poolLocation && typeof handlePoolLocationChange === 'function') {
    poolLocation.addEventListener('change', handlePoolLocationChange);
    console.log('✅ Pool location handler attached');
  }

  // === Supervisor Login button ===
  const loginButton = document.querySelector('.supervisor-login-btn');
  if (loginButton && typeof openLoginModal === 'function') {
    loginButton.removeAttribute('onclick');
    loginButton.addEventListener('click', openLoginModal);
  }

  // === Main sanitizer dropdown (if present) ===
  const mainSanitizerDropdown = document.getElementById('mainSanitizerMethod');
  if (mainSanitizerDropdown) {
    mainSanitizerDropdown.addEventListener('change', function () {
      const poolLocationValue = document.getElementById('poolLocation')?.value;
      if (poolLocationValue) {
        window.sanitationSettings = window.sanitationSettings || {};
        window.sanitationSettings[poolLocationValue] = this.value;
        localStorage.setItem('sanitationSettings', JSON.stringify(window.sanitationSettings));
        console.log(`Updated sanitationSettings[${poolLocationValue}] to:`, this.value);
      }
    });
  }

  // === MAIN FORM SUBMIT BUTTON ===
  const submitButton = document.getElementById('submitBtn'); // <-- specific button
  if (submitButton) {
    submitButton.removeAttribute('onclick');
    submitButton.addEventListener('click', (e) => {
      e.preventDefault(); // prevent default page reload
      if (typeof submitForm === 'function') {
        submitForm(e);
      } else {
        console.warn('submitForm() is not defined.');
      }
    });
  }

  // === Clear Data & Export CSV ===
  const clearDataBtn = document.getElementById('clearAllData');
  const exportCsvBtn = document.getElementById('exportCsvBtn');

  if (clearDataBtn && typeof confirmClearData === 'function') {
    clearDataBtn.addEventListener('click', confirmClearData);
  }

  if (exportCsvBtn) {
    if (typeof exportToCsv === 'function') {
      exportCsvBtn.addEventListener('click', exportToCsv);
    } else if (typeof exportToCSV === 'function') {
      // fallback to your original name
      exportCsvBtn.addEventListener('click', exportToCSV);
    } else {
      console.warn('No exportToCsv / exportToCSV function defined.');
    }
  }

  // === Misc app‑level handlers ===
  if (typeof setupEventHandlers === 'function') {
    safeCall('setupEventHandlers', setupEventHandlers);
  }
  if (typeof updateHeaderButtons === 'function') {
    safeCall('updateHeaderButtons', updateHeaderButtons);
  }

  // === Supervisor Dashboard Pagination Buttons ===
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn && typeof displayData === 'function') {
    prevBtn.addEventListener('click', () => {
      if (window.currentPage > 0) {
        window.currentPage--;
        displayData();
        if (typeof updatePagination === 'function') {
          updatePagination();
        } else if (typeof updatePaginationControls === 'function') {
          updatePaginationControls();
        }
      }
    });
  }

  if (nextBtn && typeof displayData === 'function') {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil((window.filteredSubmissions || []).length / (window.itemsPerPage || 25));
      if (window.currentPage < totalPages - 1) {
        window.currentPage++;
        displayData();
        if (typeof updatePagination === 'function') {
          updatePagination();
        } else if (typeof updatePaginationControls === 'function') {
          updatePaginationControls();
        }
      }
    });
  }

  // === Sanitation table Edit / Save ===
  const editBtn = document.getElementById('editSanitationBtn');
  const saveBtn = document.getElementById('saveSanitationBtn');

  if (editBtn && saveBtn) {
    const sanitationCheckboxes = document.querySelectorAll('.sanitation-checkbox');
    sanitationCheckboxes.forEach(cb => cb.disabled = true);

    editBtn.addEventListener('click', () => {
      sanitationCheckboxes.forEach(cb => cb.disabled = false);
      editBtn.disabled = true;
      saveBtn.disabled = false;
    });

    saveBtn.addEventListener('click', () => {
      window.sanitationSettings = window.sanitationSettings || {};

      sanitationCheckboxes.forEach(cb => {
        const pool = cb.dataset.pool;
        const method = cb.dataset.method;
        if (!pool || !method) return;
        if (cb.checked) {
          // enforce one method per pool: overwrite
          window.sanitationSettings[pool] = method;
        } else if (window.sanitationSettings[pool] === method) {
          // if unchecked and currently selected, clear it
          delete window.sanitationSettings[pool];
        }
      });

      if (typeof saveSanitationSettings === 'function') {
        saveSanitationSettings();
      }
      sanitationCheckboxes.forEach(cb => cb.disabled = true);
      editBtn.disabled = false;
      saveBtn.disabled = true;

      console.log('✅ Sanitation settings saved and checkboxes disabled again');
    });
  }

  console.log('🚀 App initialization complete');
});

function updateSanitationCheckboxesFromSettings() {
    for (const pool in sanitationSettings) {
        const method = sanitationSettings[pool];
        const bleachCheckbox = document.querySelector(`[data-pool="${pool}"][data-method="bleach"]`);
        const granularCheckbox = document.querySelector(`[data-pool="${pool}"][data-method="granular"]`);

        if (bleachCheckbox && granularCheckbox) {
            bleachCheckbox.checked = (method === 'bleach');
            granularCheckbox.checked = (method === 'granular');
        }
    }
}

// Add all other functions you're calling in onclick attributes

function createAndAppendMenu(parentElement) {
    const menuContainer = document.createElement('div');
    menuContainer.className = 'menu-container'; // Keep this class for styling

    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '☰';
    menuBtn.addEventListener('click', toggleMenu);
    menuContainer.appendChild(menuBtn);

    const dropdownMenu = document.createElement('div');
    dropdownMenu.id = 'dropdownMenu';
    dropdownMenu.className = 'dropdown-menu';
    dropdownMenu.style.display = 'none'; // Initially hidden

    const settingsDiv = document.createElement('div');
    settingsDiv.textContent = 'Settings';
    settingsDiv.addEventListener('click', openSettings);
    dropdownMenu.appendChild(settingsDiv);

    const clearDataDiv = document.createElement('div');
    clearDataDiv.textContent = 'Clear All Data';
    clearDataDiv.addEventListener('click', clearAllData);
    dropdownMenu.appendChild(clearDataDiv);

    const logoutDiv = document.createElement('div');
    logoutDiv.textContent = 'Logout';
    logoutDiv.addEventListener('click', logout);
    dropdownMenu.appendChild(logoutDiv);

    menuContainer.appendChild(dropdownMenu);
    parentElement.appendChild(menuContainer); // Append to the designated parent
}

function updateHeaderButtons() {
    console.log('Updating header buttons. isLoggedIn:', isLoggedIn, 'currentView:', currentView);

    const staticFormLoginBtn = document.querySelector('.supervisor-login-btn');
    const dashboardMenuContainer = document.getElementById('dashboardMenuContainer');
    const dashboardHeaderRight = document.querySelector('#supervisorDashboard .header-right');

    // Always show login button when on form page
    if (currentView === 'form') {
        if (staticFormLoginBtn) {
            staticFormLoginBtn.style.display = 'block';
            staticFormLoginBtn.style.visibility = 'visible';
            // Change button text based on login status
            staticFormLoginBtn.textContent = isLoggedIn ? 'View Dashboard' : 'Supervisor Login';
            console.log('Login button shown on form page');
        }
        // Clear dashboard elements when on form
        if (dashboardMenuContainer) dashboardMenuContainer.innerHTML = '';
        
    } else if (currentView === 'dashboard') {
        // Hide login button when on dashboard
        if (staticFormLoginBtn) {
            staticFormLoginBtn.style.display = 'none';
            console.log('Login button hidden on dashboard');
        }
        
        // Show dashboard menu if logged in
        if (isLoggedIn) {
            if (dashboardMenuContainer) {
                createAndAppendMenu(dashboardMenuContainer);
                console.log('Menu button appended to dashboard.');
            }
            // Note: Removed the separate logout button creation since logout is now in the dropdown
        }
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

function showForm() {
    console.log('Showing Form View');
    currentView = 'form';

    const mainForm = document.getElementById('mainForm'); // Corrected ID from 'mainFormContainer'
    const supervisorDashboard = document.getElementById('supervisorDashboard');

    // Modals (added checks for existence)
    const loginModal = document.getElementById('loginModal');
    const feedbackModal = document.getElementById('feedbackModal');
    const settingsModal = document.getElementById('settingsModal');
    const exportModal = document.getElementById('exportModal'); // No ID exists in HTML for this
    const emailSelectionModal = document.getElementById('emailSelectionModal'); // No ID exists in HTML for this
    
    // Apply display styles with checks
    if (mainForm) mainForm.style.display = 'block'; else console.error("Main form element (id='mainForm') not found!");
    if (supervisorDashboard) {
        supervisorDashboard.classList.remove('show'); // ADD THIS LINE
    } else console.warn("Supervisor dashboard element (id='supervisorDashboard') not found when showing form!");

    if (loginModal) loginModal.style.display = 'none';
    if (feedbackModal) feedbackModal.style.display = 'none';
    if (settingsModal) settingsModal.style.display = 'none';
    if (exportModal) exportModal.style.display = 'none'; // Only hide if element exists
    if (emailSelectionModal) emailSelectionModal.style.display = 'none'; // Only hide if element exists
    
    removeOverlay();
    updateHeaderButtons();
}

// Check login status
function checkLoginStatus() {
    const token = localStorage.getItem('loginToken');
    if (token) {
        try {
            const { username, expires } = JSON.parse(token);
            if (Date.now() < expires) {
                isLoggedIn = true;
                console.log('User previously logged in:', username);
                showDashboard(); // Directly show dashboard if logged in and token valid
                return;
            } else {
                console.log('Login token expired.');
                localStorage.removeItem('loginToken');
            }
        } catch (e) {
            console.warn('Error parsing login token:', e);
            localStorage.removeItem('loginToken');
        }
    }
    isLoggedIn = false; // Ensure it's false if no valid token
    showForm(); // Always show form if not logged in
}

// Replace the existing checkLogin function:
// In your script.js
function checkLogin() {
    const token = localStorage.getItem('loginToken');
    const hasDashboard = !!document.getElementById('supervisorDashboard');

    if (token) {
        try {
            const { username, expires } = JSON.parse(token);
            if (Date.now() < expires) {
                console.log('Valid login token found');
                isLoggedIn = true;

                if (hasDashboard) {
                    // index.html – go straight to dashboard
                    showDashboard();
                } else {
                    // editor / other simple pages – just keep the main content visible
                    console.log('Valid login token on editor page – staying on current view');
                    showForm();
                }

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

    // No valid token – treat as logged out
    isLoggedIn = false;
    showForm();
    return false;
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

function getPoolMarketsForName(poolName) {
  if (!poolName || !Array.isArray(availablePools)) return [];
  const poolDoc = availablePools.find(p => getPoolNameFromDoc(p) === poolName);
  return getPoolMarketsFromDoc(poolDoc);
}

function poolHasSecondary(poolName) {
  if (!poolName) return false;

  if (Array.isArray(availablePools) && availablePools.length) {
    const poolDoc = availablePools.find(p => getPoolNameFromDoc(p) === poolName);
    if (poolDoc && poolDoc.numPools != null) {
      const num = Number(poolDoc.numPools);
      if (!Number.isNaN(num)) {
        return num > 1;
      }
    }
  }

  // Legacy fallback
  return POOLS_WITH_SECONDARY.includes(poolName);
}

async function initializeMarketSettings() {
  const marketCheckboxes = document.querySelectorAll('input[name="marketFilter"]');
  if (!marketCheckboxes.length) {
    // No Market section on this page
    return;
  }

  // Default: everything on
  MARKET_NAMES.forEach((m) => {
    if (marketVisibility[m] === undefined) {
      marketVisibility[m] = true;
    }
  });

  if (!db) {
    console.warn('No Firestore DB; using in-memory market settings only');
    applyMarketSettingsToUI();
    return;
  }

  const settingsRef = doc(db, 'settings', 'markets');

  try {
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data() || {};
      MARKET_NAMES.forEach((m) => {
        if (typeof data[m] === 'boolean') {
          marketVisibility[m] = data[m];
        }
      });
    } else {
      await setDoc(settingsRef, marketVisibility);
    }
  } catch (err) {
    console.error('Error loading market settings', err);
  }

  applyMarketSettingsToUI();
}

function applyMarketSettingsToUI() {
  const marketCheckboxes = document.querySelectorAll('input[name="marketFilter"]');

  marketCheckboxes.forEach((cb) => {
    const market = cb.value;
    cb.checked = !!marketVisibility[market];
    cb.addEventListener('change', onMarketCheckboxChanged);
  });

  updatePoolFilterDropdown();
  filterAndDisplayData?.();
}

async function saveMarketSettings() {
  if (!db) return;
  try {
    const settingsRef = doc(db, 'settings', 'markets');
    await setDoc(settingsRef, marketVisibility, { merge: true });
  } catch (err) {
    console.error('Failed to save market settings', err);
  }
}

function onMarketCheckboxChanged(event) {
  const market = event.target.value;
  marketVisibility[market] = event.target.checked;
  updatePoolFilterDropdown();
  filterAndDisplayData?.();
  saveMarketSettings();
}

function updatePoolLocationDropdown() {
  const select = document.getElementById('poolLocation');
  if (!select) return;

  const previous = select.value;

  // Clear any hard‑coded options
  select.innerHTML = '';

  // Default "Select" option
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Select';
  select.appendChild(defaultOpt);

  // Use the combined metadata map (static + Firestore)
  const meta = window.poolMetadataByName || {};
  const poolsByMarket = new Map();

  // Group pool names by their primary market
  Object.entries(meta).forEach(([name, info]) => {
    if (!name) return;

    const markets = Array.isArray(info.markets) && info.markets.length
      ? info.markets
      : ['Unassigned'];

    const primaryMarket = markets[0];
    if (!poolsByMarket.has(primaryMarket)) {
      poolsByMarket.set(primaryMarket, []);
    }
    poolsByMarket.get(primaryMarket).push(name);
  });

  // Helper to add a market section
  function appendMarketSection(marketLabel) {
    const names = (poolsByMarket.get(marketLabel) || []).slice().sort((a, b) =>
      a.localeCompare(b),
    );
    if (!names.length) return;

    const header = document.createElement('option');
    header.value = '';
    header.textContent = `— ${marketLabel} —`;
    header.disabled = true;
    header.classList.add('market-header-option');
    select.appendChild(header);

    names.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  // Known market order first
  MARKET_ORDER.forEach((market) => appendMarketSection(market));

  // Any other markets (including "Unassigned")
  for (const [market] of poolsByMarket.entries()) {
    if (MARKET_ORDER.includes(market)) continue;
    appendMarketSection(market);
  }

  // Try to preserve previous selection
  if (previous && select.querySelector(`option[value="${previous}"]`)) {
    select.value = previous;
  }
}


// ===================================================
// DATA MANAGEMENT & DASHBOARD
// ===================================================

// --- View Management Functions ---
// These are responsible for showing/hiding the main content areas

// --- View Management Functions ---
// These are responsible for showing/hiding the main content areas

function showDashboard() {
    console.log('Showing Dashboard View');
    currentView = 'dashboard';

    const mainForm = document.getElementById('mainForm');
    const supervisorDashboard = document.getElementById('supervisorDashboard');

    // 🔹 NEW: if there is no supervisor dashboard on this page
    // (e.g. SiteEditor/newRules.html), don't hide the main form.
    if (!supervisorDashboard) {
        console.log(
            'showDashboard called but #supervisorDashboard not found – ' +
            'skipping view change (likely on editor page)'
        );
        if (mainForm) {
            mainForm.style.display = 'block';
        }
        // Keep header buttons in sync with login state
        if (typeof updateHeaderButtons === 'function') {
            updateHeaderButtons();
        }
        return;
    }

    // --- existing behaviour for index.html below ---

    // Hide main form
    if (mainForm) {
        mainForm.style.display = 'none';
    }

    // Show dashboard
    if (supervisorDashboard) {
        supervisorDashboard.classList.add('show');

        const dashboard = document.getElementById('supervisorDashboard');
        const header = dashboard.querySelector('.header');
        const headerRight = dashboard.querySelector('.header-right');

        console.log('📦 supervisorDashboard display:', window.getComputedStyle(dashboard)?.display);
        console.log('📦 .header display:', window.getComputedStyle(header)?.display);
        console.log('📦 .header-right display:', window.getComputedStyle(headerRight)?.display);
    }

    // Run logo visibility check AFTER the dashboard is made visible
    const logo = document.getElementById('logo');

    console.log('Logo width:', logo.offsetWidth, 'height:', logo.offsetHeight);

    if (logo) {
        const style = window.getComputedStyle(logo);
        console.log('👀 Logo display:', style.display);
        console.log('👀 Logo visibility:', style.visibility);
        console.log('👀 Logo offsetParent (visible?):', logo.offsetParent !== null);
    } else {
        console.warn('⚠️ Logo element not found in DOM');
    }

    removeOverlay();
    loadDashboardData();
    updateHeaderButtons();

    console.log('🤖 Logo still exists after updateHeaderButtons:', !!document.getElementById('logo'));
}

// ===================================================
// PAGINATION
// ===================================================

function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);

    // Prevent going out of bounds
    if (currentPage >= totalPages) {
        currentPage = totalPages - 1;
    }
    if (currentPage < 0) {
        currentPage = 0;
    }

    // Display the current page's data
    displayData();

    // Update the prev/next button states and page info
    updatePaginationControls(totalPages);
}


// ===================================================
// LOGIN & AUTHENTICATION
// ===================================================

// Logout function
// Replace the existing logout function:
function logout() {
    console.log('logout called');
    
    // Close the dropdown menu first
    const dropdown = document.getElementById('dropdownMenu');
    if (dropdown) dropdown.style.display = 'none';
    
    // Reset state
    isLoggedIn = false;
    currentView = 'form';
    
    // Remove login token
    localStorage.removeItem('loginToken');
    
    // Hide dashboard and remove 'show' class just in case
    const dashboard = document.getElementById('supervisorDashboard');
    if (dashboard) {
        dashboard.classList.remove('show'); // <== CRUCIAL
    }

    // Show form
    const form = document.getElementById('mainForm');
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
    
    console.log('Logged out successfully, returned to main form');
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

function handleLocationChange() {
  // Backwards compat for any older templates using this handler
  handlePoolLocationChange();
}

function buildPoolsByMarket(pools) {
  const byMarket = {};
  MARKET_NAMES.forEach(m => { byMarket[m] = []; });
  const unassigned = [];

  const list = Array.isArray(pools) ? pools : [];
  const nameSorter = (a, b) => a.name.localeCompare(b.name);

  for (const pool of list) {
    const name = getPoolNameFromDoc(pool);
    if (!name) continue;

    const markets = getPoolMarketsFromDoc(pool);
    if (!markets.length) {
      unassigned.push({ name, pool });
      continue;
    }

    const primary = markets[0];
    if (!byMarket[primary]) byMarket[primary] = [];
    byMarket[primary].push({ name, pool });
  }

  MARKET_NAMES.forEach(m => byMarket[m].sort(nameSorter));
  unassigned.sort(nameSorter);

  return { byMarket, unassigned };
}

function getEnabledMarkets() {
  // If settings haven't loaded yet, treat all as enabled
  const anyConfigured = MARKET_NAMES.some(m =>
    Object.prototype.hasOwnProperty.call(marketVisibility, m)
  );
  if (!anyConfigured) {
    return [...MARKET_NAMES];
  }
  return MARKET_NAMES.filter(m => marketVisibility[m]);
}

function updatePoolFilterDropdown() {
  const poolFilterSelect = document.getElementById('poolFilter');
  if (!poolFilterSelect) return;

  const previous = poolFilterSelect.value;
  poolFilterSelect.innerHTML = '';

  // "All Pools" option
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All Pools';
  poolFilterSelect.appendChild(allOption);

  const enabledMarkets = getEnabledMarkets();
  const seen = new Set();

  const list = Array.isArray(availablePools) ? availablePools : [];
  for (const pool of list) {
    const name = getPoolNameFromDoc(pool);
    if (!name || seen.has(name)) continue;

    const markets = getPoolMarketsFromDoc(pool);
    if (markets.length && !markets.some(m => enabledMarkets.includes(m))) {
      // Hidden by Market settings
      continue;
    }

    seen.add(name);
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    poolFilterSelect.appendChild(opt);
  }

  if (previous && poolFilterSelect.querySelector(`option[value="${previous}"]`)) {
    poolFilterSelect.value = previous;
  }
}

function initializePoolsForUI() {
  // Seed metadata from static pools so things work even before Firestore responds
  rebuildPoolMetadataMap(window.availablePools || []);
  updatePoolLocationDropdown();

  // Dashboard filter still uses its own dropdown function
  if (typeof updatePoolFilterDropdown === 'function') {
    updatePoolFilterDropdown();
  }

  // If we don't have the Firestore listener helper, we at least keep static pools
  if (typeof listenPools !== 'function') {
    console.warn('listenPools() helper is not available; pool list will not be dynamic');
    return;
  }

  try {
    listenPools((poolsFromFirestore) => {
      // Pools are coming from the rule editor / Firestore
      window.availablePools = Array.isArray(poolsFromFirestore) ? poolsFromFirestore : [];

      // Rebuild metadata using both static + Firestore pools
      rebuildPoolMetadataMap(window.availablePools);

      // Refresh the chemistry form dropdown + dashboard pool filter
      updatePoolLocationDropdown();
      if (typeof updatePoolFilterDropdown === 'function') {
        updatePoolFilterDropdown();
      }

      // Refresh supervisor dashboard table if that helper exists
      if (typeof filterAndDisplayData === 'function') {
        filterAndDisplayData();
      }
    });
  } catch (err) {
    console.error('Failed to attach pool listener', err);
  }
}


// ===================================================
// DATA PERSISTENCE
// ===================================================

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
    title.classList.add('select-recipient');
    title.style.cssText = `
        margin: 0 0 20px 0;
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
        border: 1px solid black;
        border-radius: 0px;
        background-color: #69140e;
        color: white !important;
    `;
    
    const samCheckbox = document.createElement('input');
    samCheckbox.type = 'checkbox';
    samCheckbox.className = 'feedback-checkbox';
    samCheckbox.id = 'samOption';
    samCheckbox.value = '+18644096231';
    samCheckbox.style.cssText = `
        margin-right: 10px;
        margin-top: 0 px;
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
        margin-bottom: 0; 
        color: white !important;
    `;
    samLabel.onclick = () => {
        samCheckbox.checked = !samCheckbox.checked;
    };
    
    samCheckboxItem.appendChild(samCheckbox);
    samCheckboxItem.appendChild(samLabel);
    messageList.appendChild(samCheckboxItem);
    
    // Haley Wilson checkbox
    /*
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
    */

    feedbackContent.appendChild(messageList);
    modal.appendChild(feedbackContent);

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send Message';
    sendBtn.className = 'notify-btn';
    sendBtn.style.cssText = `
        background-color: #69140e;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 0 px;
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

async function openSettings() {
    // Close the dropdown menu first
    document.getElementById('dropdownMenu').style.display = 'none';

    // Refresh settings from Firebase before showing modal (if available)
    try {
        if (db) {
            console.log('🔄 Refreshing settings from Firebase v9 before showing modal...');
            const settingsRef = doc(db, 'settings', 'sanitationMethods');
            const settingsDoc = await getDoc(settingsRef);

            if (settingsDoc.exists()) {
                const firebaseSettings = settingsDoc.data();
                Object.assign(sanitationSettings, firebaseSettings);
                console.log('✅ Refreshed sanitation settings from Firebase:', sanitationSettings);
            } else {
                console.log('⚠️ No sanitation settings found in Firebase when refreshing');
            }
        } else {
            console.log('⚠️ Firebase not ready when showing settings — using in-memory settings');
        }
    } catch (error) {
        console.warn('❌ Could not refresh from Firebase when showing settings:', error);
    }

    createOrShowOverlay();

    // Show the settings modal
    document.getElementById('settingsModal').style.display = 'block';
    loadSanitationSettings();
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

function debugViews() {
    console.log('=== VIEW DEBUG ===');
    console.log('currentView:', currentView);
    console.log('isLoggedIn:', isLoggedIn);
    
    const mainForm = document.getElementById('mainForm');
    const dashboard = document.getElementById('supervisorDashboard');
    
    console.log('mainForm element:', !!mainForm);
    console.log('mainForm display:', mainForm ? mainForm.style.display : 'not found');
    console.log('mainForm computed display:', mainForm ? getComputedStyle(mainForm).display : 'not found');
    
    console.log('dashboard element:', !!dashboard);
    console.log('dashboard display:', dashboard ? dashboard.style.display : 'not found');
    console.log('dashboard computed display:', dashboard ? getComputedStyle(dashboard).display : 'not found');
}
window.debugViews = debugViews;

window.debugApp = debugApp;

window.addEventListener('error', (e) => {
    console.group('🚨 DASHBOARD ERROR DETECTED');
    console.error('Message:', e.message || '(no message)');
    console.error('Source file:', e.filename || '(no filename)');
    console.error('Line:', e.lineno);
    console.error('Column:', e.colno);
    console.error('Error object:', e.error || '(no error object)');
    if (e.error && e.error.stack) {
        console.error('Stack trace:\n', e.error.stack);
    }
    console.groupEnd();
});
