// training.js
// ChemLog Training Page logic
// - Supervisor login gating
// - Training session CRUD (date, time, pool, address, capacity, notes)
// - Lifeguard signup with capacity enforcement

const STORAGE_KEY = 'chemlogTrainingSessions_v1';
const LOGIN_KEY = 'chemlogTrainingSupervisorLoggedIn';

let trainingSessions = [];

// ---------- Storage helpers ----------

function generateId() {
  return (
    'sess_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: generateId(),
      date: '',
      time: '',
      pool: '',
      address: '',
      capacity: 0,
      notes: '',
      attendees: []
    };
  }

  const capacity = parseInt(raw.capacity, 10);

  return {
    id: raw.id || generateId(),
    date: raw.date || '',
    time: raw.time || '',
    pool: raw.pool || '',
    address: raw.address || '',
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 0,
    notes: raw.notes || '',
    attendees: Array.isArray(raw.attendees) ? raw.attendees : []
  };
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSession);
  } catch (err) {
    console.error('Error loading training sessions from storage:', err);
    return [];
  }
}

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trainingSessions));
  } catch (err) {
    console.error('Error saving training sessions to storage:', err);
  }
}

// ---------- Date / time helpers ----------

function getMonthKeyFromDateString(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.getMonth(); // 0-based
  if (month === 4) return 'may'; // May
  if (month === 5) return 'june'; // June
  if (month === 6) return 'july'; // July
  return null;
}

function formatDateNice(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const month = d.toLocaleString(undefined, { month: 'short' });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

const TIME_OPTIONS = [
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
  '7:00 PM',
  '8:00 PM'
];

function buildTimeOptions(selectEl) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select time';
  selectEl.appendChild(placeholder);

  TIME_OPTIONS.forEach((timeStr) => {
    const opt = document.createElement('option');
    opt.value = timeStr;
    opt.textContent = timeStr;
    selectEl.appendChild(opt);
  });

  if (current) {
    selectEl.value = current;
    if (selectEl.value !== current) {
      const customOpt = document.createElement('option');
      customOpt.value = current;
      customOpt.textContent = current;
      customOpt.selected = true;
      selectEl.appendChild(customOpt);
    }
  }
}

// ---------- UI helpers ----------

function updateCapacityInfo(session, el) {
  if (!el.capacityInfo) return;

  if (!session) {
    el.capacityInfo.textContent =
      'Spots used / remaining will appear after you save this session.';
    return;
  }

  const capacity = session.capacity || 0;
  const taken = Array.isArray(session.attendees)
    ? session.attendees.length
    : 0;

  if (!capacity) {
    el.capacityInfo.textContent = `${taken} sign‑ups so far. Add a capacity to track remaining spots.`;
    return;
  }

  const remaining = Math.max(capacity - taken, 0);
  el.capacityInfo.textContent = `${taken} of ${capacity} spots used • ${remaining} remaining`;
}

function renderAdminTables(el) {
  if (!el.mayBody || !el.juneBody || !el.julyBody) return;

  el.mayBody.innerHTML = '';
  el.juneBody.innerHTML = '';
  el.julyBody.innerHTML = '';

  const sorted = [...trainingSessions].sort((a, b) => {
    const aDate = a.date || '';
    const bDate = b.date || '';
    if (aDate === bDate) {
      return (a.time || '').localeCompare(b.time || '');
    }
    return aDate.localeCompare(bDate);
  });

  let rowsRendered = 0;

  for (const session of sorted) {
    const monthKey = getMonthKeyFromDateString(session.date);
    let tbody = null;

    if (monthKey === 'may') tbody = el.mayBody;
    else if (monthKey === 'june') tbody = el.juneBody;
    else if (monthKey === 'july') tbody = el.julyBody;
    else continue;

    const row = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDateNice(session.date);
    row.appendChild(dateCell);

    const timeCell = document.createElement('td');
    timeCell.textContent = session.time || '';
    row.appendChild(timeCell);

    const locCell = document.createElement('td');
    locCell.textContent = session.pool || '';
    row.appendChild(locCell);

    const capCell = document.createElement('td');
    const taken = Array.isArray(session.attendees)
      ? session.attendees.length
      : 0;
    const capacity = session.capacity || 0;
    capCell.textContent = capacity ? `${capacity} / ${taken}` : `— / ${taken}`;
    row.appendChild(capCell);

    const actionsCell = document.createElement('td');
    actionsCell.classList.add('actions-cell');

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.className = 'editAndSave edit-training-btn';
    editBtn.dataset.sessionId = session.id;
    actionsCell.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'editAndSave danger-button delete-training-btn';
    deleteBtn.dataset.sessionId = session.id;
    actionsCell.appendChild(deleteBtn);

    row.appendChild(actionsCell);
    tbody.appendChild(row);
    rowsRendered += 1;
  }

  if (!rowsRendered) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'No training sessions have been scheduled yet.';
    row.appendChild(cell);
    el.mayBody.appendChild(row);
  }
}

