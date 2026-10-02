/**
 * Couche de compatibilité « firebase/firestore » au-dessus de Lovable Cloud.
 *
 * Chaque document est stocké dans la table `documents` (collection, id, data).
 * La sécurité est appliquée côté serveur par les règles d'accès de la base —
 * l'interface de la boutique (api.ts, hooks) reste inchangée.
 */
import { supabase } from "@/integrations/supabase/client";

type Data = Record<string, unknown>;

export interface Firestore {
  readonly type: "firestore";
}
const DB: Firestore = { type: "firestore" };
export function getFirestoreInstance(): Firestore {
  return DB;
}

/* ------------------------------ Timestamp ------------------------------ */

export class Timestamp {
  constructor(public readonly iso: string) {}
  static now() {
    return new Timestamp(new Date().toISOString());
  }
  static fromDate(d: Date) {
    return new Timestamp(d.toISOString());
  }
  static fromMillis(ms: number) {
    return new Timestamp(new Date(ms).toISOString());
  }
  toDate() {
    return new Date(this.iso);
  }
  toMillis() {
    return this.toDate().getTime();
  }
  toJSON() {
    return { __ts: this.iso };
  }
}

export function serverTimestamp(): Timestamp {
  return Timestamp.now();
}

function encode(value: unknown): unknown {
  if (value instanceof Timestamp) return { __ts: value.iso };
  if (value instanceof Date) return { __ts: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    const out: Data = {};
    for (const [k, v] of Object.entries(value as Data)) {
      if (v !== undefined) out[k] = encode(v);
    }
    return out;
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const obj = value as Data;
    if (typeof obj.__ts === "string" && Object.keys(obj).length === 1) {
      return new Timestamp(obj.__ts);
    }
    const out: Data = {};
    for (const [k, v] of Object.entries(obj)) out[k] = decode(v);
    return out;
  }
  return value;
}

/* ------------------------------ Références ----------------------------- */

export interface CollectionReference {
  readonly kind: "collection";
  readonly path: string;
  readonly id: string;
}
export interface DocumentReference {
  readonly kind: "doc";
  readonly collection: string;
  readonly id: string;
  readonly path: string;
}

function newId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  for (const b of bytes) id += chars[b % chars.length];
  return id;
}

export function collection(
  parent: Firestore | DocumentReference,
  ...segments: string[]
): CollectionReference {
  const base = (parent as DocumentReference).kind === "doc" ? [(parent as DocumentReference).path] : [];
  const path = [...base, ...segments].join("/");
  return { kind: "collection", path, id: segments[segments.length - 1] };
}

export function doc(
  parent: Firestore | CollectionReference,
  ...segments: string[]
): DocumentReference {
  let parts: string[];
  if ((parent as CollectionReference).kind === "collection") {
    parts = [...(parent as CollectionReference).path.split("/"), ...segments];
  } else {
    parts = segments;
  }
  if (parts.length % 2 === 1) parts.push(newId());
  const id = parts[parts.length - 1];
  const col = parts.slice(0, -1).join("/");
  return { kind: "doc", collection: col, id, path: `${col}/${id}` };
}

/* -------------------------------- Requêtes ------------------------------ */

type Constraint =
  | { type: "where"; field: string; op: string; value: unknown }
  | { type: "orderBy"; field: string; dir: "asc" | "desc" }
  | { type: "limit"; n: number };

export interface Query {
  readonly kind: "query";
  readonly path: string;
  readonly constraints: Constraint[];
}

export function where(field: string, op: string, value: unknown): Constraint {
  return { type: "where", field, op, value };
}
export function orderBy(field: string, dir: "asc" | "desc" = "asc"): Constraint {
  return { type: "orderBy", field, dir };
}
export function limit(n: number): Constraint {
  return { type: "limit", n };
}

export function query(
  base: CollectionReference | Query,
  ...constraints: Constraint[]
): Query {
  if ((base as Query).kind === "query") {
    return { kind: "query", path: base.path, constraints: [...(base as Query).constraints, ...constraints] };
  }
  return { kind: "query", path: base.path, constraints };
}

