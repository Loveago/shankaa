const prisma = require("../config/db");

/**
 * Normalize a phone number to common variants for searching.
 * Returns an array of possible formats (e.g., "024XXXXXXX", "24XXXXXXX", "23324XXXXXXX").
 */
function getPhoneVariants(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return [];
  const variants = [cleaned];
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    variants.push(cleaned.substring(1));
    variants.push('233' + cleaned.substring(1));
  } else if (cleaned.startsWith('233') && cleaned.length === 12) {
    variants.push('0' + cleaned.substring(3));
    variants.push(cleaned.substring(3));
  } else if (cleaned.length === 9) {
    variants.push('0' + cleaned);
    variants.push('233' + cleaned);
  }
  return [...new Set(variants)];
}

/**
 * Check if ANY of the given phone numbers have pending/processing order items.
 * Returns an array of locked phone numbers (the ones with pending/processing items).
 * 
 * @param {string[]} phoneNumbers - Array of phone numbers to check
 * @param {object} [tx] - Optional Prisma transaction client
 * @returns {Promise<string[]>} - Array of phone numbers that are locked
 */
async function findLockedPhones(phoneNumbers, tx = null) {
  const db = tx || prisma;
  const allVariants = new Set();
  const phoneToVariants = {};

  for (const phone of phoneNumbers) {
    if (!phone) continue;
    const variants = getPhoneVariants(phone);
    if (variants.length === 0) continue;
    phoneToVariants[phone] = variants;
    variants.forEach(v => allVariants.add(v));
  }

  if (allVariants.size === 0) return [];

  // Find any order items with these phone numbers that are NOT in a final state.
  // The query already performs exact matching against normalized variants,
  // so we should not do any substring matching afterwards.
  const lockedItems = await db.orderItem.findMany({
    where: {
      status: { in: ["Pending", "Processing"] },
      OR: [
        { mobileNumber: { in: [...allVariants] } },
        { order: { mobileNumber: { in: [...allVariants] } } }
      ]
    },
    select: {
      mobileNumber: true,
      order: { select: { mobileNumber: true } }
    }
  });

  if (lockedItems.length === 0) return [];

  const matchedLockedVariants = new Set();
  for (const item of lockedItems) {
    for (const variant of getPhoneVariants(item.mobileNumber)) {
      matchedLockedVariants.add(variant);
    }
    for (const variant of getPhoneVariants(item.order?.mobileNumber)) {
      matchedLockedVariants.add(variant);
    }
  }

  const lockedSet = new Set();
  for (const [inputPhone, variants] of Object.entries(phoneToVariants)) {
    if (variants.some(v => matchedLockedVariants.has(v))) {
      lockedSet.add(inputPhone);
    }
  }

  return [...lockedSet];
}

/**
 * Validate that none of the given phone numbers have pending/processing orders.
 * Throws an error if any phone is locked.
 * 
 * @param {string[]} phoneNumbers - Array of phone numbers to validate
 * @param {object} [tx] - Optional Prisma transaction client
 * @throws {Error} If any phone number has pending/processing orders
 */
async function validatePhonesNotLocked(phoneNumbers, tx = null) {
  const lockedPhones = await findLockedPhones(phoneNumbers, tx);
  if (lockedPhones.length > 0) {
    const phoneList = lockedPhones.join(', ');
    throw new Error(
      `The following phone number(s) have pending orders: ${phoneList}. ` +
      `Please wait for the existing orders to be processed/completed before placing new orders for these numbers.`
    );
  }
}

module.exports = {
  getPhoneVariants,
  findLockedPhones,
  validatePhonesNotLocked
};
