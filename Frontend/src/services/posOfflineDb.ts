// =============================================================================
// Kudiba ERP: Motor IndexedDB de Faturação e Vendas POS em Modo Offline (PWA)
// Conformidade legal com regime de contingência: Decreto Presidencial n.º 71/25
// =============================================================================

export interface CachedPosProduct {
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
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  syncedAt?: string;
  serverInvoiceId?: string;
  serverDocumentNumber?: string;
  syncError?: string;
}

const DB_NAME = 'KudibaPOS_OfflineDB';
const DB_VERSION = 1;

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
export async function cachePosProducts(products: CachedPosProduct[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cached_products', 'pos_meta'], 'readwrite');
    const store = tx.objectStore('cached_products');
    const meta = tx.objectStore('pos_meta');

    store.clear();
    for (const prod of products) {
      store.put(prod);
    }

    meta.put({ key: 'last_catalog_sync', timestamp: new Date().toISOString() });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedPosProducts(): Promise<CachedPosProduct[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_products', 'readonly');
    const store = tx.objectStore('cached_products');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// 2. Numeração Sequencial Local de Contingência (DP 71/25)
export async function getNextOfflineSequence(seriesCode = '2026A', fiscalYear = 2026): Promise<{ sequenceNumber: number; documentNumber: string }> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pos_meta', 'readwrite');
    const store = tx.objectStore('pos_meta');
    const key = `seq_${seriesCode}_${fiscalYear}`;

    const getReq = store.get(key);
    getReq.onsuccess = () => {
      const current = getReq.result?.value || 0;
      const nextSeq = current + 1;
      store.put({ key, value: nextSeq });

      const padded = String(nextSeq).padStart(6, '0');
      const docNum = `FR ${seriesCode}/OFF-${padded}`;
      resolve({ sequenceNumber: nextSeq, documentNumber: docNum });
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// 3. Registo de Venda Offline
export async function saveOfflineSale(sale: Omit<OfflinePosSale, 'status' | 'id'> & { id?: string }): Promise<OfflinePosSale> {
  const db = await openDb();
  const saleRecord: OfflinePosSale = {
    ...sale,
    id: sale.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `off_${Date.now()}`),
    status: 'PENDING',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    store.put(saleRecord);

    tx.oncomplete = () => resolve(saleRecord);
    tx.onerror = () => reject(tx.error);
  });
}

// 4. Consulta de Vendas Pendentes
export async function getPendingOfflineSales(): Promise<OfflinePosSale[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readonly');
    const store = tx.objectStore('offline_sales');
    const request = store.getAll();

    request.onsuccess = () => {
      const all: OfflinePosSale[] = request.result || [];
      const pending = all.filter((s) => s.status === 'PENDING' || s.status === 'FAILED');
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function countPendingOfflineSales(): Promise<number> {
  const pending = await getPendingOfflineSales();
  return pending.length;
}

// 5. Marcação de Sincronização
export async function markOfflineSaleSynced(
  id: string,
  serverInvoiceId: string,
  serverDocumentNumber: string
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      if (!getReq.result) return resolve();
      const record: OfflinePosSale = {
        ...getReq.result,
        status: 'SYNCED',
        syncedAt: new Date().toISOString(),
        serverInvoiceId,
        serverDocumentNumber,
        syncError: undefined,
      };
      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markOfflineSaleFailed(id: string, errorMessage: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      if (!getReq.result) return resolve();
      const record: OfflinePosSale = {
        ...getReq.result,
        status: 'FAILED',
        syncError: errorMessage,
      };
      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