function toQuery(q: CollectionReference | Query): Query {
  return (q as Query).kind === "query" ? (q as Query) : { kind: "query", path: q.path, constraints: [] };
}

/* -------------------------------- Erreurs ------------------------------- */

class FirestoreError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function raise(error: { code?: string; message?: string }): never {
  const msg = error.message ?? "";
  if (error.code === "42501" || /row-level security|permission/i.test(msg)) {
    throw new FirestoreError("permission-denied", msg);
  }
  throw new FirestoreError(error.code ?? "unknown", msg || "Erreur base de données.");
}

/* -------------------------------- Snapshots ----------------------------- */

export interface DocumentSnapshot {
  id: string;
  ref: DocumentReference;
  exists(): boolean;
  data(): Data | undefined;
}
export type QueryDocumentSnapshot = DocumentSnapshot & { data(): Data };

export interface QuerySnapshot {
  docs: QueryDocumentSnapshot[];
  empty: boolean;
  size: number;
  forEach(cb: (d: QueryDocumentSnapshot) => void): void;
}

function makeSnap(colPath: string, id: string, data: Data | null): DocumentSnapshot {
  const ref = doc(DB, ...colPath.split("/"), id);
  const decoded = data ? (decode(data) as Data) : undefined;
  return { id, ref, exists: () => data !== null, data: () => decoded };
}

/* --------------------------------- Lecture ------------------------------ */

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const { data, error } = await supabase
    .from("documents")
    .select("id,data")
    .eq("collection", ref.collection)
    .eq("id", ref.id)
    .maybeSingle();
  if (error) raise(error);
  return makeSnap(ref.collection, ref.id, data ? (data.data as Data) : null);
}

function applyConstraints(q: Query, columns: string, head = false) {
  let req = supabase
    .from("documents")
    .select(columns, head ? { count: "exact", head: true } : undefined)
    .eq("collection", q.path);
  for (const c of q.constraints) {
    if (c.type === "where") {
      const text = `data->>${c.field}`;
      const json = `data->${c.field}`;
      const v = c.value;
      switch (c.op) {
        case "==":
          req = v === null || v === undefined ? req.is(text, null) : req.filter(text, "eq", String(v));
          break;
        case "!=":
          req = v === null ? req.not(text, "is", null) : req.filter(text, "neq", String(v));
          break;
        case "in":
          req = req.in(text, (v as unknown[]).map(String));
          break;
        case ">":
          req = req.filter(json, "gt", JSON.stringify(encode(v)));
          break;
        case ">=":
          req = req.filter(json, "gte", JSON.stringify(encode(v)));
          break;
        case "<":
          req = req.filter(json, "lt", JSON.stringify(encode(v)));
          break;
        case "<=":
          req = req.filter(json, "lte", JSON.stringify(encode(v)));
          break;
      }
    }
  }
  for (const c of q.constraints) {
    if (c.type === "orderBy") req = req.order(`data->${c.field}`, { ascending: c.dir === "asc" });
  }
  for (const c of q.constraints) {
    if (c.type === "limit") req = req.limit(c.n);
  }
  return req;
}

export async function getDocs(q: CollectionReference | Query): Promise<QuerySnapshot> {
  const qq = toQuery(q);
  const { data, error } = await applyConstraints(qq, "id,data");
  if (error) raise(error);
  const rows = (data ?? []) as unknown as { id: string; data: Data }[];
  const docs = rows.map((r) => makeSnap(qq.path, r.id, r.data) as QueryDocumentSnapshot);
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
}

export async function getCountFromServer(q: CollectionReference | Query) {
  const { count, error } = await applyConstraints(toQuery(q), "id", true);
  if (error) raise(error);
  return { data: () => ({ count: count ?? 0 }) };
}

/* -------------------------------- Écriture ------------------------------ */

function setPath(target: Data, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Data;
  }
  cur[keys[keys.length - 1]] = value;
}

function deepMerge(base: Data, patch: Data): Data {
  const out: Data = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Timestamp) &&
        out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Data, v as Data);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function readRaw(ref: DocumentReference): Promise<Data | null> {
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Data) : null;
}

