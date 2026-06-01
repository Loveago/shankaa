import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { MessageSquareWarning, X, Loader2, Clock, CheckCircle, AlertCircle, DollarSign, Image as ImageIcon, ExternalLink } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';

// Helper: extract filename from stored path and return API-based image URL
const getImageUrl = (storedPath) => {
  if (!storedPath) return '';
  const filename = storedPath.split('/').pop();
  return `${BASE_URL}/api/complaints/image/${filename}`;
};
import { toast } from 'react-toastify';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const statusStyles = {
  pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  reviewed: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  resolved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  refunded: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'pending': return <Clock className="w-3.5 h-3.5" />;
    case 'reviewed': return <AlertCircle className="w-3.5 h-3.5" />;
    case 'resolved': return <CheckCircle className="w-3.5 h-3.5" />;
    case 'refunded': return <DollarSign className="w-3.5 h-3.5" />;
    default: return <Clock className="w-3.5 h-3.5" />;
  }
};

const ComplaintsTracker = ({ isOpen, onClose }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/complaints/my`, { headers: getAuthHeaders() });
      if (res.data.success) setComplaints(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchComplaints();
  }, [isOpen, fetchComplaints]);

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (v) => `GHS ${(Number(v) || 0).toFixed(2)}`;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <MessageSquareWarning className="w-7 h-7 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">My Complaints</h2>
                <p className="text-white/80 text-sm">Track your reported orders</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1 min-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-red-400" /></div>
            ) : complaints.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquareWarning className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                <p className="text-dark-300 font-medium">No complaints submitted</p>
                <p className="text-dark-500 text-sm mt-1">When you report an order as not received, it will appear here with its status.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.map((complaint) => (
                  <div key={complaint.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusStyles[complaint.status] || ''}`}>
                        {getStatusIcon(complaint.status)} {complaint.status}
                      </span>
                      {complaint.refundStatus === 'refunded' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30">
                          <DollarSign className="w-3 h-3" /> Refunded
                        </span>
                      )}
                      <span className="text-xs text-dark-500 ml-auto">{formatDate(complaint.createdAt)}</span>
                    </div>

                    {/* Order item details */}
                    {complaint.orderItem && (
                      <div className="bg-dark-800 rounded-lg p-3 mb-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-dark-500 text-xs">Order</span>
                            <p className="text-white">{complaint.orderItem.order?.orderNumber || `#${complaint.orderItem.order?.id}`}</p>
                          </div>
                          <div>
                            <span className="text-dark-500 text-xs">Phone</span>
                            <p className="text-white">{complaint.orderItem.mobileNumber || complaint.mobileNumber}</p>
                          </div>
                          <div>
                            <span className="text-dark-500 text-xs">Bundle</span>
                            <p className="text-white truncate">{complaint.orderItem.productDescription || complaint.orderItem.productName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-dark-500 text-xs">Price</span>
                            <p className="text-white">{formatCurrency(complaint.orderItem.productPrice)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-dark-300 text-sm mb-2">{complaint.message}</p>

                    {/* Admin notes */}
                    {complaint.adminNotes && (
                      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2 mb-2">
                        <span className="text-xs font-medium text-cyan-400">Admin Notes:</span>
                        <p className="text-cyan-300 text-sm whitespace-pre-wrap">{complaint.adminNotes}</p>
                      </div>
                    )}

                    {/* Proof image thumbnail */}
                    {complaint.proofImage && (
                      <button
                        onClick={() => setSelectedImage(getImageUrl(complaint.proofImage))}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg hover:border-cyan-500/30 transition-colors group"
                      >
                        <div className="w-12 h-12 bg-dark-700 rounded-lg overflow-hidden flex items-center justify-center border border-dark-600">
                          <img
                            src={getImageUrl(complaint.proofImage)}
                            alt="Proof"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                          <ImageIcon className="w-5 h-5 text-dark-400 hidden" />
                        </div>
                        <div className="text-left">
                          <span className="text-xs text-cyan-400 font-medium flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> View Proof
                          </span>
                          <span className="text-xs text-dark-500">Admin uploaded screenshot</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-dark-400 ml-auto group-hover:text-cyan-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image preview modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setSelectedImage(null)}>
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg">
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={selectedImage}
            alt="Proof"
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ComplaintsTracker;
