import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { CreditCard, CheckCircle, Clock, X, RefreshCw, DollarSign, User, Phone, Package } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';

const VerifyPayment = ({ isOpen, onClose }) => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) setUserId(parseInt(storedUserId));
  }, []);

  const fetchPendingPayments = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${BASE_URL}/api/storefront/admin/referrals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter only pending referral orders for this user
      const pending = res.data?.orders?.filter(order =>
        order.userId === userId && order.paymentStatus === 'Pending'
      ) || [];
      
      setPendingPayments(pending);
    } catch (err) {
      console.error('Error fetching pending payments:', err);
      setPendingPayments([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) fetchPendingPayments();
  }, [isOpen, fetchPendingPayments]);

  const handleVerifyPayment = async (referralOrder) => {
    const result = await Swal.fire({
      title: 'Verify Payment?',
      text: `This will verify payment reference ${referralOrder.paymentRef} for GHS ${referralOrder.commission.toFixed(2)} commission. Continue?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Verify',
      cancelButtonText: 'Cancel',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${BASE_URL}/api/storefront/verify`, 
          { reference: referralOrder.paymentRef },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        Swal.fire({
          icon: 'success',
          title: 'Payment Verified!',
          text: res.data.message || 'Payment verified successfully',
          timer: 2000,
          showConfirmButton: false,
          background: '#1e293b',
          color: '#f1f5f9'
        });

        fetchPendingPayments();
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Verification Failed',
          text: err.response?.data?.message || 'Failed to verify payment',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Verify Payments</h2>
              <p className="text-emerald-100 text-sm">Paystack payments awaiting verification</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchPendingPayments} 
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-dark-700 bg-dark-900/50">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-dark-400 text-xs">Total Pending</p>
              <p className="text-2xl font-bold text-white">{pendingPayments.length}</p>
            </div>
            <div className="flex-1">
              <p className="text-dark-400 text-xs">Total Amount</p>
              <p className="text-2xl font-bold text-emerald-400">
                GHS {(pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="w-16 h-16 text-emerald-500/30 mb-4" />
              <p className="text-dark-400 text-lg">No pending payments</p>
              <p className="text-dark-500 text-sm">All payments have been verified</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPayments.map((payment) => (
                <div key={payment.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-amber-500/20 text-amber-400 border-amber-500/30">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                        <span className="text-xs text-dark-500">
                          Ref: {payment.paymentRef.slice(0, 8)}...
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-dark-300">
                          <User className="w-4 h-4 text-dark-500" />
                          <span>{payment.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-dark-300">
                          <Phone className="w-4 h-4 text-dark-500" />
                          <span>{payment.customerPhone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-dark-300">
                          <Package className="w-4 h-4 text-dark-500" />
                          <span>{payment.productName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-semibold">GHS {parseFloat(payment.amount || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-dark-500">
                        Created: {new Date(payment.createdAt).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => handleVerifyPayment(payment)}
                      disabled={loading}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium text-sm whitespace-nowrap disabled:opacity-50"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyPayment;
