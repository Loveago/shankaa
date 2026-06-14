import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ExternalLink, Eye, Loader2, RefreshCw, Search, Wallet, XCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const formatMoney = (value) => `GHS ${Number(value || 0).toFixed(2)}`;

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusTone = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
    case 'COMPLETED':
    case 'RECONCILED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'PENDING':
    case 'UNPAID':
    case 'AWAITING_PAYMENT':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'FAILED':
    case 'EXPIRED':
    case 'CANCELLED':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'PROCESSING':
    case 'VERIFYING':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    default:
      return 'bg-dark-700 text-dark-300 border-dark-600';
  }
};

const getStatusIcon = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
    case 'COMPLETED':
    case 'RECONCILED':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'FAILED':
    case 'EXPIRED':
    case 'CANCELLED':
      return <XCircle className="w-4 h-4" />;
    case 'PROCESSING':
    case 'VERIFYING':
      return <RefreshCw className="w-4 h-4" />;
    default:
      return <Clock3 className="w-4 h-4" />;
  }
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="text-center py-12 px-4">
    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-700/60 flex items-center justify-center">
      <Icon className="w-8 h-8 text-dark-500" />
    </div>
    <h3 className="text-white text-lg font-semibold mb-2">{title}</h3>
    <p className="text-dark-400 text-sm max-w-md mx-auto">{description}</p>
  </div>
);

