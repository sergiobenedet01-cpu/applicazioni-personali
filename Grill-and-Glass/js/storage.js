/* Persistenza locale e migrazione sicura dello stato Food & Drinks. */
const DB_NAME = 'grill-glass-db';
const DB_VERSION = 3;
const ACTIVE_EVENT = 'active-event';
const ACTIVE_EVENT_META = 'active-event-id';
let dbPromise;
let saveTimer;
let lastSavedAt = 0;
let eventLibrary = [];

function normaliseDistribution(source, ids, fallback = {}) {
  const values = {};
  let total = 0;
  for (const id of ids) {
    const parsed = Number(source?.[id]);
    const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    values[id] = value;
    total += value;
  }
  if (!total) {
    total = ids.reduce((sum, id) => sum + num(fallback?.[id]), 0);
    if (!total) return Object.fromEntries(ids.map(id => [id, 0]));
    for (const id of ids) values[id] = num(fallback?.[id]);
  }
  const weighted = ids.map((id, index) => {
    const exact = values[id] / total * 100;
    return { id, index, value: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remaining = 100 - weighted.reduce((sum, item) => sum + item.value, 0);
  [...weighted].sort((a, b) => b.fraction - a.fraction || a.index - b.index).forEach(item => {
    if (remaining > 0) {
      item.value += 1;
      remaining -= 1;
    }
  });
  return Object.fromEntries(weighted.map(item => [item.id, item.value]));
}

function equalDistribution(ids) {
  return normaliseDistribution(Object.fromEntries(ids.map(id => [id, 1])), ids);
}

function validIds(values, allowed) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter(value => allowed.includes(value) && !seen.has(value) && seen.add(value));
}

function normaliseFoodProfile(id, raw) {
  const fallback = DEFAULT_FOOD_PROFILES[id];
  return {
    ...copy(fallback),
    total: decimal(num(raw?.total ?? fallback.total, 0, 5), 2),
    courseMix: normaliseDistribution(raw?.courseMix, Object.keys(FOOD_COURSES), fallback.courseMix),
    excludedCategories: validIds(raw?.excludedCategories ?? raw?.excludedCategoryIds, FOOD_CATEGORIES.map(category => category.id))
  };
}

function legacyDrinkTotal(raw, id) {
  const values = [raw?.legacyDrinkProfiles?.[id], raw?.drinkProfiles?.[id], raw?.profiles?.[id]];
  return values.find(value => Number.isFinite(Number(value)));
}

function normaliseDrinkProfile(id, raw, legacyTotal) {
  const fallback = DEFAULT_DRINK_PROFILES[id];
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    ...copy(fallback),
    total: decimal(num(value.total ?? value.servings ?? legacyTotal ?? fallback.total, 0, 20), 2),
    legacyMultiplier: decimal(num(value.legacyMultiplier ?? fallback.legacyMultiplier, 0, 5), 2),
    categoryMix: normaliseDistribution(value.categoryMix ?? value.mix, DRINK_MIX_IDS, fallback.categoryMix)
  };
}

function suggestedMixFromRecords(participants, drinkProfiles) {
  const weighted = Object.fromEntries(DRINK_MIX_IDS.map(id => [id, 0]));
  for (const person of participants) {
    const profile = drinkProfiles[person.drinkProfile] || drinkProfiles.moderate;
    const total = num(profile?.total, 0, 20);
    for (const category of DRINK_MIX_IDS) weighted[category] += total * num(profile?.categoryMix?.[category]);
  }
  return normaliseDistribution(weighted, DRINK_MIX_IDS, DEFAULT_DRINK_PROFILES.moderate.categoryMix);
}

function normaliseProduct(product) {
  if (!product || typeof product.name !== 'string') return null;
  return {
    id: String(product.id || cryptoId()),
    category: String(product.category || 'Varie').slice(0, 60),
    name: String(product.name).slice(0, 100),
    base: num(product.base),
    perPerson: product.perPerson == null ? null : num(product.perPerson),
    unit: String(product.unit || 'unità').slice(0, 30),
    price: num(product.price),
    note: String(product.note || '').slice(0, 200),
    equiv: String(product.equiv || '').slice(0, 60),
    equivFactor: num(product.equivFactor),
    manual: Boolean(product.manual),
    manualQty: product.manualQty == null ? null : num(product.manualQty),
    acquired: Boolean(product.acquired)
  };
}

function normaliseRecipeOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const allowed = new Set();
  FOOD_RECIPES.forEach(recipe => {
    recipe.ingredients.forEach((_, index) => allowed.add(recipeIngredientKey(recipe.id, index)));
  });
  const overrides = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const quantity = typeof value.quantity === 'string' && !value.quantity.trim() ? NaN : Number(value.quantity);
    const price = typeof value.price === 'string' && !value.price.trim() ? NaN : Number(value.price);
    const safe = {};
    if (Number.isFinite(quantity) && quantity >= 0 && quantity <= 1000000) safe.quantity = decimal(quantity, 4);
    if (Number.isFinite(price) && price >= 0 && price <= 1000000) safe.price = decimal(price, 2);
    if (Object.keys(safe).length) overrides[key] = safe;
  }
  return overrides;
}

