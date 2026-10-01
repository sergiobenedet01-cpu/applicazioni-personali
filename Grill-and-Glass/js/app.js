function $(id) {
  return document.getElementById(id);
}

function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
}

function exportWord() {
  const rows = allShoppingRows().map(row => (
    '<tr><td>' + esc(row.category) + '</td><td><b>' + esc(row.name) + '</b></td><td>' + fmt(row.quantity) + ' ' + esc(row.unit) + '</td><td>' + (row.origin === 'recipe' ? 'Ricetta' : (row.acquired ? 'Acquistato' : 'Da comprare')) + '</td></tr>'
  )).join('');
  const cocktailIngredients = ingredients().map(item => (
    '<li>' + esc(item[0]) + ': ' + (item[1] / 1000).toFixed(2) + ' L · ' + Math.ceil(item[1] / bottle(item[0])) + ' bottiglie</li>'
  )).join('');
  const eventType = currentEventType();
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Lista Food & Drinks</title></head><body>' +
    '<h1>Grill & Glass — Food & Drinks</h1><p>' + esc(eventType.label) + ' · ' + guests() + ' invitati · generata il ' + new Date().toLocaleString('it-IT') + '</p>' +
    '<h2>Lista Food</h2><table border="1" cellspacing="0" cellpadding="6"><tr><th>Categoria</th><th>Prodotto o ricetta</th><th>Quantità</th><th>Stato</th></tr>' + rows + '</table>' +
    '<h2>Ingredienti cocktail</h2><ul>' + (cocktailIngredients || '<li>Nessun cocktail configurato</li>') + '</ul></body></html>';
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([html], { type: 'application/msword' }));
  anchor.download = 'Lista_Food_and_Drinks.doc';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  toast('↓ Lista Word scaricata');
}

function openDialog() {
  $('productDialog').classList.add('open');
  $('newName').focus();
}

function closeDialog() {
  $('productDialog').classList.remove('open');
}

function addProduct(event) {
  event.preventDefault();
  const name = $('newName').value.trim();
  if (!name) return;
  state.products.push({
    id: cryptoId(),
    name,
    category: $('newCategory').value.trim() || 'Varie',
    unit: $('newUnit').value.trim() || 'unità',
    base: num($('newBase').value),
    perPerson: num($('newPerPerson').value) || null,
    price: num($('newPrice').value),
    note: 'Prodotto personalizzato',
    equiv: $('newEquiv').value.trim(),
    equivFactor: num($('newFactor').value),
    manual: false,
    manualQty: null,
    acquired: false
  });
  save();
  event.target.reset();
  closeDialog();
  renderAll();
  toast('✓ ' + name + ' aggiunto');
}

function resetManualQuantities() {
  if (!confirm('Resettare tutte le quantità manuali e gli aggiustamenti alle ricette?')) return;
  state.products.forEach(product => {
    product.manual = false;
    product.manualQty = null;
  });
  state.recipeOverrides = {};
  save();
  renderAll();
}

function updateEventMeta(field, value) {
  if (!['title', 'date', 'location', 'notes', 'budget'].includes(field)) return;
  if (field === 'budget') state.event.budget = decimal(num(value, 0, 1000000), 2);
  else if (field === 'date') state.event.date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  else state.event[field] = String(value || '').slice(0, field === 'notes' ? 1000 : field === 'location' ? 120 : 100);
  save();
  renderAll();
}

function updateLeftover(key, patch) {
  if (!key) return;
  const current = state.leftovers[key] || { action: 'none', note: '' };
  const next = {
    action: ['none', 'keep', 'freeze', 'share', 'donate'].includes(patch.action) ? patch.action : current.action,
    note: patch.note == null ? current.note : String(patch.note).slice(0, 240)
  };
  if (next.action === 'none' && !next.note) delete state.leftovers[key];
  else state.leftovers[key] = next;
  save();
}

function toggleFieldShopping(origin, id, acquired) {
  if (origin === 'recipe') toggleRecipeAcquired(String(id).split(',').filter(Boolean), acquired);
  else mutProduct(id, product => { product.acquired = acquired; });
}

function completeFieldShopping() {
  allShoppingRows().filter(row => !row.acquired).forEach(row => {
    if (row.origin === 'recipe') row.recipeIds.forEach(id => { state.recipeAcquired[id] = true; });
    else {
      const product = state.products.find(item => item.id === row.id);
      if (product) product.acquired = true;
    }
  });
  save();
  renderAll();
  toast('✓ Spesa sul campo completata');
}

