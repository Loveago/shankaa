import React, { useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Loader2, CheckCircle, User, Phone, MapPin, Briefcase, CreditCard, Hash, Wallet } from 'lucide-react';
import BASE_URL from '../endpoints/endpoints';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const AFA_FEE = 10; // 10 GHC

const AfaRegistrationForm = ({ onBack }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    location: '',
    occupation: '',
    idType: 'NATIONAL_ID',
    idNumber: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [paymentReference, setPaymentReference] = useState(null);

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';
    if (!formData.phoneNumber.trim()) errs.phoneNumber = 'Phone number is required';
    else if (!/^\d{10,15}$/.test(formData.phoneNumber.replace(/[\s\-+]/g, '')))
      errs.phoneNumber = 'Enter a valid phone number';
    if (!formData.location.trim()) errs.location = 'Town/Location is required';
    if (!formData.idNumber.trim()) errs.idNumber = 'ID number is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const headers = getAuthHeaders();
      // Initialize payment with registration data
      const url = Object.keys(headers).length > 0
        ? `${BASE_URL}/api/afa-registration/pay/auth`
        : `${BASE_URL}/api/afa-registration/pay`;

      const res = await axios.post(url, formData, { headers });

      if (res.data.success && res.data.paymentUrl) {
        setPaymentReference(res.data.reference);
        // Redirect to Paystack payment page
        window.location.href = res.data.paymentUrl;
      } else {
        toast.error(res.data.message || 'Failed to initialize payment');
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to initialize payment';
      toast.error(msg);
      if (msg.includes('already exists')) {
        setErrors({ phoneNumber: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentReference) return;

    setSubmitting(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/afa-registration/verify-payment`, {
        reference: paymentReference
      });

      if (res.data.success) {
        setSubmitted(true);
        toast.success('Registration submitted successfully!');
      } else {
        toast.warning('Payment not yet confirmed. Please try again.');
      }
    } catch (error) {
      toast.error('Failed to verify payment. Please contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  // Check for payment callback on mount
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('afaPayment');
    const reference = urlParams.get('reference') || urlParams.get('trxref');

    if (paymentStatus === 'callback' && reference) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setPaymentReference(reference);

      Swal.fire({
        title: 'Verifying Payment...',
        html: 'Please wait while we confirm your payment.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f1f5f9',
        didOpen: () => Swal.showLoading()
      });

      axios.post(`${BASE_URL}/api/afa-registration/verify-payment`, { reference })
        .then((response) => {
          if (response.data.success) {
            setSubmitted(true);
            Swal.fire({
              title: 'Registration Submitted!',
              text: 'Your AFA registration has been received and is pending review.',
              icon: 'success',
              background: '#1e293b',
              color: '#f1f5f9',
              confirmButtonColor: '#06b6d4'
            });
          } else {
            Swal.fire({
              title: 'Payment Pending',
              text: 'Your payment has not been confirmed yet.',
              icon: 'info',
              background: '#1e293b',
              color: '#f1f5f9',
              confirmButtonColor: '#06b6d4'
            });
          }
        })
        .catch(() => {
          Swal.fire({
            title: 'Verification Failed',
            text: 'Could not verify payment. Please contact support.',
            icon: 'error',
            background: '#1e293b',
            color: '#f1f5f9',
            confirmButtonColor: '#06b6d4'
          });
        });
    }
  }, []);

  const handleReset = () => {
    setFormData({
      fullName: '',
      phoneNumber: '',
      location: '',
      occupation: '',
      idType: 'NATIONAL_ID',
      idNumber: ''
    });
    setSubmitted(false);
    setPaymentReference(null);
    setErrors({});
  };

  if (submitted) {
    return (
      <div className="w-full h-full bg-dark-900">
        <div className="border-b border-dark-700 px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-dark-700 transition-colors" title="Back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-dark-400">Dashboard</p>
            <h1 className="text-2xl font-semibold text-white">AFA Registration</h1>
          </div>
        </div>
        <div className="flex items-center justify-center p-6" style={{ height: 'calc(100% - 73px)' }}>
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Registration Submitted!</h2>
            <p className="text-dark-300 mb-6">
              Your AFA registration has been received successfully. An administrator will review your application and get back to you.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-xl transition-colors"
              >
                Register Another
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-cyan-700 transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-dark-900">
      {/* Header */}
      <div className="border-b border-dark-700 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-dark-700 transition-colors" title="Back">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-dark-400">Dashboard</p>
          <h1 className="text-2xl font-semibold text-white">AFA Registration</h1>
        </div>
      </div>

      {/* Form */}
      <div className="overflow-y-auto p-6" style={{ height: 'calc(100% - 73px)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-dark-700">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Applicant Information</h2>
                <p className="text-sm text-dark-400">Fill in your details below to register</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Full Name</span>
                  </div>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Applicant full name"
                  className={`w-full px-4 py-3 bg-dark-900 border ${errors.fullName ? 'border-red-500' : 'border-dark-600'} rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                />
                {errors.fullName && <p className="mt-1 text-xs text-red-400">{errors.fullName}</p>}
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>Phone Number</span>
                  </div>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="Applicant phone number (e.g. 024XXXXXXX)"
                  className={`w-full px-4 py-3 bg-dark-900 border ${errors.phoneNumber ? 'border-red-500' : 'border-dark-600'} rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                  maxLength={15}
                />
                {errors.phoneNumber && <p className="mt-1 text-xs text-red-400">{errors.phoneNumber}</p>}
              </div>

              {/* Town / Location */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>Town / Location</span>
                  </div>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Town or location"
                  className={`w-full px-4 py-3 bg-dark-900 border ${errors.location ? 'border-red-500' : 'border-dark-600'} rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                />
                {errors.location && <p className="mt-1 text-xs text-red-400">{errors.location}</p>}
              </div>

              {/* Occupation */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    <span>Occupation (optional)</span>
                  </div>
                </label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  placeholder="Your occupation"
                  className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* ID Type */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span>ID Type</span>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, idType: 'NATIONAL_ID' }))}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      formData.idType === 'NATIONAL_ID'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-dark-900 border-dark-600 text-dark-400 hover:border-dark-500'
                    }`}
                  >
                    National ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, idType: 'VOTER_ID' }))}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      formData.idType === 'VOTER_ID'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-dark-900 border-dark-600 text-dark-400 hover:border-dark-500'
                    }`}
                  >
                    Voter ID
                  </button>
                </div>
              </div>

              {/* ID Number */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    <span>ID Number</span>
                  </div>
                </label>
                <input
                  type="text"
                  name="idNumber"
                  value={formData.idNumber}
                  onChange={handleChange}
                  placeholder="Enter your ID number"
                  className={`w-full px-4 py-3 bg-dark-900 border ${errors.idNumber ? 'border-red-500' : 'border-dark-600'} rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                />
                {errors.idNumber && <p className="mt-1 text-xs text-red-400">{errors.idNumber}</p>}
              </div>

              {/* Payment info box */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
                <Wallet className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-300 font-medium text-sm">Registration Fee: GHS {AFA_FEE}.00</p>
                  <p className="text-dark-400 text-xs mt-0.5">You will be redirected to Paystack to complete payment.</p>
                </div>
              </div>

              {/* Payment reference / verify button */}
              {paymentReference && (
                <div className="bg-dark-700/50 border border-dark-600 rounded-xl p-4">
                  <p className="text-dark-300 text-sm mb-2">Payment already initiated. Click below to verify:</p>
                  <button
                    type="button"
                    onClick={handleVerifyPayment}
                    disabled={submitting}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    Verify Payment
                  </button>
                </div>
              )}

              {/* Submit (Proceed to Payment) */}
              {!paymentReference && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 mt-8"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redirecting to Paystack...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      Proceed to Payment (GHS {AFA_FEE})
                    </>
                  )}
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AfaRegistrationForm;
