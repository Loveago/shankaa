/**
 * Generate order number in format: GH + MMM + YY + random numbers
 * Example: GHJUL24123456
 */
const generateOrderNumber = () => {
  const now = new Date();
  
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[now.getMonth()];
  const year = String(now.getFullYear()).slice(-2);
  
  const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  return `GH${month}${year}${randomNum}`;
};

module.exports = { generateOrderNumber };
