const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking referral orders...\n');
    
    const referralOrders = await prisma.referralOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        agent: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true } }
      }
    });

    console.log(`Found ${referralOrders.length} referral orders:\n`);
    
    if (referralOrders.length === 0) {
      console.log('No referral orders in database.');
    } else {
      referralOrders.forEach((order, idx) => {
        console.log(`${idx + 1}. ID: ${order.id}`);
        console.log(`   Payment Ref: ${order.paymentRef}`);
        console.log(`   Agent: ${order.agent?.name} (ID: ${order.agent?.id})`);
        console.log(`   Product: ${order.product?.name}`);
        console.log(`   Customer: ${order.customerName} (${order.customerPhone})`);
        console.log(`   Amount: GHS ${order.agentPrice}`);
        console.log(`   Payment Status: ${order.paymentStatus}`);
        console.log(`   Order Status: ${order.orderStatus}`);
        console.log(`   Order ID: ${order.orderId || 'None'}`);
        console.log(`   Created: ${new Date(order.createdAt).toLocaleString()}`);
        console.log('');
      });
    }

    // Get stats
    const stats = await prisma.referralOrder.groupBy({
      by: ['paymentStatus'],
      _count: true
    });

    console.log('Referral Orders Summary:');
    stats.forEach(stat => {
      console.log(`  ${stat.paymentStatus}: ${stat._count}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
