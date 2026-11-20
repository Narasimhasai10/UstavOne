import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header.jsx';
import HomePage from './components/HomePage.jsx';
import DashboardView from './components/DashboardView.jsx';
import DetailsPage from './components/DetailsPage.jsx';
import VendorDetailPage from './components/VendorDetailPage.jsx';
import ChatScreen from './components/ChatScreen.jsx';
import BookingPage from './components/BookingPage.jsx';
import MyBookingsView from './components/MyBookingsView.jsx';
import AuthModal from './components/AuthModal.jsx';
import DiyaLoader from './components/DiyaLoader.jsx';
import dummyVendors from './data/dummyVendors.json' with { type: 'json' };

// Vendor components
import VendorHeader from './components/vendor/VendorHeader.jsx';
import VendorHome from './components/vendor/VendorHome.jsx';
import VendorHalls from './components/vendor/VendorHalls.jsx';
import VendorDetails from './components/vendor/VendorDetails.jsx';
import VendorBookings from './components/vendor/VendorBookings.jsx';
import VendorRequests from './components/vendor/VendorRequests.jsx';
import VendorRevenue from './components/vendor/VendorRevenue.jsx';
import VendorProfile from './components/vendor/VendorProfile.jsx';

import {
  seedTestAccount,
  seedTestVendor,
  getCurrentUser,
  setCurrentUser,
  getCurrentVendor,
  setCurrentVendor,
  vendorLogout,
  saveUserBooking,
  getUnifiedVendorsCatalog
} from './services/store.js';

export { default as DiyaLoader } from './components/DiyaLoader.jsx';
export { default as RealisticDiya } from './components/RealisticDiya.jsx';
export { default as Confetti } from './components/Confetti.jsx';
export { default as HomePage } from './components/HomePage.jsx';
export { default as DashboardView } from './components/DashboardView.jsx';
export { default as DetailsPage } from './components/DetailsPage.jsx';
export { default as Header } from './components/Header.jsx';
export { default as VendorDetailPage } from './components/VendorDetailPage.jsx';
export { default as AuthModal } from './components/AuthModal.jsx';
export { default as BookingPage } from './components/BookingPage.jsx';
export { default as MyBookingsView } from './components/MyBookingsView.jsx';
export { default as VendorHeader } from './components/vendor/VendorHeader.jsx';
export { default as VendorHome } from './components/vendor/VendorHome.jsx';
export { default as VendorHalls } from './components/vendor/VendorHalls.jsx';
export { default as VendorDetails } from './components/vendor/VendorDetails.jsx';
export { default as VendorBookings } from './components/vendor/VendorBookings.jsx';
export { default as VendorRequests } from './components/vendor/VendorRequests.jsx';
export { default as VendorRevenue } from './components/vendor/VendorRevenue.jsx';
export { default as VendorProfile } from './components/vendor/VendorProfile.jsx';

const KNOWN_USER_ROUTES = ['home', 'login', 'dashboard', 'bookings', 'details', 'vendor', 'chat', 'book', 'pay'];
const KNOWN_VENDOR_ROUTES = ['home', 'halls', 'details', 'bookings', 'requests', 'revenue', 'profile'];

