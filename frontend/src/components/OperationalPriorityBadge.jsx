import React from 'react';
import { calculateOperationalPriority } from '../utils/priorityEngine';

/**
 * OperationalPriorityBadge
 * Reusable operational priority indicator badge.
 * Multi-Signal Synthesis: Risk (40%), Abnormality (25%), Exposure (20%), Freshness (15%)
 */
export const OperationalPriorityBadge = ({ incident, size = 'md', showScore = false, showTooltip = true }) => {
  if (!incident) return null;

  const { level, score, config, breakdown } = calculateOperationalPriority(incident);
  const Icon = config.icon;
  const sizeClass = size === 'sm' ? 'op-priority-sm' : size === 'lg' ? 'op-priority-lg' : 'op-priority-md';
  const levelClass = `op-p-${level.toLowerCase()}`;

  const tooltipText = showTooltip
    ? `${config.prefix} • ${config.label} (${score}/100)\n` +
      `• Observation Age: ${breakdown.ageDays} days (Decay: ${breakdown.decayFactor ?? 1.0})\n` +
      `• Thermal Risk: ${breakdown.riskScore}/100\n` +
      `• Exposure Context: ${breakdown.exposureScore}/100\n` +
      `• Action: ${config.action}`
    : undefined;

  return (
    <span
      className={`op-priority-badge ${levelClass} ${sizeClass}`}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        color: config.textColor || config.color
      }}
      title={tooltipText}
    >
      <span className="op-priority-dot" style={{ backgroundColor: config.color }} />
      <Icon size={size === 'sm' ? 10 : size === 'lg' ? 13 : 11} />
      <span>{config.prefix || config.label}</span>
      {showScore && <span style={{ opacity: 0.85, fontSize: '0.9em' }}>({score})</span>}
    </span>
  );
};

export default OperationalPriorityBadge;
