import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = file => readFileSync(resolve(root, file), 'utf8');

/**
 * L'app usa script classici nel browser. Questo sandbox mantiene lo stesso
 * ordine di caricamento, evitando dipendenze di test o un browser fittizio.
 */
function sandbox() {
  const values = new Map();
  const context = vm.createContext({
    Array,
    Boolean,
    Date,
    Error,
    Intl,
    JSON,
    Map,
    Math,
    Number,
    Object,
    RegExp,
    Set,
    String,
    structuredClone,
    console,
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    },
    document: { createElement: () => ({ textContent: '', innerHTML: '' }) },
    window: {}
  });

  for (const file of [
    'js/formatters.js',
    'data/defaults.js',
    'data/food-drinks.js',
    'js/storage.js',
    'js/state.js',
    'js/calculations.js'
  ]) {
    vm.runInContext(source(file), context, { filename: file });
  }
  return context;
}

function evaluate(context, expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

test('regressione barbecue: prodotti legacy mantengono pesi e arrotondamenti', () => {
  const context = sandbox();
  const result = evaluate(context, `(() => {
    state = defaultState(2);
    state.participants[0].grillProfile = 'heavy';
    state.participants[0].drinkProfile = 'moderate';
    state.participants[1].grillProfile = 'normal';
    state.participants[1].drinkProfile = 'heavy';
    const salsicce = state.products.find(product => product.name === 'Salsicce');
    const acqua = state.products.find(product => product.name === 'Acqua naturale');
    return {
      eventType: currentEventType().id,
      grillUnits: grillUnits(),
      legacyDrinkUnits: drinkUnits(),
      salsicce: rec(salsicce),
      acqua: rec(acqua)
    };
  })()`);

  assert.deepEqual(result, {
    eventType: 'barbecue',
    grillUnits: 2.35,
    legacyDrinkUnits: 2.5,
    salsicce: 5,
    acqua: 1.5
  });
});

test('normaliseState migra uno stato precedente a Food & Drinks senza perdere dati', () => {
  const context = sandbox();
  const result = evaluate(context, `(() => {
    const migrated = normaliseState({
      participants: [
        { id: 'old-1', name: 'Ada', profile: 'heavy' },
        { id: 'old-2', name: 'Bia', grillProfile: 'vegetarian', drinkProfile: 'light' }
      ],
      products: [{
        id: 'manual-product', category: 'Carne', name: 'Salsicce', base: 14,
        perPerson: 2, unit: 'unità', price: 1.1, manual: true,
        manualQty: 3, acquired: true
      }],
      selectedDrinks: ['spritz-aperol', 'gin-tonic', 'non-esistente'],
      drinkPerPerson: { 'spritz-aperol': 2, 'gin-tonic': 1 },
      customBottleSizes: { Test: 700 },
      foodProfiles: {
        normal: {
          total: 1.25,
          courseMix: { starter: 10, main: 70, side: 20 },
          excludedCategories: ['meat', 'inesistente']
        }
      },
      drinkProfiles: {
        moderate: {
          total: 5,
          categoryMix: { nonAlcoholic: 30, beer: 30, wine: 20, cocktail: 20, other: 0 }
        }
      },
      eventType: 'apericena',
      selectedRecipeIds: ['focaccia-farcita', 'non-esistente']
    });
    return {
      schema: migrated.schema,
      participants: migrated.participants,
      food: migrated.food,
      foodProfile: migrated.foodProfiles.normal,
      drinkProfile: migrated.drinkProfiles.moderate,
      selected: migrated.selected,
      cocktailShares: migrated.cocktailShares,
      drinkMix: migrated.drinkMix,
      drinkMixManual: migrated.drinkMixManual,
      bottleSizes: migrated.bottleSizes,
      product: migrated.products[0],
      idempotent: JSON.stringify(migrated) === JSON.stringify(normaliseState(migrated))
    };
  })()`);

  assert.equal(result.schema, 5);
  assert.deepEqual(result.participants.map(person => ({
    id: person.id,
    grillProfile: person.grillProfile,
    drinkProfile: person.drinkProfile
  })), [
    { id: 'old-1', grillProfile: 'normal', drinkProfile: 'heavy' },
    { id: 'old-2', grillProfile: 'vegetarian', drinkProfile: 'light' }
  ]);
  assert.equal(result.food.eventType, 'apericena');
  assert.deepEqual(result.food.selectedRecipeIds, ['focaccia-farcita']);
  assert.ok(result.food.activeCategoryIds.includes('aperitivo'));
  assert.deepEqual(result.foodProfile.courseMix, { starter: 10, main: 70, side: 20 });
  assert.deepEqual(result.foodProfile.excludedCategories, ['meat']);
  assert.equal(result.foodProfile.total, 1.25);
  assert.equal(result.drinkProfile.total, 5);
  assert.deepEqual(result.selected, ['spritz-aperol', 'gin-tonic']);
  assert.deepEqual(result.cocktailShares, { 'spritz-aperol': 67, 'gin-tonic': 33 });
  assert.deepEqual(result.drinkMix, {
    nonAlcoholic: 0,
    beer: 0,
    wine: 0,
    cocktail: 100,
    other: 0
  });
  assert.equal(result.drinkMixManual, true);
  assert.deepEqual(result.bottleSizes, { Test: 700 });
  assert.deepEqual(result.product, {
    id: 'manual-product',
    category: 'Carne',
    name: 'Salsicce',
    base: 14,
    perPerson: 2,
    unit: 'unità',
    price: 1.1,
    note: '',
    equiv: '',
    equivFactor: 0,
    manual: true,
    manualQty: 3,
    acquired: true
  });
  assert.equal(result.idempotent, true);
});

test('il mixer resta al 100% e non modifica il totale derivato dai profili', () => {
  const context = sandbox();
  const result = evaluate(context, `(() => {
    state = defaultState(2);
    state.participants[0].drinkProfile = 'moderate';
    state.participants[1].drinkProfile = 'light';
    state.drinkMix = { nonAlcoholic: 25, beer: 25, wine: 25, cocktail: 25, other: 0 };
    const before = totalDrinks();
    setDrinkMix('cocktail', 40);
    const rebalanced = { ...state.drinkMix };
    const totals = drinkCategoryTotals();
    const after = totalDrinks();
    setDrinkMix('cocktail', 100);
    return {
      before,
      after,
      rebalanced,
      rebalancedTotal: Object.values(rebalanced).reduce((sum, value) => sum + value, 0),
      totals,
      finalMix: state.drinkMix,
      finalTotal: Object.values(state.drinkMix).reduce((sum, value) => sum + value, 0),
      manual: state.drinkMixManual
    };
  })()`);

  assert.equal(result.before, 6);
  assert.equal(result.after, 6);
  assert.deepEqual(result.rebalanced, {
    nonAlcoholic: 20,
    beer: 20,
    wine: 20,
    cocktail: 40,
    other: 0
  });
  assert.equal(result.rebalancedTotal, 100);
  assert.deepEqual(result.totals, {
    nonAlcoholic: 1.2,
    beer: 1.2,
    wine: 1.2,
    cocktail: 2.4,
    other: 0
  });
  assert.deepEqual(result.finalMix, {
    nonAlcoholic: 0,
    beer: 0,
    wine: 0,
    cocktail: 100,
    other: 0
  });
  assert.equal(result.finalTotal, 100);
  assert.equal(result.manual, true);
});

test('ricette e lista della spesa sono derivate, aggregate e non mutano i prodotti base', () => {
  const context = sandbox();
  const result = evaluate(context, `(() => {
    state = defaultState(2);
    state.food.eventType = 'apericena';
    state.food.activeCategoryIds = ['appetizers', 'sides'];
    state.food.selectedRecipeIds = ['bruschette-pomodoro', 'insalata-stagionale'];
    const productsBefore = JSON.stringify(state.products);
    const first = recipeShoppingItems();
    const second = recipeShoppingItems();
    const rows = allShoppingRows();
    const pomodorini = first.find(item => item.name === 'Pomodorini');
    return {
      productsUntouched: productsBefore === JSON.stringify(state.products),
      productsLength: state.products.length,
      first,
      second,
      recipeRows: rows.filter(row => row.origin === 'recipe').length,
      pomodorini,
      recipeCost: recipeCost(),
      shoppingCost: shoppingCost()
    };
  })()`);

  assert.equal(result.productsUntouched, true);
  assert.deepEqual(result.first, result.second);
  assert.equal(result.recipeRows, result.first.length);
  assert.deepEqual({
    id: result.pomodorini.id,
    category: result.pomodorini.category,
    name: result.pomodorini.name,
    unit: result.pomodorini.unit,
    quantity: result.pomodorini.quantity,
    estimatedCost: result.pomodorini.estimatedCost,
    recipes: result.pomodorini.recipes,
    price: result.pomodorini.price,
    sourceCount: result.pomodorini.sources.length,
    hasQuantityOverride: result.pomodorini.hasQuantityOverride,
    hasPriceOverride: result.pomodorini.hasPriceOverride
  }, {
    id: 'recipe-contorni-pomodorini-kg',
    category: 'Contorni',
    name: 'Pomodorini',
    unit: 'kg',
    quantity: 0.48,
    estimatedCost: 2.16,
    recipes: ['bruschette-pomodoro', 'insalata-stagionale'],
    price: 4.5,
    sourceCount: 2,
    hasQuantityOverride: false,
    hasPriceOverride: false
  });
  assert.ok(result.recipeCost > 0);
  assert.ok(result.shoppingCost >= result.recipeCost);
  assert.ok(result.productsLength > 0);
});

test('gli override ricetta sono persistibili, validati e applicati prima dell’aggregazione', () => {
  const context = sandbox();
  const result = evaluate(context, `(() => {
    state = defaultState(2);
    state.food.eventType = 'apericena';
    state.food.activeCategoryIds = ['appetizers'];
    state.food.selectedRecipeIds = ['bruschette-pomodoro'];
    state.recipeOverrides = {
      'bruschette-pomodoro:1': { quantity: 0.5, price: 6.2 },
      'inesistente:0': { quantity: 99 },
      'bruschette-pomodoro:2': { quantity: -1, price: 'no' }
    };
    const migrated = normaliseState(state);
    state = migrated;
    const pomodorini = recipeShoppingItems().find(item => item.name === 'Pomodorini');
    return {
      overrides: state.recipeOverrides,
      pomodorini: {
        quantity: pomodorini.quantity,
        price: pomodorini.price,
        hasQuantityOverride: pomodorini.hasQuantityOverride,
        hasPriceOverride: pomodorini.hasPriceOverride
      },
      catalogStillIntact: FOOD_RECIPE_BY_ID['bruschette-pomodoro'].ingredients[1].amount === 0.16
    };
  })()`);

  assert.deepEqual(result.overrides, { 'bruschette-pomodoro:1': { quantity: 0.5, price: 6.2 } });
  assert.deepEqual(result.pomodorini, {
    quantity: 0.5,
    price: 6.2,
    hasQuantityOverride: true,
    hasPriceOverride: true
  });
  assert.equal(result.catalogStillIntact, true);
});

test('un profilo Food che esclude una categoria non contribuisce a quella categoria', () => {
  const context = sandbox();
  const result = evaluate(context, `(() => {
    state = defaultState(2);
    state.participants[0].grillProfile = 'normal';
    state.participants[1].grillProfile = 'vegetarian';
    state.foodProfiles.vegetarian.excludedCategories = ['meat'];
    const salsicce = state.products.find(product => product.name === 'Salsicce');
    return {
      foodTotal: grillUnits(),
      meatUnits: foodUnitsForCategory('meat'),
      vegetarianUnits: foodUnitsForCategory('vegetarian'),
      salsicce: rec(salsicce)
    };
  })()`);

  assert.deepEqual(result, {
    foodTotal: 2,
    meatUnits: 1,
    vegetarianUnits: 1.9,
    salsicce: 2
  });
});

test('RSVP, budget e controlli piano usano solo gli ospiti pianificati', () => {
  const context = sandbox();
  const result = evaluate(context, `(() => {
    state = defaultState(2);
    state.participants[0].rsvp = 'confirmed';
    state.participants[1].rsvp = 'maybe';
    state.event.includeMaybe = false;
    state.event.budget = 0.01;
    state.products = [{ id: 'budget-test', category: 'Varie', name: 'Test', base: 1, perPerson: null, unit: 'unità', price: 100, manual: true, manualQty: 1, acquired: false }];
    state.food.selectedRecipeIds = [];
    const confirmedOnly = { guests: planningParticipants().length, food: grillUnits(), drinks: drinkServings() };
    state.event.includeMaybe = true;
    const withMaybe = { guests: planningParticipants().length, food: grillUnits(), drinks: drinkServings() };
    return { confirmedOnly, withMaybe, budgetDifference: budgetDifference(), checks: planChecks().map(item => item.text) };
  })()`);

  assert.deepEqual(result.confirmedOnly, { guests: 1, food: 1, drinks: 4 });
  assert.deepEqual(result.withMaybe, { guests: 2, food: 2, drinks: 8 });
  assert.ok(result.budgetDifference < 0);
  assert.ok(result.checks.some(text => text.includes('menu Food')));
});
