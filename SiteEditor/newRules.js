import { getPools, listenPools, savePoolDoc, deletePoolDoc } from '../firebase.js';
 
let poolsCache = [];
let currentPoolId = '';
let poolsListenerStarted = false;

// ---- Per‑sanitation rule state ----
const SANITATION_METHODS = ['bleach', 'granular'];

// ruleStateByPool[poolIndex] = { bleach: { ph:{}, cl:{} }, granular: { ph:{}, cl:{} } }
const ruleStateByPool = {};

function createEmptyMethodRules() {
  return { ph: {}, cl: {} };
}

function getOrCreatePoolRuleState(poolIndex) {
  if (!ruleStateByPool[poolIndex]) {
    ruleStateByPool[poolIndex] = {
      bleach: createEmptyMethodRules(),
      granular: createEmptyMethodRules(),
    };
  }
  return ruleStateByPool[poolIndex];
}

/**
 * Read the currently visible textareas + Concern dropdowns for a block
 * into ruleStateByPool[poolIndex][method].
 */
function captureRulesFromBlock(block, method) {
  const poolIndex = block.dataset.poolIndex;
  const state = getOrCreatePoolRuleState(poolIndex);

  const methodRules = { ph: {}, cl: {} };

  block.querySelectorAll(`textarea[id^="pool${poolIndex}_"]`).forEach((area) => {
    const typeKey = area.id.includes('_ph_') ? 'ph' : 'cl';
    const key = area.id.replace(`pool${poolIndex}_${typeKey}_`, '');
    const levelSelect = document.getElementById(`${area.id}_level`);
    methodRules[typeKey][key] = {
      response: area.value.trim(),
      concernLevel: levelSelect ? levelSelect.value : 'none',
    };
  });

  state[method] = methodRules;
}

/**
 * Push one method’s rules from ruleStateByPool back into the DOM
 * for a single pool block.
 */
function showRulesForMethod(block, method) {
  const poolIndex = block.dataset.poolIndex;
  const state = getOrCreatePoolRuleState(poolIndex);
  const rulesForMethod = state[method] || createEmptyMethodRules();

  applyRuleToInputs(block, rulesForMethod);
  block.dataset.activeMethod = method;
}
 
const poolRuleContainerSelector = '#poolRuleBlocks .pool-rule-block';

function setModeButtonsActive(mode) {
  const addBtn = document.getElementById('editorModeAdd');
  const editBtn = document.getElementById('editorModeEdit');
  if (!addBtn || !editBtn) return;

  addBtn.classList.toggle('active', mode === 'add');
  editBtn.classList.toggle('active', mode === 'edit');
}

function showEditorDetails() {
  const poolMetadataSection = document.getElementById('poolMetadataSection');
  const ruleEditorSection = document.getElementById('ruleEditorSection');
  if (poolMetadataSection) poolMetadataSection.style.display = '';
  if (ruleEditorSection) ruleEditorSection.style.display = '';
}

 
function removePoolShapeGallonage() {
  const stale = document.getElementById('poolShapeGallonage');
  if (stale?.parentElement) {
    stale.parentElement.removeChild(stale);
  }
}

function getPoolName(pool) {
  return pool?.name || pool?.poolName || pool?.id || '';
}
 
function renderSelectOptions(selectEl, pools) {
  if (!selectEl) return;
  const previous = selectEl.value;
  selectEl.innerHTML = '<option value="">Select an existing pool...</option>';
  pools.forEach((pool) => {
    const option = document.createElement('option');
    option.value = pool.id;
    option.textContent = getPoolName(pool);
    selectEl.appendChild(option);
  });
  if (previous && selectEl.querySelector(`option[value="${previous}"]`)) {
    selectEl.value = previous;
   }
}
 
function updateGlobalPoolOptions(pools) {
  const poolLocationSelect = document.getElementById('poolLocation');
  const poolFilterSelect = document.getElementById('poolFilter');

  const applyOptions = (selectEl) => {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = '<option value="">Select a pool...</option>';
    pools.forEach((pool) => {
      const option = document.createElement('option');
      option.value = getPoolName(pool);
      option.textContent = getPoolName(pool);
      selectEl.appendChild(option);
     });
    if (prev && selectEl.querySelector(`option[value="${prev}"]`)) {
      selectEl.value = prev;
    }
  };
 
  applyOptions(poolLocationSelect);
  applyOptions(poolFilterSelect);
}
 
