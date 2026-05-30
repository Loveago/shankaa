import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Package, Loader2, Phone, XCircle, Shield, X, Filter, Wifi, Zap, Star, ArrowRight, Search, MessageSquareWarning, CheckCircle, Clock, BadgeCheck } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import ComplaintModal from '../components/ComplaintModal';
import ShopFloatingChatButton from '../components/ShopFloatingChatButton';

const PublicStorefront = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Purchase flow
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Tracking and Complaints
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingMode, setTrackingMode] = useState('phone'); // 'phone' | 'order'
  const [trackedOrders, setTrackedOrders] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  
  // Prevent duplicate payment verification
  const verifiedRefsRef = React.useRef(new Set());

  const fetchStorefront = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${BASE_URL}/api/storefront/public/${slug}`);
      if (res.data.success) {
        setStorefront(res.data);
      } else {
        setError('Storefront not found');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Storefront not found');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const verifyPayment = useCallback(async (reference) => {
    try {
      Swal.fire({
        title: 'Verifying Payment',
        text: 'Please wait...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        background: '#1e293b',
        color: '#f1f5f9'
      });

      const res = await axios.post(`${BASE_URL}/api/storefront/verify`, { reference });
      
      if (res.data.success) {
        const orderNum = res.data?.order?.orderNumber || `#${res.data?.order?.id || 'N/A'}`;
        await Swal.fire({
          icon: 'success',
          title: 'Payment Successful',
          html: `<p>Your order has been created.</p><p><strong>Receipt:</strong> Order ${orderNum}</p><p>Save this number to track your order.</p>`,
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        // Redirect back to storefront after receipt acknowledgement
        window.location.href = `/store/${slug}`;
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: res.data.message || 'Payment could not be verified',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Could not verify payment.',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    }
  }, [slug]);

  useEffect(() => {
    fetchStorefront();
  }, [fetchStorefront]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const reference = searchParams.get('reference');
    if (payment === 'callback' && reference) {
      // Prevent duplicate verification of the same reference
      if (!verifiedRefsRef.current.has(reference)) {
        verifiedRefsRef.current.add(reference);
        verifyPayment(reference);
      }
      window.history.replaceState({}, '', `/store/${slug}`);
    }
  }, [searchParams, slug, verifyPayment]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!storefront?.products) return [];
    
    const filtered = activeFilter === 'all' ? [...storefront.products] : storefront.products.filter((product) => {
      const upperName = product.name?.toUpperCase() || '';
      if (activeFilter === 'mtn') return upperName.includes('MTN');
      if (activeFilter === 'airtel') return upperName.includes('AIRTEL') || upperName.includes('TIGO');
      if (activeFilter === 'telecel') return upperName.includes('TELECEL') || upperName.includes('VODAFONE');
      return true;
    });

    const getNetworkPriority = (name) => {
      const upperName = name?.toUpperCase() || '';
      if (upperName.includes('MTN')) return 1;
      if (upperName.includes('TELECEL') || upperName.includes('VODAFONE')) return 2;
      if (upperName.includes('AIRTEL') || upperName.includes('TIGO')) return 3;
      return 4;
    };

    const parseBundleSize = (text) => {
      if (!text) return Number.MAX_SAFE_INTEGER;
      const match = text.match(/([\d.]+)\s*(gb|mb|g|m)/i);
      if (!match) return Number.MAX_SAFE_INTEGER;
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      return value * (unit.startsWith('g') ? 1024 : 1);
    };

    return filtered.sort((a, b) => {
      const networkDiff = getNetworkPriority(a.name) - getNetworkPriority(b.name);
      if (networkDiff !== 0) return networkDiff;
      return parseBundleSize(a.description) - parseBundleSize(b.description);
    });
  }, [storefront?.products, activeFilter]);

  const getCarrierGradient = (name) => {
    const upperName = name?.toUpperCase() || '';
    if (upperName.includes('MTN')) return 'from-yellow-500 to-amber-600';
    if (upperName.includes('TELECEL') || upperName.includes('VODAFONE')) return 'from-red-500 to-rose-600';
    if (upperName.includes('AIRTEL') || upperName.includes('TIGO')) return 'from-blue-500 to-indigo-600';
    return 'from-dark-600 to-dark-700';
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setMobileNumber('');
    setProcessing(false);
  };

  const validPrefixes = ['024', '025', '053', '054', '055', '059', '020', '050', '027', '057', '026', '056', '028'];
  
  const validatePhoneNumber = (phone) => {
    if (!phone || phone.length !== 10) return false;
    const prefix = phone.substring(0, 3);
    return validPrefixes.includes(prefix);
  };

  const handlePurchase = async () => {
    if (!mobileNumber || mobileNumber.length !== 10) {
      Swal.fire({
        title: 'Invalid Number',
        text: 'Please enter a valid mobile number (10 digits)',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }
    
    if (!validatePhoneNumber(mobileNumber)) {
      Swal.fire({
        title: 'Invalid Number Format',
        text: 'Number must start with a valid prefix (024, 054, 055, 059, 020, 050, 027, 057, 026, 056, 028)',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/storefront/public/${slug}/pay`, {
        storefrontProductId: selectedProduct.id,
        customerName: storefront?.agent?.name || 'Customer',
        customerPhone: mobileNumber.trim()
      });

      if (res.data.success && res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: res.data.message || 'Could not initialize payment',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to process order',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setProcessing(false);
    }
  };

  const trackOrder = async () => {
    const value = trackingNumber.trim();
    const cleaned = value.replace(/\s+/g, '');

    if (trackingMode === 'phone') {
      const digitsOnly = cleaned.replace(/\D/g, '');
      if (digitsOnly.length < 9) {
        Swal.fire({
          title: 'Invalid Number',
          text: 'Please enter a valid mobile number',
          icon: 'warning',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        return;
      }
    } else {
      if (cleaned.length < 5) {
        Swal.fire({
          title: 'Invalid Order Number',
          text: 'Please enter a valid order number (e.g. GHJUL24123456)',
          icon: 'warning',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        return;
      }
    }

    setIsTracking(true);
    try {
      const params = trackingMode === 'phone'
        ? { mobileNumber: cleaned.replace(/\D/g, '') }
        : { orderNumber: cleaned.toUpperCase() };

      const response = await axios.get(`${BASE_URL}/api/shop/track`, { params });
      setTrackedOrders(response.data.orders || []);
      if (response.data.orders?.length === 0) {
        Swal.fire({
          title: 'No Orders Found',
          text: trackingMode === 'phone' ? 'No orders found for this mobile number.' : 'No orders found for this order number.',
          icon: 'info',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
      }
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: 'Failed to track order.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    } finally {
      setIsTracking(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'processing': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'cancelled': case 'canceled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-dark-700 text-dark-300 border-dark-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <Clock className="w-4 h-4" />;
      case 'pending': return <Package className="w-4 h-4" />;
      case 'cancelled': case 'canceled': return <XCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-4 border-dark-700 border-t-cyan-500 animate-spin"></div>
          <p className="mt-6 text-dark-400 font-medium">Loading store...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex p-6 bg-dark-800 rounded-full mb-6">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Store Not Found</h1>
          <p className="text-dark-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur border-b border-dark-800/80 bg-dark-950/70">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-bold">{storefront?.agent?.name}'s Store</h1>
                  <BadgeCheck className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowComplaintModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-300 font-medium transition-all active:scale-95"
              >
                <MessageSquareWarning className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Support</span>
              </button>
              <button
                onClick={() => setShowTrackingModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-xl text-white text-sm sm:text-base font-semibold shadow-lg shadow-emerald-500/25 hover:from-cyan-600 hover:to-emerald-600 transition-all active:scale-95"
              >
                <Search className="w-4 h-4" />
                <span>Track Order</span>
              </button>
            </div>
          </div>
        </div>
      </nav>


      {/* Main Content */}
      <main id="products-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Filter Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 p-6 bg-dark-900/70 backdrop-blur rounded-2xl border border-dark-700 shadow-lg shadow-dark-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
              <Filter className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-white font-semibold">Filter by Network</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Networks' },
              { id: 'mtn', label: 'MTN' },
              { id: 'airtel', label: 'AirtelTigo' },
              { id: 'telecel', label: 'Telecel' }
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                  activeFilter === filter.id
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-dark-800 text-dark-200 hover:bg-dark-700 border border-dark-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-32">
            <div className="inline-flex p-6 bg-dark-800 rounded-full mb-6">
              <Package className="w-12 h-12 text-dark-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No Products Available</h2>
            <p className="text-dark-400">Check back later for new data bundles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group relative bg-dark-900/70 backdrop-blur rounded-2xl border border-dark-800 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-500/10"
              >
                <div className={`relative p-4 sm:p-6 bg-gradient-to-br ${getCarrierGradient(product.name)}`}>
                  <div className="absolute inset-0 bg-black/25"></div>
                  <div className="relative flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-white/80 text-xs font-semibold uppercase tracking-[0.14em]">
                        <Wifi className="w-4 h-4" /> Data Bundle
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-md">{product.name}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/25 text-white">Available</span>
                  </div>
                </div>
                
                <div className="p-4 sm:p-6 space-y-4">
                  <p className="text-2xl font-bold text-white">{product.description}</p>
                  
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-white">GHS {product.price.toFixed(2)}</span>
                    <span className="text-dark-400 text-xs sm:text-sm mb-1">/ bundle</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/25">
                      <Zap className="w-3 h-3" /> Instant
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-500/25">
                      <Shield className="w-3 h-3" /> Secure
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/25">
                      <Star className="w-3 h-3" /> Trusted
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className={`w-full py-3.5 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r ${getCarrierGradient(product.name)} text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <span>Purchase Now</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden">
            <div className={`relative bg-gradient-to-r ${getCarrierGradient(selectedProduct.name)} p-4`}>
              <button onClick={handleCloseModal} className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg active:scale-95 transition-all">
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-5 h-5 text-white/80" />
                <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Data Bundle</span>
              </div>
              <h2 className="text-lg font-bold text-white pr-8">Complete Your Order</h2>
              <p className="text-white/90 text-sm font-medium mt-1">{selectedProduct.name} - {selectedProduct.description}</p>
            </div>
            
            <div className="p-4">
              <div className="bg-dark-900/50 rounded-xl p-3 mb-4 border border-dark-700">
                <div className="flex justify-between items-center">
                  <span className="text-dark-400 text-sm">Amount</span>
                  <span className="text-xl font-bold text-white">GHS {selectedProduct.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Phone className="w-4 h-4 text-cyan-500" />
                  Data Bundle Number
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="0XXXXXXXXX"
                  className="w-full bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
                  maxLength={10}
                  disabled={processing}
                />
              </div>
              
              <div className="space-y-2.5">
                <button
                  onClick={handlePurchase}
                  disabled={processing}
                  className={`w-full bg-gradient-to-r ${getCarrierGradient(selectedProduct.name)} text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg active:scale-95`}
                >
                  {processing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : (
                    <>Pay with Mobile Money <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
                <button onClick={handleCloseModal} className="w-full bg-dark-700 hover:bg-dark-600 text-dark-300 py-3.5 rounded-xl font-semibold transition-all active:scale-95">
                  Cancel
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-dark-700">
                <Shield className="w-4 h-4 text-dark-500" />
                <p className="text-xs text-dark-500">Secured by Paystack</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-dark-700 flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-white">Track Your Order</h2>
              <button onClick={() => { setShowTrackingModal(false); setTrackedOrders([]); setTrackingNumber(''); }} className="text-dark-500 hover:text-dark-300">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="flex-1 flex gap-2 sm:gap-3">
                  <select
                    value={trackingMode}
                    onChange={(e) => { setTrackingMode(e.target.value); setTrackingNumber(''); setTrackedOrders([]); }}
                    className="bg-dark-900/70 border-2 border-dark-600 rounded-xl px-3 sm:px-4 text-white text-sm sm:text-base focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="phone">By Mobile</option>
                    <option value="order">By Order #</option>
                  </select>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(trackingMode === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                    placeholder={trackingMode === 'phone' ? 'Enter mobile number' : 'Enter order number (e.g. GHJUL24123456)'}
                    className="flex-1 bg-dark-900/50 border-2 border-dark-600 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                    maxLength={trackingMode === 'phone' ? 10 : 20}
                  />
                </div>
                <button onClick={trackOrder} disabled={isTracking} className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
                  {isTracking ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Search className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>

              {trackedOrders.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  {trackedOrders.map((order) => (
                    <div key={`${order.orderNumber || order.orderId}`} className="bg-dark-900/50 rounded-xl p-3 sm:p-4 border border-dark-700">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2 sm:mb-3">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm sm:text-base">Order {order.orderNumber ? `#${order.orderNumber}` : `#${order.orderId}`}</p>
                          <p className="text-dark-500 text-xs sm:text-sm">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap flex-shrink-0 ${getStatusColor(order.items?.[0]?.status)}`}>
                          {getStatusIcon(order.items?.[0]?.status)} {order.items?.[0]?.status || 'Pending'}
                        </span>
                      </div>
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="text-dark-300 text-xs sm:text-sm break-words">
                          <span className="text-white font-medium">{item.productName}</span> - {item.productDescription}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ComplaintModal isOpen={showComplaintModal} onClose={() => setShowComplaintModal(false)} />
      <ShopFloatingChatButton />
      
      {/* WhatsApp Contact Bubble */}
      {storefront?.agent?.whatsapp && (
        <a
          href={`https://wa.me/${storefront.agent.whatsapp.replace(/^0+/, '233')}?text=Hello%2C%20I'm%20interested%20in%20your%20data%20bundles`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-full shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
          title="Contact via WhatsApp"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="hidden sm:inline text-sm font-medium">Contact Us</span>
        </a>
      )}
    </div>
  );
};

export default PublicStorefront;
