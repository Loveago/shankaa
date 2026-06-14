const axios = require('axios');

// Live Render backend URL
const BASE_URL = 'https://shankaa.onrender.com';

async function testPaymentInit() {
  try {
    console.log('Testing payment initialization...\n');
    console.log('Backend URL:', BASE_URL);
    
    const response = await axios.post(`${BASE_URL}/api/payment/initialize`, {
      email: 'test@example.com',
      mobileNumber: '0501234567',
      amount: 10,
      productId: 1,
      productName: 'Test Product'
    });

    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testPaymentInit();
