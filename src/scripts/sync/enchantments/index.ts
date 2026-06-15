import { enchantingSkill, ArmoMag, WeapMag, WeapCharges, ArmoPrice, WeapPrice } from "./enchantments.js";

// All the variable magnitudes displayed
let base, zero, hundred, growth: string | null;
const armoMags: Set<ArmoMag> = new Set();
const weapMags: Set<WeapMag> = new Set();
const armoValues: Set<ArmoPrice> = new Set();
const weapValues: Set<WeapPrice> = new Set();
const weapCharges: Set<WeapCharges> = new Set();
document.querySelectorAll<HTMLElement>('.armo-magnitude').forEach(mag=> {
    base = mag.getAttribute('data-mag-base');
    zero = mag.getAttribute('data-mag-zero');
    //hundred = mag.getAttribute('data-mag-hundred');
    growth = mag.getAttribute('data-mag-growth');
    if(!(base && zero && growth)) {
        throw new Error(`Could not find magnitude relative data of enchantment ${mag.id}`)
    } armoMags.add(new ArmoMag(mag,base,Number(zero),Number(growth)))
})
document.querySelectorAll<HTMLElement>('.weap-magnitude').forEach(mag=> {
    base = mag.getAttribute('data-mag-base');
    zero = mag.getAttribute('data-mag-zero');
    hundred = mag.getAttribute('data-mag-hundred');
    growth = mag.getAttribute('data-mag-growth');
    if(!(base && zero && growth)) throw new Error(`Could not find magnitude relative data of enchantment ${mag.id}`)
    weapMags.add(new WeapMag(mag,base,Number(zero),Number(hundred),Number(growth)))
})
document.querySelectorAll<HTMLElement>('.armo-enchantment-value').forEach(val=> {
    zero = val.getAttribute('data-value-zero');
    if(!zero) throw new Error(`Could not find value at 0 skill of enchantment ${val.id}`);
    armoValues.add(new ArmoPrice(val,Number(zero)));
})
document.querySelectorAll<HTMLElement>('.weap-enchantment-value').forEach(val=> {
    hundred = val.getAttribute('data-charges-hundred');
    if(!hundred) throw new Error(`Could not find charges at 100 skill of enchantment ${val.id}`);
    weapValues.add(new WeapPrice(val,Number(hundred)));
})
document.querySelectorAll<HTMLElement>('.weap-enchantment-charges').forEach(val=> {
    hundred = val.getAttribute('data-charges-hundred');
    if(!hundred) throw new Error(`Could not find charges at 100 skill of enchantment ${val.id}`);
    weapCharges.add(new WeapCharges(val,Number(hundred)));
})
const chargesSections = {
    list: document.querySelectorAll<HTMLElement>('.ench-charges-section'),
    set hidden(attribute: boolean) {
        requestAnimationFrame(() => 
        this.list.forEach((sec => sec.hidden = attribute)))
    }
}
