import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Phone } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import BASE_URL from "../endpoints/endpoints";
import { toast } from "react-toastify";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const token = localStorage.getItem("token");
    if (storedRole && token) {
      navigate("/user");
    }
  }, [navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!name || !email || !password || !confirmPassword || !referralCode) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${BASE_URL}/api/auth/signup`, {
        name,
        email,
        password,
        phone: phone || null,
        referralCode,
      });

      const { token, user } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("name", user.name);
      localStorage.setItem("email", user.email);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("isLoggedIn", true);

      toast.success("Signup successful!");
      navigate("/user");
    } catch (err) {
      setLoading(false);
      const serverMsg = err.response?.data?.message;
      setError(serverMsg || "Signup failed. Please try again.");
      toast.error(serverMsg || "Signup failed");
    }
  };

  return (
    <div className="signup-page min-h-screen bg-[#0a0a0f] text-white flex">
      <style>{`
        .signup-page input:focus, .signup-page textarea:focus, .signup-page select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15) !important;
          border-color: #f97316 !important;
        }
      `}</style>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f0f14] to-[#0a0a0f]">
          <div className="absolute top-20 left-16 w-72 h-72 bg-orange-500/[0.08] rounded-full blur-[100px]"></div>
          <div className="absolute bottom-32 right-12 w-96 h-96 bg-amber-500/[0.06] rounded-full blur-[120px]"></div>
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-purple-500/[0.04] rounded-full blur-[80px]"></div>
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>

        <div className="relative z-10 flex flex-col justify-between py-10 px-12 xl:px-16 w-full">
          <div>
            <h1 className="text-4xl xl:text-5xl font-bold mb-6">Join Shankaa</h1>
            <p className="text-gray-400 text-lg leading-relaxed max-w-md">
              Get started with your account and begin purchasing airtime and data bundles instantly.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Easy Registration</h3>
                <p className="text-gray-400 text-sm">Sign up with your referral code in minutes</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Account</h3>
                <p className="text-gray-400 text-sm">Your data is protected with industry-standard encryption</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-[48%] flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Create Account</h2>
            <p className="text-gray-400">Join thousands of users on Shankaa</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1f] border border-gray-700 rounded-lg text-white placeholder-gray-500 transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1f] border border-gray-700 rounded-lg text-white placeholder-gray-500 transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Phone Number (Optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233 XXX XXX XXX"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1f] border border-gray-700 rounded-lg text-white placeholder-gray-500 transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Referral Code Field */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Referral Code *</label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter your referral code"
                className="w-full px-4 py-2.5 bg-[#1a1a1f] border border-gray-700 rounded-lg text-white placeholder-gray-500 transition-all"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Required to create an account</p>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#1a1a1f] border border-gray-700 rounded-lg text-white placeholder-gray-500 transition-all"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#1a1a1f] border border-gray-700 rounded-lg text-white placeholder-gray-500 transition-all"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Creating Account..." : "Create Account"}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </motion.button>

            {/* Login Link */}
            <p className="text-center text-gray-400 text-sm mt-6">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-orange-500 hover:text-orange-400 font-semibold transition-colors"
              >
                Login here
              </button>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
