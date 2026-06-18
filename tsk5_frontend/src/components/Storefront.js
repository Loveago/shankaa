import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Store, Plus, Trash2, Edit2, Copy, Check, ExternalLink, Loader2, RefreshCw, DollarSign, Package, TrendingUp, Link2, Eye, EyeOff, Landmark, Settings, Wallet, MessageCircle, ArrowUpRight, Clock, ShoppingBag
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const formatAmount = (amount) => {
  const num = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);
  return `GHS ${num.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const Storefront = ({ isOpen, onClose, userId }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [storefrontProducts, setStorefrontProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [referralSummary, setReferralSummary] = useState({ orders: [], stats: {} });
  const [storefrontSlug, setStorefrontSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Add product modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customPrice, setCustomPrice] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);

  // Edit price modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalMobile, setWithdrawalMobile] = useState('');
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);

  // Order counts state
  const [orderCounts, setOrderCounts] = useState({ today: 0, month: 0, year: 0 });

  // WhatsApp settings state
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  // Orders state
  const [storefrontOrders, setStorefrontOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchStorefrontOrders = useCallback(async () => {
    if (!userId) return;
    setOrdersLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/storefront/agent/${userId}/orders`, { headers: getAuthHeaders() });
      if (res.data.success) setStorefrontOrders(res.data.orders);
    } catch (error) {
      console.error('Error fetching storefront orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, [userId]);

  const fetchOrderCounts = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/storefront/agent/${userId}/order-counts`, { headers: getAuthHeaders() });
      if (res.data.success) {
        setOrderCounts({ today: res.data.today, month: res.data.month, year: res.data.year });
      }
    } catch (error) {
      console.error('Error fetching order counts:', error);
    }
  }, [userId]);

  const fetchStorefrontData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [slugRes, productsRes, availableRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/slug`, { headers }),
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/products`, { headers }),
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/products/available`, { headers })
      ]);

      if (slugRes.data.success) setStorefrontSlug(slugRes.data.slug);
      if (productsRes.data.success) setStorefrontProducts(productsRes.data.products);
      if (availableRes.data.success) setAvailableProducts(availableRes.data.products);
    } catch (error) {
      console.error('Error fetching storefront data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchReferralSummary = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/storefront/agent/${userId}/referrals`, { headers: getAuthHeaders() });
      if (res.data.success) {
        setReferralSummary({ orders: res.data.orders, stats: res.data.stats });
      }
    } catch (error) {
      console.error('Error fetching referral summary:', error);
    }
  }, [userId]);

  const fetchWalletData = useCallback(async () => {
    if (!userId) return;
    try {
      const headers = getAuthHeaders();
      const [walletRes, whatsappRes, withdrawRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/wallet`, { headers }),
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/slug`, { headers }),
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/withdrawals`, { headers })
      ]);
      if (walletRes.data.success) setWalletBalance(walletRes.data.balance || 0);
      if (whatsappRes.data.whatsapp !== undefined) setWhatsappNumber(whatsappRes.data.whatsapp || '');
      if (withdrawRes.data.success) setWithdrawals(withdrawRes.data.withdrawals || []);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      fetchStorefrontData();
      fetchReferralSummary();
      fetchWalletData();
      fetchStorefrontOrders();
      fetchOrderCounts();
    }
  }, [isOpen, fetchStorefrontData, fetchReferralSummary, fetchWalletData, fetchStorefrontOrders, fetchOrderCounts]);

  const copyStoreLink = () => {
    const storeUrl = `${window.location.origin}/store/${storefrontSlug}`;
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddProduct = async () => {
    if (!selectedProduct || !customPrice) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please select a product and enter a price', background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    if (parseFloat(customPrice) < selectedProduct.price) {
      Swal.fire({ icon: 'error', title: 'Error', text: `Price must be at least GHS ${selectedProduct.price} (base price)`, background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    setAddingProduct(true);
    try {
      await axios.post(`${BASE_URL}/api/storefront/agent/${userId}/products`, {
        productId: selectedProduct.id,
        customPrice: parseFloat(customPrice)
      }, { headers: getAuthHeaders() });
      
      Swal.fire({ icon: 'success', title: 'Added!', text: 'Product added to your storefront', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
      setShowAddModal(false);
      setSelectedProduct(null);
      setCustomPrice('');
      fetchStorefrontData();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to add product', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setAddingProduct(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!editingProduct || !editPrice) return;

    if (parseFloat(editPrice) < editingProduct.product.price) {
      Swal.fire({ icon: 'error', title: 'Error', text: `Price must be at least GHS ${editingProduct.product.price} (base price)`, background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    try {
      await axios.put(`${BASE_URL}/api/storefront/agent/${userId}/products/${editingProduct.id}`, {
        customPrice: parseFloat(editPrice)
      }, { headers: getAuthHeaders() });
      
      Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
      setEditingProduct(null);
      setEditPrice('');
      fetchStorefrontData();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to update price', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleRemoveProduct = async (productId) => {
    const result = await Swal.fire({
      title: 'Remove Product?',
      text: 'This will remove the product from your storefront',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/storefront/agent/${userId}/products/${productId}`, { headers: getAuthHeaders() });
        Swal.fire({ icon: 'success', title: 'Removed!', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
        fetchStorefrontData();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to remove product', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const handleToggleProduct = async (productId) => {
    try {
      await axios.patch(`${BASE_URL}/api/storefront/agent/${userId}/products/${productId}/toggle`, {}, { headers: getAuthHeaders() });
      fetchStorefrontData();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to toggle product', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleSaveWhatsapp = async () => {
    if (!whatsappNumber.trim()) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please enter a WhatsApp link', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    
    const whatsappLinkRegex = /^(https?:\/\/)?(www\.)?(whatsapp\.com\/channel\/[a-zA-Z0-9]+|chat\.whatsapp\.com\/[a-zA-Z0-9]+)/i;
    if (!whatsappLinkRegex.test(whatsappNumber.trim())) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Link',
        text: 'Please enter a valid WhatsApp channel or group link (e.g., https://whatsapp.com/channel/ABC123 or https://chat.whatsapp.com/DEF456)',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }
    
    setSavingWhatsapp(true);
    try {
      const res = await axios.put(`${BASE_URL}/api/storefront/agent/${userId}/whatsapp`, {
        whatsappNumber: whatsappNumber.trim()
      }, { headers: getAuthHeaders() });
      if (res.data.success) {
        Swal.fire({ icon: 'success', title: 'Saved!', text: 'WhatsApp link updated successfully', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to save WhatsApp link', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please enter a valid amount', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    if (parseFloat(withdrawalAmount) < 10) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Minimum withdrawal amount is GHS 10', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    if ((parseFloat(withdrawalAmount) + 1) > walletBalance) {
      Swal.fire({ icon: 'error', title: 'Error', text: `Amount plus GHS 1 fee exceeds your wallet balance. You need at least GHS ${parseFloat(withdrawalAmount) + 1}`, background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    if (!withdrawalMobile.trim()) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please enter your mobile number for payout', background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    const fee = 1;
    const netPayout = parseFloat(withdrawalAmount);
    const totalDeduction = netPayout + fee;

    const result = await Swal.fire({
      title: 'Confirm Withdrawal',
      html: `
        <div style="text-align: left;">
          <p>Withdrawal Amount: <strong>GHS ${netPayout.toFixed(2)}</strong></p>
          <p>Fee (GHS 1): <strong style="color: #f59e0b;">GHS ${fee.toFixed(2)}</strong></p>
          <p>Total Deduction: <strong style="color: #ef4444;">GHS ${totalDeduction.toFixed(2)}</strong></p>
          <p>Wallet Balance After: <strong>GHS ${(walletBalance - totalDeduction).toFixed(2)}</strong></p>
          <hr style="border-color: #334155; margin: 8px 0;" />
          <p>You will receive <strong>GHS ${netPayout.toFixed(2)}</strong> via Mobile Money</p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Request',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (!result.isConfirmed) return;

    setRequestingWithdrawal(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/storefront/agent/${userId}/withdrawals`, {
        amount: parseFloat(withdrawalAmount),
        mobileNumber: withdrawalMobile.trim()
      }, { headers: getAuthHeaders() });
      if (res.data.success) {
        Swal.fire({ icon: 'success', title: 'Submitted!', text: 'Your withdrawal request has been submitted for processing', timer: 2000, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
        setWithdrawalAmount('');
        setWithdrawalMobile('');
        fetchWalletData();
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to submit withdrawal request', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setRequestingWithdrawal(false);
    }
  };

  const availableToAdd = availableProducts.filter(
    p => !storefrontProducts.some(sp => sp.productId === p.id)
  );

  const getStatusBadge = (status) => {
    const styles = {
      Pending: 'bg-amber-500/20 text-amber-400',
      Approved: 'bg-emerald-500/20 text-emerald-400',
      Rejected: 'bg-red-500/20 text-red-400'
    };
    return styles[status] || 'bg-dark-500/20 text-dark-400';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gradient-to-b from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col relative">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-fuchsia-500/5 to-cyan-500/5 animate-pulse"></div>
        
        {/* Header */}
        <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-5 sm:p-6 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
              <Store className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">My Storefront</h2>
              <p className="text-violet-100 text-xs sm:text-sm opacity-90">Manage products, wallet & commissions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => { fetchStorefrontData(); fetchReferralSummary(); fetchWalletData(); fetchOrderCounts(); }} 
              className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-all hover:scale-105 active:scale-95"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={onClose} 
              className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-all hover:scale-105 active:scale-95"
              title="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Store Link */}
        {storefrontSlug && (
          <div className="relative px-4 sm:px-6 py-4 bg-slate-900/50 border-b border-slate-700/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Link2 className="w-4 h-4" />
                <span className="text-sm font-medium">Your Store Link:</span>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm rounded-xl px-4 py-2.5 w-full sm:w-auto border border-slate-700/50">
                <span className="text-violet-400 text-sm truncate flex-1 font-mono">
                  {window.location.origin}/store/{storefrontSlug}
                </span>
                <button 
                  onClick={copyStoreLink} 
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105 active:scale-95"
                  title="Copy link"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
                <a 
                  href={`/store/${storefrontSlug}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105 active:scale-95"
                  title="Open store"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-900/30">
          <div className="group bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-violet-500/30 rounded-2xl p-4 hover:border-violet-500/50 transition-all hover:shadow-lg hover:shadow-violet-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-violet-400" />
              <p className="text-violet-300 text-xs font-medium uppercase tracking-wide">Products Listed</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{storefrontProducts.length}</p>
          </div>
          <div className="group bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-4 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-4 h-4 text-cyan-400" />
              <p className="text-cyan-300 text-xs font-medium uppercase tracking-wide">Total Orders</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{referralSummary.stats.totalOrders || 0}</p>
          </div>
          <div className="group bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 rounded-2xl p-4 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <p className="text-emerald-300 text-xs font-medium uppercase tracking-wide">Total Commission</p>
            </div>
            <p className="text-lg sm:text-xl font-bold text-emerald-400">{formatAmount(referralSummary.stats.totalCommission || 0)}</p>
          </div>
        </div>

        {/* Order Counts */}
        <div className="relative grid grid-cols-3 gap-3 sm:gap-4 px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-3.5 text-center hover:border-violet-500/30 transition-all">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">Today</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{orderCounts.today}</p>
          </div>
          <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-3.5 text-center hover:border-cyan-500/30 transition-all">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">This Month</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{orderCounts.month}</p>
          </div>
          <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-3.5 text-center hover:border-emerald-500/30 transition-all">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">This Year</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{orderCounts.year}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="relative border-b border-slate-700/50">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex p-4 gap-2 min-w-max">
              <div className="flex bg-slate-800/80 backdrop-blur-sm rounded-2xl p-1.5 border border-slate-700/50">
                {[
                  { id: 'products', label: 'Products', icon: Package },
                  { id: 'earnings', label: 'Earnings', icon: TrendingUp },
                  { id: 'orders', label: 'Orders', icon: ShoppingBag },
                  { id: 'wallet', label: 'Wallet', icon: Landmark },
                  { id: 'settings', label: 'Settings', icon: Settings }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'orders') fetchStorefrontOrders();
                      if (tab.id === 'wallet' || tab.id === 'settings') fetchWalletData();
                      setActiveTab(tab.id);
                    }}
                    className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                      activeTab === tab.id 
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative p-4 sm:p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
                <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse"></div>
              </div>
            </div>
          ) : activeTab === 'products' ? (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-violet-400" />
                    Your Products
                  </h3>
                  <p className="text-slate-500 text-sm mt-0.5">Manage your storefront products</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-violet-500/25 hover:scale-105 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              {storefrontProducts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full"></div>
                    <Package className="w-16 h-16 text-slate-600 mx-auto mb-4 relative" />
                  </div>
                  <p className="text-slate-400 font-medium">No products in your storefront yet</p>
                  <p className="text-slate-500 text-sm mt-2">Add products to start earning commissions</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storefrontProducts.map((sp) => (
                    <div 
                      key={sp.id} 
                      className={`group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border rounded-2xl p-5 transition-all hover:shadow-xl ${
                        sp.isActive 
                          ? 'border-slate-700/50 hover:border-violet-500/50 hover:shadow-violet-500/10' 
                          : 'border-slate-800/50 opacity-70'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-white font-semibold text-base">{sp.product.name}</h4>
                        <button 
                          onClick={() => handleToggleProduct(sp.id)} 
                          className="p-2 hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105 active:scale-95"
                          title={sp.isActive ? 'Hide' : 'Show'}
                        >
                          {sp.isActive ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                        </button>
                      </div>
                      <p className="text-slate-500 text-sm mb-4 line-clamp-2">{sp.product.description}</p>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-slate-500 text-xs">Base Price</p>
                            <p className="text-slate-400 text-sm font-medium">{formatAmount(sp.product.price)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-500 text-xs">Your Price</p>
                            <p className="text-violet-400 font-bold text-base">{formatAmount(sp.customPrice)}</p>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                          <p className="text-emerald-400 text-xs font-medium">Your Profit per Sale</p>
                          <p className="text-emerald-400 font-bold text-lg">{formatAmount(sp.customPrice - sp.product.price)}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setEditingProduct(sp); setEditPrice(sp.customPrice.toString()); }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit Price
                        </button>
                        <button 
                          onClick={() => handleRemoveProduct(sp.id)}
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all hover:scale-105 active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'earnings' ? (
            <div>
              <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Referral Earnings
              </h3>
              
              {referralSummary.orders.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full"></div>
                    <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4 relative" />
                  </div>
                  <p className="text-slate-400 font-medium">No referral orders yet</p>
                  <p className="text-slate-500 text-sm mt-2">Share your store link to start earning</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-700/50">
                  <table className="w-full">
                    <thead className="bg-slate-800/80">
                      <tr className="text-left">
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Date</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Product</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Commission</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {referralSummary.orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-4 text-slate-400 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-4 text-white font-medium">{order.product?.name}</td>
                          <td className="px-4 py-4 text-slate-400 text-sm">{order.customerName}</td>
                          <td className="px-4 py-4 text-cyan-400 font-medium">{formatAmount(order.agentPrice)}</td>
                          <td className="px-4 py-4 text-emerald-400 font-bold">{formatAmount(order.commission)}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                order.paymentStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                                order.paymentStatus === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {order.paymentStatus}
                              </span>
                              {order.commissionPaid && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-500/20 text-violet-400">
                                  ✓ Paid
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === 'orders' ? (
            <div>
              <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-cyan-400" />
                Storefront Orders
              </h3>
              
              {ordersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                </div>
              ) : storefrontOrders.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full"></div>
                    <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto mb-4 relative" />
                  </div>
                  <p className="text-slate-400 font-medium">No orders placed through your storefront yet</p>
                  <p className="text-slate-500 text-sm mt-2">Share your store link to start selling</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {storefrontOrders.map((ro) => (
                    <div key={ro.id} className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-5 hover:border-cyan-500/30 transition-all hover:shadow-lg hover:shadow-cyan-500/5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-white font-semibold text-base">{ro.productName}</p>
                          <p className="text-slate-500 text-sm">Order #{ro.order?.orderNumber || 'N/A'}</p>
                        </div>
                        <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-lg">{new Date(ro.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-slate-500 text-xs mb-1">Customer</p>
                          <p className="text-white text-sm font-medium truncate">{ro.customerName}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-slate-500 text-xs mb-1">Phone</p>
                          <p className="text-white text-sm font-medium">{ro.customerPhone}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-slate-500 text-xs mb-1">Amount</p>
                          <p className="text-cyan-400 text-sm font-bold">{formatAmount(ro.agentPrice)}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-slate-500 text-xs mb-1">Commission</p>
                          <p className={`text-sm font-bold ${ro.commissionPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {formatAmount(ro.commission)}
                            {ro.commissionPaid && ' ✓'}
                          </p>
                        </div>
                      </div>

                      {ro.order?.items && ro.order.items.length > 0 && (
                        <div className="border-t border-slate-700/50 pt-4 mt-4">
                          <p className="text-slate-500 text-xs mb-3 font-medium">Order Items Status</p>
                          <div className="flex flex-wrap gap-2">
                            {ro.order.items.map((item) => (
                              <span 
                                key={item.id} 
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                  item.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                  item.status === 'Processing' ? 'bg-cyan-500/20 text-cyan-400' :
                                  item.status === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {item.mobileNumber} - {item.status}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'wallet' ? (
            <div>
              {/* Wallet Balance Card */}
              <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 mb-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                
                <div className="relative flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-emerald-100 text-sm font-semibold">Storefront Wallet Balance</p>
                </div>
                <p className="relative text-3xl sm:text-4xl font-bold text-white mb-2">
                  {formatAmount(walletBalance)}
                </p>
                <p className="relative text-emerald-200 text-xs">Commissions are credited when order items are marked Completed</p>
              </div>

              {/* Withdrawal Form */}
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6 mb-6">
                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  Request Withdrawal
                </h4>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-5">
                  <p className="text-amber-400 text-sm">
                    <strong>Minimum withdrawal: GHS 10</strong> · A <strong>GHS 1 fee</strong> applies per withdrawal
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div>
                    <label className="block text-slate-400 text-sm mb-2.5 font-medium">Amount (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      max={walletBalance}
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2.5 font-medium">Mobile Money Number</label>
                    <input
                      type="text"
                      value={withdrawalMobile}
                      onChange={(e) => setWithdrawalMobile(e.target.value)}
                      placeholder="024XXXXXXX"
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={handleRequestWithdrawal} 
                      disabled={requestingWithdrawal || !withdrawalAmount || parseFloat(withdrawalAmount) < 10 || (parseFloat(withdrawalAmount) + 1) > walletBalance}
                      className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-105 active:scale-95"
                    >
                      {requestingWithdrawal ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4" />
                          Withdraw
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Withdrawal History */}
              <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Withdrawal History
              </h4>
              {withdrawals.length === 0 ? (
                <div className="text-center py-12">
                  <Landmark className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No withdrawal requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-700/50">
                  <table className="w-full">
                    <thead className="bg-slate-800/80">
                      <tr className="text-left">
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Date</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Mobile</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Status</th>
                        <th className="px-4 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-4 text-slate-400 text-sm">{new Date(w.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-4 text-white font-semibold">{formatAmount(w.amount)}</td>
                          <td className="px-4 py-4 text-slate-400 text-sm">{w.mobileNumber}</td>
                          <td className="px-4 py-4">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusBadge(w.status)}`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-500 text-sm">{w.adminNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Settings Tab */
            <div>
              <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Storefront Settings
              </h3>

              {/* WhatsApp Configuration */}
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                    <MessageCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">WhatsApp Channel/Group Link</h4>
                    <p className="text-slate-500 text-sm">Share your WhatsApp channel or group link for customer support</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-slate-400 text-sm mb-2.5 font-medium">WhatsApp Link</label>
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="https://whatsapp.com/channel/... or https://chat.whatsapp.com/..."
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                    <p className="text-slate-500 text-xs mt-2">Enter your WhatsApp channel or group link (e.g., https://whatsapp.com/channel/ABC123 or https://chat.whatsapp.com/DEF456)</p>
                  </div>
                  <button 
                    onClick={handleSaveWhatsapp} 
                    disabled={savingWhatsapp}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2 hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-105 active:scale-95"
                  >
                    {savingWhatsapp ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>

                {whatsappNumber && (
                  <div className="mt-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-emerald-400 text-sm font-semibold">WhatsApp link is active</p>
                      <p className="text-emerald-300 text-xs">Customers will see a WhatsApp contact button on your storefront</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Store Link Card */}
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-violet-500/20 rounded-xl">
                    <Link2 className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Your Store URL</h4>
                    <p className="text-slate-500 text-sm">Share this link with customers</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl px-4 py-3.5 border border-slate-700/50">
                  <span className="text-violet-400 text-sm truncate flex-1 font-mono">
                    {window.location.origin}/store/{storefrontSlug || '...'}
                  </span>
                  <button 
                    onClick={copyStoreLink} 
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105 active:scale-95"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal - Card Grid */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/30 to-slate-900/90 backdrop-blur-sm flex items-end sm:items-center justify-center z-60 p-0 sm:p-4">
          <div className="bg-gradient-to-b from-slate-800/95 to-slate-900/95 backdrop-blur-xl border-t sm:border border-slate-700/50 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-5 sm:p-6 flex items-center justify-between shadow-lg sticky top-0 z-10">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Add Product to Storefront</h3>
                <p className="text-violet-100 text-xs sm:text-sm mt-1 opacity-90">Select a product to add</p>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); setSelectedProduct(null); setCustomPrice(''); }}
                className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-all hover:scale-105 active:scale-95"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Products Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {availableToAdd.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full"></div>
                    <Package className="w-16 h-16 text-slate-600 mx-auto mb-4 relative" />
                  </div>
                  <p className="text-slate-400 font-medium text-sm sm:text-base">No products available to add</p>
                  <p className="text-slate-500 text-xs sm:text-sm mt-2">All available products are already in your storefront</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableToAdd.map(product => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product);
                        setCustomPrice(product.price.toString());
                      }}
                      className={`group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl ${
                        selectedProduct?.id === product.id 
                          ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20 scale-[1.02]' 
                          : 'border-slate-700/50 hover:border-violet-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold text-sm sm:text-base mb-1.5">{product.name}</h4>
                          <p className="text-slate-500 text-xs sm:text-sm line-clamp-2">{product.description}</p>
                        </div>
                        {selectedProduct?.id === product.id && (
                          <div className="ml-2 p-1.5 bg-violet-500 rounded-full animate-scale-in">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3 sm:p-3.5">
                        <p className="text-slate-500 text-xs mb-1">Base Price</p>
                        <p className="text-violet-400 font-bold text-base sm:text-lg">{formatAmount(product.price)}</p>
                      </div>
                      {product.stock > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div>
                          <span className="text-emerald-400 text-xs font-medium">In Stock ({product.stock})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Section - Price Input & Add Button */}
            {selectedProduct && (
              <div className="relative border-t border-slate-700/50 bg-slate-900/80 backdrop-blur p-4 sm:p-6 sticky bottom-0 z-10">
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-5 mb-5 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-white font-medium text-sm sm:text-base">{selectedProduct.name}</p>
                        <p className="text-slate-500 text-xs sm:text-sm">Base: {formatAmount(selectedProduct.price)}</p>
                      </div>
                      <button 
                        onClick={() => { setSelectedProduct(null); setCustomPrice(''); }}
                        className="p-2 hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105 active:scale-95"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-slate-400 text-xs sm:text-sm mb-2.5 font-medium">Your Selling Price (GHS)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm sm:text-base focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                        placeholder="Enter your price"
                      />
                    </div>

                    {parseFloat(customPrice) >= selectedProduct.price && (
                      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4">
                        <p className="text-emerald-400 text-xs sm:text-sm font-medium">Your Commission per Sale</p>
                        <p className="text-emerald-400 font-bold text-lg sm:text-xl">{formatAmount(parseFloat(customPrice) - selectedProduct.price)}</p>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleAddProduct} 
                    disabled={addingProduct || !customPrice || parseFloat(customPrice) < selectedProduct.price}
                    className="w-full px-4 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white rounded-xl font-semibold text-sm sm:text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 hover:scale-105 active:scale-95"
                  >
                    {addingProduct ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add to Storefront
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Price Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/30 to-slate-900/90 flex items-center justify-center z-60 p-4">
          <div className="bg-gradient-to-b from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-white mb-4">Edit Price</h3>
            
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 mb-5 border border-slate-700/50">
              <p className="text-white font-medium">{editingProduct.product.name}</p>
              <p className="text-slate-500 text-sm">Base Price: {formatAmount(editingProduct.product.price)}</p>
            </div>

            <div className="mb-5">
              <label className="block text-slate-400 text-sm mb-2.5 font-medium">New Selling Price (GHS)</label>
              <input
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>

            {parseFloat(editPrice) >= editingProduct.product.price && (
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4 mb-5">
                <p className="text-emerald-400 text-sm font-medium">Your Commission per Sale</p>
                <p className="text-emerald-400 font-bold text-lg">{formatAmount(parseFloat(editPrice) - editingProduct.product.price)}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => { setEditingProduct(null); setEditPrice(''); }}
                className="flex-1 px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdatePrice}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-violet-500/25 hover:scale-105 active:scale-95"
              >
                Update Price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Storefront;
