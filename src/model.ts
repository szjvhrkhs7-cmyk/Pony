export type RecordKind = 'party' | 'character' | 'section' | 'session';
export type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export interface Conflict {
  id: string;
  field: string;
  local: unknown;
  remote: unknown;
  local_device?: string;
  remote_device?: string;
  local_date?: string;
  remote_date?: string;
}

export interface BaseRecord {
  id: string;
  type: RecordKind;
  created_at: string;
  updated_at: string;
  version: number;
  device_id: string;
  deleted_at: string | null;
  conflicts?: Conflict[];
  [key: string]: unknown;
}

export interface PartyRecord extends BaseRecord {
  type: 'party';
  title: string;
  description: string;
  players_count: number;
  status: string;
  start_date?: string;
  party?: string;
  goal?: string;
  image_id?: string | null;
}

export interface CharacterRecord extends BaseRecord {
  type: 'character';
  name: string;
  race?: string;
  class?: string;
  background?: string;
  image_id?: string | null;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SectionRecord extends BaseRecord {
  type: 'section';
  parent_id: string;
  kind: string;
  title: string;
  content: string;
  legacy_plain?: boolean;
}

export interface SessionRecord extends BaseRecord {
  type: 'session';
  parent_id: string;
  title: string;
  date?: string;
  location?: string;
  description?: string;
  content: string;
  image_id?: string | null;
}

export type ChronicleRecord = PartyRecord | CharacterRecord | SectionRecord | SessionRecord | BaseRecord;

export interface MediaRecord {
  id: string;
  blob: Blob;
  thumbnail?: Blob;
  mime?: string;
  width?: number;
  height?: number;
  upload_state?: string;
  storage_key?: string;
}

export interface DraftRecord {
  id: string;
  content: string;
  updated_at: string;
}

export const ABILITIES: ReadonlyArray<{key: AbilityKey; short: string; full: string; icon: string}> = [
  { key: 'strength', short: 'СИЛ', full: 'Сила', icon: '✦' },
  { key: 'dexterity', short: 'ЛОВ', full: 'Ловкость', icon: '➶' },
  { key: 'constitution', short: 'ТЕЛ', full: 'Телосложение', icon: '♥' },
  { key: 'intelligence', short: 'ИНТ', full: 'Интеллект', icon: '✣' },
  { key: 'wisdom', short: 'МДР', full: 'Мудрость', icon: '◉' },
  { key: 'charisma', short: 'ХАР', full: 'Харизма', icon: '✧' }
];

export const modifier = (value: number): number => Math.floor((Number(value) - 10) / 2);
export const signed = (value: number): string => value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
export const clampScore = (value: unknown): number => Math.max(1, Math.min(30, Math.trunc(Number(value)) || 10));

export function createRecord<T extends RecordKind>(type: T, fields: Record<string, unknown>, device = 'local'): ChronicleRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    created_at: now,
    updated_at: now,
    version: 1,
    device_id: device,
    deleted_at: null,
    ...fields
  } as ChronicleRecord;
}

export const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function mergeRecords(local: ChronicleRecord[], remote: ChronicleRecord[], base: ChronicleRecord[] = []): ChronicleRecord[] {
  const l = new Map(local.map((e) => [e.id, e]));
  const r = new Map(remote.map((e) => [e.id, e]));
  const b = new Map(base.map((e) => [e.id, e]));
  const result: ChronicleRecord[] = [];

  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const left = l.get(id);
    const right = r.get(id);
    const before = b.get(id);
    if (!left || !right) {
      result.push(structuredClone((left || right)!));
      continue;
    }
    if (equal(left, right)) {
      result.push(structuredClone(left));
      continue;
    }
    const out = { ...right } as ChronicleRecord;
    const conflicts = new Map<string, Conflict>([...(right.conflicts || []), ...(left.conflicts || [])].map(c => [c.id, c]));
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (['conflicts', 'version', 'updated_at', 'device_id'].includes(key)) continue;
      const lc = !equal(left[key], before?.[key]);
      const rc = !equal(right[key], before?.[key]);
      if (lc && !rc) out[key] = left[key];
      else if (lc && rc && !equal(left[key], right[key])) {
        const winner = left.updated_at > right.updated_at ? left : right;
        out[key] = winner[key];
        if (['content','description','name','title','party','goal','deleted_at','image_id'].includes(key)) {
          const cid = `${id}:${key}:${left.updated_at}:${right.updated_at}`;
          conflicts.set(cid, {
            id: cid,
            field: key,
            local: left[key] ?? null,
            remote: right[key] ?? null,
            local_device: left.device_id,
            remote_device: right.device_id,
            local_date: left.updated_at,
            remote_date: right.updated_at
          });
        }
      }
    }
    out.conflicts = [...conflicts.values()];
    out.version = Math.max(left.version || 1, right.version || 1);
    out.updated_at = left.updated_at > right.updated_at ? left.updated_at : right.updated_at;
    out.device_id = left.updated_at > right.updated_at ? left.device_id : right.device_id;
    result.push(out);
  }
  return result;
}

export function migrateLegacy(data: unknown): ChronicleRecord[] {
  const value = data as any;
  if (value?.format === 'seeker-notebook-3' && Array.isArray(value.records)) return value.records;
  if (!Array.isArray(value?.campaigns)) return [];
  const records: ChronicleRecord[] = [];
  for (const campaign of value.campaigns) {
    const stamp = new Date(campaign.updatedAt || campaign.createdAt || value.clientUpdatedAt || Date.now()).toISOString();
    const id = campaign.id || crypto.randomUUID();
    records.push(createRecord('party', {
      id,
      title: campaign.name || 'Без названия',
      description: campaign.subtitle || '',
      party: campaign.party || '',
      goal: campaign.goal || '',
      players_count: 0,
      status: 'В процессе',
      start_date: '',
      created_at: stamp,
      updated_at: stamp,
      device_id: value.deviceId || 'Прежняя версия'
    }));
    for (const [kind, label, content] of [
      ['history', 'История', campaign.journal || ''],
      ['notes', 'Заметки', campaign.quickNotes || '']
    ]) {
      records.push(createRecord('section', {
        id: `${id}:${kind}`,
        parent_id: id,
        kind,
        title: label,
        content,
        created_at: stamp,
        updated_at: stamp,
        device_id: value.deviceId || 'Прежняя версия'
      }));
    }
    for (const session of campaign.sessions || []) {
      const sid = session.id || crypto.randomUUID();
      records.push(createRecord('session', {
        id: sid,
        parent_id: id,
        title: session.title || 'Игровой день',
        date: session.date || '',
        location: session.location || '',
        description: session.teaser || '',
        content: session.notes || '',
        image_id: `legacy-${sid}`,
        created_at: stamp,
        updated_at: stamp,
        device_id: value.deviceId || 'Прежняя версия'
      }));
    }
  }
  return records;
}

export const escapeHtml = (value: unknown): string => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function sanitizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html || '';
  const allowed = new Set(['P','BR','B','STRONG','UL','OL','LI']);
  const nodes = [...template.content.querySelectorAll('*')];
  for (const node of nodes) {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      continue;
    }
    for (const attribute of [...node.attributes]) node.removeAttribute(attribute.name);
  }
  return template.innerHTML;
}
