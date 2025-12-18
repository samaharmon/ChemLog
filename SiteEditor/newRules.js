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
  block.querySelectorAll('textarea, select').forEach((el) => {
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
  const blocks = document.querySelectorAll(poolRuleContainerSelector);
  blocks.forEach((block, idx) => {
    block.style.display = idx < count ? '' : 'none';
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

  if (!poolSelectWrapper || !rockbridgeWrapper || !metadataSection || !ruleSection) {
    console.warn('Editor sections not found – cannot toggle mode.');
    return;
  }

  // Always reset pool name + currentPoolId when switching
  if (poolNameInput) poolNameInput.value = '';
  currentPoolId = '';

  if (mode === 'add') {
    // ADD MODE: everything visible except "Select a pool"
    poolSelectWrapper.classList.add('hidden');
    rockbridgeWrapper.classList.remove('hidden');
    metadataSection.classList.remove('hidden');
    ruleSection.classList.remove('hidden');

    // Clear rules before optionally applying Rockbridge presets
    document.querySelectorAll(poolRuleContainerSelector).forEach(block => {
      applyRuleToInputs(block, {});
    });
  } else if (mode === 'edit') {
    // EDIT MODE: only the pool dropdown visible until user picks a pool
    poolSelectWrapper.classList.remove('hidden');
    rockbridgeWrapper.classList.add('hidden');
    metadataSection.classList.add('hidden');
    ruleSection.classList.add('hidden');
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
        if (poolMetadataSection) poolMetadataSection.style.display = 'none';
        if (ruleEditorSection) ruleEditorSection.style.display = 'none';
        return;
      }

      const poolDoc = findPoolById(poolSelect.value);
      if (poolDoc) {
        loadPoolIntoEditor(poolDoc);
        showEditorDetails();
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

async function initEditor() {
  removePoolShapeGallonage();
  startPoolListener();
  await refreshPools();
  wireMetadataButtons();
  wireBlockButtons();
  attachEditorEvents();

  // Initial state: show only the two mode buttons
  const poolSelectWrapper = document.getElementById('editorPoolSelectWrapper');
  const rockbridgeWrapper = document.getElementById('rockbridgePresetWrapper');
  const poolMetadataSection = document.getElementById('poolMetadataSection');
  const ruleEditorSection = document.getElementById('ruleEditorSection');

  if (poolSelectWrapper) poolSelectWrapper.style.display = 'none';
  if (rockbridgeWrapper) rockbridgeWrapper.style.display = 'none';
  if (poolMetadataSection) poolMetadataSection.style.display = 'none';
  if (ruleEditorSection) ruleEditorSection.style.display = 'none';

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

// Run the editor wiring when this page finishes loading
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Pool Rule Editor...');
  initEditor().catch(err => {
    console.error('initEditor failed:', err);
    if (typeof showMessage === 'function') {
      showMessage('Could not initialize the pool rule editor.', 'error');
    }
  });
});


console.log('newRules.js loaded');
