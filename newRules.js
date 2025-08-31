// Initialize after DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Firebase reference
  const db = firebase.database();

  // DOM elements
  const addPoolBtn = document.getElementById("addPoolBtn");
  const poolSelect = document.getElementById("poolLocation");

  const newPoolSection = document.getElementById("newPoolSection");
  const feedbackEditorSection = document.getElementById("feedbackEditorSection");

  const secondaryPoolCheckbox = document.getElementById("secondaryPoolCheckbox");
  const secondaryPoolSection = document.getElementById("secondaryPoolSection");

  const saveNewPoolBtn = document.getElementById("saveRulesBtnOne");

  // ----- Hide sections initially -----
  newPoolSection.classList.add("hidden");
  feedbackEditorSection.classList.add("hidden");
  secondaryPoolSection.classList.add("hidden");

  // ----- Add New Pool Button -----
  addPoolBtn.addEventListener("click", () => {
    newPoolSection.classList.remove("hidden");
    feedbackEditorSection.classList.add("hidden");
  });

  // ----- Pool Selection Change -----
  poolSelect.addEventListener("change", () => {
    const poolName = poolSelect.value;
    if (!poolName) {
      feedbackEditorSection.classList.add("hidden");
      return;
    }
    newPoolSection.classList.add("hidden");
    feedbackEditorSection.classList.remove("hidden");
    loadPoolRules(poolName);
  });

  // ----- Save New Pool -----
  saveNewPoolBtn.addEventListener("click", async () => {
    const poolName = document.getElementById("newPoolName").value.trim();
    if (!poolName) return alert("Enter a pool name.");
    try {
      await db.ref("pools/" + poolName).set({
        name: poolName,
        rules: { main: [], secondary: [] }
      });
      alert("New pool saved!");
      newPoolSection.classList.add("hidden");
      feedbackEditorSection.classList.remove("hidden");
      poolSelect.value = poolName;
      loadPoolRules(poolName);
    } catch (err) {
      console.error("Error saving pool:", err);
      alert("Error saving pool. Check console.");
    }
  });

  // ----- Secondary Pool Checkbox Toggle -----
  secondaryPoolCheckbox.addEventListener("change", () => {
    if (secondaryPoolCheckbox.checked) {
      secondaryPoolSection.classList.remove("hidden");
    } else {
      secondaryPoolSection.classList.add("hidden");
    }
  });

  // ----- Load Pool Rules -----
  async function loadPoolRules(poolName) {
    const snapshot = await db.ref("pools/" + poolName).once("value");
    const data = snapshot.val();
    if (!data) return;

    feedbackEditorSection.querySelectorAll("table.rules-table").forEach(table => {
      table.querySelectorAll("tr").forEach((row, idx) => {
        const checkbox = row.querySelector("input.sanitation-checkbox");
        const textInput = row.querySelector("input.adjustment-feedback");
        if (!checkbox || !textInput) return;

        // Determine main or secondary
        const poolType = table.closest(".pool-section").id.includes("Main") ? "main" : "secondary";
        const ruleData = data.rules?.[poolType]?.[idx] || {};

        checkbox.checked = ruleData.acceptable || false;
        textInput.value = ruleData.feedback || "";
        textInput.disabled = checkbox.checked;
        textInput.style.backgroundColor = checkbox.checked ? "#eee" : "#fff";

        // Add change listener for "acceptable" checkbox
        checkbox.onchange = async () => {
          textInput.disabled = checkbox.checked;
          textInput.style.backgroundColor = checkbox.checked ? "#eee" : "#fff";

          await db.ref(`pools/${poolName}/rules/${poolType}/${idx}`).update({
            feedback: textInput.value,
            acceptable: checkbox.checked
          });
        };

        // Add Edit/Save button if not present
        if (!row.querySelector("button.editAndSave")) {
          const editBtn = document.createElement("button");
          editBtn.textContent = "Edit";
          editBtn.className = "editAndSave";

          editBtn.addEventListener("click", async () => {
            if (editBtn.textContent === "Edit") {
              textInput.disabled = false;
              textInput.style.backgroundColor = "#fff";
              editBtn.textContent = "Save";
            } else {
              await db.ref(`pools/${poolName}/rules/${poolType}/${idx}`).set({
                feedback: textInput.value,
                acceptable: checkbox.checked
              });
              textInput.disabled = checkbox.checked;
              textInput.style.backgroundColor = checkbox.checked ? "#eee" : "#fff";
              editBtn.textContent = "Edit";
            }
          });

          row.appendChild(editBtn);
        }
      });
    });
  }

  // ----- Initialize Pool List -----
  async function loadPools() {
    const snapshot = await db.ref("pools").once("value");
    poolSelect.innerHTML = `<option value="">Select</option>`;
    snapshot.forEach(child => {
      const option = document.createElement("option");
      option.value = child.key;
      option.textContent = child.key;
      poolSelect.appendChild(option);
    });
  }

  loadPools();
});
