const axios = require('axios');

const BASE_URL = 'https://shankaa.onrender.com';

async function testStorefrontPurchase() {
  try {
    console.log('=== Testing Storefront Purchase Flow ===\n');

    // Step 1: Get available products
    console.log('Step 1: Fetching available shop products...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

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

    console.log(`✓ Found product: ${product.name} (ID: ${product.id}, Price: GHS ${product.price})\n`);

    // Step 2: Initialize payment (this should create unpaid order)
    console.log('Step 2: Initializing payment...');
    const mobileNumber = '0501234567';
    const email = `${mobileNumber}@shankaa.com`;
    
    const initRes = await axios.post(`${BASE_URL}/api/payment/initialize`, {
      email,
      mobileNumber,
      amount: product.price,
      productId: product.id,
      productName: product.name
    });

    if (!initRes.data.success) {
      console.error('❌ Payment initialization failed:', initRes.data.message);
      return;
    }

    const externalRef = initRes.data.externalRef;
    const paymentUrl = initRes.data.paymentUrl;
    
    console.log(`✓ Payment initialized`);
    console.log(`  External Ref: ${externalRef}`);
    console.log(`  Payment URL: ${paymentUrl}\n`);

    // Step 3: Query unpaid orders to verify it was created
    console.log('Step 3: Checking if unpaid order was created...');

    const unpaidOrder = await prisma.unpaidOrder.findUnique({
      where: { externalRef },
      include: { paymentTransaction: true }
    });

    if (!unpaidOrder) {
      console.error('❌ Unpaid order NOT created in database');
      await prisma.$disconnect();
      return;
    }

    console.log(`✓ Unpaid order created:`);
    console.log(`  ID: ${unpaidOrder.id}`);
    console.log(`  Status: ${unpaidOrder.status}`);
    console.log(`  Payment Status: ${unpaidOrder.paymentStatus}`);
    console.log(`  Mobile: ${unpaidOrder.mobileNumber}`);
    console.log(`  Amount: GHS ${unpaidOrder.amount}`);
    console.log(`  Product: ${unpaidOrder.productName}`);
    console.log(`  Transaction Status: ${unpaidOrder.paymentTransaction?.status}\n`);

    // Step 4: Simulate payment verification (mark as PAID in Paystack)
    console.log('Step 4: Simulating payment verification...');
    console.log(`  (In real scenario, user would complete payment on Paystack)\n`);

    // Step 5: Wait for auto-reconciliation to run
    console.log('Step 5: Waiting for auto-reconciliation...');
    console.log('  (Auto-reconciliation runs every 60 seconds)');
    console.log('  Waiting 20 seconds for next reconciliation cycle...\n');
    
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Step 6: Check if order was created
    console.log('Step 6: Checking if order was created by auto-reconciliation...');
    
    const updatedUnpaidOrder = await prisma.unpaidOrder.findUnique({
      where: { externalRef },
      include: { paymentTransaction: true }
    });

    if (updatedUnpaidOrder?.paymentTransaction?.orderId) {
      console.log(`✓ Order created successfully!`);
      console.log(`  Order ID: ${updatedUnpaidOrder.paymentTransaction.orderId}`);
      console.log(`  Unpaid Order Status: ${updatedUnpaidOrder.status}`);
      console.log(`  Payment Status: ${updatedUnpaidOrder.paymentStatus}\n`);
    } else {
      console.log(`⚠ Order NOT created yet`);
      console.log(`  Unpaid Order Status: ${updatedUnpaidOrder?.status}`);
      console.log(`  Payment Status: ${updatedUnpaidOrder?.paymentStatus}`);
      console.log(`  Transaction Status: ${updatedUnpaidOrder?.paymentTransaction?.status}\n`);
    }

    // Step 7: Show all unpaid orders
    console.log('Step 7: All unpaid orders in database:');
    const allUnpaidOrders = await prisma.unpaidOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { paymentTransaction: true }
    });

    allUnpaidOrders.forEach((order, idx) => {
      console.log(`\n  ${idx + 1}. Ref: ${order.externalRef}`);
      console.log(`     Status: ${order.status}/${order.paymentStatus}`);
      console.log(`     Mobile: ${order.mobileNumber}`);
      console.log(`     Amount: GHS ${order.amount}`);
      console.log(`     Created: ${new Date(order.createdAt).toLocaleString()}`);
      if (order.paymentTransaction?.orderId) {
        console.log(`     ✓ Order ID: ${order.paymentTransaction.orderId}`);
      }
    });

    console.log('\n=== Test Complete ===\n');
    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testStorefrontPurchase();
