import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ArrowLeft, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import { toast } from 'react-toastify';
import BulkOrderDetailsModal from '../components/BulkOrderDetailsModal';

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

const calculateTotalGB = (items) => {
  if (!items || items.length === 0) return 0;
  return items.reduce((total, item) => {
    const desc = (item.productDescription || item.productName || '').toLowerCase();
    const gbMatch = desc.match(/(\d+(?:\.\d+)?)\s*gb/i);
    return total + (gbMatch ? parseFloat(gbMatch[1]) : 0);
  }, 0);
};

const BulkOrdersPage = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/order/user/bulk-orders`, { headers: getAuthHeaders() });
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (error) {
      toast.error('Failed to load bulk orders');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderClick = async (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const statusClass = (status) => statusStyles[status] || 'bg-dark-700 text-dark-200 border border-dark-500';

  return (
    <div className="w-full h-full bg-dark-900">
      {/* Header */}
      <div className="border-b border-dark-700 px-6 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-dark-400">Dashboard</p>
          <h1 className="text-2xl font-semibold text-white">Bulk Orders</h1>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-white border border-dark-600 disabled:opacity-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto" style={{ height: 'calc(100% - 73px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-dark-400 mb-4" />
            <p className="text-lg font-medium text-dark-200 mb-2">No Bulk Orders Yet</p>
            <p className="text-dark-400">Paste or upload multiple orders to see them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => {
              const totalGB = calculateTotalGB(order.items);
              return (
                <button
                  key={order.id}
                  onClick={() => handleOrderClick(order)}
                  className="text-left bg-dark-800 border border-dark-700 rounded-xl p-5 hover:border-dark-500 transition-all hover:shadow-lg hover:shadow-dark-900/50 group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-dark-400 mb-1">Order Number</p>
                      <p className="text-sm font-semibold text-white">{order.orderNumber}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${statusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-dark-400 mb-4">{formatDate(order.createdAt)}</p>

                  {/* Stats */}
                  <div className="space-y-3 mb-4 pb-4 border-b border-dark-700">
                    <div className="flex items-center justify-between">
                      <span className="text-dark-400 text-sm">Total GB</span>
                      <span className="text-white font-medium">{totalGB.toFixed(1)} GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-dark-400 text-sm">Amount</span>
                      <span className="text-cyan-400 font-medium">{formatCurrency(order.totalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-dark-400 text-sm">Items</span>
                      <span className="text-white font-medium">{order.totalItems}</span>
                    </div>
                  </div>

                  {/* Network Badge and Click Indicator */}
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600 text-xs text-white font-medium">
                      {order.network}
                    </span>
                    <span className="text-xs text-dark-400 group-hover:text-cyan-400 transition-colors">
                      View Details →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <BulkOrderDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </div>
  );
};

export default BulkOrdersPage;
