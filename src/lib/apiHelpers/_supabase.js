import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './_wake.js';

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

const SUPABASE_URL = readEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_KEY = readEnv(
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SECRET_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
);

let realSupabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    realSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: {
        fetch: async (url, options) => {
          const res = await fetch(url, options);
          if (!res.ok && res.status >= 500) triggerRestore();
          return res;
        },
      },
    });
  } catch (e) {
    console.warn('[Supabase] Init error:', e?.message);
  }
}

const tablesStore = new Map();

function getStore(tableName) {
  if (!tablesStore.has(tableName)) {
    if (tableName === 'sensor_data') {
      const nowStr = new Date().toISOString();
      tablesStore.set('sensor_data', [
        {
          id: 'mock_1',
          node_id: 1,
          device_id: 'node_1',
          temperature: 28.5,
          humidity: 65.0,
          soil_moisture: 72.0,
          wifi_status: 'connected',
          pump_status: false,
          feeder_status: false,
          created_at: nowStr,
        },
        {
          id: 'mock_2',
          node_id: 2,
          device_id: 'node_2',
          temperature: 29.1,
          humidity: 62.4,
          soil_moisture: 68.5,
          wifi_status: 'connected',
          pump_status: false,
          feeder_status: false,
          created_at: nowStr,
        },
      ]);
    } else {
      tablesStore.set(tableName, []);
    }
  }
  return tablesStore.get(tableName);
}

function createQueryChain(tableName) {
  const store = getStore(tableName);
  let action = 'select'; // 'select' | 'insert' | 'update' | 'delete'
  let filterFns = [];
  let limitVal = null;
  let isSingle = false;
  let insertRecords = null;
  let updateFields = null;

  const addFilter = (fn) => {
    filterFns.push(fn);
  };

  const passesFilters = (item) => {
    return filterFns.every((fn) => fn(item));
  };

  const chain = {
    select: () => {
      action = 'select';
      return chain;
    },
    insert: (records) => {
      action = 'insert';
      insertRecords = records;
      return chain;
    },
    upsert: (records) => {
      action = 'insert';
      insertRecords = records;
      return chain;
    },
    update: (fields) => {
      action = 'update';
      updateFields = fields;
      return chain;
    },
    delete: () => {
      action = 'delete';
      return chain;
    },
    order: () => chain,
    limit: (n) => {
      limitVal = n;
      return chain;
    },
    eq: (col, val) => {
      addFilter((item) => item[col] === val);
      return chain;
    },
    neq: (col, val) => {
      addFilter((item) => item[col] !== val);
      return chain;
    },
    lt: (col, val) => {
      addFilter((item) => item[col] < val);
      return chain;
    },
    lte: (col, val) => {
      addFilter((item) => item[col] <= val);
      return chain;
    },
    gt: (col, val) => {
      addFilter((item) => item[col] > val);
      return chain;
    },
    gte: (col, val) => {
      addFilter((item) => item[col] >= val);
      return chain;
    },
    in: (col, arr) => {
      const list = Array.isArray(arr) ? arr : [arr];
      addFilter((item) => list.includes(item[col]));
      return chain;
    },
    single: () => {
      isSingle = true;
      return chain;
    },
    maybeSingle: () => {
      isSingle = true;
      return chain;
    },
    then: (resolve) => {
      try {
        const currentStore = getStore(tableName);
        let resData = null;

        if (action === 'delete') {
          const deleted = currentStore.filter(passesFilters);
          const remaining = currentStore.filter((item) => !passesFilters(item));
          tablesStore.set(tableName, remaining);
          resData = isSingle ? (deleted[0] || null) : deleted;
        } else if (action === 'insert') {
          const items = Array.isArray(insertRecords) ? insertRecords : [insertRecords];
          const inserted = items.map((rec, idx) => ({
            id: rec.id || `${Date.now()}_${idx}`,
            created_at: rec.created_at || new Date().toISOString(),
            ...rec,
          }));
          currentStore.push(...inserted);
          resData = isSingle ? inserted[0] : (Array.isArray(insertRecords) ? inserted : inserted[0]);
        } else if (action === 'update') {
          const matches = currentStore.filter(passesFilters);
          matches.forEach((item) => Object.assign(item, updateFields));
          resData = isSingle ? (matches[0] || null) : matches;
        } else {
          let result = currentStore.filter(passesFilters);
          if (limitVal !== null) result = result.slice(0, limitVal);
          resData = isSingle ? (result[0] || null) : result;
        }

        resolve({ data: resData, error: null });
      } catch (err) {
        resolve({ data: null, error: { message: err?.message || 'Mock DB error' } });
      }
    },
    catch: (fn) => chain.then(null, fn),
  };

  return chain;
}

const mockSupabase = {
  from: (tableName) => createQueryChain(tableName),
};

const supabase = new Proxy(
  {},
  {
    get: (_, prop) => {
      if (prop === 'from') {
        return (tableName) => {
          if (realSupabase) {
            try {
              return realSupabase.from(tableName);
            } catch {
              return mockSupabase.from(tableName);
            }
          }
          return mockSupabase.from(tableName);
        };
      }
      return realSupabase ? realSupabase[prop] : mockSupabase[prop];
    },
  },
);

export default supabase;
