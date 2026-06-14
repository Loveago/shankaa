const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking available shop products...\n');
    
    const products = await prisma.product.findMany({
      where: {
        showInShop: true,
        shopStockClosed: false,
        stock: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        showInShop: true,
        shopStockClosed: true
      },
      take: 10
    });

    console.log(`Found ${products.length} available shop products:\n`);
    
    if (products.length === 0) {
      console.log('No products available in shop!');
      
      // Check all products
      const allProducts = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          showInShop: true,
          shopStockClosed: true,
          stock: true
        },
        take: 10
      });
      
      console.log('\nAll products:');
      allProducts.forEach(p => {
        console.log(`  ID: ${p.id}, Name: ${p.name}, ShowInShop: ${p.showInShop}, ShopClosed: ${p.shopStockClosed}, Stock: ${p.stock}`);
      });
    } else {
      products.forEach((p, idx) => {
        console.log(`${idx + 1}. ID: ${p.id}, Name: ${p.name}, Price: GHS ${p.price}, Stock: ${p.stock}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
