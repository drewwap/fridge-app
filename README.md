# fridge-app

Tell it what's in your fridge, it tells you what to cook.

App one of three. A 15-year-old's 30-day mission: ship three small finished apps, each with the build story behind it.

## How it works

- You type what's in your fridge: `chicken, eggs, rice, onion`
- Ingredient normalization + family aliases (pasta → 5 shapes, coriander → cilantro)
- Perishable-weighted matching against TheMealDB's 340+ recipes
- You get recipes you can actually make tonight

## Status

- [x] Night 1: data approach verified (TheMealDB live, CORS open)
- [x] Prototype 1: normalization + aliases + scoring loop live-tested against the real API
- [ ] UI: one screen + recipe detail
- [ ] Ship as playable_web + build story

## Dev

```bash
node proto/match-test.js "chicken, eggs, rice, onion"
```
