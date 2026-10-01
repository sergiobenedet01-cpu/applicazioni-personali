/* Configurazione centrale di Food & Drinks. I valori sono stime modificabili,
   non prescrizioni nutrizionali o di consumo. */
const FOOD_COURSES = {
  starter: { label: 'Antipasti e aperitivo', baseline: 25 },
  main: { label: 'Portate principali', baseline: 50 },
  side: { label: 'Contorni, pane e dessert', baseline: 25 }
};
const EVENT_SCHEMA = 5;

const FOOD_CATEGORIES = [
  ['appetizers', '🥨', 'Antipasti', 'starter'],
  ['aperitivo', '🫒', 'Aperitivo e finger food', 'starter'],
  ['firstCourses', '🍝', 'Primi', 'main'],
  ['meat', '🥩', 'Carne', 'main'],
  ['poultry', '🍗', 'Pollo e avicolo', 'main'],
  ['fish', '🐟', 'Pesce', 'main'],
  ['vegetarian', '🥗', 'Vegetariano', 'main'],
  ['vegan', '🌱', 'Vegano', 'main'],
  ['sides', '🥦', 'Contorni', 'side'],
  ['breadSauces', '🥖', 'Pane e salse', 'side'],
  ['cheeseColdCuts', '🧀', 'Formaggi e salumi', 'starter'],
  ['dessert', '🍰', 'Dessert', 'side'],
  ['fruit', '🍓', 'Frutta', 'side']
].map(([id, icon, label, course]) => ({ id, icon, label, course }));

const FOOD_CATEGORY_BY_ID = Object.fromEntries(FOOD_CATEGORIES.map(category => [category.id, category]));
const LEGACY_PRODUCT_CATEGORY = {
  Carne: 'meat', Antipasti: 'appetizers', Contorni: 'sides', Pane: 'breadSauces',
  Salse: 'breadSauces', Dolci: 'dessert', Ghiaccio: 'sides',
  'Materiale usa e getta': 'sides', Varie: 'sides'
};

const DEFAULT_FOOD_PROFILES = {
  none: { icon: '🚫', label: 'Non partecipa', total: 0, courseMix: { starter: 34, main: 33, side: 33 }, excludedCategories: [] },
  light: { icon: '🥗', label: 'Leggero', total: 0.7, courseMix: { starter: 30, main: 40, side: 30 }, excludedCategories: [] },
  normal: { icon: '🔥', label: 'Normale', total: 1, courseMix: { starter: 25, main: 50, side: 25 }, excludedCategories: [] },
  heavy: { icon: '🍖', label: 'Abbondante', total: 1.35, courseMix: { starter: 20, main: 60, side: 20 }, excludedCategories: [] },
  vegetarian: { icon: '🌱', label: 'Vegetariano', total: 1, courseMix: { starter: 25, main: 45, side: 30 }, excludedCategories: ['meat', 'poultry', 'fish'] },
  vegan: { icon: '🌿', label: 'Vegano', total: 1, courseMix: { starter: 30, main: 40, side: 30 }, excludedCategories: ['meat', 'poultry', 'fish', 'cheeseColdCuts'] }
};

const DRINK_MIX_CATEGORIES = [
  { id: 'nonAlcoholic', icon: '💧', label: 'Analcolici', responsible: 'Acqua e opzioni analcoliche restano sempre disponibili.' },
  { id: 'beer', icon: '🍺', label: 'Birra' },
  { id: 'wine', icon: '🍷', label: 'Vino' },
  { id: 'cocktail', icon: '🍸', label: 'Cocktail' },
  { id: 'other', icon: '✨', label: 'Altre bevande' }
];
const DRINK_MIX_IDS = DRINK_MIX_CATEGORIES.map(category => category.id);

