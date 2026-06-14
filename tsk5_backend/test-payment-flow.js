const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPaymentFlow() {
  try {
    console.log('=== Testing Complete Payment Flow ===\n');

    // Get available product
    const product = await prisma.product.findFirst({
      where: {
        showInShop: true,
        shopStockClosed: false,
        stock: { gt: 0 }
      }
    });
    
    if (!product) {
      console.error('❌ No products available in shop');
      await prisma.$disconnect();
      return;
    }

    console.log(`Product: ${product.name} (ID: ${product.id}, Price: GHS ${product.price})\n`);

    // Show current unpaid orders
    console.log('Current unpaid orders:');
    const unpaidOrders = await prisma.unpaidOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { paymentTransaction: true }
    });

    if (unpaidOrders.length === 0) {
      console.log('  (None)\n');
    } else {
      unpaidOrders.forEach((order, idx) => {
        console.log(`  ${idx + 1}. Ref: ${order.externalRef}`);
        console.log(`     Status: ${order.status}/${order.paymentStatus}`);
        console.log(`     Mobile: ${order.mobileNumber}`);
        console.log(`     Amount: GHS ${order.amount}`);
        if (order.paymentTransaction?.orderId) {
          console.log(`     ✓ Order ID: ${order.paymentTransaction.orderId}`);
        }
      });
    }

    console.log('\n=== Analysis ===\n');

    // Count by status
    const stats = await prisma.unpaidOrder.groupBy({
      by: ['status', 'paymentStatus'],
      _count: true
    });

    console.log('Unpaid Orders Summary:');
    stats.forEach(stat => {
      console.log(`  ${stat.status}/${stat.paymentStatus}: ${stat._count}`);
    });

    // Check for PAID orders without order IDs
    const paidWithoutOrder = await prisma.unpaidOrder.findMany({
      where: {
        status: 'PAID',
        paymentStatus: 'PAID',
        paymentTransaction: {
          orderId: null
        }
      }
    });

    if (paidWithoutOrder.length > 0) {
      console.log(`\n⚠ Found ${paidWithoutOrder.length} PAID unpaid orders without real orders:`);
      paidWithoutOrder.forEach(order => {
        console.log(`  - ${order.externalRef} (GHS ${order.amount})`);
      });
      console.log('\nThese should have been processed by auto-reconciliation.');
      console.log('Check Render logs for reconciliation errors.');
    }

    // Check for recent PENDING orders
    const recentPending = await prisma.unpaidOrder.findMany({
      where: {
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      }
    });

    if (recentPending.length > 0) {
      console.log(`\n✓ Found ${recentPending.length} recent PENDING unpaid orders:`);
      recentPending.forEach(order => {
        console.log(`  - ${order.externalRef} (${new Date(order.createdAt).toLocaleTimeString()})`);
      });
      console.log('\nThese are waiting for payment confirmation or auto-reconciliation.');
    }

    console.log('\n=== Recommendations ===\n');
    console.log('1. Check Render backend logs for auto-reconciliation errors');
    console.log('2. Verify Paystack API key is correct in environment variables');
    console.log('3. Check if auto-reconciliation is actually running (look for "[Auto-Reconciliation]" logs)');
    console.log('4. Manually test payment verification with a real Paystack reference');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testPaymentFlow();
