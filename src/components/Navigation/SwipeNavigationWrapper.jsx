import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMobile } from '../../hooks/useMobile.js';

const tabIndices = {
  dashboard: 0,
  chat: 1,
  arcade: 2,
  space: 3,
  settings: 4
};

const indexRoutes = [
  '/dashboard',
  '/chat',
  '/activities',
  '/space',
  '/settings'
];

export function SwipeNavigationWrapper({ children, activeTab, sfxEnabled }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const containerRef = useRef(null);
  
  // Track swipe touch states
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const touchLast = useRef({ x: 0, y: 0 });
  const isSwiping = useRef(false);
  const swipeLocked = useRef(false);

  const isSwipeDisabled = location.pathname !== '/dashboard' &&
                          location.pathname !== '/chat' &&
                          location.pathname !== '/activities' &&
                          location.pathname !== '/activities/' &&
                          location.pathname !== '/space' &&
                          location.pathname !== '/settings';

  // Synchronize CSS offset with active view when not swiping
  const targetIndex = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : 0;
  const targetOffset = -targetIndex * 100;
  const [currentOffset, setCurrentOffset] = useState(targetOffset);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setCurrentOffset(targetOffset);
      return;
    }
    // Smooth transition to target offset when route changes programmatically
    setIsTransitioning(true);
    setCurrentOffset(targetOffset);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [activeTab, isMobile, targetOffset]);

  if (!isMobile) {
    // Desktop layout has no swipe track, simply render active children view statically
    const idx = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : 0;
    return <div className="w-full h-full flex flex-col items-center">{children[idx]}</div>;
  }

  const handleTouchStart = (e) => {
    if (isTransitioning || isSwipeDisabled) return;
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    touchLast.current = { x: touch.clientX, y: touch.clientY };
    isSwiping.current = false;
    swipeLocked.current = false;
  };

  const handleTouchMove = (e) => {
    if (isTransitioning || isSwipeDisabled || swipeLocked.current && !isSwiping.current) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchLast.current = { x: touch.clientX, y: touch.clientY };

    // Lock swipe detection
    if (!swipeLocked.current) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      if (absX > 10) {
        swipeLocked.current = true;
        if (absX > absY * 1.5) {
          isSwiping.current = true;
        }
      } else if (absY > 10) {
        swipeLocked.current = true;
      }
    }

    if (isSwiping.current) {
      // Prevent browser default vertical scroll/bounce
      e.preventDefault();
      
      const width = window.innerWidth;
      let percentOffset = targetOffset + (deltaX / width) * 100;

      // Cap bounds with elastic resistance past ends
      if (percentOffset > 0) {
        percentOffset = (deltaX / width) * 15; // pulling right past dashboard
      } else if (percentOffset < -400) {
        percentOffset = -400 + ((deltaX - (touchStart.current.x - touchLast.current.x)) / width) * 15; // pulling left past settings
      }

      // Live update container style directly for buttery performance
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${percentOffset}vw, 0, 0)`;
        containerRef.current.style.transition = 'none';
      }
    }
  };

  const handleTouchEnd = () => {
    if (isTransitioning || isSwipeDisabled || !isSwiping.current) return;

    isSwiping.current = false;
    swipeLocked.current = false;

    const deltaX = touchLast.current.x - touchStart.current.x;
    const duration = Date.now() - touchStart.current.time;
    const width = window.innerWidth;
    const velocity = Math.abs(deltaX) / duration; // px per ms

    // Threshold triggers
    const isSignificantDrag = Math.abs(deltaX) > width * 0.25;
    const isFastSwipe = velocity > 0.35 && Math.abs(deltaX) > 30;

    if (deltaX < 0 && (isSignificantDrag || isFastSwipe)) {
      // Swipe left -> Move forward to next tab
      if (targetIndex < 4) {
        navigate(indexRoutes[targetIndex + 1]);
      } else {
        // Bounce back to settings
        snapBack();
      }
    } else if (deltaX > 0 && (isSignificantDrag || isFastSwipe)) {
      // Swipe right -> Move backward to previous tab
      if (targetIndex > 0) {
        navigate(indexRoutes[targetIndex - 1]);
      } else {
        // Bounce back to dashboard
        snapBack();
      }
    } else {
      // Small drag, just snap back to current active tab
      snapBack();
    }
  };

  const snapBack = () => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translate3d(${targetOffset}vw, 0, 0)`;
      containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    }
    setIsTransitioning(true);
    setCurrentOffset(targetOffset);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  return (
    <div className="w-full h-[100dvh] overflow-hidden relative">
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="h-full flex flex-row relative select-none"
        style={{
          width: '500vw',
          transform: `translate3d(${currentOffset}vw, 0, 0)`,
          transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          willChange: 'transform'
        }}
      >
        {/* Slide 0: Dashboard (Home) */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden">
          {children[0]}
        </div>

        {/* Slide 1: ChatView */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden relative z-50">
          {children[1]}
        </div>

        {/* Slide 2: Arcade (ActivitiesHub) */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden">
          {children[2]}
        </div>

        {/* Slide 3: SpaceHub */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden">
          {children[3]}
        </div>

        {/* Slide 4: SettingsView */}
        <div className="w-[100vw] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden">
          {children[4]}
        </div>
      </div>
    </div>
  );
}
