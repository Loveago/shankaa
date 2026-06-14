const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Querying unpaid orders...\n');
    
    const unpaidOrders = await prisma.unpaidOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        paymentTransaction: {
          select: {
            id: true,
            status: true,
            orderId: true
          }
        }
      }
    });

    console.log(`Found ${unpaidOrders.length} unpaid orders:\n`);
    
    if (unpaidOrders.length === 0) {
      console.log('No unpaid orders in database.');
    } else {
      unpaidOrders.forEach((order, idx) => {
        console.log(`${idx + 1}. ID: ${order.id}`);
        console.log(`   External Ref: ${order.externalRef}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Payment Status: ${order.paymentStatus}`);
        console.log(`   Product ID: ${order.productId}`);
        console.log(`   Mobile: ${order.mobileNumber}`);
        console.log(`   Amount: GHS ${order.amount}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log(`   Expires: ${order.expiresAt}`);
        if (order.paymentTransaction) {
          console.log(`   Transaction Status: ${order.paymentTransaction.status}`);
          console.log(`   Order ID: ${order.paymentTransaction.orderId || 'None'}`);
        }
        console.log('');
      });
    }

    // Also get stats
    const stats = await prisma.unpaidOrder.groupBy({
      by: ['status', 'paymentStatus'],
      _count: true
    });

    console.log('\nUnpaid Orders Summary:');
    stats.forEach(stat => {
      console.log(`  ${stat.status}/${stat.paymentStatus}: ${stat._count}`);
    });

  } catch (error) {
    console.error('Error querying database:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
