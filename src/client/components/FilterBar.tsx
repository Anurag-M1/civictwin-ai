import React from 'react';
import { CIVIC_CATEGORIES } from '../../shared/constants.js';

interface FilterBarProps {
  selectedState: string;
  onSelectState: (state: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedState,
  onSelectState,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="gov-filter-bar">
      <div className="filter-group">
        <span className="filter-label">Jurisdiction (State):</span>
        <select
          className="filter-select"
          value={selectedState}
          onChange={(e) => onSelectState(e.target.value)}
        >
          <option value="">National Overview (All States)</option>
          <option value="KA">Karnataka (Bengaluru Urban, Mysuru)</option>
          <option value="MH">Maharashtra (Pune, Nagpur)</option>
          <option value="UP">Uttar Pradesh (Varanasi, Lucknow)</option>
          <option value="OD">Odisha (Khordha, Cuttack)</option>
        </select>
      </div>

      <div className="filter-group">
        <span className="filter-label">Civic Sector:</span>
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => onSelectCategory(e.target.value)}
        >
          <option value="">All Categories ({CIVIC_CATEGORIES.length})</option>
          {CIVIC_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>
        Deterministic Multi-State GIS Model • Active Horizon: <strong>FY 2025-2026</strong>
      </div>
    </div>
  );
};
