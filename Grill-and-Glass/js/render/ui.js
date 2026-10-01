function profileOptionMap(profiles, current) {
  return Object.entries(profiles).map(([id, profile]) => (
    '<option value="' + esc(id) + '"' + (current === id ? ' selected' : '') + '>' +
    esc(profile.icon + ' ' + profile.label) + '</option>'
  )).join('');
}

function foodProfileImpact(profile) {
  const exclusions = profile.excludedCategories?.length
    ? 'esclude ' + profile.excludedCategories.map(id => FOOD_CATEGORY_BY_ID[id]?.label).filter(Boolean).join(', ')
    : 'tutte le categorie incluse';
  return fmt(profile.total) + ' quote Food · ' + exclusions;
}

function drinkProfileImpact(profile) {
  return fmt(profile.total) + ' bevande stimate · ' +
    DRINK_MIX_CATEGORIES.map(category => category.label + ' ' + profile.categoryMix[category.id] + '%').join(' · ');
}

function renderProfileEditor() {
  const root = $('profileEditor');
  const foodCards = Object.entries(state.foodProfiles).map(([id, profile]) => {
    const courseInputs = Object.entries(FOOD_COURSES).map(([courseId, course]) => {
      const inputId = 'food-' + id + '-' + courseId;
      return '<label for="' + inputId + '">' + esc(course.label) +
        '<input id="' + inputId + '" type="number" min="0" max="100" step="1" value="' + profile.courseMix[courseId] + '" data-food-course="' + esc(courseId) + '" data-profile="' + esc(id) + '"></label>';
    }).join('');
    const exclusions = FOOD_CATEGORIES.map(category => (
      '<label class="check-chip"><input type="checkbox" data-food-exclusion="' + esc(category.id) + '" data-profile="' + esc(id) + '"' +
      (profile.excludedCategories.includes(category.id) ? ' checked' : '') + '>' + esc(category.icon + ' ' + category.label) + '</label>'
    )).join('');
    return '<article class="profile-card">' +
      '<div class="profile-card-head"><h3>' + esc(profile.icon + ' ' + profile.label) + '</h3><span class="badge">Food</span></div>' +
      '<label for="food-' + id + '-total">Quantità stimata per persona' +
      '<input id="food-' + id + '-total" type="number" min="0" max="5" step="0.05" value="' + profile.total + '" data-food-profile-total="' + esc(id) + '"></label>' +
      '<fieldset class="share-grid"><legend>Proporzione del menu · totale 100%</legend>' + courseInputs + '</fieldset>' +
      '<details class="exclusion-details"><summary>Categorie escluse</summary><div class="check-chip-list">' + exclusions + '</div></details>' +
      '<p class="hint">' + esc(foodProfileImpact(profile)) + '</p>' +
    '</article>';
  }).join('');

  const drinkCards = Object.entries(state.drinkProfiles).map(([id, profile]) => {
    const shareInputs = DRINK_MIX_CATEGORIES.map(category => {
      const inputId = 'drink-profile-' + id + '-' + category.id;
      return '<label for="' + inputId + '">' + esc(category.icon + ' ' + category.label) +
        '<input id="' + inputId + '" type="number" min="0" max="100" step="1" value="' + profile.categoryMix[category.id] + '" data-drink-profile-mix="' + esc(category.id) + '" data-profile="' + esc(id) + '"></label>';
    }).join('');
    return '<article class="profile-card">' +
      '<div class="profile-card-head"><h3>' + esc(profile.icon + ' ' + profile.label) + '</h3><span class="badge cyan">Bevande</span></div>' +
      '<label for="drink-profile-' + id + '-total">Bevande stimate per persona' +
      '<input id="drink-profile-' + id + '-total" type="number" min="0" max="20" step="0.5" value="' + profile.total + '" data-drink-profile-total="' + esc(id) + '"></label>' +
      '<fieldset class="share-grid"><legend>Preferenze del profilo · totale 100%</legend>' + shareInputs + '</fieldset>' +
      '<p class="hint">Stima modificabile, non un invito al consumo. ' + esc(drinkProfileImpact(profile)) + '</p>' +
    '</article>';
  }).join('');

  root.innerHTML = '<div class="profile-section"><h3>🍽️ Profili Food</h3><div class="profile-card-grid">' + foodCards + '</div></div>' +
    '<div class="profile-section"><h3>🍹 Profili Bevande</h3><div class="profile-card-grid">' + drinkCards + '</div></div>';

  root.querySelectorAll('[data-food-profile-total]').forEach(input => {
    input.onchange = () => updateFoodProfileTotal(input.dataset.foodProfileTotal, input.value);
  });
  root.querySelectorAll('[data-food-course]').forEach(input => {
    input.onchange = () => updateFoodCourseMix(input.dataset.profile, input.dataset.foodCourse, input.value);
  });
  root.querySelectorAll('[data-food-exclusion]').forEach(input => {
    input.onchange = () => toggleFoodExclusion(input.dataset.profile, input.dataset.foodExclusion, input.checked);
  });
  root.querySelectorAll('[data-drink-profile-total]').forEach(input => {
    input.onchange = () => updateDrinkProfileTotal(input.dataset.drinkProfileTotal, input.value);
  });
  root.querySelectorAll('[data-drink-profile-mix]').forEach(input => {
    input.onchange = () => updateDrinkProfileMix(input.dataset.profile, input.dataset.drinkProfileMix, input.value);
  });
}

