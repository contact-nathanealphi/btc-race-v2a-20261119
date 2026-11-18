# btc-race-v2a-20261119

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/contact-nathanealphi/btc-race-v2a-20261119/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/contact-nathanealphi/btc-race-v2a-20261119/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Multi-timeframe EMA trend trading bot for Coinbase Wrapped BTC (cbBTC) on 1-minute bars: it goes long when EMA(8) crosses above EMA(240) with positive 60-bar momentum (close 0.1% above the close 60 bars ago) and the EMA gap at least 0.5x ATR(14), and exits on the cross back, a 1% trailing stop off the peak close since entry, or after 120 bars held. Long only, one position, 50% of equity per entry. No new entries after bar 1400. It speaks the agent-fun/bars-replay/v1 protocol on stdin/stdout.

Dev-window grade (local, kit grade-local): net PnL +4.786558 USDC over 4 trades, max drawdown 0.32%, profitable in both halves of the dev window (+4.69 / +0.10 USDC).

## Run it

```sh
node main.ts
```

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards
