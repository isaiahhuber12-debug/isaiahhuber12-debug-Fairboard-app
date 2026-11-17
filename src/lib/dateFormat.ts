export function formatDateShort(epochMs: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(epochMs));
}

export function formatDateFull(epochMs: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(epochMs)
  );
}

export function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(epochMs));
}

export function formatDateTime(epochMs: number): string {
  return `${formatDateShort(epochMs)}, ${formatTime(epochMs)}`;
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

export function dayKeyFromEpoch(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayKey(year: number, month: number, dayOfMonth: number): string {
  return `${year}-${month}-${dayOfMonth}`;
}

export function countdownLabel(targetEpochMs: number): string {
  const diffMs = targetEpochMs - Date.now();
  if (diffMs <= 0) return 'Now / Passed';
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `in ${days}d ${hours % 24}h`;
  if (hours >= 1) return `in ${hours}h ${minutes % 60}m`;
  return `in ${minutes}m`;
}

export function formatRelativeTime(epochMs: number, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - epochMs);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 45) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(epochMs);
}

export function toDateInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function toTimeInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function applyDateInput(epochMs: number, dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return epochMs;
  const d = new Date(epochMs);
  d.setFullYear(parts[0], parts[1] - 1, parts[2]);
  return d.getTime();
}

export function applyTimeInput(epochMs: number, timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return epochMs;
  const d = new Date(epochMs);
  d.setHours(parts[0], parts[1], 0, 0);
  return d.getTime();
}