function updateSessionSelectForMonth(monthKey, el) {
  const select = el.trainingSessionSelect;
  if (!select) return;

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';

  if (!monthKey) {
    placeholder.textContent = 'Select a month first';
    select.appendChild(placeholder);
    return;
  }

  const sessionsForMonth = trainingSessions.filter(
    (s) => getMonthKeyFromDateString(s.date) === monthKey
  );

  if (!sessionsForMonth.length) {
    placeholder.textContent = 'No sessions available for this month';
    select.appendChild(placeholder);
    return;
  }

  placeholder.textContent = 'Select a session';
  select.appendChild(placeholder);

  sessionsForMonth.forEach((session) => {
    const opt = document.createElement('option');
    opt.value = session.id;

    const datePart = formatDateNice(session.date);
    const pieces = [datePart, session.time, session.pool].filter(Boolean);
    let label = pieces.join(' – ');

    const taken = Array.isArray(session.attendees)
      ? session.attendees.length
      : 0;
    const capacity = session.capacity || 0;
    const remaining = capacity ? Math.max(capacity - taken, 0) : null;

    if (capacity) {
      label += ` (${taken}/${capacity} spots filled${
        remaining === 0 ? ' – FULL' : ''
      })`;
    } else if (taken) {
      label += ` (${taken} signed up)`;
    }

    opt.textContent = label;
    if (remaining === 0) {
      opt.disabled = true;
    }

    select.appendChild(opt);
  });
}

// ---------- Admin (supervisor) handlers ----------

function handleSaveSession(el) {
  const date = el.dateInput?.value.trim();
  const time = el.timeSelect?.value.trim();
  const pool = el.poolSelect?.value.trim();
  const address = el.addressInput?.value.trim();
  const capacityRaw = el.capacityInput?.value.trim();
  const notes = el.notesInput?.value.trim();
  const messageEl = el.adminMessage;

  if (!messageEl) return;

  messageEl.textContent = '';
  messageEl.classList.remove('success', 'error');

  if (!date || !time || !pool || !capacityRaw) {
    messageEl.textContent =
      'Please enter a date, time, location, and capacity for the training session.';
    messageEl.classList.add('error');
    return;
  }

  const capacity = parseInt(capacityRaw, 10);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    messageEl.textContent = 'Capacity must be a positive number.';
    messageEl.classList.add('error');
    return;
  }

  const id = el.sessionIdInput?.value;
  let targetSession = null;

  if (id) {
    targetSession = trainingSessions.find((s) => s.id === id);
    if (!targetSession) {
      messageEl.textContent =
        'Could not find that session to update (it may have been deleted). Saving as a new session.';
    }
  }

  if (targetSession) {
    const taken = Array.isArray(targetSession.attendees)
      ? targetSession.attendees.length
      : 0;
    if (capacity < taken) {
      messageEl.textContent = `Capacity (${capacity}) cannot be less than current sign‑ups (${taken}).`;
      messageEl.classList.add('error');
      return;
    }

    targetSession.date = date;
    targetSession.time = time;
    targetSession.pool = pool;
    targetSession.address = address;
    targetSession.capacity = capacity;
    targetSession.notes = notes;
  } else {
    targetSession = {
      id: generateId(),
      date,
      time,
      pool,
      address,
      capacity,
      notes,
      attendees: []
    };
    trainingSessions.push(targetSession);
    if (el.sessionIdInput) {
      el.sessionIdInput.value = targetSession.id;
    }
  }

  saveSessions();
  renderAdminTables(el);
  if (el.trainingMonthSelect && el.trainingMonthSelect.value) {
    updateSessionSelectForMonth(el.trainingMonthSelect.value, el);
  }

  updateCapacityInfo(targetSession, el);

  messageEl.textContent = 'Training session saved.';
  messageEl.classList.add('success');
}

function handleEditSessionClick(sessionId, el) {
  const session = trainingSessions.find((s) => s.id === sessionId);
  if (!session) return;

  if (el.sessionIdInput) el.sessionIdInput.value = session.id;
  if (el.dateInput) el.dateInput.value = session.date || '';

  if (el.timeSelect) {
    buildTimeOptions(el.timeSelect);
    el.timeSelect.value = session.time || '';
    if (session.time && el.timeSelect.value !== session.time) {
      const opt = document.createElement('option');
      opt.value = session.time;
      opt.textContent = session.time;
      el.timeSelect.appendChild(opt);
      el.timeSelect.value = session.time;
    }
  }

  if (el.poolSelect) {
    el.poolSelect.value = session.pool || '';
    if (session.pool && el.poolSelect.value !== session.pool) {
      const opt = document.createElement('option');
      opt.value = session.pool;
      opt.textContent = session.pool;
      el.poolSelect.appendChild(opt);
      el.poolSelect.value = session.pool;
    }
  }

  if (el.addressInput) el.addressInput.value = session.address || '';
  if (el.capacityInput) {
    el.capacityInput.value =
      session.capacity != null ? String(session.capacity) : '';
  }
  if (el.notesInput) el.notesInput.value = session.notes || '';

  updateCapacityInfo(session, el);
  if (el.dateInput) el.dateInput.focus();
}

