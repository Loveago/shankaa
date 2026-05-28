/**
 * Price Router — resolves the effective price for a product based on role.
 *
 * Resolution priority:
 *   1. Role-specific price (RolePrice matching user role)
 *   2. Promo price (if usePromoPrice is active)
 *   3. Base product price (fallback)
 */

/**
 * Resolve the effective price for a given product and user role.
 * @param {Object} product - Product object (must include `rolePrices` array when available, plus `price`, `promoPrice`, `usePromoPrice`)
 * @param {string} role - User role (USER, PREMIUM, NORMAL, SUPER, OTHER)
 * @returns {number}
 */
const resolvePrice = (product, role) => {
  if (!product) return 0;

  // 1. Role-specific price
  if (role && product.rolePrices && Array.isArray(product.rolePrices)) {
    const match = product.rolePrices.find((rp) => rp.role === role);
    if (match && typeof match.price === 'number' && match.price >= 0) {
      return match.price;
    }
  }

  // 2. Promo price
  if (product.usePromoPrice && product.promoPrice != null) {
    return product.promoPrice;
  }

  // 3. Base price
  return product.price || 0;
};

/**
 * Attach resolved price to a product object (mutates and returns).
 * Adds `effectivePrice` key to the product.
 * @param {Object} product
 * @param {string} role
 * @returns {Object}
 */
const attachResolvedPrice = (product, role) => {
  product.effectivePrice = resolvePrice(product, role);
  return product;
};

/**
 * Prisma include fragment to pull rolePrices alongside a product query.
 * Usage:  prisma.product.findMany({ include: { ...rolePriceInclude } })
 */
const rolePriceInclude = {
  rolePrices: {
    select: { role: true, price: true },
  },
};

/**
 * Helper to build a select/object that always includes rolePrices
 * alongside the default product fields needed for price calculation.
 */
const productWithPricesSelect = (extraFields = {}) => ({
  id: true,
  name: true,
  price: true,
  promoPrice: true,
  usePromoPrice: true,
  ...extraFields,
  rolePrices: {
    select: { role: true, price: true },
  },
});

module.exports = {
  resolvePrice,
  attachResolvedPrice,
  rolePriceInclude,
  productWithPricesSelect,
};
