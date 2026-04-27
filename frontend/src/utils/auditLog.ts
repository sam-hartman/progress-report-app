import type { AuditLogEntry } from '../types';

const AUDIT_LOG_KEY = 'qpr-audit-log';
const MAX_ENTRIES = 500;

function readLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as AuditLogEntry[];
  } catch {
    return [];
  }
}

function writeLog(entries: AuditLogEntry[]): void {
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries));
}

export function logEvent(event: string, details?: string): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...(details !== undefined ? { details } : {}),
  };

  const existing = readLog();
  // Prepend new entry, then trim to MAX_ENTRIES (drop oldest)
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  writeLog(updated);
}

export function getAuditLog(): AuditLogEntry[] {
  return readLog();
}

export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_LOG_KEY);
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function exportAuditLog(): string {
  const entries = readLog();
  const header = 'timestamp,event,details';
  const rows = entries.map((entry) =>
    [
      escapeCSVField(entry.timestamp),
      escapeCSVField(entry.event),
      escapeCSVField(entry.details ?? ''),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}
