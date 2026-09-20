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
  if (!d) return 'N/A';

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
 * - LIVE: <= 6h
 * - RECENT: > 6h and <= 24h
 * - HISTORICAL: > 24h
 */
export function classifyTemporalStatus(dateInput) {
  const d = parseDateSafe(dateInput);
  if (!d) return 'HISTORICAL';

  const elapsedHours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (elapsedHours <= 6.0) return 'LIVE';
  if (elapsedHours <= 24.0) return 'RECENT';
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
