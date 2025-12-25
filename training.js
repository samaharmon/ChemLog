// training.js (ES module)

// TODO: Update these to match the supervisor credentials you use on index.html
const TRAINING_SUPERVISOR_USERNAME = 'supervisor';
const TRAINING_SUPERVISOR_PASSCODE = 'password123';

const TRAINING_CONFIG_KEY = 'chemlog_training_config';
const TRAINING_ADMIN_KEY = 'chemlog_training_admin_logged_in';
const TRAINING_SIGNUPS_KEY = 'chemlog_training_signups';

let trainingConfig = {
  may: [],
  june: [],
  july: [],
};

let isTrainingAdmin = false;

// ===== Helpers =====

function loadTrainingConfig() {
  try {
    const raw = localStorage.getItem(TRAINING_CONFIG_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      trainingConfig = {
        may: Array.isArray(obj.may) ? obj.may : [],
        june: Array.isArray(obj.june) ? obj.june : [],
        july: Array.isArray(obj.july) ? obj.july : [],
      };
    }
  } catch (err) {
    console.error('Error loading training config:', err);
  }
}

function saveTrainingConfig() {
  try {
    localStorage.setItem(TRAINING_CONFIG_KEY, JSON.stringify(trainingConfig));
  } catch (err) {
    console.error('Error saving training config:', err);
  }
}

function loadAdminStatus() {
  try {
    const raw = localStorage.getItem(TRAINING_ADMIN_KEY);
    isTrainingAdmin = raw === 'true';
  } catch {
    isTrainingAdmin = false;
  }
}

function saveAdminStatus() {
  try {
    localStorage.setItem(TRAINING_ADMIN_KEY, isTrainingAdmin ? 'true' : 'false');
  } catch {}
}