function rsvpOptions(current) {
  return [
    ['confirmed', '✓ Confermato'], ['maybe', '? Forse'], ['invited', '✉ Invitato'], ['declined', '— Assente']
  ].map(([id, label]) => '<option value="' + id + '"' + (current === id ? ' selected' : '') + '>' + label + '</option>').join('');
}

function renderGuests() {
  const mode = state.participantMode === 'separate' ? 'separate' : 'single';
  const controls = $('audienceControls');
  document.querySelectorAll('[name="participantMode"]').forEach(input => {
    input.checked = input.value === mode;
    input.onchange = () => setParticipantMode(input.value);
  });

  if (mode === 'single') {
    controls.innerHTML = '<div class="audience-row"><div><b>Partecipanti evento</b><small>Ogni profilo decide l’impatto su Food e Bar.</small></div><button class="icon-btn" data-total="-1" aria-label="Riduci partecipanti">−</button><output>' + guests() + '</output><button class="icon-btn" data-total="1" aria-label="Aumenta partecipanti">+</button></div>';
    controls.querySelectorAll('[data-total]').forEach(button => {
      button.onclick = () => adjustGuests(Number(button.dataset.total));
    });
  } else {
    controls.innerHTML =
      '<div class="audience-row"><div><b>Food</b><small>Persone con profilo Food attivo</small></div><button class="icon-btn" data-area="food" data-delta="-1" aria-label="Riduci partecipanti Food">−</button><output>' + grillers() + '</output><button class="icon-btn" data-area="food" data-delta="1" aria-label="Aumenta partecipanti Food">+</button></div>' +
      '<div class="audience-row"><div><b>Bar</b><small>Persone con profilo Bevande attivo</small></div><button class="icon-btn" data-area="drink" data-delta="-1" aria-label="Riduci partecipanti al Bar">−</button><output>' + drinkers() + '</output><button class="icon-btn" data-area="drink" data-delta="1" aria-label="Aumenta partecipanti al Bar">+</button></div>';
    controls.querySelectorAll('[data-area]').forEach(button => {
      button.onclick = () => adjustArea(button.dataset.area, Number(button.dataset.delta));
    });
  }

  const foodStats = profileStats('food');
  const drinkStats = profileStats('drink');
  $('profileSummary').innerHTML =
    Object.entries(state.foodProfiles).filter(([id]) => foodStats[id]).map(([id, profile]) => '<span>' + esc(profile.icon + ' Food ' + profile.label + ': ' + foodStats[id]) + '</span>').join('') +
    Object.entries(state.drinkProfiles).filter(([id]) => drinkStats[id]).map(([id, profile]) => '<span>' + esc(profile.icon + ' Bar ' + profile.label + ': ' + drinkStats[id]) + '</span>').join('') ||
    '<span>Configura i profili individuali.</span>';
  controls.insertAdjacentHTML('beforeend', '<label class="planning-toggle"><input type="checkbox" data-include-maybe' + (state.event.includeMaybe ? ' checked' : '') + '> Includi i “forse” nei calcoli <small>' + rsvpCount('confirmed') + ' confermati · ' + rsvpCount('maybe') + ' forse</small></label>');
  controls.querySelector('[data-include-maybe]').onchange = input => {
    state.event.includeMaybe = input.target.checked;
    if (!state.drinkMixManual) useSuggestedDrinkMix();
    save();
    renderAll();
  };

  $('guestEstimated').textContent = fmt(grillUnits());
  $('guestDrinkers').textContent = fmt(drinkServings());
  $('guestConfigured').textContent = selectedFoodRecipes(true).length;
  $('estimateLabel').textContent = planningParticipants().length + ' nei calcoli · ' + grillers() + ' Food · ' + drinkers() + ' Bar';

  const warning = [];
  if (!grillUnits() && state.products.some(product => !product.manual && product.perPerson != null)) warning.push('Nessuna persona partecipa al Food: le quantità automatiche sono a zero.');
  if (!drinkServings()) warning.push('Nessuna bevanda stimata: il mix resta disponibile ma le quantità sono a zero.');
  $('guestWarning').hidden = !warning.length;
  $('guestWarning').textContent = warning.join(' ');

  const list = $('participantList');
  list.innerHTML = state.participants.map((person, index) => {
    const food = foodProfile(person.grillProfile);
    const drink = drinkProfile(person.drinkProfile);
    return '<div class="participant"><span class="avatar">' + (index + 1) + '</span>' +
      '<input aria-label="Nome ospite ' + (index + 1) + '" value="' + esc(person.name) + '" data-name="' + esc(person.id) + '">' +
      '<select aria-label="RSVP di ' + esc(person.name) + '" data-rsvp="' + esc(person.id) + '">' + rsvpOptions(person.rsvp) + '</select>' +
      '<div class="participant-profile"><select aria-label="Profilo Food di ' + esc(person.name) + '" data-food-profile="' + esc(person.id) + '">' + profileOptionMap(state.foodProfiles, person.grillProfile) + '</select><small>' + esc(fmt(food.total) + ' quote · ' + food.courseMix.main + '% principali') + '</small></div>' +
      '<div class="participant-profile"><select aria-label="Profilo Bevande di ' + esc(person.name) + '" data-drink-profile="' + esc(person.id) + '">' + profileOptionMap(state.drinkProfiles, person.drinkProfile) + '</select><small>' + esc(fmt(drink.total) + ' stimate · ' + drink.categoryMix.nonAlcoholic + '% analcoliche') + '</small></div>' +
      '<input class="participant-group" aria-label="Gruppo di ' + esc(person.name) + '" placeholder="Gruppo (facoltativo)" value="' + esc(person.group || '') + '" data-group="' + esc(person.id) + '">' +
    '</div>';
  }).join('');

  list.querySelectorAll('[data-name]').forEach(input => {
    input.onchange = () => {
      const person = state.participants.find(item => item.id === input.dataset.name);
      if (person) person.name = input.value.trim() || person.name;
      save();
    };
  });
  list.querySelectorAll('[data-food-profile]').forEach(input => {
    input.onchange = () => {
      const person = state.participants.find(item => item.id === input.dataset.foodProfile);
      if (person) person.grillProfile = input.value;
      save();
      renderAll();
    };
  });
  list.querySelectorAll('[data-drink-profile]').forEach(input => {
    input.onchange = () => {
      const person = state.participants.find(item => item.id === input.dataset.drinkProfile);
      if (person) person.drinkProfile = input.value;
      if (!state.drinkMixManual) useSuggestedDrinkMix();
      save();
      renderAll();
    };
  });
  list.querySelectorAll('[data-rsvp]').forEach(input => {
    input.onchange = () => {
      const person = state.participants.find(item => item.id === input.dataset.rsvp);
      if (person) person.rsvp = input.value;
      if (!state.drinkMixManual) useSuggestedDrinkMix();
      save();
      renderAll();
    };
  });
  list.querySelectorAll('[data-group]').forEach(input => {
    input.onchange = () => {
      const person = state.participants.find(item => item.id === input.dataset.group);
      if (person) person.group = input.value.trim().slice(0, 60);
      save();
    };
  });
}

