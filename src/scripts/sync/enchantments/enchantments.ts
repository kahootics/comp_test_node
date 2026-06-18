
// Formulas Source: https://www.nexusmods.com/skyrimspecialedition/articles/1025

/* All formulas in use assume the following:
 * Grand/Black Soul is used
 * Global Variables are set as in vanilla */

/* GLOBAL GAME VARIABLES ========================================== */

const SOUL_CHARGE = {
    get GRAND()   {return 3000},
    get GREATER() {return 2000},
    get COMMON()  {return 1000},
    get LESSER()  {return 500},
    get PETTY()   {return 250}
}

const fEnchantingSkillCostMult = 3
const fEnchantingSkillCostBase = 0.005
const fEnchantingSkillFactor = 1.25 // Where is this supposed to be used??
const fEnchantingCostExponent = 1.1
const fEnchantmentPointsMult = 0.12
const fEnchantmentEffectPointsMult = 8

export let enchantingSkill = (() => {
    let _level = 100;
    return {
        get level() {
            return _level;
        },
        set level(value: number) {
            value % 1 === 0 ? _level = value : null;
        }
    }
})();

/* END GV ========================================================= */
const fEnchantingCostExponent_reverse = 1/fEnchantingCostExponent;
const SlChrG_div_SkillCostMult = SOUL_CHARGE.GRAND/fEnchantingSkillCostMult;
const one_min_sqrt = {
    _at_hundred: 1 - Math.sqrt(100*fEnchantingSkillCostBase),  // 100 is chosen skill level to calc weapon enchantment effect base cost; related to no. of charges available at that level
    get at_hundred() {
        return this._at_hundred;
    },
    calc(skill: number) {
        return 1 - Math.sqrt(skill*fEnchantingSkillCostBase);
    }
}
const MIN_PRICE = SOUL_CHARGE.GRAND*fEnchantmentPointsMult;

/* Base Class ==================================================================== */

interface EnchDisplayedParameterConstructor<C extends EnchDisplayedParameter> {
    new (...args: unknown[]): C;
    calcSkillMult(skill: number): number
}

interface EnchDisplayedParameterMethods {
    calc: (skillMult: number) => number,
}

abstract class EnchDisplayedParameter implements EnchDisplayedParameterMethods {

    private _element: HTMLElement;

    constructor(element: HTMLElement) {
        this._element = element;
    }
    // displays parameter value
    protected set elementText(txt: string) { 
        this._element.textContent = txt;
    }

    /* Each class of parameters need a skill multiplier calculator (for quick use)
     * and a value (magnitude|price|charges amount) calculator method;
     * the calc() method MUST USE the skillMult calculated 
     * using the specified method at the begining of updateSet() cycles */

    // Overwrite the following two:
    static calcSkillMult(skill: number): number { return 0/0}; // placeholder
    abstract calc(skillMult: number): number; 

    // function to rewrite the content of the element to new value
    update(skillMult: number) {
        return this.elementText = String(this.calc(skillMult));
    }
    
    // updates a set (use from specific class) using update()
    static updateSet<
        T extends EnchDisplayedParameter
    >(
        parameters: Set<T>
    ): void  {
        const skillMult = this.calcSkillMult(enchantingSkill.level);
        parameters.forEach(parameter => parameter.update(skillMult));
    }
}

export class EnchParametersSet<T extends EnchDisplayedParameter> {
    private readonly parameters: Set<T>;
    private readonly tpe: EnchDisplayedParameterConstructor<T>;
    constructor(type: EnchDisplayedParameterConstructor<T>, set: Set<T>) {
        this.parameters = set;
        this.tpe = type;
    }
    update() {
        const skillMult = this.tpe.calcSkillMult(enchantingSkill.level);
        this.parameters.forEach(parameter => parameter.update(skillMult));
    }
}


/* MAGNITUDES =================================================================== */

abstract class EnchMagnitude extends EnchDisplayedParameter {
    _base: string;
    _zero: number;
    abstract _growthMult: number; // placeholder

    constructor(element: HTMLElement, magBase: string, mag0: number) {
        super(element);
        this._base = magBase;
        this._zero = mag0;
    }
    // Accessors
    get base() {
        return this._base;
    } 
    get zero() {
        return this._zero;
    } 
    get growthMult() {
        return this._growthMult
    }

    // Magnitude is reset to base value
    reset() {
        this.elementText = this.base;
    }

    // Resets magnitudes of a set
    static resetSet(enchMags: Set<EnchMagnitude>) {
        enchMags.forEach(mag => mag.reset());
    }

}

/* ARMOR MAGNITUDE ====================================================== */

