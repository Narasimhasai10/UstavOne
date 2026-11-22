import React from 'react';

export default function DashboardPlanPanel({
  planResult,
  budget,
  formatLakh,
  formatINR,
  currentEvent,
  guests,
  serviceNeed,
  bookingDuration,
  userCity,
  selectedPackageName,
  setSelectedPackageName,
  planTopTab,
  setPlanTopTab,
  planPanelTabs,
  currentPlanTop3,
  planExpandedPickId,
  setPlanExpandedPickId,
  selectedHallPick,
  selectedCateringPick,
  selectedDecorPick,
  displayEstimatedCost,
  highlightedRow,
  savePlanFeedback,
  shareFeedback,
  handlePlanPickClick,
  handleApplyFix,
  handleSavePlan,
  handleSharePlan,
  onOpenBook,
  onOpenChat,
  onSelectVendor,
  onTriggerLoader,
  SPLIT_COLORS
}) {
  return (
              <div className="panel plan">
                <h2>Your AI plan</h2>
                <small>
                  {currentEvent.name} · {guests} guests · {serviceNeed === 'both' ? `${bookingDuration} & catering` : serviceNeed} · {userCity}
                </small>
    
                <div className="big">{formatLakh(budget)}</div>
    
                {planResult ? (
                  <>
                    {/* Animated Split Bar */}
                    <div className="split" aria-label="Budget split segments">
                      {serviceNeed !== 'hall' && planResult.cateringAllocation > 0 && (
                        <div
                          style={{
                            width: `${Math.round((planResult.cateringAllocation / planResult.usableBudget) * 100)}%`,
                            backgroundColor: SPLIT_COLORS.catering
                          }}
                          title={`Catering: ${formatINR(planResult.cateringAllocation)}`}
                        >
                          Catering
                        </div>
                      )}
                      {serviceNeed !== 'catering' && planResult.hallAllocation > 0 && (
                        <div
                          style={{
                            width: `${Math.round((planResult.hallAllocation / planResult.usableBudget) * 100)}%`,
                            backgroundColor: SPLIT_COLORS.hall
                          }}
                          title={`Function hall: ${formatINR(planResult.hallAllocation)}`}
                        >
                          Hall
                        </div>
                      )}
                      {serviceNeed !== 'catering' && planResult.decorAllocation > 0 && (
                        <div
                          style={{
                            width: `${Math.round((planResult.decorAllocation / planResult.usableBudget) * 100)}%`,
                            backgroundColor: SPLIT_COLORS.decor
                          }}
                          title={`Decoration: ${formatINR(planResult.decorAllocation)}`}
                        >
                          Decor
                        </div>
                      )}
                      {planResult.extrasAllocation > 0 && (
                        <div
                          style={{
                            width: `${Math.round((planResult.extrasAllocation / planResult.usableBudget) * 100)}%`,
                            backgroundColor: SPLIT_COLORS.extras,
                            color: '#3A0A1E'
                          }}
                          title={`Savings or extras: ${formatINR(planResult.extrasAllocation)}`}
                        >
                          Extras
                        </div>
                      )}
                    </div>
    
                    {/* Legend */}
                    <div className="lg">
                      {serviceNeed !== 'hall' && (
                        <span>
                          <i style={{ backgroundColor: SPLIT_COLORS.catering }} />
                          Catering
                          <b>{formatINR(planResult.cateringAllocation)}</b>
                        </span>
                      )}
                      {serviceNeed !== 'catering' && (
                        <span>
                          <i style={{ backgroundColor: SPLIT_COLORS.hall }} />
                          Function hall
                          <b>{formatINR(planResult.hallAllocation)}</b>
                        </span>
                      )}
                      {serviceNeed !== 'catering' && (
                        <span>
                          <i style={{ backgroundColor: SPLIT_COLORS.decor }} />
                          Decoration
                          <b>{formatINR(planResult.decorAllocation)}</b>
                        </span>
                      )}
                      <span>
                        <i style={{ backgroundColor: SPLIT_COLORS.extras }} />
                        Contingency & Extras
                        <b>{formatINR(planResult.contingencyBuffer + planResult.extrasAllocation)}</b>
                      </span>
                    </div>
    
                    {/* 3-tab switch: Budget-friendly / Balanced / Premium */}
                    {(() => {
                      const activePackage = planResult?.packages?.[selectedPackageName] || planResult?.packages?.Standard || planResult?.packages?.['Balanced'];
                      return (
                    <div style={{ marginTop: '16px' }}>
                      <div className="seg" style={{ background: '#ffffff22', padding: '4px', borderRadius: '12px' }}>
                        {['Budget-friendly', 'Balanced', 'Premium'].map(pkgName => {
                          const isSel = selectedPackageName === pkgName;
                          return (
                            <button
                              key={pkgName}
                              type="button"
                              style={{
                                background: isSel ? 'var(--gold)' : 'transparent',
                                color: isSel ? '#3A0A1E' : '#FFE7B0',
                                fontWeight: isSel ? 700 : 500,
                                border: 0,
                                fontSize: '0.85rem'
                              }}
                              onClick={() => setSelectedPackageName(pkgName)}
                            >
                              {pkgName}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#FFE7B0', marginTop: '6px', padding: '0 4px' }}>
                        <span>Package Total: <b>{formatINR(activePackage?.totalCost)}</b></span>
                        <span style={{ color: 'var(--gold)' }}>{formatINR(activePackage?.remaining)} left</span>
                      </div>
                    </div>
                      );
                    })()}
    
                    {/* Note box with aria-live */}
                    <div className="note" aria-live="polite">
                      {planResult.status === 'too_low' ? (
                        <div>
                          <div style={{ color: '#FFB4A2', fontWeight: 600, marginBottom: '6px' }}>
                            ⚠️ Your budget is below the minimum viable floor for these options.
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {planResult.concreteFixes.map((fix, idx) => (
                              <button
                                key={idx}
                                type="button"
                                style={{
                                  background: 'var(--gold)',
                                  color: '#3A0A1E',
                                  border: 0,
                                  borderRadius: '8px',
                                  padding: '5px 10px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleApplyFix(fix)}
                              >
                                Tap to fix: {fix.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>
                            ✨ AI found {planResult.scoredHalls?.length || 6} halls and {planResult.scoredCaterers?.length || 6} caterers in <b>{userCity}</b> that match your budget.
                          </div>
                          {planResult.suggestions?.length > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '0.86rem', color: '#FFF8EA', background: '#ffffff1a', padding: '6px 10px', borderRadius: '8px' }}>
                              💡 {planResult.suggestions[0].text}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
    
                    {/* SECTION D: "Estimated cost for your answers" Table */}
                    {(displayEstimatedCost || planResult.estimatedCost) && (() => {
                      const est = displayEstimatedCost || planResult.estimatedCost;
                      return (
                        <div
                          style={{
                            marginTop: '20px',
                            background: 'rgba(0, 0, 0, 0.22)',
                            borderRadius: '16px',
                            padding: '16px',
                            border: '1px solid rgba(255, 231, 176, 0.2)'
                          }}
                        >
                          <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0', margin: '0 0 12px' }}>
                            Estimated cost for your answers
                          </h3>
    
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Function hall row */}
                            {est.hall && (
                              <div
                                style={{
                                  padding: '8px',
                                  borderRadius: '8px',
                                  background: highlightedRow === 'hall' || highlightedRow === 'all' ? 'rgba(232, 184, 74, 0.15)' : 'transparent',
                                  transition: 'background 0.8s'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#FFF8EA' }}>
                                    🏛 {est.hall.name}
                                  </span>
                                  <span style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0' }}>
                                    {formatINR(est.hall.cost)}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#E9CFA8', marginTop: '2px' }}>
                                  {est.hall.formulaText}
                                </div>
                                {est.hall.rangeText && (
                                  <div style={{ fontSize: '0.75rem', color: '#C9B0B8', marginTop: '2px', fontStyle: 'italic' }}>
                                    {est.hall.rangeText}
                                  </div>
                                )}
                              </div>
                            )}
    
                            {/* Decoration row */}
                            {est.decor && (
                              <div
                                style={{
                                  padding: '8px',
                                  borderRadius: '8px',
                                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                  background: highlightedRow === 'decor' || highlightedRow === 'all' ? 'rgba(232, 184, 74, 0.15)' : 'transparent',
                                  transition: 'background 0.8s'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#FFF8EA' }}>
                                    ✨ {est.decor.formulaText}
                                  </span>
                                  <span style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0' }}>
                                    {formatINR(est.decor.cost)}
                                  </span>
                                </div>
                              </div>
                            )}
    
                            {/* Catering row */}
                            {est.catering && (
                              <div
                                style={{
                                  padding: '8px',
                                  borderRadius: '8px',
                                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                  background: highlightedRow === 'catering' || highlightedRow === 'all' ? 'rgba(232, 184, 74, 0.15)' : 'transparent',
                                  transition: 'background 0.8s'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#FFF8EA' }}>
                                    {est.catering.heading || `🍽 Catering (${guests} plates × ₹${est.catering.targetPlate || 350})`}
                                  </span>
                                  <span style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0' }}>
                                    {formatINR(est.catering.cost)}
                                  </span>
                                </div>
                                {est.catering.rangeText && (
                                  <div style={{ fontSize: '0.78rem', color: '#E9CFA8', marginTop: '2px' }}>
                                    {est.catering.rangeText}
                                  </div>
                                )}
                              </div>
                            )}
    
                            {/* Divider & Summary rows */}
                            <div style={{ borderTop: '1.5px solid rgba(255, 231, 176, 0.3)', paddingTop: '10px', marginTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '6px' }}>
                                <span style={{ color: '#E9CFA8' }}>Subtotal:</span>
                                <b>{formatINR(est.subtotal)}</b>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '6px' }}>
                                <span style={{ color: '#E9CFA8' }}>Your budget:</span>
                                <b>{formatINR(est.budget)}</b>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                  {est.isOverBudget ? (
                                    <span style={{ color: 'var(--rose)' }}>Over by {formatINR(est.overBy)}</span>
                                  ) : (
                                    <span style={{ color: '#5FD38D' }}>Remaining:</span>
                                  )}
                                </span>
                                <span style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', color: est.isOverBudget ? 'var(--rose)' : '#5FD38D' }}>
                                  {est.isOverBudget ? `-${formatINR(est.overBy)}` : formatINR(est.remaining)}
                                </span>
                              </div>
                              {est.isOverBudget && (
                                <div style={{ fontSize: '0.78rem', color: '#FFB4A2', marginTop: '4px' }}>
                                  💡 Tip: Switch to Non-AC or adjust guest count to align with your ₹{formatLakh(budget)} budget.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="note" style={{ color: 'var(--rose)' }}>
                    We could not calculate right now. Please change an answer and try again.
                  </div>
                )}
    
                {/* TOP 3 RECOMMENDATIONS (ONLY INSIDE THE AI PLAN PANEL) */}
                <div
                  style={{
                    marginTop: '20px',
                    background: 'rgba(0, 0, 0, 0.28)',
                    borderRadius: '16px',
                    padding: '16px',
                    border: '1px solid rgba(255, 231, 176, 0.25)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.12rem', color: '#FFE7B0', margin: 0 }}>
                      Top 3 Recommendations
                    </h3>
                    <small style={{ color: 'rgba(255, 231, 176, 0.75)', fontSize: '0.78rem' }}>
                      Tap pick to preview in plan
                    </small>
                  </div>
    
                  {/* Small Category Tabs inside Plan Panel */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginBottom: '14px'
                    }}
                    role="tablist"
                    aria-label="Plan category recommendations"
                  >
                    {planPanelTabs.map(t => {
                      const isSel = planTopTab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setPlanTopTab(t.id);
                            setPlanExpandedPickId(null);
                          }}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.78rem',
                            borderRadius: '99px',
                            border: `1.5px solid ${isSel ? 'var(--gold)' : 'rgba(255, 231, 176, 0.25)'}`,
                            background: isSel ? 'var(--gold)' : 'rgba(255, 255, 255, 0.05)',
                            color: isSel ? '#3A0A1E' : '#f8ebd8',
                            fontWeight: isSel ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 150ms ease'
                          }}
                        >
                          {t.icon} {t.label}
                        </button>
                      );
                    })}
                  </div>
    
                  {/* Top 3 Content: Expanded View OR Numbered List */}
                  {planExpandedPickId && (() => {
                    const item = currentPlanTop3.find(x => x.id === planExpandedPickId);
                    if (!item) return null;
                    return (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.35)',
                          borderRadius: '12px',
                          padding: '14px',
                          border: '1.5px solid var(--gold)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <button
                            type="button"
                            onClick={() => setPlanExpandedPickId(null)}
                            style={{
                              background: 'rgba(255, 231, 176, 0.15)',
                              border: '1px solid rgba(255, 231, 176, 0.3)',
                              color: '#f8ebd8',
                              padding: '4px 10px',
                              borderRadius: '99px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ← Back to top 3
                          </button>
                          <span style={{ fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 600 }}>
                            Applied to Estimated Cost ✓
                          </span>
                        </div>
    
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                          <div>
                            <h4 style={{ fontSize: '1.05rem', margin: '0 0 4px', color: '#f8ebd8' }}>
                              {item.name}
                            </h4>
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                              ★ {item.rating} · {item.city} {item.capacity ? `· Capacity ${item.capacity}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'Yatra One', fontSize: '1.18rem', color: 'var(--gold)' }}>
                              {formatINR(item.cost)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: item.fitsBudget ? 'var(--leaf)' : 'var(--rose)', fontWeight: 600 }}>
                              {item.fitsBudget ? 'Fits budget ✓' : item.note}
                            </div>
                          </div>
                        </div>
    
                        {/* Detailed Breakdown */}
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            padding: '10px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            marginBottom: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Formula / Rate:</span>
                            <span style={{ color: '#f8ebd8' }}>{item.formulaText || `${formatINR(item.basePrice || item.cost)}`}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Category Budget Share:</span>
                            <span style={{ color: '#f8ebd8' }}>{formatINR(item.budgetShare)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Remaining:</span>
                            <span style={{ color: item.cost <= item.budgetShare ? '#5FD38D' : 'var(--rose)', fontWeight: 600 }}>
                              {item.cost <= item.budgetShare ? formatINR(item.budgetShare - item.cost) : `Over by ${formatINR(item.cost - item.budgetShare)}`}
                            </span>
                          </div>
                        </div>
    
                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => onOpenChat(item.raw || item)}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: 'rgba(255, 231, 176, 0.15)',
                              border: '1px solid rgba(255, 231, 176, 0.3)',
                              color: '#f8ebd8',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            💬 Chat
                          </button>
                          <button
                            type="button"
                            disabled={!item.isFree}
                            onClick={() => onOpenBook(item.raw || item)}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: item.isFree ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                              border: 0,
                              color: item.isFree ? '#3A0A1E' : '#888',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: item.isFree ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {item.isFree ? 'Book' : 'Booked'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
    
                  {!planExpandedPickId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentPlanTop3.length > 0 ? (
                        currentPlanTop3.map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={() => handlePlanPickClick(item)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 231, 176, 0.15)',
                              cursor: 'pointer',
                              transition: 'background 150ms ease, border-color 150ms ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  background: idx === 0 ? 'var(--gold)' : 'rgba(255, 231, 176, 0.15)',
                                  color: idx === 0 ? '#3A0A1E' : '#f8ebd8',
                                  fontWeight: 800,
                                  fontSize: '0.75rem',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  display: 'grid',
                                  placeItems: 'center',
                                  flexShrink: 0
                                }}
                              >
                                #{idx + 1}
                              </span>
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8ebd8' }}>
                                  {idx + 1}. {item.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                  ★ {item.rating} {item.capacity ? `· Cap ${item.capacity}` : ''}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontFamily: 'Yatra One', fontSize: '0.98rem', color: 'var(--gold)' }}>
                                {formatINR(item.cost)}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: item.fitsBudget ? 'var(--leaf)' : 'var(--rose)', fontWeight: 600 }}>
                                {item.fitsBudget ? 'Fits budget ✓' : item.note}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center', padding: '12px' }}>
                          No recommendations available for this category.
                        </div>
                      )}
                    </div>
                  )}
                </div>
    
                {/* Buttons: Save & Share */}
                <div className="mini">
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    style={{ color: savePlanFeedback ? 'var(--gold)' : '#FFE7B0' }}
                  >
                    {savePlanFeedback ? 'Saved ✓' : 'Save this plan'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSharePlan}
                    style={{ color: shareFeedback ? 'var(--gold)' : '#FFE7B0' }}
                  >
                    {shareFeedback ? 'Link copied ✓' : 'Share with family ↗'}
                  </button>
                </div>
              </div>
  );
}
