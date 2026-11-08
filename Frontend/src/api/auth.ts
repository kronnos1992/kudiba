import { apiClient } from './client';
import {
  LoginResponse,
  TenantBackupSettings,
  TenantBankAccount,
  TenantSettings,
  User,
} from '../types/auth';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SwitchTenantPayload {
  tenant_id: string;
  branch_id?: string;
}

export interface TenantMember {
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
  status: string;
  default_branch_id?: string | null;
}

export interface InviteMemberPayload {
  email: string;
  full_name: string;
  roles: string[];
  branch_id?: string | null;
  password?: string;
}

export interface UpdateRolesPayload {
  roles: string[];
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface RoleCatalogItem {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  users_count: number;
  permissions: string[];
  is_editable: boolean;
  has_override: boolean;
  can_reset_override: boolean;
}

export interface PermissionCatalogItem {
  id: string;
  module: string;
  name: string;
  description?: string | null;
}

export interface CreateRolePayload {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface UpdateRolePayload {
  name: string;
  description?: string | null;
}

export interface BranchDto {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  address_detail?: string | null;
}

export interface CreateBranchPayload {
  code: string;
  name: string;
  city?: string | null;
  address_detail?: string | null;
}

export interface AuthAuditLogItem {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  email_attempted: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface AuthAuditLogsResponse {
  items: AuthAuditLogItem[];
  total: number;
}

export interface UpdateTenantSettingsPayload {
  company_name?: string;
  trade_name?: string | null;
  nif?: string;
  address_detail?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_data_url?: string | null;
  commercial_registry?: string | null;
  alvara_number?: string | null;
  alvara_issue_date?: string | null;
  alvara_expiry_date?: string | null;
  share_capital?: string | null;
  currency?: string;
  tax_regime_code?: string;
  tax_office_code?: string | null;
  agt_cert_number?: string | null;
  default_withholding_rate?: number;
  invoice_footer_notes?: string | null;
  bank_accounts?: TenantBankAccount[];
  backup_settings?: TenantBackupSettings;
  onboarding_completed?: boolean;
}

export interface DatabaseNodeStatus {
  service_id: string;
  service_name: string;
  database_name: string;
  role: string;
  driver: string;
  host: string;
  port: number;
  status: 'ONLINE' | 'OFFLINE';
  latency_ms: number | null;
  version: string | null;
  active_connections: number;
  error: string | null;
}

export interface CustomDatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  schema_name: string;
  ssl_mode: string;
  pool_size: number;
  timeout_seconds: number;
  read_replica_enabled: boolean;
  read_replica_host: string;
  read_replica_port?: number | null;
  is_custom_configured: boolean;
  has_password?: boolean;
  last_tested_at?: string | null;
  last_test_status?: string | null;
  last_test_latency_ms?: number | null;
}

export interface TenantDatabaseOverview {
  tenant_id: string;
  cluster_nodes: DatabaseNodeStatus[];
  custom_connection: CustomDatabaseConnection;
}

export interface TestDatabaseConnectionPayload {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl_mode?: string;
  timeout_seconds?: number;
}

export interface TestDatabaseConnectionResult {
  success: boolean;
  latency_ms: number;
  version: string | null;
  database: string | null;
  user: string | null;
  schema: string | null;
  error: string | null;
  tested_at: string;
}

export interface UpdateDatabaseConnectionPayload {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  schema_name?: string;
  ssl_mode?: string;
  pool_size?: number;
  timeout_seconds?: number;
  read_replica_enabled?: boolean;
  read_replica_host?: string;
  read_replica_port?: number | null;
  is_custom_configured?: boolean;
}

export interface TenantBackup {
  id: string;
  tenant_id: string;
  requested_by: string | null;
  trigger: 'MANUAL' | 'SCHEDULED' | string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | string;
  file_name: string | null;
  size_bytes: number | null;
  sha256: string | null;
  encryption: string | null;
  error: string | null;
  created_at: string | null;
  completed_at: string | null;
  company_name?: string | null;
  nif?: string | null;
  tenant_slug?: string | null;
}

export interface TenantBackupScheduleStatus {
  schedule_enabled: boolean;
  schedule_frequency: string;
  schedule_interval_hours: number;
  schedule_time: string | null;
  storage_location: string;
  preferred_format: string;
  auto_save_local: boolean;
  retention_days: number;
  last_backup_at: string | null;
  next_backup_at: string | null;
  scheduler_running: boolean;
}

export interface TenantBackupListResponse {
  items: TenantBackup[];
  total: number;
  limit: number;
  offset: number;
  schedule_status?: TenantBackupScheduleStatus;
}

export interface TenantBackupModuleManifest {
  module: string;
  database: string;
  file: string;
  sha256: string;
  size_bytes: number;
  row_count: number;
  tables: Record<
    string,
    {
      row_count: number;
      columns: string[];
      redacted_columns: string[];
    }
  >;
  skipped_tables?: Array<{ table: string; reason: string }>;
}

export interface TenantBackupManifest {
  format: string;
  format_version: number;
  backup_id: string;
  tenant: {
    id: string;
    slug?: string | null;
    company_name?: string | null;
    nif?: string | null;
  };
  created_at: string;
  created_by?: string | null;
  trigger: string;
  totals: {
    row_count: number;
    module_count: number;
  };
  modules: TenantBackupModuleManifest[];
}

export interface BackupRestoreModuleReport {
  module: string;
  database: string;
  tables_count: number;
  row_count: number;
  restored_rows: number;
  checksum_verified: boolean;
  status: 'VALIDATED' | 'RESTORED' | string;
}

export interface BackupRestoreReport {
  valid: boolean;
  dry_run: boolean;
  backup_id: string | null;
  source_tenant_id: string;
  target_tenant_id: string;
  created_at?: string | null;
  total_rows: number;
  modules: BackupRestoreModuleReport[];
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', payload);
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  logout: async (refreshToken?: string | null) => {
    try {
      await apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Ignora erro no logout para garantir limpeza de sessão local
    }
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/v1/auth/me');
    return response.data;
  },

  changeOwnPassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await apiClient.post('/api/v1/auth/me/change-password', payload);
  },

  resetUserPassword: async (userId: string, newPassword: string): Promise<void> => {
    await apiClient.put(`/api/v1/auth/users/${userId}/password`, { new_password: newPassword });
  },

  switchTenant: async (payload: SwitchTenantPayload): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/switch-tenant', payload);
    return response.data;
  },

  getTenantSettings: async (): Promise<TenantSettings> => {
    const response = await apiClient.get<TenantSettings>('/api/v1/auth/tenant/settings');
    return response.data;
  },

  updateTenantSettings: async (payload: UpdateTenantSettingsPayload): Promise<TenantSettings> => {
    const response = await apiClient.put<TenantSettings>('/api/v1/auth/tenant/settings', payload);
    return response.data;
  },

  listMembers: async (): Promise<TenantMember[]> => {
    const response = await apiClient.get<TenantMember[]>('/api/v1/auth/users');
    return response.data;
  },

  inviteMember: async (payload: InviteMemberPayload): Promise<TenantMember> => {
    const response = await apiClient.post<TenantMember>('/api/v1/auth/users/invite', payload);
    return response.data;
  },

  updateMemberRoles: async (userId: string, payload: UpdateRolesPayload): Promise<void> => {
    await apiClient.put(`/api/v1/auth/users/${userId}/roles`, payload);
  },

  updateMemberStatus: async (userId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> => {
    await apiClient.patch(`/api/v1/auth/users/${userId}/status`, { status });
  },

  removeMember: async (userId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/auth/users/${userId}`);
  },

  listBranches: async (): Promise<BranchDto[]> => {
    const response = await apiClient.get<BranchDto[]>('/api/v1/auth/branches');
    return response.data;
  },

  createBranch: async (payload: CreateBranchPayload): Promise<BranchDto> => {
    const response = await apiClient.post<BranchDto>('/api/v1/auth/branches', payload);
    return response.data;
  },

  listRoles: async (): Promise<RoleCatalogItem[]> => {
    const response = await apiClient.get<RoleCatalogItem[]>('/api/v1/auth/roles');
    return response.data;
  },

  listPermissions: async (): Promise<PermissionCatalogItem[]> => {
    const response = await apiClient.get<PermissionCatalogItem[]>('/api/v1/auth/permissions');
    return response.data;
  },

  createRole: async (payload: CreateRolePayload): Promise<RoleCatalogItem> => {
    const response = await apiClient.post<RoleCatalogItem>('/api/v1/auth/roles', payload);
    return response.data;
  },

  updateRole: async (roleId: string, payload: UpdateRolePayload): Promise<RoleCatalogItem> => {
    const response = await apiClient.put<RoleCatalogItem>(`/api/v1/auth/roles/${roleId}`, payload);
    return response.data;
  },

  updateRolePermissions: async (
    roleId: string,
    permissions: string[]
  ): Promise<RoleCatalogItem> => {
    const response = await apiClient.put<RoleCatalogItem>(
      `/api/v1/auth/roles/${roleId}/permissions`,
      { permissions }
    );
    return response.data;
  },

  resetRolePermissions: async (roleId: string): Promise<RoleCatalogItem> => {
    const response = await apiClient.delete<RoleCatalogItem>(
      `/api/v1/auth/roles/${roleId}/permissions/override`
    );
    return response.data;
  },

  deleteRole: async (roleId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/auth/roles/${roleId}`);
  },

