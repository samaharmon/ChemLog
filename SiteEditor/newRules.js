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
