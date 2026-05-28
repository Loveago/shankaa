import React, { useState, useEffect, useCallback } from 'react';
import { X, Landmark, Search, Loader2, CheckCircle, XCircle, Clock, RefreshCw, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const formatAmount = (amount) => {
  const num = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);
  return `GHS ${num.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const StorefrontWithdrawalAdmin = ({ isOpen, onClose }) => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchAgent, setSearchAgent] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalCount: 0, totalPages: 1 });
  const [adminNotes, setAdminNotes] = useState({});

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (searchAgent) params.agentId = searchAgent;

      const res = await axios.get(`${BASE_URL}/api/storefront/admin/withdrawals`, {
        params,
        headers: getAuthHeaders()
      });
      
      if (res.data.success) {
        setWithdrawals(res.data.requests || []);
        setPagination(res.data.pagination || { page: 1, limit: 20, totalCount: 0, totalPages: 1 });
      }
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load withdrawal requests', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchAgent]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchWithdrawals();
    }
  }, [isOpen, fetchWithdrawals]);

  useEffect(() => {
    fetchWithdrawals();
  }, [page, statusFilter, fetchWithdrawals]);

  const handleProcess = async (requestId, status) => {
    const notes = adminNotes[requestId] || '';

    const confirmText = status === 'Approved' ? 'approve' : 'reject';
    const result = await Swal.fire({
      title: `${status === 'Approved' ? 'Approve' : 'Reject'} Withdrawal?`,
      text: `Are you sure you want to ${confirmText} this withdrawal request of ${withdrawals.find(w => w.id === requestId)?.amount ? formatAmount(withdrawals.find(w => w.id === requestId).amount) : ''}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: status === 'Approved' ? '#10b981' : '#ef4444',
      confirmButtonText: status === 'Approved' ? 'Yes, Approve' : 'Yes, Reject',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (!result.isConfirmed) return;

    setProcessingId(requestId);
    try {
      const res = await axios.put(`${BASE_URL}/api/storefront/admin/withdrawals/${requestId}`,
        { status, adminNotes: notes || null },
        { headers: getAuthHeaders() }
      );
      
      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: status === 'Approved' ? 'Approved!' : 'Rejected',
          text: `Withdrawal request has been ${status.toLowerCase()}`,
          timer: 1500,
          background: '#1e293b',
          color: '#f1f5f9',
          showConfirmButton: false
        });
        setAdminNotes(prev => ({ ...prev, [requestId]: '' }));
        fetchWithdrawals();
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || `Failed to ${confirmText} withdrawal`,
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      Pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      Approved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      Rejected: 'bg-red-500/20 text-red-400 border border-red-500/30'
    };
    return styles[status] || 'bg-dark-500/20 text-dark-400';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Landmark className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Storefront Withdrawals</h2>
              <p className="text-emerald-100 text-xs sm:text-sm">Manage agent withdrawal requests</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchWithdrawals} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
              <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-dark-900/50 border-b border-dark-700">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search by Agent ID..."
                value={searchAgent}
                onChange={(e) => { setSearchAgent(e.target.value); setPage(1); }}
                className="bg-transparent text-white text-sm focus:outline-none w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-dark-800 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <div className="text-dark-400 text-sm">
              Total: <span className="text-white font-medium">{pagination.totalCount}</span> requests
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-16">
              <Landmark className="w-16 h-16 text-dark-600 mx-auto mb-4" />
              <p className="text-dark-400">No withdrawal requests found</p>
              <p className="text-dark-500 text-sm mt-1">
                {statusFilter ? 'Try changing the status filter' : 'No agents have requested withdrawals yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-900 sticky top-0">
                  <tr className="text-left text-dark-400 text-sm">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Mobile</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Admin Notes</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="border-t border-dark-700 hover:bg-dark-800/50">
                      <td className="px-4 py-3 text-dark-300 text-sm whitespace-nowrap">
                        {new Date(w.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <br />
                        <span className="text-dark-500 text-xs">{new Date(w.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-white text-sm font-medium">{w.agent?.name || `Agent #${w.agentId}`}</span>
                          <span className="text-dark-400 text-xs">ID: {w.agentId}</span>
                          {w.agent?.role && (
                            <span className="text-dark-500 text-xs">{w.agent.role}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{formatAmount(w.amount)}</td>
                      <td className="px-4 py-3 text-dark-300 text-sm">{w.mobileNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(w.status)}`}>
                          {w.status}
                        </span>
                        {w.processedAt && (
                          <div className="text-dark-500 text-xs mt-1">
                            {new Date(w.processedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                          {w.status === 'Pending' ? (
                            <input
                              type="text"
                              placeholder="Add note..."
                              value={adminNotes[w.id] || w.adminNotes || ''}
                              onChange={(e) => setAdminNotes(prev => ({ ...prev, [w.id]: e.target.value }))}
                              className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-dark-300 text-xs focus:border-emerald-500 focus:outline-none"
                            />
                          ) : (
                            <span className="text-dark-400 text-xs">{w.adminNotes || '—'}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {w.status === 'Pending' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleProcess(w.id, 'Approved')}
                              disabled={processingId === w.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {processingId === w.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => handleProcess(w.id, 'Rejected')}
                              disabled={processingId === w.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {processingId === w.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-dark-500 text-xs flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {w.status === 'Approved' ? 'Approved' : 'Rejected'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="border-t border-dark-700 p-4 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-dark-400 text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="flex items-center gap-1 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorefrontWithdrawalAdmin;
