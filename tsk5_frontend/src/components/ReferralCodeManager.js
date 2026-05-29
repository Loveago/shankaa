import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Copy, Plus, Trash2, Eye, EyeOff, Loader2, RefreshCw, Check, X } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import { toast } from 'react-toastify';

const ReferralCodeManager = () => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const fetchCodes = async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/auth/referral-codes?page=${pageNum}&limit=10`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setCodes(res.data.codes);
        setPagination(res.data.pagination);
      }
    } catch (error) {
      toast.error('Failed to fetch referral codes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes(page);
  }, [page]);

  const handleCreateCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { maxUses: maxUses ? parseInt(maxUses) : null };
      if (expiresAt) {
        payload.expiresAt = new Date(expiresAt).toISOString();
      }

      const res = await axios.post(`${BASE_URL}/api/auth/referral-codes/create`, payload, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        toast.success(`Code created: ${res.data.code.code}`);
        setMaxUses('');
        setExpiresAt('');
        setShowCreateForm(false);
        fetchCodes(1);
        setPage(1);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create code');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (codeId) => {
    if (!window.confirm('Deactivate this code?')) return;

    try {
      const res = await axios.put(`${BASE_URL}/api/auth/referral-codes/${codeId}/deactivate`, {}, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        toast.success('Code deactivated');
        fetchCodes(page);
      }
    } catch (error) {
      toast.error('Failed to deactivate code');
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Referral Codes</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Code
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-dark-700 border border-dark-600 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create Referral Code</h3>
          <form onSubmit={handleCreateCode} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max Uses (Optional)</label>
                <input
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && codes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="bg-dark-700 border border-dark-600 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-600 border-b border-dark-500">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Code</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Uses</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Expires</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                      No referral codes yet
                    </td>
                  </tr>
                ) : (
                  codes.map((code) => (
                    <tr key={code.id} className="border-b border-dark-600 hover:bg-dark-600/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-orange-400 font-semibold">{code.code}</code>
                          <button
                            onClick={() => copyToClipboard(code.code)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            {copiedCode === code.code ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          code.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {code.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {code.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {code.maxUses ? `${code.usedCount}/${code.maxUses}` : `${code.usedCount}/∞`}
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {new Date(code.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {code.isActive && (
                          <button
                            onClick={() => handleDeactivate(code.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-dark-600 border-t border-dark-500">
              <div className="text-sm text-gray-400">
                Page {page} of {pagination.pages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-dark-500 hover:bg-dark-400 disabled:bg-dark-600 text-white rounded transition-colors text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                  className="px-3 py-1 bg-dark-500 hover:bg-dark-400 disabled:bg-dark-600 text-white rounded transition-colors text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReferralCodeManager;