function startPoolListener() {
  if (poolsListenerStarted) return;
  poolsListenerStarted = true;
  listenPools((pools) => {
    poolsCache = pools;
    renderSelectOptions(document.getElementById('editorPoolSelect'), pools);
    updateGlobalPoolOptions(pools);
   });
 }
 

function setBlockEnabled(block, enabled) {
  const ruleInputs = block.querySelectorAll('.rules-table textarea, .rules-table select');
  ruleInputs.forEach(el => el.disabled = !enabled);

  // add overlay class only to the rules-table region
  block.querySelectorAll('.rules-table').forEach(tbl => {
    tbl.classList.toggle('overlay-disabled', !enabled);
  });
}
 
function setMetadataEnabled(enabled) {
  const metadataSection = document.getElementById('poolMetadataSection');
  if (!metadataSection) return;

  const fields = [
    document.getElementById('editorPoolName'),
    document.getElementById('editorNumPools'),
    ...document.querySelectorAll('input[name="editorMarket"]'),
  ];

  fields.forEach((el) => {
    if (el) el.disabled = !enabled;
  });

  metadataSection.classList.toggle('overlay-disabled', !enabled);
}

 
function updatePoolBlockVisibility(count) {
  const blocks = document.querySelectorAll('#poolRuleBlocks .pool-rule-block');
  blocks.forEach((block, index) => {
    block.style.display = index < count ? '' : 'none';
  });
}

function applyRuleToInputs(block, rules = {}) {
  const poolIndex = block.dataset.poolIndex;

  block.querySelectorAll(`textarea[id^="pool${poolIndex}_"]`).forEach((area) => {
    const typeKey = area.id.includes('_ph_') ? 'ph' : 'cl';
    const key = area.id.replace(`pool${poolIndex}_${typeKey}_`, '');
    const levelSelect = document.getElementById(`${area.id}_level`);

    const ruleEntry = rules[typeKey]?.[key] || {};
    area.value = ruleEntry.response || '';

    if (levelSelect) {
      levelSelect.value = ruleEntry.concernLevel || 'none';
    }
  });
}
 
function loadPoolIntoEditor(poolDoc) {
  if (!poolDoc) return;

  currentPoolId = poolDoc.id || '';

  // Reveal the metadata + rule sections when editing
  const metadataSection = document.getElementById('poolMetadataSection');
  const ruleSection = document.getElementById('ruleEditorSection');
  metadataSection?.classList.remove('hidden');
  ruleSection?.classList.remove('hidden');

  const poolNameInput   = document.getElementById('editorPoolName');
  const numPoolsInput   = document.getElementById('editorNumPools');
  const marketCheckboxes = document.querySelectorAll('input[name="editorMarket"]');

  // Basic metadata
  if (poolNameInput) {
    poolNameInput.value = getPoolName(poolDoc);
  }

  if (numPoolsInput) {
    const savedCount = poolDoc.numPools || poolDoc.poolCount || 1;
    numPoolsInput.value = String(savedCount);

    // Show the right number of pool rule sections
    const count = Math.max(1, Math.min(5, Number(savedCount) || 1));
    updatePoolBlockVisibility(count);
  }

  if (marketCheckboxes?.length) {
    const markets = poolDoc.markets || poolDoc.market || [];
    marketCheckboxes.forEach((cb) => {
      cb.checked = markets.includes(cb.value);
    });
  }

  // Load rules for each pool (bleach + granular) into editor state
  const rulesForPools = poolDoc.rules?.pools || [];
  const blocks = document.querySelectorAll(poolRuleContainerSelector);

  blocks.forEach((block, idx) => {
    const poolIndex = block.dataset.poolIndex;
    const state = getOrCreatePoolRuleState(poolIndex);
    const fromDoc = rulesForPools[idx] || {};

    if (fromDoc.bleach || fromDoc.granular) {
      // New shape: { bleach:{ph,cl}, granular:{ph,cl} }
      state.bleach = {
        ph: { ...(fromDoc.bleach?.ph || {}) },
        cl: { ...(fromDoc.bleach?.cl || {}) },
      };
      state.granular = {
        ph: { ...(fromDoc.granular?.ph || {}) },
        cl: { ...(fromDoc.granular?.cl || {}) },
      };
    } else {
      // Old shape: { ph, cl } – treat as both methods
      const base = {
        ph: { ...(fromDoc.ph || {}) },
        cl: { ...(fromDoc.cl || {}) },
      };
      state.bleach = base;
      state.granular = JSON.parse(JSON.stringify(base));
    }

    // Default to Bleach visible
    showRulesForMethod(block, 'bleach');

    // Update tab styling
    block.querySelectorAll('.sanitation-tab').forEach((tab) => {
      const method = tab.dataset.method || 'bleach';
      tab.classList.toggle('active', method === 'bleach');
    });
  });

  // Everything starts in "view" mode
  disableAllEditors();
}

 
function readEditorToObject() {
  const poolNameInput   = document.getElementById('editorPoolName');
  const numPoolsInput   = document.getElementById('editorNumPools');
  const marketCheckboxes = document.querySelectorAll('input[name="editorMarket"]');

  const name = poolNameInput?.value.trim() || '';
  const numPools = numPoolsInput ? parseInt(numPoolsInput.value || '1', 10) : 1;

  const markets = [];
  marketCheckboxes.forEach((cb) => {
    if (cb.checked) markets.push(cb.value);
  });

  const blocks = document.querySelectorAll(poolRuleContainerSelector);
  const pools = [];

  blocks.forEach((block, idx) => {
    if (idx >= numPools) return; // respect "Number of pools"

    const poolIndex = block.dataset.poolIndex;
    const currentMethod = block.dataset.activeMethod || 'bleach';

    // Make sure the currently visible method is captured from DOM
    captureRulesFromBlock(block, currentMethod);

    const state = getOrCreatePoolRuleState(poolIndex);

    pools.push({
      bleach: state.bleach || createEmptyMethodRules(),
      granular: state.granular || createEmptyMethodRules(),
    });
  });

  return {
    name,
    markets,
    numPools,
    rules: { pools },
  };
}

 
async function attemptSave() {
  const poolData = readEditorToObject();
  if (!poolData) return false;

  try {
    const poolId = currentPoolId || poolData.name;
    const savedId = await savePoolDoc(poolId, poolData);
    currentPoolId = savedId || poolId;
    onSaveSuccess(currentPoolId);
    disableAllEditors();
    return true;
  } catch (error) {
    console.error('Failed to save pool', error);
    showMessage('Could not save the pool. Please try again.', 'error');
    return false;
  }
}
 
