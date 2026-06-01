import { vi } from 'vitest';

/**
 * Mock centralizado y reutilizable del cliente de Supabase.
 *
 * Imita el contrato real que usa la app (ver utils/supabaseHelpers.ts,
 * context/DataContext.tsx, hooks/*):
 *
 *   supabase.from(table)
 *     .select('*').eq().ilike().in().neq().gte().lte().order().limit()
 *     .maybeSingle() / .single()                    → { data, error }
 *   supabase.from(table).insert/update/upsert/delete(...).eq(...)  → { data, error }
 *   supabase.channel(name).on(...).subscribe()
 *   supabase.removeChannel(ch)
 *   supabase.auth.getSession()/onAuthStateChange()/signInWithOAuth()/signOut()
 *
 * El builder es "thenable": `await supabase.from('x').select('*')` resuelve a
 * `{ data, error }` igual que el cliente real.
 *
 * Reutilizable para:
 *  - smoke tests (montar vistas con datos sembrados)
 *  - tests de flujo (alta de inquilino, registro/aprobación de pago) — incluye
 *    inyección de errores para simular violaciones de FK (código 23503), etc.
 */

export type Row = Record<string, any>;
export type SeedData = Record<string, Row[]>;

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

interface ChannelHandler {
  event: string;
  filter: any;
  callback: (payload: any) => void;
}

export interface SupabaseMock {
  /** El objeto que se inyecta como `supabase`. */
  client: any;
  /** Store mutable de filas por tabla (las inserciones se reflejan acá). */
  store: SeedData;
  /** Fuerza que la próxima operación terminal devuelva este error. */
  failNext(error: SupabaseError): void;
  /** Fuerza un error persistente para (tabla, operación). */
  forceError(table: string, op: Op, error: SupabaseError): void;
  /** Limpia errores forzados. */
  clearErrors(): void;
  /** Dispara un evento realtime hacia los handlers suscritos a esa tabla. */
  emitRealtime(table: string, payload: any): void;
  /** Setea la sesión que devolverá auth.getSession(). */
  setSession(session: any): void;
  /** Dispara onAuthStateChange manualmente (event, session). */
  triggerAuthChange(event: string, session: any): void;
  /** Espías para aserciones en tests. */
  spies: {
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    signInWithOAuth: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
}

const clone = (rows: Row[]): Row[] => rows.map((r) => ({ ...r }));

export function createSupabaseMock(seed: SeedData = {}): SupabaseMock {
  const store: SeedData = {};
  for (const [table, rows] of Object.entries(seed)) {
    store[table] = clone(rows);
  }

  let nextError: SupabaseError | null = null;
  const forcedErrors = new Map<string, SupabaseError>();
  const channelHandlers = new Map<string, ChannelHandler[]>();
  let currentSession: any = null;
  let authChangeCallback: ((event: string, session: any) => void) | null = null;

  const spies = {
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  };

  const takeError = (table: string, op: Op): SupabaseError | null => {
    if (nextError) {
      const e = nextError;
      nextError = null;
      return e;
    }
    return forcedErrors.get(`${table}:${op}`) ?? null;
  };

  function makeBuilder(table: string) {
    if (!store[table]) store[table] = [];

    let op: Op = 'select';
    let payload: Row[] = [];
    let updates: Row = {};
    let onConflict = 'id';
    const filters: Array<(r: Row) => boolean> = [];
    let orderKey: string | null = null;
    let orderAsc = true;
    let limitN: number | null = null;

    const matched = () => {
      let rows = (store[table] || []).filter((r) => filters.every((f) => f(r)));
      if (orderKey) {
        const key = orderKey;
        rows = [...rows].sort((a, b) => {
          if (a[key] === b[key]) return 0;
          const cmp = a[key] > b[key] ? 1 : -1;
          return orderAsc ? cmp : -cmp;
        });
      }
      if (limitN != null) rows = rows.slice(0, limitN);
      return rows;
    };

    const resolve = (): { data: any; error: SupabaseError | null } => {
      const error = takeError(table, op);
      if (error) return { data: null, error };

      switch (op) {
        case 'select':
          return { data: clone(matched()), error: null };
        case 'insert': {
          store[table].push(...clone(payload));
          return { data: clone(payload), error: null };
        }
        case 'upsert': {
          for (const row of payload) {
            const idx = store[table].findIndex(
              (r) => r[onConflict] === row[onConflict]
            );
            if (idx >= 0) store[table][idx] = { ...store[table][idx], ...row };
            else store[table].push({ ...row });
          }
          return { data: clone(payload), error: null };
        }
        case 'update': {
          const target = matched();
          target.forEach((r) => Object.assign(r, updates));
          return { data: clone(target), error: null };
        }
        case 'delete': {
          const toDelete = matched();
          store[table] = store[table].filter((r) => !toDelete.includes(r));
          return { data: clone(toDelete), error: null };
        }
      }
    };

    const builder: any = {
      // --- operaciones ---
      select: (_cols?: string) => builder,
      insert: (rows: Row | Row[]) => {
        op = 'insert';
        payload = Array.isArray(rows) ? rows : [rows];
        spies.insert(table, rows);
        return builder;
      },
      upsert: (rows: Row | Row[], opts?: { onConflict?: string }) => {
        op = 'upsert';
        payload = Array.isArray(rows) ? rows : [rows];
        if (opts?.onConflict) onConflict = opts.onConflict;
        spies.upsert(table, rows, opts);
        return builder;
      },
      update: (vals: Row) => {
        op = 'update';
        updates = vals;
        spies.update(table, vals);
        return builder;
      },
      delete: () => {
        op = 'delete';
        spies.delete(table);
        return builder;
      },
      // --- filtros (encadenables) ---
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      neq: (col: string, val: any) => {
        filters.push((r) => r[col] !== val);
        return builder;
      },
      ilike: (col: string, pattern: string) => {
        const needle = String(pattern).replace(/%/g, '').toLowerCase();
        filters.push((r) => String(r[col] ?? '').toLowerCase().includes(needle));
        return builder;
      },
      in: (col: string, vals: any[]) => {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      gte: (col: string, val: any) => {
        filters.push((r) => r[col] >= val);
        return builder;
      },
      lte: (col: string, val: any) => {
        filters.push((r) => r[col] <= val);
        return builder;
      },
      gt: (col: string, val: any) => {
        filters.push((r) => r[col] > val);
        return builder;
      },
      lt: (col: string, val: any) => {
        filters.push((r) => r[col] < val);
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderKey = col;
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      limit: (n: number) => {
        limitN = n;
        return builder;
      },
      // --- terminales que devuelven una fila ---
      maybeSingle: () => {
        const { data, error } = resolve();
        if (error) return Promise.resolve({ data: null, error });
        const rows = data as Row[];
        if (rows.length > 1) {
          return Promise.resolve({
            data: null,
            error: {
              code: 'PGRST116',
              message: `Results contain ${rows.length} rows`,
            } as SupabaseError,
          });
        }
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single: () => {
        const { data, error } = resolve();
        if (error) return Promise.resolve({ data: null, error });
        const rows = data as Row[];
        if (rows.length !== 1) {
          return Promise.resolve({
            data: null,
            error: {
              code: 'PGRST116',
              message: `Results contain ${rows.length} rows`,
            } as SupabaseError,
          });
        }
        return Promise.resolve({ data: rows[0], error: null });
      },
      // --- thenable: await del builder resuelve la operación ---
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };

    return builder;
  }

  const client = {
    from: (table: string) => makeBuilder(table),

    channel: (name: string) => {
      if (!channelHandlers.has(name)) channelHandlers.set(name, []);
      const chan: any = {
        on: (event: string, filter: any, callback: (p: any) => void) => {
          channelHandlers.get(name)!.push({ event, filter, callback });
          return chan;
        },
        subscribe: (cb?: (status: string) => void) => {
          if (cb) cb('SUBSCRIBED');
          return chan;
        },
        unsubscribe: () => Promise.resolve('ok'),
        _name: name,
      };
      return chan;
    },

    removeChannel: vi.fn((chan?: any) => {
      if (chan?._name) channelHandlers.delete(chan._name);
      return Promise.resolve('ok');
    }),

    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: currentSession }, error: null }),
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        authChangeCallback = cb;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      },
      signInWithOAuth: (...args: any[]) => {
        spies.signInWithOAuth(...args);
        return Promise.resolve({ data: { provider: 'google', url: '' }, error: null });
      },
      signOut: () => {
        spies.signOut();
        return Promise.resolve({ error: null });
      },
      exchangeCodeForSession: () =>
        Promise.resolve({ data: { session: currentSession }, error: null }),
      setSession: () =>
        Promise.resolve({ data: { session: currentSession }, error: null }),
    },
  };

  const api: SupabaseMock = {
    client,
    store,
    failNext: (error) => {
      nextError = error;
    },
    forceError: (table, op, error) => {
      forcedErrors.set(`${table}:${op}`, error);
    },
    clearErrors: () => {
      nextError = null;
      forcedErrors.clear();
    },
    emitRealtime: (table, payload) => {
      for (const handlers of channelHandlers.values()) {
        for (const h of handlers) {
          const evTable = h.filter?.table;
          if (!evTable || evTable === table) h.callback(payload);
        }
      }
    },
    setSession: (session) => {
      currentSession = session;
    },
    triggerAuthChange: (event, session) => {
      currentSession = session;
      authChangeCallback?.(event, session);
    },
    spies,
  };

  setActiveSupabaseMock(api);
  return api;
}

