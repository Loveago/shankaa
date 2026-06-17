require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function exportOrdersToExcel() {
  console.log('📊 Starting order export...');
  
  try {
    // Fetch all orders with items and product name only
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${orders.length} orders`);

    // Transform data for Excel - only mobile number and data size
    const excelData = [];
    
    orders.forEach(order => {
      order.items.forEach(item => {
        excelData.push({
          'Mobile Number': item.mobileNumber || order.mobileNumber || 'N/A',
          'Data Size': item.productName || item.product?.name || 'N/A'
        });
      });
    });

    console.log(`📝 Prepared ${excelData.length} rows for export`);

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `orders-export-${timestamp}.xlsx`;
    const filepath = path.join(__dirname, filename);

    // Write file
    XLSX.writeFile(workbook, filepath);
    
    console.log(`✅ Export complete! File saved to: ${filepath}`);
    console.log(`📦 File size: ${(require('fs').statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);
    
    return filepath;
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the export
if (require.main === module) {
  exportOrdersToExcel()
    .then(() => {
      console.log('🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = exportOrdersToExcel;
