export interface CachedPosProduct {
  tenantId: string;
  id: string;
  code: string;
  name: string;
  description?: string;
  unit_of_measure: string;
  sale_price: number | string;
  cost_price?: number | string;
  tax_percentage: number | string;
  tax_exemption_code?: string;
  is_stockable: boolean;
  stock_quantity?: number;
  barcode?: string;
  product_type?: string;
  exemption_reason_code?: string | null;
}

export interface OfflinePosSale {
  id: string; // UUID local da venda
  offlineDocumentNumber: string; // Ex: FR 2026A/OFF-000001
  sequenceNumber: number;
  seriesCode: string;
  fiscalYear: number;
  createdAt: string;
  tenantId: string;
  cashierName: string;
  posTerminalCode: string;
  customerName: string;
  customerNif?: string;
  paymentMethod: string;
  amountTendered: number;
  changeDue: number;
  netTotal: number;
  taxTotal: number;
  grossTotal: number;
  lines: Array<{
    lineNumber: number;
    productCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    lineTotal: number;
  }>;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  syncStartedAt?: string;
  syncedAt?: string;
  serverInvoiceId?: string;
  serverDocumentNumber?: string;
  syncError?: string;
}

const DB_NAME = 'KudibaPOS_OfflineDB';
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado neste navegador.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('cached_products')) {
        const productStore = db.createObjectStore('cached_products', { keyPath: 'id' });
        productStore.createIndex('code', 'code', { unique: false });
        productStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('cached_products_by_tenant')) {
        const productStore = db.createObjectStore('cached_products_by_tenant', {
          keyPath: ['tenantId', 'id'],
        });
        productStore.createIndex('tenantId', 'tenantId', { unique: false });
      }

      if (!db.objectStoreNames.contains('offline_sales')) {
        const salesStore = db.createObjectStore('offline_sales', { keyPath: 'id' });
        salesStore.createIndex('status', 'status', { unique: false });
        salesStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('pos_meta')) {
        db.createObjectStore('pos_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 1. Catálogo Offline
export async function cachePosProducts(
  tenantId: string,
  products: Omit<CachedPosProduct, 'tenantId'>[]
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cached_products_by_tenant', 'pos_meta'], 'readwrite');
    const store = tx.objectStore('cached_products_by_tenant');
    const meta = tx.objectStore('pos_meta');

    const previous = store.index('tenantId').openKeyCursor(IDBKeyRange.only(tenantId));
    previous.onsuccess = () => {
      const cursor = previous.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }

      for (const prod of products) {
        store.put({ ...prod, tenantId });
      }

      meta.put({
        key: `last_catalog_sync_${tenantId}`,
        timestamp: new Date().toISOString(),
      });
    };

    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Falha ao guardar o catálogo offline.'));
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao guardar o catálogo offline.'));
  });
}

export async function getCachedPosProducts(tenantId: string): Promise<CachedPosProduct[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_products_by_tenant', 'readonly');
    const store = tx.objectStore('cached_products_by_tenant');
    const request = store.index('tenantId').getAll(IDBKeyRange.only(tenantId));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function createLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('Este navegador não suporta geração segura de identificadores offline.');
}