function renderEventType() {
  const eventType = currentEventType();
  const select = $('eventType');
  select.innerHTML = EVENT_TYPES.map(type => '<option value="' + type.id + '"' + (type.id === eventType.id ? ' selected' : '') + '>' + esc(type.icon + ' ' + type.label) + '</option>').join('');
  select.onchange = () => changeEventType(select.value);
  $('eventTypeDescription').textContent = eventType.description;

  const activeRecipes = selectedFoodRecipes(true);
  const storedButInactive = selectedFoodRecipes(false).length - activeRecipes.length;
  $('foodPlanSummary').innerHTML =
    '<span class="badge">' + state.food.activeCategoryIds.length + ' categorie attive</span>' +
    '<span class="badge cyan">' + activeRecipes.length + ' ricette nel piano</span>' +
    (storedButInactive ? '<span class="badge warn">' + storedButInactive + ' scelte conservate per un altro tipo evento</span>' : '') +
    '<span class="hint">Budget ricette ' + euro(recipeCost()) + '</span>';
}

function recipeCard(recipe, compact = false) {
  const selectedRecipe = state.food.selectedRecipeIds.includes(recipe.id);
  const category = FOOD_CATEGORY_BY_ID[recipe.category];
  const compatible = recipe.eventTypes.includes(state.food.eventType);
  return '<article class="recipe-card' + (selectedRecipe ? ' selected' : '') + (compatible ? '' : ' muted-card') + '">' +
    '<div class="recipe-card-head"><span class="recipe-icon">' + esc(category.icon) + '</span><span class="badge">' + esc(category.label) + '</span></div>' +
    '<h3>' + esc(recipe.title) + '</h3>' +
    '<p class="recipe-tags">' + recipe.tags.map(tag => '<span>' + esc(tag) + '</span>').join('') + '</p>' +
    (compact ? '' : '<p class="hint">' + esc(recipe.note) + '</p>') +
    '<p class="recipe-ingredients">' + recipe.ingredients.map(ingredient => esc(ingredient.name)).join(' · ') + '</p>' +
    '<button class="btn ' + (selectedRecipe ? 'primary' : '') + '" type="button" data-food-recipe="' + esc(recipe.id) + '" aria-pressed="' + selectedRecipe + '">' + (selectedRecipe ? '✓ Nel menu' : '＋ Aggiungi al menu') + '</button>' +
  '</article>';
}

function bindRecipeButtons(root) {
  root.querySelectorAll('[data-food-recipe]').forEach(button => {
    button.onclick = () => toggleFoodRecipe(button.dataset.foodRecipe);
  });
}

function renderFoodMenu() {
  const controls = $('foodCategoryControls');
  controls.innerHTML = FOOD_CATEGORIES.map(category => {
    const active = state.food.activeCategoryIds.includes(category.id);
    return '<label class="menu-category-toggle"><input type="checkbox" data-food-category="' + esc(category.id) + '"' + (active ? ' checked' : '') + '><span>' + esc(category.icon) + '</span><b>' + esc(category.label) + '</b></label>';
  }).join('');
  controls.querySelectorAll('[data-food-category]').forEach(input => {
    input.onchange = () => toggleFoodCategory(input.dataset.foodCategory, input.checked);
  });

  const root = $('foodRecipeAccordions');
  root.innerHTML = activeFoodCategories().map(category => {
    const recipes = recipesForCategory(category.id, true);
    const selectedCount = selectedFoodRecipes(true).filter(recipe => recipe.category === category.id).length;
    const isOpen = !state.food.collapsedCategoryIds.includes(category.id);
    return '<details class="recipe-accordion" data-accordion-category="' + esc(category.id) + '"' + (isOpen ? ' open' : '') + '>' +
      '<summary><span>' + esc(category.icon + ' ' + category.label) + '</span><span class="hint">' + selectedCount + ' selezionate · ' + fmt(foodUnitsForCategory(category.id)) + ' quote</span></summary>' +
      '<div class="recipe-grid">' + (recipes.length ? recipes.map(recipe => recipeCard(recipe)).join('') : '<div class="empty">Nessuna proposta per questo tipo di evento.</div>') + '</div>' +
    '</details>';
  }).join('') || '<div class="empty">Seleziona almeno una categoria per comporre il menu.</div>';
  root.querySelectorAll('[data-accordion-category]').forEach(details => {
    details.ontoggle = () => toggleFoodAccordion(details.dataset.accordionCategory, !details.open);
  });
  bindRecipeButtons(root);
}

function renderCatalog() {
  const categorySelect = $('catalogCategory');
  categorySelect.innerHTML = '<option value="all">Tutte le categorie</option>' + FOOD_CATEGORIES.map(category => '<option value="' + category.id + '"' + (state.food.catalogCategory === category.id ? ' selected' : '') + '>' + esc(category.icon + ' ' + category.label) + '</option>').join('');
  categorySelect.onchange = () => {
    state.food.catalogCategory = categorySelect.value;
    save();
    renderCatalog();
  };
  const search = $('catalogSearch');
  search.value = state.food.catalogSearch;
  search.oninput = () => {
    state.food.catalogSearch = search.value.slice(0, 80);
    renderCatalog();
  };
  const query = state.food.catalogSearch.trim().toLowerCase();
  const recipes = FOOD_RECIPES.filter(recipe => {
    const categoryMatch = state.food.catalogCategory === 'all' || recipe.category === state.food.catalogCategory;
    const searchable = [recipe.title, recipe.tags.join(' '), FOOD_CATEGORY_BY_ID[recipe.category].label].join(' ').toLowerCase();
    return categoryMatch && (!query || searchable.includes(query));
  });
  $('catalogVisible').textContent = recipes.length + ' di ' + FOOD_RECIPES.length + ' ricette';
  const grid = $('catalogGrid');
  grid.innerHTML = recipes.map(recipe => recipeCard(recipe, true)).join('') || '<div class="empty">🔍 Nessuna ricetta trovata.</div>';
  bindRecipeButtons(grid);
}

function renderProducts() {
  const categories = productCategories();
  const category = $('productCategory');
  category.innerHTML = ['Tutte', ...categories].map(item => '<option' + (state.filters.productCat === item ? ' selected' : '') + '>' + esc(item) + '</option>').join('');
  $('productSearch').value = state.filters.productSearch;
  const query = state.filters.productSearch.toLowerCase();
  const items = state.products.filter(product => (
    (state.filters.productCat === 'Tutte' || product.category === state.filters.productCat) &&
    (!query || (product.name + ' ' + product.category + ' ' + product.note).toLowerCase().includes(query))
  ));
  $('productVisible').textContent = items.length + ' di ' + state.products.length + ' prodotti';
  const list = $('productList');
  list.innerHTML = items.length ? categories.filter(item => items.some(product => product.category === item)).map(item => {
    const rows = items.filter(product => product.category === item);
    return '<section class="category"><h3>' + esc(item) + ' <span class="hint">' + rows.filter(product => product.acquired).length + '/' + rows.length + ' acquistati</span></h3><div class="scroll"><table><thead><tr><th>Prodotto</th><th>Per persona</th><th>Consigliata</th><th>Da acquistare</th><th>Prezzo</th><th>Costo</th><th>✓</th></tr></thead><tbody>' +
      rows.map(product => '<tr class="' + (product.acquired ? 'acquired' : '') + '">' +
        '<td><span class="product-name">' + esc(product.name) + '</span><span class="note">' + esc(product.note || '') + '</span></td>' +
        '<td>' + (product.perPerson != null ? '<input class="number pp" data-id="' + esc(product.id) + '" type="number" min="0" step="' + productStep(product) + '" value="' + product.perPerson + '"> ' + esc(product.unit) : '—') + '</td>' +
        '<td><b>' + fmt(rec(product)) + ' ' + esc(product.unit) + '</b><span class="note">' + esc(equiv(product, rec(product))) + '</span></td>' +
        '<td><button class="icon-btn qminus" data-id="' + esc(product.id) + '" aria-label="Riduci ' + esc(product.name) + '">−</button> <input class="number actual" data-id="' + esc(product.id) + '" type="number" min="0" step="' + productStep(product) + '" value="' + qty(product) + '"> <button class="icon-btn qplus" data-id="' + esc(product.id) + '" aria-label="Aumenta ' + esc(product.name) + '">+</button>' + (product.manual ? '<span class="manual"> MANUALE</span>' : '') + '</td>' +
        '<td><input class="price" data-id="' + esc(product.id) + '" type="number" min="0" step=".01" value="' + num(product.price) + '"></td>' +
        '<td><b>' + euro(qty(product) * num(product.price)) + '</b></td>' +
        '<td><input class="bought" data-id="' + esc(product.id) + '" type="checkbox"' + (product.acquired ? ' checked' : '') + ' aria-label="Acquistato ' + esc(product.name) + '"></td>' +
      '</tr>').join('') + '</tbody></table></div></section>';
  }).join('') : '<div class="empty">🔍 Nessun prodotto trovato.</div>';

  category.onchange = event => {
    state.filters.productCat = event.target.value;
    save();
    renderProducts();
  };
  $('productSearch').oninput = event => {
    state.filters.productSearch = event.target.value;
    renderProducts();
  };
  list.querySelectorAll('.pp').forEach(input => input.onchange = () => mutProduct(input.dataset.id, product => { product.perPerson = num(input.value); }));
  list.querySelectorAll('.actual').forEach(input => input.onchange = () => mutProduct(input.dataset.id, product => { product.manual = true; product.manualQty = num(input.value); }));
  list.querySelectorAll('.price').forEach(input => input.onchange = () => mutProduct(input.dataset.id, product => { product.price = num(input.value); }));
  list.querySelectorAll('.bought').forEach(input => input.onchange = () => mutProduct(input.dataset.id, product => { product.acquired = input.checked; }));
  list.querySelectorAll('.qminus,.qplus').forEach(button => {
    button.onclick = () => mutProduct(button.dataset.id, product => {
      product.manual = true;
      product.manualQty = Math.max(0, decimal(qty(product) + (button.classList.contains('qplus') ? 1 : -1) * productStep(product), 2));
    });
  });
  renderShopping();
}

