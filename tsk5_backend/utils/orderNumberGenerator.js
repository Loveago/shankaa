/**
 * Generate a wallet reference for non-Paystack orders.
 * These are used when orders are paid via wallet balance (no Paystack transaction).
 * Format: WALLET-YYYYMMDD-XXXXXX
 * Example: WALLET-20260605-123456
 */
const generateWalletRef = () => {
  const now = new Date();
  
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  return `WALLET-${dateStr}-${randomNum}`;
};

module.exports = { generateWalletRef };
