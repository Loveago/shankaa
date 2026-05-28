import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import getSocket from '../utils/socket';
import Swal from 'sweetalert2';
import { Menu, Wallet, Package, Clock, CheckCircle, ShoppingCart, Loader2, RefreshCw, Trash2, Shield, History, X, Banknote } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import Sidebar from '../components/Sidebar';
import TopUp from '../components/TopUp';
import OrderHistory from '../components/OrderHistory';
import AgentNotifications from '../components/AgentNotifications';
import TransactionsModal from '../components/TransactionsModal';
import UploadExcel from '../components/UploadExcel';
import PasteOrders from '../components/PasteOrders';
import Storefront from '../components/Storefront';
import FloatingChatButton from '../components/FloatingChatButton';

const SuperAgent = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loanBalance, setLoanBalance] = useState({ loanBalance: 0, adminLoanBalance: 0, hasLoan: false });
  const [isLoading, setIsLoading] = useState(true);
  const [mobileNumbers, setMobileNumbers] = useState({});
  const [errors, setErrors] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgress = useRef(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showUploadExcel, setShowUploadExcel] = useState(false);
  const [showPasteOrders, setShowPasteOrders] = useState(false);
  const [showStorefront, setShowStorefront] = useState(false);
  const [isSuspended, setIsSuspended] = useState(localStorage.getItem('isSuspended') === 'true');

  const userName = localStorage.getItem('name') || 'Super Agent';
  const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchLoanBalance = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    try {
      const response = await axios.get(`${BASE_URL}/api/users/loan/${userId}`, { headers: getAuthHeaders() });
      // Defensive: only overwrite state when the response actually contains wallet data
      // Prevents wallet vanishing to 0 if an intermittent response returns an empty/invalid body
      if (response?.data && (response.data.loanBalance !== undefined || response.data.id !== undefined)) {
        setLoanBalance(response.data);
      }
    } catch (err) {
      console.error('Error fetching loan balance:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/products/agent-products`, { headers: getAuthHeaders() });
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  const fetchCart = useCallback(async () => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await axios.get(`${BASE_URL}/api/cart/${userId}`, { headers: getAuthHeaders() });
      setCart(Array.isArray(response.data.items) ? response.data.items : []);
    } catch (error) {
      setCart([]);
    }
  }, []);

  const fetchOrderHistory = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    try {
      const response = await axios.get(`${BASE_URL}/order/admin/${userId}`, { headers: getAuthHeaders() });
      setOrderHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching order history:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchProducts(), fetchLoanBalance(), fetchCart(), fetchOrderHistory()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProducts, fetchLoanBalance, fetchCart, fetchOrderHistory]);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'SUPER') navigate('/login');
    fetchData();
    const userId = localStorage.getItem('userId');
    if (userId) {
      axios.get(`${BASE_URL}/api/users/${userId}`, { headers: getAuthHeaders() }).then(res => {
        const suspended = res.data?.isSuspended === true;
        setIsSuspended(suspended);
        localStorage.setItem('isSuspended', suspended ? 'true' : 'false');
      }).catch(() => {});
    }
    const interval = setInterval(fetchLoanBalance, 60000);
    return () => clearInterval(interval);
  }, [fetchData, fetchLoanBalance, navigate]);

  // Listen for real-time product stock updates
  useEffect(() => {
    const socket = getSocket();
    socket.on('product:stock-update', fetchProducts);
    return () => socket.off('product:stock-update', fetchProducts);
  }, [fetchProducts]);

  useEffect(() => {
    if (showHistory) {
      fetchOrderHistory();
      const interval = setInterval(fetchOrderHistory, 20000);
      return () => clearInterval(interval);
    }
  }, [showHistory, fetchOrderHistory]);

  const handleCategorySelect = (category) => setSelectedCategory(category);

  const filteredProducts = useMemo(() => {
    const allowedPrefixes = ['MTN - SUPER', 'TELECEL - SUPER', 'AIRTEL TIGO - SUPER'];
    const nameOrder = { 'MTN - SUPER': 0, 'TELECEL - SUPER': 1, 'AIRTEL TIGO - SUPER': 2 };
    let filtered = (Array.isArray(products) ? products : []).filter(p => allowedPrefixes.some(prefix => p.name?.startsWith(prefix)));
    if (selectedCategory) {
      // Map category selection to SUPER tagged version
      const superCategory = selectedCategory === 'MTN' ? 'MTN - SUPER'
        : selectedCategory === 'TELECEL' ? 'TELECEL - SUPER'
        : selectedCategory === 'AIRTEL TIGO' ? 'AIRTEL TIGO - SUPER'
        : selectedCategory;
      filtered = filtered.filter(p => p.name?.startsWith(superCategory));
    }
    // Sort: in-stock first, then by name (MTN first) and description
    return filtered.sort((a, b) => {
      if ((a.stock > 0) !== (b.stock > 0)) return b.stock > 0 ? 1 : -1;
      if (a.name !== b.name) return (nameOrder[a.name] ?? 99) - (nameOrder[b.name] ?? 99);
      return parseFloat(a.description?.match(/\d+/)?.[0] || 0) - parseFloat(b.description?.match(/\d+/)?.[0] || 0);
    });
  }, [products, selectedCategory]);

  const validPrefixes = ['024', '025', '053', '054', '055', '059', '020', '050', '027', '057', '026', '056', '028'];
  
  const validatePhoneNumber = (phone) => {
    if (!phone || phone.length !== 10) return false;
    const prefix = phone.substring(0, 3);
    return validPrefixes.includes(prefix);
  };

  const handleMobileNumberChange = (productId, value) => {
    if (/^\d{0,10}$/.test(value)) {
      setErrors(prev => ({ ...prev, [productId]: '' }));
      setMobileNumbers(prev => ({ ...prev, [productId]: value }));
    }
  };

  const addingToCartRef = useRef(false);

  const addToCart = async (productId) => {
    if (addingToCartRef.current) return;
    addingToCartRef.current = true;
    const product = filteredProducts.find(p => p.id === productId);
    if (!product) { addingToCartRef.current = false; return; }
    const mobileNumber = mobileNumbers[productId] || '';
    if (!mobileNumber.trim() || mobileNumber.length !== 10) {
      setErrors(prev => ({ ...prev, [productId]: 'Enter valid 10-digit number' }));
      addingToCartRef.current = false;
      return;
    }
    
    if (!validatePhoneNumber(mobileNumber)) {
      setErrors(prev => ({ ...prev, [productId]: 'Invalid prefix. Use 024, 054, 055, 059, 020, 050, 027, 057, 026, 056, 028' }));
      addingToCartRef.current = false;
      return;
    }

    // Check for duplicate: same product and same mobile number already in cart
    const duplicate = cart.find(item => item.product?.id === productId && item.mobileNumber === mobileNumber);
    if (duplicate) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Duplicate Item',
        html: `<b>${product.name}</b> for <b>${mobileNumber}</b> is already in your cart.<br/>Do you want to add it again?`,
        showCancelButton: true,
        confirmButtonText: 'Yes, Add Again',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#6366f1',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      if (!result.isConfirmed) { addingToCartRef.current = false; return; }
    }

    const currentBalance = Math.abs(parseFloat(loanBalance?.loanBalance || 0));
    const getEffectivePrice = (p) => (p.usePromoPrice && p.promoPrice != null) ? p.promoPrice : p.price;
    const currentCartTotal = cart.reduce((total, item) => total + (getEffectivePrice(item.product || {}) || 0) * (item.quantity || 1), 0);
    if (currentCartTotal + getEffectivePrice(product) > currentBalance) {
      Swal.fire({ icon: 'warning', title: 'Insufficient Balance', background: '#1e293b', color: '#f1f5f9' });
      addingToCartRef.current = false;
      return;
    }
    try {
      const userId = parseInt(localStorage.getItem('userId'), 10);
      await axios.post(`${BASE_URL}/api/cart/add`, { userId, productId, quantity: 1, mobileNumber }, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      Swal.fire({ icon: 'success', title: 'Added!', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
      fetchCart();
      setMobileNumbers(prev => ({ ...prev, [productId]: '' }));
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'Failed to add to cart', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      addingToCartRef.current = false;
    }
  };

  const removeFromCart = async (cartItemId) => {
    const result = await Swal.fire({ title: 'Remove?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9' });
    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/cart/remove/${cartItemId}`, { headers: getAuthHeaders() });
        setCart(prev => prev.filter(item => item.id !== cartItemId));
      } catch (error) {}
    }
  };

  const clearCart = async () => {
    const userId = localStorage.getItem('userId');
    const result = await Swal.fire({ title: 'Clear Cart?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9' });
    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/cart/${userId}/clear`, { headers: getAuthHeaders() });
        setCart([]);
      } catch (error) {}
    }
  };

  const cartTotal = cart.reduce((sum, item) => {
    const p = item.product || {};
    const effectivePrice = (p.usePromoPrice && p.promoPrice != null) ? p.promoPrice : (p.price || 0);
    return sum + effectivePrice * (item.quantity || 1);
  }, 0);

  const submitCart = async () => {
    if (isSubmitting || submitInProgress.current) return;
    submitInProgress.current = true;
    const userId = parseInt(localStorage.getItem('userId'), 10);
    const freshBalance = Math.abs(parseFloat(loanBalance?.loanBalance || 0));
    if (cartTotal > freshBalance) {
      submitInProgress.current = false;
      Swal.fire({ icon: 'warning', title: 'Insufficient Funds', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    setIsSubmitting(true);
    setShowCart(false);
    setCart([]);
    axios.post(`${BASE_URL}/order/submit`, { userId, expectedBalance: freshBalance, totalAmount: cartTotal }, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(() => {
      Swal.fire({ icon: 'success', title: 'Order Submitted!', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
      fetchCart(); fetchLoanBalance();
    }).catch((error) => {
      Swal.fire({ icon: 'error', title: 'Order Failed', text: error.response?.data?.message || 'Failed to submit order.', background: '#1e293b', color: '#f1f5f9' });
      fetchCart(); fetchLoanBalance();
    }).finally(() => {
      setIsSubmitting(false);
      submitInProgress.current = false;
    });
  };

  const logoutUser = async () => {
    try { await axios.post(`${BASE_URL}/api/auth/logout`, { userId: localStorage.getItem('userId') }); } catch (e) {}
    localStorage.clear(); navigate('/login');
  };

  const balance = Math.abs(parseFloat(loanBalance?.loanBalance || 0));

  return (
    <div className="min-h-screen bg-dark-950">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        selectedCategory={selectedCategory} 
        handleCategorySelect={handleCategorySelect} 
        logoutUser={logoutUser}
        onOpenTransactions={() => setShowTransactions(true)}
        onOpenUploadExcel={() => setShowUploadExcel(true)}
        onOpenPasteOrders={() => setShowPasteOrders(true)}
        onOpenStorefront={() => setShowStorefront(true)}
        isSuspended={isSuspended}
      />
      <div className="md:ml-72">
        <header className="bg-dark-900/80 backdrop-blur border-b border-dark-700 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-dark-800 rounded-xl"><Menu className="w-6 h-6 text-dark-300" /></button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl"><Shield className="w-5 h-5 text-white" /></div>
                  <div className="hidden sm:block"><h1 className="text-xl font-bold text-white">Super Agent</h1><p className="text-dark-400 text-sm">Welcome, {userName}</p></div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <AgentNotifications />
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Wallet className="w-4 h-4 text-emerald-500" /><span className="text-white font-semibold text-sm">GHS {balance.toFixed(2)}</span>
                </div>
                <button onClick={() => setShowTopUp(true)} className="hidden sm:block px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold text-sm">Top Up</button>
                <button onClick={() => setShowHistory(true)} className="p-2.5 sm:p-3 bg-dark-800 hover:bg-dark-700 rounded-xl"><History className="w-5 h-5 text-dark-400" /></button>
                <button onClick={() => setShowCart(true)} className="relative p-2.5 sm:p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl shadow-lg">
                  <ShoppingCart className="w-5 h-5 text-white" />
                  {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center animate-pulse">{cart.length}</span>}
                </button>
              </div>
            </div>
            <div className="sm:hidden mt-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-xl p-4 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-xs">Wallet Balance</p>
                  <p className="text-xl font-bold text-white">GHS {balance.toFixed(2)}</p>
                  {loanBalance?.hasLoan && <p className="text-red-400 text-xs animate-pulse">Loan: GHS {parseFloat(loanBalance?.adminLoanBalance || 0).toFixed(2)}</p>}
                </div>
                <button onClick={() => setShowTopUp(true)} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold text-sm">Top Up</button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {isSuspended && (
            <div className="flex flex-col items-center justify-center py-20 sm:py-32">
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 sm:p-12 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-red-400 mb-2">Account Suspended</h2>
                <p className="text-dark-400 text-sm">Your account has been suspended. Please contact the administrator for assistance.</p>
              </div>
            </div>
          )}
          {!isSuspended && <>
          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-emerald-500/10 backdrop-blur rounded-xl sm:rounded-2xl border border-emerald-500/20 p-3 sm:p-4">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mb-1 sm:mb-2" />
              <p className="text-lg sm:text-2xl font-bold text-white">GHS {balance.toFixed(2)}</p>
              <p className="text-dark-400 text-xs sm:text-sm">Balance</p>
              {loanBalance?.hasLoan && <p className="text-red-400 text-xs mt-1 animate-pulse flex items-center gap-1"><Banknote className="w-3 h-3" /> Loan: GHS {parseFloat(loanBalance?.adminLoanBalance || 0).toFixed(2)}</p>}
            </div>
            <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-3 sm:p-4"><Package className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 mb-1 sm:mb-2" /><p className="text-lg sm:text-2xl font-bold text-white">{filteredProducts.length}</p><p className="text-dark-400 text-xs sm:text-sm">Products</p></div>
            <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-3 sm:p-4 cursor-pointer active:scale-95 hover:border-amber-500/30 transition-transform" onClick={() => setShowHistory(true)}><Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 mb-1 sm:mb-2" /><p className="text-lg sm:text-2xl font-bold text-white">{orderHistory.flatMap(o => o.items || []).filter(i => i.status === 'Pending').length}</p><p className="text-dark-400 text-xs sm:text-sm">Pending</p></div>
            <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-3 sm:p-4 cursor-pointer active:scale-95 hover:border-emerald-500/30 transition-transform" onClick={() => setShowHistory(true)}><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mb-1 sm:mb-2" /><p className="text-lg sm:text-2xl font-bold text-white">{orderHistory.flatMap(o => o.items || []).filter(i => i.status === 'Completed').length}</p><p className="text-dark-400 text-xs sm:text-sm">Completed</p></div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
            {['All', 'MTN', 'TELECEL', 'AIRTEL TIGO'].map((cat) => (
              <button key={cat} onClick={() => handleCategorySelect(cat === 'All' ? null : cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${(cat === 'All' && !selectedCategory) || selectedCategory === cat ? cat === 'MTN' ? 'bg-yellow-500 text-white' : cat === 'TELECEL' ? 'bg-red-500 text-white' : cat === 'AIRTEL TIGO' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'}`}>
                {cat === 'AIRTEL TIGO' ? 'AirtelTigo' : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-white">{selectedCategory || 'All'} Products <span className="text-dark-400 text-xs sm:text-sm font-normal">({filteredProducts.length})</span></h2>
            <button onClick={fetchData} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700"><RefreshCw className={`w-5 h-5 text-dark-400 ${isLoading ? 'animate-spin' : ''}`} /></button>
          </div>

          {isLoading ? <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div> : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20"><Package className="w-16 h-16 text-dark-600 mb-4" /><h3 className="text-lg font-semibold text-dark-400">No products available</h3></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredProducts.map((product) => {
                const isMTN = product.name?.includes('MTN');
                const isTelecel = product.name?.includes('TELECEL');
                const isAirtelTigo = product.name?.includes('AIRTEL');
                const cardGradient = isMTN ? 'from-yellow-500 to-amber-600' : isTelecel ? 'from-red-500 to-rose-600' : isAirtelTigo ? 'from-blue-500 to-indigo-600' : 'from-emerald-500 to-green-600';
                const buttonColor = isMTN ? 'from-yellow-600 to-yellow-700' : isTelecel ? 'from-red-600 to-red-700' : isAirtelTigo ? 'from-blue-600 to-blue-700' : 'from-emerald-600 to-emerald-700';
                return (
                  <div key={product.id} className={`relative overflow-hidden rounded-xl sm:rounded-2xl shadow-lg bg-gradient-to-br ${cardGradient} ${product.stock === 0 ? 'opacity-75' : ''}`}>
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm transform -rotate-12 shadow-lg">OUT OF STOCK</span>
                      </div>
                    )}
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium text-white">{product.name}</span>
                        {product.stock === 0 && <span className="text-xs text-red-300 font-semibold">Out of Stock</span>}
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{product.description}</h3>
                      <div className="flex items-baseline gap-1 mb-3 sm:mb-4"><span className="text-xs sm:text-sm text-white/70">GHS</span><span className="text-xl sm:text-2xl font-bold text-white">{(product.usePromoPrice && product.promoPrice != null) ? product.promoPrice : product.price}</span></div>
                      <div className="space-y-2">
                        <input type="tel" inputMode="numeric" placeholder="Enter mobile number" value={mobileNumbers[product.id] || ''} onChange={(e) => handleMobileNumberChange(product.id, e.target.value)}
                          className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/90 backdrop-blur-sm border-2 ${errors[product.id] ? 'border-red-400' : 'border-transparent'} rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none text-base`} maxLength={10} />
                        {errors[product.id] && <p className="text-xs text-white font-medium px-2">{errors[product.id]}</p>}
                      </div>
                      <button onClick={() => addToCart(product.id)} disabled={balance === 0 || product.stock === 0 || (mobileNumbers[product.id] || '').length !== 10}
                        className={`mt-3 sm:mt-4 w-full py-2.5 sm:py-3 px-4 rounded-xl font-semibold text-white transition-all active:scale-95 ${balance === 0 || product.stock === 0 || (mobileNumbers[product.id] || '').length !== 10 ? 'bg-white/20 cursor-not-allowed' : `bg-gradient-to-r ${buttonColor} shadow-lg hover:shadow-xl`}`}>
                        {balance === 0 ? 'Insufficient Balance' : product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                  </div>
                );
              })}
            </div>
          )}
          </>}
        </main>
      </div>

      <TopUp isOpen={showTopUp} onClose={() => { setShowTopUp(false); fetchLoanBalance(); }} onSuccess={fetchLoanBalance} />
      <OrderHistory isOpen={showHistory} onClose={() => setShowHistory(false)} orderHistory={orderHistory} onOrderCancelled={() => { fetchOrderHistory(); fetchLoanBalance(); }} />
      <TransactionsModal isOpen={showTransactions} onClose={() => setShowTransactions(false)} />
      <UploadExcel isOpen={showUploadExcel} onClose={() => setShowUploadExcel(false)} onUploadSuccess={fetchData} />
      <PasteOrders isOpen={showPasteOrders} onClose={() => setShowPasteOrders(false)} onUploadSuccess={fetchData} />

      {showCart && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-4 sm:p-6 flex justify-between items-center">
              <div className="flex items-center gap-3"><div className="p-2 bg-white/10 rounded-xl"><ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></div><div><h2 className="text-lg sm:text-xl font-bold text-white">Shopping Cart</h2><p className="text-emerald-100 text-xs sm:text-sm">{cart.length} items</p></div></div>
              <button onClick={() => setShowCart(false)} className="p-2.5 bg-white/20 hover:bg-white/30 rounded-lg active:scale-95 transition-transform"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[45vh] sm:max-h-[50vh]">
              {cart.length === 0 ? <div className="flex flex-col items-center py-12"><ShoppingCart className="w-16 h-16 text-dark-600 mb-4" /><h3 className="text-lg font-semibold text-dark-400">Your cart is empty</h3></div> : (
                <div className="space-y-2 sm:space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-dark-900/50 rounded-xl border border-dark-700">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.product?.name?.includes('MTN') ? 'bg-yellow-500/20' : item.product?.name?.includes('TELECEL') ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                        <span className="text-base sm:text-lg font-bold text-white">{item.product?.name?.includes('MTN') ? 'M' : item.product?.name?.includes('TELECEL') ? 'T' : 'A'}</span>
                      </div>
                      <div className="flex-1 min-w-0"><h3 className="font-semibold text-white text-sm sm:text-base truncate">{item.product?.name} - {item.product?.description}</h3><p className="text-dark-400 text-xs sm:text-sm">{item.mobileNumber}</p><p className="text-dark-300 text-xs sm:text-sm font-medium">GHS {(item.product?.usePromoPrice && item.product?.promoPrice != null) ? item.product.promoPrice : item.product?.price}</p></div>
                      <button onClick={() => removeFromCart(item.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg active:scale-95 transition-transform flex-shrink-0"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 sm:p-6 border-t border-dark-700 bg-dark-900/50">
                <div className="flex justify-between items-center mb-3 sm:mb-4"><span className="text-dark-400 text-sm sm:text-base">Total Amount</span><span className="text-xl sm:text-2xl font-bold text-white">GHS {cartTotal.toFixed(2)}</span></div>
                <div className="flex gap-2 sm:gap-3">
                  <button onClick={clearCart} className="flex-1 px-3 sm:px-4 py-3 bg-dark-700 hover:bg-dark-600 text-dark-300 font-semibold rounded-xl active:scale-95 text-sm sm:text-base">Clear All</button>
                  <button onClick={submitCart} disabled={isSubmitting || cart.length === 0} className="flex-1 px-3 sm:px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 active:scale-95 text-sm sm:text-base">
                    {isSubmitting ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Processing...</span> : 'Submit Order'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Storefront Modal */}
      <Storefront
        isOpen={showStorefront}
        onClose={() => setShowStorefront(false)}
        userId={localStorage.getItem('userId')}
      />

      {/* Floating Chat */}
      <FloatingChatButton currentUser={{ id: parseInt(localStorage.getItem('userId')), name: localStorage.getItem('name'), role: 'SUPER' }} />
    </div>
  );
};

export default SuperAgent;
