import { getPools, listenPools, savePoolDoc, deletePoolDoc } from '../firebase.js';
 
let poolsCache = [];
let currentPoolId = '';
let poolsListenerStarted = false;

// ---- Per‑sanitation rule state ----
const SANITATION_METHODS = ['bleach', 'granular'];

// ruleStateByPool[poolIndex] = { bleach: { ph:{}, cl:{} }, granular: { ph:{}, cl:{} } }
const ruleStateByPool = {};

// ---------- Rockbridge preset handling ----------

const ROCKBRIDGE_PRESET_STORAGE_KEY = 'chemlog_rockbridge_preset_v1';

/**
 * Read the current metadata + rule tables from the editor and, if the
 * pool name is "Rockbridge", store them in localStorage so they can be
 * used as defaults for any *new* pools that get created later.
 */
function captureRockbridgePresetIfNeeded() {
  const nameInput = document.getElementById('editorPoolName');
  if (!nameInput) return;

  const poolName = (nameInput.value || '').trim();
  if (poolName !== 'Rockbridge') return;

  const numPoolsSelect = document.getElementById('editorNumPools');
  const marketCheckboxes = document.querySelectorAll('input[name="editorMarket"]');

  const preset = {
    metadata: {
      numPools: numPoolsSelect ? Number(numPoolsSelect.value || 2) : 2,
      markets: Array.from(marketCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value),
    },
    rulesByPoolIndex: {},
  };

  // Capture all rules from each pool rule block
  document.querySelectorAll('.pool-rule-block').forEach(block => {
    const poolIndex = block.dataset.poolIndex;
    if (!poolIndex) return;

    const poolRules = { ph: {}, cl: {} };

    block.querySelectorAll(`textarea[id^="pool${poolIndex}_"]`).forEach(area => {
      const typeKey = area.id.includes('_ph_') ? 'ph' : 'cl';
      const key = area.id.replace(`pool${poolIndex}_${typeKey}_`, '');
      const levelSelect = document.getElementById(`${area.id}_level`);

      poolRules[typeKey][key] = {
        response: area.value.trim(),
        concernLevel: levelSelect ? levelSelect.value : 'none',
      };
    });

    preset.rulesByPoolIndex[poolIndex] = poolRules;
  });

  try {
    localStorage.setItem(
      ROCKBRIDGE_PRESET_STORAGE_KEY,
      JSON.stringify(preset)
    );
    // console.log('Rockbridge preset updated', preset);
  } catch (err) {
    console.error('Unable to save Rockbridge preset', err);
  }
}

/**
 * Apply the last-saved Rockbridge preset to the editor while in
 * "Add new pool" mode.  Pool name is intentionally reset to "New Pool"
 * so you don't accidentally create another Rockbridge.
 */
