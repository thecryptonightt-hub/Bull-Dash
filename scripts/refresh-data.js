// Snap Finance — server-side refresh (GitHub Actions, no dependencies, no secrets).
// Purpose: fetch only figures a free, no-key public API actually returns, and
// write data.json. Anything a verified free feed cannot supply stays in the
// last-reported blocks below, labelled with its date — never guessed, never
// carried forward as if it were fresh, never invented.
//
// VERIFIED 2026-11-02 via public fetch:
//   - CoinGecko /api/v3/global returns total_market_cap.usd, market_cap_change_percentage_24h_usd,
//     market_cap_percentage.btc, and fear_and_greed_index {value, sentiment}. Works.
//   - CoinGecko /api/v3/simple/price?ids=bitcoin returns bitcoin.usd. Works.
//   - Polymarket gamma API (gamma-api.polymarket.com/events) returns events, but the
//     tag search returned unrelated markets, so no December Fed-rate market is
//     assumed here: the script searches returned event titles and only uses a
//     match; otherwise Fed odds stay UNKNOWN.
// NOT verified working (do not rely on them):
//   - FRED fredgraph.csv returned 403 from the public fetch tool, so it is NOT
//     used as a source here. PCE/GDP/jobless stay last-reported.
//   - Stooq failed to resolve from the public fetch tool, so it is NOT used.
//     Stock moves stay last-reported.
//   - No free, no-key feed was verified for individual Basenese stock inputs,
//     so no Basenese stock or score is generated here. Scoring weights are
//     unchanged: Trend fit 40 + Bottom-up value 30 + Earnings/cash 20 +
//     Catalyst 10 = 100.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data.json');

async function getJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'snap-finance-refresh/1.0', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function fmtMoney(n) {
  if (n == null || !isFinite(n)) return null;
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  return '$' + Math.round(n).toLocaleString('en-US');
}