export class ArmoMag extends EnchMagnitude {

    /* COMPLETE FORMULA ==========
    magCalc = (
        mag_at_zero: number,
        growth: number,
        skill: number
    ) => Math.floor(
        mag_at_zero * (
            1 + growth/3 
            * Math.pow(skill/100, 2)
        )
    ); 
    ============================== */
    override _growthMult: number;

    constructor(element: HTMLElement, magBase: string, mag0: number, growth: number) {
        super(element, magBase, mag0);
        this._growthMult = growth/3;
    }

    override calc = (skillMult: number) => 
        Math.floor(this.zero*(1 + this.growthMult * skillMult));

    static override calcSkillMult = (skill: number) => Math.pow(skill/100, 2);
}

/* WEAPON MAGNITUDE =================================================== */

export class WeapMag extends EnchMagnitude {

    /* COMPLETE FORMULA ============================================== 
    magCalc = (
        mag_at_hundred: number, 
        mag_at_zero: number, 
        growth: number, 
        skill: number
    ) => Math.floor(mag_at_zero + (this.growthMult)
        * ((skill/100)^(1+Math.sqrt(skill*fEnchantingSkillCostBase)))) 
    ================================================================== */

    override _growthMult: number;
    
    constructor(element: HTMLElement, magBase: string, mag0: number, mag100: number, growth: number ) {
        super(element, magBase, mag0);
        this._growthMult = mag100 - mag0 + growth;
    }

    static override calcSkillMult = (skill: number) => Math.pow((skill/100),(1 + Math.sqrt(skill*fEnchantingSkillCostBase)));
    
    calc = (skillMult: number) => 
        Math.floor(this.zero + this.growthMult * skillMult); 
    
}

/* = WEAPON BASE ======================================================= */

abstract class WeapBaseEnch extends EnchDisplayedParameter {

    /* COMPLETE FORMULA (inverse of charges amount formula)==============
    baseEnchCostCalc = (
        skill: number, 
        charges_at_skill: number
    ) => Math.pow(
            ((SOUL_CHARGE.GRAND/fEnchantingSkillCostMult)/charges_at_skill)
            / one_min_sqrt.calc(skill), // (1 - Math.sqrt(skill/200))
        (fEnchantingCostExponent_reverse)
    ) 
    ======================================================================*/

    _baseEnchCost: number; // AKA base enchantment cost AKA base effect cost
    _baseEnchCostMult: number; // value used in formulas

    constructor(element: HTMLElement, charges_at_hundred: number, floorBaseEnchant: boolean) {
        super(element);
        // Keep a register in order to spare calculations (prices also use base cost)
        let hypBaseEnchCost = WeapBaseEnch.baseEnchCostsRegister.get(charges_at_hundred);
        if(!hypBaseEnchCost) {
            hypBaseEnchCost = WeapBaseEnch.baseEnchCostCalc(charges_at_hundred);
            WeapBaseEnch.baseEnchCostsRegister.set(charges_at_hundred, hypBaseEnchCost);
        }
        this._baseEnchCost = hypBaseEnchCost;
        this._baseEnchCostMult = Math.pow(
            floorBaseEnchant 
                ? Math.floor(this.baseEnchCost)
                : this.baseEnchCost,
            fEnchantingCostExponent
        );
    }
    
    get baseEnchCost() {
        return this._baseEnchCost;
    }
    get baseEnchCostMult() {
        return this._baseEnchCostMult;
    }

    static baseEnchCostCalc = (
        charges_at_hundred: number

    ) => charges_at_hundred > 0 ? (Math.pow(
        SlChrG_div_SkillCostMult/charges_at_hundred/one_min_sqrt.at_hundred,
        (fEnchantingCostExponent_reverse)
    )) : 0;
    static baseEnchCostsRegister: Map<number, number> = new Map();
}

/* WEAPON CHARGES ========================================================== */

export class WeapCharges extends WeapBaseEnch {

    /* COMPLETE FORMULA ===================================================================
    calcCharges = (
        mag_current: number, 
        maxMag_at_skill: number,
        skill: number,
        baseEnchCost: number
    ) => Math.floor(
        SlChrG_div_SkillCostMult // (SOUL_CHARGE.GRAND/fEnchantingSkillCostMult) 
        / Math.pow(baseEnchCost * (mag_current / maxMag_at_skill),fEnchantingCostExponent)
        / one_min_sqrt.calc(skill), // (1 - Math.sqrt(skill*fEnchantingSkillCostBase))
    ) 
    ======================================================================================= */

    constructor(element: HTMLElement, charges_at_hundred: number) {
        super(element, charges_at_hundred, false);
    }

