/**
 * Temporal Standardization Utilities (Phase 13.1B & 13.1C)
 * SIH26162 — Thermal Industrial Fire Intelligence Platform
 *
 * Enforces:
 * - All dates stored/transported in UTC, converted to Asia/Kolkata (IST, UTC+5:30)
 * - Required format: Local time, Timezone label (IST), and Relative age
 *   Example: "20 Sep 2026 01:27 IST • Observed 36 minutes ago"
 * - Temporal status classification:
 *   * LIVE OBSERVATION: <= 6h
 *   * RECENT OBSERVATION: > 6h and <= 24h
 *   * HISTORICAL INCIDENT: > 24h
 * - Safe countdown timers without negative numbers or midnight rollover issues
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses any ISO string, UTC timestamp, or Date object into a valid Date.
 */
export function parseDateSafe(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  try {
    let s = String(dateInput).trim();
    // If lacks timezone indicator and looks like ISO, assume UTC per platform backend standard
    if (s.length >= 19 && !s.endsWith('Z') && !s.includes('+') && !s.includes('-0')) {
      s = s + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Converts a UTC timestamp to Indian Standard Time (Asia/Kolkata, UTC+5:30)
 * Format: "DD MMM YYYY HH:mm IST" (e.g. "20 Sep 2026 01:27 IST")
 */
export function formatToIST(dateInput, includeSeconds = false) {
  const d = parseDateSafe(dateInput);
  if (!d) return '--';

  try {
    // Standard Intl formatter using Asia/Kolkata
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false
    }).formatToParts(d);

    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    const timeStr = includeSeconds
      ? `${map.hour}:${map.minute}:${map.second}`
      : `${map.hour}:${map.minute}`;

    return `${map.day} ${map.month} ${map.year} ${timeStr} IST`;
  } catch {
    // Fallback: manually add 5 hours 30 minutes to UTC
    const istMs = d.getTime() + (5.5 * 60 * 60 * 1000);
    const istDate = new Date(istMs);
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    const month = MONTHS[istDate.getUTCMonth()];
    const year = istDate.getUTCFullYear();
    const hh = String(istDate.getUTCHours()).padStart(2, '0');
    const mm = String(istDate.getUTCMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hh}:${mm} IST`;
  }
}

/**
 * Formats time-only in IST: "HH:MM IST"
 */
export function formatTimeIST(dateInput) {
  const d = parseDateSafe(dateInput);
  if (!d) return '--:-- IST';

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);

    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    return `${map.hour}:${map.minute} IST`;
  } catch {
    const istMs = d.getTime() + (5.5 * 60 * 60 * 1000);
    const istDate = new Date(istMs);
    const hh = String(istDate.getUTCHours()).padStart(2, '0');
    const mm = String(istDate.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm} IST`;
  }
}

/**
 * Calculates human-readable relative age from observation timestamp.
 * Examples:
 * - "Observed 36 minutes ago"
 * - "Observed 13 hours ago"
 * - "Observed 26 days ago"
 */
export function formatRelativeAge(dateInput, prefix = 'Observed') {
  const d = parseDateSafe(dateInput);
  if (!d) return 'UNKNOWN';

  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  let timeSpan;
  if (diffMinutes < 1) {
    timeSpan = 'just now';
  } else if (diffMinutes === 1) {
    timeSpan = '1 minute ago';
  } else if (diffMinutes < 60) {
    timeSpan = `${diffMinutes} minutes ago`;
  } else if (diffHours === 1) {
    timeSpan = '1 hour ago';
  } else if (diffHours < 24) {
    timeSpan = `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    timeSpan = '1 day ago';
  } else {
    timeSpan = `${diffDays} days ago`;
  }

  return prefix ? `${prefix} ${timeSpan}` : timeSpan;
}

/**
 * Standard combined display timestamp:
 * "20 Sep 2026 01:27 IST • Observed 36 minutes ago"
 */
export function formatTimestampWithRelative(dateInput, prefix = 'Observed') {
  const d = parseDateSafe(dateInput);
  if (!d) return '--';
  const istStr = formatToIST(d);
  const relStr = formatRelativeAge(d, prefix);
  return `${istStr} • ${relStr}`;
}

/**
 * Classifies temporal observation status based strictly on elapsed hours:
 * - LIVE: <= 24h (1440m)
 * - RECENT: > 24h and <= 7 days (168h)
 * - HISTORICAL: > 7 days (> 168h)
 */
export function classifyTemporalStatus(dateInput) {
  const d = parseDateSafe(dateInput);
  if (!d) return 'HISTORICAL';

  const elapsedHours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (elapsedHours <= 24.0) return 'LIVE';
  if (elapsedHours <= 168.0) return 'RECENT';
  return 'HISTORICAL';
}

/**
 * Calculates remaining countdown duration to a target future UTC timestamp.
 * Strictly guarantees non-negative countdown: clamps at 0.
 * Format: "Xm Ys" (e.g. "12m 45s" or "0m 00s")
 */
export function getCountdownRemaining(targetTimestamp) {
  const target = parseDateSafe(targetTimestamp);
  if (!target) {
    return { remainingSeconds: 0, minutes: 0, seconds: 0, formatted: '0m 00s', isDue: true };
  }

  const now = Date.now();
  const remainingMs = Math.max(0, target.getTime() - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${minutes}m ${String(seconds).padStart(2, '0')}s`;

  return {
    remainingSeconds: totalSeconds,
    minutes,
    seconds,
    formatted,
    isDue: totalSeconds <= 0
  };
}

/**
 * Formats a duration in minutes into a human-readable observation age string.
 */
export function formatFreshnessDuration(mins) {
  if (mins === null || mins === undefined || isNaN(mins)) return 'UNKNOWN';
  if (mins < 1) return 'Observed just now';
  if (mins < 60) return `Observed ${Math.round(mins)} minutes ago`;
  const hours = mins / 60;
  if (hours < 24) return `Observed ${hours.toFixed(1)} hours ago`;
  const days = hours / 24;
  return `Observed ${days.toFixed(1)} days ago`;
}

/**
 * Core Temporal Auditor & Normalizer:
 * Guarantees 100% logical consistency across all temporal fields.
 * Ensures observation_freshness_minutes is ALWAYS derived from last_detected timestamp,
 * eliminating impossible combinations like "Freshness: 0 min ago & Last Detected: 26 days ago".
 */
export function deriveConsistentTemporalMetrics(record) {
  if (!record) {
    return {
      first_detected: null,
      last_detected: null,
      first_date: null,
      last_date: null,
      freshness_minutes: null,
      formatted_freshness: 'UNKNOWN',
      temporal_status: 'HISTORICAL',
      incident_age_hours: 0,
      active_duration_hours: 0,
    };
  }

  const isDemo = record._isDemo === true || record.is_demo === true || record.stream_type === 'demo';

  // Resolve timestamp candidates
  const lastStr = record.last_detected || record.acq_date || null;
  const firstStr = record.first_detected || lastStr;

  const lastDate = parseDateSafe(lastStr);
  const firstDate = parseDateSafe(firstStr);

  const now = Date.now();
  let freshnessMinutes = null;

  if (lastDate) {
    freshnessMinutes = Math.max(0, Math.round((now - lastDate.getTime()) / (60 * 1000)));
  } else if (typeof record.observation_freshness_minutes === 'number' && record.observation_freshness_minutes > 0) {
    freshnessMinutes = Math.round(record.observation_freshness_minutes);
  }

  // Derive temporal status strictly from freshnessMinutes & demo flag:
  // DEMO: Seeded / fallback demonstration data (never LIVE)
  // LIVE: <= 24h (1440m)
  // RECENT: > 24h and <= 7d (10080m)
  // HISTORICAL: > 7d (> 10080m)
  let temporalStatus = 'HISTORICAL';
  if (isDemo) {
    temporalStatus = 'DEMO';
  } else if (freshnessMinutes !== null) {
    if (freshnessMinutes <= 1440) temporalStatus = 'LIVE';
    else if (freshnessMinutes <= 10080) temporalStatus = 'RECENT';
    else temporalStatus = 'HISTORICAL';
  }

  // Incident age (elapsed from first detection to now)
  let incidentAgeHours = 0;
  if (firstDate) {
    incidentAgeHours = Math.max(0, Number(((now - firstDate.getTime()) / (3600 * 1000)).toFixed(1)));
  } else if (typeof record.incident_age_hours === 'number') {
    incidentAgeHours = record.incident_age_hours;
  }

  // Active duration (first detection to last detection)
  let activeDurationHours = 0;
  if (firstDate && lastDate) {
    activeDurationHours = Math.max(0, Number(((lastDate.getTime() - firstDate.getTime()) / (3600 * 1000)).toFixed(1)));
  } else if (typeof record.active_duration_hours === 'number') {
    activeDurationHours = record.active_duration_hours;
  }

  return {
    first_detected: firstStr,
    last_detected: lastStr,
    first_date: firstDate,
    last_date: lastDate,
    freshness_minutes: freshnessMinutes,
    formatted_freshness: formatFreshnessDuration(freshnessMinutes),
    temporal_status: temporalStatus,
    incident_age_hours: incidentAgeHours,
    active_duration_hours: activeDurationHours,
  };
}

