const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Enabling product 1 in shop...\n');
    
    const updated = await prisma.product.update({
      where: { id: 1 },
      data: {
        showInShop: true,
        shopStockClosed: false
      }
    });

    console.log('✓ Product enabled:');
    console.log(`  ID: ${updated.id}`);
    console.log(`  Name: ${updated.name}`);
    console.log(`  ShowInShop: ${updated.showInShop}`);
    console.log(`  ShopClosed: ${updated.shopStockClosed}`);
    console.log(`  Stock: ${updated.stock}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
