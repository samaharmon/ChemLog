import {
  app,
  db,
  auth,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from '../firebase.js';

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const addPoolBtn = document.getElementById("addPoolBtn");
  const newPoolSection = document.getElementById("newPoolSection");
  const feedbackEditorSection = document.getElementById("feedbackEditorSection");
  const secondaryPoolSection = document.getElementById("secondaryPoolSection");
  const secondaryPoolCheckbox = document.getElementById("secondaryPoolCheckbox");

  const poolSelect = document.getElementById("poolLocation");
  const newPoolName = document.getElementById("newPoolName");
  const poolShape = document.getElementById("poolShape");

  const saveRulesBtnOne = document.getElementById("saveRulesBtnOne");
  const saveRulesBtnTwo = document.getElementById("saveRulesBtnTwo");

  // --- Utility ---
  const show = (el) => { if (el) el.style.display = "block"; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  // --- Initial State ---
  hide(newPoolSection);
  hide(feedbackEditorSection);
  hide(secondaryPoolSection);

  // --- Button + Input Logic ---
  if (addPoolBtn) {
    addPoolBtn.addEventListener("click", () => {
      show(newPoolSection);
      hide(feedbackEditorSection);
    });
  }

  if (poolSelect) {
    poolSelect.addEventListener("change", () => {
      if (poolSelect.value) {
        show(feedbackEditorSection);
      } else {
        hide(feedbackEditorSection);
      }
    });
  }

  if (secondaryPoolCheckbox) {
    secondaryPoolCheckbox.addEventListener("change", () => {
      secondaryPoolCheckbox.checked
        ? show(secondaryPoolSection)
        : hide(secondaryPoolSection);
    });
  }

  // --- Save Main Pool Settings ---
  if (saveRulesBtnOne) {
    saveRulesBtnOne.addEventListener("click", async () => {
      const poolName =
        poolSelect?.value || newPoolName?.value.trim();
      const shape = poolShape?.value || "";

      if (!poolName) {
        alert("Please enter a pool name or select one.");
        return;
      }

      try {
        await setDoc(doc(db, "pools", poolName), {
          shape,
          updatedAt: Timestamp.now(), // ✅ Better than new Date() for Firestore
        });
        alert(`Saved settings for ${poolName}`);
        show(feedbackEditorSection);
      } catch (err) {
        console.error("Error saving main pool:", err);
        alert("Error saving pool settings.");
      }
    });
  }

  // --- Save Secondary Pool Settings ---
  if (saveRulesBtnTwo) {
    saveRulesBtnTwo.addEventListener("click", async () => {
      const poolName = poolSelect?.value;
      if (!poolName) {
        alert("Select a pool first.");
        return;
      }

      try {
        await setDoc(doc(db, "pools", `${poolName}_secondary`), {
          secondary: true,
          updatedAt: Timestamp.now(),
        });
        alert(`Saved secondary pool settings for ${poolName}`);
      } catch (err) {
        console.error("Error saving secondary pool:", err);
        alert("Error saving secondary pool settings.");
      }
    });
  }

  // --- Acceptable Checkbox Feedback Lock ---
  document.querySelectorAll(".sanitation-checkbox").forEach((chk) => {
    chk.addEventListener("change", (e) => {
      const row = e.target.closest("tr");
      const input = row?.querySelector(".adjustment-feedback");

      if (input) {
        input.disabled = e.target.checked;
        input.classList.toggle("disabled-input", e.target.checked);
      }
    });
  });
});

/////////////////////////////////////////
//  Menu                               //
/////////////////////////////////////////

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

/////////////////////////////////////////
//  Settings                           //
/////////////////////////////////////////

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
        removeOverlay();
}

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

        sanitationSettings[pool] = method;
    } else {
        // Default back to bleach
        sanitationSettings[pool] = 'bleach';
        const bleachCheckbox = document.querySelector(`[data-pool="${pool}"][data-method="bleach"]`);
        if (bleachCheckbox) {
            bleachCheckbox.checked = true;
        }
    }

    console.log('Updated sanitationSettings:', sanitationSettings);

    // Save to localStorage
    localStorage.setItem('sanitationSettings', JSON.stringify(sanitationSettings));
    console.log('Saved sanitation settings to localStorage');

    // Save to Firebase
    try {
        if (db) {
            const settingsRef = doc(db, 'settings', 'sanitationMethods');
            await setDoc(settingsRef, sanitationSettings);
            console.log('✅ Successfully saved sanitation settings to Firebase');
        } else {
            console.log('⚠️ Firebase not available — settings saved to localStorage only');
        }
    } catch (error) {
        console.warn('❌ Could not save to Firebase — fallback to localStorage only:', error);
    }
}

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


function startSanitationSettingsListener() {
    if (!db) {
        console.warn("⚠️ Firestore not initialized — cannot start sanitation settings listener.");
        return;
    }

    const settingsRef = doc(db, 'settings', 'sanitationMethods');

    onSnapshot(settingsRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            sanitationSettings = docSnapshot.data();
            console.log('🔄 Sanitation settings updated from Firestore:', sanitationSettings);
            updateSanitationCheckboxesFromSettings();
        } else {
            console.warn('⚠️ Sanitation settings document does not exist.');
        }
    }, (error) => {
        console.error('❌ Error listening to sanitation settings:', error);
    });
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



/////////////////////////////////////////
//  Global Variables                   //
/////////////////////////////////////////
window.toggleMenu = toggleMenu;
window.logout = logout;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.handleSanitationChange = handleSanitationChange;
window.initializeSanitationSettings = initializeSanitationSettings;
window.saveSanitationSettings = saveSanitationSettings;
window.loadSanitationSettings = loadSanitationSettings;
window.updateSanitationUI = updateSanitationUI;
