// Backend URL
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Semantic Scholar API config
export const SEMANTIC_SCHOLAR = {
  BASE_URL: 'https://api.semanticscholar.org/graph/v1',
  RECOMMENDATIONS_URL: 'https://api.semanticscholar.org/recommendations/v1',
  PROXY_URL: 'https://api.allorigins.win/raw?url=',
  API_KEY: import.meta.env.VITE_S2_API_KEY || '',
  FIELDS: 'paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,externalIds,references,citations,tldr,influentialCitationCount',
  SEARCH_FIELDS: 'paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,externalIds,tldr,influentialCitationCount',
  RECOMMENDATION_FIELDS: 'paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,externalIds,tldr,influentialCitationCount',
  MAX_NODES: 5000,
  SEARCH_LIMIT: 20,
  RATE_LIMIT_MS: 1050,
};

export const GRAPH_COLORS = {
  EXTERNAL: '#4A90D9',
  ONCHAIN: '#48BB78',
  USER: '#ECC94B',
  EDGE: 'rgba(150,150,150,0.3)',
  EDGE_HIGHLIGHT: 'rgba(102,126,234,0.8)',
  BACKGROUND: '#0f1729',
};

// Contract addresses - Flare Coston2 testnet (deployed 2026-02-08)
export const CONTRACTS = {
  RESEARCH_GRAPH: import.meta.env.VITE_RESEARCH_GRAPH || '0xa67F7685584536c58521B5F1BE31420F6C25286E',
  RESEARCH_TOKEN: import.meta.env.VITE_RESEARCH_TOKEN || '0xC7449900A141b235cF110De8690ddd8fB2Da911F',
  USDC: import.meta.env.VITE_USDC || '0xe2f9947545c29B171C2528E70EF2E10EB4dCa5c3',
  PREDICTION_MARKET: import.meta.env.VITE_PREDICTION_MARKET || '0xa81C1C6E54D0Dc3d3339aBD8646A6001FA209244',
};

export const NETWORKS = {
  FLARE_TESTNET: {
    chainId: '0x72',
    chainName: 'Flare Testnet Coston2',
    nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
    rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
    blockExplorerUrls: ['https://coston2-explorer.flare.network/'],
  },
  PLASMA_TESTNET: {
    chainId: '0x1E61',
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
    'function createMarket(uint256 paperId, string question, uint256 duration, int256 b) external returns (uint256)',
    'function buyYes(uint256 marketId, int256 shares) external',
    'function buyNo(uint256 marketId, int256 shares) external',
    'function resolveMarket(uint256 marketId, bool outcome) external',
    'function claimWinnings(uint256 marketId) external',
    'function getYesPrice(uint256 marketId) external view returns (int256)',
    'function getMarket(uint256 marketId) external view returns (tuple(uint256 id, uint256 paperId, address creator, string question, uint256 endTime, int256 qYes, int256 qNo, int256 b, bool resolved, bool outcome, uint256 totalParticipants))',
    'function getUserPosition(uint256 marketId, address user) external view returns (tuple(int256 yesShares, int256 noShares, bool claimed))',
    'function marketCount() external view returns (uint256)',
    'event MarketCreated(uint256 indexed marketId, uint256 indexed paperId, string question, uint256 endTime, int256 b)',
    'event SharesBought(uint256 indexed marketId, address indexed user, bool isYes, int256 shares, uint256 cost)',
    'event MarketResolved(uint256 indexed marketId, bool outcome)',
    'event PayoutClaimed(uint256 indexed marketId, address indexed user, uint256 payout)',
  ],
};
