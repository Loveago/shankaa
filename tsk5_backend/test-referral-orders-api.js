const axios = require('axios');

const BASE_URL = 'https://shankaa.onrender.com';

async function testReferralOrders() {
  try {
    console.log('=== Checking Referral Orders via API ===\n');

    // Get admin token (you'll need to provide this)
    // For now, just check if the endpoint exists
    console.log('Fetching referral orders from admin API...');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/storefront/admin/referrals`, {
        headers: {
          'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE'
        }
      });

      console.log('✓ Referral orders found:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠ Need admin token to access referral orders');
        console.log('Endpoint exists: /api/storefront/admin/referrals');
        console.log('\nTo check referral orders:');
        console.log('1. Login as admin');
        console.log('2. Get the JWT token from localStorage');
        console.log('3. Use it to call /api/storefront/admin/referrals');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testReferralOrders();