function disableAllEditors() {
  const blocks = document.querySelectorAll(poolRuleContainerSelector);
  blocks.forEach((block) => {
    setBlockEnabled(block, false);
  });

  // Match the IDs in NewRules.html
  const metadataEditBtn = document.getElementById('editMetadataBtn');
  const metadataSaveBtn = document.getElementById('saveMetadataBtn');
  if (metadataEditBtn && metadataSaveBtn) {
    metadataEditBtn.disabled = false;
    metadataSaveBtn.disabled = true;
  }

  setMetadataEnabled(false);
}

 
function wireBlockButtons() {
  const blocks = document.querySelectorAll(poolRuleContainerSelector);
  blocks.forEach((block) => {
    const [editBtn, saveBtn] = block.querySelectorAll('.editAndSave');
    if (!editBtn || !saveBtn) return;
 
    editBtn.addEventListener('click', () => {
      setBlockEnabled(block, true);
      editBtn.disabled = true;
      saveBtn.disabled = false;
     });

    saveBtn.addEventListener('click', async () => {
      const success = await attemptSave();
      if (success) {
        setBlockEnabled(block, false);
        editBtn.disabled = false;
        saveBtn.disabled = true;
      }
     });
  });
 }
 
function wireMetadataButtons() {
  // Match button IDs from NewRules.html
  const editBtn = document.getElementById('editMetadataBtn');
  const saveBtn = document.getElementById('saveMetadataBtn');

  if (!editBtn || !saveBtn) return;

  editBtn.addEventListener('click', () => {
    setMetadataEnabled(true);
    editBtn.disabled = true;
    saveBtn.disabled = false;
  });

  saveBtn.addEventListener('click', async () => {
    const success = await attemptSave();
    if (success) {
      setMetadataEnabled(false);
      editBtn.disabled = false;
      saveBtn.disabled = true;
    }
  });
}

// Add "Value / Response / Concern" header to each rules table
function addRuleTableHeaders() {
  const headerHtml = `
    <div class="table-row table-header-row">
      <div class="table-cell table-header-cell">Value</div>
      <div class="table-cell table-header-cell">Response</div>
      <div class="table-cell table-header-cell">Concern</div>
    </div>
  `;

  document
    .querySelectorAll('#poolRuleBlocks .rules-table')
    .forEach((table) => {
      if (!table.querySelector('.table-header-row')) {
        table.insertAdjacentHTML('afterbegin', headerHtml);
      }
    });
}

