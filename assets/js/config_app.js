// assets/js/config_app.js
// File ini adalah sumber kebenaran (source of truth) untuk semua konfigurasi aplikasi.

const KONFIG_APLIKASI = {
  "APP": {
    "NAME": "MULTIPLUS CHATGPT",  // Nama aplikasi  
    "VERSION": "1.1",           // Versi aplikasi
  },
  "DEXS": {
    "flytrade": {
      "WARNA": "#740affff",
      "PROXY": "https://server1.ciwayeh967.workers.dev/?",
      "URL_DEX": "https://app.magpiefi.xyz/swap/{chainName}/{tokenSymbol}/{chainName}/{pairSymbol}",
      "FETCH_DEX": {
        "PRIMARY": { "CEXtoDEX": "fly", "DEXtoCEX": "fly" },
        "ALTERNATIVE": { "ENABLE": true, "CEXtoDEX": "fly", "DEXtoCEX": "fly" }
      }
    },
    "kyber": {
      "WARNA": "#3db50aff",
      "PROXY": "https://server1.ciwayeh967.workers.dev/?",
      "URL_DEX": "https://kyberswap.com/swap/{chainName}/{tokenAddress}-to-{pairAddress}",
      "FETCH_DEX": {
        "PRIMARY": { "CEXtoDEX": "kyber", "DEXtoCEX": "kyber" },
        "ALTERNATIVE": { "ENABLE": true, "CEXtoDEX": "swoop", "DEXtoCEX": "swoop" }
      }
    },
    "odos": {
      "WARNA": "#EA1E1EFF",
      "PROXY": "https://server1.ciwayeh967.workers.dev/?",
      "URL_DEX": "https://app.odos.xyz",
      "FETCH_DEX": {
        "PRIMARY": { "CEXtoDEX": "odos", "DEXtoCEX": "odos" },
        "ALTERNATIVE": { "ENABLE": false, "CEXtoDEX": "", "DEXtoCEX": "" }
      }
    },
    "0x": {
      "WARNA": "#40a6e4ff",
      "PROXY": "https://server1.ciwayeh967.workers.dev/?",
      "URL_DEX": "https://matcha.xyz/tokens/{chainName}/{tokenAddress}?buyChain={chainCode}&buyAddress={pairAddress}",
      "FETCH_DEX": {
        "PRIMARY": { "CEXtoDEX": "0x", "DEXtoCEX": "0x" },
        "ALTERNATIVE": { "ENABLE": false, "CEXtoDEX": "", "DEXtoCEX": "" }
      }
    },
    "para": {
      "WARNA": "#f7941dff",
      "PROXY": "https://server1.ciwayeh967.workers.dev/?",
      "URL_DEX": "https://app.paraswap.io/#/swap/{tokenAddress}-{pairAddress}?version=6.2&network={chainName}",
      "FETCH_DEX": {
        "PRIMARY": { "CEXtoDEX": "para", "DEXtoCEX": "para" },
        "ALTERNATIVE": { "ENABLE": false, "CEXtoDEX": "", "DEXtoCEX": "" }
      }
    },
    "1inch": {
      "WARNA": "#843d0bff",
      "PROXY": "https://server1.ciwayeh967.workers.dev/?",
      "URL_DEX": "https://app.1inch.io/advanced/swap?network={chainCode}&src={tokenAddress}&dst={pairAddress}",
      "FETCH_DEX": {
        "PRIMARY": { "CEXtoDEX": "1inch", "DEXtoCEX": "1inch" },
        "ALTERNATIVE": { "ENABLE": false, "CEXtoDEX": "", "DEXtoCEX": "" }
      }
    },
    "okxdex": {
      "WARNA": "#14151AFF",
      // "PROXY": "https://server1.ciwayeh967.workers.dev/?", // Proxy dinonaktifkan untuk OKX DEX
      "URL_DEX": "https://www.okx.com/web3/dex-swap?inputChain={chainCode}&inputCurrency={tokenAddress}&outputChain={chainCode}&outputCurrency={pairAddress}",
      "FETCH_DEX": {
        "PRIMARY": { "CEXtoDEX": "okxdex", "DEXtoCEX": "okxdex" },
        "ALTERNATIVE": { "ENABLE": false, "CEXtoDEX": "", "DEXtoCEX": "" }
      },
      "DATA_API": [ // API keys dari config.json asli
        { "API_KEY_OKX": "a4569d13-8a59-4ecd-9936-6c4e1233bff8", "SECRET_KEY_OKX": "4484BC9B2FC22C35CB1071A2A520FDC8", "PASSPHRASE_OKX": "Macpro-2025" },
        { "API_KEY_OKX": "71cbe094-380a-4146-b619-e81a254c0702", "SECRET_KEY_OKX": "5116D48C1847EB2D7BDD6DDD1FC8B199", "PASSPHRASE_OKX": "Macpro-2025" },
        { "API_KEY_OKX": "81a072cc-b079-410c-9963-fb8e49c16d9d", "SECRET_KEY_OKX": "BF44AE00CF775DC6DDB0FDADF61EC724", "PASSPHRASE_OKX": "Macpro-2025" },
        { "API_KEY_OKX": "adad55d1-bf90-43ac-ac03-0a43dc7ccee2", "SECRET_KEY_OKX": "528AFB3ECC88653A9070F05CC3839611", "PASSPHRASE_OKX": "Cek_Horeg_911" },
        { "API_KEY_OKX": "6866441f-6510-4175-b032-342ad6798817", "SECRET_KEY_OKX": "E6E4285106CB101B39FECC385B64CAB1", "PASSPHRASE_OKX": "Arekpinter123." },
        { "API_KEY_OKX": "45e4e1f1-1229-456f-ad23-8e1341e76683", "SECRET_KEY_OKX": "1BD8AC02C9461A6D1BEBDFE31B3BFF9F", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "28bc65f0-8cd1-4ecb-9b53-14d84a75814b", "SECRET_KEY_OKX": "E8C92510E44400D8A709FBF140AABEC1", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "04f923ec-98f2-4e60-bed3-b8f2d419c773", "SECRET_KEY_OKX": "3D7D0BD3D985C8147F70592DF6BE3C48", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "cf214e57-8af2-42bf-8afa-3b7880c5a152", "SECRET_KEY_OKX": "26AA1E415682BD8BBDF44A9B1CFF4759", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "a77871bd-7855-484c-a675-e429bad3490e", "SECRET_KEY_OKX": "830C9BB8D963F293857DB0CCA5459089", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "87db4731-fbe3-416f-8bb4-a4f5e5cb64f7", "SECRET_KEY_OKX": "B773838680FF09F2069AEE28337BBCD0", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "aec98aef-e2b6-4fb2-b63b-89e358ba1fe1", "SECRET_KEY_OKX": "DB683C83FF6FB460227ACB57503F9233", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "6636873a-e8ab-4063-a602-7fbeb8d85835", "SECRET_KEY_OKX": "B83EF91AFB861BA3E208F2680FAEDDC3", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "989d75b7-49ff-40a1-9c8a-ba94a5e76793", "SECRET_KEY_OKX": "C30FCABB0B95BE4529D5BA1097954D34", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "43c169db-db8c-4aeb-9c25-a2761fdcae49", "SECRET_KEY_OKX": "7F812C175823BBD9BD5461B0E3A106F5", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "904cefba-08ce-48e9-9e8b-33411bf44a0f", "SECRET_KEY_OKX": "91F2761A0B77B1DEED87A54E75BE1CCE", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "bfbd60b5-9aee-461d-9c17-3b401f9671d1", "SECRET_KEY_OKX": "D621020540042C41D984E2FB78BED5E4", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "86f40277-661c-4290-929b-29a25b851a87", "SECRET_KEY_OKX": "9274F990B5BEDAB5EB0C035188880081", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "32503ada-3d34-411a-b50b-b3e0f36f3b47", "SECRET_KEY_OKX": "196658185E65F93963323870B521A6F6", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "80932e81-45b1-497e-bc14-81bdb6ed38d5", "SECRET_KEY_OKX": "4CA9689FA4DE86F4E4CBF2B777CBAA91", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "a81d5a32-569a-401c-b207-3f0dd8f949c7", "SECRET_KEY_OKX": "307D988DA44D37C911AA8A171B0975DB", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "ca59e403-4bcb-410a-88bb-3e931a2829d5", "SECRET_KEY_OKX": "AC7C6D593C29F3378BF93E7EDF74CB6D", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "97439591-ea8e-4d78-86bb-bdac8e43e835", "SECRET_KEY_OKX": "54970C78369CE892E2D1B8B296B4E572", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "f7a23981-af15-47f4-8775-8200f9fdfe5d", "SECRET_KEY_OKX": "4F61764255CEDE6D5E151714B3E1E93B", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "4f708f99-2e06-4c81-88cb-3c8323fa42c5", "SECRET_KEY_OKX": "A5B7DCA10A874922F54DC2204D6A0435", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "61061ef4-6d0a-412a-92a9-bdc29c6161a7", "SECRET_KEY_OKX": "4DDF73FD7C38EB50CD09BF84CDB418ED", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "b63f3f68-2008-4df5-9d2e-ae888435332b", "SECRET_KEY_OKX": "1427387D7B1A67018AA26D364700527B", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "ecc51700-e7a2-4c93-9c8d-dbc43bda74c1", "SECRET_KEY_OKX": "6A897CF4D6B56AF6B4E39942C8811871", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "dd3f982e-0e20-4ecd-8a03-12d7b0f54586", "SECRET_KEY_OKX": "9F69EEB1A17CCCE9862B797428D56C00", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "a6fd566b-90ed-42c1-8575-1e15c05e395c", "SECRET_KEY_OKX": "77FA24FA1DBFFBA5C9C83367D0EAE676", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "a499fca1-14cd-41c3-a5bc-0eb37581eff9", "SECRET_KEY_OKX": "B8101413760E26278FFAF6F0A2BCEA73", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "c3c7e029-64b7-4704-8fdc-6d1861ad876a", "SECRET_KEY_OKX": "B13A8CFA344038FAACB44A3E92C9C057", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "1974cbac-2a05-4892-88e0-eb262d5d2798", "SECRET_KEY_OKX": "6A24A249F758047057A993D9A460DA7F", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "41826044-b7bb-4465-a903-3da61e336747", "SECRET_KEY_OKX": "F42BD9E95F01BCD248C94EE2EECDE19A", "PASSPHRASE_OKX": "Regi!#007" },
        { "API_KEY_OKX": "08af14cb-2f97-472c-90cd-fefd2103f253", "SECRET_KEY_OKX": "FFC78575E3961D11BF134C8DE9CBE7F8", "PASSPHRASE_OKX": "Regi!#007" }
      ]
    }
  },
  "CHAINS": {
    "bsc": {
      "KODE_CHAIN": 56,
      "NAMA_CHAIN": "bsc",
      "NAMA_PENDEK": "bsc",
      "WARNA": "#f0af18",
      "ICON": "assets/icons/bsc.png",
      "BASE_FEE_DEX": "BNBUSDT",
     // "RPC": "https://bsc-dataseed.binance.org/",
      "RPC": " https://binance.llamarpc.com",
      "DATAJSON":"https://multiplus-scanner.vercel.app/JSON_KOIN/BSC.json",
      "GASLIMIT": 80000,
      "SYNONYMS": [ "BSC", "BEP20", "BINANCE SMART CHAIN", "BNB SMART CHAIN", "BEP-20" ],
      "LINKS": {
        "EXPLORER": {
          "TOKEN": "https://bscscan.com/token/{address}",
          "ADDRESS": "https://bscscan.com/address/{address}",
          "TX": "https://bscscan.com/tx/{hash}"
        }
      },
      "PAIR_DEXS": {
        "BNB": { "SYMBOL_PAIR": "BNB", "SC_ADDRESS_PAIR": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "DECIMALS_PAIR": "18" },
        "USDT": { "SYMBOL_PAIR": "USDT", "SC_ADDRESS_PAIR": "0x55d398326f99059fF775485246999027B3197955", "DECIMALS_PAIR": "18" },
        "ETH": { "SYMBOL_PAIR": "ETH", "SC_ADDRESS_PAIR": "0x2170ed0880ac9a755fd29b2688956bd959f933f8", "DECIMALS_PAIR": "18" },
        "NON": { "SYMBOL_PAIR": "NON", "SC_ADDRESS_PAIR": "0x", "DECIMALS_PAIR": "18" }
      }
    },
    "polygon": {
      "KODE_CHAIN": 137,
      "NAMA_CHAIN": "Polygon",
      "NAMA_PENDEK": "poly",
      "WARNA": "#a05df6",
      "ICON": "assets/icons/polygon.png",
      "BASE_FEE_DEX": "MATICUSDT",
      "RPC": "https://polygon-rpc.com",
       "DATAJSON":"https://multiplus-scanner.vercel.app/JSON_KOIN/POLYGON.json",
      "GASLIMIT": 80000,
      "SYNONYMS": [ "POLYGON", "MATIC", "POLYGON POS", "POLYGON (MATIC)", "POL" ],
      "LINKS": {
        "EXPLORER": {
          "TOKEN": "https://polygonscan.com/token/{address}",
          "ADDRESS": "https://polygonscan.com/address/{address}",
          "TX": "https://polygonscan.com/tx/{hash}"
        }
      },
      "PAIR_DEXS": {
        "USDT": { "SYMBOL_PAIR": "USDT", "SC_ADDRESS_PAIR": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "DECIMALS_PAIR": "6" },
        "USDC": { "SYMBOL_PAIR": "USDC", "SC_ADDRESS_PAIR": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", "DECIMALS_PAIR": "6" },
        "POL": { "SYMBOL_PAIR": "POL", "SC_ADDRESS_PAIR": "0x0000000000000000000000000000000000001010", "DECIMALS_PAIR": "18" },
        "NON": { "SYMBOL_PAIR": "NON", "SC_ADDRESS_PAIR": "0x", "DECIMALS_PAIR": "18" }
      }
    },
    "arbitrum": {
      "KODE_CHAIN": 42161,
      "NAMA_CHAIN": "Arbitrum",
      "NAMA_PENDEK": "arb",
      "WARNA": "#a6b0c3",
      "ICON": "assets/icons/arbitrum.png",
      "BASE_FEE_DEX": "ETHUSDT",
      "RPC": "https://arbitrum-one-rpc.publicnode.com",
       "DATAJSON":"https://multiplus-scanner.vercel.app/JSON_KOIN/ARBITRUM.json",
      "GASLIMIT": 100000,
      "SYNONYMS": [ "ARBITRUM", "ARB", "ARBITRUM ONE", "ARBEVM", "ARBITRUMONE", "ARB-ETH" ],
      "LINKS": {
        "EXPLORER": {
          "TOKEN": "https://arbiscan.io/token/{address}",
          "ADDRESS": "https://arbiscan.io/address/{address}",
          "TX": "https://arbiscan.io/tx/{hash}"
        }
      },
      "PAIR_DEXS": {
        "ETH": { "SYMBOL_PAIR": "ETH", "SC_ADDRESS_PAIR": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "DECIMALS_PAIR": "18" },
        "USDT": { "SYMBOL_PAIR": "USDT", "SC_ADDRESS_PAIR": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "DECIMALS_PAIR": "6" },
        "NON": { "SYMBOL_PAIR": "NON", "SC_ADDRESS_PAIR": "0x", "DECIMALS_PAIR": "18" }
      }
    },
    "ethereum": {
      "KODE_CHAIN": 1,
      "NAMA_CHAIN": "Ethereum",
      "NAMA_PENDEK": "erc",
      "WARNA": "#6683edff",
      "ICON": "assets/icons/ethereum.png",
      "BASE_FEE_DEX": "ETHUSDT",
      "RPC": "https://eth.llamarpc.com",
       "DATAJSON":"https://multiplus-scanner.vercel.app/JSON_KOIN/ETH.json",
      "GASLIMIT": 250000,
      "SYNONYMS": [ "ETH", "ERC20", "ETHEREUM" ],
      "LINKS": {
        "EXPLORER": {
          "TOKEN": "https://etherscan.io/token/{address}",
          "ADDRESS": "https://etherscan.io/address/{address}",
          "TX": "https://etherscan.io/tx/{hash}"
        }
      },
      "PAIR_DEXS": {
        "ETH": { "SYMBOL_PAIR": "ETH", "SC_ADDRESS_PAIR": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "DECIMALS_PAIR": "18" },
        "USDT": { "SYMBOL_PAIR": "USDT", "SC_ADDRESS_PAIR": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "DECIMALS_PAIR": "6" },
        "BNT": { "SYMBOL_PAIR": "BNT", "SC_ADDRESS_PAIR": "0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C", "DECIMALS_PAIR": "18" },
        "NON": { "SYMBOL_PAIR": "NON", "SC_ADDRESS_PAIR": "0x", "DECIMALS_PAIR": "18" }
      }
    },
    "base": {
      "KODE_CHAIN": 8453,
      "NAMA_CHAIN": "Base",
      "NAMA_PENDEK": "base",
      "WARNA": "#0a30d9ff",
      "ICON": "assets/icons/base.png",
      "BASE_FEE_DEX": "ETHUSDT",
      "RPC": "https://base.llamarpc.com",
       "DATAJSON":"https://multiplus-scanner.vercel.app/JSON_KOIN/BASE.json",
      "GASLIMIT": 100000,
      "SYNONYMS": [ "BASE", "BASE MAINNET", "BASEEVM" ],
      "LINKS": {
        "EXPLORER": {
          "TOKEN": "https://basescan.org/token/{address}",
          "ADDRESS": "https://basescan.org/address/{address}",
          "TX": "https://basescan.org/tx/{hash}"
        }
      },
      "PAIR_DEXS": {
        "ETH": { "SYMBOL_PAIR": "ETH", "SC_ADDRESS_PAIR": "0x4200000000000000000000000000000000000006", "DECIMALS_PAIR": "18" },
        "USDC": { "SYMBOL_PAIR": "USDC", "SC_ADDRESS_PAIR": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "DECIMALS_PAIR": "6" },
        "NON": { "SYMBOL_PAIR": "NON", "SC_ADDRESS_PAIR": "0x", "DECIMALS_PAIR": "18" }
      }
    }
  },
  "CEX": {
    "GATE": {
      "WARNA": "#D5006D", "SHORT_NAME": "GATE",
      "DATA_API": { "API_KEY": "1dbe3d4c92a42de270692e65952574d0", "API_SECRET": "9436bfec02a8ed462bda4bd1a516ba82b4f322dd09e120a2bf7ea6b5f0930ef8" },
      "WALLETS": {
        "bsc": { "address": "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe" },
        "polygon": { "address": "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe" },
        "arbitrum": { "address": "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe" },
        "ethereum": { "address": "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe" },
        "base": { "address": "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe" }
      },
       "URLS": {
         "TRADE": "https://www.gate.com/trade/{symbol}_USDT",
         "WITHDRAW": "https://www.gate.com/myaccount/withdraw/{token}",
         "DEPOSIT": "https://www.gate.com/myaccount/deposit/{pair}",
         "ORDERBOOK": "https://api.gateio.ws/api/v4/spot/order_book?limit=5&currency_pair={symbol}_USDT"
       },
    },
    "BINANCE": {
      "WARNA": "#e0a50c", "SHORT_NAME": "BINC",
      "DATA_API": { "API_KEY": "2U7YGMEUDri6tP3YEzmK3CcZWb9yQ5j3COp9s7pRRUv4vu8hJAlwH4NkbNK74hDU", "API_SECRET": "XHjPVjLzbs741xoznV3xz1Wj5SFrcechNBjvezyXLcg8GLWF21VW32f0YhAsQ9pn" },
      "WALLETS": {
        "bsc": { "address": "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3", "address2": "0xe2fc31F816A9b94326492132018C3aEcC4a93aE1" },
        "polygon": { "address": "0x290275e3db66394C52272398959845170E4DCb88", "address2": "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245" },
        "arbitrum": { "address": "0x290275e3db66394C52272398959845170E4DCb88", "address2": "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245" },
        "ethereum": { "address": "0xDFd5293D8e347dFe59E90eFd55b2956a1343963d", "address2": "0x28C6c06298d514Db089934071355E5743bf21d60", "address3": "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549" },
        "base": { "address": "0xDFd5293D8e347dFe59E90eFd55b2956a1343963d", "address2": "0x28C6c06298d514Db089934071355E5743bf21d60" }
      },
      "URLS": {
         "TRADE": "https://www.binance.com/en/trade/{symbol}_USDT",
         "WITHDRAW": "https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/{token}",
         "DEPOSIT": "https://www.binance.com/en/my/wallet/account/main/deposit/crypto/{pair}",
         "ORDERBOOK": "https://api.binance.me/api/v3/depth?limit=4&symbol={symbol}USDT"
       },
    },
    "MEXC": {
      "WARNA": "#1448ce", "SHORT_NAME": "MEXC",
      "DATA_API": { "API_KEY": "mx0vglBh22wwHBY0il", "API_SECRET": "429877e0b47c41b68dd77613cdfded64" },
      "WALLETS": {
        "bsc": { "address": "0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB" },
        "polygon": { "address": "0x51E3D44172868Acc60D68ca99591Ce4230bc75E0" },
        "arbitrum": { "address": "0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB" },
        "ethereum": { "address": "0x75e89d5979E4f6Fba9F97c104c2F0AFB3F1dcB88", "address2": "0x9642b23Ed1E01Df1092B92641051881a322F5D4E" },
        "base": { "address": "0x4e3ae00E8323558fA5Cac04b152238924AA31B60" }
      },"URLS": {
         "TRADE": "https://www.mexc.com/exchange/{symbol}_USDT?_from=search",
         "WITHDRAW": "https://www.mexc.com/assets/withdraw/{token}",
         "DEPOSIT": "https://www.mexc.com/assets/deposit/{token}",
         "ORDERBOOK": "https://api.mexc.com/api/v3/depth?symbol={symbol}USDT&limit=5"
       },
    },
    "KUCOIN": {
      "WARNA": "#26e1a9ff", "SHORT_NAME": "KUCN",
      "DATA_API": {"API_KEY":"68df2e9903ad1c00011ae2a1","API_SECRET":"c05ae79a-a9a9-42b2-9d07-d2874fb8c59c","PASSPHRASE_API": "KUCOIN-API3"},
      "WALLETS": {
        "bsc": { "address": "0x58edF78281334335EfFa23101bBe3371b6a36A51", "address2": "0xD6216fC19DB775Df9774a6E33526131dA7D19a2c" },
        "polygon": { "address": "0x9AC5637d295FEA4f51E086C329d791cC157B1C84", "address2": "0xD6216fC19DB775Df9774a6E33526131dA7D19a2c" },
        "arbitrum": { "address": "0x03E6FA590CAdcf15A38e86158E9b3D06FF3399Ba" },
        "ethereum": { "address": "0x58edF78281334335EfFa23101bBe3371b6a36A51", "address2": "0xD6216fC19DB775Df9774a6E33526131dA7D19a2c" },
        "base": { "address": "0x58edF78281334335EfFa23101bBe3371b6a36A51", "address2": "0xD6216fC19DB775Df9774a6E33526131dA7D19a2c" }
      },
      "URLS": {
         "TRADE": "https://www.kucoin.com/trade/{symbol}-USDT",
         "WITHDRAW": "https://www.kucoin.com/assets/withdraw?currency={token}",
         "DEPOSIT": "https://www.kucoin.com/assets/deposit?currency={pair}",
         "ORDERBOOK": "https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol={symbol}-USDT"
       },
    },
    "BITGET": {
      "WARNA": "#2ed9ecff", "SHORT_NAME": "BITG",
      "DATA_API": {"API_KEY":"bg_cdea21a5594117963bf8463acd4b96d4","API_SECRET":"5019c054fb6bd3045afd0fadf78d97482e851f125dc8777a00934a5419c49581","PASSPHRASE_API": "APIBITGET"},
      "WALLETS": {
        "bsc": { "address": "0x0639556F03714A74a5fEEaF5736a4A64fF70D206", "address2": "0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673", "address3": "0x51971c86b04516062c1e708CDC048CB04fbe959f" },
        "polygon": { "address": "0x0639556F03714A74a5fEEaF5736a4A64fF70D206", "address2": "0x51971c86b04516062c1e708CDC048CB04fbe959f", "address3": "0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673" },
        "arbitrum": { "address": "0x5bdf85216ec1e38d6458c870992a69e38e03f7ef" },
        "ethereum": { "address": "0x0639556F03714A74a5fEEaF5736a4A64fF70D206", "address2": "0x51971c86b04516062c1e708CDC048CB04fbe959f", "address3": "0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673" },
        "base": { "address": "0x0639556F03714A74a5fEEaF5736a4A64fF70D206", "address2": "0x51971c86b04516062c1e708CDC048CB04fbe959f", "address3": "0xBDf5bAfEE1291EEc45Ae3aadAc89BE8152D4E673" }
      },
      "URLS": {
         "TRADE": "https://www.bitget.com/spot/{symbol}USDT",
         "WITHDRAW": "https://www.bitget.com/asset/withdraw?coin={token}",
         "DEPOSIT": "https://www.bitget.com/asset/deposit?coin={pair}",
         "ORDERBOOK": "https://api.bitget.com/api/v2/spot/market/orderbook?symbol={symbol}USDT&limit=5"
       },
    },
    "BYBIT": {
      "WARNA": "#130c01ff", "SHORT_NAME": "BYBX",
      "DATA_API": { "API_KEY": "H2e7P3xu7zzjmRllrl", "API_SECRET": "4xBB4NchMTxPBT68Ej86Y2UtC1sFfrcBZG1d" },
      "WALLETS": {
        "bsc": { "address": "0xf89d7b9c864f589bbf53a82105107622b35eaa40" },
        "polygon": { "address": "0xf89d7b9c864f589bbF53a82105107622B35EaA40" },
        "arbitrum": { "address": "0xf89d7b9c864f589bbF53a82105107622B35EaA40" },
        "ethereum": { "address": "0xf89d7b9c864f589bbF53a82105107622B35EaA40", "address2": "0xf89d7b9c864f589bbF53a82105107622B35EaA40" },
        "base": { "address": "0xf89d7b9c864f589bbF53a82105107622B35EaA40", "address2": "0xf89d7b9c864f589bbF53a82105107622B35EaA40" }
      },
      "URLS": {
         "TRADE": "https://www.bybit.com/trade/spot/{symbol}/USDT",
         "WITHDRAW": "https://www.bybit.com/user/assets/withdraw?coin={token}",
         "DEPOSIT": "https://www.bybit.com/user/assets/deposit?coin={token}",
         "ORDERBOOK": "https://api.bybit.com/v5/market/orderbook?category=spot&limit=4&symbol={symbol}USDT"
       },
    },
    "INDODAX": {
      "WARNA": "#057aacff", "SHORT_NAME": "INDX",
      "DATA_API":  {
         "API_KEY": "HRKOX8GL-KD9ANNF5-T7OKENAH-LHL5PBYQ-NW8GQICL",
         "API_SECRET": "2ff67f7546f9b1af3344f4012fbb5561969de9440f1d1432c89473d1fe007deb3f3d0bac7400622b"
       },
       "URLS": {
         "TRADE": "https://indodax.com/market/{symbol}IDR",
         "WITHDRAW": "https://indodax.com/finance/{token}#kirim",
         "DEPOSIT": "https://indodax.com/finance/{pair}",
         "ORDERBOOK": "https://indodax.com/api/depth/{symbol}_idr"
       },
      "WALLETS": {
         "arbitrum": { "address": "0x3C02290922a3618A4646E3BbCa65853eA45FE7C6" },
        "bsc": { "address": "0xaBa3002AB1597433bA79aBc48eeAd54DC10A45F2", "address2": "0x3C02290922a3618A4646E3BbCa65853eA45FE7C6" },
        "polygon": { "address": "0x3C02290922a3618A4646E3BbCa65853eA45FE7C6", "address2": "0x91Dca37856240E5e1906222ec79278b16420Dc92" },
        "ethereum": { "address": "0x3C02290922a3618A4646E3BbCa65853eA45FE7C6", "address2": "0x91Dca37856240E5e1906222ec79278b16420Dc92" },
        "base": { "address": "0x3C02290922a3618A4646E3BbCa65853eA45FE7C6", "address2": "0x91Dca37856240E5e1906222ec79278b16420Dc92" }
      }
    }
  },
  "LIST_PROXY": {
    "SERVERS": [
       "https://server1.ciwayeh967.workers.dev/?",
        "https://yazid3.yazidcrypto7.workers.dev/?",
        "https://yazid5.bustomi.workers.dev/?",
        "https://yazid4.yazidcrypto3.workers.dev/?",
        "https://yoeazd2.yoeaz2324.workers.dev/?",
        "https://server6.hejij49077.workers.dev/?",
        "https://server7.gejac16482.workers.dev/?",
        "https://server8.xotolo5853.workers.dev/?",
        "https://server9.dopacer193.workers.dev/?",
        "https://server10.samoker104.workers.dev/?",
        "https://worker-bold-meadow-ab0a.xaraho1024.workers.dev/?",
        "https://worker-cool-truth-c06e.nomege1872.workers.dev/?",
        "https://worker-floral-river-e85c.tenimik318.workers.dev/?",
        "https://worker-royal-sound-0576.koban78574.workers.dev/?",
        "https://worker-curly-credit-2c73.viyeva7164.workers.dev/?",
        "https://worker-royal-haze-a135.lisolo3133.workers.dev/?",
        "https://worker-shy-cloud-27ca.vanogo6423.workers.dev/?",
        "https://worker-withered-sky-ed3e.vifeci7919.workers.dev/?",
        "https://worker-sweet-sound-e261.jaxet60213.workers.dev/?",
        "https://worker-shiny-sun-08f7.xabenic669.workers.dev/?",
        "https://worker-frosty-darkness-4f91.lobowev486.workers.dev/?",
        "https://worker-silent-boat-3c2e.celov42704.workers.dev/?",
        "https://worker-round-star-6bf9.yalayo9082.workers.dev/?",
        "https://worker-cool-dream-e973.gocon75635.workers.dev/?",
        "https://worker-winter-sound-52bd.pedig30998.workers.dev/?",
        "https://worker-super-lake-198e.kevaraj359.workers.dev/?",
        "https://worker-soft-dawn-b769.robiho8355.workers.dev/?",
        "https://worker-weathered-forest-2a2e.fiwala7986.workers.dev/?",
        "https://worker-still-tooth-553b.sewis68418.workers.dev/?",
        "https://worker-solitary-waterfall-f039.fomev71287.workers.dev/?",
        "https://server4.dajom23364.workers.dev/?",
        "https://server3.hopevap663.workers.dev/?",
        "https://worker-blue-mountain-bee9.hibes27870.workers.dev/?",
        "https://worker-still-morning-642c.kehoc99044.workers.dev/?",
        "https://myserver4.lamowa2709.workers.dev/?",
        "https://myserver5.mohafe9330.workers.dev/?",
        "https://worker-young-bush-ce2e.micejiy771.workers.dev/?",
        "https://worker-sparkling-silence-9d41.federi4672.workers.dev/?",
        "https://worker-polished-cloud-77bd.renel72768.workers.dev/?",
        "https://worker-sweet-darkness-d1c0.risiv74771.workers.dev/?",
        "https://worker-jolly-wildflower-c305.kacito9688.workers.dev/?",
        "https://worker-dawn-king-f162.kekam96808.workers.dev/?",
        "https://worker-shrill-bonus-9ca6.wipihoh336.workers.dev/?",
        "https://worker-tiny-bar-013f.gicot48223.workers.dev/?",
        "https://worker-tight-violet-dbda.xemojos811.workers.dev/?",
        "https://worker-tight-lab-9cc4.fetec22957.workers.dev/?",
        "https://server2.holabaj699.workers.dev/?",
        "https://myserver3.ceteg74201.workers.dev/?",
        "https://1.iiknrbtxoz.workers.dev/?",
        "https://2.5iz3h20guj.workers.dev/?",
        "https://3.g5l3krmasa-bda.workers.dev/?",
        "https://4.7gggrv7tyo.workers.dev/?",
        "https://5.1mynz671ti.workers.dev/?",
        "https://6.6dn6rtqjng.workers.dev/?",
        "https://7.zk3dvkv4pp.workers.dev/?",
        "https://8.c58qvb11ew.workers.dev/?",
        "https://9.n9zkqpbdpb.workers.dev/?",
        "https://10.tximoyq5se.workers.dev/?",
        "https://server11.jiser33752.workers.dev/?",
        "https://server12.yitijex843.workers.dev/?",
        "https://server13.lovah68689.workers.dev/?",
        "https://server14.setopit195.workers.dev/?",
        "https://server15.povaf41444.workers.dev/?",
        "https://server16.niromaf426.workers.dev/?",
        "https://server17.kasoda9624.workers.dev/?",
        "https://server18.befim19137.workers.dev/?",
        "https://server19.gafigaf751.workers.dev/?",
        "https://server20.gayomep515.workers.dev/?",
        "https://worker-plain-shape-e4c4.dilexid433.workers.dev/?",
        "https://worker-weathered-bar-d4fa.dadiyo8115.workers.dev/?",
        "https://myserver3.ceteg74201.workers.dev/?",
        "https://server21.becibov328.workers.dev/?",
        "https://server22.togid93865.workers.dev/?",
        "https://server24.yaleve6056.workers.dev/?",
        "https://server23.bagotof270.workers.dev/?",
        "https://new1.gisot33558.workers.dev/?",
        "https://new2.sober27867.workers.dev/?",
        "https://new3.micipiy438.workers.dev/?",
        "https://new3.rayepar467.workers.dev/?",
        "https://new4.xebidi4752.workers.dev/?",
        "https://new5.cibiyec145.workers.dev/?",
        "https://worker-frosty-star-71a8.cesaxem416.workers.dev/?",
        "https://worker-sweet-dust-96ef.payat56154.workers.dev/?",
        "https://new5.nafeyis928.workers.dev/?",
        "https://worker-broad-tree-49bb.cekah58754.workers.dev/?",
        "https://worker-ancient-hill-fad1.xejab72348.workers.dev/?",
        "https://cors.gemul-putra.workers.dev/?",
        "https://worker-damp-glitter-db50.gameco3780.workers.dev/?",
        "https://worker-blue-hall-1d14.xinevo2786.workers.dev/?",
        "https://worker-tiny-dust-22f2.capaji8287.workers.dev/?",
        "https://worker-old-disk-8a9a.kehaxa7686.workers.dev/?",
        "https://worker-yellow-wood-677d.lanafi2429.workers.dev/?",
        "https://worker-cool-tree-07c7.kifira7062.workers.dev/?",
        "https://myserver6.bafayi9378.workers.dev/?",
        "https://myserver7.yiwaj21571.workers.dev/?",
        "https://myserver7.yiwaj21571.workers.dev/?",
        "https://myserver5.mohafe9330.workers.dev/?",
        "https://worker-weathered-bar-d4fa.dadiyo8115.workers.dev/?"

    ]
  },

  // Telegram Configuration
  "TELEGRAM": {
    "BOT_TOKEN": "7853809693:AAHl8e_hjRyLgbKQw3zoUSR_aqCbGDg6nHo",
    "CHAT_ID": "-1002079288809"
  }
};
