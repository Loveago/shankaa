import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, Phone, Mail, MapPin, Star, Shield, Zap, Clock, ChevronLeft, ChevronRight, Wifi, ArrowRight, CheckCircle, Globe, Sparkles } from 'lucide-react';
import { Dialog } from "@headlessui/react";
import { motion, useInView, AnimatePresence } from "framer-motion";

const Meteor = ({ delay = 0 }) => (
  <div className="absolute pointer-events-none" style={{ top: `${Math.random() * 40}%`, left: `${Math.random() * 100}%` }}>
    <div
      className="w-0.5 h-20 rotate-[215deg] rounded-full"
      style={{
        background: 'linear-gradient(to bottom, rgba(249,115,22,0.6), transparent)',
        animation: `meteor 3s linear ${delay}s infinite`,
      }}
    />
  </div>
);

const FadeInSection = ({ children, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const Landing = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const handleMouse = (e) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      hero.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    };
    hero.addEventListener('mousemove', handleMouse);
    return () => hero.removeEventListener('mousemove', handleMouse);
  }, []);

  const networks = [
    { name: 'MTN', color: 'from-yellow-500 to-yellow-600', accent: 'text-yellow-400', glow: 'rgba(234,179,8,0.15)', features: ['Instant Activation', 'No Expiry Dates', 'Data Rollover', '4G/5G Support'] },
    { name: 'TELECEL', color: 'from-red-500 to-red-600', accent: 'text-red-400', glow: 'rgba(239,68,68,0.15)', features: ['Lightning Fast', 'Nationwide Coverage', 'Bonus Data', 'Easy Top-up'] },
    { name: 'AIRTELTIGO', color: 'from-blue-500 to-blue-600', accent: 'text-blue-400', glow: 'rgba(59,130,246,0.15)', features: ['Best Value', 'Quick Delivery', 'Flexible Plans', 'Great Coverage'] }
  ];

  const testimonials = [
    { name: 'Kwame Asante', role: 'Student', content: 'Tsk5 has been my go-to for data packages. Fast, reliable, and affordable prices!', rating: 5 },
    { name: 'Ama Serwaa', role: 'Business Owner', content: 'Excellent service! I buy data for my entire team through Tsk5. Never disappointed.', rating: 5 },
    { name: 'Kofi Mensah', role: 'Freelancer', content: 'Quick delivery and great customer support. Highly recommend Tsk5 for all data needs.', rating: 5 },
    { name: 'Akosua Frimpong', role: 'Teacher', content: 'Reliable service that keeps me connected with my students. Great experience!', rating: 5 }
  ];

  const nextTestimonial = useCallback(() => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const prevTestimonial = useCallback(() => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  useEffect(() => {
    const interval = setInterval(nextTestimonial, 5000);
    return () => clearInterval(interval);
  }, [nextTestimonial]);

  return (
    <div className="landing-page min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <style>{`
        .landing-page input:focus, .landing-page textarea:focus, .landing-page select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15) !important;
          border-color: #f97316 !important;
        }
        @keyframes meteor { 0% { transform: rotate(215deg) translateX(0); opacity: 1; } 70% { opacity: 1; } 100% { transform: rotate(215deg) translateX(-500px); opacity: 0; } }
      `}</style>

      {/* Navigation */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-18">
            <div className="flex items-center gap-2.5">
              <img src="/logo-icon.png" alt="Tsk5" className="w-9 h-9 rounded-lg" />
              <span className="text-xl font-bold text-white">Tsk5</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1">
              {['Home', 'About', 'Services', 'Packages', 'Reviews'].map((item) => (
                <a key={item} href={`#${item === 'Reviews' ? 'testimonials' : item.toLowerCase()}`} className="px-4 py-2 text-zinc-400 hover:text-orange-400 transition-colors text-sm font-medium rounded-lg hover:bg-white/[0.03]">{item}</a>
              ))}
              <div className="w-px h-5 bg-white/10 mx-2"></div>
              <a href="/login" className="px-4 py-2 text-zinc-300 hover:text-white transition-colors text-sm font-medium">Sign In</a>
              <a href="/signup" className="px-4 py-2 text-zinc-300 hover:text-white transition-colors text-sm font-medium">Sign Up</a>
            </div>

            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white p-2 -mr-2">
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/[0.06] overflow-hidden"
            >
              <div className="px-4 py-4 space-y-1">
                {[['Home','#home'],['About','#about'],['Services','#services'],['Packages','#packages'],['Reviews','#testimonials']].map(([label, href]) => (
                  <a key={label} href={href} onClick={() => setIsMenuOpen(false)} className="block text-zinc-300 hover:text-orange-400 hover:bg-white/[0.03] py-2.5 px-3 rounded-lg text-sm font-medium transition-colors">{label}</a>
                ))}
                <div className="pt-3 pb-1 space-y-2.5 border-t border-white/[0.06] mt-2">
                  <a href="/login" className="block w-full text-center px-4 py-2.5 text-orange-400 border border-orange-500/30 rounded-xl text-sm font-semibold hover:bg-orange-500/10 transition-colors">Sign In</a>
                  <a href="/signup" className="block w-full text-center px-4 py-2.5 text-zinc-300 border border-white/[0.08] rounded-xl text-sm font-semibold hover:bg-white/[0.07] transition-colors">Sign Up</a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section id="home" ref={heroRef} className="relative min-h-[100svh] pt-24 sm:pt-28 lg:pt-32 overflow-hidden flex items-center spotlight">
        {/* Mesh gradient background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-orange-500/[0.07] rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/[0.05] rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/3 right-0 w-[300px] h-[300px] bg-purple-500/[0.04] rounded-full blur-[80px]"></div>
        </div>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
        {/* Meteors */}
        {[0, 1.5, 3, 4.5, 6].map((d, i) => <Meteor key={i} delay={d} />)}

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                </span>
                <span className="text-orange-300 text-xs font-medium">Serving Ghana 24/7</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4rem] font-extrabold mb-6 leading-[1.1] tracking-tight">
                <span className="text-white">Affordable data</span><br />
                <span className="text-white">bundles, </span>
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">delivered instantly</span>
              </h1>
              
              <p className="text-base sm:text-lg text-zinc-400 mb-8 leading-relaxed max-w-lg">
                Tsk5 connects you to all major networks in Ghana. Buy MTN, Telecel, and AirtelTigo data packages at the best prices with instant delivery.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-12">
                <a href="/signup" className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40">
                  Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <a href="#about" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/[0.04] text-zinc-200 rounded-xl text-sm font-semibold border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all backdrop-blur-sm">
                  Learn More
                </a>
              </div>

              <div className="flex items-center gap-8 sm:gap-10">
                {[['5K+', 'Happy Customers'], ['99.9%', 'Success Rate'], ['24/7', 'Support']].map(([value, label], i) => (
                  <React.Fragment key={label}>
                    {i > 0 && <div className="w-px h-10 bg-white/10"></div>}
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-white">{value}</div>
                      <div className="text-zinc-500 text-xs sm:text-sm mt-0.5">{label}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
              className="relative hidden lg:block"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-orange-500/20 rounded-3xl blur-2xl opacity-40"></div>
              <div className="relative bg-white/[0.03] rounded-2xl p-6 sm:p-8 border border-white/[0.06] backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-white">Available Networks</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium border border-green-500/20">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
                    </span>
                    Live
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { name: 'MTN', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400' },
                    { name: 'TELECEL', bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
                    { name: 'AIRTELTIGO', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400 text-xs' },
                  ].map((n) => (
                    <div key={n.name} className={`${n.bg} border ${n.border} rounded-xl p-4 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer`}>
                      <span className={`font-bold ${n.text}`}>{n.name}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {[
                    { icon: Wifi, title: 'All Networks Supported', desc: 'One platform for all your data needs', color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { icon: Zap, title: 'Instant Delivery', desc: 'Data delivered in seconds', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { icon: Shield, title: 'Secure Payments', desc: 'Protected by industry standards', color: 'text-green-400', bg: 'bg-green-500/10' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-center gap-3.5 p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                      <div className={`w-10 h-10 ${item.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <div>
                        <div className="text-white text-sm font-semibold">{item.title}</div>
                        <div className="text-zinc-500 text-xs">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 sm:py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/[0.02] to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeInSection className="text-center mb-14 sm:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-300 text-xs font-medium uppercase tracking-wider">Why Tsk5</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">Built for speed and <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">reliability</span></h2>
            <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">We deliver excellence in every transaction with features designed for your convenience</p>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {[
              { icon: Zap, title: 'Instant Delivery', desc: 'Get your data bundles delivered instantly after payment', color: 'orange' },
              { icon: Shield, title: 'Secure Payment', desc: 'Safe and encrypted transactions every time', color: 'purple' },
              { icon: Clock, title: '24/7 Support', desc: 'Round-the-clock customer assistance', color: 'green' },
              { icon: Star, title: 'Best Prices', desc: 'Competitive rates across all networks', color: 'amber' }
            ].map((service, idx) => {
              const colors = { orange: 'from-orange-500 to-amber-500', purple: 'from-purple-500 to-violet-500', green: 'from-emerald-500 to-green-500', amber: 'from-amber-500 to-yellow-500' };
              const glows = { orange: 'hover:shadow-orange-500/10', purple: 'hover:shadow-purple-500/10', green: 'hover:shadow-emerald-500/10', amber: 'hover:shadow-amber-500/10' };
              return (
                <FadeInSection key={idx} delay={idx * 0.1}>
                  <div className={`group p-6 bg-white/[0.02] rounded-2xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] hover:shadow-2xl ${glows[service.color]} transition-all duration-300`}>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[service.color]} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                      <service.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{service.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{service.desc}</p>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="packages" className="py-20 sm:py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/[0.02] to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeInSection className="text-center mb-14 sm:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-5">
              <Globe className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-300 text-xs font-medium uppercase tracking-wider">Networks</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">Data packages for <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">every network</span></h2>
            <p className="text-zinc-400 text-base sm:text-lg">Choose from our wide range of affordable data packages</p>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {networks.map((network, idx) => (
              <FadeInSection key={idx} delay={idx * 0.12}>
                <div className="group relative bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-white/[0.12] transition-all duration-300" style={{ boxShadow: `0 0 60px -20px ${network.glow}` }}>
                  <div className={`h-1 bg-gradient-to-r ${network.color}`}></div>
                  <div className="p-6 sm:p-8">
                    <div className={`inline-flex items-center justify-center px-5 py-2.5 bg-white/[0.04] rounded-xl mb-6 border border-white/[0.06]`}>
                      <span className={`font-bold text-sm ${network.accent}`}>{network.name}</span>
                    </div>
                    <div className="space-y-3 mb-7">
                      {network.features.map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-3">
                          <CheckCircle className={`w-4 h-4 ${network.accent} flex-shrink-0`} />
                          <span className="text-zinc-400 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <a href="/login" className={`block w-full py-3.5 text-center bg-gradient-to-r ${network.color} text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg`}>
                      Buy {network.name} Data
                    </a>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 sm:py-24 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeInSection>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-5">
                <span className="text-orange-300 text-xs font-medium uppercase tracking-wider">About Us</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">Ghana's trusted <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">data partner</span></h2>
              <p className="text-zinc-400 text-base sm:text-lg mb-5 leading-relaxed">
                Tsk5 is Ghana's premier data package dealer, committed to keeping you connected with affordable and reliable internet bundles. We've built our reputation on trust, speed, and exceptional customer service.
              </p>
              <p className="text-zinc-400 text-base sm:text-lg mb-8 leading-relaxed">
                Since our inception, we've served thousands of customers across Ghana, providing instant data bundle top-ups for all major networks including MTN, Telecel, and AirtelTigo.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-orange-500/[0.06] rounded-2xl text-center border border-orange-500/10">
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-1">5,000+</div>
                  <div className="text-zinc-500 text-sm">Happy Customers</div>
                </div>
                <div className="p-5 bg-amber-500/[0.06] rounded-2xl text-center border border-amber-500/10">
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent mb-1">99.9%</div>
                  <div className="text-zinc-500 text-sm">Success Rate</div>
                </div>
              </div>
            </FadeInSection>
            <FadeInSection delay={0.15}>
              <div className="bg-white/[0.02] rounded-2xl p-6 sm:p-8 border border-white/[0.06]">
                <h3 className="text-xl font-bold text-white mb-4">Our Mission</h3>
                <p className="text-zinc-400 text-base leading-relaxed mb-6">
                  To provide fast, reliable, and affordable data packages that keep Ghana connected. We believe everyone deserves access to affordable internet connectivity.
                </p>
                <div className="flex items-center gap-3.5 p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className="text-zinc-300 text-sm font-medium">Always Connected, Always Reliable</span>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 sm:py-24 lg:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/[0.02] to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeInSection className="text-center mb-14 sm:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-5">
              <Star className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-300 text-xs font-medium uppercase tracking-wider">Testimonials</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">Trusted by <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">thousands</span></h2>
            <p className="text-zinc-400 text-base sm:text-lg">See what our customers have to say about Tsk5</p>
          </FadeInSection>

          <div className="relative max-w-3xl mx-auto">
            <div className="overflow-hidden">
              <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}>
                {testimonials.map((testimonial, idx) => (
                  <div key={idx} className="w-full flex-shrink-0 px-2 sm:px-4">
                    <div className="bg-white/[0.03] rounded-2xl p-6 sm:p-10 border border-white/[0.06] text-center">
                      <div className="flex justify-center mb-5">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                        ))}
                      </div>
                      <p className="text-zinc-300 text-base sm:text-lg leading-relaxed mb-7 italic">"{testimonial.content}"</p>
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-semibold text-sm">
                          {testimonial.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="text-white text-sm font-semibold">{testimonial.name}</div>
                          <div className="text-zinc-500 text-xs">{testimonial.role}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={prevTestimonial} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-5 w-10 h-10 bg-white/[0.05] border border-white/[0.1] rounded-full flex items-center justify-center text-zinc-400 hover:bg-white/[0.1] hover:text-orange-400 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextTestimonial} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-5 w-10 h-10 bg-white/[0.05] border border-white/[0.1] rounded-full flex items-center justify-center text-zinc-400 hover:bg-white/[0.1] hover:text-orange-400 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentTestimonial(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${idx === currentTestimonial ? 'bg-gradient-to-r from-orange-500 to-amber-500 w-7' : 'bg-white/10 w-2 hover:bg-white/20'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.08] via-[#0a0a0f] to-amber-500/[0.05]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/[0.08] rounded-full blur-[150px]"></div>
        <div className="relative max-w-3xl mx-auto px-4 text-center z-10">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5">Ready to stay <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">connected?</span></h2>
            <p className="text-zinc-400 text-base sm:text-lg mb-10 max-w-xl mx-auto">Join thousands of satisfied customers and get your data bundles delivered instantly.</p>
            <a href="/login" className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold hover:from-orange-600 hover:to-amber-600 transition-all shadow-2xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02]">
              Start Buying Data <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </FadeInSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#060608] py-14 sm:py-18 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo-icon.png" alt="Tsk5" className="w-9 h-9 rounded-lg" />
                <span className="text-xl font-bold text-white">Tsk5</span>
              </div>
              <p className="text-zinc-500 text-sm mb-5 max-w-sm leading-relaxed">Your trusted partner for affordable data packages across all major networks in Ghana.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowTermsModal(true)} className="text-zinc-600 hover:text-orange-400 transition-colors text-xs">Terms of Service</button>
                <button onClick={() => setShowPrivacyModal(true)} className="text-zinc-600 hover:text-orange-400 transition-colors text-xs">Privacy Policy</button>
              </div>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2.5">
                {['Home', 'About', 'Services', 'Packages'].map((link) => (
                  <li key={link}><a href={`#${link.toLowerCase()}`} className="text-zinc-500 hover:text-orange-400 transition-colors text-sm">{link}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] pt-6 text-center">
            <p className="text-zinc-600 text-xs">&copy; {new Date().getFullYear()} Tsk5. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Terms of Use Modal */}
      <Dialog open={showTermsModal} onClose={() => setShowTermsModal(false)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Dialog.Panel className="bg-[#141418] p-6 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh] border border-white/[0.06]">
            <Dialog.Title className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-4 text-center">
              TSK5 TERMS AND CONDITIONS & REFUND POLICY
            </Dialog.Title>

            <p className="text-center text-sm text-zinc-500 mb-6">
              <span className="italic">Effective Date:</span> 16th December 2025
            </p>

            <p className="text-sm text-zinc-400 mb-4">
              Welcome to Tsk5. By using our services, purchasing our products, or accessing our platforms, you agree to be bound by the following Terms and Conditions. Please read them carefully.
            </p>

            <div className="space-y-6 text-sm text-zinc-400">
              <section>
                <h3 className="font-semibold text-lg text-white mb-2">1. ABOUT TSK5</h3>
                <p className="mb-2">Tsk5 is a digital and service-based business that provides:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Data bundles and airtime for all networks</li>
                  <li>Electronics and related devices</li>
                  <li>SIM registration, business registration, birth certificate processing, and other documentation services</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">2. ACCEPTANCE OF TERMS</h3>
                <p className="mb-2">By making a purchase or requesting any service from Tsk5, you confirm that:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>You are legally capable of entering into a binding agreement.</li>
                  <li>You have read, understood, and agreed to these Terms and Conditions.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">3. PRICING & PAYMENTS</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>All prices are stated in Ghana Cedis (GHS) unless otherwise specified.</li>
                  <li>Full payment must be made before service delivery or processing.</li>
                  <li>Tsk5 reserves the right to change prices at any time without prior notice.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">4. SERVICE DELIVERY</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Digital services (data, airtime, etc.) are delivered electronically and are usually processed instantly or within a reasonable time.</li>
                  <li>Physical products will be delivered or handed over as agreed at the time of purchase.</li>
                  <li>Service-based transactions begin once payment is confirmed.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">5. CUSTOMER RESPONSIBILITY</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Customers are responsible for providing accurate details (phone number, network, personal data, documents, etc.).</li>
                  <li>Tsk5 will not be held liable for errors resulting from incorrect information provided by the customer.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">6. REFUND POLICY</h3>
                
                <div className="ml-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-zinc-200">6.1 Digital Products & Services</h4>
                    <p className="text-zinc-500 text-xs mb-1">This includes data bundles, airtime, and other digital services.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Digital products are non-refundable once successfully delivered.</li>
                      <li>Refunds will only be considered if:</li>
                      <ul className="list-disc list-inside ml-6 space-y-1">
                        <li>Payment was successful but the service was not delivered.</li>
                        <li>A verified system error occurred on Tsk5's side.</li>
                      </ul>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-zinc-200">6.2 Incorrect Details</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Tsk5 is not responsible for transactions completed using incorrect details provided by the customer.</li>
                      <li>Such transactions are not eligible for refunds.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-zinc-200">6.3 Delayed Transactions</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Delays caused by network providers or third-party systems do not automatically qualify for refunds.</li>
                      <li>Refunds will only be processed if the transaction fails completely and is reversed.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-zinc-200">6.4 Physical Products (Electronics & Devices)</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Physical items may be eligible for a refund or replacement within 24 hours of purchase if:</li>
                      <ul className="list-disc list-inside ml-6 space-y-1">
                        <li>The item is confirmed to be defective at delivery.</li>
                        <li>It is returned in its original condition and packaging.</li>
                      </ul>
                      <li>Items damaged due to misuse, mishandling, or negligence are not refundable.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-zinc-200">6.5 Service-Based Transactions</h4>
                    <p className="text-zinc-500 text-xs mb-1">This includes SIM registration, business certificates, birth certificates, and documentation services.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Once processing has begun, no refunds will be issued.</li>
                      <li>Refunds may only be considered if Tsk5 is unable to initiate the service.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-zinc-200">6.6 Refund Processing</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Approved refunds will be processed within 24 hours.</li>
                      <li>Refunds will be made via the original payment method used.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">7. LIMITATION OF LIABILITY</h3>
                <p className="mb-2">Tsk5 shall not be liable for:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Network failures or third-party service interruptions.</li>
                  <li>Losses resulting from customer negligence or incorrect information.</li>
                  <li>Indirect or consequential damages beyond the value of the purchased service or product.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">8. FRAUD & MISUSE</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Any fraudulent activity, chargeback abuse, or misuse of our services will result in immediate suspension and possible legal action.</li>
                  <li>Tsk5 reserves the right to refuse service to anyone found violating these terms.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">9. MODIFICATIONS TO TERMS</h3>
                <p>Tsk5 reserves the right to modify these Terms and Conditions at any time. Continued use of our services constitutes acceptance of the updated terms.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">10. GOVERNING LAW</h3>
                <p>These Terms and Conditions are governed by and interpreted in accordance with the laws of the Republic of Ghana.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">11. CONTACT INFORMATION</h3>
                <p className="mb-2">For inquiries, complaints, or refund-related issues, contact us via:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Website: <a href="https://tsk5service.vercel.app/" className="text-orange-400 underline">https://tsk5.vercel.app/</a></li>
                  <li>Customer Support: <span className="text-orange-400">+233 24 644 4787</span></li>
                  <li>Complaints: <span className="text-orange-400">+233246444787</span> (WhatsApp only)</li>
                </ul>
              </section>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all font-medium"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacyModal} onClose={() => setShowPrivacyModal(false)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Dialog.Panel className="bg-[#141418] p-6 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh] border border-white/[0.06]">
            <Dialog.Title className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-4 text-center">
              Privacy Policy for Tsk5
            </Dialog.Title>

            <p className="text-center text-sm text-zinc-500 mb-6">
              <span className="italic">Effective Date:</span> 01/06/2025
            </p>

            <div className="space-y-6 text-sm text-zinc-400">
              <section>
                <h3 className="font-semibold text-lg text-white mb-2">1. Information We Collect</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Personal Information:</strong> Name, phone number, email address, and network provider.</li>
                  <li><strong>Transaction Information:</strong> Data bundle purchases, payment methods (e.g., MoMo – not stored), and transaction history.</li>
                  <li><strong>Device Information:</strong> IP address, device type, browser type, and location data (for security and optimization).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">2. How We Use Your Information</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Process your data bundle orders.</li>
                  <li>Communicate with you regarding purchases, updates, or issues.</li>
                  <li>Improve our services and customer experience.</li>
                  <li>Prevent fraud and ensure account security.</li>
                  <li>Send promotional messages (optional; opt-out available).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">3. Data Sharing</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>We don't sell or share your personal data, except:</li>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>With trusted service providers (e.g., payment gateways).</li>
                    <li>When legally required.</li>
                    <li>To prevent fraud or protect users and our platform.</li>
                  </ul>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">4. Data Security</h3>
                <p>We use reasonable industry-standard practices to protect your data. While no system is perfectly secure, we do our best to keep your information safe.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">5. Your Rights</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Access, update, or delete your personal information.</li>
                  <li>Opt-out of promotional messages.</li>
                  <li>Request us to stop processing your data (with business/legal limitations).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">6. Cookies & Tracking</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Used to enhance browsing, remember preferences, and track site traffic.</li>
                  <li>You can disable cookies in your browser settings.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">7. Third-Party Links</h3>
                <p>Links to third-party websites may exist. We are not responsible for their content or privacy practices.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">8. Changes to This Policy</h3>
                <p>This policy may be updated periodically. Changes will be reflected with a revised effective date.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-white mb-2">9. Contact Us</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Email: <a href="mailto:ecudjoe128@gmail.com" className="text-orange-400 underline">kelisdata22@gmail.com</a></li>
                  <li>Phone: <span className="text-orange-400"> +233246444787</span></li>
                </ul>
              </section>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all font-medium"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default Landing;