function normaliseState(raw) {
  if (!raw || !Array.isArray(raw.participants) || !Array.isArray(raw.products)) return null;
  try {
    const base = defaultState(Math.max(1, Math.min(500, raw.participants.length)));
    const eventInput = raw.event && typeof raw.event === 'object' ? raw.event : {};
    base.event = {
      ...base.event,
      id: String(eventInput.id || ACTIVE_EVENT).slice(0, 100),
      title: String(eventInput.title || '').slice(0, 100),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(eventInput.date || '')) ? String(eventInput.date) : '',
      location: String(eventInput.location || '').slice(0, 120),
      notes: String(eventInput.notes || '').slice(0, 1000),
      budget: decimal(num(eventInput.budget, 0, 1000000), 2),
      includeMaybe: Boolean(eventInput.includeMaybe),
      isTemplate: Boolean(eventInput.isTemplate),
      createdAt: String(eventInput.createdAt || base.event.createdAt).slice(0, 40)
    };
    base.participantMode = raw.participantMode === 'separate' ? 'separate' : 'single';
    base.foodProfiles = Object.fromEntries(Object.keys(DEFAULT_FOOD_PROFILES).map(id => [id, normaliseFoodProfile(id, raw.foodProfiles?.[id])]));
    base.drinkProfiles = Object.fromEntries(Object.keys(DEFAULT_DRINK_PROFILES).map(id => [id, normaliseDrinkProfile(id, raw.drinkProfiles?.[id], legacyDrinkTotal(raw, id))]));
    base.participants = raw.participants.map((person, index) => {
      const legacyDrink = DEFAULT_DRINK_PROFILES[person.drinkProfile] ? person.drinkProfile : (DEFAULT_DRINK_PROFILES[person.profile] ? person.profile : 'moderate');
      return {
        id: String(person.id || cryptoId()),
        name: String(person.name || ('Ospite ' + (index + 1))).slice(0, 80),
        grillProfile: DEFAULT_FOOD_PROFILES[person.grillProfile] ? person.grillProfile : 'normal',
        drinkProfile: legacyDrink,
        rsvp: ['invited', 'confirmed', 'maybe', 'declined'].includes(person.rsvp) ? person.rsvp : 'confirmed',
        group: String(person.group || '').slice(0, 60),
        lastGrillProfile: DEFAULT_FOOD_PROFILES[person.lastGrillProfile] ? person.lastGrillProfile : undefined,
        lastDrinkProfile: DEFAULT_DRINK_PROFILES[person.lastDrinkProfile] ? person.lastDrinkProfile : undefined
      };
    });
    base.products = raw.products.map(normaliseProduct).filter(Boolean);
    base.selected = validIds(raw.selected ?? raw.selectedDrinks, DRINKS.map(drink => drink.id));
    const legacyCocktailWeights = raw.cocktailShares ?? raw.perPerson ?? raw.drinkPerPerson ?? raw.drinkPct;
    base.cocktailShares = normaliseDistribution(legacyCocktailWeights, base.selected, equalDistribution(base.selected));
    base.perPerson = {};
    base.bottleSizes = {};
    for (const [name, value] of Object.entries(raw.bottleSizes ?? raw.customBottleSizes ?? {})) {
      const size = whole(value, 50, 10000);
      if (size >= 50 && size <= 10000) base.bottleSizes[name] = size;
    }
    const foodInput = raw.food && typeof raw.food === 'object' ? raw.food : {};
    const eventType = EVENT_TYPE_BY_ID[foodInput.eventType ?? raw.eventType] ? (foodInput.eventType ?? raw.eventType) : 'barbecue';
    const eventDefaults = eventMenuDefaults(eventType);
    base.food = {
      eventType,
      activeCategoryIds: validIds(foodInput.activeCategoryIds ?? foodInput.selectedCategoryIds, FOOD_CATEGORIES.map(category => category.id)),
      selectedRecipeIds: validIds(foodInput.selectedRecipeIds ?? raw.selectedRecipeIds, FOOD_RECIPES.map(recipe => recipe.id)),
      collapsedCategoryIds: validIds(foodInput.collapsedCategoryIds, FOOD_CATEGORIES.map(category => category.id)),
      catalogCategory: FOOD_CATEGORY_BY_ID[foodInput.catalogCategory] ? foodInput.catalogCategory : 'all',
      catalogSearch: String(foodInput.catalogSearch ?? '').slice(0, 80)
    };
    if (!base.food.activeCategoryIds.length) base.food.activeCategoryIds = eventDefaults.activeCategoryIds;
    const hasNewMix = raw.drinkMix && typeof raw.drinkMix === 'object';
    const legacyCocktailOnly = !hasNewMix && base.selected.length > 0;
    base.drinkMix = normaliseDistribution(hasNewMix ? raw.drinkMix : (legacyCocktailOnly ? { cocktail: 100 } : null), DRINK_MIX_IDS, suggestedMixFromRecords(base.participants, base.drinkProfiles));
    base.drinkMixManual = Boolean(raw.drinkMixManual || legacyCocktailOnly);
    base.recipeAcquired = Object.fromEntries(base.food.selectedRecipeIds.map(id => [id, Boolean(raw.recipeAcquired?.[id])]));
    base.recipeOverrides = normaliseRecipeOverrides(raw.recipeOverrides);
    base.leftovers = {};
    if (raw.leftovers && typeof raw.leftovers === 'object' && !Array.isArray(raw.leftovers)) {
      for (const [key, value] of Object.entries(raw.leftovers)) {
        if (!value || typeof value !== 'object') continue;
        const action = ['none', 'keep', 'freeze', 'share', 'donate'].includes(value.action) ? value.action : 'none';
        const note = String(value.note || '').slice(0, 240);
        if (action !== 'none' || note) base.leftovers[String(key).slice(0, 160)] = { action, note };
      }
    }
    base.filters = { ...base.filters, ...(raw.filters && typeof raw.filters === 'object' ? raw.filters : {}) };
    base.filters.productCat = String(base.filters.productCat || 'Tutte');
    base.filters.productSearch = String(base.filters.productSearch || '').slice(0, 80);
    base.filters.drinkCat = String(base.filters.drinkCat || 'Tutti');
    base.filters.drinkSearch = String(base.filters.drinkSearch || '').slice(0, 80);
    base.schema = EVENT_SCHEMA;
    return base;
  } catch (_) {
    return null;
  }
}

