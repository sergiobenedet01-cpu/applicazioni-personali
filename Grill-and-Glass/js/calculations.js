function selected() {
  return state.selected.map(id => DRINKS.find(drink => drink.id === id)).filter(Boolean);
}

function foodProfile(id) {
  return state.foodProfiles[id] || state.foodProfiles.normal || DEFAULT_FOOD_PROFILES.normal;
}

function drinkProfile(id) {
  return state.drinkProfiles[id] || state.drinkProfiles.moderate || DEFAULT_DRINK_PROFILES.moderate;
}

function guests() {
  return state.participants.length;
}

function planningParticipants() {
  return state.participants.filter(person => person.rsvp === 'confirmed' || (state.event.includeMaybe && person.rsvp === 'maybe'));
}

function rsvpCount(status) {
  return state.participants.filter(person => person.rsvp === status).length;
}

function grillers() {
  return planningParticipants().filter(person => person.grillProfile !== 'none').length;
}

function drinkers() {
  return planningParticipants().filter(person => person.drinkProfile !== 'none').length;
}

function grillUnits() {
  return decimal(planningParticipants().reduce((sum, person) => sum + num(foodProfile(person.grillProfile).total, 0, 5), 0), 2);
}

function drinkUnits() {
  return decimal(planningParticipants().reduce((sum, person) => sum + num(drinkProfile(person.drinkProfile).legacyMultiplier, 0, 5), 0), 2);
}

function drinkServings() {
  return decimal(planningParticipants().reduce((sum, person) => sum + num(drinkProfile(person.drinkProfile).total, 0, 20), 0), 2);
}

function estimate() {
  return drinkServings();
}

function profileStats(area) {
  const profiles = area === 'food' || area === 'grill' ? DEFAULT_FOOD_PROFILES : DEFAULT_DRINK_PROFILES;
  const key = area === 'food' || area === 'grill' ? 'grillProfile' : 'drinkProfile';
  return Object.fromEntries(Object.keys(profiles).map(id => [id, planningParticipants().filter(person => person[key] === id).length]));
}

function costPerPlanningGuest() {
  return decimal(shoppingCost() / Math.max(1, planningParticipants().length), 2);
}

function budgetDifference() {
  return Math.round((num(state.event.budget) - shoppingCost()) * 100) / 100;
}

function hasDietaryProfile(profileId) {
  return planningParticipants().some(person => person.grillProfile === profileId);
}

function hasRecipeTag(tag) {
  return selectedFoodRecipes(true).some(recipe => recipe.tags.some(item => String(item).toLowerCase() === tag));
}

function planChecks() {
  const checks = [];
  const rows = allShoppingRows();
  if (!state.event.title.trim()) checks.push({ level: 'info', text: 'Dai un nome all’evento: comparirà nei fogli operativi e nella libreria.' });
  if (!planningParticipants().length) checks.push({ level: 'warn', text: 'Non ci sono ospiti confermati per i calcoli. Conferma almeno una persona o includi i “forse”.' });
  if (!selectedFoodRecipes(true).length) checks.push({ level: 'warn', text: 'Il menu Food non contiene ancora ricette attive.' });
  if (hasDietaryProfile('vegetarian') && !hasRecipeTag('vegetariano') && !hasRecipeTag('vegano')) checks.push({ level: 'warn', text: 'Ci sono ospiti vegetariani ma nessuna ricetta vegetariana o vegana selezionata.' });
  if (hasDietaryProfile('vegan') && !hasRecipeTag('vegano')) checks.push({ level: 'warn', text: 'Ci sono ospiti vegani ma nessuna ricetta vegana selezionata.' });
  if (drinkCategoryTotals().cocktail > 0 && !state.selected.length) checks.push({ level: 'warn', text: 'Il mix prevede cocktail, ma non è stata selezionata alcuna ricetta cocktail.' });
  if (drinkServings() > 0 && !state.drinkMix.nonAlcoholic) checks.push({ level: 'info', text: 'Il mix non include bevande analcoliche: verifica che la scelta sia intenzionale.' });
  if (rows.some(row => row.quantity > 0 && !row.price)) checks.push({ level: 'info', text: 'Alcuni articoli non hanno un prezzo: il budget è una stima parziale.' });
  if (state.event.budget > 0 && budgetDifference() < 0) checks.push({ level: 'warn', text: 'Il costo stimato supera il budget obiettivo di ' + euro(Math.abs(budgetDifference())) + '.' });
  if (rows.length && rows.every(row => row.acquired)) checks.push({ level: 'good', text: 'Spesa e preparazioni segnate come completate.' });
  return checks;
}

