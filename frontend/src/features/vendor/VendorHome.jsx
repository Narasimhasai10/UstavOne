import React, { useState, useEffect, useMemo } from 'react';
import { formatINR } from '../dashboard-plan/engine/planner.js';
import { getVendorBranches, getVendorBookings, getVendorChatThreads, syncBrowserPhotosToBackend } from '../../shared/data-service/index.js';
import { subscribeChat } from '../booking-chat/chatStore.js';

export default function VendorHome({
  vendor,
  onNavigate
}) {
  const username = vendor?.username || 'sai_halls';
  const firstName = vendor?.name ? vendor.name.trim().split(/\s+/)[0] : 'Partner';

  const [branches, setBranches] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const loadData = () => {
      Promise.all([
        getVendorBranches(username),
        getVendorBookings(username),
        getVendorChatThreads(username)
      ]).then(([brs, bks, chs]) => {
        if (!isMounted) return;
        setBranches(Array.isArray(brs) ? brs : []);
        setBookings(Array.isArray(bks) ? bks : []);
        setChats(Array.isArray(chs) ? chs : []);
        setIsLoading(false);
      }).catch(err => {
        console.warn('[VendorHome] Failed to load data:', err);
        if (isMounted) setIsLoading(false);
      });
    };

    loadData();
    syncBrowserPhotosToBackend(username);

    const unsubChat = subscribeChat(() => {
      getVendorChatThreads(username).then(chs => {
        if (isMounted) setChats(Array.isArray(chs) ? chs : []);
      }).catch(() => {});
    });

    return () => {
      isMounted = false;
      if (unsubChat) unsubChat();
    };
  }, [username]);

  // Check if any branch or document is Under review
  const underReviewDocs = useMemo(() => {
    const list = [];
    if (vendor?.tradeLicenceStatus === 'Needs manual review') {
      list.push('Trade Licence');
    }
    if (vendor?.fssaiStatus === 'Needs manual review') {
      list.push('FSSAI Certificate');
    }
    branches.forEach(b => {
      if (b.status === 'Needs manual review' || b.status === 'Under review') {
        list.push(`${b.name} (${b.type})`);
      }
    });
    return list;
  }, [vendor, branches]);

  // Calculate metrics
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  const thisMonthBookings = bookings.filter(b => b.date && b.date.startsWith(currentMonthStr) && b.status !== 'Cancelled');
  const prevMonthBookings = bookings.filter(b => b.date && b.date.startsWith(prevMonthStr) && b.status !== 'Cancelled');

  const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + (b.payout || (b.amount * 0.9)), 0);
  const prevMonthRevenue = prevMonthBookings.reduce((sum, b) => sum + (b.payout || (b.amount * 0.9)), 0);

  const growthPercent = prevMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 * 10) / 10
    : (thisMonthRevenue > 0 ? 100 : 0);

  const upcomingBookings = bookings.filter(b => {
    const todayStr = now.toISOString().split('T')[0];
    return (b.date || todayStr) >= todayStr && b.status !== 'Cancelled';
  });

  const next5Bookings = upcomingBookings.slice(0, 5);
  const latestRequests = chats.slice(0, 4);

  // Overall average rating
  const avgRating = useMemo(() => {
    if (branches.length === 0) return 'New';
    const total = branches.reduce((acc, b) => acc + (b.rating || 4.8), 0);
    return (total / branches.length).toFixed(1);
  }, [branches]);

  const isBrandNew = branches.length === 0 && bookings.length === 0;

  return (
    <div className="vendor-dashboard-content" style={{ padding: '24px 0 80px' }}>
      {/* Top Greeting Block */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Yatra One', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', color: '#f8ebd8', margin: '0 0 6px' }}>
          Welcome back, {firstName} 👋
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.98rem', margin: 0 }}>
          Manage your branches, upcoming customer functions, and revenue.
        </p>
      </div>

      {/* Under Review Alert Banner (if any) */}
      {underReviewDocs.length > 0 && (
        <div
          style={{
            background: 'color-mix(in srgb, #FFA62B 15%, var(--card))',
            border: '1.5px solid #FFA62B',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🟡</span>
          <div style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
            <strong>Under review:</strong> {underReviewDocs.join(', ')} is currently under 24-hour review by the Utsavora team. Branches go live as soon as verified.
          </div>
        </div>
      )}

      {/* Flagged for Review Alert (if vendor reached 3 contact violations) */}
      {vendor?.flaggedForReview && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--rose) 15%, var(--card))',
            border: '1.5px solid var(--rose)',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🚨</span>
          <div style={{ fontSize: '0.88rem', color: 'var(--rose)' }}>
            <strong>Account flagged for review:</strong> Repeated sharing of personal contact details was detected. Payouts and visibility may be held pending admin review.
          </div>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}
      >
        {/* KPI 1: This Month's Net Revenue */}
        <div className="panel" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            This Month's Revenue
          </div>
          <div style={{ fontFamily: 'Yatra One', fontSize: '1.9rem', color: '#f8ebd8' }}>
            {formatINR(thisMonthRevenue)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            {prevMonthRevenue > 0 ? (
              <span style={{ color: growthPercent >= 0 ? 'var(--leaf)' : 'var(--rose)', fontWeight: 700 }}>
                {growthPercent >= 0 ? `▲ ${growthPercent}%` : `▼ ${Math.abs(growthPercent)}%`}
              </span>
            ) : (
              <span style={{ color: 'var(--leaf)', fontWeight: 700 }}>New</span>
            )}
            <span style={{ color: 'var(--muted)' }}>vs last month</span>
          </div>
        </div>

        {/* KPI 2: Upcoming Bookings */}
        <div className="panel" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Upcoming Bookings
          </div>
          <div style={{ fontFamily: 'Yatra One', fontSize: '1.9rem', color: '#f8ebd8' }}>
            {upcomingBookings.length}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Confirmed & scheduled events
          </div>
        </div>

        {/* KPI 3: New Customer Requests */}
        <div className="panel" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Customer Requests
          </div>
          <div style={{ fontFamily: 'Yatra One', fontSize: '1.9rem', color: '#f8ebd8' }}>
            {chats.length}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            {chats.filter(c => c.unreadCount > 0).length} unread conversations
          </div>
        </div>

        {/* KPI 4: Average Rating */}
        <div className="panel" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Average Rating
          </div>
          <div style={{ fontFamily: 'Yatra One', fontSize: '1.9rem', color: 'var(--gold)' }}>
            {avgRating} {avgRating !== 'New' ? '★' : ''}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Across {branches.length} branches
          </div>
        </div>
      </div>

      {/* Quick Actions Band */}
      <div style={{ marginBottom: '36px' }}>
        <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: '#f8ebd8', marginBottom: '14px' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cta"
            onClick={() => { window.location.hash = '#/v/halls'; }}
            style={{ fontSize: '0.92rem', padding: '10px 20px', minHeight: '44px' }}
          >
            ➕ Add Branch
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => { window.location.hash = '#/v/details'; }}
            style={{ fontSize: '0.92rem', padding: '10px 20px', minHeight: '44px', color: 'var(--text)', borderColor: 'var(--line)' }}
          >
            🖼 Update Details & Photos
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => { window.location.hash = '#/v/bookings'; }}
            style={{ fontSize: '0.92rem', padding: '10px 20px', minHeight: '44px', color: 'var(--text)', borderColor: 'var(--line)' }}
          >
            📅 View Bookings
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => { window.location.hash = '#/v/requests'; }}
            style={{ fontSize: '0.92rem', padding: '10px 20px', minHeight: '44px', color: 'var(--text)', borderColor: 'var(--line)' }}
          >
            💬 Open Requests
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => { window.location.hash = '#/v/revenue'; }}
            style={{ fontSize: '0.92rem', padding: '10px 20px', minHeight: '44px', color: 'var(--text)', borderColor: 'var(--line)' }}
          >
            📈 Revenue & Payouts
          </button>
        </div>
      </div>

      {/* Two Columns: Next 5 Bookings & Latest Requests */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Next 5 Bookings */}
        <div className="panel" style={{ padding: '24px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: '#f8ebd8', margin: 0 }}>
              Next 5 Bookings
            </h3>
            <button
              type="button"
              onClick={() => { window.location.hash = '#/v/bookings'; }}
              style={{ background: 'none', border: 0, color: 'var(--gold)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              View all →
            </button>
          </div>

          {next5Bookings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {next5Bookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: b.eventColor || 'var(--acc)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: '0.92rem'
                      }}
                    >
                      {b.customerInitial || 'C'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)' }}>
                        {b.customerName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        {b.eventType} · {b.date} · {b.guests} guests
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8ebd8' }}>
                      {formatINR(b.payout || (b.amount * 0.9))}
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--leaf)',
                        background: 'color-mix(in srgb, var(--leaf) 15%, transparent)',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>📭</div>
              <p style={{ margin: 0, fontSize: '0.92rem' }}>No upcoming bookings scheduled yet.</p>
            </div>
          )}
        </div>

        {/* Latest Customer Requests */}
        <div className="panel" style={{ padding: '24px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: '#f8ebd8', margin: 0 }}>
              Latest Requests
            </h3>
            <button
              type="button"
              onClick={() => { window.location.hash = '#/v/requests'; }}
              style={{ background: 'none', border: 0, color: 'var(--gold)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Open chat →
            </button>
          </div>

          {latestRequests.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {latestRequests.map((c) => {
                const lastMsg = c.messages?.[c.messages.length - 1];
                return (
                  <div
                    key={c.id}
                    onClick={() => { window.location.hash = '#/v/requests'; }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'var(--gold)',
                          color: '#3A0A1E',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                          fontSize: '1rem',
                          flexShrink: 0
                        }}
                      >
                        {c.customerInitial || 'C'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--text)' }}>{c.customerName}</strong>
                          <span style={{ fontSize: '0.8rem' }}>{c.eventEmoji || '💍'}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lastMsg?.text || 'New customer inquiry'}
                        </div>
                      </div>
                    </div>

                    {c.unreadCount > 0 && (
                      <span
                        style={{
                          background: 'var(--rose)',
                          color: '#fff',
                          borderRadius: '99px',
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {c.unreadCount} new
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>💬</div>
              <p style={{ margin: 0, fontSize: '0.92rem' }}>Customer chat inquiries will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