function loadSignups() {
  try {
    const raw = localStorage.getItem(TRAINING_SIGNUPS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSignups(list) {
  try {
    localStorage.setItem(TRAINING_SIGNUPS_KEY, JSON.stringify(list || []));
  } catch (err) {
    console.error('Error saving training signups:', err);
  }
}

// ===== Admin UI rendering =====

function renderSessionLists() {
  const monthKeys = ['may', 'june', 'july'];
  monthKeys.forEach((month) => {
    const listEl = document.getElementById(`${month}SessionList`);
    if (!listEl) return;
    const sessions = trainingConfig[month] || [];

    listEl.innerHTML = '';
    if (!sessions.length) {
      const p = document.createElement('p');
      p.textContent = 'No sessions configured yet.';
      p.style.fontStyle = 'italic';
      p.style.fontSize = '0.85rem';
      listEl.appendChild(p);
      return;
    }

    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'training-session-item';
      item.textContent = `${session.date} • ${session.time} • ${session.location}`;
      listEl.appendChild(item);
    });
  });
}

function renderSessionOptionsForSignup() {
  const monthSelect = document.getElementById('trainingMonth');
  const sessionSelect = document.getElementById('trainingSession');
  if (!monthSelect || !sessionSelect) return;

  const monthValue = monthSelect.value;
  sessionSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a session';
  sessionSelect.appendChild(placeholder);

  if (!monthValue) return;

  const sessions = trainingConfig[monthValue] || [];
  sessions.forEach((session, idx) => {
    const opt = document.createElement('option');
    opt.value = `${monthValue}:${idx}`;
    opt.textContent = `${session.date} • ${session.time} • ${session.location}`;
    sessionSelect.appendChild(opt);
  });
}

// ===== Admin panel visibility =====

function updateAdminPanelVisibility() {
  const panel = document.getElementById('trainingAdminPanel');
  if (!panel) return;
  panel.style.display = isTrainingAdmin ? '' : 'none';
}

// ===== Modal helpers =====

function openTrainingLoginModal() {
  const modal = document.getElementById('trainingLoginModal');
  if (modal) {
    modal.classList.add('show');
  }
}

function closeTrainingLoginModal() {
  const modal = document.getElementById('trainingLoginModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// ===== Event wiring =====

function initTrainingPage() {
  loadTrainingConfig();
  loadAdminStatus();
  updateAdminPanelVisibility();
  renderSessionLists();

  // Supervisor login button
  const openLoginBtn = document.getElementById('openTrainingLoginBtn');
  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', () => {
      openTrainingLoginModal();
    });
  }

  const closeModalBtn = document.getElementById('closeTrainingLoginModal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      closeTrainingLoginModal();
    });
  }

  // Login form
  const loginForm = document.getElementById('trainingLoginForm');
  const loginMessage = document.getElementById('trainingLoginMessage');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = document.getElementById('trainingUsername')?.value.trim();
      const pass = document.getElementById('trainingPassword')?.value.trim();

      if (
        user === TRAINING_SUPERVISOR_USERNAME &&
        pass === TRAINING_SUPERVISOR_PASSCODE
      ) {
        isTrainingAdmin = true;
        saveAdminStatus();
        updateAdminPanelVisibility();
        if (loginMessage) {
          loginMessage.textContent = 'Login successful.';
          loginMessage.className = 'form-message success';
        }
        setTimeout(() => {
          closeTrainingLoginModal();
          if (loginMessage) {
            loginMessage.textContent = '';
            loginMessage.className = 'form-message';
          }
        }, 800);
      } else {
        if (loginMessage) {
          loginMessage.textContent = 'Invalid credentials.';
          loginMessage.className = 'form-message error';
        }
      }
    });
  }

  // Month change -> reload sessions
  const monthSelect = document.getElementById('trainingMonth');
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      renderSessionOptionsForSignup();
    });
  }

  // Lifeguard signup form
  const signupForm = document.getElementById('trainingSignupForm');
  const signupMessage = document.getElementById('signupMessage');

  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('guardName')?.value.trim();
      const email = document.getElementById('guardEmail')?.value.trim();
      const pool = document.getElementById('guardPool')?.value.trim();
      const month = document.getElementById('trainingMonth')?.value;
      const sessionValue = document.getElementById('trainingSession')?.value;

      if (!name || !email || !pool || !month || !sessionValue) {
        if (signupMessage) {
          signupMessage.textContent = 'Please complete all fields.';
          signupMessage.className = 'form-message error';
        }
        return;
      }

      const [sessionMonth, sessionIndexStr] = sessionValue.split(':');
      const sessionIndex = parseInt(sessionIndexStr, 10);
      const session =
        trainingConfig[sessionMonth] && trainingConfig[sessionMonth][sessionIndex];

      if (!session) {
        if (signupMessage) {
          signupMessage.textContent = 'Selected session is invalid.';
          signupMessage.className = 'form-message error';
        }
        return;
      }

      const signups = loadSignups();
      signups.push({
        name,
        email,
        pool,
        month: sessionMonth,
        session,
        submittedAt: new Date().toISOString(),
      });
      saveSignups(signups);

      signupForm.reset();
      renderSessionOptionsForSignup(); // reset session dropdown

      if (signupMessage) {
        signupMessage.textContent = 'Signup submitted!';
        signupMessage.className = 'form-message success';
      }
      setTimeout(() => {
        if (signupMessage) {
          signupMessage.textContent = '';
          signupMessage.className = 'form-message';
        }
      }, 1500);
    });
  }

  // Admin forms for each month
  const monthConfigs = [
    { key: 'may', formId: 'maySessionForm', dateId: 'mayDate', timeId: 'mayTime', locId: 'mayLocation' },
    { key: 'june', formId: 'juneSessionForm', dateId: 'juneDate', timeId: 'juneTime', locId: 'juneLocation' },
    { key: 'july', formId: 'julySessionForm', dateId: 'julyDate', timeId: 'julyTime', locId: 'julyLocation' },
  ];

  monthConfigs.forEach(({ key, formId, dateId, timeId, locId }) => {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isTrainingAdmin) {
        alert('Supervisor login required to edit training schedule.');
        return;
      }

      const date = document.getElementById(dateId)?.value;
      const time = document.getElementById(timeId)?.value;
      const location = document.getElementById(locId)?.value.trim();

      if (!date || !time || !location) {
        alert('Please complete all session fields.');
        return;
      }

      trainingConfig[key] = trainingConfig[key] || [];
      trainingConfig[key].push({ date, time, location });
      saveTrainingConfig();
      renderSessionLists();
      renderSessionOptionsForSignup();

      form.reset();
    });
  });

  // Save configuration button
  const saveBtn = document.getElementById('saveTrainingConfigBtn');
  const adminMessage = document.getElementById('adminMessage');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!isTrainingAdmin) {
        alert('Supervisor login required to save training schedule.');
        return;
      }
      saveTrainingConfig();
      if (adminMessage) {
        adminMessage.textContent = 'Training schedule saved.';
        adminMessage.className = 'form-message success';
      }
      setTimeout(() => {
        if (adminMessage) {
          adminMessage.textContent = '';
          adminMessage.className = 'form-message';
        }
      }, 1500);
    });
  }

  // Initialize signup session options based on current config
  renderSessionOptionsForSignup();
}

document.addEventListener('DOMContentLoaded', initTrainingPage);