async function main() {
  const generatedAt = new Date().toISOString();
  const data = {
    generatedAt,
    generatedAtNote: 'Server refresh timestamp (UTC). The page shows this as "Last refreshed".',
    sources: {
      cryptoLive: 'CoinGecko public API, no key: /api/v3/global and /api/v3/simple/price',
      fedOdds: 'Polymarket public gamma API, searched by event title; used only on an exact title match, otherwise UNKNOWN',
      everythingElse: 'Last-reported newsletter figures below, with their original dates. No free no-key feed was verified for them.',
    },
    cryptoLive: null,
    cryptoLiveError: null,
    fedOddsLive: null,
    fedOddsNote: null,
    // ---- Last-reported blocks: copied from the published page, dates kept. ----
    reportedMoves: {
      status: 'last-reported',
      asOf: '30 Oct 2026',
      source: 'The Daily Rip, Friday close',
      items: [
        { name: 'S&P 500', changePct: -1.8 },
        { name: 'QQQ', changePct: -3.5 },
        { name: 'Intel', changePct: -28.6 },
        { name: 'Reddit', changePct: -29.2 },
        { name: 'Global Payments', changePct: 13 },
        { name: 'FedEx Freight', changePct: 14.9 },
        { name: 'GoDaddy', changePct: 10.7 },
      ],
    },
    cryptoCapsLastReported: {
      status: 'last-reported',
      asOf: '31 Oct 2026',
      source: 'Cryptotwits, Week 44',
      totalCapYtdPct: -12,
      totalCapFromAthPct: -39,
      altcoinCapYtdPct: -14,
      altcoinCapFromAthPct: -41,
      totalCapAth: '$4.22T',
      altcoinCapAth: '$1.73T',
    },
    macroLastReported: {
      status: 'last-reported',
      inflationPceSeptember: { headlinePct: 3.6, corePct: 3.1, previousHeadlinePct: 3.4, previousCorePct: 3.0 },
      gdpQ3AnnualizedPct: 3.4,
      gdpQ2AnnualizedPct: 2.2,
      joblessClaims: 194000,
      joblessWeekEnding: '24 Oct 2026',
      fedRateCurrent: '3.75%–4.00%',
      fedRateNote: 'Held, with Cook and Hammack dissenting for a hike (as reported).',
      fedOddsDecemberLastReported: { hikePct: 83, holdOrCutPct: 17, note: 'Average of 84.6% (Daily Rip, 28 Oct) and over 80% (Opening Bell, 29 Oct). No separate Kalshi vs Polymarket split was given.' },
      otherMacro: [
        'US goods trade deficit $134.9B in September',
        'Bank of Canada +0.25% to 2.5%',
        'Oil $104.12, +2.1%',
      ],
    },
    basenese: {
      status: 'inputs-not-available',
      note: 'Scoring weights unchanged. The stock rows themselves are rendered client-side in the published page and were not present in the fetched page text, so no stock name or score is listed here rather than inventing one. Supply the stock inputs and this block can be scored and re-sorted.',
      scoring: { trendFitMax: 40, bottomUpValueMax: 30, earningsCashMax: 20, catalystMax: 10, totalMax: 100 },
      criteria: 'Trend fit (AI infrastructure, personalized medicine, oil macro) + Bottom-up value (small, undervalued, distressed) + Earnings / cash strength + Catalyst',
      asOf: '1 Nov 2026 (criteria, as published)',
      stocks: [],
    },
    updatesLastReported: {
      status: 'last-reported',
      weekAhead: '2–8 Nov 2026',
      items: [
        { when: 'Mon 2 Nov', text: 'Kobeissi Letter Chart of the Week published (link-only email, chart not described here).' },
        { when: 'Tue 3 Nov', text: 'ImmunityBio earnings, swing factor per Stocktwits Top 25 Week 43; Anktiva + BCG bladder-cancer trial results expected in November.' },
        { when: 'Wed 4 Nov', text: 'agilon health earnings; Russell 2000 #1 despite -1.2% week, Springfield Clinic expansion targeting ~21,000 additional traditional Medicare beneficiaries.' },
        { when: 'Mid-Nov, no exact date', text: 'Anthropic IPO, ticker ANT, $75–100B share sale hoped at $1.5–2T valuation, per Lark.' },
      ],
      larkOctober: [
        'Nasdaq down 9.5% since early October; Intel -47%, Google -22%, Nvidia -16%, tied to the AI "circular economy" story.',
        'Binance hack: $6.4B drained 29 Oct, $3B in stables frozen, Binance covering 100% of user losses.',
        'Anthropic H1: revenue $16.3B (+1,300% YoY), $80.7B net losses, ~$750B compute commitments.',
        'Lark trades: short Google first take-profit hit 26 Oct, second target $271 would make +11.5% (not already banked); long gold -5.5%, stopped at $3,930 on 30 Oct.',
      ],
      cryptoDataDiveWeek44: [
        'Total crypto cap ATH close $4.22T, YTD -12%, -39% from ATH; altcoin cap ATH $1.73T, YTD -14%, -41% from ATH.',
        'Weekly: AI -13%, DeFi -8%, meme -8%, stablecoins -1%.',
        'Liquidations: ~$1.055B longs 7 Oct, ~$1.7B combined 28–29 Oct; repeated $400–500M long-liquidation days with BTC barely moving point to leverage, not volatility.',
      ],
    },
    summaryLastReported: {
      status: 'last-reported',
      bigPicture: 'AI is now graded on cash, not just growth. Strong earnings were not enough when spending and guidance disappointed, and the AI selloff is also a financing story — data-center debt is piling up while demand for compute still holds.',
      cryptoSameWeek: 'The Binance hack (~$6.4B drained, ~$3B frozen) shook trust, yet tokenization and regulated perps kept advancing — DTCC, Ripple\'s trust bank, and ICE / Hyperliquid all point the same way: crypto plumbing is going mainstream even as prices slide.',
      whatToWatch: 'December Fed decision, PCE, AI cash flow vs. capex, and whether HYPE holds $100 and Bitcoin holds above its 200-day average.',
    },
  };

  // ---- Live crypto (verified CoinGecko endpoints) ----
  try {
    const g = await getJson('https://api.coingecko.com/api/v3/global');
    const p = await getJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const d = g && g.data ? g.data : null;
    if (!d || d.total_market_cap == null || d.total_market_cap.usd == null) {
      throw new Error('CoinGecko global response missing total_market_cap.usd');
    }
    data.cryptoLive = {
      status: 'live',
      source: 'CoinGecko',
      totalMarketCapUsd: d.total_market_cap.usd,
      totalMarketCapFormatted: fmtMoney(d.total_market_cap.usd),
      marketCapChange24hPct: d.market_cap_change_percentage_24h_usd ?? null,
      bitcoinDominancePct: d.market_cap_percentage ? d.market_cap_percentage.btc ?? null : null,
      bitcoinPriceUsd: p && p.bitcoin ? p.bitcoin.usd : null,
      fearGreed: d.fear_and_greed_index ? {
        value: d.fear_and_greed_index.value ?? null,
        sentiment: d.fear_and_greed_index.sentiment ?? null,
      } : null,
      fetchedAt: generatedAt,
    };
  } catch (e) {
    data.cryptoLive = null;
    data.cryptoLiveError = 'CoinGecko fetch failed: ' + e.message + ' — page keeps the previous data.json values and says so.';
  }

  // ---- Fed odds via Polymarket, title-match only, never assumed ----
  try {
    const events = await getJson('https://gamma-api.polymarket.com/events?tag_slug=federal-reserve&limit=50');
    const list = Array.isArray(events) ? events : [];
    const match = list.find((ev) => {
      const t = ((ev && ev.title) || '').toLowerCase();
      return t.includes('december') && (t.includes('rate') || t.includes('hike') || t.includes('cut')) && !t.includes('warsh') && !t.includes('confirm');
    });
    if (match && Array.isArray(match.markets) && match.markets.length) {
      const hike = match.markets.find((m) => /hike|raise/i.test(m.question || ''));
      const prices = hike && hike.outcomePrices ? JSON.parse(hike.outcomePrices) : null;
      if (prices && prices[0] != null) {
        data.fedOddsLive = {
          status: 'live',
          source: 'Polymarket',
          marketTitle: match.title,
          hikePct: Math.round(parseFloat(prices[0]) * 1000) / 10,
          fetchedAt: generatedAt,
        };
        data.fedOddsNote = 'Live Polymarket title match only; if this market is not the December meeting, treat it as unconfirmed.';
      } else {
        data.fedOddsLive = null;
        data.fedOddsNote = 'UNKNOWN — matching Polymarket market found but no usable hike price.';
      }
    } else {
      data.fedOddsLive = null;
      data.fedOddsNote = 'UNKNOWN — no December Fed-rate market found in the returned Polymarket events, so the last-reported 83% hike figure is kept only as last-reported, not as live.';
    }
  } catch (e) {
    data.fedOddsLive = null;
    data.fedOddsNote = 'UNKNOWN — Polymarket fetch failed: ' + e.message;
  }

  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log('Wrote', OUT);
  console.log('cryptoLive:', data.cryptoLive ? data.cryptoLive.totalMarketCapFormatted + ' / BTC $' + data.cryptoLive.bitcoinPriceUsd : 'FAILED: ' + data.cryptoLiveError);
  console.log('fedOddsLive:', data.fedOddsLive ? JSON.stringify(data.fedOddsLive) : data.fedOddsNote);
}

main().catch((e) => { console.error(e); process.exit(1); });