function mutProduct(id, callback) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  callback(product);
  save();
  renderAll();
}

function renderShopping() {
  const rows = allShoppingRows();
  const total = rows.length;
  const done = rows.filter(row => row.acquired).length;
  const percent = total ? Math.round(done / total * 100) : 0;
  $('purchaseProgress').textContent = done + '/' + total + ' · ' + percent + '% · ' + euro(shoppingCost());
  $('purchaseBar').style.width = percent + '%';
  $('shoppingMeta').textContent = total + ' righe · ' + (total - done) + ' da completare';
  $('shoppingBody').innerHTML = rows.map(row => {
    const recipeRow = row.origin === 'recipe';
    const status = row.origin === 'recipe'
      ? '<input type="checkbox" class="recipe-bought" data-recipe-ids="' + esc((row.recipeIds || []).join(',')) + '"' + (row.acquired ? ' checked' : '') + ' aria-label="Ricetta preparata ' + esc(row.name) + '">'
      : '<span class="status ' + (row.acquired ? 'done' : '') + '">' + (row.acquired ? '✓ Acquistato' : 'Da comprare') + '</span>';
    const quantity = recipeRow
      ? '<input class="number actual recipe-quantity" data-recipe-row="' + esc(row.id) + '" type="number" min="0" step="' + (['kg', 'L'].includes(row.unit) ? '.01' : '1') + '" value="' + row.quantity + '" aria-label="Quantità ricetta ' + esc(row.name) + '"> ' + esc(row.unit) + (row.hasQuantityOverride ? '<span class="manual"> MANUALE</span>' : '')
      : fmt(row.quantity) + ' ' + esc(row.unit);
    const price = recipeRow
      ? '<input class="price recipe-price" data-recipe-row="' + esc(row.id) + '" type="number" min="0" step=".01" value="' + num(row.price) + '" aria-label="Prezzo unitario ricetta ' + esc(row.name) + '">' + (row.hasPriceOverride ? '<span class="manual"> MANUALE</span>' : '') + '<span class="note">€/unità · ' + euro(row.quantity * row.price) + ' stimati</span>'
      : euro(row.quantity * row.price);
    return '<tr><td>' + esc(row.category) + '</td><td><b>' + esc(row.name) + '</b></td><td>' + (recipeRow ? 'Ricetta' : 'Lista base') + '</td><td>' + quantity + '</td><td>' + price + '</td><td>' + status + '</td></tr>';
  }).join('');
  $('shoppingBody').querySelectorAll('[data-recipe-ids]').forEach(input => {
    input.onchange = () => toggleRecipeAcquired(input.dataset.recipeIds.split(',').filter(Boolean), input.checked);
  });
  $('shoppingBody').querySelectorAll('.recipe-quantity').forEach(input => {
    input.onchange = () => updateRecipeShoppingQuantity(input.dataset.recipeRow, input.value);
  });
  $('shoppingBody').querySelectorAll('.recipe-price').forEach(input => {
    input.onchange = () => updateRecipeShoppingPrice(input.dataset.recipeRow, input.value);
  });
}