function printOperationalSheets() {
  const eventName = state.event.title || 'Evento Food & Drinks';
  const missing = allShoppingRows().filter(row => !row.acquired);
  const menu = selectedFoodRecipes(true);
  const leftoverRows = Object.entries(state.leftovers).filter(([, value]) => value.action !== 'none' || value.note);
  const rows = missing.map(row => '<tr><td>' + esc(row.category) + '</td><td>' + esc(row.name) + '</td><td>' + fmt(row.quantity) + ' ' + esc(row.unit) + '</td><td>□</td></tr>').join('') || '<tr><td colspan="4">Nessuna voce in sospeso.</td></tr>';
  const menuRows = menu.map(recipe => '<li>' + esc(recipe.title) + '</li>').join('') || '<li>Nessuna ricetta selezionata.</li>';
  const leftoverText = leftoverRows.map(([key, value]) => '<li>' + esc(key.replace(/^.*?:/, '')) + ' — ' + esc(value.action) + (value.note ? ': ' + esc(value.note) : '') + '</li>').join('') || '<li>Nessun promemoria avanzi.</li>';
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) {
    toast('⚠️ Consenti i popup per stampare i fogli operativi');
    return;
  }
  popup.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + esc(eventName) + '</title><style>body{font:14px system-ui;margin:28px;color:#151515}h1{margin:0 0 4px}h2{margin-top:28px;border-bottom:2px solid #333;padding-bottom:5px}p{color:#555}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #bbb;padding:9px;text-align:left}th{background:#eee}@media print{body{margin:12mm}}</style></head><body><h1>' + esc(eventName) + '</h1><p>' + esc(currentEventType().label) + (state.event.date ? ' · ' + esc(state.event.date) : '') + (state.event.location ? ' · ' + esc(state.event.location) : '') + '</p><p>Ospiti nei calcoli: ' + planningParticipants().length + ' · Budget stimato: ' + euro(shoppingCost()) + ' · Per persona: ' + euro(costPerPlanningGuest()) + '</p><h2>Spesa e preparazioni da completare</h2><table><thead><tr><th>Categoria</th><th>Voce</th><th>Quantità</th><th>Fatto</th></tr></thead><tbody>' + rows + '</tbody></table><h2>Menu</h2><ul>' + menuRows + '</ul><h2>Bar</h2><p>Bevande stimate: ' + fmt(totalDrinks()) + ' · Cocktail selezionati: ' + esc(selected().map(drink => drink.name).join(', ') || 'nessuno') + '</p><h2>Avanzi</h2><ul>' + leftoverText + '</ul></body></html>');
  popup.document.close();
  popup.focus();
  popup.print();
}

