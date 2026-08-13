// Harvest a diverse, real recipe dataset from TheMealDB for the offline playable.
// Run: node proto/harvest.js > app/recipes-data.js
const BASE = "https://www.themealdb.com/api/json/v1/1/";
const j = async (p) => { const r = await fetch(BASE + p); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

const STARTERS = [
  "chicken", "beef", "pork", "salmon", "tuna", "shrimp", "egg", "milk", "cheese",
  "tomato", "onion", "potato", "garlic", "rice", "lentils", "chickpeas", "mushroom",
  "spinach", "bacon", "sausage", "flour", "butter", "carrot", "apple", "banana",
  "lemon", "spaghetti", "penne", "tofu", "courgette", "aubergine", "pepper",
];

async function main() {
  const mealSets = new Map(); // id -> Set(ingredient)
  for (const ing of STARTERS) {
    let meals = [];
    try { meals = (await j(`filter.php?i=${encodeURIComponent(ing)}`)).meals || []; }
    catch (e) { console.error(`filter ${ing} failed: ${e.message}`); continue; }
    for (const m of meals) {
      if (!mealSets.has(m.idMeal)) mealSets.set(m.idMeal, new Set());
      mealSets.get(m.idMeal).add(ing);
    }
    console.error(`filter "${ing}": ${meals.length} meals`);
  }
  console.error(`union: ${mealSets.size} meals`);

  // boost classics via search so the demo has recognizable staples
  const CLASSIC_SEARCHES = ["chicken", "rice", "pasta", "pancake", "egg", "curry", "taco", "pizza", "salad", "soup", "stew"];
  for (const q of CLASSIC_SEARCHES) {
    try {
      const meals = (await j(`search.php?s=${encodeURIComponent(q)}`)).meals || [];
      for (const m of meals) {
        if (!mealSets.has(m.idMeal)) mealSets.set(m.idMeal, new Set());
        mealSets.get(m.idMeal).add(q);
      }
      console.error(`search "${q}": ${meals.length} meals`);
    } catch (e) { console.error(`search ${q} failed: ${e.message}`); }
  }

  // prioritize meals matching 2+ starter ingredients, then cap the pool
  const pool = [...mealSets.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 80)
    .map(([id]) => id);

  const recipes = [];
  for (const id of pool) {
    const d = await j(`lookup.php?i=${id}`);
    const meal = d.meals?.[0];
    if (!meal) continue;
    const ings = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const meas = meal[`strMeasure${i}`];
      if (ing && ing.trim()) ings.push({ n: ing.trim(), m: (meas || "").trim() });
    }
    if (ings.length < 6 || ings.length > 18) continue;
    const steps = (meal.strInstructions || "").replace(/\r/g, "").trim();
    if (steps.length < 200 || steps.length > 5000) continue;
    recipes.push({
      id: meal.idMeal,
      name: meal.strMeal,
      cat: meal.strCategory || "Miscellaneous",
      area: meal.strArea || "",
      ings,
      steps: steps.length > 1600 ? steps.slice(0, 1600) + " …" : steps,
    });
  }

  // diversity: cap per category, keep the most multi-ingredient-matched first
  const cap = new Map();
  const picked = [];
  for (const r of recipes) {
    const c = cap.get(r.cat) || 0;
    if (c >= 4) continue;
    cap.set(r.cat, c + 1);
    picked.push(r);
    if (picked.length >= 36) break;
  }

  console.error(`picked ${picked.length} across ${cap.size} categories`);
  const out = `// Fridge App dataset — ${picked.length} real recipes from TheMealDB (harvested 2026-08-13).
// TheMealDB: free, no key. Data embedded so the playable works offline.
window.RECIPES = ${JSON.stringify(picked)};`;
  process.stdout.write(out);
}

main().catch(e => { console.error("FAIL:", e); process.exit(1); });
