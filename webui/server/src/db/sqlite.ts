import { db } from './pool.js';
import { randomUUID } from 'crypto';

export function generateUUID(): string {
  return randomUUID();
}

export function toJSON(obj: unknown): string {
  return JSON.stringify(obj);
}

export function fromJSON<T>(str: string | null | undefined): T | null {
  if (!str) return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

export function fromArray<T>(str: string | null | undefined): T[] {
  if (!str) return [];
  try { return JSON.parse(str) as T[]; } catch { return []; }
}

export { db };