function validRecipeOverrideInput(value, maximum) {
  if (String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function recipeQuantityFromInput(value, unit) {
  return ['kg', 'L'].includes(unit) ? decimal(value, 2) : Math.round(value);
}

function recipeShoppingItem(rowId) {
  return recipeShoppingItems().find(item => item.id === rowId);
}

function updateRecipeShoppingQuantity(rowId, value) {
  const requested = validRecipeOverrideInput(value, 1000000);
  const row = recipeShoppingItem(rowId);
  if (requested == null || !row?.sources?.length) {
    toast('⚠️ Inserisci una quantità valida per la ricetta');
    renderShopping();
    return;
  }
  const target = recipeQuantityFromInput(requested, row.unit);
  let weights = row.sources.map(source => num(source.quantity));
  let totalWeight = weights.reduce((sum, quantity) => sum + quantity, 0);
  if (!totalWeight) {
    weights = row.sources.map(source => num(source.defaultQuantity));
    totalWeight = weights.reduce((sum, quantity) => sum + quantity, 0);
  }
  if (!totalWeight) {
    weights = row.sources.map(() => 1);
    totalWeight = weights.length;
  }

  let remaining = target;
  row.sources.forEach((source, index) => {
    const quantity = index === row.sources.length - 1
      ? remaining
      : decimal(target * weights[index] / totalWeight, 4);
    remaining = decimal(remaining - quantity, 4);
    state.recipeOverrides[source.overrideKey] = {
      ...state.recipeOverrides[source.overrideKey],
      quantity: Math.max(0, quantity)
    };
  });
  save();
  renderAll();
  toast('✓ Quantità ricetta aggiornata');
}

function updateRecipeShoppingPrice(rowId, value) {
  const requested = validRecipeOverrideInput(value, 1000000);
  const row = recipeShoppingItem(rowId);
  if (requested == null || !row?.sources?.length) {
    toast('⚠️ Inserisci un prezzo unitario valido');
    renderShopping();
    return;
  }
  const price = decimal(requested, 2);
  row.sources.forEach(source => {
    state.recipeOverrides[source.overrideKey] = {
      ...state.recipeOverrides[source.overrideKey],
      price
    };
  });
  save();
  renderAll();
  toast('✓ Prezzo ricetta aggiornato');
}

function setParticipantMode(mode) {
  state.participantMode = mode === 'separate' ? 'separate' : 'single';
  save();
  renderAll();
  toast(state.participantMode === 'separate' ? '↔ Partecipanti separati per Food e Bar' : '↔ Un solo totale partecipanti');
}

function newParticipant(index) {
  return { id: cryptoId(), name: 'Ospite ' + index, grillProfile: 'normal', drinkProfile: 'moderate', rsvp: 'confirmed', group: '' };
}

function clearManualQuantities() {
  state.products.forEach(product => {
    if (product.manual) {
      product.manual = false;
      product.manualQty = null;
    }
  });
}

function adjustGuests(delta) {
  if (delta < 0) {
    if (guests() <= 1) return;
    state.participants.pop();
  } else {
    state.participants.push(newParticipant(guests() + 1));
  }
  clearManualQuantities();
  if (!state.drinkMixManual) useSuggestedDrinkMix();
  save();
  renderAll();
}

function adjustArea(area, delta) {
  const foodArea = area === 'food' || area === 'grill';
  const key = foodArea ? 'grillProfile' : 'drinkProfile';
  const lastKey = foodArea ? 'lastGrillProfile' : 'lastDrinkProfile';
  const profiles = foodArea ? state.foodProfiles : state.drinkProfiles;
  const standard = foodArea ? 'normal' : 'moderate';
  if (delta < 0) {
    const person = [...state.participants].reverse().find(item => item[key] !== 'none');
    if (!person) {
      toast('Nessun partecipante ' + (foodArea ? 'Food' : 'al Bar'));
      return;
    }
    person[lastKey] = person[key];
    person[key] = 'none';
  } else {
    let person = state.participants.find(item => item[key] === 'none');
    if (!person) {
      person = newParticipant(guests() + 1);
      person[foodArea ? 'drinkProfile' : 'grillProfile'] = 'none';
      state.participants.push(person);
    }
    person[key] = profiles[person[lastKey]] ? person[lastKey] : standard;
  }
  clearManualQuantities();
  if (!state.drinkMixManual) useSuggestedDrinkMix();
  save();
  renderAll();
}

function updateFoodProfileTotal(id, value) {
  const profile = state.foodProfiles[id];
  if (!profile) return;
  profile.total = decimal(num(value, 0, 5), 2);
  clearManualQuantities();
  save();
  renderAll();
}

function updateFoodCourseMix(id, courseId, value) {
  const profile = state.foodProfiles[id];
  if (!profile || !Object.hasOwn(FOOD_COURSES, courseId)) return;
  profile.courseMix = rebalanceMix(profile.courseMix, courseId, value, Object.keys(FOOD_COURSES));
  save();
  renderAll();
}

function toggleFoodExclusion(id, categoryId, excluded) {
  const profile = state.foodProfiles[id];
  if (!profile || !FOOD_CATEGORY_BY_ID[categoryId]) return;
  profile.excludedCategories = excluded
    ? [...new Set([...profile.excludedCategories, categoryId])]
    : profile.excludedCategories.filter(item => item !== categoryId);
  clearManualQuantities();
  save();
  renderAll();
}

function updateDrinkProfileTotal(id, value) {
  const profile = state.drinkProfiles[id];
  if (!profile) return;
  profile.total = decimal(num(value, 0, 20), 2);
  if (!state.drinkMixManual) useSuggestedDrinkMix();
  save();
  renderAll();
}

function updateDrinkProfileMix(id, categoryId, value) {
  const profile = state.drinkProfiles[id];
  if (!profile || !DRINK_MIX_IDS.includes(categoryId)) return;
  profile.categoryMix = rebalanceMix(profile.categoryMix, categoryId, value, DRINK_MIX_IDS);
  if (!state.drinkMixManual) useSuggestedDrinkMix();
  save();
  renderAll();
}

function changeEventType(eventType) {
  const type = EVENT_TYPE_BY_ID[eventType];
  if (!type) return;
  state.food.eventType = type.id;
  state.food.activeCategoryIds = [...type.categories];
  state.food.collapsedCategoryIds = [];
  save();
  renderAll();
  toast('✓ ' + type.label + ' impostato · le ricette già scelte restano salvate');
}

function toggleFoodCategory(categoryId, active) {
  if (!FOOD_CATEGORY_BY_ID[categoryId]) return;
  state.food.activeCategoryIds = active
    ? [...new Set([...state.food.activeCategoryIds, categoryId])]
    : state.food.activeCategoryIds.filter(id => id !== categoryId);
  save();
  renderAll();
}

function toggleFoodAccordion(categoryId, collapsed) {
  state.food.collapsedCategoryIds = collapsed
    ? [...new Set([...state.food.collapsedCategoryIds, categoryId])]
    : state.food.collapsedCategoryIds.filter(id => id !== categoryId);
  save();
}

function toggleFoodRecipe(recipeId) {
  const recipe = FOOD_RECIPE_BY_ID[recipeId];
  if (!recipe) return;
  if (state.food.selectedRecipeIds.includes(recipeId)) {
    state.food.selectedRecipeIds = state.food.selectedRecipeIds.filter(id => id !== recipeId);
    delete state.recipeAcquired[recipeId];
    Object.keys(state.recipeOverrides).forEach(key => {
      if (key.startsWith(recipeId + ':')) delete state.recipeOverrides[key];
    });
    toast('○ Ricetta rimossa dal menu');
  } else {
    state.food.selectedRecipeIds.push(recipeId);
    if (!state.food.activeCategoryIds.includes(recipe.category)) state.food.activeCategoryIds.push(recipe.category);
    state.recipeAcquired[recipeId] = false;
    toast('✓ ' + recipe.title + ' aggiunta al menu');
  }
  save();
  renderAll();
}

function toggleRecipeAcquired(recipeIds, acquired) {
  recipeIds.forEach(id => {
    if (state.food.selectedRecipeIds.includes(id)) state.recipeAcquired[id] = acquired;
  });
  save();
  renderAll();
}

function toggleCocktail(drinkId) {
  if (!DRINKS.some(drink => drink.id === drinkId)) return;
  if (state.selected.includes(drinkId)) {
    state.selected = state.selected.filter(id => id !== drinkId);
    delete state.cocktailShares[drinkId];
  } else {
    state.selected.push(drinkId);
    state.cocktailShares[drinkId] = 1;
  }
  ensureCocktailShares();
  save();
  renderAll();
}

function showView(view) {
  document.querySelectorAll('.page').forEach(page => {
    page.hidden = page.id !== view;
  });
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('selectAllBtn').onclick = () => {
  state.products.forEach(product => { product.acquired = true; });
  state.food.selectedRecipeIds.forEach(id => { state.recipeAcquired[id] = true; });
  save();
  renderAll();
  toast('✓ Spesa e ricette completate');
};
$('deselectAllBtn').onclick = () => {
  state.products.forEach(product => { product.acquired = false; });
  state.food.selectedRecipeIds.forEach(id => { state.recipeAcquired[id] = false; });
  save();
  renderAll();
};
$('resetQtyBtn').onclick = resetManualQuantities;
$('addProductBtn').onclick = openDialog;
$('dialogClose').onclick = closeDialog;
$('dialogCancel').onclick = closeDialog;
$('productDialog').onclick = event => {
  if (event.target === $('productDialog')) closeDialog();
};
$('productForm').onsubmit = addProduct;
$('exportBtn').onclick = exportWord;
$('printBtn').onclick = printOperationalSheets;
$('fieldPrintBtn').onclick = printOperationalSheets;
$('fieldCheckAllBtn').onclick = completeFieldShopping;
$('duplicateEventBtn').onclick = () => duplicateCurrentEvent(false);
$('saveTemplateBtn').onclick = () => duplicateCurrentEvent(true);
$('resetAllBtn').onclick = resetEvent;
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.onclick = () => showView(tab.dataset.view);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeDialog();
});

renderAll();
initialiseDataLayer();
