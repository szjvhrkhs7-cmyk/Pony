export const ABILITIES = [
  ["strength", "СИЛ", "Сила"],
  ["dexterity", "ЛОВ", "Ловкость"],
  ["constitution", "ТЕЛ", "Телосложение"],
  ["intelligence", "ИНТ", "Интеллект"],
  ["wisdom", "МДР", "Мудрость"],
  ["charisma", "ХАР", "Харизма"],
];
export const modifier = (value) => Math.floor((Number(value) - 10) / 2);
export const signed = (value) =>
  value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
export const equal = (a, b) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function record(type, fields = {}, device = "local") {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    created_at: now,
    updated_at: now,
    version: 1,
    device_id: device,
    deleted_at: null,
    ...fields,
  };
}
// Three-way, field-level merge. Text conflicts retain complete alternatives.
export function mergeRecords(local, remote, base = []) {
  const l = new Map(local.map((e) => [e.id, e])),
    r = new Map(remote.map((e) => [e.id, e])),
    b = new Map(base.map((e) => [e.id, e]));
  const result = [];
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const left = l.get(id),
      right = r.get(id),
      before = b.get(id);
    if (!left || !right) {
      result.push(structuredClone(left || right));
      continue;
    }
    if (equal(left, right)) {
      result.push(structuredClone(left));
      continue;
    }
    const out = { ...right };
    const resolved = new Set(
      (before?.conflicts || [])
        .filter(
          (c) =>
            !(left.conflicts || []).some((x) => x.id === c.id) ||
            !(right.conflicts || []).some((x) => x.id === c.id),
        )
        .map((c) => c.id),
    );
    const conflicts = new Map(
      [...(right.conflicts || []), ...(left.conflicts || [])]
        .filter((c) => !resolved.has(c.id))
        .map((c) => [c.id, c]),
    );
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (["conflicts", "version", "updated_at", "device_id"].includes(key))
        continue;
      const lc = !equal(left[key], before?.[key]),
        rc = !equal(right[key], before?.[key]);
      if (lc && !rc) out[key] = left[key];
      else if (lc && rc && !equal(left[key], right[key])) {
        const winner = left.updated_at > right.updated_at ? left : right;
        out[key] = winner[key];
        if (
          [
            "content",
            "description",
            "name",
            "title",
            "party",
            "goal",
            "deleted_at",
            "image_id",
          ].includes(key)
        ) {
          const cid = JSON.stringify(
            [id, key, left[key] ?? null, right[key] ?? null].sort((a, b) =>
              String(a).localeCompare(String(b)),
            ),
          );
          conflicts.set(cid, {
            id: cid,
            field: key,
            local: left[key] ?? null,
            remote: right[key] ?? null,
            local_device: left.device_id,
            remote_device: right.device_id,
            local_date: left.updated_at,
            remote_date: right.updated_at,
          });
        }
      }
    }
    // Never silently hide edited text because another device deleted its parent.
    if (
      (left.deleted_at || right.deleted_at) &&
      !equal(left, before) &&
      !equal(right, before) &&
      left.deleted_at !== right.deleted_at
    ) {
      out.deleted_at = null;
      const cid = `${id}:deletion:${left.updated_at}:${right.updated_at}`;
      conflicts.set(cid, {
        id: cid,
        field: "deleted_at",
        local: left.deleted_at,
        remote: right.deleted_at,
        local_device: left.device_id,
        remote_device: right.device_id,
      });
    }
    out.conflicts = [...conflicts.values()];
    out.version = Math.max(left.version || 1, right.version || 1);
    out.updated_at =
      left.updated_at > right.updated_at ? left.updated_at : right.updated_at;
    out.device_id =
      left.updated_at > right.updated_at ? left.device_id : right.device_id;
    result.push(out);
  }
  return result;
}
export function migrateLegacy(data) {
  if (data?.format === "seeker-notebook-3" && Array.isArray(data.records))
    return data.records;
  if (!Array.isArray(data?.campaigns))
    throw new Error("Неизвестный формат копии");
  const records = [];
  for (const c of data.campaigns) {
    const stamp = new Date(
      c.updatedAt || c.createdAt || data.clientUpdatedAt || 0,
    ).toISOString();
    const meta = {
      created_at: stamp,
      updated_at: stamp,
      device_id: data.deviceId || "Прежняя версия",
    };
    const id = c.id || crypto.randomUUID();
    records.push(
      record("party", {
        ...meta,
        id,
        title: c.name || "Без названия",
        description: c.subtitle || "",
        party: c.party || "",
        goal: c.goal || "",
        players_count: 0,
        status: "В процессе",
        start_date: "",
      }),
    );
    for (const [kind, title, content] of [
      ["history", "История", c.journal || ""],
      ["notes", "Заметки", c.quickNotes || ""],
    ]) {
      records.push(
        record("section", {
          ...meta,
          id: `${id}:${kind}`,
          parent_id: id,
          kind,
          title,
          content,
          legacy_plain: kind === "notes",
        }),
      );
    }
    for (const s of c.sessions || []) {
      const sid = s.id || crypto.randomUUID();
      records.push(
        record("session", {
          ...meta,
          id: sid,
          parent_id: id,
          title: s.title || "Игровой день",
          date: s.date || "",
          location: s.location || "",
          description: s.teaser || "",
          content: s.notes || "",
          image_id: `legacy-${sid}`,
          legacy_image_id: sid,
        }),
      );
    }
  }
  return records;
}
