import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2 } from 'lucide-react';

const SlidingNotification = ({ notifications, onClose, autoCloseDelay = 8000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState('right'); // 'right' for incoming, 'left' for outgoing
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef(null);

  // Handle animation when index changes
  useEffect(() => {
    if (isAnimating) return;

    setIsAnimating(true);
    setDirection('right');

    const exitTimeout = setTimeout(() => {
      setDirection('left');
    }, 50);

    const enterTimeout = setTimeout(() => {
      setIsAnimating(false);
      setDirection('right');
    }, 500); // Match CSS animation duration

    return () => {
      clearTimeout(exitTimeout);
      clearTimeout(enterTimeout);
    };
  }, [currentIndex, isAnimating]);

  // Auto-advance through notifications
  useEffect(() => {
    if (notifications.length === 0 || isAnimating) return;

    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        return next >= notifications.length ? 0 : next;
      });
    }, autoCloseDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [notifications.length, autoCloseDelay, isAnimating]);

  const handlePrevious = (e) => {
    e.stopPropagation();
    if (notifications.length === 0 || isAnimating) return;
    setCurrentIndex((prev) => (prev - 1 + notifications.length) % notifications.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (notifications.length === 0 || isAnimating) return;
    setCurrentIndex((prev) => (prev + 1) % notifications.length);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose();
  };

  if (notifications.length === 0) return null;

  const currentNotification = notifications[currentIndex];
  
  // Determine animation class based on direction
  const getAnimationClass = () => {
    if (isAnimating) return '';
    return direction === 'right' ? 'slide-in-right' : 'slide-out-left';
  };

  return (
    <div className="fixed top-4 right-4 z-[10000]">
      <div
        className={`bg-blue-500 rounded-full px-6 py-4 shadow-lg flex items-center gap-3 min-w-[320px] max-w-[500px] ${getAnimationClass()}`}
      >
        {/* Speaker Icon */}
        <Volume2 className="w-5 h-5 text-white flex-shrink-0" />
        
        {/* Notification Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {currentNotification.title}
          </p>
          <p className="text-white/90 text-xs truncate">
            {currentNotification.message}
          </p>
        </div>

        {/* Navigation Dots */}
        <div className="flex items-center gap-1.5 mr-2">
          {notifications.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
              }`}
              title={`Go to notification ${idx + 1}`}
            />
          ))}
        </div>

        {/* Previous Button */}
        {notifications.length > 1 && (
          <button
            onClick={handlePrevious}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            title="Previous notification"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next Button */}
        {notifications.length > 1 && (
          <button
            onClick={handleNext}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            title="Next notification"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          title="Close notification"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export default SlidingNotification;
