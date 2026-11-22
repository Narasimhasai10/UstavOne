import React from 'react';
import { getLuminance } from '../../shared/utils/contrastUtils.js';

export default function DashboardEventChips({
  events,
  selectedEventIndex,
  onSelectEvent
}) {
  return (
            <div className="chips" role="tablist" aria-label="Celebration types">
              {events.map((ev, i) => {
                const isSelected = i === selectedEventIndex;
                const isEducational = ev.id === 'educational';
                const lum = getLuminance(ev.color);
                const activeTextColor = isEducational ? 'rgb(248, 235, 216)' : (lum > 0.35 ? '#3A0A1E' : '#FFFFFF');
                const chipTextColor = isSelected ? activeTextColor : '#F8EBD8';
    
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="chip"
                    data-event={ev.id}
                    style={{
                      '--c': ev.color,
                      '--chip-text': activeTextColor,
                      backgroundColor: isSelected ? ev.color : 'var(--card)',
                      borderColor: isSelected ? ev.color : 'var(--line)',
                      color: chipTextColor,
                      fontWeight: isSelected ? 700 : 500
                    }}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectEvent(i)}
                  >
                    <span>{ev.emoji}</span> {ev.name}
                  </button>
                );
              })}
            </div>
  );
}
