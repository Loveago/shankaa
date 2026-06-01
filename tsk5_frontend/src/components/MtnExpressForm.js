import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Package, Loader2, Phone, CheckCircle, ExternalLink, CreditCard, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const MtnExpressForm = ({ onBack }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [config, setConfig] = useState({ bundleSize: '214GB', amount: 300, enabled: true });
  const [configLoading, setConfigLoading] = useState(true);
  const [paymentStep, setPaymentStep] = useState('form'); // form, redirecting, verifying, success, failed
  const [paymentRef, setPaymentRef] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const popupRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const [pollsRemaining, setPollsRemaining] = useState(40); // ~2 minutes
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/mtn-express/available`);
        if (res.data.success) setConfig({ ...res.data.data, enabled: res.data.data.enabled });
      } catch (err) {
        console.error('Failed to fetch config, using defaults:', err);
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const verifyPayment = useCallback(async (ref) => {
    setVerifying(true);
    setPaymentMessage('Verifying payment...');
    try {
      const res = await axios.post(`${BASE_URL}/api/mtn-express/verify-payment`, { reference: ref }, { headers: getAuthHeaders() });
      if (res.data.success) {
        stopPolling();
        setPaymentStep('success');
        setPaymentMessage(`Payment successful! Order #${res.data.order?.id || ''} is awaiting admin approval.`);
        setSubmitted(true);
        Swal.fire({
          icon: 'success',
          title: 'Payment Confirmed!',
          text: 'Your MTN Express order has been placed and is awaiting admin approval.',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
      } else {
        setPaymentMessage(res.data.message || 'Payment not yet confirmed. Please try again.');
      }
    } catch (err) {
      setPaymentMessage(err.response?.data?.message || 'Not confirmed yet, retrying...');
    } finally {
      setVerifying(false);
    }
  }, [stopPolling]);

  const startPolling = useCallback((ref) => {
    let count = 40;
    setPollsRemaining(count);
    pollIntervalRef.current = setInterval(() => {
      count -= 1;
      setPollsRemaining(count);
      if (count <= 0) {
        stopPolling();
        setPaymentStep('failed');
        setPaymentMessage('Payment verification timed out. Click "Check Payment Status" to retry.');
        return;
      }
      verifyPayment(ref);
    }, 3000);
  }, [verifyPayment, stopPolling]);

  const handleOpenPaystack = () => {
    if (!paymentUrl) return;
    // Open Paystack in a new tab
    popupRef.current = window.open(paymentUrl, '_blank');
    setPaymentStep('verifying');
    setPaymentMessage('Waiting for payment to complete...');
    // Start polling for verification
    startPolling(paymentRef);
  };

  const handleManualVerify = () => {
    if (!paymentRef) return;
    verifyPayment(paymentRef);
  };

  const validate = () => {
    if (!phoneNumber.trim() || phoneNumber.trim().length < 5) {
      Swal.fire({ icon: 'warning', title: 'Invalid Phone', text: 'Please enter a valid phone number', background: '#1e293b', color: '#f1f5f9' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!config.enabled) {
      Swal.fire({ icon: 'error', title: 'Unavailable', text: 'MTN Express is currently disabled by admin', background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    setSubmitting(true);
    setPaymentStep('redirecting');
    setPaymentMessage('Initializing payment...');
    try {
      const res = await axios.post(`${BASE_URL}/api/mtn-express/initialize-payment`, {
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined
      }, { headers: getAuthHeaders() });

      if (res.data.success) {
        setPaymentRef(res.data.paymentRef);
        setPaymentUrl(res.data.paymentUrl);
        setPaymentMessage('Payment initialized! Click the button to pay via Paystack.');
      } else {
        setPaymentStep('failed');
        setPaymentMessage(res.data.message || 'Failed to initialize payment');
        Swal.fire({ icon: 'error', title: 'Payment Failed', text: res.data.message || 'Failed to initialize payment', background: '#1e293b', color: '#f1f5f9' });
      }
    } catch (err) {
      setPaymentStep('failed');
      setPaymentMessage(err.response?.data?.message || 'Failed to initialize payment');
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Failed to initialize payment', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setSubmitting(false);
    }
  };

  // Success view after payment
  if (submitted) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-dark-900/50 border border-emerald-500/30 rounded-2xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Order Submitted!</h3>
          <p className="text-dark-300 mb-2">Your MTN Express {config.bundleSize} order has been placed.</p>
          <p className="text-dark-400 text-sm mb-6">Awaiting admin approval. You can track the status from the admin.</p>
          <button onClick={onBack}
            className="px-6 py-2.5 bg-dark-700 text-dark-300 rounded-xl hover:bg-dark-600 font-medium transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Paystack redirect/verification view
  if (paymentStep === 'redirecting' || paymentStep === 'verifying') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-dark-900/50 border border-cyan-500/30 rounded-2xl p-8 text-center">
          {paymentStep === 'redirecting' ? (
            <ExternalLink className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
          ) : (
            <Loader2 className="w-16 h-16 text-yellow-400 animate-spin mx-auto mb-4" />
          )}
          <h3 className="text-xl font-bold text-white mb-2">
            {paymentStep === 'redirecting' ? 'Complete Payment' : 'Verifying Payment'}
          </h3>
          <p className="text-dark-300 mb-4">{paymentMessage}</p>

          {paymentStep === 'redirecting' && paymentUrl && (
            <button
              onClick={handleOpenPaystack}
              className="w-full bg-gradient-to-r from-yellow-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mb-3"
            >
              <CreditCard className="w-5 h-5" />
              Pay GHS {config.amount} with Paystack
            </button>
          )}

          {paymentStep === 'verifying' && (
            <>
              <p className="text-dark-400 text-sm mb-4">Auto-verifying payment... ({pollsRemaining}s remaining)</p>
              <button
                onClick={handleManualVerify}
                disabled={verifying}
                className="w-full bg-dark-700 text-white font-medium py-2.5 px-6 rounded-xl hover:bg-dark-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {verifying ? 'Checking...' : 'Check Payment Status'}
              </button>
            </>
          )}

          <button
            onClick={() => {
              stopPolling();
              setPaymentStep('form');
              setPaymentMessage('');
            }}
            className="mt-4 text-dark-400 hover:text-white text-sm transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Failed view
  if (paymentStep === 'failed') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-dark-900/50 border border-red-500/30 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Payment Failed</h3>
          <p className="text-dark-300 mb-6">{paymentMessage}</p>
          {paymentRef && (
            <button
              onClick={handleManualVerify}
              disabled={verifying}
              className="w-full bg-gradient-to-r from-yellow-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
            >
              {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {verifying ? 'Checking...' : 'Retry Verification'}
            </button>
          )}
          <button
            onClick={() => {
              setPaymentStep('form');
              setPaymentMessage('');
              setPaymentRef(null);
              setPaymentUrl(null);
            }}
            className="w-full bg-dark-700 text-dark-300 rounded-xl py-2.5 hover:bg-dark-600 font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check if disabled
  if (!configLoading && !config.enabled) {
    return (
      <div className="max-w-md mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-dark-900/50 border border-amber-500/30 rounded-2xl p-8 text-center">
          <Package className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Currently Unavailable</h3>
          <p className="text-dark-400">MTN Express is currently disabled by admin. Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {configLoading ? (
        <div className="flex items-center justify-center py-8 mb-6">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
        </div>
      ) : (
      <div className="bg-gradient-to-r from-yellow-500/20 to-cyan-500/20 rounded-2xl p-6 border border-yellow-500/30 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-cyan-500/20 rounded-xl">
            <Package className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">MTN Express Bundle</h2>
            <p className="text-yellow-400 text-sm font-semibold">{config.bundleSize} @ GHS {config.amount}</p>
          </div>
        </div>
        <p className="text-dark-300 text-sm">
          Pay GHS {config.amount} securely via Paystack (Mobile Money or Card). Your order will be processed after payment confirmation.
        </p>
      </div>
      )}

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
            <CreditCard className="w-4 h-4 text-yellow-400" /> Email (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com (for payment receipt)"
            className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || configLoading}
          className="w-full bg-gradient-to-r from-yellow-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
          {submitting ? 'Initializing...' : `Pay GHS ${config.amount} via Paystack`}
        </button>
      </form>
    </div>
  );
};

export default MtnExpressForm;