function stateSnapshot() {
  return copy(state);
}

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB non disponibile'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const database = event.target.result;
      if (event.oldVersion < 1) {
        database.createObjectStore('events', { keyPath: 'id' });
        database.createObjectStore('backups', { keyPath: 'id' });
      }
      if (event.oldVersion < 2 && !database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Apertura database non riuscita'));
  });
  return dbPromise;
}

function dbRead(store, key) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    const request = database.transaction(store, 'readonly').objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function dbWrite(store, value) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(store, 'readwrite');
    transaction.objectStore(store).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }));
}

function dbReadAll(store) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    const request = database.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
}

function eventLibraryItems() {
  return [...eventLibrary].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function updateEventLibraryRecord(record) {
  const index = eventLibrary.findIndex(item => item.id === record.id);
  if (index >= 0) eventLibrary[index] = record;
  else eventLibrary.push(record);
}

function updateSaveStatus(message = 'Salvato localmente', mode = 'saved') {
  const element = document.getElementById('saveState');
  if (!element) return;
  element.dataset.state = mode;
  element.textContent = message;
}

function queueSave() {
  const pendingRecord = { id: state.event.id || ACTIVE_EVENT, schema: EVENT_SCHEMA, updatedAt: new Date().toISOString(), state: stateSnapshot() };
  updateEventLibraryRecord(pendingRecord);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) {
    updateSaveStatus('Backup browser non disponibile', 'error');
  }
  clearTimeout(saveTimer);
  updateSaveStatus('Salvataggio…', 'saving');
  saveTimer = setTimeout(async () => {
    try {
      const record = { id: state.event.id || ACTIVE_EVENT, schema: EVENT_SCHEMA, updatedAt: new Date().toISOString(), state: stateSnapshot() };
      await dbWrite('events', record);
      await dbWrite('meta', { key: ACTIVE_EVENT_META, value: record.id });
      updateEventLibraryRecord(record);
      lastSavedAt = Date.now();
      updateSaveStatus('Salvato ' + new Date(lastSavedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    } catch (_) {
      updateSaveStatus('Salvato solo nel browser', 'error');
    }
  }, 180);
}

async function createBackup(reason) {
  try {
    const backup = { id: 'backup-' + Date.now(), reason, createdAt: new Date().toISOString(), schema: EVENT_SCHEMA, state: stateSnapshot() };
    await dbWrite('backups', backup);
    return backup;
  } catch (_) {
    return null;
  }
}

async function readLatestBackup() {
  try {
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = database.transaction('backups', 'readonly').objectStore('backups').openCursor(null, 'prev');
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  } catch (_) {
    return null;
  }
}

function eventSummary(candidate) {
  return candidate.participants.length + ' invitati · ' + candidate.products.length + ' prodotti · ' + candidate.food.selectedRecipeIds.length + ' ricette · ' + candidate.selected.length + ' cocktail';
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
  const payload = { app: 'Grill & Glass', schema: EVENT_SCHEMA, exportedAt: new Date().toISOString(), state: stateSnapshot() };
  downloadFile('grill-glass-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(payload, null, 2), 'application/json');
  toast('↓ Backup JSON esportato');
}

async function importJson(file) {
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch (_) {
    toast('⚠️ Impossibile leggere il file');
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    toast('⚠️ Questo file non è un JSON valido');
    return;
  }
  const candidate = normaliseState(parsed.state || parsed);
  if (!candidate) {
    toast('⚠️ Backup incompleto o non compatibile');
    return;
  }
  if (!confirm('Anteprima importazione:\n' + eventSummary(candidate) + '\n\nI dati correnti verranno salvati in un backup recuperabile. Continuare?')) return;
  const backup = await createBackup('Prima dell’importazione JSON');
  if (!backup) {
    toast('⚠️ Importazione annullata: backup non creato');
    return;
  }
  state = candidate;
  queueSave();
  renderAll();
  toast('✓ Backup importato e dati precedenti salvati');
}

async function restoreLatestBackup() {
  const backup = await readLatestBackup();
  if (!backup) {
    toast('Nessun backup recuperabile trovato');
    return;
  }
  const candidate = normaliseState(backup.state);
  if (!candidate) {
    toast('⚠️ Il backup trovato non è valido');
    return;
  }
  if (!confirm('Ripristinare il backup del ' + new Date(backup.createdAt).toLocaleString('it-IT') + '?\n' + eventSummary(candidate))) return;
  const safetyBackup = await createBackup('Prima del ripristino backup');
  if (!safetyBackup) {
    toast('⚠️ Ripristino annullato: backup non creato');
    return;
  }
  state = candidate;
  queueSave();
  renderAll();
  toast('↺ Backup ripristinato');
}

async function resetEvent() {
  if (!confirm('Creare un backup e ricominciare con un nuovo evento?')) return;
  const backup = await createBackup('Prima del reset');
  if (!backup) {
    toast('⚠️ Reset annullato: backup non creato');
    return;
  }
  state = defaultState();
  queueSave();
  renderAll();
  toast('↺ Nuovo evento creato: backup disponibile');
}

async function persistCurrentEventNow() {
  const record = { id: state.event.id || ACTIVE_EVENT, schema: EVENT_SCHEMA, updatedAt: new Date().toISOString(), state: stateSnapshot() };
  await dbWrite('events', record);
  await dbWrite('meta', { key: ACTIVE_EVENT_META, value: record.id });
  updateEventLibraryRecord(record);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  return record;
}

async function openStoredEvent(eventId) {
  if (!eventId || eventId === state.event.id) return;
  try {
    await persistCurrentEventNow();
    const record = await dbRead('events', eventId);
    const candidate = normaliseState(record?.state);
    if (!candidate) throw new Error('Evento non valido');
    state = candidate;
    await persistCurrentEventNow();
    renderAll();
    toast('✓ Evento aperto: ' + (state.event.title || 'Senza nome'));
  } catch (_) {
    toast('⚠️ Impossibile aprire questo evento');
  }
}

function clearOperationalProgress(candidate) {
  candidate.products.forEach(product => { product.acquired = false; });
  candidate.recipeAcquired = Object.fromEntries(candidate.food.selectedRecipeIds.map(id => [id, false]));
  candidate.leftovers = {};
}

async function duplicateCurrentEvent(asTemplate = false) {
  try {
    await persistCurrentEventNow();
    const candidate = copy(state);
    candidate.event = {
      ...defaultEventMeta(),
      title: asTemplate
        ? 'Template · ' + (state.event.title || currentEventType().label)
        : 'Copia · ' + (state.event.title || currentEventType().label),
      isTemplate: asTemplate
    };
    clearOperationalProgress(candidate);
    state = normaliseState(candidate);
    await persistCurrentEventNow();
    renderAll();
    toast(asTemplate ? '✓ Template locale creato' : '✓ Copia evento creata');
  } catch (_) {
    toast('⚠️ Impossibile creare la copia');
  }
}

async function createEventFromTemplate(eventId) {
  try {
    await persistCurrentEventNow();
    const record = await dbRead('events', eventId);
    const candidate = normaliseState(record?.state);
    if (!candidate) throw new Error('Template non valido');
    candidate.event = { ...defaultEventMeta(), title: 'Nuovo · ' + (candidate.event.title.replace(/^Template · /, '') || currentEventType().label) };
    clearOperationalProgress(candidate);
    state = normaliseState(candidate);
    await persistCurrentEventNow();
    renderAll();
    toast('✓ Nuovo evento creato dal template');
  } catch (_) {
    toast('⚠️ Impossibile usare questo template');
  }
}

function buildDataTools() {
  const actions = document.querySelector('.topbar .actions');
  if (!actions || document.getElementById('dataTools')) return;
  const tools = document.createElement('div');
  tools.className = 'data-tools';
  tools.id = 'dataTools';
  tools.innerHTML = '<button class="btn" type="button" id="exportJsonBtn">↓ JSON</button><label class="btn" for="importJsonInput">↑ Importa</label><input id="importJsonInput" type="file" accept="application/json,.json" hidden><button class="btn" type="button" id="restoreBackupBtn">↺ Backup</button><span class="save-state" id="saveState" data-state="saving">Preparazione dati…</span>';
  actions.prepend(tools);
  document.getElementById('exportJsonBtn').onclick = exportJson;
  document.getElementById('importJsonInput').onchange = event => {
    importJson(event.target.files[0]);
    event.target.value = '';
  };
  document.getElementById('restoreBackupBtn').onclick = restoreLatestBackup;
  document.getElementById('resetAllBtn').onclick = resetEvent;
  const note = document.createElement('p');
  note.className = 'data-note';
  note.textContent = 'I dati restano su questo dispositivo. IndexedDB conserva l’evento; JSON serve per spostarlo o archiviarlo.';
  document.querySelector('#event .totals')?.after(note);
}

async function initialiseDataLayer() {
  buildDataTools();
  try {
    const active = await dbRead('meta', ACTIVE_EVENT_META);
    const record = await dbRead('events', active?.value || ACTIVE_EVENT);
    const restored = normaliseState(record?.state);
    if (restored) {
      state = restored;
      const records = await dbReadAll('events');
      eventLibrary = records.filter(item => normaliseState(item.state));
      if (!eventLibrary.some(item => item.id === state.event.id)) updateEventLibraryRecord({ id: state.event.id, schema: EVENT_SCHEMA, updatedAt: record.updatedAt, state: stateSnapshot() });
      renderAll();
      updateSaveStatus('Ripristinato ' + new Date(record.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
      return;
    }
    await persistCurrentEventNow();
    updateSaveStatus('Dati migrati in IndexedDB');
  } catch (_) {
    updateSaveStatus('Modalità browser: backup locale attivo', 'error');
  }
}
