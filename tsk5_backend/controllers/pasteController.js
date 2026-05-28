const prisma = require('../config/db');
const userService = require('../services/userService');
const cartService = require('../services/cartService');

exports.pasteAndProcessOrders = async (req, res) => {
  console.log('--- [PASTE AND PROCESS ORDERS] Endpoint hit ---');

  try {
    const { agentId, network, textData } = req.body;
    if (!agentId || !network || !textData) {
      return res.status(400).json({ success: false, message: 'Missing agentId, network, or textData.' });
    }

    const lines = textData.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      return res.status(400).json({ success: false, message: 'No data submitted.' });
    }

    const agent = await userService.getUserById(parseInt(agentId));
    if (!agent) {
      return res.status(400).json({ success: false, message: 'Agent not found.' });
    }
    const userRole = agent.role;

    let errorReport = [];
    let productsToAdd = [];

    // Track duplicates across rows (phone + product combo)
    const seenEntries = new Set();
    let duplicateWarning = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const parts = line.split(/\s+/);
      let rowErrors = [];

      if (parts.length !== 2) {
        rowErrors.push('Invalid format. Each line must be: phone_number space bundle_amount.');
        errorReport.push({ row: i + 1, errors: rowErrors });
        continue;
      }

      let [phoneNumber, bundleAmount] = parts;

      if (!phoneNumber) rowErrors.push('Missing phone number.');
      if (!bundleAmount || isNaN(parseFloat(bundleAmount))) rowErrors.push('Invalid or missing bundle amount.');

      // Normalize phone number: strip non-digits
      if (phoneNumber) {
        phoneNumber = phoneNumber.replace(/\D/g, '');
        // If 9 digits (e.g. 257467983), prepend 0 to make it 0257467983
        if (phoneNumber.length === 9) {
          phoneNumber = '0' + phoneNumber;
        }
        // If international format starting with 233 (12 digits), convert to local
        if (phoneNumber.length === 12 && phoneNumber.startsWith('233')) {
          phoneNumber = '0' + phoneNumber.substring(3);
        }
      }

      if (rowErrors.length > 0) {
        errorReport.push({ row: i + 1, errors: rowErrors });
        continue;
      }

      const productDescription = `${bundleAmount}GB`;

      const product = await prisma.product.findFirst({
        where: {
          name: { contains: network.toUpperCase() },
          description: productDescription,
        },
      });

      if (!product) {
        rowErrors.push(`Product not found for network ${network} with bundle ${productDescription}.`);
      } else if (product.stock <= 0) {
        rowErrors.push(`Product with bundle ${productDescription} and network ${network} is out of stock.`);
      } else {
        // Check for duplicate phone + product combo within this paste
        const entryKey = `${phoneNumber}_${product.id}`;
        if (seenEntries.has(entryKey)) {
          if (!duplicateWarning) duplicateWarning = [];
          duplicateWarning.push(`Row ${i + 1}: Duplicate entry for ${phoneNumber} with ${bundleAmount}GB — skipped.`);
          continue; // Skip this duplicate row silently
        }
        seenEntries.add(entryKey);
        productsToAdd.push({ product, quantity: 1, phoneNumber });
      }

      if (rowErrors.length > 0) {
        errorReport.push({ row: i + 1, errors: rowErrors });
      }
    }

    if (errorReport.length > 0) {
      return res.status(400).json({ success: false, errorReport });
    }

    for (const item of productsToAdd) {
      await cartService.addItemToCart(agent.id, item.product.id, item.quantity, item.phoneNumber);
    }

    let responseMessage = `${productsToAdd.length} products added to cart.`;
    if (duplicateWarning) {
      responseMessage += ` ${duplicateWarning.length} duplicate(s) were removed: ${duplicateWarning.join(' ')}`;
    }

    return res.json({ success: true, message: responseMessage });

  } catch (err) {
    console.log('ERROR in pasteAndProcessOrders:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