async function insertRaw(ref: DocumentReference, data: Data) {
  const { error } = await supabase
    .from("documents")
    .insert({ collection: ref.collection, id: ref.id, data: encode(data) as never });
  return error;
}

async function updateRaw(ref: DocumentReference, data: Data) {
  const { error } = await supabase
    .from("documents")
    .update({ data: encode(data) as never })
    .eq("collection", ref.collection)
    .eq("id", ref.id);
  if (error) raise(error);
}

export async function setDoc(ref: DocumentReference, data: Data, opts?: { merge?: boolean }) {
  if (opts?.merge) {
    let existing: Data | null = null;
    try {
      existing = await readRaw(ref);
    } catch {
      existing = null;
    }
    if (existing) return updateRaw(ref, deepMerge(existing, data));
  }
  const err = await insertRaw(ref, data);
  if (!err) return;
  if (err.code === "23505") return updateRaw(ref, data);
  raise(err);
}

export async function addDoc(col: CollectionReference, data: Data): Promise<DocumentReference> {
  const ref = doc(col);
  const err = await insertRaw(ref, data);
  if (err) raise(err);
  return ref;
}

export async function updateDoc(ref: DocumentReference, patch: Data) {
  const existing = await readRaw(ref);
  if (!existing) throw new FirestoreError("not-found", "Document introuvable.");
  const next: Data = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (k.includes(".")) setPath(next, k, v);
    else next[k] = v;
  }
  await updateRaw(ref, next);
}

export async function deleteDoc(ref: DocumentReference) {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("collection", ref.collection)
    .eq("id", ref.id);
  if (error) raise(error);
}

/* ------------------------- Transactions & lots -------------------------- */

type Op = () => Promise<void>;

export function writeBatch(_db: Firestore) {
  const ops: Op[] = [];
  return {
    set(ref: DocumentReference, data: Data, opts?: { merge?: boolean }) {
      ops.push(() => setDoc(ref, data, opts));
      return this;
    },
    update(ref: DocumentReference, patch: Data) {
      ops.push(() => updateDoc(ref, patch));
      return this;
    },
    delete(ref: DocumentReference) {
      ops.push(() => deleteDoc(ref));
      return this;
    },
    async commit() {
      for (const op of ops) await op();
    },
  };
}

export async function runTransaction<T>(
  db: Firestore,
  fn: (tx: {
    get: (ref: DocumentReference) => Promise<DocumentSnapshot>;
    set: (ref: DocumentReference, data: Data, opts?: { merge?: boolean }) => unknown;
    update: (ref: DocumentReference, patch: Data) => unknown;
    delete: (ref: DocumentReference) => unknown;
  }) => Promise<T>
): Promise<T> {
  const batch = writeBatch(db);
  const result = await fn({
    get: getDoc,
    set: (r, d, o) => batch.set(r, d, o),
    update: (r, p) => batch.update(r, p),
    delete: (r) => batch.delete(r),
  });
  await batch.commit();
  return result;
}

/* ------------------------------ Temps réel ------------------------------ */

let channelSeq = 0;

export function onSnapshot(
  target: DocumentReference,
  next: (snap: DocumentSnapshot) => void,
  onError?: (e: unknown) => void
): () => void;
export function onSnapshot(
  target: Query | CollectionReference,
  next: (snap: QuerySnapshot) => void,
  onError?: (e: unknown) => void
): () => void;
export function onSnapshot(
  target: Query | CollectionReference | DocumentReference,
  next: (snap: never) => void,
  onError?: (e: unknown) => void
): () => void {
  let active = true;
  const isDoc = (target as DocumentReference).kind === "doc";
  const colPath = isDoc ? (target as DocumentReference).collection : (target as Query).path;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = async () => {
    try {
      const snap = isDoc
        ? await getDoc(target as DocumentReference)
        : await getDocs(target as Query);
      if (active) next(snap as never);
    } catch (e) {
      if (active) onError?.(e);
    }
  };
  void run();

  const channel = supabase
    .channel(`docs-${colPath}-${++channelSeq}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "documents", filter: `collection=eq.${colPath}` },
      () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(run, 250);
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
