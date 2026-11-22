import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  seedTestAccount,
  seedTestVendor,
  seedCatalogVendors,
  getCurrentUser,
  setCurrentUser,
  getCurrentVendor,
  setCurrentVendor,
  vendorLogout,
  saveUserBooking,
  getUnifiedVendorsCatalog,
  getVendorChatThreads,
  getMode,
  subscribeMode
} from './shared/data-service/index.js';
import Header from './shared/components/Header.jsx';
import HomePage from './features/home-auth/HomePage.jsx';
import DashboardView from './features/dashboard-plan/DashboardView.jsx';
import DetailsPage from './features/home-auth/DetailsPage.jsx';
import VendorDetailPage from './features/dashboard-plan/VendorDetailPage.jsx';
import ChatScreen from './features/booking-chat/ChatScreen.jsx';
import BookingPage from './features/booking-chat/BookingPage.jsx';
import MyBookingsView from './features/booking-chat/MyBookingsView.jsx';
import AuthModal from './features/home-auth/AuthModal.jsx';
import DiyaLoader from './shared/components/DiyaLoader.jsx';
import dummyVendors from './shared/data/dummyVendors.json' with { type: 'json' };
import VendorHeader from './features/vendor/VendorHeader.jsx';
import VendorHome from './features/vendor/VendorHome.jsx';
import VendorHalls from './features/vendor/VendorHalls.jsx';
import VendorDetails from './features/vendor/VendorDetails.jsx';
import VendorBookings from './features/vendor/VendorBookings.jsx';
import VendorRequests from './features/vendor/VendorRequests.jsx';
import VendorRevenue from './features/vendor/VendorRevenue.jsx';
import VendorProfile from './features/vendor/VendorProfile.jsx';
import { unreadCountForVendor, subscribeChat } from './features/booking-chat/chatStore.js';
import ErrorBoundary from './shared/components/ErrorBoundary.jsx';
import { clearStoredPlaceFilter } from './features/dashboard-plan/placeFilter.js';

const KNOWN_VENDOR_ROUTES = ['home', 'halls', 'details', 'bookings', 'requests', 'revenue', 'profile'];
const KNOWN_USER_ROUTES = ['dashboard', 'vendor', 'chat', 'bookings', 'details', 'book', 'pay'];