// Rename concern level options (values stay the same)
function relabelConcernOptions() {
  document
    .querySelectorAll('#poolRuleBlocks .concernLevel')
    .forEach((select) => {
      select.querySelectorAll('option').forEach((opt) => {
        if (opt.value === 'none') opt.textContent = 'None';
        if (opt.value === 'yellow') opt.textContent = 'Minor';
        if (opt.value === 'red') opt.textContent = 'Major';
      });
    });
}

async function refreshPools() {
  poolsCache = await getPools();
  renderSelectOptions(document.getElementById('editorPoolSelect'), poolsCache);
 }
 
function findPoolById(poolId) {
  return poolsCache.find((pool) => pool.id === poolId);
 }
 
function toggleMode(mode) {
  const poolSelectWrapper = document.getElementById('editorPoolSelectWrapper');
  const rockbridgeWrapper = document.getElementById('rockbridgePresetWrapper');
  const metadataSection = document.getElementById('poolMetadataSection');
  const ruleSection = document.getElementById('ruleEditorSection');
  const poolNameInput = document.getElementById('editorPoolName');
  const numPoolsInput = document.getElementById('editorNumPools');
  const marketCheckboxes = document.querySelectorAll('input[name="editorMarket"]');

  if (!poolSelectWrapper || !rockbridgeWrapper || !metadataSection || !ruleSection) {
    console.warn('Editor sections not found – cannot toggle mode.');
    return;
  }

  // Reset current pool id when switching modes
  currentPoolId = '';

  if (mode === 'add') {
    // ADD MODE: everything visible except "Select a pool"
    poolSelectWrapper.classList.add('hidden');
    rockbridgeWrapper.classList.remove('hidden');
    metadataSection.classList.remove('hidden');
    ruleSection.classList.remove('hidden');

    // Preset metadata for Rockbridge
    if (poolNameInput) poolNameInput.value = 'Rockbridge';
    if (numPoolsInput) {
      numPoolsInput.value = '2';
      updatePoolBlockVisibility(2);
    }
    if (marketCheckboxes?.length) {
      marketCheckboxes.forEach((cb) => {
        cb.checked = cb.value === 'Columbia';
      });
    }

    // Clear rules, then apply Rockbridge presets
    document.querySelectorAll(poolRuleContainerSelector).forEach((block) => {
      applyRuleToInputs(block, {});
    });

    // Fire and forget – presets will populate once pools are loaded
    cloneRockbridgePresets().catch((err) => {
      console.error('Error applying Rockbridge presets in add mode', err);
    });
  } else if (mode === 'edit') {
    // EDIT MODE: only the pool dropdown visible until user picks a pool
    poolSelectWrapper.classList.remove('hidden');
    rockbridgeWrapper.classList.add('hidden');
    metadataSection.classList.add('hidden');
    ruleSection.classList.add('hidden');

    // Clear metadata fields when switching to edit
    if (poolNameInput) poolNameInput.value = '';
    if (numPoolsInput) numPoolsInput.value = '1';
    if (marketCheckboxes?.length) {
      marketCheckboxes.forEach((cb) => {
        cb.checked = false;
      });
    }
  }

  disableAllEditors();
}
 
async function cloneRockbridgePresets() {
  if (!poolsCache.length) {
    await refreshPools();
  }
  const rockbridge = poolsCache.find((pool) => getPoolName(pool) === 'Rockbridge');
  if (!rockbridge) {
    showMessage('Rockbridge pool not found.', 'error');
    return;
  }

  const rules = rockbridge.rules?.pools || [];
  const primary = rules[0] || {};
  const secondary = rules[1] || primary;
  const blocks = document.querySelectorAll(poolRuleContainerSelector);
 

  blocks.forEach((block, idx) => {
    if (idx === 0) {
      applyRuleToInputs(block, primary);
    } else if (idx === 1) {
      applyRuleToInputs(block, secondary);
    } else {
      applyRuleToInputs(block, primary);
    }

    // After applying presets for Bleach, store them in state and
    // duplicate into Granular as a starting point.
    const poolIndex = block.dataset.poolIndex;
    captureRulesFromBlock(block, 'bleach');
    const state = getOrCreatePoolRuleState(poolIndex);
    state.granular = JSON.parse(JSON.stringify(state.bleach));
    block.dataset.activeMethod = 'bleach';
  });

 
  showMessage('Rockbridge presets applied.', 'success');
 }
 