export async function saveOfflineSale(
  sale: Omit<OfflinePosSale, 'status' | 'sequenceNumber' | 'offlineDocumentNumber'> & {
    id?: string;
  },
  seriesCode: string,
  fiscalYear: number
): Promise<OfflinePosSale> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pos_meta', 'offline_sales'], 'readwrite');
    const meta = tx.objectStore('pos_meta');
    const sales = tx.objectStore('offline_sales');
    const sequenceKey = `seq_${sale.tenantId}_${seriesCode}_${fiscalYear}`;
    let saleRecord: OfflinePosSale | undefined;

    const persistWithSequence = (currentValue: number) => {
      const sequenceNumber = currentValue + 1;
      saleRecord = {
        ...sale,
        id: sale.id || createLocalId(),
        sequenceNumber,
        offlineDocumentNumber: `FR ${seriesCode}/OFF-${String(sequenceNumber).padStart(6, '0')}`,
        seriesCode,
        fiscalYear,
        status: 'PENDING',
      };
      meta.put({ key: sequenceKey, value: sequenceNumber });
      sales.put(saleRecord);
    };

    const getSequence = meta.get(sequenceKey);
    getSequence.onsuccess = () => {
      if (getSequence.result?.value !== undefined) {
        persistWithSequence(Number(getSequence.result.value));
        return;
      }

      const legacySequence = meta.get(`seq_${seriesCode}_${fiscalYear}`);
      legacySequence.onsuccess = () =>
        persistWithSequence(Number(legacySequence.result?.value || 0));
      legacySequence.onerror = () => tx.abort();
    };
    getSequence.onerror = () => tx.abort();

    tx.oncomplete = () => {
      if (saleRecord) resolve(saleRecord);
      else reject(new Error('A venda offline não foi guardada.'));
    };
    tx.onabort = () => reject(tx.error ?? new Error('Falha ao guardar a venda offline.'));
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao guardar a venda offline.'));
  });
}

const SYNC_LEASE_MS = 5 * 60 * 1000;

function isSyncLeaseExpired(sale: OfflinePosSale, now = Date.now()): boolean {
  const startedAt = Date.parse(sale.syncStartedAt || '');
  return now - (Number.isFinite(startedAt) ? startedAt : 0) > SYNC_LEASE_MS;
}

export async function getPendingOfflineSales(tenantId: string): Promise<OfflinePosSale[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readonly');
    const store = tx.objectStore('offline_sales');
    const request = store.getAll();

    request.onsuccess = () => {
      const all: OfflinePosSale[] = request.result || [];
      const now = Date.now();
      const pending = all.filter(
        (sale) =>
          sale.tenantId === tenantId &&
          (sale.status === 'PENDING' ||
            sale.status === 'FAILED' ||
            (sale.status === 'SYNCING' && isSyncLeaseExpired(sale, now)))
      );
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function claimOfflineSale(id: string, tenantId: string): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    const request = store.get(id);
    let claimed = false;

    request.onsuccess = () => {
      const sale = request.result as OfflinePosSale | undefined;
      if (!sale || sale.tenantId !== tenantId) return;
      const staleSync = sale.status === 'SYNCING' && isSyncLeaseExpired(sale);
      if (sale.status !== 'PENDING' && sale.status !== 'FAILED' && !staleSync) return;
      store.put({
        ...sale,
        status: 'SYNCING',
        syncStartedAt: new Date().toISOString(),
      });
      claimed = true;
    };
    request.onerror = () => tx.abort();

    tx.oncomplete = () => resolve(claimed);
    tx.onabort = () => reject(tx.error ?? new Error('Falha ao reservar a venda para sincronização.'));
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao reservar a venda para sincronização.'));
  });
}

export async function countPendingOfflineSales(tenantId: string): Promise<number> {
  const pending = await getPendingOfflineSales(tenantId);
  return pending.length;
}

export async function markOfflineSaleSynced(
  id: string,
  tenantId: string,
  serverInvoiceId: string,
  serverDocumentNumber: string
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const sale = getReq.result as OfflinePosSale | undefined;
      if (!sale || sale.tenantId !== tenantId) return;
      const record: OfflinePosSale = {
        ...sale,
        status: 'SYNCED',
        syncedAt: new Date().toISOString(),
        syncStartedAt: undefined,
        serverInvoiceId,
        serverDocumentNumber,
        syncError: undefined,
      };
      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Falha ao concluir a sincronização offline.'));
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao concluir a sincronização offline.'));
  });
}

export async function markOfflineSaleFailed(
  id: string,
  tenantId: string,
  errorMessage: string
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const sale = getReq.result as OfflinePosSale | undefined;
      if (!sale || sale.tenantId !== tenantId) return;
      const record: OfflinePosSale = {
        ...sale,
        status: 'FAILED',
        syncStartedAt: undefined,
        syncError: errorMessage,
      };
      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Falha ao guardar o erro de sincronização.'));
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao guardar o erro de sincronização.'));
  });
}
