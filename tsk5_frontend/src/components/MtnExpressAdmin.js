import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, RefreshCw, Search, CheckCircle, XCircle, Eye, Trash2, Clock, Phone, Receipt, Package, Hash, FileText } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import Swal from 'sweetalert2';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const statusStyles = {
  pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  rejected: 'bg-red-500/10 text-red-300 border border-red-500/30'
};

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle
};

const formatDate = (d) => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const MtnExpressAdmin = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const res = await axios.get(`${BASE_URL}/api/mtn-express`, {
        headers: getAuthHeaders(),
        params
      });
      if (res.data.success) {
        setOrders(res.data.data || []);
      }
    } catch (err) {
      console.error('Fetch MTN Express orders error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleUpdateStatus = async (id, newStatus) => {
    const result = await Swal.fire({
      title: newStatus === 'approved' ? 'Approve Order?' : 'Reject Order?',
      text: newStatus === 'approved'
        ? 'Mark this order as processed/approved?'
        : 'Reject this MTN Express order?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: newStatus === 'approved' ? '#10b981' : '#ef4444',
      confirmButtonText: newStatus === 'approved' ? 'Yes, Approve' : 'Yes, Reject',
      cancelButtonText: 'Cancel',
      background: '#1e293b',
      color: '#f1f5f9',
      input: 'textarea',
      inputPlaceholder: 'Admin notes (optional)',
      inputAttributes: { rows: '2' }
    });

    if (result.isConfirmed) {
      try {
        await axios.put(`${BASE_URL}/api/mtn-express/${id}`, {
          status: newStatus,
          adminNotes: result.value || ''
        }, { headers: getAuthHeaders() });

        Swal.fire({
          icon: 'success',
          title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
          timer: 1500,
          showConfirmButton: false,
          background: '#1e293b',
          color: '#f1f5f9'
        });
        fetchOrders();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Update Failed', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Order?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      background: '#1e293b',
      color: '#f1f5f9'
    });
    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/mtn-express/${id}`, { headers: getAuthHeaders() });
        Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
        fetchOrders();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const filteredOrders = orders.filter(o =>
    searchTerm === '' ||
    o.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.phoneNumber?.includes(searchTerm) ||
    o.id?.toString().includes(searchTerm)
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-yellow-400" /> MTN Express Orders
          </h3>
          <p className="text-dark-400 text-sm">214GB @ GHS 300 - Manage customer orders</p>
        </div>
        <button onClick={fetchOrders} className="p-2 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors">
          <RefreshCw className={`w-4 h-4 text-dark-300 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'pending', 'approved', 'rejected'].map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
            }`}
          >
            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by receipt, phone, or ID..."
          className="w-full bg-dark-900/50 border border-dark-600 rounded-xl pl-10 pr-4 py-2 text-white text-sm placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400">No MTN Express orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const StatusIcon = statusIcons[order.status] || Clock;
            return (
              <div key={order.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-yellow-500/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs text-dark-500 font-mono">#{order.id}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[order.status] || ''}`}>
                        <StatusIcon className="w-3 h-3" /> {order.status}
                      </span>
                      <span className="text-xs text-dark-500">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                      <span className="flex items-center gap-2 text-dark-300">
                        <Receipt className="w-3.5 h-3.5 text-yellow-400" />
                        Receipt: <span className="text-white font-medium truncate">{order.receiptNumber}</span>
                      </span>
                      <span className="flex items-center gap-2 text-dark-300">
                        <Phone className="w-3.5 h-3.5 text-cyan-400" />
                        Phone: <span className="text-white">{order.phoneNumber}</span>
                      </span>
                      <span className="flex items-center gap-2 text-dark-300">
                        <Package className="w-3.5 h-3.5 text-emerald-400" />
                        Bundle: <span className="text-white font-medium">{order.bundleSize}</span>
                      </span>
                      <span className="flex items-center gap-2 text-dark-300">
                        <Hash className="w-3.5 h-3.5 text-purple-400" />
                        Amount: <span className="text-white font-medium">GHS {order.amount}</span>
                      </span>
                    </div>
                    {order.adminNotes && (
                      <p className="mt-2 text-xs text-dark-400 bg-dark-800 rounded-lg p-2">
                        <span className="text-cyan-400 font-medium">Notes:</span> {order.adminNotes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setSelectedOrder(order); setShowDetail(true); }}
                      className="p-2 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {order.status === 'pending' && (
                      <>
                        <button onClick={() => handleUpdateStatus(order.id, 'approved')}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30" title="Approve">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleUpdateStatus(order.id, 'rejected')}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30" title="Reject">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(order.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-yellow-400" /> Order #{selectedOrder.id}
              </h3>
              <button onClick={() => setShowDetail(false)} className="p-1.5 bg-dark-700 rounded-lg">
                <XCircle className="w-4 h-4 text-dark-300" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-dark-400">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[selectedOrder.status] || ''}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-dark-400">Receipt:</span><span className="text-white font-medium">{selectedOrder.receiptNumber}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Phone:</span><span className="text-white">{selectedOrder.phoneNumber}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Bundle:</span><span className="text-white">{selectedOrder.bundleSize}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Amount:</span><span className="text-emerald-400 font-bold">GHS {selectedOrder.amount}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Submitted:</span><span className="text-dark-300">{formatDate(selectedOrder.createdAt)}</span></div>
              {selectedOrder.adminNotes && (
                <div className="bg-dark-900 rounded-lg p-3 mt-2">
                  <span className="text-cyan-400 font-medium block mb-1">Admin Notes:</span>
                  <p className="text-dark-200 whitespace-pre-wrap">{selectedOrder.adminNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MtnExpressAdmin;