function renderDrinkMix() {
  const totals = drinkCategoryTotals();
  const root = $('drinkMix');
  root.innerHTML = DRINK_MIX_CATEGORIES.map(category => {
    const percentage = state.drinkMix[category.id];
    return '<div class="mix-category-row"><div><b>' + esc(category.icon + ' ' + category.label) + '</b><small>' + fmt(totals[category.id]) + ' bevande stimate</small></div><input type="range" min="0" max="100" step="1" value="' + percentage + '" data-drink-mix="' + esc(category.id) + '" aria-label="Percentuale ' + esc(category.label) + '"><label class="percent-input" for="mix-' + category.id + '"><span class="sr-only">Percentuale ' + esc(category.label) + '</span><input id="mix-' + category.id + '" type="number" min="0" max="100" step="1" value="' + percentage + '" data-drink-mix="' + esc(category.id) + '">%</label></div>';
  }).join('');
  root.querySelectorAll('[data-drink-mix]').forEach(input => {
    input.onchange = () => {
      setDrinkMix(input.dataset.drinkMix, input.value);
      save();
      renderAll();
    };
  });
  $('mixTotal').textContent = DRINK_MIX_IDS.reduce((sum, id) => sum + state.drinkMix[id], 0) + '% · ' + fmt(totalDrinks()) + ' bevande stimate';
  $('mixSuggestion').textContent = state.drinkMixManual ? 'Mix personalizzato.' : 'Mix suggerito dai profili.';
  $('suggestedMixBtn').onclick = () => {
    useSuggestedDrinkMix();
    save();
    renderAll();
    toast('↺ Mix aggiornato dai profili');
  };
}

function renderDrinks() {
  const categories = ['Tutti', ...new Set(DRINKS.map(drink => drink.category))];
  const select = $('drinkCategory');
  select.innerHTML = categories.map(category => '<option' + (state.filters.drinkCat === category ? ' selected' : '') + '>' + esc(category) + '</option>').join('');
  $('drinkSearch').value = state.filters.drinkSearch;
  const query = state.filters.drinkSearch.toLowerCase();
  const items = DRINKS.filter(drink => (
    (state.filters.drinkCat === 'Tutti' || drink.category === state.filters.drinkCat) &&
    (!query || (drink.name + ' ' + drink.category).toLowerCase().includes(query))
  ));
  $('drinkSelected').textContent = state.selected.length + ' cocktail selezionati';
  const grid = $('drinkGrid');
  grid.innerHTML = items.map(drink => {
    const selectedDrink = state.selected.includes(drink.id);
    return '<button class="drink ' + (selectedDrink ? 'selected' : '') + '" type="button" data-drink="' + esc(drink.id) + '" aria-pressed="' + selectedDrink + '"><span class="selected-mark">✓</span><span class="emoji">' + esc(drink.emoji) + '</span><b>' + esc(drink.name) + '</b><small>' + esc(drink.category) + ' · ' + '★'.repeat(drink.difficulty) + '☆'.repeat(3 - drink.difficulty) + '</small><div class="recipe"><strong>Ricetta</strong>' + drink.ingredients.map(ingredient => '<div><span>' + esc(ingredient.name) + '</span><span>' + ingredient.ml + ' ml</span></div>').join('') + '<div>' + (drink.ice ? '🧊 Ghiaccio' : 'Senza ghiaccio') + (drink.garnish ? ' · ' + esc(drink.garnish) : '') + '</div></div></button>';
  }).join('');
  select.onchange = event => {
    state.filters.drinkCat = event.target.value;
    save();
    renderDrinks();
  };
  $('drinkSearch').oninput = event => {
    state.filters.drinkSearch = event.target.value;
    renderDrinks();
  };
  grid.querySelectorAll('[data-drink]').forEach(button => {
    button.onclick = () => toggleCocktail(button.dataset.drink);
  });
}

function renderMixer() {
  const cocktails = selected();
  const cocktailTotal = drinkCategoryTotals().cocktail;
  $('mixerMeta').textContent = fmt(cocktailTotal) + ' cocktail dal mix · ' + cocktails.length + ' ricette';
  const root = $('mixerList');
  root.innerHTML = cocktails.length ? cocktails.map(drink => (
    '<div class="mix-row"><span>' + esc(drink.emoji) + '</span><div><b>' + esc(drink.name) + '</b><span class="note">' + cocktailShare(drink.id) + '% della quota cocktail</span></div><div class="range-control"><input type="range" min="0" max="100" step="1" value="' + cocktailShare(drink.id) + '" data-cocktail-share="' + esc(drink.id) + '" aria-label="Ripartizione ' + esc(drink.name) + '"><b>' + cocktailShare(drink.id) + '%</b></div><output>' + fmt(mixCount(drink)) + '</output><button class="icon-btn remove-mix" type="button" data-remove-cocktail="' + esc(drink.id) + '" aria-label="Rimuovi ' + esc(drink.name) + '">×</button></div>'
  )).join('') : '<div class="empty">🎚️ Seleziona un cocktail: verrà ripartita soltanto la quota cocktail già prevista dal mix.</div>';
  root.querySelectorAll('[data-cocktail-share]').forEach(input => {
    input.onchange = () => {
      setCocktailShare(input.dataset.cocktailShare, input.value);
      save();
      renderAll();
    };
  });
  root.querySelectorAll('[data-remove-cocktail]').forEach(button => {
    button.onclick = () => toggleCocktail(button.dataset.removeCocktail);
  });
}

