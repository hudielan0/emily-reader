// Everything the reader remembers lives in the browser's IndexedDB:
//   books      the EPUB file itself + title/author/language   (written once per book)
//   positions  where each book was left (CFI) + percentage     (written on every page turn)
//   locations  the whole-book progress table, so it is computed only once per book
//   kv         small values: lastBookId, settings
const DB_NAME = "emily-reader";
const DB_VERSION = 1;

const req = r => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function openDb(idb) {
  const r = idb.open(DB_NAME, DB_VERSION);
  r.onupgradeneeded = () => {
    const db = r.result;
    for (const name of ["books", "positions", "locations"]) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
  };
  return req(r);
}

export function createStore(idb = globalThis.indexedDB) {
  if (!idb) throw new Error("这个浏览器不支持本地存储（IndexedDB）");
  const dbp = openDb(idb);

  async function run(store, mode, fn) {
    const db = await dbp;
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    const value = result instanceof IDBRequest ? await req(result) : result;
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("存储被中断"));
    });
    return value;
  }
  const get = (store, key) => run(store, "readonly", s => s.get(key));
  const put = (store, value, key) => run(store, "readwrite", s => (key === undefined ? s.put(value) : s.put(value, key)));

  return {
    /** Save a book the first time it is opened; the file itself is never rewritten. */
    async saveBook({ id, data, title = "", author = "", lang = "" }) {
      const existing = await get("books", id);
      if (existing) return false;
      await put("books", { id, data, title, author, lang, addedAt: Date.now() });
      return true;
    },
    getBook: id => get("books", id),
    countBooks: () => run("books", "readonly", s => s.count()),

    savePosition: (id, { cfi, percent = null }) => put("positions", { id, cfi, percent, updatedAt: Date.now() }),
    getPosition: id => get("positions", id),

    saveLocations: (id, json) => put("locations", { id, json }),
    getLocations: async id => (await get("locations", id))?.json ?? null,

    getLastBookId: () => get("kv", "lastBookId"),
    setLastBookId: id => put("kv", id, "lastBookId"),

    async getSettings(defaults = {}) {
      return { ...defaults, ...((await get("kv", "settings")) || {}) };
    },
    setSettings: settings => put("kv", settings, "settings"),
  };
}

// The same file always gets the same id, so choosing it again finds the saved copy and position.
export async function bookId(data) {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}
