import React, { useState, useEffect, useMemo } from 'react';
import { getVendorBookings, getVendorBranches, getVendorPreviousWorks } from '../../shared/data-service/index.js';
import { VENDOR_CONFIG } from '../dashboard-plan/engine/config.js';

export default function VendorRevenue({ vendor }) {
  const [bookings, setBookings] = useState([]);
  const [branches, setBranches] = useState([]);
  const [previousWorks, setPreviousWorks] = useState([]);
  const [rangeMode, setRangeMode] = useState('monthly'); // 'monthly' | 'yearly'
  const [branchFilter, setBranchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'hall' | 'catering'
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (vendor?.username) {
      Promise.all([
        getVendorBookings(vendor.username),
        getVendorBranches(vendor.username),
        getVendorPreviousWorks(vendor.username)
      ]).then(([list, bList, pwList]) => {
        if (!isMounted) return;
        setBookings(Array.isArray(list) ? list : []);
        setBranches(Array.isArray(bList) ? bList : []);
        setPreviousWorks(Array.isArray(pwList) ? pwList : []);
      }).catch(err => {
        console.warn('[VendorRevenue] Failed to load data:', err);
      });
    }

    const handleCatalogChanged = () => {
      if (vendor?.username) {
        getVendorPreviousWorks(vendor.username).then(pw => {
          if (isMounted) setPreviousWorks(Array.isArray(pw) ? pw : []);
        });
      }
    };
    window.addEventListener('vedika:catalog-changed', handleCatalogChanged);

    return () => {
      isMounted = false;
      window.removeEventListener('vedika:catalog-changed', handleCatalogChanged);
    };
  }, [vendor]);

  // Self-reported previous works income entries (0% platform commission/GST)
  const selfReportedItems = useMemo(() => {
    return previousWorks.map((pw, idx) => {
      const amt = Number(pw.amount) || 120000;
      return {
        id: pw.id || `pw_${idx}`,
        date: pw.date || new Date().toISOString().slice(0, 10),
        customerFirstName: 'Portfolio Event',
        customerLastInitial: '',
        branchName: pw.title || 'Previous work (self-reported)',
        branchId: 'portfolio',
        eventType: pw.eventType || 'Event',
        amount: amt,
        totalAmount: amt,
        commission: 0,
        net: amt,
        status: 'Completed',
        isPreviousWork: true,
        sourceLabel: 'Previous work (self-reported)'
      };
    });
  }, [previousWorks]);

  // Filtered paid bookings + previous works (exclude cancelled bookings)
  const paidBookings = useMemo(() => {
    const regular = bookings.filter(b => {
      const status = (b.status || '').toLowerCase();
      if (status === 'cancelled') return false;
      if (branchFilter !== 'all' && b.branchId !== branchFilter) return false;
      if (typeFilter !== 'all') {
        const branch = branches.find(br => br.id === b.branchId);
        const bType = branch?.type || (b.branchName?.toLowerCase().includes('catering') ? 'catering' : 'hall');
        if (bType !== typeFilter) return false;
      }
      return true;
    });

    // Previous works are included in aggregate views when branch filter is 'all'
    const works = (branchFilter === 'all' && typeFilter === 'all') ? selfReportedItems : [];
    return [...regular, ...works];
  }, [bookings, branches, branchFilter, typeFilter, selfReportedItems]);

  // Compute KPI metrics
  const metrics = useMemo(() => {
    const totalGross = paidBookings.reduce((sum, b) => sum + Number(b.amount || b.totalAmount || 0), 0);
    const totalCommission = paidBookings.reduce((sum, b) => {
      if (b.isPreviousWork) return sum;
      return sum + Math.round(Number(b.amount || b.totalAmount || 0) * VENDOR_CONFIG.commissionRate);
    }, 0);
    const totalNet = totalGross - totalCommission;

    const completedBookings = paidBookings.filter(b => (b.status || '').toLowerCase() === 'completed');
    const completedGross = completedBookings.reduce((sum, b) => sum + Number(b.amount || b.totalAmount || 0), 0);
    const completedCommission = completedBookings.reduce((sum, b) => {
      if (b.isPreviousWork) return sum;
      return sum + Math.round(Number(b.amount || b.totalAmount || 0) * VENDOR_CONFIG.commissionRate);
    }, 0);
    const completedNet = completedGross - completedCommission;

    const pendingBookings = paidBookings.filter(b => (b.status || '').toLowerCase() !== 'completed');
    const pendingGross = pendingBookings.reduce((sum, b) => sum + Number(b.amount || b.totalAmount || 0), 0);
    const pendingNet = pendingGross - Math.round(pendingGross * VENDOR_CONFIG.commissionRate);

    const avgValue = paidBookings.length > 0 ? Math.round(totalGross / paidBookings.length) : 0;

    // This month vs last month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const thisMonthBookings = paidBookings.filter(b => {
      if (!b.date) return false;
      const d = new Date(b.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const thisMonthGross = thisMonthBookings.reduce((s, b) => s + Number(b.amount || b.totalAmount || 0), 0);
    const thisMonthCommission = thisMonthBookings.reduce((s, b) => {
      if (b.isPreviousWork) return s;
      return s + Math.round(Number(b.amount || b.totalAmount || 0) * VENDOR_CONFIG.commissionRate);
    }, 0);
    const thisMonthNet = thisMonthGross - thisMonthCommission;

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthMonth = lastMonthDate.getMonth();

    const lastMonthBookings = paidBookings.filter(b => {
      if (!b.date) return false;
      const d = new Date(b.date);
      return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonthMonth;
    });
    const lastMonthGross = lastMonthBookings.reduce((s, b) => s + Number(b.amount || b.totalAmount || 0), 0);
    const lastMonthCommission = lastMonthBookings.reduce((s, b) => {
      if (b.isPreviousWork) return s;
      return s + Math.round(Number(b.amount || b.totalAmount || 0) * VENDOR_CONFIG.commissionRate);
    }, 0);
    const lastMonthNet = lastMonthGross - lastMonthCommission;

    let momGrowth = 0;
    if (lastMonthNet > 0) {
      momGrowth = Math.round(((thisMonthNet - lastMonthNet) / lastMonthNet) * 100);
    } else if (thisMonthNet > 0) {
      momGrowth = 100;
    }

    // This year vs last year
    const thisYearBookings = paidBookings.filter(b => {
      if (!b.date) return false;
      return new Date(b.date).getFullYear() === currentYear;
    });
    const thisYearGross = thisYearBookings.reduce((s, b) => s + Number(b.amount || b.totalAmount || 0), 0);
    const thisYearCommission = thisYearBookings.reduce((s, b) => {
      if (b.isPreviousWork) return s;
      return s + Math.round(Number(b.amount || b.totalAmount || 0) * VENDOR_CONFIG.commissionRate);
    }, 0);
    const thisYearNet = thisYearGross - thisYearCommission;

    const lastYearBookings = paidBookings.filter(b => {
      if (!b.date) return false;
      return new Date(b.date).getFullYear() === currentYear - 1;
    });
    const lastYearGross = lastYearBookings.reduce((s, b) => s + Number(b.amount || b.totalAmount || 0), 0);
    const lastYearCommission = lastYearBookings.reduce((s, b) => {
      if (b.isPreviousWork) return s;
      return s + Math.round(Number(b.amount || b.totalAmount || 0) * VENDOR_CONFIG.commissionRate);
    }, 0);
    const lastYearNet = lastYearGross - lastYearCommission;

    let yoyGrowth = 0;
    if (lastYearNet > 0) {
      yoyGrowth = Math.round(((thisYearNet - lastYearNet) / lastYearNet) * 100);
    } else if (thisYearNet > 0) {
      yoyGrowth = 100;
    }

    return {
      totalNet,
      totalGross,
      completedNet,
      pendingNet,
      avgValue,
      thisMonthNet,
      momGrowth,
      thisYearNet,
      yoyGrowth
    };
  }, [paidBookings]);

  // Compute 12-month data series
  const monthlyData = useMemo(() => {
    const list = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const label = d.toLocaleString('en-US', { month: 'short' });

      const matches = paidBookings.filter(b => {
        if (!b.date) return false;
        const bDate = new Date(b.date);
        return bDate.getFullYear() === y && bDate.getMonth() === m;
      });

      const gross = matches.reduce((sum, b) => sum + Number(b.amount || b.totalAmount || 0), 0);
      const comm = matches.reduce((sum, b) => {
        if (b.isPreviousWork) return sum;
        return sum + Math.round(Number(b.amount || b.totalAmount || 0) * VENDOR_CONFIG.commissionRate);
      }, 0);
      const net = gross - comm;

      list.push({
        label,
        year: y,
        gross,
        net,
        count: matches.length,
        isCurrent: i === 0
      });
    }

    // Compute MoM growth between items
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1].net;
      const curr = list[i].net;
      if (prev > 0) {
        list[i].mom = Math.round(((curr - prev) / prev) * 100);
      } else if (curr > 0) {
        list[i].mom = 100;
      } else {
        list[i].mom = 0;
      }
    }

    return list;
  }, [paidBookings]);

  // Compute Yearly data series
  const yearlyData = useMemo(() => {
    const grossMap = {};
    const commMap = {};
    paidBookings.forEach(b => {
      if (!b.date) return;
      const y = new Date(b.date).getFullYear();
      const gross = Number(b.amount || b.totalAmount || 0);
      grossMap[y] = (grossMap[y] || 0) + gross;
      const comm = b.isPreviousWork ? 0 : Math.round(gross * VENDOR_CONFIG.commissionRate);
      commMap[y] = (commMap[y] || 0) + comm;
    });

    const years = Object.keys(grossMap).sort();
    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    const list = years.map((yr, idx) => {
      const gross = grossMap[yr] || 0;
      const comm = commMap[yr] || 0;
      const net = gross - comm;
      let yoy = 0;
      if (idx > 0) {
        const prevGross = grossMap[years[idx - 1]] || 0;
        const prevComm = commMap[years[idx - 1]] || 0;
        const prevNet = prevGross - prevComm;
        if (prevNet > 0) yoy = Math.round(((net - prevNet) / prevNet) * 100);
      }
      return {
        label: String(yr),
        gross,
        net,
        yoy
      };
    });

    return list;
  }, [paidBookings]);

  // Hall vs Catering split
  const categorySplit = useMemo(() => {
    let hallNet = 0;
    let cateringNet = 0;

    paidBookings.forEach(b => {
      const gross = Number(b.amount || b.totalAmount || 0);
      const comm = b.isPreviousWork ? 0 : Math.round(gross * VENDOR_CONFIG.commissionRate);
      const net = gross - comm;
      const isCatering = (b.branchName || '').toLowerCase().includes('catering');
      if (isCatering) {
        cateringNet += net;
      } else {
        hallNet += net;
      }
    });

    const total = hallNet + cateringNet;
    const hallPct = total > 0 ? Math.round((hallNet / total) * 100) : 50;
    const cateringPct = total > 0 ? 100 - hallPct : 50;

    return { hallNet, cateringNet, hallPct, cateringPct, total };
  }, [paidBookings]);

  // Sortable payouts list
  const sortedPayouts = useMemo(() => {
    return [...paidBookings].sort((a, b) => {
      if (sortField === 'date') {
        const cmp = (a.date || '').localeCompare(b.date || '');
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'gross') {
        const valA = Number(a.amount || a.totalAmount || 0);
        const valB = Number(b.amount || b.totalAmount || 0);
        return sortAsc ? valA - valB : valB - valA;
      }
      if (sortField === 'net') {
        const valA = a.isPreviousWork ? Number(a.amount || 0) : Number(a.amount || a.totalAmount || 0) * (1 - VENDOR_CONFIG.commissionRate);
        const valB = b.isPreviousWork ? Number(b.amount || 0) : Number(b.amount || b.totalAmount || 0) * (1 - VENDOR_CONFIG.commissionRate);
        return sortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [paidBookings, sortField, sortAsc]);

  // Export CSV (self-reported previous works are excluded from official platform payout CSV)
  const handleExportCSV = () => {
    const exportablePayouts = sortedPayouts.filter(b => !b.isPreviousWork);
    if (exportablePayouts.length === 0) {
      alert('No payout data available to export.');
      return;
    }

    const headers = ['Booking ID', 'Date', 'Customer', 'Branch', 'Event Type', 'Gross Amount (INR)', 'UstavOne Commission 10% (INR)', 'Net Payout (INR)', 'Status'];
    const rows = exportablePayouts.map(b => {
      const total = Number(b.amount || b.totalAmount || 0);
      const comm = Math.round(total * VENDOR_CONFIG.commissionRate);
      const net = total - comm;
      const status = (b.status || 'Confirmed').toLowerCase() === 'completed' ? 'Paid out' : 'Pending';

      return [
        b.id,
        b.date || '',
        `"${b.customerFirstName || 'Customer'} ${b.customerLastInitial ? b.customerLastInitial + '.' : ''}"`,
        `"${b.branchName || 'Central Branch'}"`,
        b.eventType || 'Event',
        total,
        comm,
        net,
        status
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ustavone-payouts-${vendor?.username || 'vendor'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="vedika-vendor-page fade-in" style={{ padding: '24px 0 80px' }}>
      {/* Page Title & Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Yatra One, serif', fontSize: '28px', color: '#f8ebd8', margin: '0 0 6px' }}>
            📈 Track Revenue & Payouts
          </h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '15px' }}>
            Real-time financial performance, payout reconciliation and booking analytics.
          </p>
        </div>

        {/* Range Switch & Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Monthly / Yearly Switch */}
          <div style={{ display: 'inline-flex', background: 'var(--line)', borderRadius: '999px', padding: '4px' }}>
            <button
              type="button"
              onClick={() => setRangeMode('monthly')}
              style={{
                border: rangeMode === 'monthly' ? '1px solid var(--gold)' : 'none',
                padding: '6px 16px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                background: rangeMode === 'monthly' ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
                color: rangeMode === 'monthly' ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--muted)'
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('yearly')}
              style={{
                border: rangeMode === 'yearly' ? '1px solid var(--gold)' : 'none',
                padding: '6px 16px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                background: rangeMode === 'yearly' ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
                color: rangeMode === 'yearly' ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--muted)'
              }}
            >
              Yearly
            </button>
          </div>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--card)',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Hall vs Catering Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--card)',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            <option value="all">All Types</option>
            <option value="hall">Halls Only</option>
            <option value="catering">Catering Only</option>
          </select>
        </div>
      </div>

      {/* Empty State for New Vendor */}
      {paidBookings.length === 0 ? (
        <div
          className="vedika-card"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--card)',
            borderRadius: '24px',
            border: '1px dashed var(--line)',
            marginBottom: '32px'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '14px' }}>📊</div>
          <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 6px', fontSize: '20px' }}>
            No earnings yet
          </h3>
          <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '0 auto', fontSize: '14px', lineHeight: 1.5 }}>
            Your revenue will show here after your first booking. All payments are secured through UstavOne and paid directly into your verified bank account.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '28px'
            }}
          >
            {/* KPI 1: Total Earned */}
            <div className="vedika-card pop-in" style={{ background: 'var(--card)', borderRadius: '20px', padding: '20px', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                Total Net Earned
              </div>
              <div style={{ fontSize: '24px', fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 6px' }}>
                ₹{metrics.totalNet.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--leaf)', fontWeight: 600 }}>
                Gross ₹{metrics.totalGross.toLocaleString('en-IN')} (10% platform fee)
              </div>
            </div>

            {/* KPI 2: This Month */}
            <div className="vedika-card pop-in" style={{ background: 'var(--card)', borderRadius: '20px', padding: '20px', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                This Month (Net)
              </div>
              <div style={{ fontSize: '24px', fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 6px' }}>
                ₹{metrics.thisMonthNet.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '12px', color: metrics.momGrowth >= 0 ? 'var(--leaf)' : 'var(--rose)', fontWeight: 600 }}>
                {metrics.momGrowth >= 0 ? `▲ ${metrics.momGrowth}% vs last month` : `▼ ${Math.abs(metrics.momGrowth)}% vs last month`}
              </div>
            </div>

            {/* KPI 3: This Year */}
            <div className="vedika-card pop-in" style={{ background: 'var(--card)', borderRadius: '20px', padding: '20px', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                This Year (Net)
              </div>
              <div style={{ fontSize: '24px', fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 6px' }}>
                ₹{metrics.thisYearNet.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '12px', color: metrics.yoyGrowth >= 0 ? 'var(--leaf)' : 'var(--rose)', fontWeight: 600 }}>
                {metrics.yoyGrowth >= 0 ? `▲ ${metrics.yoyGrowth}% vs last year` : `▼ ${Math.abs(metrics.yoyGrowth)}% vs last year`}
              </div>
            </div>

            {/* KPI 4: Average Booking Value */}
            <div className="vedika-card pop-in" style={{ background: 'var(--card)', borderRadius: '20px', padding: '20px', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                Avg Booking Value
              </div>
              <div style={{ fontSize: '24px', fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 6px' }}>
                ₹{metrics.avgValue.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                Across {paidBookings.length} confirmed bookings
              </div>
            </div>

            {/* KPI 5: Pending Payout */}
            <div className="vedika-card pop-in" style={{ background: 'var(--card)', borderRadius: '20px', padding: '20px', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                Pending Payout
              </div>
              <div style={{ fontSize: '24px', fontFamily: 'Yatra One, serif', color: '#B78103', margin: '0 0 6px' }}>
                ₹{metrics.pendingNet.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                Disbursed upon event completion
              </div>
            </div>
          </div>

          {/* CHARTS SECTION: Pure Inline SVG (Zero Chart Library, Zero CDN) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            {/* Chart 1: Bar Chart (12 Months or Yearly) */}
            <div
              className="vedika-card"
              style={{
                background: 'var(--card)',
                borderRadius: '24px',
                padding: '24px',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: 0, fontSize: '18px' }}>
                  {rangeMode === 'monthly' ? 'Monthly Revenue Growth (Last 12 Months)' : 'Annual Revenue Comparison'}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Values in INR (Net)
                </span>
              </div>

              {/* Inline SVG Bar Chart */}
              <div style={{ width: '100%', height: '240px', position: 'relative' }}>
                {rangeMode === 'monthly' ? (
                  (() => {
                    const maxNet = Math.max(...monthlyData.map(d => d.net), 10000);
                    const chartWidth = 500;
                    const chartHeight = 180;
                    const barWidth = 24;
                    const step = chartWidth / monthlyData.length;

                    return (
                      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 50}`} style={{ width: '100%', height: '100%' }}>
                        {/* Grid lines */}
                        <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="var(--line)" strokeWidth="1" />
                        <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="var(--line)" strokeWidth="1" strokeDasharray="4 4" />

                        {/* Bars & MoM labels */}
                        {monthlyData.map((item, idx) => {
                          const barHeight = (item.net / maxNet) * (chartHeight - 30);
                          const x = idx * step + (step - barWidth) / 2;
                          const y = chartHeight - barHeight;
                          const isHovered = hoveredBarIndex === idx;

                          return (
                            <g
                              key={idx}
                              onMouseEnter={() => setHoveredBarIndex(idx)}
                              onMouseLeave={() => setHoveredBarIndex(null)}
                              style={{ cursor: 'pointer' }}
                            >
                              {/* Bar */}
                              <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight || 4}
                                rx="5"
                                fill={item.isCurrent ? 'var(--gold)' : isHovered ? 'var(--ink2)' : 'var(--ink)'}
                              />

                              {/* Value label on hover */}
                              {(isHovered || item.isCurrent) && (
                                <text
                                  x={x + barWidth / 2}
                                  y={Math.max(y - 6, 12)}
                                  textAnchor="middle"
                                  fill="#f8ebd8"
                                  fontSize="10"
                                  fontWeight="700"
                                >
                                  ₹{Math.round(item.net / 1000)}k
                                </text>
                              )}

                              {/* Month label */}
                              <text
                                x={x + barWidth / 2}
                                y={chartHeight + 16}
                                textAnchor="middle"
                                fill="var(--muted)"
                                fontSize="11"
                                fontWeight={item.isCurrent ? '700' : '400'}
                              >
                                {item.label}
                              </text>

                              {/* Growth % badge between months */}
                              {idx > 0 && item.mom !== 0 && (
                                <text
                                  x={x - 2}
                                  y={chartHeight + 32}
                                  textAnchor="middle"
                                  fill={item.mom > 0 ? 'var(--leaf)' : 'var(--rose)'}
                                  fontSize="9"
                                  fontWeight="600"
                                >
                                  {item.mom > 0 ? `+${item.mom}%` : `${item.mom}%`}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()
                ) : (
                  /* Yearly Chart */
                  (() => {
                    const maxY = Math.max(...yearlyData.map(d => d.net), 10000);
                    const chartWidth = 400;
                    const chartHeight = 180;
                    const barWidth = 40;
                    const step = chartWidth / (yearlyData.length || 1);

                    return (
                      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} style={{ width: '100%', height: '100%' }}>
                        <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="var(--line)" strokeWidth="1" />
                        {yearlyData.map((item, idx) => {
                          const barH = (item.net / maxY) * (chartHeight - 30);
                          const x = idx * step + (step - barWidth) / 2;
                          const y = chartHeight - barH;

                          return (
                            <g key={idx}>
                              <rect x={x} y={y} width={barWidth} height={barH || 4} rx="6" fill="var(--gold)" />
                              <text x={x + barWidth / 2} y={Math.max(y - 6, 12)} textAnchor="middle" fill="#f8ebd8" fontSize="11" fontWeight="700">
                                ₹{Math.round(item.net / 1000)}k
                              </text>
                              <text x={x + barWidth / 2} y={chartHeight + 18} textAnchor="middle" fill="var(--muted)" fontSize="12" fontWeight="600">
                                {item.label}
                              </text>
                              {item.yoy !== 0 && (
                                <text x={x + barWidth / 2} y={chartHeight + 32} textAnchor="middle" fill={item.yoy > 0 ? 'var(--leaf)' : 'var(--rose)'} fontSize="10" fontWeight="600">
                                  {item.yoy > 0 ? `▲ +${item.yoy}%` : `▼ ${item.yoy}%`}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Chart 2: Category Breakdown Donut (#2F9E7B Hall vs #E4572E Catering) */}
            <div
              className="vedika-card"
              style={{
                background: 'var(--card)',
                borderRadius: '24px',
                padding: '24px',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 16px', fontSize: '18px' }}>
                Category Revenue Breakdown
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '24px' }}>
                {/* SVG Donut Chart */}
                <div style={{ width: '140px', height: '140px', position: 'relative' }}>
                  <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    {/* Background circle */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4" />
                    {/* Hall slice (#2F9E7B) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#2F9E7B"
                      strokeWidth="4"
                      strokeDasharray={`${categorySplit.hallPct} ${100 - categorySplit.hallPct}`}
                      strokeDashoffset="0"
                    />
                    {/* Catering slice (#E4572E) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#E4572E"
                      strokeWidth="4"
                      strokeDasharray={`${categorySplit.cateringPct} ${100 - categorySplit.cateringPct}`}
                      strokeDashoffset={`-${categorySplit.hallPct}`}
                    />
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: 'var(--muted)',
                      fontWeight: 600
                    }}
                  >
                    <span>100%</span>
                    <span>Direct</span>
                  </div>
                </div>

                {/* Legend & Amounts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#2F9E7B' }} />
                      <span>🏛 Function Halls ({categorySplit.hallPct}%)</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8ebd8', paddingLeft: '20px' }}>
                      ₹{categorySplit.hallNet.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#E4572E' }} />
                      <span>🍽 Catering ({categorySplit.cateringPct}%)</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8ebd8', paddingLeft: '20px' }}>
                      ₹{categorySplit.cateringNet.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TABLE: PAYOUTS & CSV EXPORT */}
          <div
            className="vedika-card"
            style={{
              background: 'var(--card)',
              borderRadius: '24px',
              padding: '24px',
              border: '1px solid var(--line)'
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 4px', fontSize: '18px' }}>
                  Disbursements & Payouts Table
                </h3>
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: '13px' }}>
                  Itemized ledger of completed and upcoming booking settlements.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="vedika-btn pulse-gold"
                style={{
                  background: 'var(--gold)',
                  color: '#3A0A1E',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '999px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>📥</span>
                <span>Export CSV</span>
              </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line)', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 10px' }}>Booking ID</th>
                    <th
                      onClick={() => { setSortField('date'); setSortAsc(!sortAsc); }}
                      style={{ padding: '12px 10px', cursor: 'pointer' }}
                    >
                      Date {sortField === 'date' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '12px 10px' }}>Branch</th>
                    <th
                      onClick={() => { setSortField('gross'); setSortAsc(!sortAsc); }}
                      style={{ padding: '12px 10px', cursor: 'pointer' }}
                    >
                      Gross Amount {sortField === 'gross' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '12px 10px' }}>UstavOne Fee (10%)</th>
                    <th
                      onClick={() => { setSortField('net'); setSortAsc(!sortAsc); }}
                      style={{ padding: '12px 10px', cursor: 'pointer' }}
                    >
                      Net Payout {sortField === 'net' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '12px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPayouts.map(b => {
                    const gross = Number(b.amount || b.totalAmount || 0);
                    const comm = b.isPreviousWork ? 0 : Math.round(gross * VENDOR_CONFIG.commissionRate);
                    const net = gross - comm;
                    const isPaidOut = (b.status || '').toLowerCase() === 'completed';

                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 600, color: '#f8ebd8' }}>
                          #{b.id}
                          {b.isPreviousWork && (
                            <div style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 500 }}>
                              Self-reported
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text)' }}>
                          {b.date || 'Upcoming'}
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--muted)' }}>
                          {b.isPreviousWork ? 'Previous work (self-reported)' : (b.branchName || 'Central Branch')}
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text)' }}>
                          ₹{gross.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 10px', color: comm > 0 ? 'var(--rose)' : 'var(--muted)' }}>
                          {comm > 0 ? `-₹${comm.toLocaleString('en-IN')}` : '₹0 (0%)'}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--leaf)' }}>
                          ₹{net.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span
                            style={{
                              background: b.isPreviousWork ? 'rgba(234, 171, 80, 0.2)' : isPaidOut ? '#E8F5E9' : '#FFF8E1',
                              color: b.isPreviousWork ? 'var(--gold)' : isPaidOut ? 'var(--leaf)' : '#B78103',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            {b.isPreviousWork ? '★ Self-reported' : isPaidOut ? '✓ Paid out' : '⏳ Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