function handleDeleteSessionClick(sessionId, el) {
  const idx = trainingSessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;

  const session = trainingSessions[idx];
  const taken = Array.isArray(session.attendees)
    ? session.attendees.length
    : 0;

  const confirmMsg = `Delete ${formatDateNice(session.date)} ${
    session.time || ''
  } at ${session.pool || 'this location'}?\n\nThis will also remove ${taken} existing sign‑up(s).`;
  if (!window.confirm(confirmMsg)) {
    return;
  }

  trainingSessions.splice(idx, 1);
  saveSessions();
  renderAdminTables(el);

  if (el.sessionIdInput && el.sessionIdInput.value === sessionId) {
    el.sessionIdInput.value = '';
    if (el.dateInput) el.dateInput.value = '';
    if (el.timeSelect) el.timeSelect.value = '';
    if (el.poolSelect) el.poolSelect.value = '';
    if (el.addressInput) el.addressInput.value = '';
    if (el.capacityInput) el.capacityInput.value = '';
    if (el.notesInput) el.notesInput.value = '';
    updateCapacityInfo(null, el);
  }

  if (el.trainingMonthSelect && el.trainingMonthSelect.value) {
    updateSessionSelectForMonth(el.trainingMonthSelect.value, el);
  }
}

function setupAdmin(el) {
  if (!el.scheduleSection || !el.saveSessionBtn) return;

  buildTimeOptions(el.timeSelect);

  el.saveSessionBtn.addEventListener('click', () => {
    handleSaveSession(el);
  });

  el.scheduleSection.addEventListener('click', (evt) => {
    const editBtn = evt.target.closest('.edit-training-btn');
    if (editBtn) {
      const id = editBtn.dataset.sessionId;
      if (id) handleEditSessionClick(id, el);
      return;
    }

    const deleteBtn = evt.target.closest('.delete-training-btn');
    if (deleteBtn) {
      const id = deleteBtn.dataset.sessionId;
      if (id) handleDeleteSessionClick(id, el);
    }
  });
}

// ---------- Lifeguard signup handlers ----------

function setupSignup(el) {
  const form = el.signupForm;
  if (!form || !el.trainingMonthSelect || !el.trainingSessionSelect) return;

  el.trainingMonthSelect.addEventListener('change', (evt) => {
    const monthKey = evt.target.value || '';
    updateSessionSelectForMonth(monthKey, el);
  });

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const msgEl = el.signupMessage;
    if (!msgEl) return;

    msgEl.textContent = '';
    msgEl.classList.remove('success', 'error');

    const name = el.guardNameInput?.value.trim();
    const email = el.guardEmailInput?.value.trim();
    const homePool = el.guardPoolInput?.value.trim();
    const monthKey = el.trainingMonthSelect.value;
    const sessionId = el.trainingSessionSelect.value;

    if (!name || !email || !homePool || !monthKey || !sessionId) {
      msgEl.textContent =
        'Please fill out all fields and choose a training session.';
      msgEl.classList.add('error');
      return;
    }

    const session = trainingSessions.find((s) => s.id === sessionId);
    if (!session) {
      msgEl.textContent =
        'That training session could not be found. Please choose another and try again.';
      msgEl.classList.add('error');
      updateSessionSelectForMonth(monthKey, el);
      return;
    }

    const taken = Array.isArray(session.attendees)
      ? session.attendees.length
      : 0;
    const capacity = session.capacity || 0;

    if (capacity && taken >= capacity) {
      msgEl.textContent =
        'Sorry, that session is already full. Please pick another option.';
      msgEl.classList.add('error');
      updateSessionSelectForMonth(monthKey, el);
      return;
    }

    const alreadySignedUp =
      Array.isArray(session.attendees) &&
      session.attendees.some((att) => att.email === email);

    if (alreadySignedUp) {
      msgEl.textContent = 'You are already signed up for this session.';
      msgEl.classList.add('error');
      return;
    }

    const attendee = {
      id: 'att_' + Math.random().toString(36).slice(2, 9),
      name,
      email,
      homePool,
      signupTimestamp: new Date().toISOString()
    };

    if (!Array.isArray(session.attendees)) {
      session.attendees = [];
    }
    session.attendees.push(attendee);

    saveSessions();
    renderAdminTables(el);
    updateSessionSelectForMonth(monthKey, el);

    msgEl.textContent =
      'You are signed up! Your supervisor will see this on the schedule.';
    msgEl.classList.add('success');

    form.reset();
    updateSessionSelectForMonth('', el);
  });
}

