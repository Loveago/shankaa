import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, RefreshCw, Wallet, X, XCircle } from 'lucide-react';

const formatMoney = (value) => `GHS ${Number(value || 0).toFixed(2)}`;

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusTone = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
    case 'COMPLETED':
    case 'RECONCILED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'PENDING':
    case 'UNPAID':
    case 'AWAITING_PAYMENT':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'FAILED':
    case 'EXPIRED':
    case 'CANCELLED':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'PROCESSING':
    case 'VERIFYING':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    default:
      return 'bg-dark-700 text-dark-300 border-dark-600';
  }
};

const getStatusIcon = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
    case 'COMPLETED':
    case 'RECONCILED':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'FAILED':
    case 'EXPIRED':
    case 'CANCELLED':
      return <XCircle className="w-4 h-4" />;
    case 'PROCESSING':
    case 'VERIFYING':
      return <RefreshCw className="w-4 h-4" />;
    default:
      return <Clock3 className="w-4 h-4" />;
  }
};

const DetailRow = ({ label, value, mono = false }) => (
  <div className="rounded-xl border border-dark-700 bg-dark-900/40 p-4">
    <p className="text-dark-400 text-xs uppercase tracking-wide mb-2">{label}</p>
    <p className={`text-sm text-white break-all ${mono ? 'font-mono' : ''}`}>{value || 'N/A'}</p>
  </div>
);

const UnpaidOrderDetailsModal = ({ isOpen, onClose, order, onReconcile, reconciling = false }) => {
  if (!isOpen || !order) return null;

  const canReconcile = ['PENDING', 'FAILED', 'EXPIRED', 'PROCESSING'].includes((order.status || '').toUpperCase()) || (order.paymentStatus || '').toUpperCase() !== 'PAID';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5 sm:p-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 rounded-xl bg-white/15 flex-shrink-0">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white truncate">Unpaid Order Details</h2>
              <p className="text-amber-100 text-sm truncate">{order.externalRef || 'No external reference'}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg flex-shrink-0">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={`rounded-xl border p-4 ${getStatusTone(order.status)}`}>
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(order.status)}
                <p className="text-xs uppercase tracking-wide">Queue Status</p>
              </div>
              <p className="text-lg font-bold">{order.status || 'N/A'}</p>
            </div>

            <div className={`rounded-xl border p-4 ${getStatusTone(order.paymentStatus)}`}>
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(order.paymentStatus)}
                <p className="text-xs uppercase tracking-wide">Payment Status</p>
              </div>
              <p className="text-lg font-bold">{order.paymentStatus || 'N/A'}</p>
            </div>

            <div className="rounded-xl border border-dark-700 bg-dark-900/40 p-4">
              <div className="flex items-center gap-2 mb-2 text-dark-300">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-xs uppercase tracking-wide">Amount</p>
              </div>
              <p className="text-lg font-bold text-white">{formatMoney(order.amount)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DetailRow label="Order ID" value={order.id} />
            <DetailRow label="Product ID" value={order.productId} />
            <DetailRow label="Product Name" value={order.productName} />
            <DetailRow label="Customer Mobile" value={order.mobileNumber} />
            <DetailRow label="Customer Email" value={order.customerEmail} />
            <DetailRow label="Currency" value={order.currency} />
            <DetailRow label="External Reference" value={order.externalRef} mono />
            <DetailRow label="Paystack Reference" value={order.paystackRef} mono />
            <DetailRow label="Payment Transaction ID" value={order.paymentTransactionId} />
            <DetailRow label="Payment Attempts" value={order.paymentAttempts} />
            <DetailRow label="Created At" value={formatDate(order.createdAt)} />
            <DetailRow label="Updated At" value={formatDate(order.updatedAt)} />
            <DetailRow label="Paid At" value={formatDate(order.paidAt)} />
            <DetailRow label="Last Attempt At" value={formatDate(order.lastAttemptAt)} />
            <DetailRow label="Expires At" value={formatDate(order.expiresAt)} />
            <DetailRow label="Payment URL" value={order.paymentUrl || 'Not available'} mono />
          </div>
        </div>

        <div className="border-t border-dark-700 p-4 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-dark-900/30">
          <div className="text-sm text-dark-400">
            Paid orders should be promoted into the real order flow only after verification succeeds.
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {order.paymentUrl && (
              <a
                href={order.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Payment Link</span>
              </a>
            )}

            <button
              onClick={() => onReconcile && onReconcile(order)}
              disabled={!canReconcile || reconciling}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>Reconcile This Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnpaidOrderDetailsModal;
