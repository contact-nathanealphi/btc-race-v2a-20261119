// BTC race bot v2a: multi-timeframe EMA trend + ATR strength filter, trailing stop, max hold.
//
// Long only, one position. Enters when EMA(8) crosses above EMA(240) with
// positive 60-bar momentum (close > close 60 bars ago by 0.1%) and the EMA gap
// at least 0.5x ATR(14) (trend strong enough to cover costs). Exits on the
// cross back, a 1% trailing stop off the peak close since entry, or after 120
// bars held. 50% of equity per entry. No new entries after bar 1400.
// Deterministic: float64 math only, no clock, no randomness, no environment
// reads, closed bars only (no lookahead).

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const FAST_SPAN = 8;
const SLOW_SPAN = 240;
const MOM_BARS = 60;
const MOM_THR = 0.001;
const ATR_BARS = 14;
const GAP_ATR_MULT = 0.5;
const TRAIL_PCT = 0.01;
const MAX_HOLD_BARS = 120;
const SIZE_BPS = 5000;
const ENTRY_CUTOFF_INDEX = 1400;
const MAX_SLIPPAGE_BPS = 100;

/** EMA seeded by the mean of its first span of closes. */
interface Ema {
  span: number;
  warm: number[];
  value: number | null;
}

function stepEma(e: Ema, close: number): number | null {
  if (e.value !== null) {
    e.value += (2 / (e.span + 1)) * (close - e.value);
  } else {
    e.warm.push(close);
    if (e.warm.length === e.span) e.value = e.warm.reduce((a, x) => a + x, 0) / e.span;
  }
  return e.value;
}

interface Trader {
  fast: Ema;
  slow: Ema;
  closes: number[];
  trs: number[];
  atrSum: number;
  prevClose: number | null;
  gapPrev: number | null;
  barIndex: number;
  peak: number | null;
  holdBars: number;
  down: boolean;
}

const traders = new Map<string, Trader>();

function traderFor(symbol: string): Trader {
  let t = traders.get(symbol);
  if (t === undefined) {
    t = {
      fast: { span: FAST_SPAN, warm: [], value: null },
      slow: { span: SLOW_SPAN, warm: [], value: null },
      closes: [],
      trs: [],
      atrSum: 0,
      prevClose: null,
      gapPrev: null,
      barIndex: -1,
      peak: null,
      holdBars: 0,
      down: false,
    };
    traders.set(symbol, t);
  }
  return t;
}

/** ATR(14) as the mean of the last 14 true ranges; null until 14 bars seen. */
function stepAtr(t: Trader, high: number, low: number, close: number): number | null {
  const tr = t.prevClose === null
    ? high - low
    : Math.max(high - low, Math.abs(high - t.prevClose), Math.abs(low - t.prevClose));
  t.prevClose = close;
  t.trs.push(tr);
  t.atrSum += tr;
  if (t.trs.length > ATR_BARS) t.atrSum -= t.trs[t.trs.length - 1 - ATR_BARS]!;
  if (t.trs.length < ATR_BARS) return null;
  return t.atrSum / ATR_BARS;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    const symbol = state.hello.symbols[0]!.symbol;
    const t = traderFor(symbol);
    let fresh = false;
    let crossUp = false;
    let momentumOk = false;
    let gapOk = false;
    for (const bar of batch.bars) {
      if (bar.symbol !== symbol) continue;
      fresh = true;
      t.barIndex++;
      const close = Number(bar.c);
      t.closes.push(close);
      const fast = stepEma(t.fast, close);
      const slow = stepEma(t.slow, close);
      const atr = stepAtr(t, Number(bar.h), Number(bar.l), close);
      const gap = fast === null || slow === null ? null : fast - slow;
      const prev = t.gapPrev;
      t.gapPrev = gap;
      if (gap === null || gap >= 0) t.down = false;
      else if (prev !== null && prev >= 0) t.down = true;
      crossUp = prev !== null && gap !== null && gap > 0 && prev <= 0;
      momentumOk = t.closes.length > MOM_BARS
        && close > t.closes[t.closes.length - 1 - MOM_BARS]! * (1 + MOM_THR);
      gapOk = gap !== null && atr !== null && gap >= GAP_ATR_MULT * atr;
    }
    if (state.warmingUp) return [];
    const held = state.positions.get(symbol);
    const close = state.close(symbol);
    if (held !== undefined && close !== null) {
      const closeNum = Number(close);
      t.holdBars++;
      t.peak = t.peak === null ? closeNum : Math.max(t.peak, closeNum);
      let exitNow = t.down;
      if (closeNum < t.peak * (1 - TRAIL_PCT)) exitNow = true;
      if (t.holdBars >= MAX_HOLD_BARS) exitNow = true;
      if (exitNow) {
        t.peak = null;
        t.holdBars = 0;
        return [{ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }
    if (held === undefined && fresh && crossUp && momentumOk && gapOk && t.barIndex <= ENTRY_CUTOFF_INDEX) {
      const bySize = (state.equity * BigInt(SIZE_BPS)) / 10000n;
      let amount = bySize < state.cash ? bySize : state.cash;
      const room = state.weightRoom(symbol);
      if (room < amount) amount = room;
      if (amount >= BigInt(state.hello.fees.min_notional_quote_units)) {
        t.peak = close === null ? null : Number(close);
        t.holdBars = 0;
        return [{ side: 'buy', symbol, notional_quote_units: amount, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
    return [];
  },
});