function applyRockbridgePresetToNewPool() {
  let raw = null;
  try {
    raw = localStorage.getItem(ROCKBRIDGE_PRESET_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return;

  let preset;
  try {
    preset = JSON.parse(raw);
  } catch {
    return;
  }

  const nameInput = document.getElementById('editorPoolName');
  const numPoolsSelect = document.getElementById('editorNumPools');
  const marketCheckboxes = document.querySelectorAll('input[name="editorMarket"]');

  // Always reset the name to something generic for a new pool
  if (nameInput) {
    nameInput.value = 'New Pool';
  }
  if (numPoolsSelect && preset.metadata && preset.metadata.numPools) {
    numPoolsSelect.value = String(preset.metadata.numPools);
  }

  // Markets
  if (preset.metadata && Array.isArray(preset.metadata.markets)) {
    const set = new Set(preset.metadata.markets);
    marketCheckboxes.forEach(cb => {
      cb.checked = set.has(cb.value);
    });
  }

  // Rules for each pool index (1, 2, etc.)
  if (!preset.rulesByPoolIndex) return;

  Object.entries(preset.rulesByPoolIndex).forEach(([poolIndex, rules]) => {
    ['ph', 'cl'].forEach(typeKey => {
      const group = rules[typeKey] || {};
      Object.entries(group).forEach(([key, rule]) => {
        const textarea = document.getElementById(
          `pool${poolIndex}_${typeKey}_${key}`
        );
        const levelSelect = document.getElementById(
          `pool${poolIndex}_${typeKey}_${key}_level`
        );

        if (textarea && typeof rule.response === 'string') {
          textarea.value = rule.response;
        }
        if (levelSelect && rule.concernLevel) {
          levelSelect.value = rule.concernLevel;
        }
      });
    });
  });
}


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

  // 🔁 pH is shared across ALL sanitation methods (Bleach + Granular).
  // Whatever is on screen right now becomes the single source of truth
  // for pH for this pool, regardless of which tab is active.
  SANITATION_METHODS.forEach((m) => {
    if (!state[m]) state[m] = createEmptyMethodRules();
    state[m].ph = JSON.parse(JSON.stringify(methodRules.ph));
  });

  // 💧 Chlorine rules remain method‑specific.
  if (!state[method]) state[method] = createEmptyMethodRules();
  state[method].cl = JSON.parse(JSON.stringify(methodRules.cl));
}

/**
 * Push one method’s rules from ruleStateByPool back into the DOM
 * for a single pool block.
 */
function showRulesForMethod(block, method) {
  const poolIndex = block.dataset.poolIndex;
  const state = getOrCreatePoolRuleState(poolIndex);

  // If we switch to Granular and its Cl rules are empty
  // but Bleach has Cl rules, clone them so the user
  // never sees a blank granular Cl section by default.
  if (method === 'granular') {
    const bleach   = state.bleach   || createEmptyMethodRules();
    const granular = state.granular || createEmptyMethodRules();

    const granularCl = granular.cl || {};
    const hasAnyGranularCl = Object.values(granularCl).some(
      (rule) =>
        rule &&
        typeof rule.response === 'string' &&
        rule.response.trim() !== ''
    );

    if (!hasAnyGranularCl && bleach.cl) {
      granular.cl = JSON.parse(JSON.stringify(bleach.cl));
      state.granular = granular;
    }
  }

  const methodState = state[method] || createEmptyMethodRules();
  applyRuleToInputs(block, methodState);
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
      // pH is shared across both methods; merge any existing ph rules.
      const sharedPh = {
        ...(fromDoc.bleach?.ph || {}),
        ...(fromDoc.granular?.ph || {}),
      };

      state.bleach = {
        ph: { ...sharedPh },
        cl: { ...(fromDoc.bleach?.cl || {}) },
      };
      state.granular = {
        ph: { ...sharedPh },
        cl: { ...(fromDoc.granular?.cl || {}) },
      };
    } else {
      // Old shape: { ph, cl } – treat as both methods
      const sharedPh = { ...(fromDoc.ph || {}) };
      const baseCl   = { ...(fromDoc.cl || {}) };

      state.bleach = {
        ph: { ...sharedPh },
        cl: { ...baseCl },
      };
      state.granular = {
        ph: { ...sharedPh },
        cl: { ...baseCl },
      };
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
  captureRockbridgePresetIfNeeded();
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
       captureRockbridgePresetIfNeeded();
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
 
function applyRockbridgeMetadataFromCache() {
  const poolNameInput    = document.getElementById('editorPoolName');
  const numPoolsInput    = document.getElementById('editorNumPools');
  const marketCheckboxes = document.querySelectorAll('input[name="editorMarket"]');

  const rockbridge = poolsCache.find((pool) => getPoolName(pool) === 'Rockbridge');

  // If we can't find Rockbridge, fall back to a simple default
  if (!rockbridge) {
    if (poolNameInput) poolNameInput.value = 'New Pool';
    if (numPoolsInput) {
      numPoolsInput.value = '2';
      updatePoolBlockVisibility(2);
    }
    if (marketCheckboxes?.length) {
      marketCheckboxes.forEach((cb) => {
        cb.checked = cb.value === 'Columbia';
      });
    }
    return;
  }

  // Use a generic name so you don't accidentally create a second “Rockbridge”
  if (poolNameInput) {
    poolNameInput.value = 'New Pool';
  }

  // Copy numPools
  if (numPoolsInput) {
    const count = typeof rockbridge.numPools === 'number' ? rockbridge.numPools : 2;
    numPoolsInput.value = String(count);
    updatePoolBlockVisibility(count);
  }

  // Copy markets
  if (marketCheckboxes?.length) {
    const set = new Set(rockbridge.markets || []);
    marketCheckboxes.forEach((cb) => {
      cb.checked = set.size ? set.has(cb.value) : cb.value === 'Columbia';
    });
  }
}


function toggleMode(mode) {
  const poolSelectWrapper = document.getElementById('editorPoolSelectWrapper');
  const rockbridgeWrapper = document.getElementById('rockbridgePresetWrapper');
  const metadataSection   = document.getElementById('poolMetadataSection');
  const ruleSection       = document.getElementById('ruleEditorSection');
  const poolNameInput     = document.getElementById('editorPoolName');
  const numPoolsInput     = document.getElementById('editorNumPools');
  const marketCheckboxes  = document.querySelectorAll('input[name="editorMarket"]');

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

    // Use Rockbridge's saved metadata as the template for new pools
    applyRockbridgeMetadataFromCache();

    // Clear rules in the UI before cloning presets
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

  // Lock everything by default; Edit buttons will re‑enable sections
  disableAllEditors();
}

 
async function cloneRockbridgePresets() {
  // Make sure we have the latest list of pools
  if (!poolsCache.length) {
    await refreshPools();
  }

  const rockbridge = poolsCache.find((pool) => getPoolName(pool) === 'Rockbridge');
  if (!rockbridge || !rockbridge.rules || !Array.isArray(rockbridge.rules.pools)) {
    console.warn('Rockbridge rules not found or malformed', rockbridge);
    showMessage('Rockbridge rules could not be loaded for presets.', 'error');
    return;
  }

  const rulesArray = rockbridge.rules.pools || [];
  const blocks = document.querySelectorAll(poolRuleContainerSelector);

  blocks.forEach((block, idx) => {
    const poolIndex = block.dataset.poolIndex;
    if (!poolIndex) return;

    // Pick the Rockbridge pool rules to clone into this block
    const fromDoc = rulesArray[idx] || rulesArray[0] || {};

    // Support both the new {bleach, granular} shape and the older {ph, cl} shape
    const bleachDoc   = fromDoc.bleach || fromDoc || {};
    const granularDoc = fromDoc.granular || {};

    const bleachPh   = bleachDoc.ph   || {};
    const bleachCl   = bleachDoc.cl   || {};
    const granularPh = granularDoc.ph || {};
    const granularCl = granularDoc.cl || {};

    // pH is shared across methods – merge any separate ph rules
    const sharedPh = {
      ...bleachPh,
      ...granularPh,
    };

    // If granular has no Cl defined, fall back to bleach Cl
    const granularClSource =
      Object.keys(granularCl).length > 0
        ? granularCl
        : bleachCl;

    const state = getOrCreatePoolRuleState(poolIndex);

    state.bleach = {
      ph: JSON.parse(JSON.stringify(sharedPh)),
      cl: JSON.parse(JSON.stringify(bleachCl)),
    };

    state.granular = {
      ph: JSON.parse(JSON.stringify(sharedPh)),
      cl: JSON.parse(JSON.stringify(granularClSource)),
    };

    // Default view is Bleach
    showRulesForMethod(block, 'bleach');
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
          captureRockbridgePresetIfNeeded();
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