  getAuditLogs: async (params?: { limit?: number; offset?: number }): Promise<AuthAuditLogsResponse> => {
    const response = await apiClient.get<AuthAuditLogsResponse>('/api/v1/auth/audit-logs', { params });
    return response.data;
  },

  checkGatewayHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  checkServicesStatus: async () => {
    const response = await apiClient.get('/status');
    return response.data;
  },

  getDatabaseConnections: async (): Promise<TenantDatabaseOverview> => {
    const response = await apiClient.get<TenantDatabaseOverview>('/api/v1/auth/tenant/database-connections');
    return response.data;
  },

  testDatabaseConnection: async (payload: TestDatabaseConnectionPayload): Promise<TestDatabaseConnectionResult> => {
    const response = await apiClient.post<TestDatabaseConnectionResult>(
      '/api/v1/auth/tenant/database-connections/test',
      payload
    );
    return response.data;
  },

  updateDatabaseConnection: async (
    payload: UpdateDatabaseConnectionPayload
  ): Promise<{ success: boolean; message: string; custom_connection: CustomDatabaseConnection }> => {
    const response = await apiClient.put<{
      success: boolean;
      message: string;
      custom_connection: CustomDatabaseConnection;
    }>('/api/v1/auth/tenant/database-connections', payload);
    return response.data;
  },

  listBackups: async (params?: {
    limit?: number;
    offset?: number;
    tenantId?: string;
  }): Promise<TenantBackupListResponse> => {
    const { tenantId, ...query } = params || {};
    const url = tenantId
      ? `/api/v1/auth/admin/tenants/${tenantId}/backups`
      : '/api/v1/auth/tenant/backups';
    const response = await apiClient.get<TenantBackupListResponse>(url, { params: query });
    return response.data;
  },

  createBackup: async (tenantId?: string): Promise<TenantBackup> => {
    const url = tenantId
      ? `/api/v1/auth/admin/tenants/${tenantId}/backups`
      : '/api/v1/auth/tenant/backups';
    const response = await apiClient.post<TenantBackup>(url, null, {
      timeout: 15 * 60 * 1000,
    });
    return response.data;
  },

  getBackupManifest: async (
    backupId: string,
    tenantId?: string
  ): Promise<TenantBackupManifest> => {
    const url = tenantId
      ? `/api/v1/auth/admin/tenants/${tenantId}/backups/${backupId}/manifest`
      : `/api/v1/auth/tenant/backups/${backupId}/manifest`;
    const response = await apiClient.get<TenantBackupManifest>(url);
    return response.data;
  },

  downloadBackup: async (
    backupId: string,
    options?: { decrypted?: boolean; tenantId?: string }
  ): Promise<Blob> => {
    const url = options?.tenantId
      ? `/api/v1/auth/admin/tenants/${options.tenantId}/backups/${backupId}/download`
      : `/api/v1/auth/tenant/backups/${backupId}/download`;
    const response = await apiClient.get<Blob>(url, {
      params: options?.decrypted ? { decrypted: true } : undefined,
      responseType: 'blob',
      timeout: 15 * 60 * 1000,
    });
    return response.data;
  },

  restoreBackup: async (
    backupId: string,
    options?: { dryRun?: boolean; tenantId?: string }
  ): Promise<BackupRestoreReport> => {
    const url = options?.tenantId
      ? `/api/v1/auth/admin/tenants/${options.tenantId}/backups/${backupId}/restore`
      : `/api/v1/auth/tenant/backups/${backupId}/restore`;
    const response = await apiClient.post<BackupRestoreReport>(
      url,
      { dry_run: Boolean(options?.dryRun) },
      { timeout: 15 * 60 * 1000 }
    );
    return response.data;
  },

  restoreBackupFromFile: async (payload: {
    file_base64: string;
    file_name?: string;
    dry_run?: boolean;
  }): Promise<BackupRestoreReport> => {
    const response = await apiClient.post<BackupRestoreReport>(
      '/api/v1/auth/tenant/backups/restore-file',
      payload,
      { timeout: 15 * 60 * 1000 }
    );
    return response.data;
  },

  deleteBackup: async (backupId: string, tenantId?: string): Promise<void> => {
    const url = tenantId
      ? `/api/v1/auth/admin/tenants/${tenantId}/backups/${backupId}`
      : `/api/v1/auth/tenant/backups/${backupId}`;
    await apiClient.delete(url);
  },

  runScheduledBackups: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/api/v1/auth/admin/backups/run-scheduled',
      null,
      { timeout: 15 * 60 * 1000 }
    );
    return response.data;
  },

  checkDueBackup: async (): Promise<TenantBackupScheduleStatus> => {
    const response = await apiClient.post<TenantBackupScheduleStatus>(
      '/api/v1/auth/tenant/backups/check-due',
      null,
      { timeout: 15 * 60 * 1000 }
    );
    return response.data;
  },
};
