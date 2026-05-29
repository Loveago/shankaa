import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { X, Loader2, RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';
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

const BulkOrdersModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/order/user/bulk-orders`, { headers: getAuthHeaders() });
      if (res.data.success) setOrders(res.data.orders || []);
    } catch (error) {
      toast.error('Failed to load bulk orders');
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const loadDetail = async (orderId) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/order/user/bulk-orders/${orderId}`, { headers: getAuthHeaders() });
      if (res.data.success) setSelectedOrder(res.data.order);
    } catch (error) {
      toast.error('Failed to load order details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReport = async (orderId, itemId) => {
    try {
      await axios.post(`${BASE_URL}/order/user/bulk-orders/${orderId}/items/${itemId}/report`, {}, { headers: getAuthHeaders() });
      toast.success('Report submitted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit report');
    }
  };

  const statusClass = useCallback((status) => statusStyles[status] || 'bg-dark-700 text-dark-200 border border-dark-500', []);

  const headline = useMemo(() => selectedOrder ? `Bulk Order ${selectedOrder.orderNumber}` : 'Bulk Orders', [selectedOrder]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-dark-400">Bulk Order Tracking</p>
            <h2 className="text-lg font-semibold text-white">{headline}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-white border border-dark-600"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-white border border-dark-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 border-r border-dark-700 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-white"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : orders.length === 0 ? (
              <div className="p-6 text-dark-300">No bulk orders yet. Paste or upload multiple orders to see them here.</div>
            ) : (
              <div className="divide-y divide-dark-700">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => loadDetail(order.id)}
                    className={`w-full text-left px-5 py-4 transition-colors ${selectedOrder?.id === order.id ? 'bg-dark-800' : 'hover:bg-dark-800/60'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-dark-300">{formatDate(order.createdAt)}</span>
                        <span className="text-xs text-dark-400">{order.orderNumber}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusClass(order.status)}`}>{order.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white">
                      <span className="px-2 py-1 rounded-lg bg-dark-700 border border-dark-600 text-xs">{order.network}</span>
                      <span>{order.totalItems} items</span>
                      <span className="text-dark-300">•</span>
                      <span>{formatCurrency(order.totalPrice)}</span>
                      <ChevronRight className="w-4 h-4 text-dark-400 ml-auto" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 max-h-[70vh] overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12 text-white"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : !selectedOrder ? (
              <div className="p-8 text-dark-300">Select a bulk order to view its numbers and statuses.</div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-dark-400">Placed</p>
                    <p className="text-sm text-white">{formatDate(selectedOrder.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full ${statusClass(selectedOrder.status)}`}>{selectedOrder.status}</span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-dark-700 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-800">
                      <tr className="text-dark-300">
                        <th className="px-4 py-2 text-left">Phone</th>
                        <th className="px-4 py-2 text-left">Bundle</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Network</th>
                        <th className="px-4 py-2 text-left">Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id} className="border-t border-dark-700 hover:bg-dark-800/60">
                          <td className="px-4 py-3 text-white whitespace-nowrap">{item.mobileNumber || '—'}</td>
                          <td className="px-4 py-3 text-white whitespace-nowrap">{item.productDescription || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full ${statusClass(item.status)}`}>{item.status || 'Pending'}</span>
                          </td>
                          <td className="px-4 py-3 text-dark-200 whitespace-nowrap">{item.network}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleReport(selectedOrder.id, item.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 text-xs"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Not received
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
    </div>
  );
};

export default BulkOrdersModal;