function setActiveModeButton(mode) {
  const addBtn = document.getElementById('editorModeAdd');
  const editBtn = document.getElementById('editorModeEdit');

  if (!addBtn || !editBtn) return;

  addBtn.classList.toggle('active', mode === 'add');
  editBtn.classList.toggle('active', mode === 'edit');
}

function attachEditorEvents() {
    const poolSelect        = document.getElementById('editorPoolSelect');
    const rockbridgeBtn     = document.getElementById('rockbridgePresetsBtn');
    const editorModeEditBtn = document.getElementById('editorModeEdit');
    const editorModeAddBtn  = document.getElementById('editorModeAdd');
    const numPoolsInput     = document.getElementById('editorNumPools');

    // When a pool is chosen in "Edit existing pool" mode
    if (poolSelect) {
        poolSelect.addEventListener('change', () => {
            const poolMetadataSection = document.getElementById('poolMetadataSection');
            const ruleEditorSection   = document.getElementById('ruleEditorSection');

            if (!poolSelect.value) {
                // Back to “no pool selected” – hide details again
                poolMetadataSection?.classList.add('hidden');
                ruleEditorSection?.classList.add('hidden');
                currentPoolId = '';
                return;
            }

            const poolDoc = findPoolById(poolSelect.value);
            if (poolDoc) {
                loadPoolIntoEditor(poolDoc);
                showEditorDetails(); // reveals metadata + rule editor
            } else {
                showMessage('Pool not found. Please refresh.', 'error');
            }
        });
    }

    // Apply Rockbridge preset for “Add new pool”
    if (rockbridgeBtn) {
        rockbridgeBtn.addEventListener('click', async () => {
            try {
                await cloneRockbridgePresets();
                showMessage('Rockbridge presets applied.', 'success');
            } catch (err) {
                console.error('Error applying Rockbridge presets', err);
                showMessage('Error applying Rockbridge presets.', 'error');
            }
        });
    }

    // Mode buttons (top of the editor)
    if (editorModeEditBtn) {
        editorModeEditBtn.addEventListener('click', () => {
            setActiveModeButton('edit');
            toggleMode('edit');
        });
    }

    if (editorModeAddBtn) {
        editorModeAddBtn.addEventListener('click', () => {
            setActiveModeButton('add');
            toggleMode('add');
        });
    }

    // Number of pools selector
    if (numPoolsInput) {
        numPoolsInput.addEventListener('change', () => {
            const count = Math.max(1, Math.min(5, Number(numPoolsInput.value) || 1));
            updatePoolBlockVisibility(count);
        });
    }
}

const activeSanitationByPool = {};

function setupSanitationTabs() {
  document.querySelectorAll('.sanitation-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const block = tab.closest(poolRuleContainerSelector);
      if (!block) return;

      const newMethod = tab.dataset.method || 'bleach';
      const currentMethod = block.dataset.activeMethod || 'bleach';
      if (newMethod === currentMethod) return;

      // Save what’s currently on screen for the old method
      captureRulesFromBlock(block, currentMethod);

      // Toggle active tab styling
      block.querySelectorAll('.sanitation-tab').forEach((btn) => {
        const method = btn.dataset.method || 'bleach';
        btn.classList.toggle('active', method === newMethod);
      });

      // Load the rules for the newly selected method
      showRulesForMethod(block, newMethod);
    });
  });
}


function applyConcernToRow(select) {
  const row = select.closest('.table-row');
  if (!row) return;

  const responseArea = row.querySelector('textarea');

  // remove previous concern classes
  ['concern-none', 'concern-minor', 'concern-major'].forEach((cls) => {
    row.classList.remove(cls);
    select.classList.remove(cls);
    if (responseArea) responseArea.classList.remove(cls);
  });

  const level = select.value || 'none';
  const cls =
    level === 'major' ? 'concern-major' :
    level === 'minor' ? 'concern-minor' :
    'concern-none';

  row.classList.add(cls);
  select.classList.add(cls);
  if (responseArea) responseArea.classList.add(cls);
}

function wireConcernDropdowns() {
  document.querySelectorAll('.concernLevel').forEach((sel) => {
    sel.addEventListener('change', () => applyConcernToRow(sel));
    // apply initial state from saved value
    applyConcernToRow(sel);
  });
}

