function cloneProfiles(definitions) {
  return copy(definitions);
}

function eventMenuDefaults(eventType = 'barbecue') {
  const type = EVENT_TYPE_BY_ID[eventType] || EVENT_TYPE_BY_ID.barbecue;
  return {
    eventType: type.id,
    activeCategoryIds: [...type.categories],
    selectedRecipeIds: [],
    collapsedCategoryIds: [],
    catalogCategory: 'all',
    catalogSearch: ''
  };
}

function defaultDrinkMix() {
  return copy(DEFAULT_DRINK_PROFILES.moderate.categoryMix);
}

/*
 * Gli ingredienti del catalogo non vengono mai mutati. Questa chiave collega
 * invece un eventuale aggiustamento manuale alla singola voce di una ricetta,
 * prima che voci uguali vengano aggregate nella lista della spesa.
 */
function recipeIngredientKey(recipeId, ingredientIndex) {
  return String(recipeId) + ':' + Number(ingredientIndex);
}

function participants(count = 8) {
  return Array.from({ length: count }, (_, index) => ({
    id: cryptoId(),
    name: `Ospite ${index + 1}`,
    grillProfile: 'normal',
    drinkProfile: 'moderate',
    rsvp: 'confirmed',
    group: ''
  }));
}

function defaultEventMeta() {
  return {
    id: 'event-' + cryptoId(),
    title: '',
    date: '',
    location: '',
    notes: '',
    budget: 0,
    includeMaybe: false,
    isTemplate: false,
    createdAt: new Date().toISOString()
  };
}

function defaultState(count = 8) {
  return {
    schema: EVENT_SCHEMA,
    event: defaultEventMeta(),
    participantMode: 'single',
    participants: participants(count),
    products: structuredClone(PRODUCT_SEED),
    selected: [],
    perPerson: {},
    cocktailShares: {},
    bottleSizes: {},
    foodProfiles: cloneProfiles(DEFAULT_FOOD_PROFILES),
    drinkProfiles: cloneProfiles(DEFAULT_DRINK_PROFILES),
    food: eventMenuDefaults(),
    drinkMix: defaultDrinkMix(),
    drinkMixManual: false,
    recipeAcquired: {},
    recipeOverrides: {},
    leftovers: {},
    filters: {
      productCat: 'Tutte',
      productSearch: '',
      drinkCat: 'Tutti',
      drinkSearch: ''
    }
  };
}

function legacyProduct(product) {
  return {
    ...product,
    id: product.id || cryptoId(),
    manual: Boolean(product.manual),
    manualQty: product.manualQty ?? null,
    acquired: Boolean(product.acquired)
  };
}

function load() {
  try {
    const unified = JSON.parse(localStorage.getItem(KEY));
    if (unified?.participants && unified?.products) return unified;
  } catch (_) {
    // Il fallback legacy continua sotto.
  }

  let grill;
  let drink;
  try { grill = JSON.parse(localStorage.getItem(LEGACY_GRILL)); } catch (_) {}
  try { drink = JSON.parse(localStorage.getItem(LEGACY_DRINK)); } catch (_) {}

  const count = Array.isArray(drink?.participants) && drink.participants.length
    ? drink.participants.length
    : Math.max(1, whole(grill?.guests, 1, 500));
  const legacy = defaultState(count);

  if (Array.isArray(grill?.products)) legacy.products = grill.products.map(legacyProduct);
  if (Array.isArray(drink?.participants)) {
    legacy.participants = drink.participants.map((person, index) => ({
      id: person.id || cryptoId(),
      name: person.name || `Ospite ${index + 1}`,
      grillProfile: 'normal',
      drinkProfile: DEFAULT_DRINK_PROFILES[person.profile] ? person.profile : 'moderate'
    }));
  }

  legacy.selected = Array.isArray(drink?.selectedDrinks)
    ? drink.selectedDrinks.filter(id => DRINKS.some(item => item.id === id))
    : [];
  legacy.perPerson = drink?.drinkPerPerson || drink?.drinkPct || {};
  legacy.bottleSizes = drink?.customBottleSizes || {};
  legacy.legacyDrinkProfiles = drink?.drinkProfiles || drink?.profiles || null;
  return legacy;
}

let state = load();
state = normaliseState(state) || defaultState();

function save() {
  queueSave();
}
