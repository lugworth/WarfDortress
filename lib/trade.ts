import type { FortressResources, Civilization } from './types.ts';

// Base prices for trade goods (what dwarves pay to buy / receive for selling)
const BASE_PRICES: Record<string, { buy: number; sell: number }> = {
  wood: { buy: 5, sell: 3 },
  stone: { buy: 4, sell: 2 },
  iron_ore: { buy: 12, sell: 7 },
  gold_ore: { buy: 25, sell: 18 },
  coal: { buy: 3, sell: 2 },
  food: { buy: 2, sell: 1 },
  ale: { buy: 3, sell: 2 },
  tools: { buy: 10, sell: 6 },
  weapons: { buy: 15, sell: 10 },
  armor: { buy: 18, sell: 12 },
};

interface TradeMarketState {
  prices: Record<string, { buy: number; sell: number }>;
  lastUpdatedTick: number;
}

// Market state per civilization
const markets = new Map<string, TradeMarketState>();

function getMarket(civId: string): TradeMarketState {
  if (!markets.has(civId)) {
    markets.set(civId, { prices: {}, lastUpdatedTick: 0 });
  }
  const market = markets.get(civId)!;

  // Initialize prices if empty
  for (const [good, base] of Object.entries(BASE_PRICES)) {
    if (!market.prices[good]) {
      market.prices[good] = { ...base };
    }
  }

  return market;
}

export function updateTradePrices(
  civId: string,
  civResources: FortressResources,
  tick: number
): Record<string, { buy: number; sell: number }> {
  const market = getMarket(civId);

  // Only update prices every 200 ticks
  if (tick - market.lastUpdatedTick < 200) {
    return market.prices;
  }
  market.lastUpdatedTick = tick;

  // Supply/demand modifiers
  for (const [good, price] of Object.entries(market.prices)) {
    const base = BASE_PRICES[good];
    if (!base) continue;

    let supplyMod = 1.0;
    const civSupply = (civResources as unknown as Record<string, number>)[good] || 0;

    // High supply lowers price
    if (civSupply > 1000) supplyMod = 0.7;
    else if (civSupply > 500) supplyMod = 0.85;
    else if (civSupply > 200) supplyMod = 0.95;
    else if (civSupply < 50) supplyMod = 1.15;
    else if (civSupply < 20) supplyMod = 1.3;

    // Random market fluctuation (±5%)
    const fluctuation = 0.95 + Math.random() * 0.1;

    market.prices[good] = {
      buy: Math.round(base.buy * supplyMod * fluctuation),
      sell: Math.round(base.sell * supplyMod * fluctuation),
    };
  }

  return market.prices;
}

export function getTradePrice(civId: string, good: string, buying: boolean): number {
  const market = getMarket(civId);
  const price = market.prices[good];
  if (!price) {
    const base = BASE_PRICES[good];
    return buying ? base?.buy || 10 : base?.sell || 5;
  }
  return buying ? price.buy : price.sell;
}

export function simulateTradeEvent(
  civId: string,
  civ: Civilization,
  playerResources: FortressResources,
  tick: number
) {
  // Update market prices
  updateTradePrices(civId, playerResources, tick);

  // Civ trades based on its needs and surplus
  const tradeItems: Array<{ item: string; quantity: number; bought: boolean }> = [];

  // Civ wants to buy wood/stone if they have resources
  if (playerResources.wood > 50) {
    const quantity = Math.min(20, Math.floor(playerResources.wealth / getTradePrice(civId, 'wood', true)));
    if (quantity > 0) {
      tradeItems.push({ item: 'wood', quantity, bought: true });
    }
  }

  // Civ trades food if player needs it
  if (playerResources.food < 100 && playerResources.wealth > 50) {
    const quantity = Math.min(30, Math.floor(playerResources.wealth / getTradePrice(civId, 'food', true)));
    if (quantity > 0) {
      tradeItems.push({ item: 'food', quantity, bought: true });
    }
  }

  // Player sells weapons to civ
  if (playerResources.weapons > 10 && playerResources.wealth > 50) {
    const quantity = Math.min(5, playerResources.weapons - 10);
    tradeItems.push({ item: 'weapons', quantity, bought: false });
  }

  return tradeItems;
}