const DEFAULT_DRINK_PROFILES = {
  none: { icon: '🚫', label: 'Non beve', total: 0, legacyMultiplier: 0, categoryMix: { nonAlcoholic: 100, beer: 0, wine: 0, cocktail: 0, other: 0 } },
  light: { icon: '🍋', label: 'Leggero', total: 2, legacyMultiplier: 0.65, categoryMix: { nonAlcoholic: 50, beer: 25, wine: 15, cocktail: 10, other: 0 } },
  moderate: { icon: '🍸', label: 'Moderato', total: 4, legacyMultiplier: 1, categoryMix: { nonAlcoholic: 30, beer: 30, wine: 20, cocktail: 20, other: 0 } },
  heavy: { icon: '🥃', label: 'Bevitore', total: 7, legacyMultiplier: 1.5, categoryMix: { nonAlcoholic: 20, beer: 35, wine: 20, cocktail: 20, other: 5 } }
};

/* Tuple compatibili con i controlli precedenti; i coefficienti vivono sopra. */
const GRILL_PROFILE = Object.fromEntries(Object.entries(DEFAULT_FOOD_PROFILES).map(([id, profile]) => [id, [profile.icon, profile.label, profile.total]]));
const DRINK_PROFILE = Object.fromEntries(Object.entries(DEFAULT_DRINK_PROFILES).map(([id, profile]) => [id, [profile.icon, profile.label, profile.legacyMultiplier]]));

const EVENT_TYPES = [
  { id: 'barbecue', icon: '🔥', label: 'Grigliata', description: 'Carni, opzioni vegetali, contorni e tavola condivisa.', categories: ['appetizers', 'meat', 'poultry', 'vegetarian', 'sides', 'breadSauces', 'dessert'] },
  { id: 'elegantDinner', icon: '🍽️', label: 'Cena elegante', description: 'Portate ordinate, primi, secondi e dessert.', categories: ['appetizers', 'firstCourses', 'meat', 'fish', 'vegetarian', 'sides', 'dessert', 'fruit'] },
  { id: 'apericena', icon: '🥂', label: 'Apericena', description: 'Finger food, taglieri, focacce e piccoli dessert.', categories: ['aperitivo', 'appetizers', 'vegetarian', 'vegan', 'cheeseColdCuts', 'breadSauces', 'dessert', 'fruit'] },
  { id: 'informalDinner', icon: '🍲', label: 'Pranzo o cena informale', description: 'Menu semplice, flessibile e conviviale.', categories: ['appetizers', 'firstCourses', 'meat', 'poultry', 'vegetarian', 'sides', 'breadSauces', 'dessert'] },
  { id: 'buffet', icon: '🍱', label: 'Buffet', description: 'Scelte modulari e facili da servire in autonomia.', categories: ['aperitivo', 'appetizers', 'firstCourses', 'meat', 'fish', 'vegetarian', 'vegan', 'sides', 'cheeseColdCuts', 'dessert', 'fruit'] }
];
const EVENT_TYPE_BY_ID = Object.fromEntries(EVENT_TYPES.map(type => [type.id, type]));

const R = (id, title, category, eventTypes, tags, portionWeight, ingredients) => ({
  id, title, category, eventTypes, tags, portionWeight,
  note: 'Quantità indicative: verifica e adatta in base agli invitati e alle abitudini reali.',
  ingredients: ingredients.map(([name, amount, unit, price = 0, shoppingCategory = 'Ricette']) => ({ name, amount, unit, price, shoppingCategory }))
});

