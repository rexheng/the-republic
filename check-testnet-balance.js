const { ethers } = require('ethers');

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider('https://coston2-api.flare.network/ext/C/rpc');
  const address = '0xE7C5bB914828e198f3aEA2b415270A233F47b6F1';
  
  const balance = await provider.getBalance(address);
  const balanceInFLR = ethers.formatEther(balance);
  
  console.log('Address:', address);
  console.log('Balance:', balanceInFLR, 'C2FLR');
  
  if (parseFloat(balanceInFLR) > 0) {
    console.log('✅ Has tokens!');
  } else {
    console.log('❌ No tokens! Get from faucet.');
  }
}

checkBalance();