export default function App() {
  // Current user & vendor sessions
  const [user, setUser] = useState(() => getCurrentUser());
  const [vendor, setVendor] = useState(() => getCurrentVendor());

  // Unified vendor catalog (combining static data + dynamic vendor-added branches)
  const unifiedCatalog = useMemo(() => getUnifiedVendorsCatalog(dummyVendors), []);
  const allVendorsMap = useMemo(() => {
    const map = {};
    ['halls', 'caterers', 'decor', 'bands', 'cards', 'photography'].forEach(key => {
      (unifiedCatalog[key] || []).forEach(v => {
        if (v && v.id) map[v.id] = v;
      });
    });
    return map;
  }, [unifiedCatalog]);

  // Parse current route from window.location.hash
  const parseRoute = () => {
    const hash = window.location.hash || '';
    const clean = hash.replace(/^#\/?/, '');
    const parts = clean.split('/');

    if (parts[0] === 'v') {
      return {
        isVendor: true,
        view: parts[1] || 'home',
        id: parts[2]
      };
    }

    return {
      isVendor: false,
      view: parts[0] || '',
      id: parts[1]
    };
  };

  const [currentRoute, setCurrentRoute] = useState(() => parseRoute());

  // Active vendor for user-side detail/chat/book
  const activeVendor = useMemo(() => {
    if (currentRoute.id && allVendorsMap[currentRoute.id]) {
      return allVendorsMap[currentRoute.id];
    }
    // Fallback: first hall in catalog
    return unifiedCatalog.halls?.[0] || dummyVendors.halls[0];
  }, [currentRoute.id, allVendorsMap, unifiedCatalog]);

  // Auth modal
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'

  // DiyaLoader state
  const [isLoaderOpen, setIsLoaderOpen] = useState(false);
  const [loaderCaption, setLoaderCaption] = useState('Lighting the lamps for your function…');
  const loaderCallbackRef = useRef(null);

  // Seed test accounts on mount
  useEffect(() => {
    seedTestAccount();
    seedTestVendor();
  }, []);

  // Enforce bidirectional route guards
  useEffect(() => {
    const parsed = parseRoute();
    const currentUser = getCurrentUser();
    const currentVen = getCurrentVendor();

    if (currentVen) {
      // Logged in as VENDOR:
      // A vendor cannot open user pages; redirect to #/v/home
      if (!parsed.isVendor) {
        window.location.hash = '#/v/home';
        return;
      }
      if (!KNOWN_VENDOR_ROUTES.includes(parsed.view)) {
        window.location.hash = '#/v/home';
        return;
      }
    } else if (currentUser) {
      // Logged in as USER:
      // A user cannot open #/v/*; redirect to #/dashboard
      if (parsed.isVendor) {
        window.location.hash = '#/dashboard';
        return;
      }
      if (!parsed.view || parsed.view === 'home' || parsed.view === 'login' || !KNOWN_USER_ROUTES.includes(parsed.view)) {
        window.location.hash = '#/dashboard';
        return;
      }
    } else {
      // LOGGED OUT / GUEST:
      if (parsed.view === 'login') {
        setAuthMode('login');
        setAuthOpen(true);
      } else if (parsed.isVendor || (parsed.view !== 'home' && parsed.view !== '')) {
        // Unknown or protected route -> go to #/home
        window.location.hash = '#/home';
      }
    }
  }, [user, vendor]);

  // Listen for hashchange events (enables browser Back & Forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRoute();
      const currentUser = getCurrentUser();
      const currentVen = getCurrentVendor();

      if (currentVen) {
        if (!parsed.isVendor) {
          window.location.hash = '#/v/home';
          return;
        }
        if (!KNOWN_VENDOR_ROUTES.includes(parsed.view)) {
          window.location.hash = '#/v/home';
          return;
        }
      } else if (currentUser) {
        if (parsed.isVendor) {
          window.location.hash = '#/dashboard';
          return;
        }
        if (!parsed.view || parsed.view === 'home' || parsed.view === 'login' || !KNOWN_USER_ROUTES.includes(parsed.view)) {
          window.location.hash = '#/dashboard';
          return;
        }
      } else {
        if (parsed.view === 'login') {
          setAuthMode('login');
          setAuthOpen(true);
          setCurrentRoute({ isVendor: false, view: 'home' });
          return;
        }
        if (parsed.isVendor || (parsed.view !== 'home' && parsed.view !== '')) {
          window.location.hash = '#/home';
          return;
        }
      }

      setCurrentRoute(parsed);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Helper to trigger DiyaLoader
  const triggerLoader = (caption, callback) => {
    setLoaderCaption(caption || 'Lighting the lamps for your function…');
    loaderCallbackRef.current = callback || null;
    setIsLoaderOpen(true);
  };

  const handleLoaderComplete = () => {
    setIsLoaderOpen(false);
    if (loaderCallbackRef.current) {
      loaderCallbackRef.current();
      loaderCallbackRef.current = null;
    }
  };

  // Login handler
  const handleLoginSuccess = (accountData) => {
    setAuthOpen(false);

    if (accountData?.role === 'vendor' || accountData?.username) {
      // VENDOR LOGIN
      setCurrentUser(null);
      setUser(null);
      setCurrentVendor(accountData);
      setVendor(accountData);
      setCurrentRoute({ isVendor: true, view: 'home' });
      window.location.hash = '#/v/home';

      triggerLoader('Lighting the lamps for your function…', () => {
        setCurrentRoute({ isVendor: true, view: 'home' });
        window.location.hash = '#/v/home';
      });
    } else {
      // USER LOGIN
      vendorLogout();
      setVendor(null);
      setCurrentUser(accountData);
      setUser(accountData);
      setCurrentRoute({ isVendor: false, view: 'dashboard' });
      window.location.hash = '#/dashboard';

      triggerLoader('Lighting the lamps for your function…', () => {
        setCurrentRoute({ isVendor: false, view: 'dashboard' });
        window.location.hash = '#/dashboard';
      });
    }
  };

  // User Logout handler
  const handleUserLogout = () => {
    setUser(null);
    setCurrentUser(null);
    setCurrentRoute({ isVendor: false, view: 'home' });
    window.location.hash = '#/home';
  };

  // Vendor Logout handler
  const handleVendorLogout = () => {
    setVendor(null);
    vendorLogout();
    setCurrentRoute({ isVendor: false, view: 'home' });
    window.location.hash = '#/home';
  };

  // Location update handler
  const handleUpdateUserLocation = (newLoc) => {
    setUser(prev => {
      const updated = {
        ...(prev || {}),
        city: newLoc.city,
        state: newLoc.state,
        location: newLoc
      };
      setCurrentUser(updated);
      return updated;
    });

    triggerLoader(`Finding the best in ${newLoc.city}…`);
  };

  // User profile updated from DetailsPage
  const handleUserUpdated = (updatedUser) => {
    setUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  // Vendor profile updated from VendorProfile
  const handleVendorUpdated = (updatedVendor) => {
    setVendor(updatedVendor);
    setCurrentVendor(updatedVendor);
  };

  // Navigation handlers (User side)
  const handleSelectVendor = (v) => {
    window.location.hash = `#/vendor/${v.id}`;
  };

  const handleOpenChat = (v) => {
    window.location.hash = `#/chat/${v.id}`;
  };

  const handleOpenBook = (v) => {
    window.location.hash = `#/book/${v.id}`;
  };

  const handleOpenMyBookings = () => {
    window.location.hash = '#/bookings';
  };

  const handleBookingConfirmed = (bookingDetails) => {
    if (user?.phone) {
      saveUserBooking(user.phone, bookingDetails);
    }
    window.location.hash = '#/bookings';
  };

  return (
    <div className={`vedika-root ${isLoaderOpen ? 'page-blurred' : ''}`}>
      {/* ============================================================== */}
      {/* 1. GUEST VIEW (If neither user nor vendor is logged in)          */}
      {/* ============================================================== */}
      {!user && !vendor && (
        <HomePage
          user={user}
          onLogout={handleUserLogout}
          onOpenAuth={(mode) => {
            setAuthMode(mode || 'login');
            setAuthOpen(true);
          }}
          onStartPlan={() => {
            setAuthMode('login');
            setAuthOpen(true);
          }}
          onUpdateUserLocation={handleUpdateUserLocation}
        />
      )}

      {/* ============================================================== */}
      {/* 2. VENDOR PORTAL (If logged in as Vendor)                       */}
      {/* ============================================================== */}
      {vendor && (
        <>
          <VendorHeader
            vendor={vendor}
            currentRoute={currentRoute.view}
            onLogout={handleVendorLogout}
            onNavigate={(route) => {
              window.location.hash = `#/v/${route}`;
            }}
          />

          <main id="main-content" style={{ minHeight: 'calc(100vh - 80px)' }}>
            {/* #/v/home */}
            {(currentRoute.view === 'home' || !currentRoute.view) && (
              <VendorHome
                vendor={vendor}
                onNavigate={(route) => {
                  window.location.hash = `#/v/${route}`;
                }}
              />
            )}

            {/* #/v/halls */}
            {currentRoute.view === 'halls' && (
              <VendorHalls
                vendor={vendor}
                onNavigate={(route) => {
                  window.location.hash = `#/v/${route}`;
                }}
              />
            )}

            {/* #/v/details */}
            {currentRoute.view === 'details' && (
              <VendorDetails
                vendor={vendor}
                onNavigate={(route) => {
                  window.location.hash = `#/v/${route}`;
                }}
              />
            )}

            {/* #/v/bookings */}
            {currentRoute.view === 'bookings' && (
              <VendorBookings
                vendor={vendor}
                onNavigate={(route) => {
                  window.location.hash = `#/v/${route}`;
                }}
              />
            )}

            {/* #/v/requests */}
            {currentRoute.view === 'requests' && (
              <VendorRequests
                vendor={vendor}
                initialThreadId={currentRoute.id}
              />
            )}

            {/* #/v/revenue */}
            {currentRoute.view === 'revenue' && (
              <VendorRevenue
                vendor={vendor}
              />
            )}

            {/* #/v/profile */}
            {currentRoute.view === 'profile' && (
              <VendorProfile
                vendor={vendor}
                onVendorUpdated={handleVendorUpdated}
                onLogout={handleVendorLogout}
              />
            )}
          </main>
        </>
      )}

      {/* ============================================================== */}
      {/* 3. USER LOGGED-IN VIEW (If logged in as Customer/User)          */}
      {/* ============================================================== */}
      {user && !vendor && (
        <>
          <Header
            user={user}
            onLogout={handleUserLogout}
            onUpdateLocation={handleUpdateUserLocation}
          />

          {/* A. #/dashboard */}
          {(currentRoute.view === 'dashboard' || !currentRoute.view) && (
            <DashboardView
              user={user}
              onLogout={handleUserLogout}
              onOpenMyBookings={handleOpenMyBookings}
              onSelectVendor={handleSelectVendor}
              onOpenChat={handleOpenChat}
              onOpenBook={handleOpenBook}
              onUpdateUserLocation={handleUpdateUserLocation}
              onTriggerLoader={triggerLoader}
            />
          )}

          {/* B. #/bookings */}
          {currentRoute.view === 'bookings' && (
            <MyBookingsView
              user={user}
              onBack={() => { window.location.hash = '#/dashboard'; }}
              onStartPlan={() => { window.location.hash = '#/dashboard'; }}
              onOpenChat={handleOpenChat}
            />
          )}

          {/* C. #/details */}
          {currentRoute.view === 'details' && (
            <DetailsPage
              user={user}
              onBack={() => { window.location.hash = '#/dashboard'; }}
              onUserUpdated={handleUserUpdated}
            />
          )}

          {/* D. #/vendor/:id */}
          {currentRoute.view === 'vendor' && (
            <VendorDetailPage
              vendor={activeVendor}
              onBack={() => { window.location.hash = '#/dashboard'; }}
              onOpenChat={handleOpenChat}
              onOpenBook={handleOpenBook}
            />
          )}

          {/* E. #/chat/:id */}
          {currentRoute.view === 'chat' && (
            <ChatScreen
              user={user}
              vendor={activeVendor}
              onBack={() => { window.location.hash = `#/vendor/${activeVendor.id}`; }}
              onOpenBook={handleOpenBook}
            />
          )}

          {/* F. #/book/:id or #/pay/:id */}
          {(currentRoute.view === 'book' || currentRoute.view === 'pay') && (
            <BookingPage
              user={user}
              vendor={activeVendor}
              plannerAnswers={{}}
              onCancel={() => { window.location.hash = `#/vendor/${activeVendor.id}`; }}
              onBookingConfirmed={handleBookingConfirmed}
              onViewMyBookings={handleOpenMyBookings}
            />
          )}
        </>
      )}

      {/* Auth Modal (Login / Sign-up for User or Vendor) */}
      <AuthModal
        isOpen={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onVendorLoginSuccess={handleLoginSuccess}
        onRequestLoader={(cb) => triggerLoader('Lighting the lamps for your account…', cb)}
      />

      {/* Reusable DiyaLoader */}
      <DiyaLoader
        isOpen={isLoaderOpen}
        onComplete={handleLoaderComplete}
        caption={loaderCaption}
        duration={2400}
      />
    </div>
  );
}