const FOOD_RECIPES = [
  R('bruschette-pomodoro', 'Bruschette al pomodoro', 'appetizers', ['barbecue', 'apericena', 'informalDinner', 'buffet'], ['vegetarian', 'finger food'], 1, [['Pane rustico', 0.12, 'kg', 3.5, 'Pane'], ['Pomodorini', 0.16, 'kg', 4.5, 'Contorni'], ['Olio evo', 0.03, 'L', 9, 'Dispensa']]),
  R('olive-aromatiche', 'Olive aromatiche', 'appetizers', ['barbecue', 'apericena', 'informalDinner', 'buffet'], ['vegan', 'finger food'], 0.7, [['Olive miste', 0.12, 'kg', 8, 'Antipasti'], ['Erbe aromatiche', 0.01, 'mazzetto', 1.5, 'Dispensa']]),
  R('tagliere-italiano', 'Tagliere misto', 'cheeseColdCuts', ['apericena', 'buffet'], ['salumi', 'formaggi'], 1, [['Formaggi misti', 0.11, 'kg', 18, 'Formaggi'], ['Salumi misti', 0.1, 'kg', 22, 'Salumi'], ['Grissini', 0.08, 'kg', 7, 'Pane']]),
  R('focaccia-farcita', 'Focaccia farcita', 'aperitivo', ['apericena', 'buffet'], ['finger food', 'vegetarian option'], 1, [['Focaccia', 0.18, 'kg', 8, 'Pane'], ['Verdure grigliate', 0.12, 'kg', 6, 'Contorni'], ['Formaggio spalmabile', 0.05, 'kg', 12, 'Formaggi']]),
  R('pasta-verdure', 'Pasta alle verdure', 'firstCourses', ['elegantDinner', 'informalDinner', 'buffet'], ['vegetarian'], 1, [['Pasta', 0.11, 'kg', 2.5, 'Primi'], ['Verdure di stagione', 0.2, 'kg', 4.5, 'Contorni'], ['Parmigiano', 0.02, 'kg', 18, 'Formaggi']]),
  R('risotto-funghi', 'Risotto ai funghi', 'firstCourses', ['elegantDinner', 'informalDinner'], ['vegetarian'], 1, [['Riso', 0.09, 'kg', 4, 'Primi'], ['Funghi', 0.15, 'kg', 10, 'Contorni'], ['Brodo vegetale', 0.25, 'L', 2, 'Dispensa']]),
  R('costine-erbe', 'Costine alle erbe', 'meat', ['barbecue'], ['grill', 'meat'], 1, [['Costine', 0.42, 'kg', 13, 'Carne'], ['Erbe aromatiche', 0.02, 'mazzetto', 1.5, 'Dispensa']]),
  R('hamburger-classici', 'Hamburger alla piastra', 'meat', ['barbecue', 'informalDinner', 'buffet'], ['grill', 'meat'], 1, [['Hamburger di manzo', 0.22, 'kg', 14, 'Carne'], ['Pane burger', 1, 'unità', 0.7, 'Pane'], ['Insalata', 0.05, 'kg', 4, 'Contorni']]),
  R('spiedini-pollo', 'Spiedini di pollo', 'poultry', ['barbecue', 'informalDinner', 'buffet'], ['grill', 'poultry'], 1, [['Pollo', 0.24, 'kg', 11, 'Carne'], ['Peperoni', 0.08, 'kg', 4, 'Contorni'], ['Zucchine', 0.08, 'kg', 3.5, 'Contorni']]),
  R('salmone-limone', 'Salmone al limone', 'fish', ['elegantDinner', 'buffet'], ['fish'], 1, [['Salmone', 0.2, 'kg', 24, 'Pesce'], ['Limoni', 0.08, 'kg', 3, 'Contorni'], ['Erbe aromatiche', 0.02, 'mazzetto', 1.5, 'Dispensa']]),
  R('spiedini-gamberi', 'Spiedini di gamberi', 'fish', ['barbecue', 'elegantDinner', 'buffet'], ['fish', 'grill'], 0.9, [['Gamberi', 0.18, 'kg', 28, 'Pesce'], ['Limoni', 0.06, 'kg', 3, 'Contorni']]),
  R('verdure-griglia', 'Verdure alla griglia', 'vegetarian', ['barbecue', 'elegantDinner', 'apericena', 'informalDinner', 'buffet'], ['vegetarian', 'grill'], 1, [['Zucchine', 0.16, 'kg', 3.5, 'Contorni'], ['Peperoni', 0.16, 'kg', 4, 'Contorni'], ['Melanzane', 0.15, 'kg', 3.5, 'Contorni']]),
  R('polpette-lenticchie', 'Polpette di lenticchie', 'vegetarian', ['apericena', 'informalDinner', 'buffet'], ['vegetarian', 'finger food'], 1, [['Lenticchie cotte', 0.18, 'kg', 4.5, 'Legumi'], ['Pane grattugiato', 0.04, 'kg', 3, 'Dispensa'], ['Uova', 0.2, 'unità', 0.45, 'Uova']]),
  R('hummus-crudite', 'Hummus e crudité', 'vegan', ['apericena', 'buffet', 'informalDinner'], ['vegan', 'finger food'], 1, [['Ceci cotti', 0.15, 'kg', 4, 'Legumi'], ['Tahina', 0.025, 'kg', 14, 'Dispensa'], ['Carote', 0.1, 'kg', 2, 'Contorni'], ['Sedano', 0.08, 'kg', 2.5, 'Contorni']]),
  R('mini-piadine', 'Mini piadine vegetali', 'vegan', ['apericena', 'buffet'], ['vegan', 'finger food'], 0.8, [['Piadine', 0.8, 'unità', 0.65, 'Pane'], ['Verdure grigliate', 0.12, 'kg', 6, 'Contorni'], ['Crema di ceci', 0.06, 'kg', 6, 'Legumi']]),
  R('patate-rosmarino', 'Patate al rosmarino', 'sides', ['barbecue', 'elegantDinner', 'informalDinner', 'buffet'], ['vegetarian'], 1, [['Patate', 0.22, 'kg', 2, 'Contorni'], ['Rosmarino', 0.02, 'mazzetto', 1.5, 'Dispensa']]),
  R('insalata-stagionale', 'Insalata stagionale', 'sides', ['barbecue', 'elegantDinner', 'apericena', 'informalDinner', 'buffet'], ['vegan'], 1, [['Insalata mista', 0.12, 'kg', 5, 'Contorni'], ['Pomodorini', 0.08, 'kg', 4.5, 'Contorni'], ['Semi misti', 0.015, 'kg', 16, 'Dispensa']]),
  R('pane-salse', 'Pane, salse e condimenti', 'breadSauces', ['barbecue', 'apericena', 'informalDinner', 'buffet'], ['shared'], 1, [['Pane', 0.11, 'kg', 3.5, 'Pane'], ['Salsa barbecue', 0.05, 'L', 5, 'Salse'], ['Maionese', 0.04, 'L', 4, 'Salse']]),
  R('tiramisu-bicchiere', 'Tiramisù al bicchiere', 'dessert', ['elegantDinner', 'apericena', 'informalDinner', 'buffet'], ['dessert'], 1, [['Mascarpone', 0.07, 'kg', 12, 'Dolci'], ['Savoiardi', 0.06, 'kg', 8, 'Dolci'], ['Caffè', 0.07, 'L', 8, 'Dispensa']]),
  R('crostata-frutta', 'Crostata alla frutta', 'dessert', ['elegantDinner', 'apericena', 'informalDinner', 'buffet'], ['dessert'], 1, [['Pasta frolla', 0.08, 'kg', 7, 'Dolci'], ['Crema pasticcera', 0.06, 'kg', 9, 'Dolci'], ['Frutta fresca', 0.14, 'kg', 6, 'Frutta']]),
  R('macedonia', 'Macedonia fresca', 'fruit', ['elegantDinner', 'apericena', 'buffet'], ['vegan', 'dessert'], 1, [['Frutta di stagione', 0.2, 'kg', 5, 'Frutta'], ['Menta', 0.01, 'mazzetto', 1.5, 'Dispensa']]),
  R('spiedini-frutta', 'Spiedini di frutta', 'fruit', ['apericena', 'buffet'], ['vegan', 'finger food'], 0.8, [['Frutta di stagione', 0.18, 'kg', 5, 'Frutta'], ['Limoni', 0.03, 'kg', 3, 'Contorni']])
];
const FOOD_RECIPE_BY_ID = Object.fromEntries(FOOD_RECIPES.map(recipe => [recipe.id, recipe]));
