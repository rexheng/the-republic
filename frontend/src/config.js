// Semantic Scholar API config
export const SEMANTIC_SCHOLAR = {
  BASE_URL: 'https://api.semanticscholar.org/graph/v1',
  RECOMMENDATIONS_URL: 'https://api.semanticscholar.org/recommendations/v1',
  PROXY_URL: 'https://api.allorigins.win/raw?url=',
  API_KEY: 'C2F3wqvKzQxQO7UrAhgr1X4oC5hA0Eq9uoCaPKNi',
  FIELDS: 'paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,externalIds,references,citations,tldr,influentialCitationCount',
  SEARCH_FIELDS: 'paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,externalIds,tldr,influentialCitationCount',
  RECOMMENDATION_FIELDS: 'paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,externalIds,tldr,influentialCitationCount',
  MAX_NODES: 5000,
  SEARCH_LIMIT: 20,
  RATE_LIMIT_MS: 1050, // 1 req/sec + small buffer
};

export const GRAPH_COLORS = {
  EXTERNAL: '#4A90D9',    // Blue - Semantic Scholar papers
  ONCHAIN: '#48BB78',     // Green - on-chain papers
  USER: '#ECC94B',        // Gold - user's own papers
  EDGE: 'rgba(150,150,150,0.3)',
  EDGE_HIGHLIGHT: 'rgba(102,126,234,0.8)',
  BACKGROUND: '#0f1729',
};

// Contract addresses - localhost deployment
export const CONTRACTS = {
  RESEARCH_GRAPH: process.env.REACT_APP_RESEARCH_GRAPH || '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
  RESEARCH_TOKEN: process.env.REACT_APP_RESEARCH_TOKEN || '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
  USDC: process.env.REACT_APP_USDC || '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
  PREDICTION_MARKET: process.env.REACT_APP_PREDICTION_MARKET || '0x0000000000000000000000000000000000000000',
};

export const NETWORKS = {
  FLARE_TESTNET: {
    chainId: '0x72', // 114
    chainName: 'Flare Testnet Coston2',
    nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
    rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
    blockExplorerUrls: ['https://coston2-explorer.flare.network/'],
  },
  PLASMA_TESTNET: {
    chainId: '0x1E61', // 7777
    chainName: 'Plasma Testnet',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc-testnet.plasma.xyz'],
    blockExplorerUrls: ['https://explorer-testnet.plasma.xyz/'],
  },
};

export const ABIS = {
  RESEARCH_GRAPH: [
    'function submitPaper(string ipfsHash, string doi) external returns (uint256)',
    'function submitReview(uint256 paperId, uint8 score, string ipfsHash) external',
    'function addCitation(uint256 citingPaperId, uint256 citedPaperId) external',
    'function registerAsReviewer(uint256 stakeAmount) external',
    'function verifyExternalData(uint256 paperId) external',
    'function getPaper(uint256 paperId) external view returns (tuple(uint256 id, address author, string ipfsHash, string doi, uint8 status, uint256 submissionFee, uint256 timestamp, uint256 citationCount, uint256 replicationCount, bytes32 fdcRequestId, bool externalDataVerified))',
    'function getPaperReviewers(uint256 paperId) external view returns (address[])',
    'function getCitations(uint256 paperId) external view returns (uint256[])',
    'function paperCount() external view returns (uint256)',
    'function submissionFeeUSD() external view returns (uint256)',
    'function reviewRewardUSD() external view returns (uint256)',
    'event PaperSubmitted(uint256 indexed paperId, address indexed author, string ipfsHash, string doi)',
    'event ReviewSubmitted(uint256 indexed reviewId, uint256 indexed paperId, address indexed reviewer)',
    'event CitationAdded(uint256 indexed citingPaper, uint256 indexed citedPaper)',
  ],
  ERC20: [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)',
  ],
  PREDICTION_MARKET: [
    'function createMarket(uint256 paperId, string question, uint256 duration) external returns (uint256)',
    'function stake(uint256 marketId, bool position, uint256 amount) external',
    'function resolveMarket(uint256 marketId, bool outcome) external',
    'function claimPayout(uint256 marketId) external',
    'function getMarket(uint256 marketId) external view returns (tuple(uint256 id, uint256 paperId, address creator, string question, uint256 endTime, uint256 yesPool, uint256 noPool, bool resolved, bool outcome, uint256 totalParticipants))',
    'function getUserStake(uint256 marketId, address user) external view returns (tuple(uint256 amount, bool position, bool claimed))',
    'function calculatePayout(uint256 marketId, bool position, uint256 amount) external view returns (uint256)',
    'function marketCount() external view returns (uint256)',
    'event MarketCreated(uint256 indexed marketId, uint256 indexed paperId, string question, uint256 endTime)',
    'event StakePlaced(uint256 indexed marketId, address indexed user, bool position, uint256 amount)',
    'event MarketResolved(uint256 indexed marketId, bool outcome)',
    'event PayoutClaimed(uint256 indexed marketId, address indexed user, uint256 amount)',
  ],
};
