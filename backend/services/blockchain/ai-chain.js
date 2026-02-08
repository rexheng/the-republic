class AIChain {
  constructor(opts = {}) {
    this.name = 'Plasma Testnet';
    this.chainId = 9746;
    this.rpcUrl = opts.rpcUrl || process.env.PLASMA_RPC || 'https://testnet-rpc.plasma.to';
    console.log('AIChain initializing with RPC:', this.rpcUrl);
    this.connected = false;
    this.blockNumber = null;
    this._connect();
  }

  async _connect() {
    try {
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      this.blockNumber = parseInt(data.result, 16);
      this.connected = true;
    } catch (err) {
      console.error('AIChain connection error:', err);
      this.connected = false;
    }
  }

  async getBlockNumber() {
    try {
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      this.blockNumber = parseInt(data.result, 16);
      this.connected = true;
      return this.blockNumber;
    } catch {
      return this.blockNumber;
    }
  }

  getStatus() {
    return {
      name: this.name,
      chainId: this.chainId,
      connected: this.connected,
      blockNumber: this.blockNumber,
      role: 'AI agent transactions, autonomous operations',
    };
  }
}

module.exports = AIChain;