    static override calcSkillMult = (skill: number) => one_min_sqrt.calc(skill);

    calc = (
        skillMult: number
        // mag === maxMag
    ) => Math.floor(
            SlChrG_div_SkillCostMult
            / this.baseEnchCostMult // Math.pow(this.baseEnchCost,fEnchantingCostExponent)
            / skillMult // one_min_sqrt.calc(skill)
    )

    static calc(skill: number, charges_at_hundred: number) {
        return Math.floor(SlChrG_div_SkillCostMult
            / Math.pow(this.baseEnchCostCalc(charges_at_hundred),fEnchantingCostExponent)
            / one_min_sqrt.calc(skill))
    }

}

/* Armor Prices ============================================================== */

/**
 *
 */
export class ArmoPrice extends EnchDisplayedParameter {

    /* calcBaseEnchCost = (price_at_zero: number) => Math.pow(price_at_zero/fEnchantingSkillCostMult,(1/fEnchantingCostExponent))
    COMPLETE FORMULA ===========================================================================
    calcPrice = (
        skill: number,
        SOUL_CHARGE_IN_USE: number, // The charges of the soul gem used for the enchantment
        baseEnchCost: number
    ) => Math.round(
        fEnchantingSkillCostMult
        * Math.pow(baseEnchCost * SOUL_CHARGE_IN_USE/SOUL_CHARGE.GRAND, fEnchantingCostExponent)
        * one_min_sqrt.calc(skill) // (1 - Math.sqrt(skill*fEnchantingSkillCostBase))
    )  
    ============================================================================================ */

    _priceZero: number;

    constructor(element: HTMLElement, price0: number) {
        super(element);
        this._priceZero = price0;
    }
    get priceZero() {
        return this._priceZero;
    }
    
    /* Assuming  SOUL_CHARGE_IN_USE/SOUL_CHARGE.GRAND === 1 
     * baseEnchCost = (priceZero/fESCM)^(1/fECE) 
     * price = round(fESCM * baseEnchCost^fECE * skillMult) =
     *       = round(fESCM * ((priceZero/fESCM)^(1/fECE))^fECE * skillMult) =
     *       = round(fESCM * priceZero/fESCM * skillMult) =
     *       = round(priceZero * skillMult) */

    calc = (skillMult: number) => Math.round(this.priceZero*skillMult);
    static override calcSkillMult = (skill: number) => one_min_sqrt.calc(skill);

    static calcValue(skill: number, price0: number) {
        return Math.round(price0*this.calcSkillMult(skill));
    }

}


/* Weapon Prices ============================================================== */

export class WeapPrice extends WeapBaseEnch {

    /* COMPLETE FORMULA ======================================================
    calcPrice = (
        skill: number,
        mag_current: number, 
        maxMag_at_skill: number
    ) => Math.floor( 
        fEnchantingSkillCostMult
        * Math.pow(
            Math.floor(this.baseEnchCost * (mag_current / maxMag_at_skill)), 
            fEnchantingCostExponent
        ) * (1 - Math.sqrt(skill * fEnchantingSkillCostBase) )
        * fEnchantmentEffectPointsMult
        + SOUL_CHARGE.GRAND * fEnchantmentPointsMult // min value
    )  
    =========================================================================== */

    _baseEnchCostMultMult: number;

    constructor(element: HTMLElement, charges_at_hundred: number) {
        super(element, charges_at_hundred, true);
        this._baseEnchCostMultMult = fEnchantingSkillCostMult* this.baseEnchCostMult;
    }
    get baseEnchCostMultMult() {
        return this._baseEnchCostMultMult;
    }

    calc = (
        skillMult: number
    ) => Math.floor( 
        this.baseEnchCostMultMult // fEnchantingSkillCostMult * this.baseEnchCostMult // Math.pow(Math.floor(this.baseEnchCost), fEnchantingCostExponent) 
        * skillMult // (1 - Math.sqrt(skill * fEnchantingSkillCostBase)) * fEnchantmentEffectPointsMult
        + MIN_PRICE // SOUL_CHARGE.GRAND * fEnchantmentPointsMult
    ) 

    static override calcSkillMult = (skill: number) => 
        one_min_sqrt.calc(skill) // (1 - Math.sqrt(skill * fEnchantingSkillCostBase))
        * fEnchantmentEffectPointsMult;

    static calcValue(skill: number, charges100: number) {
        return Math.floor( 
            fEnchantingSkillCostMult * this.baseEnchCostCalc(charges100) 
            * this.calcSkillMult(skill) 
            + MIN_PRICE
        ) 
    }

}