function renderDrinkResults() {
  const categoryTotals = drinkCategoryTotals();
  const drinks = selected();
  $('drinkBars').innerHTML = DRINK_MIX_CATEGORIES.map(category => (
    '<div class="bar-row"><span>' + esc(category.icon + ' ' + category.label) + '</span><div class="bar-bg"><div class="bar" style="width:' + state.drinkMix[category.id] + '%"></div></div><b>' + state.drinkMix[category.id] + '% · ' + fmt(categoryTotals[category.id]) + '</b></div>'
  )).join('') + (drinks.length ? drinks.map(drink => '<div class="bar-row nested"><span>' + esc(drink.emoji + ' ' + drink.name) + '</span><div class="bar-bg"><div class="bar" style="width:' + cocktailShare(drink.id) + '%"></div></div><b>' + cocktailShare(drink.id) + '% · ' + fmt(mixCount(drink)) + '</b></div>').join('') : '');

  const foodStats = profileStats('food');
  const drinkStats = profileStats('drink');
  $('profileBars').innerHTML =
    '<div class="hint">Food</div>' + Object.entries(state.foodProfiles).filter(([id]) => foodStats[id]).map(([id, profile]) => '<div class="bar-row"><span>' + esc(profile.icon + ' ' + profile.label) + '</span><div class="bar-bg"><div class="bar" style="width:' + (grillUnits() ? foodStats[id] * profile.total / grillUnits() * 100 : 0) + '%"></div></div><b>' + foodStats[id] + ' · ' + fmt(profile.total) + '×</b></div>').join('') +
    '<div class="hint profile-bar-title">Bevande</div>' + Object.entries(state.drinkProfiles).filter(([id]) => drinkStats[id]).map(([id, profile]) => '<div class="bar-row"><span>' + esc(profile.icon + ' ' + profile.label) + '</span><div class="bar-bg"><div class="bar" style="width:' + (drinkServings() ? drinkStats[id] * profile.total / drinkServings() * 100 : 0) + '%"></div></div><b>' + drinkStats[id] + ' · ' + fmt(profile.total) + '</b></div>').join('');

  const ingredientRows = ingredients();
  $('ingredientList').innerHTML = ingredientRows.length ? ingredientRows.map(([name, millilitres]) => (
    '<div class="ingredient"><b>' + esc(name) + '</b><input type="number" min="50" step="50" value="' + bottle(name) + '" data-bottle="' + esc(name) + '" aria-label="Capacità bottiglia ' + esc(name) + ' ml"><span class="liters">' + (millilitres / 1000).toFixed(2) + ' L</span><span>' + Math.ceil(millilitres / bottle(name)) + ' bott.</span></div>'
  )).join('') : '<div class="empty">Gli ingredienti compariranno dopo aver selezionato cocktail e quota cocktail.</div>';
  $('ingredientList').querySelectorAll('[data-bottle]').forEach(input => {
    input.onchange = () => {
      state.bottleSizes[input.dataset.bottle] = whole(input.value, 50, 10000);
      save();
      renderAll();
    };
  });
  $('bottleGrid').innerHTML = ingredientRows.map(([name, millilitres]) => (
    '<div class="bottle"><span>' + esc(name) + '</span><b>' + Math.ceil(millilitres / bottle(name)) + '×</b><small>' + (millilitres / 1000).toFixed(2) + ' L · ' + bottle(name) + ' ml</small></div>'
  )).join('');
}

function renderEventBrief() {
  const root = $('eventBrief');
  if (!root) return;
  root.innerHTML =
    '<label>Nome evento<input data-event-meta="title" maxlength="100" placeholder="es. Grigliata di sabato" value="' + esc(state.event.title) + '"></label>' +
    '<label>Data<input data-event-meta="date" type="date" value="' + esc(state.event.date) + '"></label>' +
    '<label>Luogo<input data-event-meta="location" maxlength="120" placeholder="es. Terrazza di casa" value="' + esc(state.event.location) + '"></label>' +
    '<label>Budget obiettivo (€)<input data-event-meta="budget" type="number" min="0" max="1000000" step="0.01" value="' + num(state.event.budget) + '"></label>' +
    '<label class="event-notes">Note organizzative<textarea data-event-meta="notes" maxlength="1000" placeholder="Orari, contatti, promemoria…">' + esc(state.event.notes) + '</textarea></label>';
  root.querySelectorAll('[data-event-meta]').forEach(input => {
    input.onchange = () => updateEventMeta(input.dataset.eventMeta, input.value);
  });
}

