import type { Weapon, Armor, WeaponType, ArmorType } from './types';

// Weapon definitions
export const WEAPONS: Record<WeaponType, Weapon> = {
  BARE_FISTS: {
    type: 'BARE_FISTS',
    name: 'Bare Fists',
    attackDamage: 5,
    attackSpeed: 3,
    range: 1,
  },
  WOODEN_STAFF: {
    type: 'WOODEN_STAFF',
    name: 'Wooden Staff',
    attackDamage: 8,
    attackSpeed: 3,
    range: 1,
  },
  IRON_AXE: {
    type: 'IRON_AXE',
    name: 'Iron Axe',
    attackDamage: 14,
    attackSpeed: 4,
    range: 1,
  },
  STEEL_BATTLEAXE: {
    type: 'STEEL_BATTLEAXE',
    name: 'Steel Battleaxe',
    attackDamage: 20,
    attackSpeed: 5,
    range: 1,
  },
  RUNED_MITHRIL_AXE: {
    type: 'RUNED_MITHRIL_AXE',
    name: 'Runed Mithril Axe',
    attackDamage: 28,
    attackSpeed: 5,
    range: 1,
  },
  GOBLIN_PIKE: {
    type: 'GOBLIN_PIKE',
    name: 'Goblin Pike',
    attackDamage: 12,
    attackSpeed: 4,
    range: 2,
  },
  TROLL_CLUB: {
    type: 'TROLL_CLUB',
    name: 'Troll Iron Club',
    attackDamage: 18,
    attackSpeed: 6,
    range: 1,
  },
};

// Armor definitions
export const ARMOR: Record<ArmorType, Armor> = {
  LEATHER: {
    type: 'LEATHER',
    name: 'Leather Tunic',
    defense: 0.85, // takes 85% of incoming damage
    maxHpBonus: 0,
  },
  IRON_MAIL: {
    type: 'IRON_MAIL',
    name: 'Iron Chainmail',
    defense: 0.7,
    maxHpBonus: 10,
  },
  STEEL_PLATE: {
    type: 'STEEL_PLATE',
    name: 'Steel Plate Armor',
    defense: 0.55,
    maxHpBonus: 20,
  },
  MITHRIL_MAIL: {
    type: 'MITHRIL_MAIL',
    name: 'Mithril Chainmail',
    defense: 0.45,
    maxHpBonus: 25,
  },
};

export function getWeapon(type: WeaponType): Weapon {
  return WEAPONS[type] || WEAPONS.BARE_FISTS;
}

export function getArmor(type: ArmorType): Armor {
  return ARMOR[type] || ARMOR.LEATHER;
}

// Combat effectiveness rating (higher is better)
export function weaponTier(type: WeaponType): number {
  switch (type) {
    case 'BARE_FISTS': return 0;
    case 'WOODEN_STAFF': return 1;
    case 'IRON_AXE': return 2;
    case 'GOBLIN_PIKE': return 2;
    case 'STEEL_BATTLEAXE': return 3;
    case 'TROLL_CLUB': return 3;
    case 'RUNED_MITHRIL_AXE': return 4;
    default: return 0;
  }
}

export function armorTier(type: ArmorType): number {
  switch (type) {
    case 'LEATHER': return 0;
    case 'IRON_MAIL': return 1;
    case 'STEEL_PLATE': return 2;
    case 'MITHRIL_MAIL': return 3;
    default: return 0;
  }
}
