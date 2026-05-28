const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const prods = await prisma.product.findMany({
      where: { name: { contains: 'MTN' } },
      include: { rolePrices: { select: { role: true, price: true } } }
    });
    prods.forEach(prod => {
      console.log(prod.name, '| base:', prod.price, '| rolePrices:', JSON.stringify(prod.rolePrices));
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
