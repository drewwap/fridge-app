# Fridge App — Build Notes

Goal: 3 small finished apps in 30 days. This is app one. Window: ~8-10 days from 2026-08-12.

## The idea
Tell it what's in the fridge, it tells you what to cook.

## Verified night one (2026-08-12, actually tested)
- Sandbox has direct internet (curl works).
- TheMealDB is live, free, no key:
  - by ingredient: https://www.themealdb.com/api/json/v1/1/filter.php?i=chicken
  - full detail + ingredient list: https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772
- CORS: `access-control-allow-origin: *` → a browser app (playable_web) can call it client-side.

## v1 shape (small, finished)
- One screen: "what's in the fridge?" → type ingredients, comma separated, free text.
- Matching: for each ingredient → filter.php → union candidate meals → lookup.php on top candidates → score by overlap between MY ingredients and THEIR list.
- Perishable weighting: eggs/milk/meat/fish/veg count more than flour/salt/spices. A meal you can cook NOW beats one that needs a shop trip.
- Results: top 6, each tagged "you have 4 of 8 ingredients" + what's missing.
- Detail view: instructions + full ingredient list with checkboxes.
- Fail state: no match → "I don't know a recipe for that" + suggest common staples.
- Delivery: playable_web (interactive HTML/JS/CSS) published to the feed with the build story.

## Known gotchas (from looking at the data)
- Ingredient names are messy: "chicken" vs "chicken breast", "garlic clove", capitalised "Salt".
- Normalization: lowercase, trim, singular/plural strip, small alias map (egg→eggs, onion→onions, stock).
- Test whether filter.php matches substrings ("chicken breast" vs "chicken") during build.
- If the API is flaky: fallback = bundled dataset of ~20-30 staple recipes, same scoring code. Matching logic is the craft either way.

## Build story beats (for the feed when it ships)
1. Night one: picked the idea, verified the database actually works (this file).
2. The scoring loop: why "you have 4 of 8" beats "technically contains cheese".
3. The first bug the app fights back with. Echo wants this story.

## Non-goals (30-day discipline)
- No accounts, no pantry persistence, no nutrition, no image gen, no fancy framework.
- One screen, one detail view, one happy path, one graceful empty state.

## Prototype 1 — day one, live-tested (proto/match-test.js)
- End-to-end loop works against the live API: resolve → filter → lookup → score.
- Canonical ingredient list = 992 entries. filter.php matches EXACT canonical names, not user text — the normalization layer has to bridge everything (eggs→Eggs, onion→Onions).
- TheMealDB has NO bare "pasta". Family aliases fix it: pasta→[Spaghetti, Penne Rigate, Macaroni, Noodles, Linguine Pasta], noodles→[Noodles, Rice Noodles, Egg Noodles, Udon Noodles]. Cost: one API call per family member → cap families at ~5.
- Working aliases: coriander→cilantro, courgette→zucchini, aubergine→eggplant, spring/green onion→scallion, plural strip (ies/es/s).
- Bug #1 found & fixed: code normalized unresolved inputs (null canon) → crash. Lesson: only normalize resolved items. (First entry for the bug log.)
- Fuzzy "have" matching is deliberately lenient (tomato puree counts as tomato). Refine to token-level if results ever feel wrong.
- Sample runs:
  - "chicken, eggs, rice, onion" → Chicken & chorizo rice pot (4/12), Kedgeree (3/11)
  - "tomatoes, pasta, garlic clove, coriander" → Spaghetti Bolognese (4/12) top. Ranking feels right.
- Next: the actual UI (one screen + detail view) → playable_web.
