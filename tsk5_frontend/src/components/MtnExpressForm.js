import React, { useState } from 'react';
import { ArrowLeft, Package, Loader2, Phone, Receipt, CheckCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const MtnExpressForm = ({ onBack }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    if (!phoneNumber.trim() || phoneNumber.trim().length < 5) {
      Swal.fire({ icon: 'warning', title: 'Invalid Phone', text: 'Please enter a valid phone number', background: '#1e293b', color: '#f1f5f9' });
      return false;
    }
    if (!receiptNumber.trim()) {
      Swal.fire({ icon: 'warning', title: 'Receipt Required', text: 'Please enter your payment receipt number', background: '#1e293b', color: '#f1f5f9' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await axios.post(`${BASE_URL}/api/mtn-express`, {
        receiptNumber: receiptNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        bundleSize: '214GB',
        amount: 300
      }, { headers: getAuthHeaders() });

      Swal.fire({
        icon: 'success',
        title: 'Order Submitted!',
        text: 'Your MTN Express 214GB order has been received. Admin will process it shortly.',
        timer: 2500,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f1f5f9'
      });
      setSubmitted(true);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: err.response?.data?.message || 'Failed to submit order',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-dark-900/50 border border-emerald-500/30 rounded-2xl p-8 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Order Submitted!</h3>
        <p className="text-dark-300 mb-6">Your MTN Express 214GB order is being processed.</p>
        <button onClick={onBack}
          className="px-6 py-2.5 bg-dark-700 text-dark-300 rounded-xl hover:bg-dark-600 font-medium transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-gradient-to-r from-yellow-500/20 to-cyan-500/20 rounded-2xl p-6 border border-yellow-500/30 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-cyan-500/20 rounded-xl">
            <Package className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">MTN Express Bundle</h2>
            <p className="text-yellow-400 text-sm font-semibold">214GB @ GHS 300</p>
          </div>
        </div>
        <p className="text-dark-300 text-sm">
          Pay GHS 300 via Mobile Money to the admin number and submit your receipt number below to place your order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5 flex items-center gap-2">
            <Phone className="w-4 h-4 text-cyan-400" /> Phone Number
          </label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="024xxxxxxx"
            className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-yellow-400" /> Receipt Number
          </label>
          <input
            type="text"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            placeholder="Enter your MoMo receipt number"
            className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-yellow-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
          {submitting ? 'Submitting...' : 'Place Order - GHS 300'}
        </button>
      </form>
    </div>
  );
};

export default MtnExpressForm;
