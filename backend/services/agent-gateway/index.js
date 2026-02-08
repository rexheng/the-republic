const path = require('path');
const fs = require('fs');
const Budget = require('./budget');
const WalletManager = require('./wallet-manager');

class AgentGateway {
  constructor(opts = {}) {
    this.kg = opts.kg;
    this.provider = null;
    this.mockResponses = {};
    this.budget = new Budget(opts.budget);
    this.walletManager = new WalletManager(opts.wallets);
    this.trismHook = null;

    // Load mock responses
    const mockPath = path.join(__dirname, '../../fixtures/llm-responses.json');
    if (fs.existsSync(mockPath)) {
      this.mockResponses = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
    }

    // Initialise provider
    const geminiKey = opts.geminiKey || process.env.GEMINI_API_KEY;
    const claudeKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;

    if (geminiKey && geminiKey !== 'mock') {
      const GeminiProvider = require('./providers/gemini');
      this.provider = new GeminiProvider(geminiKey);
    } else if (claudeKey && claudeKey !== 'mock') {
      const ClaudeProvider = require('./providers/claude');
      this.provider = new ClaudeProvider(claudeKey);
    } else {
      const MockProvider = require('./providers/mock');
      this.provider = new MockProvider(this.mockResponses);
    }

    // Load agent definitions from seed
    this.agents = new Map();
    const seedPath = path.join(__dirname, '../../fixtures/demo-seed.json');
    if (fs.existsSync(seedPath)) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      (seed.agents || []).forEach(a => this.agents.set(a.id, a));
    }
  }

  setTRiSMHook(hook) {
    this.trismHook = hook;
  }

  async chat(agentId, task, context = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found`);

    const budgetCheck = this.budget.canSpend(agent.caste);
    if (!budgetCheck.allowed) {
      return { error: 'Budget exceeded', caste: agent.caste, usage: budgetCheck };
    }

    const systemPrompt = `You are ${agent.name}, a ${agent.role} in The Republic research verification platform. Caste: ${agent.caste}. ${agent.description}`;

    const response = await this.provider.chat({
      system: systemPrompt,
      message: task,
      temperature: agent.temperature || 0.5,
      context,
    });

    this.budget.recordSpend(agent.caste, response.tokensUsed || 500);

    // TRiSM post-response hook
    if (this.trismHook) {
      const check = await this.trismHook(agentId, response.content, context);
      response.trismResult = check;
    }

    return {
      agentId,
      agentName: agent.name,
      caste: agent.caste,
      content: response.content,
      tokensUsed: response.tokensUsed || 500,
      trismResult: response.trismResult || null,
    };
  }

  getAgents() {
    return Array.from(this.agents.values());
  }

  getBudget() {
    return this.budget.getStatus();
  }

  async createAgentWallet(agentId) {
    return this.walletManager.createWallet(agentId);
  }

  getAgentWallet(agentId) {
    return this.walletManager.getWallet(agentId);
  }

  healthCheck() {
    return {
      status: 'ok',
      agents: this.agents.size,
      provider: this.provider.constructor.name,
      budget: this.budget.getStatus(),
    };
  }
}

module.exports = AgentGateway;
