import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { MessageSquareWarning, X, CheckCircle, Clock, AlertCircle, Phone, Loader2, RefreshCw, Trash2, Copy, DollarSign, Image as ImageIcon, Upload, ExternalLink, ClipboardPaste } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';
import socketIO from 'socket.io-client';

// Isolated update-status dialog.
const UpdateStatusDialog = memo(({ complaint, initialNotes, onClose, onUpdate }) => {
  const [notes, setNotes] = useState(initialNotes || '');

  useEffect(() => {
    if (!complaint) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [complaint, onClose]);

  if (!complaint) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-md" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">Update Complaint Status</h3>
        <textarea className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 resize-none mb-4"
          placeholder="Admin notes (optional)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex gap-3 mb-3">
          <button onClick={() => onUpdate(complaint.id, 'reviewed', notes)}
            className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600">Mark Reviewed</button>
          <button onClick={() => onUpdate(complaint.id, 'resolved', notes)}
            className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600">Mark Resolved</button>
        </div>
        <button onClick={onClose} className="w-full px-4 py-2 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600">Cancel</button>
      </div>
    </div>
  );
});

// Helper: extract filename from stored path and return API-based image URL
const getImageUrl = (storedPath) => {
  if (!storedPath) return '';
  const filename = storedPath.split('/').pop();
  return `${BASE_URL}/api/complaints/image/${filename}`;
};