function setupDeletePool() {
  const deleteBtn = document.getElementById('deletePoolBtn');
  const modal = document.getElementById('deletePoolModal');
  const confirmBtn = document.getElementById('confirmDeletePoolBtn');
  const cancelBtn = document.getElementById('cancelDeletePoolBtn');

  if (!deleteBtn || !modal || !confirmBtn || !cancelBtn) {
    console.warn('Delete pool UI not fully present.');
    return;
  }

  const closeModal = () => {
    modal.style.display = 'none';
    removeOverlay?.();
  };

  deleteBtn.addEventListener('click', () => {
    if (!currentPoolId) {
      showMessage('You can only delete an existing saved pool.', 'warning');
      return;
    }
    createOrShowOverlay?.();
    modal.style.display = 'block';
  });

  cancelBtn.addEventListener('click', closeModal);

confirmBtn.addEventListener('click', async () => {
  if (!currentPoolId) return;

  // disable button to prevent double-clicks while working
  confirmBtn.disabled = true;

  try {
    // Attempt deletion (deletePoolDoc may return true/false or throw)
    const result = await deletePoolDoc(currentPoolId);

    // If the helper returns falsey (explicit false or null/undefined),
    // treat it as a failure and surface a helpful message.
    if (!result) {
      console.error('deletePoolDoc indicated failure for id:', currentPoolId, 'result:', result);
      showMessage('Could not delete pool. Check console for details.', 'error');
      return;
    }

    // Success path
    showMessage('Pool deleted.', 'success');

    // Close modal & remove overlay if those functions exist
    try {
      if (typeof closeModal === 'function') closeModal();
      if (typeof removeOverlay === 'function') removeOverlay();
    } catch (e) {
      // non-fatal: log and continue
      console.warn('Error closing modal / removing overlay after delete:', e);
    }

    // Refresh pools list and UI
    await refreshPools();

    // Clear selection and current id
    const poolSelect = document.getElementById('editorPoolSelect');
    if (poolSelect) poolSelect.value = '';
    currentPoolId = '';

    // Hide metadata + rules sections (back to pre-edit state)
    const metadataSection = document.getElementById('poolMetadataSection');
    const ruleSection = document.getElementById('ruleEditorSection');
    metadataSection?.classList.add('hidden');
    ruleSection?.classList.add('hidden');

  } catch (err) {
    // Unexpected exception (network / Firestore permission / etc.)
    console.error('Error deleting pool:', err);
    showMessage(`Could not delete pool: ${err?.message || String(err)}`, 'error');
  } finally {
    // always re-enable confirm button
    confirmBtn.disabled = false;
  }
});
}


async function initEditor() {
  removePoolShapeGallonage();
  startPoolListener();
  await refreshPools();

  wireMetadataButtons();
  wireBlockButtons();
  setupSanitationTabs();
  wireConcernDropdowns();
  setupDeletePool();
  attachEditorEvents();
  toggleMode('add');

  const editorSection       = document.getElementById('poolRuleEditorSection');
  const poolSelectWrapper   = document.getElementById('editorPoolSelectWrapper');
  const rockbridgeWrapper   = document.getElementById('rockbridgePresetWrapper');
  const poolMetadataSection = document.getElementById('poolMetadataSection');
  const ruleEditorSection   = document.getElementById('ruleEditorSection');

  // Show the editor header + mode buttons
  editorSection?.classList.remove('hidden');

  // Initial state: only the Add/Edit buttons visible
  poolSelectWrapper?.classList.add('hidden');
  rockbridgeWrapper?.classList.add('hidden');
  poolMetadataSection?.classList.add('hidden');
  ruleEditorSection?.classList.add('hidden');

  // Hide all pool rule blocks until a pool count is chosen
  updatePoolBlockVisibility(0);

  // Make sure everything starts in read‑only mode
  disableAllEditors();
}


 

function onSaveSuccess(poolId) {
  showMessage('Saved', 'success');
  refreshPools();
  currentPoolId = poolId;
}

window.initEditor = initEditor;
window.cloneRockbridgePresets = cloneRockbridgePresets;
window.loadPoolIntoEditor = loadPoolIntoEditor;
window.readEditorToObject = readEditorToObject;
window.onSaveSuccess = onSaveSuccess;

// Initialize the editor once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initEditor().catch((err) => {
    console.error('Failed to initialize pool rule editor', err);
    if (typeof showMessage === 'function') {
      showMessage('Error loading pool rule editor. Please refresh the page.', 'error');
    }
  });
});
