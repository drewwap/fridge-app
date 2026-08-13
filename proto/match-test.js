// Fridge app prototype 1 — ingredient normalization + matching loop
// Tests the real questions: does filter.php substring-match? does normalization hold?
// Run: node proto/match-test.js "chicken, eggs, rice, onion"

const BASE = "https://www.themealdb.com/api/json/v1/1/";
const PERISHABLE = new Set([
  "egg", "milk", "butter", "cheese", "yogurt", "cream",
  "chicken", "beef", "pork", "lamb", "fish", "salmon", "tuna", "shrimp", "bacon", "sausage", "ham",
  "tomato", "onion", "garlic", "potato", "carrot", "pepper", "peppers", "mushroom", "spinach",
  "lettuce", "cucumber", "broccoli", "cauliflower", "celery", "zucchini", "courgette", "aubergine",
  "apple", "banana", "lemon", "lime", "orange", "avocado", "basil", "parsley", "cilantro", "coriander",
  "rice", "pasta", "noodle", "bread", "flour", "sugar", "salt", "spice", "oil", "vinegar",
]);

function norm(s) {
  let x = s.toLowerCase().trim();
  // strip common trailing bits: "chicken breast" -> "chicken breast" (keep), strip "s"/"es" plurals
  if (x.endsWith("ies")) x = x.slice(0, -3) + "y";
  else if (x.endsWith("es") && x.length > 3) x = x.slice(0, -2);
  else if (x.endsWith("s") && x.length > 2 && !x.endsWith("ss")) x = x.slice(0, -1);
  return x;
}

const ALIASES = {
  "coriander": "cilantro", "courgette": "zucchini", "aubergine": "eggplant",
  "spring onion": "scallion", "green onion": "scallion",
  "potatoe": "potato", "tomatoe": "tomato",
};

// one user word -> many canonical ingredients (the API has no bare "pasta")
const FAMILY = {
  "pasta": ["Spaghetti", "Penne Rigate", "Macaroni", "Noodles", "Linguine Pasta"],
  "noodles": ["Noodles", "Rice Noodles", "Egg Noodles", "Udon Noodles"],
};

async function j(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
  return r.json();
}

async function main() {
  const input = process.argv.slice(2).join(" ").split(",").map(s => s.trim()).filter(Boolean);
  console.log("INPUT:", input.join(", "));

  // 1. canonical ingredient list
  const list = await j("list.php?i=list");
  const canon = list.meals.map(m => m.strIngredient).filter(Boolean);
  console.log(`canonical ingredient count: ${canon.length}`);

  // 2. resolve each input item to a canonical ingredient
  const canonNorm = canon.map(c => ({ name: c, n: norm(c) }));
  const resolved = [];
  for (const item of input) {
    let n = norm(ALIASES[norm(item)] || norm(item));
    let canon = null;
    if (FAMILY[n]) {
      canon = FAMILY[n];
    } else {
      // exact
      let hit = canonNorm.find(c => c.n === n);
      // singular-ish prefix: "chicken" vs "chicken breast" -> canonical starts with mine
      if (!hit) hit = canonNorm.filter(c => c.n.startsWith(n)).sort((a, b) => a.n.length - b.n.length)[0];
      // mine contains canonical: "red onions" -> "onion"
      if (!hit) hit = canonNorm.filter(c => n.startsWith(c.n)).sort((a, b) => b.n.length - a.n.length)[0];
      canon = hit ? hit.name : null;
    }
    resolved.push({ input: item, n, canon });
  }
  for (const r of resolved) console.log(`  "${r.input}" -> ${r.n} -> ${Array.isArray(r.canon) ? r.canon.join(" | ") : (r.canon ?? "NO MATCH")}`);

  const usable = resolved.filter(r => r.canon);
  if (!usable.length) { console.log("nothing resolvable; abort"); return; }

  // 3. per-ingredient filter (test substring behavior on the API side)
  const mealSets = new Map(); // mealId -> Set of canonical ingredient names that matched
  for (const r of usable) {
    const canons = Array.isArray(r.canon) ? r.canon : [r.canon];
    for (const c of canons) {
      const data = await j(`filter.php?i=${encodeURIComponent(c)}`);
      const meals = data.meals || [];
      console.log(`  filter "${c}": ${meals.length} meals`);
      for (const m of meals) {
        if (!mealSets.has(m.idMeal)) mealSets.set(m.idMeal, new Set());
        mealSets.get(m.idMeal).add(c);
      }
    }
  }

  // 4. detail lookups for top candidates (meals matching >=2 ingredients first)
  const ranked = [...mealSets.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 8);
  console.log(`candidates for lookup: ${ranked.length}`);

  const myNorms = new Set(usable.flatMap(r => Array.isArray(r.canon) ? r.canon.map(norm) : [norm(r.canon)]));
  const results = [];
  for (const [id, matched] of ranked) {
    const d = await j(`lookup.php?i=${id}`);
    const meal = d.meals?.[0];
    if (!meal) continue;
    const theirs = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      if (ing && ing.trim()) theirs.push(ing.trim());
    }
    const theirNorms = theirs.map(norm);
    const have = theirNorms.filter(t => myNorms.has(t) || [...myNorms].some(m => t.includes(m) || m.includes(t)));
    const haveSet = new Set(have);
    const missing = theirs.filter(t => !haveSet.has(norm(t)));
    // perishable weighting: score = matched perishables * 2 + matched others
    const score = [...new Set(have)].reduce((s, h) => s + (PERISHABLE.has(h) ? 2 : 1), 0);
    results.push({
      id, name: meal.strMeal, matchedCount: matched.size,
      have: new Set(have).size, total: theirs.length,
      missing: missing.slice(0, 5), score, thumb: meal.strMealThumb,
    });
  }
  results.sort((a, b) => b.score - a.score);

  console.log("\n=== RESULTS (top by perishable-weighted score) ===");
  for (const r of results.slice(0, 6)) {
    console.log(`\n${r.name}  [score ${r.score}]  you have ${r.have}/${r.total}`);
    console.log(`  missing: ${r.missing.join(", ") || "nothing"}`);
  }
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
