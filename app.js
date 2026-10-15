(() => {
  const amount = document.querySelector("#amount");
  const inputUnit = document.querySelector("#input-unit");
  const outputUnit = document.querySelector("#output-unit");
  const outputUnitLabel = document.querySelector("#output-unit-label");
  const amountLabel = document.querySelector("#amount-label");
  const inputUnitLabel = document.querySelector("#input-unit-label");
  const resultLabel = document.querySelector("#result-label");
  const resultValue = document.querySelector("#result-value");
  const secondaryLabel = document.querySelector("#secondary-label");
  const secondaryValue = document.querySelector("#secondary-value");
  const formula = document.querySelector("#formula");
  const ratioSummary = document.querySelector("#ratio-summary");
  const amountError = document.querySelector("#amount-error");
  const announcement = document.querySelector("#announcement");
  const tasteResult = document.querySelector("#taste-result");
  const tasteGuidance = document.querySelector("#taste-guidance");
  const brewNote = document.querySelector("#brew-note");
  const noteStatus = document.querySelector("#note-status");
  const saveBrewButton = document.querySelector("#save-brew");
  const historyList = document.querySelector("#history-list");
  const emptyHistory = document.querySelector("#empty-history");
  const clearHistoryButton = document.querySelector("#clear-history");
  const historyStatus = document.querySelector("#history-status");
  const undoBar = document.querySelector("#undo-bar");
  const undoButton = document.querySelector("#undo-delete");
  const exportButton = document.querySelector("#export-history");
  const importButton = document.querySelector("#import-history");
  const copySheetsButton = document.querySelector("#copy-sheets");
  const downloadCsvButton = document.querySelector("#download-csv");
  const sheetsHelp = document.querySelector("#sheets-help");
  const importFile = document.querySelector("#import-file");
  const knownInputs = [...document.querySelectorAll('input[name="known"]')];
  const ratioInputs = [...document.querySelectorAll('input[name="ratio"]')];
  const concentrationInputs = [...document.querySelectorAll('input[name="concentration"]')];
  let announceTimer;
  let noteSaveTimer;
  let currentRecipe = null;

  const units = {
    coffee: [
      { id: "g", label: "grams (g)", toGrams: 1 },
      { id: "oz", label: "ounces by weight (oz)", toGrams: 28.349523125 }
    ],
    water: [
      { id: "g", label: "grams (g)", toGrams: 1 },
      { id: "oz", label: "ounces by weight (oz)", toGrams: 28.349523125 },
      { id: "ml", label: "milliliters (mL)", toGrams: 1 },
      { id: "floz", label: "US fluid ounces (fl oz)", toGrams: 29.5735295625 }
    ]
  };
  units.cup = units.water;
  const waterRetention = 2.1;

  const known = () => document.querySelector('input[name="known"]:checked').value;
  const ratio = () => Number(document.querySelector('input[name="ratio"]:checked').value);
  const noteStorageKey = "pour-over-live-brew-note-v1";
  const historyStorageKey = "pour-over-live-brew-history-v1";
  const tasteLabels = Object.fromEntries([...tasteResult.options].filter((option) => option.value).map((option) => [option.value, option.textContent]));

  const corruptBackupKey = "pour-over-live-brew-history-corrupt-backup";
  const maxNote = 2000;
  const maxImportBytes = 1024 * 1024;
  let lastDeleted = null;

  // Unreadable history is copied aside before anything can overwrite it.
  function readHistory() {
    let raw = null;
    try {
      raw = localStorage.getItem(historyStorageKey);
      const stored = JSON.parse(raw || "[]");
      if (Array.isArray(stored)) return stored.filter((entry) => entry && typeof entry === "object");
    } catch {}
    try {
      if (raw && !localStorage.getItem(corruptBackupKey)) localStorage.setItem(corruptBackupKey, raw);
    } catch {}
    return [];
  }

  function writeHistory(entries) {
    localStorage.setItem(historyStorageKey, JSON.stringify(entries));
  }

  function renderHistory() {
    const entries = readHistory();
    historyList.replaceChildren();
    emptyHistory.hidden = entries.length > 0;
    clearHistoryButton.hidden = entries.length === 0;
    exportButton.hidden = entries.length === 0;
    [copySheetsButton, downloadCsvButton, sheetsHelp].forEach((el) => { el.hidden = entries.length === 0; });
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "history-item";
      const header = document.createElement("div");
      header.className = "history-header";
      const heading = document.createElement("p");
      const time = new Date(entry.createdAt);
      heading.textContent = `1 : ${Number(entry.ratio)} · ${Number(entry.coffeeGrams).toFixed(1)} g coffee · ${Number(entry.waterGrams).toFixed(0)} g water`;
      const date = document.createElement("p");
      date.className = "hint";
      date.textContent = Number.isNaN(time.getTime()) ? "Saved brew" : time.toLocaleString();
      const remove = document.createElement("button");
      remove.className = "delete-button";
      remove.type = "button";
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", `Delete brew at 1 to ${Number(entry.ratio)}, ${date.textContent}`);
      remove.addEventListener("click", () => deleteHistoryEntry(entry.id));
      header.append(heading, remove);
      item.append(header, date);
      const taste = document.createElement("p");
      taste.textContent = entry.taste ? `Taste: ${(Object.hasOwn(tasteLabels, entry.taste) ? tasteLabels[entry.taste] : entry.taste)}` : "Taste: not recorded";
      item.append(taste);
      if (entry.note) {
        const note = document.createElement("p");
        note.textContent = `Note: ${entry.note}`;
        item.append(note);
      }
      historyList.append(item);
    });
  }

  function deleteHistoryEntry(id) {
    try {
      const all = readHistory();
      const index = all.findIndex((entry) => entry.id === id);
      if (index < 0) return;
      lastDeleted = { entry: all[index], index };
      writeHistory(all.filter((entry) => entry.id !== id));
      renderHistory();
      undoBar.hidden = false;
      historyStatus.textContent = "Brew deleted from this device. Undo is available.";
      undoButton.focus();
    } catch {
      historyStatus.textContent = "Could not update brew history.";
    }
  }

  function undoDelete() {
    if (!lastDeleted) return;
    try {
      const all = readHistory();
      all.splice(Math.min(lastDeleted.index, all.length), 0, lastDeleted.entry);
      writeHistory(all);
      lastDeleted = null;
      undoBar.hidden = true;
      renderHistory();
      historyStatus.textContent = "Brew restored.";
    } catch {
      historyStatus.textContent = "Could not restore that brew.";
    }
  }

  function cleanEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const number = (value, min, max) => (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null);
    const ratioValue = number(raw.ratio, 1, 100);
    const coffeeGrams = number(raw.coffeeGrams, 0.000001, 50000);
    const waterGrams = number(raw.waterGrams, 0.000001, 500000);
    const created = typeof raw.createdAt === "string" ? new Date(raw.createdAt) : null;
    if (ratioValue === null || coffeeGrams === null || waterGrams === null || !created || Number.isNaN(created.getTime())) return null;
    if (typeof raw.id !== "string" || raw.id.length === 0 || raw.id.length > 64) return null;
    return {
      id: raw.id,
      ratio: ratioValue,
      coffeeGrams,
      waterGrams,
      mode: ["coffee", "water", "cup"].includes(raw.mode) ? raw.mode : "water",
      finishedCapacityGrams: number(raw.finishedCapacityGrams, 0, 500000),
      taste: typeof raw.taste === "string" && (raw.taste === "" || Object.hasOwn(tasteLabels, raw.taste)) ? raw.taste : "",
      note: typeof raw.note === "string" ? raw.note.slice(0, maxNote) : "",
      createdAt: created.toISOString()
    };
  }

  function exportHistory() {
    const entries = readHistory();
    if (entries.length === 0) return;
    const payload = { app: "pour-over-live-brew", version: 1, exportedAt: new Date().toISOString(), entries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pour-over-brews-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    historyStatus.textContent = `Backup downloaded with ${entries.length} ${entries.length === 1 ? "brew" : "brews"}.`;
  }

  const sheetHeader = ["Date", "Coffee (g)", "Water (g)", "Ratio (1:x)", "Mode", "Taste", "Note"];

  function sheetDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // A leading = + - @ tab or CR would run as a formula in a spreadsheet; an apostrophe keeps it text.
  const safeText = (value) => {
    const text = typeof value === "string" ? value : "";
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  };

  function sheetRows() {
    return readHistory().map((entry) => {
      const num = (value, digits) => {
        const n = value === null || value === "" ? NaN : Number(value);
        return Number.isFinite(n) ? String(Number(n.toFixed(digits))) : "";
      };
      return [
        sheetDate(entry.createdAt),
        num(entry.coffeeGrams, 1),
        num(entry.waterGrams, 0),
        num(entry.ratio, 0),
        typeof entry.mode === "string" ? entry.mode : "",
        safeText(Object.hasOwn(tasteLabels, entry.taste) ? tasteLabels[entry.taste] : ""),
        safeText(entry.note)
      ];
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => false);
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    area.remove();
    return Promise.resolve(ok);
  }

  function copyForSheets() {
    const rows = sheetRows();
    if (rows.length === 0) return;
    const clean = (cell) => String(cell).replace(/[\t\r\n]+/g, " ");
    const text = [sheetHeader, ...rows].map((row) => row.map(clean).join("\t")).join("\n");
    copyText(text).then((ok) => {
      historyStatus.textContent = ok
        ? `Copied ${rows.length} ${rows.length === 1 ? "brew" : "brews"}. Paste into a Google Sheet.`
        : "Copy was blocked. Use Download spreadsheet instead.";
    });
  }

  function downloadCsv() {
    const rows = sheetRows();
    if (rows.length === 0) return;
    const quote = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csv = "﻿" + [sheetHeader, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pour-over-brews-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    historyStatus.textContent = `Spreadsheet downloaded with ${rows.length} ${rows.length === 1 ? "brew" : "brews"}.`;
  }

  function importHistory(file) {
    if (!file) return;
    if (file.size > maxImportBytes) {
      historyStatus.textContent = "File too large (limit 1 MB).";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("error", () => { historyStatus.textContent = "Could not read that file."; });
    reader.addEventListener("load", () => {
      let data;
      try {
        data = JSON.parse(String(reader.result));
      } catch {
        historyStatus.textContent = "That file isn't a pour-over backup.";
        return;
      }
      if (!data || data.app !== "pour-over-live-brew" || !Array.isArray(data.entries)) {
        historyStatus.textContent = "That file isn't a pour-over backup.";
        return;
      }
      if (data.version !== 1) {
        historyStatus.textContent = "Backup is from a newer version of this page.";
        return;
      }
      try {
        const existing = readHistory();
        const known = new Set(existing.map((entry) => entry.id));
        let added = 0;
        let skipped = 0;
        data.entries.forEach((raw) => {
          const entry = cleanEntry(raw);
          if (!entry || known.has(entry.id)) { skipped += 1; return; }
          known.add(entry.id);
          existing.push(entry);
          added += 1;
        });
        existing.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        writeHistory(existing);
        renderHistory();
        historyStatus.textContent = `Added ${added}, skipped ${skipped} already here or unreadable.`;
      } catch {
        historyStatus.textContent = "Not saved, storage is full. Download a backup first.";
      }
    });
    reader.readAsText(file);
  }

  function saveCurrentBrew() {
    if (!currentRecipe) {
      historyStatus.textContent = "Enter a valid amount before saving this brew.";
      return;
    }
    const entry = {
      ...currentRecipe,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taste: tasteResult.value,
      note: brewNote.value.trim(),
      createdAt: new Date().toISOString()
    };
    try {
      const entries = readHistory();
      entries.unshift(entry);
      writeHistory(entries);
      lastDeleted = null;
      undoBar.hidden = true;
      renderHistory();
      clearTimeout(noteSaveTimer);
      brewNote.value = "";
      tasteResult.value = "";
      updateTasteGuidance();
      try { localStorage.removeItem(noteStorageKey); } catch {}
      noteStatus.textContent = "";
      historyStatus.textContent = entries.length === 5
        ? "Brew saved on this device. You have 5 brews now. Back up your log under Back up or restore."
        : "Brew saved on this device.";
    } catch {
      historyStatus.textContent = "Brew could not be saved in this browser.";
    }
  }

  function updateTasteGuidance() {
    const ratioNumber = ratio();
    const guidance = {
      "": "Choose a taste to see one specific starting suggestion.",
      weak: ratioNumber > 14
        ? `Try one step stronger next time: change 1 : ${ratioNumber} to 1 : ${ratioNumber - 1}. Keep the other variables steady.`
        : "You're already at 1 : 14. Keep the ratio and try a slightly finer grind next time.",
      sour: "Try a slightly finer grind next time to increase extraction. Keep the ratio the same for a clearer comparison.",
      bitter: "Try a slightly coarser grind next time to reduce extraction. Keep the ratio the same for a clearer comparison.",
      chocolate: "Keep your brew recipe. If topping up brought out chocolate for you, add hot water a little at a time after brewing and measure it separately.",
      good: "Keep this recipe. Change nothing until you want to compare a new version."
    };
    tasteGuidance.textContent = guidance[tasteResult.value];
  }

  function syncConcentrationToRatio() {
    const preferenceByRatio = { "15": "more", "16": "balanced", "17": "less" };
    concentrationInputs.forEach((input) => {
      input.checked = input.value === preferenceByRatio[String(ratio())];
    });
  }

  function setRatioFromConcentration() {
    const ratioByPreference = { more: "15", balanced: "16", less: "17" };
    const selected = document.querySelector('input[name="concentration"]:checked');
    const ratioInput = ratioInputs.find((input) => input.value === ratioByPreference[selected.value]);
    if (ratioInput) ratioInput.checked = true;
    update(true);
    updateTasteGuidance();
  }

  function loadBrewNote() {
    try {
      brewNote.value = localStorage.getItem(noteStorageKey) || "";
    } catch {
      noteStatus.textContent = "Notes cannot be saved in this browser mode.";
    }
  }

  function saveBrewNote() {
    try {
      localStorage.setItem(noteStorageKey, brewNote.value);
      noteStatus.textContent = "Note saved on this device.";
    } catch {
      noteStatus.textContent = "Note could not be saved; copy it before closing this page.";
    }
  }

  function scheduleBrewNoteSave() {
    clearTimeout(noteSaveTimer);
    noteStatus.textContent = "";
    noteSaveTimer = setTimeout(saveBrewNote, 600);
  }

  function fillSelect(select, options, preferred) {
    const old = select.value;
    select.replaceChildren(...options.map((unit) => {
      const option = document.createElement("option");
      option.value = unit.id;
      option.textContent = unit.label;
      return option;
    }));
    select.value = options.some((unit) => unit.id === old) ? old : preferred;
  }

  const getUnit = (list, id) => list.find((unit) => unit.id === id) || list[0];

  function format(value, unit) {
    if (!Number.isFinite(value)) return "—";
    if (unit.id === "g") {
      const rounded = Number(value.toFixed(1));
      return (Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)) + " g";
    }
    if (unit.id === "oz") return value.toFixed(2) + " oz by weight";
    if (unit.id === "ml") return Math.round(value) + " mL";
    return value.toFixed(1) + " US fl oz";
  }

  function sayLater(message) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { announcement.textContent = message; }, 450);
  }

  function update(announce = false) {
    const mode = known();
    const inputOptions = units[mode === "coffee" ? "coffee" : "water"];
    const outputOptions = units[mode === "water" ? "coffee" : "water"];
    fillSelect(inputUnit, inputOptions, mode === "coffee" ? "g" : "floz");
    fillSelect(outputUnit, outputOptions, "g");
    outputUnit.hidden = mode === "cup";
    outputUnitLabel.hidden = mode === "cup";

    const input = getUnit(inputOptions, inputUnit.value);
    const output = getUnit(outputOptions, outputUnit.value);
    const amountValue = Number(amount.value);
    const inputGrams = amountValue * input.toGrams;
    const ratioNumber = ratio();

    amountLabel.textContent = mode === "water" ? "Water amount to brew" : mode === "coffee" ? "Coffee amount" : "Finished mug capacity";
    inputUnitLabel.textContent = mode === "coffee" ? "Coffee unit" : "Mug / water unit";
    resultLabel.textContent = mode === "water" ? "Coffee to weigh" : mode === "coffee" ? "Water to pour" : "Coffee to weigh";
    secondaryLabel.hidden = mode !== "cup";
    secondaryValue.hidden = mode !== "cup";
    document.querySelector("#amount-help").textContent = mode === "cup"
      ? "Enter your mug’s finished capacity. The recipe estimates extra brew water because the grounds retain some."
      : "Enter water poured through the coffee. A scale measures weight; fluid ounces measure volume.";

    if (amount.value.trim() === "") {
      currentRecipe = null;
      amount.removeAttribute("aria-invalid");
      amount.setAttribute("aria-describedby", "amount-help");
      amountError.hidden = true;
      resultValue.textContent = "—";
      secondaryValue.textContent = "—";
      formula.textContent = "Enter an amount to see the calculation.";
      ratioSummary.textContent = "Coffee : water = 1 : " + ratioNumber;
      announcement.textContent = "";
      return;
    }

    const valid = amount.validity.valid && Number.isFinite(inputGrams) && inputGrams > 0 && inputGrams <= 5000;
    if (!valid) {
      currentRecipe = null;
      const message = inputGrams > 5000
        ? "Enter an amount no greater than 5,000 g."
      : amount.validity.rangeUnderflow || amountValue <= 0
          ? "Enter a number greater than 0."
          : "Enter a valid amount.";
      amount.setAttribute("aria-invalid", "true");
      amount.setAttribute("aria-describedby", "amount-help amount-error");
      amountError.textContent = message;
      amountError.hidden = false;
      resultValue.textContent = "Check the amount";
      secondaryValue.textContent = "—";
      formula.textContent = message;
      ratioSummary.textContent = "Coffee : water = 1 : " + ratioNumber;
      if (announce) sayLater(message);
      return;
    }

    amount.removeAttribute("aria-invalid");
    amount.setAttribute("aria-describedby", "amount-help");
    amountError.hidden = true;
    amountError.textContent = "";

    const resultGrams = mode === "water" ? inputGrams / ratioNumber : mode === "coffee" ? inputGrams * ratioNumber : inputGrams / (ratioNumber - waterRetention);
    const result = format(resultGrams / output.toGrams, output);
    const coffeeGrams = mode === "water" ? resultGrams : mode === "coffee" ? inputGrams : resultGrams;
    const waterGrams = mode === "water" ? inputGrams : mode === "coffee" ? resultGrams : coffeeGrams * ratioNumber;
    const shownWater = format(waterGrams, units.water[0]);
    const shownCoffee = format(coffeeGrams, units.coffee[0]);
    currentRecipe = {
      ratio: ratioNumber,
      coffeeGrams,
      waterGrams,
      mode,
      finishedCapacityGrams: mode === "cup" ? inputGrams : null
    };

    resultValue.textContent = mode === "cup" ? shownCoffee : result;
    secondaryValue.textContent = format(waterGrams, { id: "g" }) + " (" + format(waterGrams / units.water[3].toGrams, units.water[3]) + ")";
    formula.textContent = mode === "cup"
      ? "Brew-water amount includes an estimate for water retained by the grounds."
      : mode === "water"
      ? shownWater + " water ÷ " + ratioNumber + " ≈ " + shownCoffee + " coffee"
      : shownCoffee + " coffee × " + ratioNumber + " = " + shownWater + " water";
    ratioSummary.textContent = "Coffee : water = 1 : " + ratioNumber;
    if (announce) sayLater(resultLabel.textContent + ": " + (mode === "cup" ? shownCoffee : result) + (mode === "cup" ? ". Water to pour " + secondaryValue.textContent : "") + ". Coffee to water ratio 1 to " + ratioNumber + ".");
  }

  knownInputs.forEach((input) => input.addEventListener("change", () => update(true)));
  ratioInputs.forEach((input) => input.addEventListener("change", () => {
    syncConcentrationToRatio();
    update(true);
    updateTasteGuidance();
  }));
  concentrationInputs.forEach((input) => input.addEventListener("change", setRatioFromConcentration));
  amount.addEventListener("input", () => update(false));
  amount.addEventListener("change", () => update(true));
  [inputUnit, outputUnit].forEach((control) => control.addEventListener("change", () => update(true)));
  tasteResult.addEventListener("change", updateTasteGuidance);
  brewNote.addEventListener("input", scheduleBrewNoteSave);
  saveBrewButton.addEventListener("click", saveCurrentBrew);
  undoButton.addEventListener("click", undoDelete);
  exportButton.addEventListener("click", exportHistory);
  copySheetsButton.addEventListener("click", copyForSheets);
  downloadCsvButton.addEventListener("click", downloadCsv);
  importButton.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    importHistory(importFile.files[0]);
    importFile.value = "";
  });
  clearHistoryButton.addEventListener("click", () => {
    try {
      if (!window.confirm("Clear all saved brews from this device?")) return;
      localStorage.removeItem(historyStorageKey);
      localStorage.removeItem(corruptBackupKey);
      lastDeleted = null;
      undoBar.hidden = true;
      renderHistory();
      historyStatus.textContent = "Brew history cleared from this device.";
    } catch {
      historyStatus.textContent = "Could not clear brew history.";
    }
  });
  const installBox = document.querySelector("#install-box");
  const installButton = document.querySelector("#install-app");
  let installPrompt = null;
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) installBox.hidden = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener("appinstalled", () => { installBox.hidden = true; });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  loadBrewNote();
  renderHistory();
  update(false);
  syncConcentrationToRatio();
  updateTasteGuidance();
})();
