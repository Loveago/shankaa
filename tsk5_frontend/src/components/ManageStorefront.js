import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Store, ShoppingCart, CheckCircle, XCircle, RefreshCw, Eye, ToggleLeft, ToggleRight, ExternalLink, X } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';

const ManageStorefront = ({ isOpen, onClose }) => {
  const [storefronts, setStorefronts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStorefront, setSelectedStorefront] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchStorefronts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${BASE_URL}/api/storefront/admin/referrals`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Get unique agents with storefronts
      const agentMap = new Map();
      res.data?.orders?.forEach(order => {
        if (!agentMap.has(order.agentId)) {
          agentMap.set(order.agentId, {
            id: order.agentId,
            name: order.agentName,
            slug: order.storefrontSlug,
            totalOrders: 0,
            totalRevenue: 0,
            active: true
          });
        }
        const agent = agentMap.get(order.agentId);
        agent.totalOrders += 1;
        agent.totalRevenue += parseFloat(order.commission || 0);
      });

      setStorefronts(Array.from(agentMap.values()));
    } catch (err) {
      console.error('Error fetching storefronts:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load storefronts',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchStorefronts();
  }, [isOpen]);

  const handleToggleActive = async (storefront) => {
    const newState = !storefront.active;
    const result = await Swal.fire({
      title: newState ? 'Activate Storefront?' : 'Deactivate Storefront?',
      text: newState 
        ? `This will activate ${storefront.name}'s storefront.` 
        : `This will deactivate ${storefront.name}'s storefront. Customers won't be able to place orders.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: newState ? '#10b981' : '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: newState ? 'Activate' : 'Deactivate',
      cancelButtonText: 'Cancel',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (result.isConfirmed) {
      try {
        // Note: This would need a backend endpoint to toggle storefront status
        // For now, we'll just update local state
        setStorefronts(prev => prev.map(s =>
          s.id === storefront.id ? { ...s, active: newState } : s
        ));
        
        Swal.fire({
          icon: 'success',
          title: newState ? 'Activated!' : 'Deactivated!',
          text: `${storefront.name}'s storefront has been ${newState ? 'activated' : 'deactivated'}`,
          timer: 2000,
          showConfirmButton: false,
          background: '#1e293b',
          color: '#f1f5f9'
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update storefront status',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    }
  };

  const handleViewDetails = (storefront) => {
    setSelectedStorefront(storefront);
    setShowDetailsModal(true);
  };

  const filteredStorefronts = storefronts.filter(sf => 
    sf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sf.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Store className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">Manage Storefronts</h2>
                <p className="text-purple-100 text-sm">View and manage all agent storefronts</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={fetchStorefronts} 
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-dark-700 bg-dark-900/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Store className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Total Storefronts</p>
                  <p className="text-xl font-bold text-white">{storefronts.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Active</p>
                  <p className="text-xl font-bold text-white">
                    {storefronts.filter(s => s.active).length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Total Orders</p>
                  <p className="text-xl font-bold text-white">
                    {storefronts.reduce((sum, s) => sum + s.totalOrders, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : filteredStorefronts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Store className="w-16 h-16 text-dark-600 mb-4" />
                <p className="text-dark-400 text-lg">No storefronts found</p>
                <p className="text-dark-500 text-sm">
                  {searchTerm ? 'Try a different search term' : 'Storefronts will appear here once agents create them'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStorefronts.map((storefront) => (
                  <div key={storefront.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-purple-500/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30">
                            <Store className="w-3 h-3" /> {storefront.name}
                          </span>
                          <span className="text-xs text-dark-500">
                            Slug: {storefront.slug}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
                            storefront.active 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}>
                            {storefront.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {storefront.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-dark-400 text-xs">Total Orders</p>
                            <p className="text-lg font-semibold text-white">{storefront.totalOrders}</p>
                          </div>
                          <div>
                            <p className="text-dark-400 text-xs">Total Revenue</p>
                            <p className="text-lg font-semibold text-emerald-400">GHS {storefront.totalRevenue.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-dark-400 text-xs">Avg Order Value</p>
                            <p className="text-lg font-semibold text-white">
                              GHS {(storefront.totalOrders > 0 ? storefront.totalRevenue / storefront.totalOrders : 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleViewDetails(storefront)}
                          className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" /> View
                        </button>
                        <button
                          onClick={() => handleToggleActive(storefront)}
                          className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 ${
                            storefront.active
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          }`}
                        >
                          {storefront.active ? (
                            <>
                              <ToggleRight className="w-4 h-4" /> Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4" /> Activate
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedStorefront && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Store className="w-8 h-8 text-white" />
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedStorefront.name}</h3>
                  <p className="text-purple-100 text-sm">Storefront Details</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-dark-900/50 rounded-xl p-4">
                  <p className="text-dark-400 text-xs mb-1">Storefront Slug</p>
                  <p className="text-white font-mono text-sm break-all">{selectedStorefront.slug}</p>
                </div>
                <div className="bg-dark-900/50 rounded-xl p-4">
                  <p className="text-dark-400 text-xs mb-1">Status</p>
                  <p className={`font-medium ${selectedStorefront.active ? 'text-emerald-400' : 'text-red-400'}`}>
                    {selectedStorefront.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="bg-dark-900/50 rounded-xl p-4">
                  <p className="text-dark-400 text-xs mb-1">Total Orders</p>
                  <p className="text-white font-semibold text-lg">{selectedStorefront.totalOrders}</p>
                </div>
                <div className="bg-dark-900/50 rounded-xl p-4">
                  <p className="text-dark-400 text-xs mb-1">Total Revenue</p>
                  <p className="text-emerald-400 font-semibold text-lg">GHS {selectedStorefront.totalRevenue.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <a
                  href={`${BASE_URL.replace('/api', '')}/store/${selectedStorefront.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  View Storefront <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManageStorefront;
