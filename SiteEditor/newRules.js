import { getPools, listenPools, savePoolDoc } from '../firebase.js';
 
let poolsCache = [];
let currentPoolId = '';
let poolsListenerStarted = false;
 
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
  if (!block) return;

  // Toggle styling classes so CSS can grey out just the tables
  block.classList.toggle('editing', enabled);
  block.classList.toggle('disabled-block', !enabled);

  // Enable/disable all rule inputs, including Concern dropdowns
  block.querySelectorAll('textarea, select').forEach(el => {
    el.disabled = !enabled;
  });
}
 
function setMetadataEnabled(enabled) {
  const metadataFields = [
    document.getElementById('editorPoolName'),
    document.getElementById('editorNumPools'),
    ...document.querySelectorAll('input[name="editorMarket"]'),
  ];
  metadataFields.forEach((el) => {
    if (el) el.disabled = !enabled;
  });
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
    if (levelSelect) levelSelect.value = ruleEntry.concernLevel || 'none';
  });
 }
 
function loadPoolIntoEditor(poolDoc) {
  if (!poolDoc) return;
  currentPoolId = poolDoc.id || '';

  // When editing, reveal the metadata + rule sections
  const metadataSection = document.getElementById('poolMetadataSection');
  const ruleSection = document.getElementById('ruleEditorSection');
  metadataSection?.classList.remove('hidden');
  ruleSection?.classList.remove('hidden');
 
  const poolNameInput = document.getElementById('editorPoolName');
  const numPoolsInput = document.getElementById('editorNumPools');
  const numPoolsInput = document.getElementById('editorNumPools');
  const numPools = Math.max(1, Math.min(5, Number(numPoolsInput?.value) || 1));
    updatePoolBlockVisibility(numPools);
  const marketCheckboxes = document.querySelectorAll('input[name="editorMarket"]');
 
  if (poolNameInput) poolNameInput.value = getPoolName(poolDoc);
  if (numPoolsInput) numPoolsInput.value = poolDoc.numPools || poolDoc.poolCount || 1;
  if (marketCheckboxes?.length) {
    const markets = poolDoc.markets || poolDoc.market || [];
    marketCheckboxes.forEach((cb) => {
      cb.checked = markets.includes(cb.value);
    });
  }
 
  const rulesForPools = poolDoc.rules?.pools || [];
  const blocks = document.querySelectorAll(poolRuleContainerSelector);
  blocks.forEach((block, idx) => {
    applyRuleToInputs(block, rulesForPools[idx] || {});
    setBlockEnabled(block, false);
    const [editBtn, saveBtn] = block.querySelectorAll('.editAndSave');
    if (editBtn) editBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = true;
  });
 
  setMetadataEnabled(false);
  const metadataEditBtn = document.getElementById('metadataEditBtn');
  const metadataSaveBtn = document.getElementById('metadataSaveBtn');
  if (metadataEditBtn) metadataEditBtn.disabled = false;
  if (metadataSaveBtn) metadataSaveBtn.disabled = true;
 

  updatePoolBlockVisibility(Number(numPoolsInput?.value) || 1);
 }
 
