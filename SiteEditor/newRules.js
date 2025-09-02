import { app, db, doc, setDoc } from '../firebase.js'; // ✅ adjust path to point to the shared module

// --- DOMContentLoaded ---
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
    const show = (el) => { if (el) el.style.display = "block"; };
    const hide = (el) => { if (el) el.style.display = "none"; };

    // --- Initial State ---
    hide(newPoolSection);
    hide(feedbackEditorSection);
    hide(secondaryPoolSection);

    // --- Show/Hide Logic ---
    if (addPoolBtn && newPoolSection && feedbackEditorSection) {
        addPoolBtn.addEventListener("click", () => {
            show(newPoolSection);
            hide(feedbackEditorSection);
        });
    }

    if (poolSelect && feedbackEditorSection) {
        poolSelect.addEventListener("change", () => {
            if (poolSelect.value) {
                show(feedbackEditorSection);
            } else {
                hide(feedbackEditorSection);
            }
        });
    }

    if (secondaryPoolCheckbox && secondaryPoolSection) {
        secondaryPoolCheckbox.addEventListener("change", () => {
            if (secondaryPoolCheckbox.checked) {
                show(secondaryPoolSection);
            } else {
                hide(secondaryPoolSection);
            }
        });
    }

    // --- Save Main Pool Settings ---
    if (saveRulesBtnOne && (poolSelect || newPoolName)) {
        saveRulesBtnOne.addEventListener("click", async () => {
            const poolName = (poolSelect && poolSelect.value) || (newPoolName && newPoolName.value.trim());
            const shape = poolShape ? poolShape.value : "";

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
    }

    // --- Save Secondary Pool Settings ---
    if (saveRulesBtnTwo && poolSelect) {
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
    }

    // --- Acceptable Checkbox Logic ---
    document.querySelectorAll(".sanitation-checkbox").forEach((chk) => {
        chk.addEventListener("change", (e) => {
            const row = e.target.closest("tr");
            const input = row ? row.querySelector(".adjustment-feedback") : null;
            if (input) {
                if (e.target.checked) {
                    input.disabled = true;
                    input.classList.add("disabled-input");
                } else {
                    input.disabled = false;
                    input.classList.remove("disabled-input");
                }
            }
        });
    });
});
