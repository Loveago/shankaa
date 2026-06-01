import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, RefreshCw, Search, CheckCircle, XCircle, Eye, Trash2, Clock, User, Phone, MapPin, Briefcase, CreditCard, Hash, FileText } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import Swal from 'sweetalert2';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const statusStyles = {
  pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  rejected: 'bg-red-500/10 text-red-300 border border-red-500/30'
};

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle
};

const formatDate = (d) => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const idTypeLabels = {
  NATIONAL_ID: 'National ID',
  VOTER_ID: 'Voter ID'
};

const AfaRegistrationAdmin = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReg, setSelectedReg] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const res = await axios.get(`${BASE_URL}/api/afa-registration`, {
        headers: getAuthHeaders(),
        params
      });
      if (res.data.success) {
        setRegistrations(res.data.registrations || []);
      }
    } catch (error) {
      console.error('Error fetching AFA registrations:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const handleUpdateStatus = async (id, newStatus) => {
    const actionLabel = newStatus === 'approved' ? 'approve' : 'reject';
    const icon = newStatus === 'approved' ? 'question' : 'warning';

    const result = await Swal.fire({
      title: `${newStatus === 'approved' ? 'Approve' : 'Reject'} Registration?`,
      text: `Are you sure you want to ${actionLabel} this registration?`,
      icon,
      showCancelButton: true,
      confirmButtonColor: newStatus === 'approved' ? '#10b981' : '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: `Yes, ${actionLabel}`,
      input: 'textarea',
      inputPlaceholder: 'Optional admin notes...',
      inputAttributes: { rows: '3' },
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await axios.put(
        `${BASE_URL}/api/afa-registration/${id}`,
        { status: newStatus, adminNotes: result.value || '' },
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: `Registration ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
          timer: 1500,
          showConfirmButton: false,
          background: '#1e293b',
          color: '#f1f5f9'
        });
        fetchRegistrations();
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to update status',
        text: error.response?.data?.message || 'Something went wrong',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Registration?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await axios.delete(`${BASE_URL}/api/afa-registration/${id}`, {
        headers: getAuthHeaders()
      });

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          timer: 1500,
          showConfirmButton: false,
          background: '#1e293b',
          color: '#f1f5f9'
        });
        setShowDetail(false);
        setSelectedReg(null);
        fetchRegistrations();
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    }
  };

  const filteredRegistrations = registrations.filter((reg) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      reg.fullName?.toLowerCase().includes(term) ||
      reg.phoneNumber?.includes(term) ||
      reg.idNumber?.toLowerCase().includes(term) ||
      reg.location?.toLowerCase().includes(term)
    );
  });

  const statusTabs = [
    { key: 'all', label: 'All', count: registrations.length },
    { key: 'pending', label: 'Pending', count: registrations.filter((r) => r.status === 'pending').length },
    { key: 'approved', label: 'Approved', count: registrations.filter((r) => r.status === 'approved').length },
    { key: 'rejected', label: 'Rejected', count: registrations.filter((r) => r.status === 'rejected').length }
  ];

  const StatIcon = selectedReg ? statusIcons[selectedReg.status] || Clock : Clock;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">AFA Registrations</h2>
          <p className="text-sm text-dark-400">Manage user registration requests</p>
        </div>
        <button
          onClick={fetchRegistrations}
          disabled={loading}
          className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-white border border-dark-600 disabled:opacity-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === tab.key
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-dark-800 text-dark-400 border border-dark-700 hover:border-dark-500'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                statusFilter === tab.key ? 'bg-cyan-500/30' : 'bg-dark-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Search by name, phone, ID number or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </div>

      {/* Detail View */}
      {showDetail && selectedReg ? (
        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShowDetail(false); setSelectedReg(null); }}
                className="p-2 rounded-lg hover:bg-dark-700 transition-colors text-dark-400 hover:text-white"
              >
                ← Back
              </button>
              <h3 className="text-lg font-bold text-white">Registration Details</h3>
            </div>
            {selectedReg.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedReg.id, 'approved')}
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedReg.id, 'rejected')}
                  className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                <User className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-dark-500">Full Name</p>
                  <p className="text-white font-medium">{selectedReg.fullName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                <Phone className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-dark-500">Phone Number</p>
                  <p className="text-white font-medium">{selectedReg.phoneNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                <MapPin className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-dark-500">Town / Location</p>
                  <p className="text-white font-medium">{selectedReg.location}</p>
                </div>
              </div>
              {selectedReg.occupation && (
                <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                  <Briefcase className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-xs text-dark-500">Occupation</p>
                    <p className="text-white font-medium">{selectedReg.occupation}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-dark-500">ID Type</p>
                  <p className="text-white font-medium">{idTypeLabels[selectedReg.idType] || selectedReg.idType}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                <Hash className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-dark-500">ID Number</p>
                  <p className="text-white font-medium">{selectedReg.idNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                <Clock className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-dark-500">Submitted</p>
                  <p className="text-white font-medium">{formatDate(selectedReg.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-dark-900/50 rounded-xl">
                <StatIcon className={`w-5 h-5 ${
                  selectedReg.status === 'approved' ? 'text-emerald-400' :
                  selectedReg.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                }`} />
                <div>
                  <p className="text-xs text-dark-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusStyles[selectedReg.status] || ''}`}>
                    {selectedReg.status.charAt(0).toUpperCase() + selectedReg.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {selectedReg.adminNotes && (
            <div className="mt-6 p-4 bg-dark-900/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-dark-400" />
                <p className="text-xs text-dark-500 font-medium">Admin Notes</p>
              </div>
              <p className="text-dark-300 text-sm">{selectedReg.adminNotes}</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-dark-700 flex justify-end">
            <button
              onClick={() => handleDelete(selectedReg.id)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Delete Registration
            </button>
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-dark-500" />
              </div>
              <h3 className="text-lg font-semibold text-dark-300 mb-2">No Registrations Found</h3>
              <p className="text-dark-500 text-sm">
                {statusFilter !== 'all'
                  ? `No ${statusFilter} registrations at the moment.`
                  : 'No AFA registrations have been submitted yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">Applicant</th>
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">ID Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">ID Number</th>
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filteredRegistrations.map((reg) => {
                    const StatusIcon = statusIcons[reg.status] || Clock;
                    return (
                      <tr
                        key={reg.id}
                        className="hover:bg-dark-700/50 transition-colors cursor-pointer"
                        onClick={() => { setSelectedReg(reg); setShowDetail(true); }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                              <User className="w-4 h-4 text-cyan-400" />
                            </div>
                            <span className="text-sm font-medium text-white">{reg.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-300">{reg.phoneNumber}</td>
                        <td className="px-4 py-3 text-sm text-dark-300">{idTypeLabels[reg.idType] || reg.idType}</td>
                        <td className="px-4 py-3 text-sm text-dark-300 font-mono">{reg.idNumber}</td>
                        <td className="px-4 py-3 text-sm text-dark-300">{reg.location}</td>
                        <td className="px-4 py-3 text-sm text-dark-300 whitespace-nowrap">{formatDate(reg.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[reg.status] || ''}`}>
                            <StatusIcon className="w-3 h-3" />
                            {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedReg(reg); setShowDetail(true); }}
                              className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-cyan-400 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {reg.status === 'pending' && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(reg.id, 'approved'); }}
                                  className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-emerald-400 transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(reg.id, 'rejected'); }}
                                  className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-red-400 transition-colors"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(reg.id); }}
                              className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AfaRegistrationAdmin;