/**
 * Registro del mock "activo".
 *
 * `vi.mock()` se hoistea por archivo y su factory corre de forma perezosa al
 * importar el módulo mockeado — momento en el que la instancia creada con
 * `createSupabaseMock()` quizá todavía no exista. Para evitar ese problema de
 * orden, la factory lee del registro vía getter perezoso.
 *
 * Patrón de uso en un test (una sola línea de vi.mock por archivo):
 *
 *   import { createSupabaseMock, getActiveSupabaseClient } from '../test/mocks/supabase';
 *
 *   vi.mock('@/services/supabaseClient', () => ({
 *     get supabase() { return getActiveSupabaseClient(); },
 *     signInWithGoogle: (...a: any[]) => getActiveSupabaseClient().auth.signInWithOAuth(...a),
 *     signOut: () => getActiveSupabaseClient().auth.signOut(),
 *   }));
 *
 *   beforeEach(() => { createSupabaseMock({ tenants: [...] }); });
 *
 * `createSupabaseMock()` registra automáticamente la instancia como activa.
 */
let activeMock: SupabaseMock | null = null;

export function setActiveSupabaseMock(mock: SupabaseMock): void {
  activeMock = mock;
}

export function getActiveSupabaseClient(): any {
  if (!activeMock) {
    throw new Error(
      '[supabase mock] No hay mock activo. Llamá createSupabaseMock() en un beforeEach antes de montar componentes.'
    );
  }
  return activeMock.client;
}
