/* Questo file contiene i dati configurabili di WIPS. */
window.WIPS_DATA = {
  DEFAULT_PORTFOLIO: {
    crypto: [
      {
        name: "Bitcoin",
        id: "bitcoin",
        cap: 11620.94,
        qty: 0.130564,
        pm0: 89005.71,
      },
      {
        name: "Ethereum",
        id: "ethereum",
        cap: 2797.08,
        qty: 1.151616,
        pm0: 2428.83,
      },
      {
        name: "Solana",
        id: "solana",
        cap: 2492.92,
        qty: 21.22733,
        pm0: 117.43916922194173,
      },
      {
        name: "Polkadot",
        id: "polkadot",
        cap: 1297.87,
        qty: 386.041513,
        pm0: 3.3619959416126313,
      },
      {
        name: "XRP",
        id: "ripple",
        cap: 650,
        qty: 368.666639,
        // Capitale effettivo / quantità: conserva la precisione interna.
        pm0: 1.7631104397270947,
      },
      {
        name: "Avalanche",
        id: "avalanche",
        cap: 100,
        qty: 5.222532,
        pm0: 19.147800338992656,
      },
      {
        name: "Dogecoin",
        id: "dogecoin",
        cap: 99.99,
        qty: 471.44,
        pm0: 0.2120948583064653,
      },
      {
        name: "Cardano",
        id: "cardano",
        cap: 120.02,
        qty: 128.729413,
        pm0: 0.9323432555386546,
      },
    ],

    etf: [
      {
        name: "AI & Big Data",
        id: "XAIX.DE",
        cap: 3228.94,
        qty: 25.090848,
        pm0: 128.69,
      },
      {
        name: "Uranium",
        id: "WNUC.L",
        cap: 3002.84,
        qty: 57.558681,
        pm0: 52.17,
      },
      {
        name: "Quantum",
        id: "QNTM.L",
        cap: 3708.58,
        qty: 172.012231,
        pm0: 21.56,
      },
      {
        name: "Automation",
        id: "RBOT.L",
        cap: 2541.53,
        qty: 205.127457,
        pm0: 12.39,
      },
      {
        name: "Cybersecurity",
        id: "CIBR",
        cap: 3966.05,
        qty: 107.890413,
        pm0: 36.76,
      },
      {
        name: "Asia EM",
        id: "CEA1.DE",
        cap: 1113.76,
        qty: 5.176659,
        pm0: 215.15,
      },
      {
        name: "Copper Miners",
        id: "COPX",
        cap: 2014.41,
        qty: 36.374283,
        pm0: 55.38,
      },
      {
        name: "FTSE India",
        id: "FLXI",
        cap: 15.0,
        qty: 0.418351,
        pm0: 35.86,
      },
    ],

    fondi: [
      {
        name: "NEF Ethical Global Trends",
        id: "LU2051778178",
        cap: 6099.97,
        qty: 465.469,
        pm0: 13.105,
        isin: "LU2051778178",
        conto: "Banca 360 BCC FriulAdria",
      },
    ],
  },

  DEFAULT_PRICES: {
    bitcoin: 67074.04,
    ethereum: 2173.78,
    solana: 87.64,
    polkadot: 0.8854,
    ripple: 1.1937,
    avalanche: 6.41,
    dogecoin: 0.0728,
    cardano: 0.1803,

    "XAIX.DE": 208.05,
    "WNUC.L": 43.74,
    "QNTM.L": 25.09,
    "RBOT.L": 18.01,
    CIBR: 50.31,
    "CEA1.DE": 260.5,
    COPX: 59.91,
    FLXI: 34.93,

    LU2051778178: 20.08,
  },
};
