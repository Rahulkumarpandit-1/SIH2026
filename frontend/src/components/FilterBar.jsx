import React from 'react';
import { Filter, Calendar, Layers } from 'lucide-react';

export const FilterBar = ({ 
  selectedRisk, 
  setSelectedRisk, 
  selectedClass, 
  setSelectedClass, 
  selectedDate, 
  setSelectedDate,
  availableDates = [] 
}) => {
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <span className="filter-label">
          <Filter size={13} />
          <span>Risk Level:</span>
        </span>
        {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((lvl) => (
          <button
            key={lvl}
            className={`filter-chip ${lvl === 'CRITICAL' ? 'critical' : ''} ${selectedRisk === lvl ? 'active' : ''}`}
            onClick={() => setSelectedRisk(lvl)}
          >
            {lvl}
          </button>
        ))}
      </div>

      <div className="filter-group">
        <span className="filter-label">
          <Layers size={13} />
          <span>Classification:</span>
        </span>
        <button
          className={`filter-chip ${selectedClass === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedClass('ALL')}
        >
          All Classes
        </button>
        <button
          className={`filter-chip ${selectedClass === 'INDUSTRIAL_FIRE_OUTBREAK' ? 'active' : ''}`}
          onClick={() => setSelectedClass('INDUSTRIAL_FIRE_OUTBREAK')}
        >
          Industrial Fire
        </button>
        <button
          className={`filter-chip ${selectedClass === 'PERSISTENT_OPERATIONAL_SOURCE' ? 'active' : ''}`}
          onClick={() => setSelectedClass('PERSISTENT_OPERATIONAL_SOURCE')}
        >
          Persistent Flares
        </button>
        <button
          className={`filter-chip ${selectedClass === 'NON_INDUSTRIAL_RURAL' ? 'active' : ''}`}
          onClick={() => setSelectedClass('NON_INDUSTRIAL_RURAL')}
        >
          Rural / Farm
        </button>
      </div>

      {availableDates.length > 0 && (
        <div className="filter-group">
          <span className="filter-label">
            <Calendar size={13} />
            <span>Date:</span>
          </span>
          <select 
            className="filter-chip"
            style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            <option value="ALL">All Dates</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