function foodUnitsForCategory(categoryId) {
  const category = FOOD_CATEGORY_BY_ID[categoryId];
  if (!category) return 0;
  const baseline = FOOD_COURSES[category.course]?.baseline || 100;
  return decimal(planningParticipants().reduce((sum, person) => {
    const profile = foodProfile(person.grillProfile);
    if (profile.excludedCategories?.includes(categoryId)) return sum;
    const share = num(profile.courseMix?.[category.course], 0, 100);
    return sum + num(profile.total, 0, 5) * share / baseline;
  }, 0), 2);
}

function foodUnitsForLegacyProduct(product) {
  const categoryId = LEGACY_PRODUCT_CATEGORY[product.category];
  return decimal(planningParticipants().reduce((sum, person) => {
    const profile = foodProfile(person.grillProfile);
    if (categoryId && profile.excludedCategories?.includes(categoryId)) return sum;
    return sum + num(profile.total, 0, 5);
  }, 0), 2);
}

function isDrinkProduct(product) {
  return /^(Bevande|Alcolici)$/i.test(product.category);
}

function rec(product) {
  const units = isDrinkProduct(product) ? drinkUnits() : foodUnitsForLegacyProduct(product);
  const quantity = product.perPerson != null
    ? num(product.perPerson) * units
    : num(product.base) / 7 * units;
  if (['kg', 'L'].includes(product.unit)) return decimal(quantity, 2);
  return Math.max(units ? 1 : 0, Math.ceil(quantity));
}

function qty(product) {
  return product.manual ? num(product.manualQty) : rec(product);
}

function equiv(product, quantity) {
  return product.equiv && product.equivFactor
    ? '≈ ' + fmt(quantity * product.equivFactor) + ' ' + product.equiv
    : '';
}

function productStep(product) {
  return ['kg', 'L'].includes(product.unit) ? 0.1 : (product.unit === 'bicchieri' ? 0.5 : 1);
}

function productCategories() {
  return [...new Set(state.products.map(product => product.category))];
}

function currentEventType() {
  return EVENT_TYPE_BY_ID[state.food.eventType] || EVENT_TYPE_BY_ID.barbecue;
}

function activeFoodCategories() {
  return FOOD_CATEGORIES.filter(category => state.food.activeCategoryIds.includes(category.id));
}

function selectedFoodRecipes(activeOnly = false) {
  return state.food.selectedRecipeIds
    .map(id => FOOD_RECIPE_BY_ID[id])
    .filter(Boolean)
    .filter(recipe => !activeOnly || state.food.activeCategoryIds.includes(recipe.category));
}

function recipesForCategory(categoryId, activeOnly = false) {
  return FOOD_RECIPES.filter(recipe => {
    const visibleForEvent = recipe.eventTypes.includes(state.food.eventType);
    return recipe.category === categoryId && (!activeOnly || visibleForEvent);
  });
}

function recipeFoodUnits(recipe) {
  const siblings = selectedFoodRecipes(true).filter(item => item.category === recipe.category);
  const totalWeight = siblings.reduce((sum, item) => sum + num(item.portionWeight, 0, 100), 0);
  if (!totalWeight) return 0;
  return foodUnitsForCategory(recipe.category) * num(recipe.portionWeight, 0, 100) / totalWeight;
}

function recipeShoppingItems() {
  const grouped = new Map();
  for (const recipe of selectedFoodRecipes(true)) {
    const units = recipeFoodUnits(recipe);
    recipe.ingredients.forEach((ingredient, ingredientIndex) => {
      const key = [ingredient.shoppingCategory, ingredient.name, ingredient.unit].join('|');
      const current = grouped.get(key) || {
        id: 'recipe-' + key.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
        category: ingredient.shoppingCategory,
        name: ingredient.name,
        unit: ingredient.unit,
        quantity: 0,
        estimatedCost: 0,
        recipes: [],
        sources: []
      };
      const overrideKey = recipeIngredientKey(recipe.id, ingredientIndex);
      const override = state.recipeOverrides?.[overrideKey] || {};
      const defaultQuantity = num(ingredient.amount) * units;
      const savedQuantity = Number(override.quantity);
      const quantity = Number.isFinite(savedQuantity) && savedQuantity >= 0 ? savedQuantity : defaultQuantity;
      const defaultPrice = num(ingredient.price);
      const savedPrice = Number(override.price);
      const price = Number.isFinite(savedPrice) && savedPrice >= 0 ? savedPrice : defaultPrice;
      current.quantity += quantity;
      current.estimatedCost += quantity * price;
      if (!current.recipes.includes(recipe.id)) current.recipes.push(recipe.id);
      current.sources.push({
        overrideKey,
        recipeId: recipe.id,
        ingredientIndex,
        defaultQuantity,
        quantity,
        defaultPrice,
        price,
        hasQuantityOverride: Number.isFinite(savedQuantity) && savedQuantity >= 0,
        hasPriceOverride: Number.isFinite(savedPrice) && savedPrice >= 0
      });
      grouped.set(key, current);
    });
  }
  return [...grouped.values()].map(item => {
    const quantity = ['kg', 'L'].includes(item.unit)
      ? decimal(item.quantity, 2)
      : Math.max(item.quantity ? 1 : 0, Math.ceil(item.quantity));
    return {
      ...item,
      quantity,
      price: item.quantity ? decimal(item.estimatedCost / item.quantity, 2) : 0,
      hasQuantityOverride: item.sources.some(source => source.hasQuantityOverride),
      hasPriceOverride: item.sources.some(source => source.hasPriceOverride)
    };
  });
}