// ---------- Supervisor login handlers ----------

function setupLogin(el) {
  const modal = el.loginModal;
  const openBtn = el.openLoginBtn;
  const closeBtn = el.closeLoginBtn;
  const form = el.loginForm;
  const messageEl = el.loginMessage;
  const panel = el.trainingAdminPanel;

  if (!modal || !openBtn || !form || !panel) return;

  function setLoggedIn(loggedIn) {
    try {
      localStorage.setItem(LOGIN_KEY, loggedIn ? 'true' : 'false');
    } catch (err) {
      console.error('Unable to persist supervisor login flag:', err);
    }
    panel.style.display = loggedIn ? 'block' : 'none';
    openBtn.textContent = loggedIn ? 'Supervisor Panel' : 'Supervisor Login';
  }

  function openModal() {
    modal.style.display = 'flex';
    if (messageEl) {
      messageEl.textContent = '';
      messageEl.classList.remove('success', 'error');
    }
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  const wasLoggedIn = localStorage.getItem(LOGIN_KEY) === 'true';
  setLoggedIn(wasLoggedIn);

  openBtn.addEventListener('click', () => {
    if (localStorage.getItem(LOGIN_KEY) === 'true') {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      openModal();
    }
  });

  closeBtn?.addEventListener('click', () => {
    closeModal();
  });

  modal.addEventListener('click', (evt) => {
    if (evt.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const username =
      document.getElementById('trainingUsername')?.value.trim() || '';
    const password =
      document.getElementById('trainingPassword')?.value.trim() || '';

    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.classList.remove('success', 'error');

    // TODO: replace these placeholders with your actual supervisor credentials / logic
    const valid =
      (username === 'supervisor' && password === 'training2025') ||
      (username === 'admin' && password === 'chem');

    if (!valid) {
      messageEl.textContent = 'Invalid username or passcode.';
      messageEl.classList.add('error');
      return;
    }

    setLoggedIn(true);
    closeModal();
  });
}

// ---------- Bootstrapping ----------

document.addEventListener('DOMContentLoaded', () => {
  const el = {
    trainingAdminPanel: document.getElementById('trainingAdminPanel'),
    openLoginBtn: document.getElementById('openTrainingLoginBtn'),
    loginModal: document.getElementById('trainingLoginModal'),
    loginForm: document.getElementById('trainingLoginForm'),
    loginMessage: document.getElementById('trainingLoginMessage'),
    closeLoginBtn: document.getElementById('closeTrainingLoginModal'),

    signupForm: document.getElementById('trainingSignupForm'),
    signupMessage: document.getElementById('signupMessage'),
    trainingMonthSelect: document.getElementById('trainingMonth'),
    trainingSessionSelect: document.getElementById('trainingSession'),
    guardNameInput: document.getElementById('guardName'),
    guardEmailInput: document.getElementById('guardEmail'),
    guardPoolInput: document.getElementById('guardPool'),

    dateInput: document.getElementById('trainingDateInput'),
    timeSelect: document.getElementById('trainingTimeSelect'),
    poolSelect: document.getElementById('trainingPoolSelect'),
    addressInput: document.getElementById('trainingAddressInput'),
    capacityInput: document.getElementById('trainingCapacityInput'),
    capacityInfo: document.getElementById('trainingCapacityInfo'),
    notesInput: document.getElementById('trainingNotesInput'),
    sessionIdInput: document.getElementById('trainingSessionId'),
    saveSessionBtn: document.getElementById('saveTrainingSessionBtn'),
    scheduleSection: document.getElementById('scheduleTrainingsSection'),
    adminMessage: document.getElementById('adminMessage'),

    mayBody: document.getElementById('trainingSessionsMayBody'),
    juneBody: document.getElementById('trainingSessionsJuneBody'),
    julyBody: document.getElementById('trainingSessionsJulyBody')
  };

  trainingSessions = loadSessions();

  setupLogin(el);
  renderAdminTables(el);
  updateCapacityInfo(null, el);
  setupAdmin(el);
  setupSignup(el);

  // Initialise the session dropdown based on any pre-selected month
  if (el.trainingMonthSelect && el.trainingMonthSelect.value) {
    updateSessionSelectForMonth(el.trainingMonthSelect.value, el);
  } else {
    updateSessionSelectForMonth('', el);
  }
});

window.addEventListener('load', () => {
  document.body.classList.add('page-loaded');
});