const ComplaintsViewer = ({ isOpen, onClose }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [pastingId, setPastingId] = useState(null);
  const fileInputRef = useRef(null);
  const hiddenPasteRef = useRef(null);
  const pasteComplaintIdRef = useRef(null);
  const statusFilterRef = useRef(statusFilter);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => { statusFilterRef.current = statusFilter; }, [statusFilter]);

  const fetchComplaints = useCallback(async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role?.toUpperCase() !== 'ADMIN') return;
    setLoading(true);
    try {
      const currentFilter = statusFilterRef.current;
      const statusParam = currentFilter !== 'all' ? `?status=${currentFilter}` : '';
      const res = await axios.get(`${BASE_URL}/api/complaints${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let complaintsData = res.data.data || [];
      // Sort complaints: pending first, then reviewed, resolved, refunded
      const statusOrder = { pending: 0, reviewed: 1, resolved: 2, refunded: 3 };
      complaintsData.sort((a, b) => {
        const aOrder = statusOrder[a.status] ?? 99;
        const bOrder = statusOrder[b.status] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Within same status, sort by createdAt descending (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setComplaints(complaintsData);
    } catch (err) {
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingCount = useCallback(async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role?.toUpperCase() !== 'ADMIN') return;
    try {
      const res = await axios.get(`${BASE_URL}/api/complaints/pending/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingCount(res.data.data?.count || 0);
    } catch (err) { /* silent */ }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role?.toUpperCase() !== 'ADMIN') return;
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) fetchComplaints();
  }, [isOpen, statusFilter, fetchComplaints]);

  useEffect(() => {
    if (!isOpen) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      return;
    }
    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('new-complaint', () => { fetchComplaints(); fetchPendingCount(); });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [isOpen, fetchComplaints, fetchPendingCount]);

  const handleUpdateStatus = async (id, newStatus, adminNotes = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${BASE_URL}/api/complaints/${id}`, { status: newStatus, adminNotes }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Swal.fire({ icon: 'success', title: 'Status Updated', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      setSelectedComplaint(null);
      fetchComplaints();
      fetchPendingCount();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: err.response?.data?.message || 'Failed to update', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleRefund = async (id) => {
    const result = await Swal.fire({
      title: 'Refund Order?',
      text: 'This will refund the customer for this complaint and mark it as refunded. Continue?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8b5cf6',
      confirmButtonText: 'Yes, Refund',
      cancelButtonText: 'Cancel',
      background: '#1e293b',
      color: '#f1f5f9'
    });
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${BASE_URL}/api/complaints/${id}/refund`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        Swal.fire({ icon: 'success', title: 'Refunded!', timer: 2000, background: '#1e293b', color: '#f1f5f9' });
        fetchComplaints();
        fetchPendingCount();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Refund Failed', text: err.response?.data?.message || 'Failed to process refund', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const handleUploadProof = useCallback(async (complaintId, file) => {
    if (!file) return;
    setUploadingId(complaintId);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('proofImage', file);
      await axios.post(`${BASE_URL}/api/complaints/${complaintId}/proof-image`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire({ icon: 'success', title: 'Proof Image Uploaded', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      fetchComplaints();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: err.response?.data?.message || 'Failed to upload image', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setUploadingId(null);
    }
  }, [fetchComplaints]);

  // Paste image from clipboard using a hidden textarea + paste event.
  // This works on all browsers (PC + mobile) without requiring clipboard-read permission.
  const handlePasteEvent = useCallback(async (e) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const complaintId = pasteComplaintIdRef.current;
        if (complaintId) {
          e.preventDefault();
          await handleUploadProof(complaintId, file);
        }
      } else {
        Swal.fire({
          icon: 'warning', title: 'Not an Image',
          text: 'Clipboard does not contain an image. Copy an image first, then paste again.',
          background: '#1e293b', color: '#f1f5f9'
        });
      }
    }
    // Reset pasting state
    setPastingId(null);
    pasteComplaintIdRef.current = null;
  }, [handleUploadProof]);

  const handlePasteClipboard = (complaintId) => {
    pasteComplaintIdRef.current = complaintId;
    setPastingId(complaintId);
    if (hiddenPasteRef.current) {
      hiddenPasteRef.current.focus();
      Swal.fire({
        icon: 'info',
        title: 'Ready to Paste',
        text: 'Press Ctrl+V (or Cmd+V) now to paste the image from your clipboard.',
        timer: 3000,
        timerProgressBar: true,
        background: '#1e293b',
        color: '#f1f5f9',
        showConfirmButton: false
      });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Complaint?', text: 'This action cannot be undone', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9'
    });
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${BASE_URL}/api/complaints/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchComplaints();
        fetchPendingCount();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const handleDeleteImage = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Proof Image?',
      text: 'Remove the uploaded proof screenshot from this complaint?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete Image',
      cancelButtonText: 'Cancel',
      background: '#1e293b',
      color: '#f1f5f9'
    });
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${BASE_URL}/api/complaints/${id}/proof-image`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        Swal.fire({ icon: 'success', title: 'Image Deleted', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
        fetchComplaints();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', text: err.response?.data?.message || 'Failed to delete image', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'reviewed': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'refunded': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-dark-700 text-dark-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'reviewed': return <AlertCircle className="w-3 h-3" />;
      case 'resolved': return <CheckCircle className="w-3 h-3" />;
      case 'refunded': return <DollarSign className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Hidden file input for proof image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const complaintId = e.target.dataset.complaintId;
          if (file && complaintId) handleUploadProof(parseInt(complaintId), file);
          e.target.value = '';
        }}
      />

      {/* Hidden textarea for clipboard paste (works on PC + mobile) */}
      <textarea
        ref={hiddenPasteRef}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        onChange={() => {}}
        onPaste={handlePasteEvent}
        tabIndex={-1}
      />

      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquareWarning className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">Customer Complaints</h2>
                <p className="text-white/80 text-sm">{pendingCount} pending</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchComplaints} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-b border-dark-700 bg-dark-900/50">
            {['all', 'pending', 'reviewed', 'resolved', 'refunded'].map((filter) => (
              <button key={filter} onClick={() => setStatusFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter ? 'bg-red-500 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-4 overflow-y-auto flex-1 min-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
            ) : complaints.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquareWarning className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                <p className="text-dark-400">No complaints found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <div key={complaint.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusStyle(complaint.status)}`}>
                            {getStatusIcon(complaint.status)} {complaint.status}
                          </span>
                          {complaint.refundStatus === 'refunded' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30">
                              <DollarSign className="w-3 h-3" /> Refunded
                            </span>
                          )}
                          {complaint.proofImage && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              <ImageIcon className="w-3 h-3" /> Has Proof
                            </span>
                          )}
                          <span className="text-xs text-dark-500">
                            Submitted: {new Date(complaint.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, {new Date(complaint.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
                          <span className="text-cyan-400 font-medium">ID: #{complaint.id}</span>
                          <span className="flex items-center gap-1 text-dark-400">
                            <Phone className="w-4 h-4" /> {complaint.mobileNumber}
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(complaint.mobileNumber); }}
                              title="Copy number" className="p-1 hover:bg-dark-700 rounded transition-colors"
                            ><Copy className="w-3.5 h-3.5" /></button>
                          </span>
                          {complaint.orderId && <span className="text-dark-500">Order: #{complaint.orderId}</span>}
                          {complaint.orderItemId && <span className="text-dark-500">Item: #{complaint.orderItemId}</span>}
                          {complaint.refundedAt && (
                            <span className="text-purple-400 text-xs">
                              Refunded: {new Date(complaint.refundedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className="text-dark-200">{complaint.message}</p>

                        {/* Proof image thumbnail */}
                        {complaint.proofImage && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => setSelectedImage(getImageUrl(complaint.proofImage))}
                              className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg hover:border-emerald-500/30 transition-colors group flex-1"
                            >
                              <div className="w-14 h-14 bg-dark-700 rounded-lg overflow-hidden flex items-center justify-center border border-dark-600 shrink-0">
                                <img
                                  src={getImageUrl(complaint.proofImage)}
                                  alt="Proof"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                />
                                <ImageIcon className="w-5 h-5 text-dark-400 hidden" />
                              </div>
                              <div className="text-left">
                                <span className="text-xs text-emerald-400 font-medium">Proof Screenshot</span>
                                <span className="text-xs text-dark-500 block">Click to view full image</span>
                              </div>
                              <ExternalLink className="w-4 h-4 text-dark-400 ml-auto group-hover:text-emerald-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteImage(complaint.id)}
                              className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors shrink-0"
                              title="Delete proof image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {complaint.adminNotes && (
                          <div className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-sm">
                            <span className="font-medium text-cyan-400">Admin Notes:</span>
                            <p className="text-cyan-300 whitespace-pre-wrap">{complaint.adminNotes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        {/* Upload / Paste proof image buttons */}
                        {!complaint.proofImage && (
                          <>
                            <button
                              onClick={() => {
                                if (fileInputRef.current) {
                                  fileInputRef.current.dataset.complaintId = complaint.id;
                                  fileInputRef.current.click();
                                }
                              }}
                              disabled={uploadingId === complaint.id}
                              className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50"
                              title="Upload proof screenshot"
                            >
                              {uploadingId === complaint.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handlePasteClipboard(complaint.id)}
                              disabled={pastingId === complaint.id}
                              className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 disabled:opacity-50"
                              title="Paste image from clipboard"
                            >
                              {pastingId === complaint.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                            </button>
                          </>
                        )}

                        {complaint.status !== 'resolved' && complaint.status !== 'refunded' && (
                          <>
                            <button onClick={() => setSelectedComplaint(complaint)}
                              className="px-3 py-2 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600">Update</button>
                            {complaint.refundStatus !== 'refunded' && (
                              <button onClick={() => handleRefund(complaint.id)}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                                <DollarSign className="w-4 h-4" /> Refund
                              </button>
                            )}
                          </>
                        )}
                        <button onClick={() => handleDelete(complaint.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg">
                          <Trash2 className="w-4 h-4" />
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

      <UpdateStatusDialog
        complaint={selectedComplaint}
        initialNotes={selectedComplaint?.adminNotes || ''}
        onClose={() => setSelectedComplaint(null)}
        onUpdate={handleUpdateStatus}
      />

      {/* Image preview modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setSelectedImage(null)}>
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg">
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={selectedImage}
            alt="Proof"
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}

    </>
  );
};

export default ComplaintsViewer;