const UnpaidOrdersTable = ({
  isOpen,
  onClose,
  onViewDetails,
  refreshKey = 0,
  onStatsChange,
  onReconciled
}) => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, unpaid: 0, pending: 0, expired: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reconcilingId, setReconcilingId] = useState(null);
  const [isReconcilingAll, setIsReconcilingAll] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    paymentStatus: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/payment/unpaid-orders/stats`, {
        headers: getAuthHeaders()
      });
      const payload = response.data?.stats || response.data?.data || response.data || {};
      const normalized = {
        total: payload.total || 0,
        paid: payload.paid || payload.paidAwaitingProcessing || 0,
        unpaid: payload.unpaid || payload.pending || 0,
        pending: payload.pending || 0,
        expired: payload.expired || 0,
        failed: payload.failed || 0
      };
      setStats(normalized);
      if (onStatsChange) onStatsChange(normalized);
    } catch (error) {
      console.error('Error fetching unpaid order stats:', error);
    }
  }, [onStatsChange]);

  const fetchOrders = async (background = false) => {
    try {
      setError(null);
      if (background) setIsRefreshing(true);
      else setIsLoading(true);

      const response = await axios.get(`${BASE_URL}/api/payment/unpaid-orders`, {
        headers: getAuthHeaders()
      });

      const payload = response.data?.unpaidOrders || response.data?.data || response.data?.orders || response.data || [];
      setOrders(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Error fetching unpaid orders:', error);
      setError(error.response?.data?.message || 'Failed to load unpaid orders. Please refresh or check your connection.');
      setOrders([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchOrders();
    fetchStats();
  }, [isOpen, refreshKey, fetchStats]);

  const filteredOrders = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch = !search || [
        order.externalRef,
        order.mobileNumber,
        order.customerEmail,
        order.productName,
        order.paystackRef,
        String(order.id || '')
      ].some((value) => String(value || '').toLowerCase().includes(search));

      const matchesStatus = !filters.status || (order.status || '').toUpperCase() === filters.status;
      const matchesPaymentStatus = !filters.paymentStatus || (order.paymentStatus || '').toUpperCase() === filters.paymentStatus;

      return matchesSearch && matchesStatus && matchesPaymentStatus;
    });
  }, [orders, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetFilters = () => {
    setFilters({ search: '', status: '', paymentStatus: '' });
    setCurrentPage(1);
  };

  const handleReconcile = async (order) => {
    const confirm = await Swal.fire({
      title: 'Reconcile unpaid order?',
      text: `This will verify ${order.externalRef} with Paystack and create the real order if payment is confirmed.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#06b6d4',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (!confirm.isConfirmed) return;

    try {
      setReconcilingId(order.id);
      const response = await axios.post(`${BASE_URL}/api/payment/unpaid-orders/${order.id}/reconcile`, {}, {
        headers: getAuthHeaders()
      });

      Swal.fire({
        icon: 'success',
        title: 'Reconciliation complete',
        text: response.data?.message || 'The unpaid order was checked successfully.',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });

      await Promise.all([fetchOrders(true), fetchStats()]);
      if (onReconciled) onReconciled(response.data, order);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Reconciliation failed',
        text: error.response?.data?.message || 'Could not reconcile this unpaid order.',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setReconcilingId(null);
    }
  };

  const handleReconcileAll = async () => {
    const confirm = await Swal.fire({
      title: 'Reconcile ALL unpaid orders?',
      text: 'This will check all unpaid orders (including FAILED) with Paystack and create real orders for any that were actually paid. This may take a moment.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#06b6d4',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (!confirm.isConfirmed) return;

    try {
      setIsReconcilingAll(true);
      const response = await axios.post(`${BASE_URL}/api/payment/unpaid-orders/reconcile-all`, {}, {
        headers: getAuthHeaders()
      });

      const result = response.data;
      Swal.fire({
        icon: 'success',
        title: 'Bulk reconciliation complete',
        html: `<div style="text-align:left">
          <p>Created: <b>${result.ordersCreated}</b> new orders</p>
          <p>Already existed: <b>${result.alreadyExisted}</b></p>
          <p>Failed: <b>${result.failed}</b></p>
          <p>Errors: <b>${result.errors}</b></p>
          <p>Total checked: <b>${result.total}</b></p>
        </div>`,
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });

      await Promise.all([fetchOrders(true), fetchStats()]);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Bulk reconciliation failed',
        text: error.response?.data?.message || 'Could not reconcile all unpaid orders.',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setIsReconcilingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-6">
      <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/15 rounded-xl">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Unpaid Orders Queue</h2>
              <p className="text-amber-100 text-sm">Track pending Paystack attempts before they become real orders</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchOrders(true);
                fetchStats();
              }}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleReconcileAll}
              disabled={isReconcilingAll || orders.length === 0}
              className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              {isReconcilingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>Reconcile All</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-dark-900/40 hover:bg-dark-900/60 text-white rounded-xl text-sm font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 border-b border-dark-700">
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="rounded-xl border border-dark-700 bg-dark-900/40 p-4">
              <p className="text-dark-400 text-xs uppercase tracking-wide">Total</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-amber-300 text-xs uppercase tracking-wide">Pending</p>
              <p className="text-amber-400 text-2xl font-bold mt-1">{stats.pending}</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-red-300 text-xs uppercase tracking-wide">Unpaid</p>
              <p className="text-red-400 text-2xl font-bold mt-1">{stats.unpaid}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-emerald-300 text-xs uppercase tracking-wide">Paid</p>
              <p className="text-emerald-400 text-2xl font-bold mt-1">{stats.paid}</p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <p className="text-cyan-300 text-xs uppercase tracking-wide">Expired</p>
              <p className="text-cyan-400 text-2xl font-bold mt-1">{stats.expired}</p>
            </div>
            <div className="rounded-xl border border-dark-600 bg-dark-900/40 p-4">
              <p className="text-dark-300 text-xs uppercase tracking-wide">Failed</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.failed}</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-b border-dark-700 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, search: e.target.value }));
                  setCurrentPage(1);
                }}
                placeholder="Search reference, number, email..."
                className="w-full bg-dark-900/50 border border-dark-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-dark-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, status: e.target.value }));
                setCurrentPage(1);
              }}
              className="bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="">All queue statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="EXPIRED">Expired</option>
            </select>

            <div className="flex gap-3">
              <select
                value={filters.paymentStatus}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }));
                  setCurrentPage(1);
                }}
                className="flex-1 bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">All payment statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
              </select>

              <button
                onClick={resetFilters}
                className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-xl text-sm font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {error ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">Failed to load unpaid orders</h3>
              <p className="text-dark-400 text-sm max-w-md mx-auto mb-4">{error}</p>
              <button
                onClick={() => { fetchOrders(true); fetchStats(); }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No unpaid orders found"
              description="No unpaid queue items matched the current filters. New Paystack attempts will appear here once created."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr className="text-left text-dark-400 text-sm border-b border-dark-700">
                      <th className="pb-3 font-medium">Reference</th>
                      <th className="pb-3 px-3 font-medium">Customer</th>
                      <th className="pb-3 px-3 font-medium">Product</th>
                      <th className="pb-3 px-3 font-medium">Amount</th>
                      <th className="pb-3 px-3 font-medium">Queue Status</th>
                      <th className="pb-3 px-3 font-medium">Payment</th>
                      <th className="pb-3 px-3 font-medium">Attempts</th>
                      <th className="pb-3 px-3 font-medium">Created</th>
                      <th className="pb-3 px-3 font-medium">Expires</th>
                      <th className="pb-3 pl-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order) => {
                      const canReconcile = ['PENDING', 'FAILED', 'EXPIRED', 'PROCESSING'].includes((order.status || '').toUpperCase()) || (order.paymentStatus || '').toUpperCase() !== 'PAID';

                      return (
                        <tr key={order.id} className="border-b border-dark-700/50 hover:bg-dark-700/20 transition-colors">
                          <td className="py-4 text-white font-medium align-top">
                            <div className="space-y-1">
                              <p>{order.externalRef || 'N/A'}</p>
                              <p className="text-xs text-dark-500">Paystack: {order.paystackRef || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="py-4 px-3 align-top">
                            <div className="space-y-1 text-sm">
                              <p className="text-dark-200">{order.mobileNumber || 'N/A'}</p>
                              <p className="text-dark-400">{order.customerEmail || 'No email'}</p>
                            </div>
                          </td>
                          <td className="py-4 px-3 align-top">
                            <div className="space-y-1 text-sm">
                              <p className="text-cyan-400 font-medium">{order.productName || 'Unknown product'}</p>
                              <p className="text-dark-500">Product ID: {order.productId || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="py-4 px-3 align-top text-white font-semibold">{formatMoney(order.amount)}</td>
                          <td className="py-4 px-3 align-top">
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusTone(order.status)}`}>
                              {getStatusIcon(order.status)}
                              <span>{order.status || 'N/A'}</span>
                            </span>
                          </td>
                          <td className="py-4 px-3 align-top">
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusTone(order.paymentStatus)}`}>
                              {getStatusIcon(order.paymentStatus)}
                              <span>{order.paymentStatus || 'N/A'}</span>
                            </span>
                          </td>
                          <td className="py-4 px-3 align-top text-dark-300 text-sm">
                            <div>{order.paymentAttempts || 0}</div>
                            <div className="text-dark-500 text-xs">Last: {formatDate(order.lastAttemptAt)}</div>
                          </td>
                          <td className="py-4 px-3 align-top text-dark-300 text-sm">{formatDate(order.createdAt)}</td>
                          <td className="py-4 px-3 align-top text-dark-300 text-sm">{formatDate(order.expiresAt)}</td>
                          <td className="py-4 pl-3 align-top">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => onViewDetails && onViewDetails(order)}
                                className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-100 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                <span>View</span>
                              </button>

                              {order.paymentUrl && (
                                <a
                                  href={order.paymentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  <span>Link</span>
                                </a>
                              )}

                              <button
                                onClick={() => handleReconcile(order)}
                                disabled={!canReconcile || reconcilingId === order.id}
                                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {reconcilingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                <span>Reconcile</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-dark-700">
                  <p className="text-dark-400 text-sm">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} unpaid orders
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-2 text-white text-sm">Page {currentPage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnpaidOrdersTable;
