import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import { toast } from 'react-toastify';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const statusStyles = {
  Pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  Processing: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  Completed: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  Cancelled: 'bg-red-500/10 text-red-300 border border-red-500/30',
};

const formatCurrency = (v) => `GHS ${(Number(v) || 0).toFixed(2)}`;
const formatDate = (d) => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const BulkOrderDetailsModal = ({ isOpen, onClose, order }) => {
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullOrder, setFullOrder] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!order?.id) return;
    setDetailLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/order/user/bulk-orders/${order.id}`, { headers: getAuthHeaders() });
      if (res.data.success) {
        setFullOrder(res.data.order);
      }
    } catch (error) {
      toast.error('Failed to load order details');
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  }, [order?.id]);

  useEffect(() => {
    if (isOpen && order?.id) {
      loadDetail();
    }
  }, [isOpen, order?.id, loadDetail]);

  const handleReport = async (orderId, itemId) => {
    try {
      await axios.post(`${BASE_URL}/order/user/bulk-orders/${orderId}/items/${itemId}/report`, {}, { headers: getAuthHeaders() });
      toast.success('Report submitted');
      // Reload the order details
      loadDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit report');
    }
  };

  const statusClass = (status) => statusStyles[status] || 'bg-dark-700 text-dark-200 border border-dark-500';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-800">
          <div>
            <p className="text-xs uppercase tracking-wide text-dark-400">Individual Orders in Bulk Purchase</p>
            <h2 className="text-lg font-semibold text-white mt-1">{fullOrder?.orderNumber || order?.orderNumber}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-white border border-dark-600 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto p-6">
          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : !fullOrder || !fullOrder.items || fullOrder.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-dark-300">No items found in this bulk order.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Order Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-dark-700">
                <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                  <p className="text-xs text-dark-400 mb-1">Placed On</p>
                  <p className="text-sm font-medium text-white">{formatDate(fullOrder.createdAt)}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                  <p className="text-xs text-dark-400 mb-1">Status</p>
                  <span className={`inline-block text-xs px-2.5 py-1 rounded-full ${statusClass(fullOrder.status)}`}>
                    {fullOrder.status}
                  </span>
                </div>
                <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                  <p className="text-xs text-dark-400 mb-1">Total Items</p>
                  <p className="text-sm font-medium text-white">{fullOrder.items.length}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-dark-700 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-dark-800 sticky top-0">
                    <tr className="text-dark-300 border-b border-dark-700">
                      <th className="px-4 py-3 text-left font-semibold">Order #</th>
                      <th className="px-4 py-3 text-left font-semibold">Phone Number</th>
                      <th className="px-4 py-3 text-left font-semibold">Bundle</th>
                      <th className="px-4 py-3 text-left font-semibold">Price</th>
                      <th className="px-4 py-3 text-left font-semibold">Network</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {fullOrder.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-dark-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-lg border border-cyan-400/20">
                            {item.itemNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white whitespace-nowrap">{item.mobileNumber || '—'}</td>
                        <td className="px-4 py-3 text-white">
                          <span className="font-medium">{item.productDescription || item.productName || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{formatCurrency(item.productPrice)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg bg-dark-700 border border-dark-600 text-xs text-dark-200">
                            {item.network}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full inline-block ${statusClass(item.status)}`}>
                            {item.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleReport(fullOrder.id, item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 text-xs font-medium transition-colors"
                            title="Report issue with this order"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkOrderDetailsModal;
