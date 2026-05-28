const prisma = require("../config/db");
const { productWithPricesSelect } = require("../utils/priceRouter");

const makeInclude = () => ({
  rolePrices: {
    select: { role: true, price: true },
  },
});

const addProduct = async (name, description, price, stock, promoPrice = null) => {
  const existingProducts = await prisma.product.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  let nextProductId = 1;
  for (const product of existingProducts) {
    if (product.id !== nextProductId) break;
    nextProductId += 1;
  }

  return await prisma.product.create({
    data: { id: nextProductId, name, description, price, stock, promoPrice },
    include: makeInclude(),
  });
};

const getAllProducts = async () => {
  return await prisma.product.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: makeInclude(),
  });
};

const getProductById = async (id) => {
  return await prisma.product.findUnique({
    where: { id },
    include: makeInclude(),
  });
};

const updateProduct = async (id, data) => {
  return await prisma.product.update({
    where: { id },
    data,
    include: makeInclude(),
  });
};

const setProductStockToZero = async (id) => {
  return await prisma.product.update({
    where: { id },
    data: { stock: 0 },
    include: makeInclude(),
  });
};

const setAllProductStockToZero = async (stockValue) => {
  return await prisma.product.updateMany({
    data: { stock: stockValue },
  });
};

// Get products visible in shop (includes out-of-stock products)
const getShopProducts = async () => {
  return await prisma.product.findMany({
    where: {
      showInShop: true
    },
    orderBy: {
      createdAt: "desc",
    },
    include: makeInclude(),
  });
};

// Toggle product shop visibility
const toggleShopVisibility = async (id, showInShop) => {
  return await prisma.product.update({
    where: { id },
    data: { showInShop },
    include: makeInclude(),
  });
};

const deleteProduct = async (id) => {
  return await prisma.$transaction(async (tx) => {
    // Delete related cart items
    await tx.cartItem.deleteMany({
      where: { productId: id }
    });
    
    // Delete related order items
    await tx.orderItem.deleteMany({
      where: { productId: id }
    });

    // Delete related referral orders
    await tx.referralOrder.deleteMany({
      where: { productId: id }
    });
    
    // Delete the product
    return await tx.product.delete({
      where: { id }
    });
  }, { timeout: 15000 });
};

// ===== Role-price management =====

/**
 * Upsert a single role-price row.
 * Creates if missing, updates if exists.
 */
const upsertRolePrice = async (productId, role, price) => {
  return await prisma.rolePrice.upsert({
    where: { productId_role: { productId, role } },
    create: { productId, role, price },
    update: { price },
  });
};

/**
 * Delete a single role-price row by productId + role.
 */
const deleteRolePrice = async (productId, role) => {
  return await prisma.rolePrice.deleteMany({
    where: { productId, role },
  });
};

/**
 * Replace ALL role prices for a product atomically.
 * Expects an array of { role, price } objects.
 */
const setRolePrices = async (productId, rolePrices) => {
  if (!Array.isArray(rolePrices)) throw new Error("rolePrices must be an array");
  return await prisma.$transaction(async (tx) => {
    await tx.rolePrice.deleteMany({ where: { productId } });
    if (rolePrices.length > 0) {
      await tx.rolePrice.createMany({
        data: rolePrices.map((rp) => ({
          productId,
          role: rp.role,
          price: rp.price,
        })),
      });
    }
    return await tx.product.findUnique({
      where: { id: productId },
      include: makeInclude(),
    });
  });
};

// Bulk update stock by carrier name filter using a single DB call
const bulkUpdateStockByCarrier = async (carrier, stockValue) => {
  return await prisma.product.updateMany({
    where: {
      name: { contains: carrier }
    },
    data: { stock: stockValue },
  });
};

// Bulk update shopStockClosed for all shop products
const bulkUpdateShopStock = async (closeStock) => {
  return await prisma.product.updateMany({
    where: { showInShop: true },
    data: { shopStockClosed: closeStock },
  });
};

// Toggle agent visibility for a single product
const toggleAgentVisibility = async (id, showForAgents) => {
  return await prisma.product.update({
    where: { id },
    data: { showForAgents },
    include: makeInclude(),
  });
};

// Bulk update agent visibility - optionally filtered by carrier
const bulkUpdateAgentVisibility = async (showForAgents, carrier = null) => {
  const where = carrier ? { name: { contains: carrier } } : {};
  return await prisma.product.updateMany({
    where,
    data: { showForAgents },
  });
};

// Get products visible for agents
const getAgentProducts = async () => {
  return await prisma.product.findMany({
    where: {
      showForAgents: true,
    },
    orderBy: { createdAt: "desc" },
    include: makeInclude(),
  });
};

// Toggle usePromoPrice for a single product
const togglePromoPrice = async (id, usePromoPrice) => {
  return await prisma.product.update({
    where: { id },
    data: { usePromoPrice },
    include: makeInclude(),
  });
};

// Bulk switch between main and promo prices - optionally filtered by carrier
const bulkTogglePromoPrice = async (usePromoPrice, carrier = null) => {
  const where = carrier ? { name: { contains: carrier } } : {};
  return await prisma.product.updateMany({
    where,
    data: { usePromoPrice },
  });
};

module.exports = {
  addProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  setProductStockToZero,
  setAllProductStockToZero,
  getShopProducts,
  toggleShopVisibility,
  bulkUpdateStockByCarrier,
  bulkUpdateShopStock,
  toggleAgentVisibility,
  bulkUpdateAgentVisibility,
  getAgentProducts,
  togglePromoPrice,
  bulkTogglePromoPrice,
  upsertRolePrice,
  deleteRolePrice,
  setRolePrices,
};