function readEditorToObject() {
  const poolNameInput = document.getElementById('editorPoolName');
  const numPoolsInput = document.getElementById('editorNumPools');
  if (!poolNameInput || !numPoolsInput) return null;
 
  const name = poolNameInput.value.trim();
  if (!name) {
    showMessage('Pool name is required.', 'error');
    return null;
  }
 
  const numPools = Math.max(1, Math.min(5, Number(numPoolsInput.value) || 1));
  const markets = Array.from(document.querySelectorAll('input[name="editorMarket"]'))
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  const pools = [];
  const blocks = document.querySelectorAll(poolRuleContainerSelector);
  blocks.forEach((block, idx) => {
    if (idx >= numPools) return;
    const poolIndex = block.dataset.poolIndex;
    const ph = {};
    const cl = {};

    block.querySelectorAll(`textarea[id^="pool${poolIndex}_"]`).forEach((area) => {
      const typeKey = area.id.includes('_ph_') ? 'ph' : 'cl';
      const key = area.id.replace(`pool${poolIndex}_${typeKey}_`, '');
      const levelSelect = document.getElementById(`${area.id}_level`);
      const entry = { response: area.value.trim(), concernLevel: levelSelect?.value || 'none' };
      if (typeKey === 'ph') {
        ph[key] = entry;
      } else {
        cl[key] = entry;
      }
     });
 
    pools.push({ ph, cl });
  });

  return { name, markets, numPools, rules: { pools } };
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
  document.querySelectorAll(poolRuleContainerSelector).forEach((block) => {
    setBlockEnabled(block, false);
    const [editBtn, saveBtn] = block.querySelectorAll('.editAndSave');
    if (editBtn) editBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = true;
  });
  setMetadataEnabled(false);
  const metadataEditBtn = document.getElementById('metadataEditBtn');
  const metadataSaveBtn = document.getElementById('metadataSaveBtn');
  if (metadataEditBtn) metadataEditBtn.disabled = false;
  if (metadataSaveBtn) metadataSaveBtn.disabled = true;
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
  const editBtn = document.getElementById('metadataEditBtn');
  const saveBtn = document.getElementById('metadataSaveBtn');
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
  const poolSelect = document.getElementById('editorPoolSelect');
  const rockbridgeBtn = document.getElementById('rockbridgePresetsBtn');
  const editorModeEditBtn = document.getElementById('editorModeEdit');
  const editorModeAddBtn = document.getElementById('editorModeAdd');
  const numPoolsInput = document.getElementById('editorNumPools');

    if (poolSelect) {
    poolSelect.addEventListener('change', () => {
        if (!poolSelect.value) {
        // Back to "Select an existing pool..." — hide details again
        const poolMetadataSection = document.getElementById('poolMetadataSection');
        const ruleEditorSection = document.getElementById('ruleEditorSection');
        poolMetadataSection?.classList.add('hidden');
        ruleEditorSection?.classList.add('hidden');
        return;
        }

        const poolDoc = findPoolById(poolSelect.value);
        if (poolDoc) {
        loadPoolIntoEditor(poolDoc);
        showEditorDetails();   // will remove .hidden
        } else {
        showMessage('Pool not found. Please refresh.', 'error');
        }
    });
    }


  if (rockbridgeBtn) {
    rockbridgeBtn.addEventListener('click', cloneRockbridgePresets);
  }

  if (editorModeEdit) {
    editorModeEdit.addEventListener('click', () => {
      setActiveModeButton('edit');
      toggleMode('edit');
    });
  }

  if (editorModeAdd) {
    editorModeAdd.addEventListener('click', () => {
      setActiveModeButton('add');
      toggleMode('add');
    });
  }

  if (numPoolsInput) {
    numPoolsInput.addEventListener('change', () => {
      updatePoolBlockVisibility(
        Math.max(1, Math.min(5, Number(numPoolsInput.value) || 1)),
      );
    });
  }
}

const activeSanitationByPool = {};

function setupSanitationTabs() {
  document.querySelectorAll('.sanitation-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const poolIndex = tab.dataset.poolIndex;
      const method = tab.dataset.method || 'bleach';

      const block = tab.closest('.pool-rule-block');
      if (!block) return;

      // Visual active state
      block.querySelectorAll('.sanitation-tab').forEach((t) => {
        t.classList.toggle('active', t === tab);
      });

      // Remember the active method for this pool
      activeSanitationByPool[poolIndex] = method;
      block.dataset.activeMethod = method;

      // NOTE: with the current data model, Bleach and Granular
      // share the same underlying rules. This wiring makes the
      // tabs behave correctly in the UI and keeps track of which
      // method is "active" per pool so we can extend the data
      // model later to store separate rules per method.
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

    try {
      await deletePoolDoc(currentPoolId);
      showMessage('Pool deleted.', 'success');
      closeModal();
      await refreshPools();

      const poolSelect = document.getElementById('editorPoolSelect');
      if (poolSelect) poolSelect.value = '';
      currentPoolId = '';

      // Hide details again in edit mode
      const metadataSection = document.getElementById('poolMetadataSection');
      const ruleSection = document.getElementById('ruleEditorSection');
      metadataSection?.classList.add('hidden');
      ruleSection?.classList.add('hidden');
    } catch (error) {
      console.error('Error deleting pool', error);
      showMessage('Could not delete pool. Please try again.', 'error');
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
  toggleMode(document.getElementById('editorModeAdd')?.checked ? 'add' : 'edit');

  const editorSection       = document.getElementById('poolRuleEditorSection');
  const poolSelectWrapper   = document.getElementById('editorPoolSelectWrapper');
  const rockbridgeWrapper   = document.getElementById('rockbridgePresetWrapper');
  const poolMetadataSection = document.getElementById('poolMetadataSection');
  const ruleEditorSection   = document.getElementById('ruleEditorSection');

  // 🔓 Make sure the main editor section itself is visible
  editorSection?.classList.remove('hidden');

  // 🧱 Initial state: show ONLY the mode buttons row
  poolSelectWrapper?.classList.add('hidden');
  rockbridgeWrapper?.classList.add('hidden');
  poolMetadataSection?.classList.add('hidden');
  ruleEditorSection?.classList.add('hidden');

  // Keep all fields disabled until "Edit" is clicked
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



console.log('newRules.js loaded');
