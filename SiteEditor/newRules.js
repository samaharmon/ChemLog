import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firestore instance (firebaseApp already initialized in HTML)
const db = getFirestore();

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

  // --- Helpers ---
  const show = (el) => (el.style.display = "block");
  const hide = (el) => (el.style.display = "none");

  // --- Initial State ---
  hide(newPoolSection);
  hide(feedbackEditorSection);
  hide(secondaryPoolSection);

  // --- Show/Hide Logic ---
  addPoolBtn.addEventListener("click", () => {
    show(newPoolSection);
    hide(feedbackEditorSection);
  });

  poolSelect.addEventListener("change", () => {
    if (poolSelect.value) {
      show(feedbackEditorSection);
    } else {
      hide(feedbackEditorSection);
    }
  });

  secondaryPoolCheckbox.addEventListener("change", () => {
    if (secondaryPoolCheckbox.checked) {
      show(secondaryPoolSection);
    } else {
      hide(secondaryPoolSection);
    }
  });

  // --- Save Main Pool Settings ---
  saveRulesBtnOne.addEventListener("click", async () => {
    const poolName = poolSelect.value || newPoolName.value.trim();
    const shape = poolShape.value;

    if (!poolName) {
      alert("Please enter a pool name or select one.");
      return;
    }

    try {
      await setDoc(doc(db, "pools", poolName), {
        shape: shape,
        updatedAt: new Date(),
      });
      alert(`Saved settings for ${poolName}`);
      show(feedbackEditorSection);
    } catch (err) {
      console.error("Error saving main pool:", err);
      alert("Error saving pool settings.");
    }
  });

  // --- Save Secondary Pool Settings ---
  saveRulesBtnTwo.addEventListener("click", async () => {
    const poolName = poolSelect.value;
    if (!poolName) {
      alert("Select a pool first.");
      return;
    }

    try {
      await setDoc(doc(db, "pools", `${poolName}_secondary`), {
        secondary: true,
        updatedAt: new Date(),
      });
      alert(`Saved secondary pool settings for ${poolName}`);
    } catch (err) {
      console.error("Error saving secondary pool:", err);
      alert("Error saving secondary pool settings.");
    }
  });

  // --- Acceptable Checkbox Logic ---
  document.querySelectorAll(".sanitation-checkbox").forEach((chk) => {
    chk.addEventListener("change", (e) => {
      const row = e.target.closest("tr");
      const input = row.querySelector(".adjustment-feedback");
      if (e.target.checked) {
        input.disabled = true;
        input.classList.add("disabled-input");
      } else {
        input.disabled = false;
        input.classList.remove("disabled-input");
      }
    });
  });
});