function recipeCost() {
  return recipeShoppingItems().reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function allShoppingRows() {
  return [
    ...state.products.map(product => ({
      origin: 'product',
      id: product.id,
      category: product.category,
      name: product.name,
      unit: product.unit,
      quantity: qty(product),
      price: num(product.price),
      perPerson: product.perPerson,
      acquired: product.acquired,
      equivalence: equiv(product, qty(product))
    })),
    ...recipeShoppingItems().map(item => ({
      origin: 'recipe',
      id: item.id,
      recipeIds: item.recipes,
      recipeSources: item.sources,
      category: item.category,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      price: item.price,
      hasQuantityOverride: item.hasQuantityOverride,
      hasPriceOverride: item.hasPriceOverride,
      perPerson: null,
      acquired: item.recipes.every(id => state.recipeAcquired[id]),
      equivalence: 'Ricetta selezionata'
    }))
  ];
}

function shoppingCost() {
  return allShoppingRows().reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function cocktailShare(drinkId) {
  return num(state.cocktailShares[drinkId], 0, 100);
}

function drinkCategoryTotals() {
  const total = drinkServings();
  return Object.fromEntries(DRINK_MIX_IDS.map(id => [id, decimal(total * num(state.drinkMix[id], 0, 100) / 100, 2)]));
}

function totalDrinks() {
  return drinkServings();
}

function mixCount(drink) {
  return decimal(drinkCategoryTotals().cocktail * cocktailShare(drink.id) / 100, 2);
}

function bottle(name) {
  return num(state.bottleSizes[name] || BOTTLES[name] || 700, 50, 10000);
}

function ingredients() {
  const output = {};
  selected().forEach(drink => {
    drink.ingredients.forEach(ingredient => {
      output[ingredient.name] = (output[ingredient.name] || 0) + ingredient.ml * mixCount(drink);
    });
  });
  return Object.entries(output).sort((a, b) => b[1] - a[1]);
}

function allocateRemainder(weights, ids, amount) {
  const total = ids.reduce((sum, id) => sum + num(weights[id]), 0);
  const source = total ? weights : Object.fromEntries(ids.map(id => [id, 1]));
  const divisor = total || ids.length;
  const allocation = ids.map((id, index) => {
    const exact = num(source[id]) / divisor * amount;
    return { id, index, value: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remaining = amount - allocation.reduce((sum, item) => sum + item.value, 0);
  [...allocation].sort((a, b) => b.fraction - a.fraction || a.index - b.index).forEach(item => {
    if (remaining > 0) {
      item.value += 1;
      remaining -= 1;
    }
  });
  return Object.fromEntries(allocation.map(item => [item.id, item.value]));
}

function rebalanceMix(current, changedId, requested, ids) {
  const value = whole(requested, 0, 100);
  const others = ids.filter(id => id !== changedId);
  const result = { [changedId]: value, ...allocateRemainder(current, others, 100 - value) };
  return Object.fromEntries(ids.map(id => [id, result[id] || 0]));
}

function setDrinkMix(categoryId, value) {
  if (!DRINK_MIX_IDS.includes(categoryId)) return;
  state.drinkMix = rebalanceMix(state.drinkMix, categoryId, value, DRINK_MIX_IDS);
  state.drinkMixManual = true;
}

function useSuggestedDrinkMix() {
  state.drinkMix = suggestedMixFromRecords(planningParticipants(), state.drinkProfiles);
  state.drinkMixManual = false;
}

function ensureCocktailShares() {
  state.cocktailShares = normaliseDistribution(state.cocktailShares, state.selected, equalDistribution(state.selected));
}

function setCocktailShare(drinkId, value) {
  if (!state.selected.includes(drinkId)) return;
  if (state.selected.length === 1) {
    state.cocktailShares = { [drinkId]: 100 };
    return;
  }
  state.cocktailShares = rebalanceMix(state.cocktailShares, drinkId, value, state.selected);
}
