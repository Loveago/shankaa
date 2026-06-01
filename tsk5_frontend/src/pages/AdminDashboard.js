import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Menu, X, Users, Package, ShoppingCart, Bell, RefreshCw, Loader2, Search, Plus, Edit, Trash2, CheckCircle, XCircle, BarChart3, Wallet, User, LogOut, RotateCcw, Eye, EyeOff, Save, Banknote, DollarSign, Table2, Key, AlertTriangle, Wifi, FileText, Landmark, Gift, Settings, Store } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import { io as socketIO } from 'socket.io-client';
import ProductDialog from '../components/ProductDialog';
import ComplaintsViewer from '../components/ComplaintsViewer';
import AnnouncementAdmin from '../components/AnnouncementAdmin';
import TransactionalAdminModal from '../components/TransactionalAdminModal';
import TopupsOrdered from '../components/TopupsOrdered';
import OrderTable from '../components/OrderTable';
import AgentCommissionModal from '../components/AgentCommissionModal';
import PaymentMessagesModal from '../components/PaymentMessagesModal';
import BeneficiaryTableModal from '../components/BeneficiaryTableModal';
import FloatingChatButton from '../components/FloatingChatButton';
import ExternalApiKeys from '../components/ExternalApiKeys';
import OrderTracker from '../components/OrderTracker';
import SuspiciousActivity from '../components/SuspiciousActivity';
import OrderFiles from '../components/OrderFiles';
import StorefrontWithdrawalAdmin from '../components/StorefrontWithdrawalAdmin';
import ReferralCodeManager from '../components/ReferralCodeManager';
import ManageStorefront from '../components/ManageStorefront';
import AfaRegistrationAdmin from '../components/AfaRegistrationAdmin';
import MtnExpressAdmin from '../components/MtnExpressAdmin';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, revenue: 0 });
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  
  // User modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'USER', phone: '' });
  
  // Product dialog state
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showOrderTable, setShowOrderTable] = useState(false);
  
  // Notification state (bell only - no auto-popup)
  const [orderCount, setOrderCount] = useState(0);
  const [complaintCount, setComplaintCount] = useState(0);
  const [topupCount, setTopupCount] = useState(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  
  // Loan/Refund state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundUserId, setRefundUserId] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [editingLoanUserId, setEditingLoanUserId] = useState(null);
  const [newLoanBalance, setNewLoanBalance] = useState('');
  
  // Modal states for sidebar components
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showTopupsModal, setShowTopupsModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showPaymentMessagesModal, setShowPaymentMessagesModal] = useState(false);
  const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
  const [showExternalApiModal, setShowExternalApiModal] = useState(false);
  const [showOrderTracker, setShowOrderTracker] = useState(false);
  const [showSuspiciousActivity, setShowSuspiciousActivity] = useState(false);
  const [showStorefrontWithdrawals, setShowStorefrontWithdrawals] = useState(false);
  const [showManageStorefront, setShowManageStorefront] = useState(false);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [fraudBlinking, setFraudBlinking] = useState(false);
  // Settings state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ momoNumber: '', momoName: '', paystackSecretKey: '', hasPaystackSecret: false, registrationEnabled: true, skanka5ApiKey: '', hasSkanka5ApiKey: false, autoProcessOrders: false });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  
  // Orders pagination
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersPerPage = 20;
  
  const sidebarRef = useRef(null);
  const notificationRef = useRef(null);
  const fetchInProgress = useRef(false);

  const userName = localStorage.getItem('name') || 'Admin';
  const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // Initial data load with loading indicator
  const fetchData = useCallback(async (showLoading = true) => {
    if (fetchInProgress.current && !showLoading) return; // Skip if a fetch is already running (background refresh)
    fetchInProgress.current = true;
    if (showLoading) setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, productsRes, ordersRes, topupsRes, complaintsRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/users`, { headers }),
        axios.get(`${BASE_URL}/products`, { headers }),
        axios.get(`${BASE_URL}/order/admin/allorder`, { headers, params: { limit: 100 } }).catch(() => ({ data: { orders: [], pagination: { totalItems: 0 } } })),
        axios.get(`${BASE_URL}/api/topups?startDate=2024-03-01&endDate=2030-03-14`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/api/complaints/pending/count`, { headers }).catch(() => ({ data: { count: 0 } }))
      ]);

      const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
      const productsData = Array.isArray(productsRes.data) ? productsRes.data : [];
      const ordersData = Array.isArray(ordersRes.data?.data) ? ordersRes.data.data : (Array.isArray(ordersRes.data?.orders) ? ordersRes.data.orders : (Array.isArray(ordersRes.data) ? ordersRes.data : []));
      const totalOrdersCount = ordersRes.data?.pagination?.totalItems || ordersData.length;
      const topupsData = Array.isArray(topupsRes.data) ? topupsRes.data : [];

      setUsers(usersData);
      setProducts(productsData);
      setOrders(ordersData);
      
      // Track pending orders (check multiple possible status locations, case-insensitive)
      const pendingOrders = ordersData.filter(o => {
        const status = o.order?.items?.[0]?.status || o.status || '';
        return status.toLowerCase() === 'pending';
      }).length;
      
      // Track pending topups
      const totalTopups = topupsData.length;
      
      // Track pending complaints
      const pendingComplaints = complaintsRes.data?.data?.count || complaintsRes.data?.count || 0;
      
      // Update notification counts
      setOrderCount(pendingOrders);
      setTopupCount(totalTopups);
      setComplaintCount(pendingComplaints);

      const totalRevenue = ordersData
        .filter(o => o.status === 'Completed' || o.order?.items?.[0]?.status === 'Completed')
        .reduce((sum, o) => sum + (o.product?.price || o.items?.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0) || 0), 0);

      const totalBalance = usersData
        .filter(u => ['USER', 'PREMIUM', 'SUPER', 'NORMAL', 'OTHER'].includes((u.role || '').toUpperCase()))
        .reduce((acc, u) => acc + Math.abs(parseFloat(u.loanBalance || 0)), 0);

      setStats({
        users: usersData.length,
        products: productsData.length,
        orders: totalOrdersCount,
        revenue: totalRevenue,
        totalBalance
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      fetchInProgress.current = false;
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/users`, { headers: getAuthHeaders() });
      setUsers(res.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchFraudAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/order/admin/order-tracker`, { headers: getAuthHeaders() });
      if (res.data.success) {
        const allAlerts = res.data.fraudAlerts || [];
        const resolvedList = JSON.parse(localStorage.getItem('resolvedFraudAlerts') || '[]');
        const activeAlerts = allAlerts.filter(a => !resolvedList.includes(`${a.orderId}-${a.itemId}`));
        setFraudAlerts(activeAlerts);
        if (activeAlerts.length > 0) {
          setFraudBlinking(true);
        }
      }
    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
    }
  }, []);

  useEffect(() => {
    fetchData(true); // Initial load with loading indicator
    fetchFraudAlerts(); // Fetch fraud alerts immediately on mount
    // Background refresh without visible loading - every 30 seconds
    const interval = setInterval(() => {
      fetchData(false);
      fetchFraudAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchFraudAlerts]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/settings`, { headers: getAuthHeaders() });
      if (res.data.success) {
        const { momoNumber = '', momoName = '', hasPaystackSecret = false, registrationEnabled = true, autoProcessOrders = false, hasSkanka5ApiKey = false } = res.data.settings || {};
        setSettingsForm((prev) => ({ ...prev, momoNumber, momoName, hasPaystackSecret, paystackSecretKey: '', registrationEnabled, autoProcessOrders, hasSkanka5ApiKey, skanka5ApiKey: '' }));
      }
    } catch (error) {
      console.error('Settings fetch error:', error);
      Swal.fire({ icon: 'error', title: 'Failed to load settings', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const payload = {
        momoNumber: settingsForm.momoNumber,
        momoName: settingsForm.momoName,
        paystackSecretKey: settingsForm.paystackSecretKey?.trim() ? settingsForm.paystackSecretKey.trim() : undefined,
        registrationEnabled: settingsForm.registrationEnabled,
        autoProcessOrders: settingsForm.autoProcessOrders,
        skanka5ApiKey: settingsForm.skanka5ApiKey?.trim() ? settingsForm.skanka5ApiKey.trim() : undefined,
      };
      const res = await axios.put(`${BASE_URL}/api/settings`, payload, { headers: getAuthHeaders() });
      if (res.data.success) {
        const { momoNumber = '', momoName = '', hasPaystackSecret = false, registrationEnabled = true, autoProcessOrders = false, hasSkanka5ApiKey = false } = res.data.settings || {};
        setSettingsForm((prev) => ({ ...prev, momoNumber, momoName, hasPaystackSecret, paystackSecretKey: '', registrationEnabled, autoProcessOrders, hasSkanka5ApiKey, skanka5ApiKey: '' }));
        Swal.fire({ icon: 'success', title: 'Settings updated', background: '#1e293b', color: '#f1f5f9', timer: 1500, showConfirmButton: false });
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Update failed', text: error.response?.data?.message || 'Could not save settings', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchSettings();
    }
  }, [activeTab, fetchSettings]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationDropdown(false);
      }
    };

    if (showNotificationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationDropdown]);

  // Real-time order notifications via socket
  useEffect(() => {
    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });
    socket.on('new-order', () => {
      // Immediately refresh data when a new order is placed
      fetchData(false);
      fetchFraudAlerts();
    });
    return () => socket.disconnect();
  }, [fetchData, fetchFraudAlerts]);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'ADMIN') navigate('/');
  }, [navigate]);

  const logoutUser = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      await axios.post(`${BASE_URL}/api/auth/logout`, { userId: parseInt(userId) }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.clear();
    navigate('/login');
  };

  // User Management Functions
  const openAddUserModal = () => {
    setNewUser({ name: '', email: '', password: '', role: 'USER', phone: '' });
    setSelectedUser(null);
    setIsEditingUser(false);
    setShowUserModal(true);
  };

  const openEditUserModal = (user) => {
    setSelectedUser({ ...user });
    setIsEditingUser(true);
    setShowUserModal(true);
  };

  const generateRandomPassword = () => {
    const pwd = Math.random().toString(36).substring(2, 7).toUpperCase();
    if (isEditingUser) setSelectedUser({ ...selectedUser, password: pwd });
    else setNewUser({ ...newUser, password: pwd });
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'All fields are required!', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    try {
      await axios.post(`${BASE_URL}/api/users`, newUser, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: 'Success!', text: 'User added!', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      setShowUserModal(false);
      fetchUsers();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Failed!', text: error.response?.data?.message || 'Failed to add user.', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await axios.put(`${BASE_URL}/api/users/${selectedUser.id}`, {
        name: selectedUser.name, email: selectedUser.email, password: selectedUser.password,
        role: selectedUser.role || 'USER', phone: selectedUser.phone, isLoggedIn: selectedUser.isLoggedIn
      }, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      setShowUserModal(false);
      fetchUsers();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Update Failed!', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleToggleSuspend = async (user) => {
    const newStatus = !user.isSuspended;
    try {
      await axios.put(`${BASE_URL}/api/users/${user.id}/suspend`, { isSuspended: newStatus }, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: newStatus ? 'Suspended!' : 'Unsuspended!', text: newStatus ? `${user.name} has been suspended.` : `${user.name} has been unsuspended.`, timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
      fetchUsers();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Failed!', text: 'Could not update suspension status.', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleDeleteUser = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?', text: 'This action cannot be undone!', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9'
    });
    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/users/${id}`, { headers: getAuthHeaders() });
        Swal.fire({ title: 'Deleted!', icon: 'success', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
        fetchUsers();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error!', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  // Refund Functions
  const openRefundModal = (user) => {
    setRefundUserId(user.id);
    setRefundAmount('');
    setShowRefundModal(true);
  };

  const handleRefund = async () => {
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      Swal.fire({ icon: 'error', title: 'Invalid Amount', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    try {
      await axios.post(`${BASE_URL}/api/users/refund`, { userId: refundUserId, amount }, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: 'Refund Added!', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      setShowRefundModal(false);
      fetchUsers();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Refund Failed', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  // Loan Functions
  const handleSaveLoan = async (userId) => {
    const amount = parseFloat(newLoanBalance);
    if (isNaN(amount) || amount === 0) {
      setEditingLoanUserId(null);
      return;
    }
    try {
      if (amount < 0) {
        await axios.post(`${BASE_URL}/api/users/loan/assign`, { userId, amount: Math.abs(amount) }, { headers: getAuthHeaders() });
        Swal.fire({ icon: 'success', title: 'Loan Assigned!', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      } else {
        await axios.post(`${BASE_URL}/api/users/repay-loan`, { userId, amount }, { headers: getAuthHeaders() });
        Swal.fire({ icon: 'success', title: 'Loan Repaid!', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      }
      setEditingLoanUserId(null);
      fetchUsers();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'Operation failed', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  // Reset Database
  const handleResetDatabase = async () => {
    const first = await Swal.fire({
      title: 'Are you absolutely sure?', text: 'This will delete ALL data except users and products!',
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9'
    });
    if (!first.isConfirmed) return;
    
    const { value } = await Swal.fire({
      title: 'Type RESET DATABASE to confirm', input: 'text', showCancelButton: true,
      confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9',
      inputValidator: (v) => v !== 'RESET DATABASE' ? 'Type exactly: RESET DATABASE' : null
    });
    if (!value) return;
    
    try {
      const adminId = localStorage.getItem('userId');
      await axios.post(`${BASE_URL}/api/reset/database`, { adminId: parseInt(adminId) }, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: 'Database Reset!', background: '#1e293b', color: '#f1f5f9' });
      window.location.reload();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Reset Failed', background: '#1e293b', color: '#f1f5f9' });
    }
  };


  const updateOrderStatus = async (itemId, status) => {
    try {
      const token = localStorage.getItem('token');
      const id = parseInt(itemId);
      if (isNaN(id)) {
        throw new Error('Invalid item ID');
      }
      await axios.put(`${BASE_URL}/order/items/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Swal.fire({
        title: 'Status Updated',
        icon: 'success',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      fetchData();
    } catch (error) {
      Swal.fire({
        title: 'Update Failed',
        text: error.response?.data?.message || error.message || 'Failed to update status.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'processing': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  const filteredOrders = (Array.isArray(orders) ? orders : []).filter(o => {
    const search = searchTerm.toLowerCase();
    return (
      o.mobileNumber?.toLowerCase().includes(search) ||
      o.id?.toString().includes(search) ||
      o.orderId?.toString().includes(search) ||
      o.user?.name?.toLowerCase().includes(search) ||
      o.product?.name?.toLowerCase().includes(search) ||
      o.product?.description?.toLowerCase().includes(search)
    );
  });

  const filteredUsers = (Array.isArray(users) ? users : []).filter(u =>
    u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.phone?.includes(userSearchTerm) ||
    u.id?.toString().includes(userSearchTerm)
  );

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'referralCodes', label: 'Referral Codes', icon: Gift },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'mtnExpress', label: 'MTN Express', icon: Wifi },
    { id: 'afaRegistration', label: 'AFA Registration', icon: FileText },
    { id: 'orderFiles', label: 'Order Files', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Admin Sidebar */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside ref={sidebarRef} className={`fixed z-50 h-screen w-72 bg-dark-900 border-r border-dark-700 flex flex-col transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo-icon.png" alt="Tsk5" className="w-10 h-10 rounded-xl" />
              <div>
                <h1 className="text-white font-bold">Tsk5</h1>
                <p className="text-dark-400 text-xs">Admin Panel</p>
              </div>
            </div>
            <button className="md:hidden text-dark-400" onClick={() => setIsSidebarOpen(false)}><X className="w-5 h-5" /></button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Users className="w-5 h-5" /><span>Manage Users</span>
          </button>
          <button onClick={() => { setShowAnnouncementModal(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Bell className="w-5 h-5" /><span>Announcements</span>
          </button>
          <button onClick={() => { setShowComplaintsModal(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center justify-between px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5" /><span>Complaints</span>
            </div>
            {complaintCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                {complaintCount > 99 ? '99+' : complaintCount}
              </span>
            )}
          </button>
          <button onClick={() => { setShowTransactionsModal(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <ShoppingCart className="w-5 h-5" /><span>Transactions</span>
          </button>
          <button onClick={() => { setShowPaymentMessagesModal(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Banknote className="w-5 h-5" /><span>Payment Messages</span>
          </button>
          <button onClick={() => { setShowCommissionModal(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <DollarSign className="w-5 h-5" /><span>Commission Summary</span>
          </button>
          <button onClick={() => { setShowExternalApiModal(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Key className="w-5 h-5" /><span>External API Keys</span>
          </button>
          <button onClick={() => { setShowOrderTracker(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Wifi className="w-5 h-5" /><span>Order Tracker</span>
          </button>
          <button onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Settings className="w-5 h-5" /><span>Settings</span>
          </button>
          <button onClick={() => { setActiveTab('mtnExpress'); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Wifi className="w-5 h-5" /><span>MTN Express</span>
          </button>
          <button onClick={() => { setActiveTab('afaRegistration'); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <FileText className="w-5 h-5" /><span>AFA Registration</span>
          </button>
          <button onClick={() => { setActiveTab('orderFiles'); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <FileText className="w-5 h-5" /><span>Order Files</span>
          </button>
          <button onClick={() => { setShowStorefrontWithdrawals(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Landmark className="w-5 h-5" /><span>Storefront Withdrawals</span>
          </button>
          <button onClick={() => { setShowManageStorefront(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Store className="w-5 h-5" /><span>Manage Storefronts</span>
          </button>
          <hr className="border-dark-700 my-2" />
          <button onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <User className="w-5 h-5" /><span>Profile</span>
          </button>
          <hr className="border-dark-700 my-2" />
          <button onClick={handleResetDatabase}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all">
            <RotateCcw className="w-5 h-5" /><span>Reset Database</span>
          </button>
          <button onClick={logoutUser}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut className="w-5 h-5" /><span>Logout</span>
          </button>
        </nav>
      </aside>

      <div className="flex-1 min-w-0 md:ml-72">
        {/* Header */}
        <header className="bg-dark-900/80 backdrop-blur border-b border-dark-700 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-dark-800 rounded-xl">
                  <Menu className="w-6 h-6 text-dark-300" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
                  <p className="text-dark-400 text-sm">Welcome back, {userName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {fraudAlerts.length > 0 && (
                  <button
                    onClick={() => { setShowSuspiciousActivity(true); setFraudBlinking(false); }}
                    className={`relative flex items-center gap-1.5 px-3 py-2 bg-red-500/20 border-2 border-red-500 rounded-xl text-red-400 font-bold text-xs sm:text-sm ${fraudBlinking ? 'animate-pulse' : ''}`}
                    style={fraudBlinking ? { animation: 'pulse 0.5s ease-in-out infinite, borderBlink 0.3s ease-in-out infinite alternate' } : {}}
                    title="Suspicious activity detected!"
                  >
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
                    <span className="hidden sm:inline">ALERT</span>
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{fraudAlerts.length}</span>
                  </button>
                )}
                <button onClick={() => setShowBeneficiaryModal(true)} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700" title="Beneficiary Records">
                  <Table2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </button>
                <button onClick={fetchData} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700">
                  <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-dark-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative" ref={notificationRef}>
                  <button onClick={() => setShowNotificationDropdown(!showNotificationDropdown)} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700 relative">
                    <Bell className="w-5 h-5 text-dark-400" />
                    {(orderCount + topupCount + complaintCount > 0) && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center animate-pulse">
                        {orderCount + topupCount + complaintCount > 99 ? '99+' : orderCount + topupCount + complaintCount}
                      </span>
                    )}
                  </button>
                  {showNotificationDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="bg-gradient-to-r from-cyan-500 to-indigo-600 p-3">
                        <h3 className="text-white font-semibold">Notifications</h3>
                      </div>
                      <div className="divide-y divide-dark-700 max-h-80 overflow-y-auto">
                        {orderCount > 0 && (
                          <button onClick={() => { setShowOrderTable(true); setShowNotificationDropdown(false); }} className="w-full p-3 text-left hover:bg-dark-700/50 flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-lg"><ShoppingCart className="w-4 h-4 text-amber-400" /></div>
                            <div><p className="text-dark-300 text-sm">Pending Orders</p><p className="text-dark-400 text-xs">{orderCount} orders</p></div>
                          </button>
                        )}
                        {topupCount > 0 && (
                          <button onClick={() => { setShowTopupsModal(true); setShowNotificationDropdown(false); }} className="w-full p-3 text-left hover:bg-dark-700/50 flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg"><Wallet className="w-4 h-4 text-emerald-400" /></div>
                            <div><p className="text-dark-300 text-sm">Topup Requests</p><p className="text-dark-400 text-xs">{topupCount} total</p></div>
                          </button>
                        )}
                        {complaintCount > 0 && (
                          <button onClick={() => { setShowComplaintsModal(true); setShowNotificationDropdown(false); }} className="w-full p-3 text-left hover:bg-dark-700/50 flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-lg"><Package className="w-4 h-4 text-red-400" /></div>
                            <div><p className="text-dark-300 text-sm">Pending Complaints</p><p className="text-dark-400 text-xs">{complaintCount} complaints</p></div>
                          </button>
                        )}
                        {orderCount === 0 && topupCount === 0 && complaintCount === 0 && (
                          <div className="p-4 text-center"><p className="text-dark-400 text-sm">No notifications</p></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-dark-700 px-3 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap text-sm sm:text-base active:scale-95 ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-dark-400 hover:bg-dark-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-4 sm:p-6 cursor-pointer active:scale-95 hover:border-cyan-500/50 transition-all" onClick={() => setActiveTab('users')}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="p-2 sm:p-3 bg-cyan-500/10 rounded-xl">
                          <Users className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500" />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-white">{stats.users}</p>
                      <p className="text-dark-400 text-xs sm:text-sm">Total Users</p>
                    </div>
                    
                    <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-4 sm:p-6 cursor-pointer active:scale-95 hover:border-purple-500/50 transition-all" onClick={() => setShowProductDialog(true)}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="p-2 sm:p-3 bg-purple-500/10 rounded-xl">
                          <Package className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-white">{stats.products}</p>
                      <p className="text-dark-400 text-xs sm:text-sm">Products</p>
                    </div>
                    <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-4 sm:p-6 cursor-pointer active:scale-95 hover:border-amber-500/50 transition-all" onClick={() => setShowOrderTable(true)}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="p-2 sm:p-3 bg-amber-500/10 rounded-xl">
                          <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                        </div>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-white">{stats.orders}</p>
                      <p className="text-dark-400 text-xs sm:text-sm">Total Orders</p>
                    </div>
                  </div>
                  
                  {/* Total Balance */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <p className="text-dark-300 text-sm sm:text-base">Total Agents Balance: <span className="text-emerald-400 font-bold text-lg sm:text-xl">GHS {stats.totalBalance?.toFixed(2) || '0.00'}</span></p>
                  </div>

                  {/* Recent Orders */}
                  <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Recent Orders ({(Array.isArray(orders) ? orders : []).slice(0, 10).length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-dark-400 text-sm border-b border-dark-700">
                            <th className="pb-3 font-medium">Order ID</th>
                            <th className="pb-3 font-medium">Customer</th>
                            <th className="pb-3 font-medium">Mobile</th>
                            <th className="pb-3 font-medium">Product</th>
                            <th className="pb-3 font-medium">Status</th>
                            <th className="pb-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(orders) ? orders : []).slice(0, 10).map((item, index) => {
                            const status = item.order?.items?.[0]?.status || item.status || 'N/A';
                            return (
                              <tr key={`${item.id}-${item.orderId}-${index}`} className="border-b border-dark-700/50">
                                <td className="py-3 text-white">#{item.orderId || item.id}</td>
                                <td className="py-3 text-dark-300">{item.user?.name || 'N/A'}</td>
                                <td className="py-3 text-dark-300">{item.mobileNumber?.startsWith('233') ? '0' + item.mobileNumber.substring(3) : (item.mobileNumber || 'N/A')}</td>
                                <td className="py-3 text-cyan-400">{item.product?.name || 'N/A'}</td>
                                <td className="py-3">
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                                    {status}
                                  </span>
                                </td>
                                <td className="py-3 text-dark-500 text-sm">
                                  {new Date(item.order?.createdAt || item.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (() => {
                const totalOrdersPages = Math.ceil(filteredOrders.length / ordersPerPage);
                const paginatedOrders = filteredOrders.slice((ordersPage - 1) * ordersPerPage, ordersPage * ordersPerPage);
                return (
                <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6 flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 className="text-lg font-bold text-white">All Orders ({filteredOrders.length})</h3>
                    <div className="flex gap-3 items-center">
                      <button onClick={() => setShowOrderTable(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium">
                        Open Full Table
                      </button>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => { setSearchTerm(e.target.value); setOrdersPage(1); }}
                          placeholder="Search orders..."
                          className="w-full bg-dark-900/50 border border-dark-600 rounded-xl pl-10 pr-4 py-2 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                      <p className="text-dark-400">No orders found</p>
                    </div>
                  ) : (
                  <>
                  <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-dark-400 text-sm border-b border-dark-700">
                          <th className="pb-3 font-medium">Order ID</th>
                          <th className="pb-3 font-medium">Customer</th>
                          <th className="pb-3 font-medium">Mobile</th>
                          <th className="pb-3 font-medium">Product</th>
                          <th className="pb-3 font-medium">Data</th>
                          <th className="pb-3 font-medium">Status</th>
                          <th className="pb-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOrders.map((item, index) => {
                          const status = item.order?.items?.[0]?.status || item.status || 'N/A';
                          const isCancelled = status === 'Cancelled' || status === 'Canceled';
                          return (
                            <tr key={`${item.id}-${item.orderId}-${index}`} className={`border-b border-dark-700/50 ${isCancelled ? 'bg-red-900/10' : ''}`}>
                              <td className="py-3 text-white font-medium">#{item.orderId || item.id}</td>
                              <td className="py-3 text-dark-300">{item.user?.name || 'N/A'}</td>
                              <td className="py-3 text-dark-300">{item.mobileNumber?.startsWith('233') ? '0' + item.mobileNumber.substring(3) : (item.mobileNumber || 'N/A')}</td>
                              <td className="py-3 text-dark-400">{item.product?.name || 'N/A'}</td>
                              <td className="py-3 text-cyan-400 font-semibold">{item.product?.description?.replace(/\D+$/, '') || 'N/A'}</td>
                              <td className="py-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                                  {status}
                                </span>
                              </td>
                              <td className="py-3">
                                <div className="flex gap-1">
                                  {(status === 'Pending' || status === 'Completed') && (
                                    <button onClick={() => updateOrderStatus(item.id, 'Processing')} className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20" title="Mark Processing">
                                      <RefreshCw className="w-4 h-4" />
                                    </button>
                                  )}
                                  {(status === 'Pending' || status === 'Processing') && (
                                    <button onClick={() => updateOrderStatus(item.id, 'Completed')} className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20" title="Mark Complete">
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  {!isCancelled && (status === 'Pending' || status === 'Processing') && (
                                    <button onClick={() => updateOrderStatus(item.id, 'Cancelled')} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20" title="Cancel">
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination Controls */}
                  {totalOrdersPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-dark-700">
                      <p className="text-dark-400 text-sm">
                        Showing {(ordersPage - 1) * ordersPerPage + 1} - {Math.min(ordersPage * ordersPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOrdersPage(1)}
                          disabled={ordersPage === 1}
                          className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 text-sm disabled:opacity-50"
                        >
                          First
                        </button>
                        <button
                          onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                          disabled={ordersPage === 1}
                          className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 text-sm disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <span className="px-3 py-1.5 text-white text-sm">Page {ordersPage} of {totalOrdersPages}</span>
                        <button
                          onClick={() => setOrdersPage(p => Math.min(totalOrdersPages, p + 1))}
                          disabled={ordersPage === totalOrdersPages}
                          className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 text-sm disabled:opacity-50"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setOrdersPage(totalOrdersPages)}
                          disabled={ordersPage === totalOrdersPages}
                          className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 text-sm disabled:opacity-50"
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
                );
              })()}

              {activeTab === 'users' && (
                <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6 flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white">Manage Users</h3>
                      <p className="text-dark-400 text-sm">Total Balance: <span className="text-emerald-400 font-semibold">GHS {stats.totalBalance?.toFixed(2) || '0.00'}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                        <input type="text" value={userSearchTerm} onChange={(e) => { setUserSearchTerm(e.target.value); setCurrentPage(1); }}
                          placeholder="Search users..." className="bg-dark-900 border border-dark-600 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder-dark-500 focus:border-cyan-500 focus:outline-none w-48" />
                      </div>
                      <button onClick={openAddUserModal} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-medium text-sm">
                        <Plus className="w-4 h-4" /> Add User
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-dark-400 text-sm border-b border-dark-700">
                          <th className="pb-3 font-medium">ID</th>
                          <th className="pb-3 font-medium">Name</th>
                          <th className="pb-3 font-medium">Phone</th>
                          <th className="pb-3 font-medium">Role</th>
                          <th className="pb-3 font-medium">Balance</th>
                          <th className="pb-3 font-medium">Loan</th>
                          <th className="pb-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentUsers.map((user) => (
                          <tr key={user.id} className="border-b border-dark-700/50 hover:bg-dark-800/50">
                            <td className="py-3 text-dark-400">#{user.id}</td>
                            <td className="py-3 text-white font-medium">
                              <div className="flex items-center gap-2">
                                {user.name}
                                {user.isSuspended && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">SUSPENDED</span>}
                              </div>
                            </td>
                            <td className="py-3 text-dark-300">{user.phone}</td>
                            <td className="py-3">
                              <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-medium">{user.role}</span>
                            </td>
                            <td className="py-3 text-emerald-400 font-medium">GHS {parseFloat(user.loanBalance || 0).toFixed(2)}</td>
                            <td className="py-3">
                              {editingLoanUserId === user.id ? (
                                <div className="flex items-center gap-2">
                                  <input type="number" value={newLoanBalance} onChange={(e) => setNewLoanBalance(e.target.value)} placeholder="-/+" 
                                    className="w-20 bg-dark-900 border border-dark-600 rounded-lg px-2 py-1 text-white text-sm" />
                                  <button onClick={() => handleSaveLoan(user.id)} className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg"><Save className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-dark-300">GHS {user.adminLoanBalance || 0}</span>
                                  <button onClick={() => { setEditingLoanUserId(user.id); setNewLoanBalance(''); }} className="p-1 bg-dark-700 text-dark-400 rounded-lg hover:text-white"><Banknote className="w-4 h-4" /></button>
                                </div>
                              )}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditUserModal(user)} className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                <button onClick={() => openRefundModal(user)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg"><Wallet className="w-4 h-4" /></button>
                                {user.role !== 'ADMIN' && (
                                  <button onClick={() => handleToggleSuspend(user)} className={`p-1.5 rounded-lg ${user.isSuspended ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`} title={user.isSuspended ? 'Unsuspend' : 'Suspend'}>
                                    {user.isSuspended ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className="px-3 py-1 bg-dark-700 text-dark-300 rounded-lg disabled:opacity-50">←</button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page = i + 1;
                        if (totalPages > 5) {
                          if (currentPage > 3) page = currentPage - 2 + i;
                          if (currentPage > totalPages - 2) page = totalPages - 4 + i;
                        }
                        return page <= totalPages ? (
                          <button key={page} onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded-lg ${currentPage === page ? 'bg-cyan-500 text-white' : 'bg-dark-700 text-dark-300'}`}>{page}</button>
                        ) : null;
                      })}
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-dark-700 text-dark-300 rounded-lg disabled:opacity-50">→</button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'mtnExpress' && (
                <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6">
                  <MtnExpressAdmin />
                </div>
              )}
              {activeTab === 'afaRegistration' && (
                <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6">
                  <AfaRegistrationAdmin />
                </div>
              )}

              {activeTab === 'orderFiles' && (
                <OrderFiles />
              )}

              {activeTab === 'products' && (
                <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">All Products ({(Array.isArray(products) ? products : []).length})</h3>
                    <button onClick={() => setShowProductDialog(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-medium">
                      <Plus className="w-4 h-4" /> Manage Products
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {(Array.isArray(products) ? products : []).slice(0, 12).map((product) => (
                      <div key={product.id} className="bg-dark-900/50 rounded-xl border border-dark-700 p-4 hover:border-dark-600 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-medium text-sm">{product.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${product.stock > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {product.stock}
                          </span>
                        </div>
                        <p className="text-dark-500 text-xs mb-3 truncate">{product.description}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-white">GHS {product.price?.toFixed(2)}</span>
                          <span className={`w-2 h-2 rounded-full ${product.showInShop ? 'bg-emerald-500' : 'bg-dark-600'}`} title={product.showInShop ? 'In Shop' : 'Hidden'}></span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(Array.isArray(products) ? products : []).length > 12 && (
                    <p className="text-center text-dark-400 mt-4">Showing 12 of {(Array.isArray(products) ? products : []).length} products. <button onClick={() => setShowProductDialog(true)} className="text-cyan-400 hover:underline">View all</button></p>
                  )}
                </div>
              )}

              {activeTab === 'referralCodes' && (
                <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6">
                  <ReferralCodeManager />
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6 max-w-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Site Settings</h3>
                      <p className="text-dark-400 text-sm">Update MoMo details used for wallet deposits and Paystack secret key</p>
                    </div>
                    {settingsLoading && <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">MoMo Number (wallet deposit)</label>
                      <input
                        type="text"
                        value={settingsForm.momoNumber}
                        onChange={(e) => setSettingsForm({ ...settingsForm, momoNumber: e.target.value })}
                        placeholder="e.g. 0551234567"
                        className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">MoMo Account Name</label>
                      <input
                        type="text"
                        value={settingsForm.momoName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, momoName: e.target.value })}
                        placeholder="Account name for deposits"
                        className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-dark-300">
                        Paystack Secret Key
                        {settingsForm.hasPaystackSecret && (
                          <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-1 rounded-full">Saved</span>
                        )}
                      </label>
                      <input
                        type="password"
                        value={settingsForm.paystackSecretKey}
                        onChange={(e) => setSettingsForm({ ...settingsForm, paystackSecretKey: e.target.value })}
                        placeholder={settingsForm.hasPaystackSecret ? '••••••••••••' : 'sk_live_xxx'}
                        className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                      />
                      <p className="text-xs text-dark-400">Leave blank to keep existing secret key.</p>
                    </div>

                    <div className="border-t border-dark-700 pt-4 mt-4">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div>
                          <span className="text-sm font-medium text-dark-300">Allow Public Registration</span>
                          <p className="text-xs text-dark-400 mt-0.5">Toggle signup availability on the site</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsForm(prev => ({ ...prev, registrationEnabled: !prev.registrationEnabled }));
                          }}
                          className={`relative w-12 h-6 rounded-full transition-colors ${settingsForm.registrationEnabled ? 'bg-emerald-500' : 'bg-dark-600'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settingsForm.registrationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </label>
                    </div>

                    <div className="border-t border-dark-700 pt-4 mt-4">
                      <label className="flex items-center justify-between cursor-pointer mb-3">
                        <div>
                          <span className="text-sm font-medium text-dark-300">Auto-Process Orders (Skanka5)</span>
                          <p className="text-xs text-dark-400 mt-0.5">When ON, MTN/Telecel/AT orders are automatically routed to Skanka5 for processing</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsForm(prev => ({ ...prev, autoProcessOrders: !prev.autoProcessOrders }));
                          }}
                          className={`relative w-12 h-6 rounded-full transition-colors ${settingsForm.autoProcessOrders ? 'bg-violet-500' : 'bg-dark-600'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settingsForm.autoProcessOrders ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </label>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-dark-300">
                          Skanka5 API Key
                          {settingsForm.hasSkanka5ApiKey && (
                            <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-1 rounded-full">Saved</span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={settingsForm.skanka5ApiKey}
                          onChange={(e) => setSettingsForm({ ...settingsForm, skanka5ApiKey: e.target.value })}
                          placeholder={settingsForm.hasSkanka5ApiKey ? '••••••••••••' : 'Enter your Skanka5 API key'}
                          className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-violet-500 focus:outline-none"
                        />
                        <p className="text-xs text-dark-400">Leave blank to keep existing API key. Get your key from agent.skanka5.com</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={fetchSettings}
                      disabled={settingsLoading || settingsSaving}
                      className="px-4 py-2 bg-dark-700 text-dark-200 rounded-xl hover:bg-dark-600 disabled:opacity-50"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={saveSettings}
                      disabled={settingsSaving}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save Settings</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Product Dialog */}
      <ProductDialog isOpen={showProductDialog} onClose={() => { setShowProductDialog(false); fetchData(); }} />

      {/* Announcement Modal */}
      <AnnouncementAdmin isOpen={showAnnouncementModal} onClose={() => setShowAnnouncementModal(false)} />

      {/* Complaints Modal */}
      <ComplaintsViewer isOpen={showComplaintsModal} onClose={() => setShowComplaintsModal(false)} />

      {/* Transactions Modal */}
      <TransactionalAdminModal isOpen={showTransactionsModal} onClose={() => setShowTransactionsModal(false)} />

      {/* Order Table Modal */}
      <OrderTable isOpen={showOrderTable} onClose={() => setShowOrderTable(false)} />

      {/* Topups Modal */}
      <TopupsOrdered isOpen={showTopupsModal} onClose={() => setShowTopupsModal(false)} justCount={topupCount} />

      {/* Agent Commission Modal */}
      <AgentCommissionModal isOpen={showCommissionModal} onClose={() => setShowCommissionModal(false)} />

      {/* Payment Messages Modal */}
      <PaymentMessagesModal isOpen={showPaymentMessagesModal} onClose={() => setShowPaymentMessagesModal(false)} />

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">{isEditingUser ? 'Edit User' : 'Add New User'}</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Name" value={isEditingUser ? selectedUser?.name : newUser.name}
                onChange={(e) => isEditingUser ? setSelectedUser({ ...selectedUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none" />
              <input type="email" placeholder="Email" value={isEditingUser ? selectedUser?.email : newUser.email}
                onChange={(e) => isEditingUser ? setSelectedUser({ ...selectedUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none" />
              <input type="tel" placeholder="Phone" value={isEditingUser ? selectedUser?.phone : newUser.phone}
                onChange={(e) => isEditingUser ? setSelectedUser({ ...selectedUser, phone: e.target.value }) : setNewUser({ ...newUser, phone: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none" />
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={isEditingUser ? selectedUser?.password : newUser.password}
                    onChange={(e) => isEditingUser ? setSelectedUser({ ...selectedUser, password: e.target.value }) : setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <button onClick={generateRandomPassword} className="p-3 bg-dark-700 text-dark-300 rounded-xl hover:bg-dark-600">🔄</button>
              </div>
              <select value={isEditingUser ? selectedUser?.role : newUser.role}
                onChange={(e) => isEditingUser ? setSelectedUser({ ...selectedUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="SUPER">SUPER</option>
                <option value="NORMAL">NORMAL</option>
                <option value="OTHER">OTHER</option>
              </select>
              {isEditingUser && (
                <label className="flex items-center gap-2 text-dark-300">
                  <input type="checkbox" checked={selectedUser?.isLoggedIn || false}
                    onChange={(e) => setSelectedUser({ ...selectedUser, isLoggedIn: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-500" />
                  Logged In
                </label>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowUserModal(false)} className="flex-1 px-4 py-3 bg-dark-700 text-dark-300 rounded-xl font-medium hover:bg-dark-600">Cancel</button>
              <button onClick={isEditingUser ? handleUpdateUser : handleAddUser}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-medium">{isEditingUser ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-white mb-2">Originate Refund</h2>
            <p className="text-dark-400 text-sm mb-6">User ID: #{refundUserId}</p>
            <input type="number" placeholder="Refund Amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowRefundModal(false)} className="flex-1 px-4 py-3 bg-dark-700 text-dark-300 rounded-xl font-medium hover:bg-dark-600">Cancel</button>
              <button onClick={handleRefund} className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium">Refund</button>
            </div>
          </div>
        </div>
      )}

      {/* Beneficiary Table Modal */}
      <BeneficiaryTableModal isOpen={showBeneficiaryModal} onClose={() => setShowBeneficiaryModal(false)} />

      {/* External API Keys Modal */}
      <ExternalApiKeys isOpen={showExternalApiModal} onClose={() => setShowExternalApiModal(false)} />

      {/* Order Tracker Modal */}
      <OrderTracker isOpen={showOrderTracker} onClose={() => setShowOrderTracker(false)} onFraudDetected={(alerts) => { setFraudAlerts(alerts); setFraudBlinking(true); }} />

      {/* Suspicious Activity Modal */}
      <SuspiciousActivity isOpen={showSuspiciousActivity} onClose={() => setShowSuspiciousActivity(false)} onAlertsUpdate={(activeAlerts) => { setFraudAlerts(activeAlerts); if (activeAlerts.length > 0) setFraudBlinking(true); }} />

      {/* Storefront Withdrawals Modal */}
      <StorefrontWithdrawalAdmin isOpen={showStorefrontWithdrawals} onClose={() => setShowStorefrontWithdrawals(false)} />

      {/* Manage Storefront Modal */}
      <ManageStorefront isOpen={showManageStorefront} onClose={() => setShowManageStorefront(false)} />

      {/* Floating Chat */}
      <FloatingChatButton currentUser={{ id: parseInt(localStorage.getItem('userId')), name: localStorage.getItem('name'), role: 'admin' }} />
    </div>
  );
};

export default AdminDashboard;
