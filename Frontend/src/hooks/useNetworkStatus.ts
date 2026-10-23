import { useState, useEffect, useCallback } from 'react';
import {
  claimOfflineSale,
  getPendingOfflineSales,
  markOfflineSaleSynced,
  markOfflineSaleFailed,
  countPendingOfflineSales,
} from '../services/posOfflineDb';
import { invoicingApi } from '../api/invoicing';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';

export interface UseNetworkStatusReturn {
  isOnline: boolean;
  isBackendReachable: boolean;
  isContingencyMode: boolean;
  pendingOfflineCount: number;
  isSyncing: boolean;
  checkHealth: () => Promise<boolean>;
  syncPendingSales: () => Promise<{ success: number; failed: number }>;
  refreshPendingCount: () => Promise<number>;
}

export function useNetworkStatus(): UseNetworkStatusReturn {
  const tenantId = useAuthStore((state) => state.activeTenant?.id);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isBackendReachable, setIsBackendReachable] = useState<boolean>(true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    if (!tenantId) {
      setPendingOfflineCount(0);
      return 0;
    }
    try {
      const count = await countPendingOfflineSales(tenantId);
      setPendingOfflineCount(count);
      return count;
    } catch {
      return 0;
    }
  }, [tenantId]);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setIsBackendReachable(false);
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
      try {
        const res = await fetch(`${baseUrl}/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        const reachable = res.ok;
        setIsOnline(typeof navigator === 'undefined' || navigator.onLine);
        setIsBackendReachable(reachable);
        return reachable;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      setIsOnline(typeof navigator === 'undefined' || navigator.onLine);
      setIsBackendReachable(false);
      return false;
    }
  }, []);

  const syncPendingSales = useCallback(async () => {
    if (!tenantId) {
      toast.error('Selecione uma empresa antes de sincronizar vendas offline.');
      return { success: 0, failed: 0 };
    }

    const reachable = await checkHealth();
    if (!reachable) {
      toast.error('Impossível sincronizar: sem ligação ao servidor central.');
      return { success: 0, failed: 0 };
    }

    setIsSyncing(true);
    let success = 0;
    let failed = 0;

    try {
      const pending = await getPendingOfflineSales(tenantId);
      if (pending.length === 0) {
        setIsSyncing(false);
        return { success: 0, failed: 0 };
      }

      for (const sale of pending) {
        if (useAuthStore.getState().activeTenant?.id !== tenantId) break;

        const claimed = await claimOfflineSale(sale.id, tenantId);
        if (!claimed) continue;

        if (useAuthStore.getState().activeTenant?.id !== tenantId) {
          await markOfflineSaleFailed(
            sale.id,
            tenantId,
            'A empresa ativa mudou antes do envio. A venda permanece pendente para sincronização segura.'
          );
          break;
        }

        try {
          // Emissão idempotente; stock e tesouraria seguem via Outbox/RabbitMQ.
          const issueRes = await invoicingApi.issueInvoice({
            tenantId: sale.tenantId,
            documentType: 'FR',
            seriesCode: sale.seriesCode,
            fiscalYear: sale.fiscalYear,
            customerName: sale.customerName,
            customerNif: sale.customerNif,
            paymentMethods: [sale.paymentMethod],
            lines: sale.lines.map((l) => ({
              productCode: l.productCode,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
            })),
            idempotencyKey: sale.id,
          });

          const invoiceId = issueRes.invoiceId || issueRes.id;
          const docNumber = issueRes.documentNumber;
          if (!invoiceId || !docNumber) {
            throw new Error('A resposta do servidor não confirmou a fatura e o número fiscal.');
          }

          await markOfflineSaleSynced(sale.id, tenantId, invoiceId, docNumber);
          success++;
        } catch (err: any) {
          failed++;
          const errDetail = err?.response?.data?.detail || err?.message || 'Erro de sincronização';
          await markOfflineSaleFailed(sale.id, tenantId, errDetail);
        }
      }

      await refreshPendingCount();

      if (success > 0) {
        toast.success(`${success} venda(s) de contingência sincronizada(s) com sucesso!`);
      }
      if (failed > 0) {
        toast.warning(`${failed} venda(s) falharam na sincronização.`);
      }
    } finally {
      setIsSyncing(false);
    }

    return { success, failed };
  }, [checkHealth, refreshPendingCount, tenantId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkHealth().then((reachable) => {
        if (reachable) {
          syncPendingSales();
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsBackendReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificação inicial
    checkHealth();
    refreshPendingCount();

    // Polling de saúde a cada 15 segundos
    const interval = setInterval(() => {
      checkHealth().then((reachable) => {
        if (reachable && pendingOfflineCount > 0 && !isSyncing) {
          syncPendingSales();
        }
      });
      refreshPendingCount();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkHealth, refreshPendingCount, pendingOfflineCount, isSyncing, syncPendingSales]);

  const isContingencyMode = !isOnline || !isBackendReachable;

  return {
    isOnline,
    isBackendReachable,
    isContingencyMode,
    pendingOfflineCount,
    isSyncing,
    checkHealth,
    syncPendingSales,
    refreshPendingCount,
  };
}
