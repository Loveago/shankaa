import React, { useState, useEffect, useCallback } from 'react';
import { X, Key, Plus, Trash2, Loader2, Copy, Check, Shield, ShieldOff, Globe, Clock, Hash, ChevronDown, ChevronRight, Wallet, ExternalLink, RefreshCw, Network, Radio, Power, Play } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const NETWORK_COLORS = {
  mtn: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'MTN' },
  telecel: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Telecel' },
  airteltigo: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'AirtelTigo' },
  other: { bg: 'bg-dark-600', text: 'text-dark-300', border: 'border-dark-500', label: 'Other' }
};

const UserApiKeys = ({ isOpen, onClose, walletBalance = 0, onTopUp }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [activeTab, setActiveTab] = useState('keys'); // 'keys', 'docs', 'wallet'
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [balance, setBalance] = useState(walletBalance);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [networkMap, setNetworkMap] = useState(null);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [expandedKeyId, setExpandedKeyId] = useState(null);
  const [webhookUrls, setWebhookUrls] = useState({});
  const [updatingWebhook, setUpdatingWebhook] = useState({});
  const [testingWebhook, setTestingWebhook] = useState({});

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/user-api/keys`, { headers: getAuthHeaders() });
      setApiKeys(res.data?.data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/users/loan/${localStorage.getItem('userId')}`, { headers: getAuthHeaders() });
      if (res?.data?.loanBalance !== undefined) {
        setBalance(Math.abs(parseFloat(res.data.loanBalance)));
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const fetchNetworkMap = useCallback(async () => {
    setLoadingNetwork(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/user-api/network-map`, { headers: getAuthHeaders() });
      setNetworkMap(res.data?.data || null);
    } catch (e) {
      // ignore
    } finally {
      setLoadingNetwork(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchApiKeys();
      fetchBalance();
      setNewlyCreatedKey(null);
      setShowCreateForm(false);
      setKeyName('');
      setActiveTab('keys');
    }
  }, [isOpen, fetchApiKeys, fetchBalance]);

  const handleCreate = async () => {
    if (!keyName.trim()) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Key name is required', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/user-api/keys`, { name: keyName.trim() }, { headers: getAuthHeaders() });
      setNewlyCreatedKey(res.data?.data);
      setKeyName('');
      setShowCreateForm(false);
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'API Key Created!', html: 'Copy the key now — <b>it won\'t be shown again.</b>', background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to create API key', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id, name) => {
    const result = await Swal.fire({
      title: 'Revoke API Key?',
      text: `This will disable "${name}". Orders using this key will be rejected.`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Revoke',
      background: '#1e293b', color: '#f1f5f9'
    });
    if (!result.isConfirmed) return;
    try {
      await axios.patch(`${BASE_URL}/api/user-api/keys/${id}/revoke`, {}, { headers: getAuthHeaders() });
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'Revoked', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to revoke key', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleActivate = async (id) => {
    try {
      await axios.patch(`${BASE_URL}/api/user-api/keys/${id}/activate`, {}, { headers: getAuthHeaders() });
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'Reactivated', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to activate key', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Delete Permanently?',
      text: `This permanently deletes "${name}". Cannot be undone.`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete',
      background: '#1e293b', color: '#f1f5f9'
    });
    if (!result.isConfirmed) return;
    try {
      await axios.delete(`${BASE_URL}/api/user-api/keys/${id}`, { headers: getAuthHeaders() });
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete key', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Webhook handlers
  const toggleKeyExpand = (id) => {
    setExpandedKeyId(expandedKeyId === id ? null : id);
    // Load existing webhook URL into local state
    if (expandedKeyId !== id) {
      const key = apiKeys.find(k => k.id === id);
      if (key) {
        setWebhookUrls(prev => ({ ...prev, [id]: key.webhookUrl || '' }));
      }
    }
  };

  const handleWebhookUrlChange = (keyId, value) => {
    setWebhookUrls(prev => ({ ...prev, [keyId]: value }));
  };

  const handleUpdateWebhook = async (keyId) => {
    setUpdatingWebhook(prev => ({ ...prev, [keyId]: true }));
    try {
      const url = webhookUrls[keyId]?.trim() || '';
      const res = await axios.patch(
        `${BASE_URL}/api/user-api/keys/${keyId}/webhook`,
        { webhookUrl: url || null },
        { headers: getAuthHeaders() }
      );
      Swal.fire({
        icon: 'success', title: 'Webhook Updated',
        text: url ? 'Your endpoint will now receive order status updates.' : 'Webhook URL cleared.',
        timer: 2000, background: '#1e293b', color: '#f1f5f9'
      });
      fetchApiKeys();
    } catch (error) {
      Swal.fire({
        icon: 'error', title: 'Error',
        text: error.response?.data?.message || 'Failed to update webhook URL',
        background: '#1e293b', color: '#f1f5f9'
      });
    } finally {
      setUpdatingWebhook(prev => ({ ...prev, [keyId]: false }));
    }
  };

  const handleToggleWebhook = async (keyId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/api/user-api/keys/${keyId}/webhook/toggle`,
        {},
        { headers: getAuthHeaders() }
      );
      Swal.fire({
        icon: 'success', title: res.data.message,
        timer: 1500, background: '#1e293b', color: '#f1f5f9'
      });
      fetchApiKeys();
    } catch (error) {
      Swal.fire({
        icon: 'error', title: 'Error',
        text: error.response?.data?.message || 'Failed to toggle webhook',
        background: '#1e293b', color: '#f1f5f9'
      });
    }
  };

  const handleTestWebhook = async (keyId) => {
    setTestingWebhook(prev => ({ ...prev, [keyId]: true }));
    try {
      const res = await axios.post(
        `${BASE_URL}/api/user-api/keys/${keyId}/webhook/test`,
        {},
        { headers: getAuthHeaders() }
      );
      Swal.fire({
        icon: 'success', title: 'Test Sent!',
        text: 'Webhook test payload delivered successfully.',
        timer: 2000, background: '#1e293b', color: '#f1f5f9'
      });
    } catch (error) {
      Swal.fire({
        icon: 'error', title: 'Test Failed',
        text: error.response?.data?.message || 'Could not deliver test webhook.',
        background: '#1e293b', color: '#f1f5f9'
      });
    } finally {
      setTestingWebhook(prev => ({ ...prev, [keyId]: false }));
    }
  };

  if (!isOpen) return null;

  const baseUrl = (BASE_URL || '').replace(/\/$/, '');

  const renderTabButton = (tab, icon, label) => (
    <button
      onClick={() => { setActiveTab(tab); if (tab === 'wallet') fetchBalance(); if (tab === 'docs') fetchNetworkMap(); }}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
        activeTab === tab
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const endpointBlocks = [
    {
      id: 'products',
      method: 'GET',
      methodColor: 'text-emerald-400',
      methodBg: 'bg-emerald-500/20',
      path: '/products',
      desc: 'List available products',
      summary: 'Returns all available products with current prices, stock levels, and network mapping.',
      codeBg: 'text-emerald-300',
      request: null,
      response: `{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "MTN 1GB Daily",
      "description": "1GB valid 24hrs",
      "price": 5.00,
      "stock": 100,
      "network": "mtn"
    }
  ]
}`
    },
    {
      id: 'orders',
      method: 'POST',
      methodColor: 'text-blue-400',
      methodBg: 'bg-blue-500/20',
      path: '/orders',
      desc: 'Place an order (wallet deducted)',
      summary: 'Submit items for processing. Amount is deducted from your wallet balance.',
      codeBg: 'text-blue-300',
      request: `{
  "items": [
    {
      "productId": 1,
      "quantity": 1,
      "mobileNumber": "0241234567"
    }
  ]
}`,
      response: `{
  "success": true,
  "orderId": 456,
  "status": "Pending",
  "totalPrice": 5.00,
  "items": [
    {
      "id": 789,
      "productId": 1,
      "productName": "MTN 1GB Daily",
      "quantity": 1,
      "price": 5.00,
      "mobileNumber": "0241234567",
      "status": "Pending"
    }
  ],
  "createdAt": "2025-03-03T10:30:00.000Z"
}`
    },
    {
      id: 'order-status',
      method: 'GET',
      methodColor: 'text-emerald-400',
      methodBg: 'bg-emerald-500/20',
      path: '/orders/:orderId',
      desc: 'Check order status',
      summary: 'Check the status of a single order by its ID.',
      codeBg: 'text-emerald-300',
      request: null,
      response: `{
  "success": true,
  "data": {
    "orderId": 456,
    "status": "Pending",
    "items": [
      {
        "id": 789,
        "productName": "MTN 1GB Daily",
        "quantity": 1,
        "mobileNumber": "0241234567",
        "status": "Completed"
      }
    ]
  }
}`
    },
    {
      id: 'bulk-status',
      method: 'POST',
      methodColor: 'text-blue-400',
      methodBg: 'bg-blue-500/20',
      path: '/orders/status',
      desc: 'Bulk check order statuses',
      summary: 'Check multiple order statuses at once (max 50).',
      codeBg: 'text-blue-300',
      request: `{
  "orderIds": [456, 457, 458]
}`,
      response: `{
  "success": true,
  "data": [
    { "orderId": 456, "status": "Pending", "items": [...] },
    { "orderId": 457, "status": "Completed", "items": [...] }
  ]
}`
    },
    {
      id: 'wallet',
      method: 'GET',
      methodColor: 'text-emerald-400',
      methodBg: 'bg-emerald-500/20',
      path: '/wallet',
      desc: 'Check wallet balance',
      summary: 'Returns your current wallet balance in GHS.',
      codeBg: 'text-emerald-300',
      request: null,
      response: `{
  "success": true,
  "data": {
    "balance": 150.00,
    "hasLoan": false,
    "adminLoanBalance": 0,
    "currency": "GHS"
  }
}`
    },
    {
      id: 'network-map',
      method: 'GET',
      methodColor: 'text-purple-400',
      methodBg: 'bg-purple-500/20',
      path: '/network-map',
      desc: 'Get network usage summary',
      summary: 'Returns a breakdown of your orders by network (MTN, Telecel, AirtelTigo) with totals.',
      codeBg: 'text-purple-300',
      request: null,
      response: `{
  "success": true,
  "data": {
    "mtn": { "count": 45, "total": 225.00 },
    "telecel": { "count": 12, "total": 60.00 },
    "airteltigo": { "count": 8, "total": 40.00 },
    "other": { "count": 3, "total": 15.00 }
  }
}`
    },
    {
      id: 'webhook',
      method: 'POST',
      methodColor: 'text-violet-400',
      methodBg: 'bg-violet-500/20',
      path: 'N/A (configured on dashboard)',
      desc: 'Webhook notifications',
      summary: 'When you configure a webhook URL on your API key, the system sends POST requests to your endpoint on order events. No additional API endpoint needed.',
      codeBg: 'text-violet-300',
      request: null,
      response: `// Example webhook payload (order.created):
{
  "event": "order.created",
  "timestamp": "2025-03-03T10:30:00.000Z",
  "data": {
    "orderId": 456,
    "status": "Pending",
    "totalItems": 2,
    "items": [
      {
        "id": 789,
        "productId": 1,
        "productName": "MTN 1GB Daily",
        "quantity": 1,
        "price": 5.00,
        "mobileNumber": "0241234567",
        "status": "Pending",
        "updatedAt": "2025-03-03T10:30:00.000Z"
      }
    ],
    "apiKeyName": "My Website",
    "createdAt": "2025-03-03T10:30:00.000Z"
  }
}`
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">Personal API Keys</h2>
              <p className="text-white/70 text-xs">Create API keys to place orders programmatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-2 border-b border-dark-700 flex-shrink-0 overflow-x-auto">
          {renderTabButton('keys', <Key className="w-3.5 h-3.5" />, 'My Keys')}
          {renderTabButton('docs', <Globe className="w-3.5 h-3.5" />, 'API Docs')}
          {renderTabButton('wallet', <Wallet className="w-3.5 h-3.5" />, 'Wallet')}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ==================== KEYS TAB ==================== */}
          {activeTab === 'keys' && (
            <>
              {/* Wallet Balance Banner */}
              <div className="bg-gradient-to-r from-dark-900 to-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs">Wallet Balance</p>
                    <p className="text-white font-bold text-lg">GHS {balance.toFixed(2)}</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (onTopUp) onTopUp(); }}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all"
                >
                  Top Up
                </button>
              </div>

              {/* Newly Created Key Banner */}
              {newlyCreatedKey && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-emerald-400 font-semibold">New Key: "{newlyCreatedKey.name}"</h3>
                  </div>
                  <p className="text-amber-400 text-xs mb-3">⚠️ Copy this key now — it will NOT be shown again!</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-dark-900 text-emerald-300 px-3 py-2 rounded-lg text-sm font-mono break-all">
                      {newlyCreatedKey.apiKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(newlyCreatedKey.apiKey, 'new')}
                      className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors flex-shrink-0"
                    >
                      {copiedKeyId === 'new' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowCreateForm(!showCreateForm); setNewlyCreatedKey(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 transition-all"
                >
                  <Plus className="w-4 h-4" /> Generate New Key
                </button>
              </div>

              {/* Create Form */}
              {showCreateForm && (
                <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3">Create API Key</h3>
                  <p className="text-dark-400 text-xs mb-3">Give your key a name to remember what it's for (e.g., "My Website", "Telegram Bot")</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. My E-commerce Site"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white placeholder-dark-500 focus:border-violet-500 focus:outline-none text-sm"
                      maxLength={100}
                    />
                    <button
                      onClick={handleCreate}
                      disabled={creating}
                      className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}

              {/* Keys List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                  <p className="text-dark-400">No API keys created yet</p>
                  <p className="text-dark-500 text-sm">Generate a key to start integrating your apps</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-dark-400 text-sm font-medium uppercase tracking-wider">Your Keys ({apiKeys.length}/10)</h3>
                  {apiKeys.map((key) => (
                    <div key={key.id} className={`bg-dark-900 border rounded-xl transition-all ${key.isActive ? 'border-dark-600 hover:border-violet-500/30' : 'border-red-500/20 opacity-60'}`}>
                      {/* Main row - always visible */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {key.isActive ? (
                                <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <ShieldOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                              )}
                              <h4 className="text-white font-semibold truncate">{key.name}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${key.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                {key.isActive ? 'Active' : 'Revoked'}
                              </span>
                              {key.webhookEnabled && key.webhookUrl && (
                                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                                  <Radio className="w-3 h-3" /> Webhook
                                </span>
                              )}
                            </div>
                            <code className="text-dark-400 text-xs font-mono">{key.apiKeyPreview}</code>
                            <div className="flex items-center gap-4 text-xs text-dark-500 mt-2">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Created: {new Date(key.createdAt).toLocaleDateString()}
                              </span>
                              {key.lastUsedAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Used: {new Date(key.lastUsedAt).toLocaleDateString()}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {key.totalOrders} orders
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => toggleKeyExpand(key.id)}
                              className="p-2 text-dark-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                              title="Webhook settings"
                            >
                              {expandedKeyId === key.id ? <ChevronDown className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                            </button>
                            {key.isActive ? (
                              <button onClick={() => handleRevoke(key.id, key.name)} className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors" title="Revoke key">
                                <ShieldOff className="w-4 h-4" />
                              </button>
                            ) : (
                              <button onClick={() => handleActivate(key.id)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Reactivate key">
                                <Shield className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(key.id, key.name)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete permanently">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Webhook Configuration */}
                      {expandedKeyId === key.id && (
                        <div className="border-t border-dark-700 px-4 py-4 space-y-3 bg-dark-950/50">
                          <h5 className="text-dark-300 text-xs font-semibold flex items-center gap-2">
                            <Radio className="w-3.5 h-3.5 text-violet-400" /> Webhook Configuration
                          </h5>

                          {/* Webhook URL Input */}
                          <div className="flex gap-2">
                            <input
                              type="url"
                              placeholder="https://your-server.com/webhook"
                              value={webhookUrls[key.id] || ''}
                              onChange={(e) => handleWebhookUrlChange(key.id, e.target.value)}
                              className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-dark-500 focus:border-violet-500 focus:outline-none text-sm font-mono"
                            />
                            <button
                              onClick={() => handleUpdateWebhook(key.id)}
                              disabled={updatingWebhook[key.id]}
                              className="px-3 py-2 bg-violet-500/20 text-violet-300 rounded-lg text-xs font-medium hover:bg-violet-500/30 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                              {updatingWebhook[key.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                              Save
                            </button>
                          </div>
                          <p className="text-dark-500 text-[11px]">Enter an HTTPS URL to receive order status updates as JSON payloads.</p>

                          {/* Toggle & Test Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleWebhook(key.id)}
                              disabled={!key.webhookUrl}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                key.webhookEnabled
                                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                  : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                              } disabled:opacity-40`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {key.webhookEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button
                              onClick={() => handleTestWebhook(key.id)}
                              disabled={testingWebhook[key.id] || !key.webhookUrl}
                              className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-500/30 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                            >
                              {testingWebhook[key.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                              Test
                            </button>
                          </div>

                          {/* Webhook status badge */}
                          {key.webhookUrl && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                key.webhookEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-dark-700 text-dark-400'
                              }`}>
                                <Radio className="w-3 h-3" />
                                {key.webhookEnabled ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-dark-500 truncate max-w-[300px]">
                                {key.webhookUrl}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ==================== DOCS TAB ==================== */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              {/* Overview */}
              <div className="bg-gradient-to-r from-violet-900/30 to-indigo-900/30 border border-violet-500/20 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-2">API Overview</h3>
                <p className="text-dark-300 text-sm leading-relaxed">
                  Your personal API allows you to place data orders programmatically. 
                  All orders are <span className="text-emerald-400 font-medium">deducted from your wallet balance</span> and 
                  appear in the admin panel just like dashboard orders. No prepayment needed — just sufficient wallet balance.
                </p>
              </div>

              {/* Base URL & Auth */}
              <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3">Base URL & Authentication</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-dark-400 text-xs mb-1">Base URL:</p>
                    <code className="bg-dark-800 text-violet-300 px-3 py-1.5 rounded-lg text-sm font-mono block">{baseUrl}/api/user-api</code>
                  </div>
                  <div>
                    <p className="text-dark-400 text-xs mb-1">Authentication (all endpoints):</p>
                    <code className="bg-dark-800 text-violet-300 px-3 py-1.5 rounded-lg text-sm font-mono block">x-api-key: YOUR_API_KEY</code>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-amber-400 text-xs">⚠️ Never expose your API key in client-side code. Keep it server-side only.</p>
                  </div>
                </div>
              </div>

              {/* Network Map */}
              <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Network className="w-4 h-4 text-violet-400" /> Network Product Map
                  </h3>
                  <button onClick={fetchNetworkMap} className="p-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 text-dark-400 ${loadingNetwork ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="text-dark-400 text-xs mb-3">Products are auto-mapped to networks by name prefix:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { net: 'mtn', prefix: 'MTN', example: 'MTN 1GB Daily, MTN 2GB Weekly', ...NETWORK_COLORS.mtn },
                    { net: 'telecel', prefix: 'TELECEL', example: 'TELECEL 1GB, TELECEL 500MB', ...NETWORK_COLORS.telecel },
                    { net: 'airteltigo', prefix: 'AIRTEL', example: 'AIRTEL 1GB, AIRTEL TIGO 500MB', ...NETWORK_COLORS.airteltigo }
                  ].map(n => (
                    <div key={n.net} className={`${n.bg} border ${n.border} rounded-xl p-3`}>
                      <p className={`${n.text} font-semibold text-sm`}>{n.label}</p>
                      <p className="text-dark-400 text-xs mt-1">Prefix: <code className="text-white text-[11px]">{n.prefix}</code></p>
                      <p className="text-dark-500 text-[11px] mt-1">{n.example}</p>
                    </div>
                  ))}
                </div>
                {networkMap && (
                  <div className="mt-4 p-3 bg-dark-800 rounded-lg">
                    <p className="text-dark-400 text-xs mb-2">Your Usage:</p>
                    <div className="grid grid-cols-3 gap-3">
                      {Object.entries(networkMap).map(([net, data]) => {
                        const colors = NETWORK_COLORS[net] || NETWORK_COLORS.other;
                        return (
                          <div key={net} className="text-center">
                            <p className={`${colors.text} text-sm font-bold`}>{data.count}</p>
                            <p className="text-dark-500 text-[11px] uppercase">{colors.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Reference */}
              <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3">Order Status Reference</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { status: 'Pending', color: 'text-yellow-400', desc: 'Awaiting processing' },
                    { status: 'Processing', color: 'text-blue-400', desc: 'Being processed by admin' },
                    { status: 'Completed', color: 'text-emerald-400', desc: 'Successfully delivered' },
                    { status: 'Cancelled', color: 'text-red-400', desc: 'Cancelled (wallet refunded if applicable)' }
                  ].map(s => (
                    <div key={s.status} className="flex items-center gap-2 p-2 bg-dark-800 rounded-lg">
                      <span className={`${s.color} font-mono text-xs`}>{s.status}</span>
                      <span className="text-dark-400 text-xs">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endpoints */}
              <div>
                <h3 className="text-white font-semibold mb-3">Endpoints</h3>
                <div className="space-y-2">
                  {endpointBlocks.map(ep => (
                    <div key={ep.id} className="bg-dark-900 border border-dark-600 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedEndpoint(expandedEndpoint === ep.id ? null : ep.id)}
                        className="w-full p-3 flex items-center gap-2 hover:bg-dark-700/50 transition-colors"
                      >
                        {expandedEndpoint === ep.id ? <ChevronDown className="w-3.5 h-3.5 text-dark-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-dark-400 flex-shrink-0" />}
                        <span className={`${ep.methodBg} ${ep.methodColor} text-xs font-mono px-2 py-0.5 rounded`}>{ep.method}</span>
                        <code className="text-dark-200 text-xs">{ep.path}</code>
                        <span className="text-dark-500 text-xs ml-auto">{ep.desc}</span>
                      </button>
                      {expandedEndpoint === ep.id && (
                        <div className="px-3 pb-4 pt-0 border-t border-dark-700 space-y-3">
                          <p className="text-dark-400 text-xs mt-3">{ep.summary}</p>
                          {ep.request && (
                            <div>
                              <p className="text-dark-300 text-xs font-medium mb-1">Request Body:</p>
                              <pre className={`bg-dark-950 ${ep.codeBg} text-xs p-3 rounded-lg overflow-x-auto`}>{ep.request}</pre>
                            </div>
                          )}
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Response:</p>
                            <pre className="bg-dark-950 text-violet-300 text-xs p-3 rounded-lg overflow-x-auto">{ep.response}</pre>
                          </div>
                          <p className="text-dark-500 text-[11px]">
                            <strong>Full URL:</strong> <code className="text-violet-400">{`${ep.method} ${baseUrl}/api/user-api${ep.path.replace(/:(\w+)/, '$1')}`}</code>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Webhook Documentation */}
              <div className="bg-dark-900 border border-violet-500/20 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-violet-400" /> Webhooks
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="text-dark-300 text-xs leading-relaxed">
                    Webhooks allow your server to receive real-time notifications when orders are created or
                    their status changes. Configure a webhook URL on any active API key from the Keys tab.
                  </p>

                  <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                    <p className="text-violet-300 text-xs font-medium mb-1">Event Types</p>
                    <div className="space-y-1 mt-2">
                      <div className="flex items-center gap-2 text-xs">
                        <code className="bg-dark-800 text-emerald-300 px-1.5 py-0.5 rounded text-[11px]">order.created</code>
                        <span className="text-dark-400">Fired when an order is placed successfully</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <code className="bg-dark-800 text-blue-300 px-1.5 py-0.5 rounded text-[11px]">order.updated</code>
                        <span className="text-dark-400">Fired when any item in an order changes status</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <code className="bg-dark-800 text-amber-300 px-1.5 py-0.5 rounded text-[11px]">webhook.test</code>
                        <span className="text-dark-400">Sent when you click "Test" on your key configuration</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-dark-800 rounded-lg">
                    <p className="text-dark-300 text-xs font-medium mb-2">Request Headers</p>
                    <div className="space-y-1">
                      <code className="block text-[11px] text-dark-400">
                        <span className="text-violet-300">Content-Type:</span> application/json
                      </code>
                      <code className="block text-[11px] text-dark-400">
                        <span className="text-violet-300">X-Webhook-Event:</span> order.created
                      </code>
                      <code className="block text-[11px] text-dark-400">
                        <span className="text-violet-300">X-Webhook-Timestamp:</span> 2025-03-03T10:30:00.000Z
                      </code>
                      <code className="block text-[11px] text-dark-400">
                        <span className="text-violet-300">X-Webhook-Attempt:</span> 1
                      </code>
                    </div>
                  </div>

                  <div className="p-3 bg-dark-800 rounded-lg">
                    <p className="text-dark-300 text-xs font-medium mb-2">Best Practices</p>
                    <ul className="text-dark-400 text-xs space-y-1.5 list-disc list-inside">
                      <li>Your endpoint <span className="text-red-400">must respond with HTTP 2xx</span> within 10 seconds</li>
                      <li>The system retries failed deliveries up to <strong>3 times</strong> with exponential backoff</li>
                      <li>Always use <span className="text-emerald-400">HTTPS</span> for your webhook endpoint</li>
                      <li>Respond with HTTP 200 to acknowledge receipt (avoids unnecessary retries)</li>
                      <li>Use the <code className="text-violet-300">X-Webhook-Event</code> header to route events in your code</li>
                    </ul>
                  </div>

                  <div>
                    <p className="text-dark-300 text-xs font-medium mb-1">Node.js Webhook Receiver Example:</p>
                    <pre className="bg-dark-950 text-emerald-300 text-xs p-3 rounded-lg overflow-x-auto">{`const express = require('express');
const app = express();

app.post('/webhook', express.json(), (req, res) => {
  const event = req.headers['x-webhook-event'];
  const payload = req.body;
  
  console.log(\`Received webhook: \${event}\`);
  
  if (event === 'order.created') {
    // Order #payload.data.orderId was placed
    // Check items, update your records
  } else if (event === 'order.updated') {
    // Item status changed in order #payload.data.orderId
  }
  
  res.sendStatus(200); // Acknowledge receipt
});`}</pre>
                  </div>
                </div>
              </div>

              {/* Error Codes */}
              <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3">Error Codes</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { code: 400, desc: 'Bad request — missing/invalid fields, insufficient balance, product out of stock' },
                    { code: 401, desc: 'Missing or invalid API key' },
                    { code: 403, desc: 'API key revoked or account suspended' },
                    { code: 404, desc: 'Order not found' },
                    { code: 500, desc: 'Server error — try again or contact support' }
                  ].map(e => (
                    <div key={e.code} className="flex items-start gap-3 p-2 bg-dark-800 rounded-lg">
                      <span className="text-red-400 font-mono text-xs font-bold">{e.code}</span>
                      <span className="text-dark-400 text-xs">{e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Examples */}
              <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3">Quick Start Examples</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-dark-300 text-xs font-medium mb-1">curl (fetch products):</p>
                    <pre className="bg-dark-950 text-emerald-300 text-xs p-3 rounded-lg overflow-x-auto">{`curl -H "x-api-key: usk_YOUR_KEY" ${baseUrl}/api/user-api/products`}</pre>
                  </div>
                  <div>
                    <p className="text-dark-300 text-xs font-medium mb-1">curl (place order):</p>
                    <pre className="bg-dark-950 text-blue-300 text-xs p-3 rounded-lg overflow-x-auto">{`curl -X POST \\
  -H "x-api-key: usk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"items":[{"productId":1,"quantity":1,"mobileNumber":"0241234567"}]}' \\
  ${baseUrl}/api/user-api/orders`}</pre>
                  </div>
                  <div>
                    <p className="text-dark-300 text-xs font-medium mb-1">Node.js (using fetch):</p>
                    <pre className="bg-dark-950 text-yellow-300 text-xs p-3 rounded-lg overflow-x-auto">{`const API_KEY = 'usk_YOUR_KEY';
const BASE = '${baseUrl}/api/user-api';

// Fetch products
const products = await fetch(\`\${BASE}/products\`, {
  headers: { 'x-api-key': API_KEY }
}).then(r => r.json());

// Place order
const order = await fetch(\`\${BASE}/orders\`, {
  method: 'POST',
  headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productId: 1, quantity: 1, mobileNumber: '0241234567' }]
  })
}).then(r => r.json());`}</pre>
                  </div>
                  <div>
                    <p className="text-dark-300 text-xs font-medium mb-1">Python:</p>
                    <pre className="bg-dark-950 text-blue-300 text-xs p-3 rounded-lg overflow-x-auto">{`import requests

API_KEY = 'usk_YOUR_KEY'
BASE = '${baseUrl}/api/user-api'
headers = {'x-api-key': API_KEY}

# Get products
products = requests.get(f'{BASE}/products', headers=headers).json()

# Place order
order = requests.post(f'{BASE}/orders', headers=headers, json={
    'items': [{'productId': 1, 'quantity': 1, 'mobileNumber': '0241234567'}]
}).json()`}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== WALLET TAB ==================== */}
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              {/* Balance Card */}
              <div className="bg-gradient-to-br from-emerald-900/30 to-dark-900 border border-emerald-500/20 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-dark-400 text-sm mb-1">Current Wallet Balance</p>
                <p className="text-4xl font-bold text-white mb-1">GHS {balance.toFixed(2)}</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => { if (onTopUp) onTopUp(); }}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> Top Up Now
                  </button>
                  <button
                    onClick={fetchBalance}
                    className="p-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors"
                    disabled={loadingBalance}
                  >
                    <RefreshCw className={`w-4 h-4 text-dark-400 ${loadingBalance ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* How Top Up Works */}
              <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3">How Wallet Top-Up Works</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
                    <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 font-bold text-xs">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Choose Amount</p>
                      <p className="text-dark-400 text-xs mt-0.5">Select a quick amount or enter a custom amount (min GHS 1)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
                    <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 font-bold text-xs">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Pay via Mobile Money or Card</p>
                      <p className="text-dark-400 text-xs mt-0.5">Pay securely through Paystack with any mobile money wallet or debit/credit card</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
                    <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 font-bold text-xs">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Wallet Credited Instantly</p>
                      <p className="text-dark-400 text-xs mt-0.5">Once payment is confirmed, your wallet is credited and you can start ordering via API or dashboard</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance vs API */}
              <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-2">API & Wallet</h3>
                <p className="text-dark-400 text-sm leading-relaxed">
                  Every order placed via your API key is deducted from your wallet balance automatically.
                  Keep your wallet topped up to ensure your API orders go through without interruption.
                  You can check your balance anytime using the <code className="text-violet-300 text-xs bg-dark-800 px-1.5 py-0.5 rounded">/wallet</code> endpoint.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserApiKeys;
