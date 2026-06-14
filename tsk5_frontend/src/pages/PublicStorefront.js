import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BASE_URL from '../endpoints/endpoints';

// ==================== LIGHTWEIGHT API FETCH (~15 lines, replaces ~14KB axios) ====================
const fetchJson = async (url, options = {}) => {
  const controller = new AbortController();
  const t = options.timeout;
  if (t) setTimeout(() => controller.abort(), t);
  const res = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.response = { data: await res.json().catch(() => ({ message: `HTTP ${res.status}` })) };
    e.status = res.status;
    throw e;
  }
  return res.json();
};

const apiFetch = async (method, url, body = null, opts = {}) => {
  try {
    return await fetchJson(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      timeout: opts.timeout,
      headers: { 'Accept-Encoding': 'gzip, deflate', ...(opts.headers || {}) },
    });
  } catch (err) {
    if (err?.response) throw err;
    throw Object.assign(new Error('Network error'), { response: { data: { message: err.name === 'AbortError' ? 'Request timed out' : 'Network error' } } });
  }
};

// ==================== LIGHTWEIGHT ICONS (~1KB total, replaces 40KB lucide-react) ====================
const Icons = {
  Package: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
  Spinner: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24" className={p.className + ' animate-spin'}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>,
  Phone: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>,
  XCircle: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 14.828L12 12m0 0l2.828-2.828M12 12L9.172 9.172M12 12l2.828 2.828M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  Shield: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
  Wifi: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071A9.5 9.5 0 0112 4a9.5 9.5 0 017.071 2.929M12 7v.01m-4.95 3.96A5.5 5.5 0 0112 9a5.5 5.5 0 014.95 2.96"/></svg>,
  Zap: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  Star: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>,
  ArrowRight: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>,
  Search: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
  CheckCircle: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  Clock: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  BadgeCheck: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>,
  Filter: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>,
  X: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
  AlertTriangle: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>,
  ImageIcon: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  ExternalLink: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-6-6l6-6m0 0v6m0-6h-6"/></svg>,
  Calendar: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  ChevronLeft: (p) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>,
};

