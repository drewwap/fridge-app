const fs = require('fs');
const html = fs.readFileSync("app/index.html",'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('no script found'); process.exit(1); }
let src = m[1];

// minimal DOM shim
function el(id){
  return {
    id, style:{}, innerHTML:'', value:'', textContent:'', className:'',
    addEventListener(){}, querySelectorAll(){ return []; }, querySelector(){ return null; },
  };
}
const els = {};
const ids = ['input','go','chips','hint','results','empty','emptyText','suggest','listView','detailView','back','dEmoji','dName','dMeta','dScore','dIings','dSteps'];
ids.forEach(i => els[i] = el(i));
global.document = {
  getElementById: id => els[id] || (els[id]=el(id)),
  querySelectorAll: () => [],
};
global.window = globalThis; global.window.scrollTo = function(){};

// capture innerHTML writes on results for assertions
const origSet = Object.getOwnPropertyDescriptor(HTMLElementPrototypeShim(),'innerHTML');
function HTMLElementPrototypeShim(){ return {}; }

eval(src);

// assertions
let fails = 0;
function assert(cond, msg){ if(!cond){ fails++; console.error('FAIL:', msg); } else console.log('ok:', msg); }

assert(typeof RECIPES === 'object' && RECIPES.length === 36, '36 recipes loaded');
assert(typeof matchAll === 'function', 'matchAll defined');
assert(norm('Onions')==='onion', 'norm plurals: Onions->onion');
assert(norm('tomatoes')==='tomato', 'norm es: tomatoes->tomato');
assert(resolve('chicken')==='chicken', 'resolve chicken');
assert(resolve('courgette')==='zucchini', 'alias courgette->zucchini');
assert(Array.isArray(resolve('pasta')), 'family pasta expands');
assert(resolve('zzzqq')===null, 'garbage -> null');

// engine behavior
const r1 = matchAll(['chicken','egg','rice','onion']);
assert(r1.length>0, 'chicken/eggs/rice/onion yields results: '+r1.length);
const top1 = r1[0];
assert(top1.have>=1 && top1.total>=6, 'top result have/total sane: '+top1.have+'/'+top1.total);
console.log('  top1:', top1.r.name, 'have', top1.have+'/'+top1.total, 'missing', top1.missing.slice(0,3).join(','), 'score', top1.score);

const r2 = matchAll(['tomato','pasta','garlic','coriander']);
console.log('  pasta run top:', r2.slice(0,3).map(x=>x.r.name+' ('+x.have+'/'+x.total+')').join(' | '));
assert(r2.length>0, 'tomato/pasta/garlic/coriander yields results');

// UI functions with shim
addChip('chicken'); addChip('eggs'); addChip('rice'); addChip('onion');
assert(els.results.innerHTML.includes('card'), 'results rendered cards');
assert(els.chips.innerHTML.includes('chicken'), 'chips rendered');
removeChip('chicken');
assert(els.chips.innerHTML.indexOf('chicken')===-1, 'chip removed');
openDetail(r1[0].r.id);
assert(els.dIings.innerHTML.includes('checkbox'), 'detail ingredients rendered with checkboxes');
assert(els.dSteps.innerHTML.includes('<li>'), 'steps rendered');
closeDetail();

// fail state
items.length = 0;
run();
assert(els.empty.style.display==='block', 'empty state shows for no input');
items.length = 0; items.push('zzzqq');
run();
assert(els.empty.style.display==='block', 'empty state shows for unresolvable input');

// bug #1 regression: unresolved input must not crash matching
items.length = 0; items.push('chicken'); items.push('zzzqq');
run();
assert(els.results.innerHTML.includes('card'), 'unresolved item does not break results (bug #1 regression)');

console.log(fails===0 ? '\nALL PASS' : '\n'+fails+' FAILURES');
process.exit(fails?1:0);
