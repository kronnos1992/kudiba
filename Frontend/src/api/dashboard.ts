import { apiClient } from './client';
import {
  PayrollDashboardSummary,
  InventoryDashboardSummary,
  TreasuryDashboardSummary,
  InvoicingDashboardSummary,
} from '../types/dashboard';
import { PlatformCommercialSummary, PlatformSummary } from '../types/backoffice';

export const dashboardApi = {
  getPayrollSummary: async (year?: number): Promise<PayrollDashboardSummary> => {
    const res = await apiClient.get<PayrollDashboardSummary>('/api/v1/payroll/dashboard/summary', {
      params: year ? { year } : undefined,
    });
    return res.data;
  },
  getInventorySummary: async (): Promise<InventoryDashboardSummary> => {
    const res = await apiClient.get<InventoryDashboardSummary>('/api/v1/inventory/dashboard/summary');
    return res.data;
  },
  getTreasurySummary: async (): Promise<TreasuryDashboardSummary> => {
    const res = await apiClient.get<TreasuryDashboardSummary>('/api/v1/treasury/dashboard/summary');
    return res.data;
  },
  getInvoicingSummary: async (year?: number): Promise<InvoicingDashboardSummary> => {
    const res = await apiClient.get<InvoicingDashboardSummary>('/api/v1/fiscal/dashboard/summary', {
      params: year ? { year } : undefined,
    });
    return res.data;
  },
  getBackofficeSummary: async (): Promise<PlatformSummary> => {
    const res = await apiClient.get<PlatformSummary>('/api/v1/backoffice/summary');
    return res.data;
  },
  getBackofficeCommercialSummary: async (): Promise<PlatformCommercialSummary> => {
    const res = await apiClient.get<PlatformCommercialSummary>(
      '/api/v1/backoffice/commercial-summary',
    );
    return res.data;
  },
};