// ==================== TOAST SYSTEM (~1KB, replaces 15KB SweetAlert2 for notifications) ====================
function Toast({ toast, onClose }) {
  const colors = {
    success: { bg: '#059669', icon: 'check' },
    error: { bg: '#dc2626', icon: 'x' },
    warning: { bg: '#d97706', icon: '!' },
    info: { bg: '#2563eb', icon: 'i' }
  };
  const c = colors[toast?.type] || colors.info;
  React.useEffect(() => {
    if (toast && toast.autoClose !== false) {
      const t = setTimeout(onClose, toast.duration || 3000);
      return () => clearTimeout(t);
    }
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:c.bg, color:'#fff', padding:'12px 20px', borderRadius:12, fontSize:14, fontWeight:500, maxWidth:360, boxShadow:'0 8px 24px rgba(0,0,0,.3)', display:'flex', alignItems:'center', gap:10, animation:'slideIn .25s ease' }}>
      <span style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{c.icon === 'check' ? '\u2713' : c.icon === 'x' ? '\u2717' : c.icon}</span>
      <span style={{ flex:1 }}>{toast.message}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,.7)', cursor:'pointer', padding:2, fontSize:16, lineHeight:1 }}>&times;</button>
      <style>{`@keyframes slideIn{from{transform:translateX(120%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}

// ==================== CONFIRM MODAL (~1KB, replaces SweetAlert2 for confirmations/inputs) ====================
function ConfirmModal({ open, title, message, icon, input, inputValue, inputPlaceholder, confirmText, cancelText, confirmColor, onConfirm, onCancel }) {
  const [val, setVal] = useState(inputValue || '');
  useEffect(() => { setVal(inputValue || ''); }, [inputValue, open]);
  if (!open) return null;
  const iconMap = { warning: { bg:'#f59e0b', sym:'!' }, error: { bg:'#ef4444', sym:'\u2717' }, success: { bg:'#10b981', sym:'\u2713' }, info: { bg:'#3b82f6', sym:'i' } };
  const ic = iconMap[icon] || iconMap.info;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9998, padding:16 }} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background:'#1e1e24', border:'1px solid rgba(39,39,42,.8)', borderRadius:16, padding:24, maxWidth:400, width:'100%', boxShadow:'0 24px 48px rgba(0,0,0,.4)' }}>
        {icon && <div style={{ width:48, height:48, borderRadius:'50%', background:ic.bg+'20', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}><span style={{ color:ic.bg, fontSize:24, fontWeight:700 }}>{ic.sym}</span></div>}
        {title && <h3 style={{ color:'#fff', fontSize:18, fontWeight:700, textAlign:'center', marginBottom:8 }}>{title}</h3>}
        {message && <p style={{ color:'#a1a1aa', fontSize:14, textAlign:'center', marginBottom:20, lineHeight:1.5 }}>{message}</p>}
        {input && (
          <input value={val} onChange={e => setVal(e.target.value)} placeholder={inputPlaceholder} autoFocus
            style={{ width:'100%', background:'rgba(10,10,15,.5)', border:'1px solid rgba(39,39,42,.8)', borderRadius:12, padding:'12px 16px', color:'#fff', fontSize:16, outline:'none', marginBottom:16, boxSizing:'border-box' }}
          />
        )}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => onConfirm(input ? val : true)} style={{ flex:1, padding:'12px', border:'none', borderRadius:12, background:confirmColor||'#06b6d4', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>{confirmText || 'OK'}</button>
          {cancelText !== false && <button onClick={onCancel} style={{ flex:1, padding:'12px', border:'none', borderRadius:12, background:'#27272a', color:'#a1a1aa', fontSize:15, fontWeight:600, cursor:'pointer' }}>{cancelText || 'Cancel'}</button>}
        </div>
      </div>
    </div>
  );
}

// ==================== CONSTANTS ====================
const CACHE_KEY_PREFIX = 'storefront_cache_';
const CACHE_DURATION_MS = 2 * 60 * 1000;
const validPrefixes = ['024', '025', '053', '054', '055', '059', '020', '050', '027', '057', '026', '056', '028'];

const StorefrontSkeleton = () => (
  <div className="min-h-screen bg-dark-950">
    <nav className="sticky top-0 z-50 border-b border-dark-800/80 bg-dark-950/70">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-dark-800 rounded-2xl animate-pulse" />
            <div className="space-y-2"><div className="h-5 w-40 bg-dark-800 rounded animate-pulse" /></div>
          </div>
          <div className="h-10 w-32 bg-dark-800 rounded-xl animate-pulse" />
        </div>
      </div>
    </nav>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 mt-8">
      <div className="h-16 bg-dark-800/70 rounded-2xl animate-pulse mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-dark-900/70 rounded-2xl overflow-hidden">
            <div className="h-32 bg-dark-800 animate-pulse" />
            <div className="p-4 sm:p-6 space-y-4">
              <div className="h-8 w-3/4 bg-dark-800 rounded animate-pulse" />
              <div className="h-6 w-1/2 bg-dark-800 rounded animate-pulse" />
              <div className="h-12 w-full bg-dark-800 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const PublicStorefront = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingMode, setTrackingMode] = useState('phone');
  const [trackedOrders, setTrackedOrders] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingDate, setTrackingDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [trackingStep, setTrackingStep] = useState('date'); // 'date' -> 'search'
  const [selectedProofImage, setSelectedProofImage] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const verifiedRefsRef = useRef(new Set());
  const isMountedRef = useRef(false);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setToast({ message, type, duration, autoClose: true });
  }, []);

  const showConfirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setConfirm({ ...opts, resolve });
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    if (confirm && confirm.resolve) confirm.resolve(result);
    setConfirm(null);
  }, [confirm]);

  const fetchStorefront = useCallback(async ({ skipCache = false } = {}) => {
    const cacheKey = `${CACHE_KEY_PREFIX}${slug}`;
    if (!skipCache) {
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
            setStorefront(cached.data);
            setLoading(false);
            return;
          } else {
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (e) { localStorage.removeItem(cacheKey); }
    }
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('GET', `${BASE_URL}/api/storefront/public/${slug}`, null, { timeout: 15000, headers: { 'Accept-Encoding': 'gzip, deflate' } });
      if (data.success) {
        setStorefront(data);
        try { localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() })); } catch (e) { /* ignore */ }
      } else {
        setError('Storefront not found');
      }
    } catch (err) {
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) { const cached = JSON.parse(cachedRaw); if (cached.data) { setStorefront(cached.data); setError(null); return; } }
      } catch (e) { /* ignore */ }
      setError(err.response?.data?.message || 'Storefront not found');
    } finally { setLoading(false); }
  }, [slug]);

  const verifyPayment = useCallback(async (reference) => {
    showToast('Verifying payment...', 'info', 60000);
    try {
      const data = await apiFetch('POST', `${BASE_URL}/api/storefront/verify`, { reference }, { timeout: 30000 });
      setToast(null);
      if (data.success) {
        const orderNum = data?.order?.orderNumber || `#${data?.order?.id || 'N/A'}`;
        await showConfirm({ title: 'Payment Successful', message: `Your order has been created.\nReceipt: Order ${orderNum}\nSave this number to track your order.`, icon: 'success', confirmText: 'OK', cancelText: false, confirmColor: '#10b981' });
        window.location.href = `/store/${slug}`;
      } else {
        showToast(data.message || 'Payment failed', 'error');
      }
    } catch (err) {
      setToast(null);
      showToast('Could not verify payment.', 'error');
    }
  }, [slug, showToast, showConfirm]);

  useEffect(() => {
    const cacheKey = `${CACHE_KEY_PREFIX}${slug}`;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.timestamp < CACHE_DURATION_MS && cached.data) {
          setStorefront(cached.data); setLoading(false);
          isMountedRef.current = true;
          setTimeout(() => fetchStorefront({ skipCache: true }), 100);
          return;
        }
      }
    } catch (e) { /* ignore */ }
    fetchStorefront();
    isMountedRef.current = true;
  }, [fetchStorefront, slug]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const reference = searchParams.get('reference');
    if (payment === 'callback' && reference) {
      if (!verifiedRefsRef.current.has(reference)) {
        verifiedRefsRef.current.add(reference);
        verifyPayment(reference);
      }
      window.history.replaceState({}, '', `/store/${slug}`);
    }
  }, [searchParams, slug, verifyPayment]);

  const filteredProducts = useMemo(() => {
    if (!storefront?.products) return [];
    const filtered = activeFilter === 'all' ? [...storefront.products] : storefront.products.filter((product) => {
      const u = product.name?.toUpperCase() || '';
      if (activeFilter === 'mtn') return u.includes('MTN');
      if (activeFilter === 'airtel') return u.includes('AIRTEL') || u.includes('TIGO');
      if (activeFilter === 'telecel') return u.includes('TELECEL') || u.includes('VODAFONE');
      return true;
    });
    const getNetworkPriority = (name) => {
      const u = name?.toUpperCase() || '';
      if (u.includes('MTN')) return 1;
      if (u.includes('TELECEL') || u.includes('VODAFONE')) return 2;
      if (u.includes('AIRTEL') || u.includes('TIGO')) return 3;
      return 4;
    };
    const parseBundleSize = (text) => {
      if (!text) return Number.MAX_SAFE_INTEGER;
      const match = text.match(/([\d.]+)\s*(gb|mb|g|m)/i);
      if (!match) return Number.MAX_SAFE_INTEGER;
      const v = parseFloat(match[1]);
      return v * (match[2].toLowerCase().startsWith('g') ? 1024 : 1);
    };
    return filtered.sort((a, b) => {
      const nd = getNetworkPriority(a.name) - getNetworkPriority(b.name);
      return nd !== 0 ? nd : parseBundleSize(a.description) - parseBundleSize(b.description);
    });
  }, [storefront?.products, activeFilter]);

  const gradientMap = useMemo(() => {
    if (!storefront?.products) return {};
    const map = {};
    storefront.products.forEach(p => {
      const u = p.name?.toUpperCase() || '';
      if (u.includes('MTN')) map[p.id] = 'from-yellow-500 to-amber-600';
      else if (u.includes('TELECEL') || u.includes('VODAFONE')) map[p.id] = 'from-red-500 to-rose-600';
      else if (u.includes('AIRTEL') || u.includes('TIGO')) map[p.id] = 'from-blue-500 to-indigo-600';
      else map[p.id] = 'from-dark-600 to-dark-700';
    });
    return map;
  }, [storefront?.products]);

  const getCarrierGradient = useCallback((name, productId) => {
    if (productId && gradientMap[productId]) return gradientMap[productId];
    const u = name?.toUpperCase() || '';
    if (u.includes('MTN')) return 'from-yellow-500 to-amber-600';
    if (u.includes('TELECEL') || u.includes('VODAFONE')) return 'from-red-500 to-rose-600';
    if (u.includes('AIRTEL') || u.includes('TIGO')) return 'from-blue-500 to-indigo-600';
    return 'from-dark-600 to-dark-700';
  }, [gradientMap]);

  const handleCloseModal = () => {
    setSelectedProduct(null); setMobileNumber(''); setProcessing(false);
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || phone.length !== 10) return false;
    return validPrefixes.includes(phone.substring(0, 3));
  };

  const handlePurchase = async () => {
    if (!mobileNumber || mobileNumber.length !== 10) {
      showConfirm({ title: 'Invalid Number', message: 'Please enter a valid mobile number (10 digits)', icon: 'warning', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
      return;
    }
    if (!validatePhoneNumber(mobileNumber)) {
      showConfirm({ title: 'Invalid Number Format', message: 'Number must start with a valid prefix (024, 054, 055, 059, 020, 050, 027, 057, 026, 056, 028)', icon: 'warning', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
      return;
    }
    setProcessing(true);
    try {
      const data = await apiFetch('POST', `${BASE_URL}/api/storefront/public/${slug}/pay`, {
        storefrontProductId: selectedProduct.id, customerName: storefront?.agent?.name || 'Customer', customerPhone: mobileNumber.trim()
      }, { timeout: 30000 });
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        showToast(data.message || 'Could not initialize payment', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to process order', 'error');
    } finally { setProcessing(false); }
  };

  const trackOrder = async () => {
    const value = trackingNumber.trim();
    const cleaned = value.replace(/\s+/g, '');
    if (trackingMode === 'phone') {
      const digitsOnly = cleaned.replace(/\D/g, '');
      if (digitsOnly.length < 9) {
        showConfirm({ title: 'Invalid Number', message: 'Please enter a valid mobile number', icon: 'warning', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
        return;
      }
    } else {
      if (cleaned.length < 5) {
        showConfirm({ title: 'Invalid Order Number', message: 'Please enter a valid order number (e.g. GHJUL24123456)', icon: 'warning', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
        return;
      }
    }
    setIsTracking(true);
    try {
      const params = {
        ...(trackingMode === 'phone'
          ? { mobileNumber: cleaned.replace(/\D/g, '') }
          : { orderNumber: cleaned.toUpperCase() }),
        ...(trackingDate && { trackingDate })
      };
      const data = await apiFetch('GET', `${BASE_URL}/api/shop/track?${new URLSearchParams(params)}`, null, { timeout: 15000 });
      setTrackedOrders(data.orders || []);
      if (data.orders?.length === 0) {
        showConfirm({ title: 'No Orders Found', message: trackingMode === 'phone' ? 'No orders found for this mobile number on the selected date.' : 'No orders found for this order number on the selected date.', icon: 'info', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
      }
    } catch (error) {
      showConfirm({ title: 'Error', message: 'Failed to track order.', icon: 'error', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
    } finally { setIsTracking(false); }
  };

  const handleNotReceived = async (order, item) => {
    const phone = item.mobileNumber || order.mobileNumber || '';
    if (!phone) {
      showConfirm({ title: 'No Phone Number', message: 'Cannot submit complaint — no phone number on this order.', icon: 'error', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
      return;
    }
    const confirmed = await showConfirm({
      title: 'Not Received?',
      message: `Report that item "${item.productName}" was not delivered?`,
      icon: 'warning',
      confirmText: 'Submit Complaint',
      confirmColor: '#ef4444'
    });
    if (!confirmed) return;
    setIsTracking(true);
    try {
      const cleanedPhone = phone.replace(/\D/g, '');
      const normalizedPhone = cleanedPhone.startsWith('233') && cleanedPhone.length === 12
        ? '0' + cleanedPhone.substring(3)
        : cleanedPhone;
      await apiFetch('POST', `${BASE_URL}/api/complaints`, {
        mobileNumber: normalizedPhone, orderId: order.id, orderItemId: item.id,
        message: `Item not received: ${item.productName} (${item.productDescription || ''}) - Order #${order.orderNumber || order.id}`,
        complaintDate: new Date().toISOString().split('T')[0],
        complaintTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
      }, { timeout: 15000 });
      showConfirm({ title: 'Complaint Submitted', message: 'Admin has been notified. Track your order again later to see updates.', icon: 'success', confirmText: 'OK', cancelText: false, confirmColor: '#10b981' });
      await trackOrder();
    } catch (err) {
      showConfirm({ title: 'Submission Failed', message: err.response?.data?.message || 'Failed to submit complaint.', icon: 'error', confirmText: 'OK', cancelText: false, confirmColor: '#06b6d4' });
    } finally { setIsTracking(false); }
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
      case 'completed': return <Icons.CheckCircle className="w-4 h-4" />;
      case 'processing': return <Icons.Clock className="w-4 h-4" />;
      case 'pending': return <Icons.Package className="w-4 h-4" />;
      case 'cancelled': case 'canceled': return <Icons.XCircle className="w-4 h-4" />;
      default: return <Icons.Package className="w-4 h-4" />;
    }
  };

  if (loading && !storefront) return <StorefrontSkeleton />;

  if (error && !storefront) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex p-6 bg-dark-800 rounded-full mb-6">
            <Icons.XCircle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Store Not Found</h1>
          <p className="text-dark-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950 text-white">
      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      {/* Confirm Modal */}
      <ConfirmModal open={!!confirm} {...confirm} onConfirm={(v) => closeConfirm(v)} onCancel={() => closeConfirm(false)} />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur border-b border-dark-800/80 bg-dark-950/70">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Icons.Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-bold">{storefront?.agent?.name}'s Store</h1>
                  <Icons.BadgeCheck className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => setShowTrackingModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-xl text-white text-sm sm:text-base font-semibold shadow-lg shadow-emerald-500/25 hover:from-cyan-600 hover:to-emerald-600 transition-all active:scale-95">
                <Icons.Search className="w-4 h-4" /> <span>Track Order</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Payment Notice Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-start gap-3">
            <Icons.AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 text-sm sm:text-base font-semibold">⚠️ Important Notice</p>
              <p className="text-amber-200/80 text-xs sm:text-sm mt-1">
                If you experience any issues after payment, please wait 5 minutes and then check your order status using the mobile number you provided. Click "Track Order" at the top right to check.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="products-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Filter Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 p-6 bg-dark-900/70 backdrop-blur rounded-2xl border border-dark-700 shadow-lg shadow-dark-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
              <Icons.Filter className="w-5 h-5 text-cyan-400" />
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
              <button key={filter.id} onClick={() => setActiveFilter(filter.id)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                  activeFilter === filter.id
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-dark-800 text-dark-200 hover:bg-dark-700 border border-dark-700'
                }`}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-32">
            <div className="inline-flex p-6 bg-dark-800 rounded-full mb-6">
              <Icons.Package className="w-12 h-12 text-dark-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No Products Available</h2>
            <p className="text-dark-400">Check back later for new data bundles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} style={{ contentVisibility: 'auto' }}
                className="group relative bg-dark-900/70 backdrop-blur rounded-2xl border border-dark-800 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-500/10">
                <div className={`relative p-4 sm:p-6 bg-gradient-to-br ${getCarrierGradient(product.name, product.id)}`}>
                  <div className="absolute inset-0 bg-black/25"></div>
                  <div className="relative flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-white/80 text-xs font-semibold uppercase tracking-[0.14em]">
                        <Icons.Wifi className="w-4 h-4" /> Data Bundle
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
                      <Icons.Zap className="w-3 h-3" /> Instant
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-500/25">
                      <Icons.Shield className="w-3 h-3" /> Secure
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/25">
                      <Icons.Star className="w-3 h-3" /> Trusted
                    </span>
                  </div>
                  <button onClick={() => setSelectedProduct(product)}
                    className={`w-full py-3.5 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r ${getCarrierGradient(product.name, product.id)} text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`}>
                    <span>Purchase Now</span>
                    <Icons.ArrowRight className="w-5 h-5" />
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
            <div className={`relative bg-gradient-to-r ${getCarrierGradient(selectedProduct.name, selectedProduct.id)} p-4`}>
              <button onClick={handleCloseModal} className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg active:scale-95 transition-all">
                <Icons.X className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <Icons.Wifi className="w-5 h-5 text-white/80" />
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
                  <Icons.Phone className="w-4 h-4 text-cyan-500" />
                  Data Bundle Number
                </label>
                <input type="tel" value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="0XXXXXXXXX"
                  className="w-full bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
                  maxLength={10} disabled={processing} />
              </div>
              <div className="space-y-2.5">
                <button onClick={handlePurchase} disabled={processing}
                  className={`w-full bg-gradient-to-r ${getCarrierGradient(selectedProduct.name, selectedProduct.id)} text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg active:scale-95`}>
                  {processing ? (
                    <><Icons.Spinner className="w-5 h-5" /> Processing...</>
                  ) : (
                    <>Pay with Mobile Money <Icons.ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
                <button onClick={handleCloseModal} className="w-full bg-dark-700 hover:bg-dark-600 text-dark-300 py-3.5 rounded-xl font-semibold transition-all active:scale-95">
                  Cancel
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-dark-700">
                <Icons.Shield className="w-4 h-4 text-dark-500" />
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
              <button onClick={() => { setShowTrackingModal(false); setTrackedOrders([]); setTrackingNumber(''); setTrackingStep('date'); }} className="text-dark-500 hover:text-dark-300">
                <Icons.X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {trackingStep === 'date' ? (
                /* Step 1: Calendar Popup - Visual Date Picker */
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex p-3 bg-cyan-500/10 rounded-2xl mb-3">
                      <Icons.Calendar className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">Select Order Date</h3>
                    <p className="text-dark-400 text-sm">Choose the date your order was placed</p>
                  </div>
                  {/* Calendar Header - Month/Year Navigation */}
                  <div className="flex items-center justify-between bg-dark-900/50 rounded-xl px-4 py-2.5 border border-dark-700">
                    <button onClick={() => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); } else { setCalendarMonth(m => m - 1); } }}
                      className="p-1.5 hover:bg-dark-700 rounded-lg text-dark-300 hover:text-white transition-all">
                      <Icons.ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-white font-semibold text-base">
                      {new Date(calendarYear, calendarMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => { const now = new Date(); const nextDate = new Date(calendarYear, calendarMonth + 1); if (nextDate <= now) { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); } else { setCalendarMonth(m => m + 1); } } }}
                      className="p-1.5 hover:bg-dark-700 rounded-lg text-dark-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={(() => { const now = new Date(); return new Date(calendarYear, calendarMonth + 1) > now; })()}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                  {/* Day-of-Week Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-dark-400 uppercase tracking-wider">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="py-1.5">{d}</div>)}
                  </div>
                  {/* Calendar Day Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const today = new Date();
                      const todayStr = today.toISOString().split('T')[0];
                      const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                      const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                      const cells = [];
                      for (let i = 0; i < firstDay; i++) {
                        cells.push(<div key={`empty-${i}`} />);
                      }
                      for (let d = 1; d <= daysInMonth; d++) {
                        const yyyymmdd = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isSelected = yyyymmdd === trackingDate;
                        const isToday = yyyymmdd === todayStr;
                        const isFuture = yyyymmdd > todayStr;
                        cells.push(
                          <button key={d} disabled={isFuture}
                            onClick={() => setTrackingDate(yyyymmdd)}
                            className={`relative w-full aspect-square rounded-xl text-sm font-medium transition-all active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed
                              ${isSelected ? 'bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105 font-bold' : ''}
                              ${!isSelected && isToday ? 'border border-cyan-500/50 text-cyan-300' : ''}
                              ${!isSelected && !isToday ? 'text-white hover:bg-dark-700' : ''}
                            `}>
                            {d}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  {/* Selected Date Display */}
                  <div className="text-center py-1">
                    <p className="text-dark-400 text-xs">
                      {trackingDate ? `Selected: ${new Date(trackingDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Pick a date above'}
                    </p>
                  </div>
                  <button onClick={() => setTrackingStep('search')} disabled={!trackingDate}
                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg active:scale-95">
                    Continue <Icons.ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                /* Step 2: Search with Date Context */
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-dark-900/50 rounded-xl p-3 border border-dark-700">
                    <div className="flex items-center gap-3">
                      <Icons.Calendar className="w-5 h-5 text-cyan-400" />
                      <div>
                        <p className="text-white text-sm font-medium">{(() => { try { return new Date(trackingDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return trackingDate; } })()}</p>
                        <p className="text-dark-500 text-xs">Order date</p>
                      </div>
                    </div>
                    <button onClick={() => { setTrackingStep('date'); setTrackedOrders([]); setTrackingNumber(''); }}
                      className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-dark-200 text-sm rounded-lg transition-all">
                      Change
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="flex-1 flex gap-2 sm:gap-3">
                      <select value={trackingMode}
                        onChange={(e) => { setTrackingMode(e.target.value); setTrackingNumber(''); setTrackedOrders([]); }}
                        className="bg-dark-900/70 border-2 border-dark-600 rounded-xl px-3 sm:px-4 text-white text-sm sm:text-base focus:border-cyan-500 focus:outline-none">
                        <option value="phone">By Mobile</option>
                        <option value="order">By Order #</option>
                      </select>
                      <input type="text" value={trackingNumber}
                        onChange={(e) => setTrackingNumber(trackingMode === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                        placeholder={trackingMode === 'phone' ? 'Enter mobile number' : 'Enter order number'}
                        className="flex-1 bg-dark-900/50 border-2 border-dark-600 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                        maxLength={trackingMode === 'phone' ? 10 : 50} />
                    </div>
                    <button onClick={trackOrder} disabled={isTracking}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
                      {isTracking ? <Icons.Spinner className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icons.Search className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>
              )}
              {trackedOrders.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  {trackedOrders.map((order) => {
                    const orderComplaints = order.complaints || [];
                    return (
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
                        {order.items?.map((item, idx) => {
                          const itemComplaints = orderComplaints.filter(c => c.orderItemId === item.id);
                          return (
                            <div key={idx} className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-dark-300 text-xs sm:text-sm break-words flex-1">
                                  <span className="text-white font-medium">{item.productName}</span> - {item.productDescription}
                                </div>
                                {item.status?.toLowerCase() === 'completed' && itemComplaints.length === 0 && (
                                  <button onClick={() => handleNotReceived(order, item)} disabled={isTracking}
                                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-300 text-xs font-medium transition-all disabled:opacity-50">
                                    <Icons.AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Not Received</span>
                                  </button>
                                )}
                              </div>
                              {itemComplaints.map((complaint) => (
                                <div key={complaint.id} className="mt-2 p-2.5 bg-dark-800/80 rounded-lg border border-dark-600 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                      complaint.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                      complaint.status === 'reviewed' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                                      'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    }`}>
                                      {complaint.status === 'resolved' ? <Icons.CheckCircle className="w-3 h-3" /> :
                                       complaint.status === 'reviewed' ? <Icons.Clock className="w-3 h-3" /> :
                                       <Icons.AlertTriangle className="w-3 h-3" />}
                                      <span className="capitalize">{complaint.status}</span>
                                    </span>
                                    <span className="text-dark-500 text-[10px]">{new Date(complaint.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  {complaint.adminNotes && (
                                    <p className="text-dark-200 text-xs whitespace-pre-wrap">
                                      <span className="text-cyan-400 font-medium">Admin: </span>{complaint.adminNotes}
                                    </p>
                                  )}
                                  {complaint.proofImage && (
                                    <button onClick={() => setSelectedProofImage(`${BASE_URL}/api/complaints/image/${complaint.proofImage.split('/').pop()}`)}
                                      className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs mt-1 transition-colors">
                                      <Icons.ImageIcon className="w-3.5 h-3.5" />
                                      <span>View Proof Image</span>
                                      <Icons.ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proof Image Preview Modal */}
      {selectedProofImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setSelectedProofImage(null)}>
          <button onClick={() => setSelectedProofImage(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg z-10">
            <Icons.X className="w-6 h-6 text-white" />
          </button>
          <img src={selectedProofImage} alt="Proof" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={(e) => e.stopPropagation()}
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      )}

      {/* WhatsApp Channel/Group Link Bubble */}
      {storefront?.agent?.whatsapp && (
        <a href={storefront.agent.whatsapp} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-full shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
          title="Join our WhatsApp Channel/Group">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="hidden sm:inline text-sm font-medium">WhatsApp Support</span>
        </a>
      )}
    </div>
  );
};

export default PublicStorefront;
