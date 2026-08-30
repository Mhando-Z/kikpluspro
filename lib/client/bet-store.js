const DATABASE_NAME = "kickpulse-ai";
const DATABASE_VERSION = 1;
const STORE_NAME = "tracked-bets";

function database() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local bet tracker."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("fixtureId", "fixtureId", { unique: true });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("kickoffAt", "kickoffAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function requestFromStore(mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    request.onerror = () => reject(request.error ?? new Error("Local storage operation failed."));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local storage transaction failed."));
  });
}

export async function listTrackedBets() {
  const rows = await requestFromStore("readonly", (store) => store.getAll());
  return rows.sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)));
}

export function saveTrackedBet(bet) {
  return requestFromStore("readwrite", (store) => store.put(bet));
}

export function removeTrackedBet(id) {
  return requestFromStore("readwrite", (store) => store.delete(id));
}

export async function saveTrackedBets(bets) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    bets.forEach((bet) => store.put(bet));
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("Could not update tracked bets.")); };
  });
}