function renderPlan() {
  const checks = planChecks();
  $('planCheckMeta').textContent = checks.length ? checks.length + ' segnali' : 'Tutto in ordine';
  $('planChecks').innerHTML = checks.length ? checks.map(check =>
    '<div class="plan-check ' + esc(check.level) + '"><span>' + (check.level === 'good' ? '✓' : check.level === 'warn' ? '!' : 'i') + '</span><p>' + esc(check.text) + '</p></div>'
  ).join('') : '<div class="empty">✓ Nessuna anomalia rilevata nel piano attuale.</div>';
  const budget = num(state.event.budget);
  const difference = budgetDifference();
  $('budgetSummary').innerHTML =
    '<div><span>Stimato</span><b>' + euro(shoppingCost()) + '</b></div>' +
    '<div><span>Per ospite</span><b>' + euro(costPerPlanningGuest()) + '</b><small>' + planningParticipants().length + ' nei calcoli</small></div>' +
    '<div><span>' + (budget ? (difference >= 0 ? 'Disponibile' : 'Oltre budget') : 'Budget obiettivo') + '</span><b class="' + (budget && difference < 0 ? 'negative' : '') + '">' + (budget ? euro(Math.abs(difference)) : '—') + '</b><small>' + (budget ? 'su ' + euro(budget) : 'Impostalo nella scheda evento') + '</small></div>';

  const rows = allShoppingRows();
  const actions = [['none', 'Nessuna azione'], ['keep', 'Conserva'], ['freeze', 'Congela'], ['share', 'Condividi'], ['donate', 'Dona']];
  $('leftoversList').innerHTML = rows.length ? rows.map(row => {
    const key = row.origin + ':' + row.id;
    const saved = state.leftovers[key] || { action: 'none', note: '' };
    return '<div class="leftover-row"><div><b>' + esc(row.name) + '</b><small>' + esc(row.category) + ' · ' + fmt(row.quantity) + ' ' + esc(row.unit) + '</small></div><select data-leftover-action="' + esc(key) + '" aria-label="Azione avanzi per ' + esc(row.name) + '">' + actions.map(([id, label]) => '<option value="' + id + '"' + (saved.action === id ? ' selected' : '') + '>' + label + '</option>').join('') + '</select><input data-leftover-note="' + esc(key) + '" maxlength="240" placeholder="Nota facoltativa" value="' + esc(saved.note) + '"></div>';
  }).join('') : '<div class="empty">Aggiungi prodotti o ricette per pianificare gli avanzi.</div>';
  $('leftoversList').querySelectorAll('[data-leftover-action]').forEach(input => input.onchange = () => updateLeftover(input.dataset.leftoverAction, { action: input.value }));
  $('leftoversList').querySelectorAll('[data-leftover-note]').forEach(input => input.onchange = () => updateLeftover(input.dataset.leftoverNote, { note: input.value }));

  const library = eventLibraryItems();
  $('eventLibrary').innerHTML = library.length ? library.map(record => {
    const saved = normaliseState(record.state);
    const meta = saved?.event || {};
    const active = record.id === state.event.id;
    return '<article class="library-item' + (active ? ' active' : '') + '"><div><b>' + esc(meta.title || 'Evento senza nome') + '</b><small>' + esc((meta.isTemplate ? 'Template · ' : '') + (meta.date || 'Senza data') + (meta.location ? ' · ' + meta.location : '')) + '</small></div><div class="inline">' +
      (active ? '<span class="badge cyan">Aperto</span>' : '<button class="btn" type="button" data-open-event="' + esc(record.id) + '">Apri</button>') +
      (meta.isTemplate ? '<button class="btn" type="button" data-use-template="' + esc(record.id) + '">Usa</button>' : '') + '</div></article>';
  }).join('') : '<div class="empty">La libreria si popola quando salvi o duplichi un evento.</div>';
  $('eventLibrary').querySelectorAll('[data-open-event]').forEach(button => button.onclick = () => openStoredEvent(button.dataset.openEvent));
  $('eventLibrary').querySelectorAll('[data-use-template]').forEach(button => button.onclick = () => createEventFromTemplate(button.dataset.useTemplate));
}

function renderFieldShopping() {
  const remaining = allShoppingRows().filter(row => !row.acquired);
  const categoryCount = new Set(remaining.map(row => row.category)).size;
  $('fieldShoppingSummary').innerHTML = '<b>' + remaining.length + ' voci da completare</b><span>' + categoryCount + ' categorie · ' + euro(remaining.reduce((sum, row) => sum + row.quantity * row.price, 0)) + ' stimati</span>';
  const root = $('fieldShoppingList');
  root.innerHTML = remaining.length ? [...new Set(remaining.map(row => row.category))].map(category => {
    const rows = remaining.filter(row => row.category === category);
    return '<section class="field-category"><h3>' + esc(category) + '<span>' + rows.length + '</span></h3>' + rows.map(row =>
      '<label class="field-row"><input type="checkbox" data-field-origin="' + esc(row.origin) + '" data-field-id="' + esc(row.origin === 'recipe' ? row.recipeIds.join(',') : row.id) + '"><span class="field-check">✓</span><span><b>' + esc(row.name) + '</b><small>' + fmt(row.quantity) + ' ' + esc(row.unit) + (row.price ? ' · ' + euro(row.quantity * row.price) : '') + '</small></span></label>'
    ).join('') + '</section>';
  }).join('') : '<div class="empty">✓ Nessuna voce da acquistare o preparare.</div>';
  root.querySelectorAll('[data-field-origin]').forEach(input => input.onchange = () => toggleFieldShopping(input.dataset.fieldOrigin, input.dataset.fieldId, input.checked));
}

function renderOverview() {
  const ingredientRows = ingredients();
  const bottles = ingredientRows.reduce((sum, item) => sum + Math.ceil(item[1] / bottle(item[0])), 0);
  $('ovGuests').textContent = state.participantMode === 'separate' ? grillers() + ' / ' + drinkers() : planningParticipants().length;
  $('ovCost').textContent = euro(shoppingCost());
  $('ovDrinks').textContent = fmt(totalDrinks());
  $('ovBottles').textContent = bottles || '—';
}

function renderAll() {
  renderEventBrief();
  renderGuests();
  renderProfileEditor();
  renderEventType();
  renderFoodMenu();
  renderCatalog();
  renderProducts();
  renderShopping();
  renderDrinkMix();
  renderDrinks();
  renderMixer();
  renderDrinkResults();
  renderPlan();
  renderFieldShopping();
  renderOverview();
}