export default function App() {
  // Current user & vendor sessions
  const [user, setUser] = useState(() => getCurrentUser());
  const [vendor, setVendor] = useState(() => getCurrentVendor());
  const [modeState, setModeState] = useState(() => getMode());

  useEffect(() => {
    return subscribeMode(setModeState);
  }, []);

  // Unified vendor catalog (combining static data + dynamic vendor-added branches)
  const [unifiedCatalog, setUnifiedCatalog] = useState({
    halls: [],
    caterers: [],
    decor: [],
    bands: [],
    cards: [],
    photography: []
  });

  useEffect(() => {
    let isMounted = true;

    const reloadCatalog = () => {
      getUnifiedVendorsCatalog(dummyVendors).then(cat => {
        if (isMounted && cat) {
          setUnifiedCatalog({
            halls: cat.halls || [],
            caterers: cat.caterers || [],
            decor: cat.decor || [],
            bands: cat.bands || [],
            cards: cat.cards || [],
            photography: cat.photography || []
          });
        }
      }).catch(err => {
        console.warn('[App] Failed to load catalog:', err);
      });
    };

    reloadCatalog();

    const handleCatalogChanged = () => {
      reloadCatalog();
    };

    window.addEventListener('utsavora:catalog-changed', handleCatalogChanged);

    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('utsavora_catalog_channel');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'CATALOG_CHANGED') {
            reloadCatalog();
          }
        };
      } catch (_) {}
    }

    return () => {
      isMounted = false;
      window.removeEventListener('utsavora:catalog-changed', handleCatalogChanged);
      if (bc) bc.close();
    };
  }, [modeState]);
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
    if (typeof seedCatalogVendors === 'function') {
      seedCatalogVendors();
    }
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
    clearStoredPlaceFilter();
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
    clearStoredPlaceFilter();
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

  const [appToast, setAppToast] = useState('');
  const [vendorUnreadCount, setVendorUnreadCount] = useState(0);

  // Compute vendor unread requests count strictly from real customer messages
  useEffect(() => {
    let isMounted = true;
    const computeUnread = () => {
      if (!vendor?.username) {
        if (isMounted) setVendorUnreadCount(0);
        return;
      }
      try {
        const count = unreadCountForVendor(vendor.username);
        if (isMounted) setVendorUnreadCount(count);
      } catch (_) {
        if (isMounted) setVendorUnreadCount(0);
      }
    };

    computeUnread();

    const unsubChat = subscribeChat((detail) => {
      computeUnread();
      if (detail?.type === 'MESSAGE_SENT' && (detail?.sender === 'customer' || detail?.sender === 'user')) {
        if (vendor?.username && detail?.vendorUsername && detail.vendorUsername.toLowerCase() === vendor.username.toLowerCase()) {
          const senderName = detail.customerName || 'Customer';
          setAppToast(`New message from ${senderName}`);
          setTimeout(() => setAppToast(''), 5000);
        }
      }
    });

    const handleChatEvent = () => {
      computeUnread();
    };

    window.addEventListener('utsavora:chat-message-received', handleChatEvent);
    window.addEventListener('utsavora:chat-read', handleChatEvent);
    window.addEventListener('storage', handleChatEvent);

    return () => {
      isMounted = false;
      if (unsubChat) unsubChat();
      window.removeEventListener('utsavora:chat-message-received', handleChatEvent);
      window.removeEventListener('utsavora:chat-read', handleChatEvent);
      window.removeEventListener('storage', handleChatEvent);
    };
  }, [vendor]);

  // Update browser tab title based on vendor unread messages
  useEffect(() => {
    if (vendor && vendorUnreadCount > 0) {
      document.title = `(${vendorUnreadCount}) Utsavora`;
    } else {
      document.title = 'Utsavora';
    }
  }, [vendor, vendorUnreadCount]);

  // Global toast listener
  useEffect(() => {
    const handleToastEvent = (e) => {
      const msg = e.detail?.message || e.detail;
      if (typeof msg === 'string' && msg) {
        setAppToast(msg);
        setTimeout(() => setAppToast(''), 5000);
      }
    };
    window.addEventListener('utsavora:toast', handleToastEvent);
    return () => window.removeEventListener('utsavora:toast', handleToastEvent);
  }, []);

  const handleBookingConfirmed = async (bookingDetails) => {
    if (!user?.phone) {
      window.location.hash = '#/bookings';
      return;
    }
    setIsLoaderOpen(true);
    setLoaderCaption('Confirming and saving your booking…');
    try {
      await saveUserBooking(user.phone, bookingDetails);
      setIsLoaderOpen(false);
      window.location.hash = '#/bookings';
    } catch (err) {
      setIsLoaderOpen(false);
      setAppToast(err.message || 'Failed to save booking. Please try again.');
      setTimeout(() => setAppToast(''), 5000);
    }
  };

  return (
    <ErrorBoundary>
      <div className={`vedika-root ${isLoaderOpen ? 'page-blurred' : ''}`}>
        {/* Global Toast for App Alerts */}
        {appToast && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 99999,
              background: 'var(--rose, #B5173B)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              fontSize: '0.95rem'
            }}
          >
            ⚠️ {appToast}
          </div>
        )}

        {/* ============================================================== */}
        {/* 1. GUEST VIEW (If neither user nor vendor is logged in)          */}
        {/* ============================================================== */}
        {!user && !vendor && (
          <ErrorBoundary>
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
          </ErrorBoundary>
        )}

        {/* ============================================================== */}
        {/* 2. VENDOR PORTAL (If logged in as Vendor)                       */}
        {/* ============================================================== */}
        {vendor && (
          <>
            <VendorHeader
              vendor={vendor}
              currentRoute={currentRoute.view}
              unreadRequestsCount={vendorUnreadCount}
              onLogout={handleVendorLogout}
              onNavigate={(route) => {
                window.location.hash = `#/v/${route}`;
              }}
            />

            <main id="main-content" style={{ minHeight: 'calc(100vh - 80px)' }}>
              {/* #/v/home */}
              {(currentRoute.view === 'home' || !currentRoute.view) && (
                <ErrorBoundary>
                  <VendorHome
                    vendor={vendor}
                    onNavigate={(route) => {
                      window.location.hash = `#/v/${route}`;
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* #/v/halls */}
              {currentRoute.view === 'halls' && (
                <ErrorBoundary>
                  <VendorHalls
                    vendor={vendor}
                    onNavigate={(route) => {
                      window.location.hash = `#/v/${route}`;
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* #/v/details */}
              {currentRoute.view === 'details' && (
                <ErrorBoundary>
                  <VendorDetails
                    vendor={vendor}
                    onNavigate={(route) => {
                      window.location.hash = `#/v/${route}`;
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* #/v/bookings */}
              {currentRoute.view === 'bookings' && (
                <ErrorBoundary>
                  <VendorBookings
                    vendor={vendor}
                    onNavigate={(route) => {
                      window.location.hash = `#/v/${route}`;
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* #/v/requests */}
              {currentRoute.view === 'requests' && (
                <ErrorBoundary>
                  <VendorRequests
                    vendor={vendor}
                    initialThreadId={currentRoute.id}
                  />
                </ErrorBoundary>
              )}

              {/* #/v/revenue */}
              {currentRoute.view === 'revenue' && (
                <ErrorBoundary>
                  <VendorRevenue
                    vendor={vendor}
                  />
                </ErrorBoundary>
              )}

              {/* #/v/profile */}
              {currentRoute.view === 'profile' && (
                <ErrorBoundary>
                  <VendorProfile
                    vendor={vendor}
                    onVendorUpdated={handleVendorUpdated}
                    onLogout={handleVendorLogout}
                  />
                </ErrorBoundary>
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
              <ErrorBoundary>
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
              </ErrorBoundary>
            )}

            {/* B. #/bookings */}
            {currentRoute.view === 'bookings' && (
              <ErrorBoundary>
                <MyBookingsView
                  user={user}
                  onBack={() => { window.location.hash = '#/dashboard'; }}
                  onStartPlan={() => { window.location.hash = '#/dashboard'; }}
                  onOpenChat={handleOpenChat}
                />
              </ErrorBoundary>
            )}

            {/* C. #/details */}
            {currentRoute.view === 'details' && (
              <ErrorBoundary>
                <DetailsPage
                  user={user}
                  onBack={() => { window.location.hash = '#/dashboard'; }}
                  onUserUpdated={handleUserUpdated}
                />
              </ErrorBoundary>
            )}

            {/* D. #/vendor/:id */}
            {currentRoute.view === 'vendor' && (
              <ErrorBoundary>
                <VendorDetailPage
                  vendor={activeVendor}
                  onBack={() => { window.location.hash = '#/dashboard'; }}
                  onOpenChat={handleOpenChat}
                  onOpenBook={handleOpenBook}
                />
              </ErrorBoundary>
            )}

            {/* E. #/chat/:id */}
            {currentRoute.view === 'chat' && (
              <ErrorBoundary>
                <ChatScreen
                  user={user}
                  vendor={activeVendor}
                  onBack={() => { window.location.hash = `#/vendor/${activeVendor.id}`; }}
                  onOpenBook={handleOpenBook}
                />
              </ErrorBoundary>
            )}

            {/* F. #/book/:id or #/pay/:id */}
            {(currentRoute.view === 'book' || currentRoute.view === 'pay') && (
              <ErrorBoundary>
                <BookingPage
                  user={user}
                  vendor={activeVendor}
                  plannerAnswers={{}}
                  onCancel={() => { window.location.hash = `#/vendor/${activeVendor.id}`; }}
                  onBookingConfirmed={handleBookingConfirmed}
                  onViewMyBookings={handleOpenMyBookings}
                />
              </ErrorBoundary>
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

        {/* Mode Tag */}
        <footer style={{ textAlign: 'center', padding: '16px 8px 32px', fontSize: '0.8rem', color: 'rgba(248, 235, 216, 0.7)' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.78rem'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: modeState === 'live' ? '#5FD38D' : '#E8B84A'
            }} />
            {modeState === 'live' ? 'Live' : 'Offline demo mode'}
          </span>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
