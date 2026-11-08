import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  FileArchive,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Loader2,
  HardDrive,
  Eye,
  RotateCcw,
  Upload,
  X,
  Database,
  FolderOpen,
  Save,
} from 'lucide-react';
import {
  authApi,
  BackupRestoreReport,
  TenantBackup,
  TenantBackupManifest,
} from '../../api/auth';
import { GlassCard } from '../../components/common/GlassCard';
import { toast } from '../../stores/toastStore';

export interface BackupManagerProps {
  tenantId?: string;
  tenantName?: string;
}

const formatBytes = (bytes: number | null): string => {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-PT');
};

const statusMeta = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return {
        label: 'Concluído',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        icon: CheckCircle2,
      };
    case 'FAILED':
      return {
        label: 'Falhou',
        className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        icon: AlertTriangle,
      };
    default:
      return {
        label: 'Em curso',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        icon: Clock,
      };
  }
};

export const BackupManager: React.FC<BackupManagerProps> = ({ tenantId, tenantName }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [manifestModalBackup, setManifestModalBackup] = useState<TenantBackup | null>(null);
  const [manifestData, setManifestData] = useState<TenantBackupManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<TenantBackup | null>(null);
  const [restoreReport, setRestoreReport] = useState<BackupRestoreReport | null>(null);
  const [validatingRestore, setValidatingRestore] = useState(false);
  const [executingRestore, setExecutingRestore] = useState(false);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedBase64, setUploadedBase64] = useState<string>('');
  const [uploadReport, setUploadReport] = useState<BackupRestoreReport | null>(null);

  const [editingLocation, setEditingLocation] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [scheduleFreqInput, setScheduleFreqInput] = useState('DAILY');
  const [scheduleTimeInput, setScheduleTimeInput] = useState('02:00');
  const [scheduleEnabledInput, setScheduleEnabledInput] = useState(true);

  const queryKey = ['tenant_backups', tenantId || 'self'];

  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant_settings'],
    queryFn: () => authApi.getTenantSettings(),
    enabled: !tenantId,
    refetchOnWindowFocus: false,
  });

  const backupSettings = tenantSettings?.backup_settings;

  useEffect(() => {
    if (backupSettings) {
      setCustomLocationInput(backupSettings.storage_location || 'Backups_Kudiba');
      setScheduleFreqInput(backupSettings.schedule_frequency || 'DAILY');
      setScheduleTimeInput(backupSettings.schedule_time || '02:00');
      setScheduleEnabledInput(backupSettings.schedule_enabled ?? true);
    }
  }, [backupSettings]);

  const updateLocationMutation = useMutation({
    mutationFn: (overrides: {
      storage_location?: string;
      schedule_enabled?: boolean;
      schedule_frequency?: string;
      schedule_time?: string;
    }) => {
      if (!tenantSettings) throw new Error('Settings not loaded');
      return authApi.updateTenantSettings({
        ...tenantSettings,
        backup_settings: {
          storage_location:
            (overrides.storage_location ?? customLocationInput).trim() || 'Backups_Kudiba',
          auto_save_local: backupSettings?.auto_save_local ?? true,
          preferred_format: backupSettings?.preferred_format || 'ZIP_DECIFRADO',
          schedule_enabled: overrides.schedule_enabled ?? scheduleEnabledInput,
          schedule_frequency: overrides.schedule_frequency ?? scheduleFreqInput,
          schedule_time: overrides.schedule_time ?? scheduleTimeInput,
          retention_days: backupSettings?.retention_days ?? 30,
        },
      });
    },
    onSuccess: () => {
      toast.success('Configuração de cópia automática e local de destino atualizados.');
      setEditingLocation(false);
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error('Não foi possível atualizar a configuração de cópia de segurança.');
    },
  });

  const handleChooseLocalFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (dirHandle?.name) {
          (window as any).__kudibaBackupDirHandle = dirHandle;
          setCustomLocationInput(dirHandle.name);
          updateLocationMutation.mutate({ storage_location: dirHandle.name });
          return;
        }
      }
      setCustomLocationInput(backupSettings?.storage_location || 'Backups_Kudiba');
      setEditingLocation(true);
    } catch {
      // Utilizador cancelou o seletor
    }
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => authApi.listBackups({ limit: 100, tenantId }),
    refetchOnWindowFocus: false,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (tenantId) return;
    let active = true;
    const runDueCheck = async () => {
      try {
        await authApi.checkDueBackup();
        if (active) {
          queryClient.invalidateQueries({ queryKey });
        }
      } catch {
        // Verificação periódica silenciosa
      }
    };
    void runDueCheck();
    const timer = window.setInterval(runDueCheck, 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tenantId]);

  const saveBackupToConfiguredLocation = async (backup: TenantBackup) => {
    if (backup.status !== 'COMPLETED') return;
    const decrypted = (backupSettings?.preferred_format || 'ZIP_DECIFRADO') === 'ZIP_DECIFRADO';
    const fileName = decrypted
      ? `kudiba-backup-${backup.id}.zip`
      : backup.file_name || `kudiba-backup-${backup.id}.zip.enc`;

    try {
      const blob = await authApi.downloadBackup(backup.id, { decrypted, tenantId });
      const dirHandle = (window as any).__kudibaBackupDirHandle;
      if (dirHandle && typeof dirHandle.getFileHandle === 'function') {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        localStorage.setItem(`kudiba_last_synced_backup_${backup.tenant_id}`, backup.id);
        toast.success(`Cópia de segurança guardada na pasta "${dirHandle.name}/${fileName}".`);
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      localStorage.setItem(`kudiba_last_synced_backup_${backup.tenant_id}`, backup.id);
    } catch {
      // Falha silenciosa se auto-save não conseguir escrever
    }
  };

  useEffect(() => {
    if (tenantId) return;
    if (!(backupSettings?.auto_save_local ?? true)) return;
    const dirHandle = (window as any).__kudibaBackupDirHandle;
    if (!dirHandle || typeof dirHandle.getFileHandle !== 'function') return;
    const latestCompleted = (data?.items ?? []).find((b) => b.status === 'COMPLETED');
    if (!latestCompleted) return;
    const syncKey = `kudiba_last_synced_backup_${latestCompleted.tenant_id}`;
    if (localStorage.getItem(syncKey) === latestCompleted.id) return;
    void saveBackupToConfiguredLocation(latestCompleted);
  }, [data?.items, tenantId, backupSettings?.auto_save_local]);

  const createMutation = useMutation({
    mutationFn: () => authApi.createBackup(tenantId),
    onSuccess: (newBackup) => {
      toast.success('Cópia de segurança gerada com sucesso.');
      queryClient.invalidateQueries({ queryKey });
      if (!tenantId && (backupSettings?.auto_save_local ?? true) && newBackup?.status === 'COMPLETED') {
        void saveBackupToConfiguredLocation(newBackup);
      }
    },
    onError: () => {
      toast.error('Não foi possível gerar a cópia de segurança.');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (backupId: string) => authApi.deleteBackup(backupId, tenantId),
    onSuccess: () => {
      toast.success('Cópia de segurança eliminada.');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error('Não foi possível eliminar a cópia de segurança.');
    },
  });

  const handleDownload = async (backup: TenantBackup, decrypted = false) => {
    if (backup.status !== 'COMPLETED') {
      toast.error('Esta cópia de segurança ainda não está disponível.');
      return;
    }
    const key = `${backup.id}:${decrypted ? 'zip' : 'enc'}`;
    setDownloadingKey(key);
    try {
      const blob = await authApi.downloadBackup(backup.id, { decrypted, tenantId });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = decrypted
        ? `kudiba-backup-${backup.id}.zip`
        : backup.file_name || `kudiba-backup-${backup.id}.zip.enc`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(
        decrypted
          ? 'Download do arquivo ZIP decifrado iniciado.'
          : 'Download do arquivo cifrado (.zip.enc) iniciado.'
      );
    } catch {
      toast.error('Falha ao descarregar a cópia de segurança.');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleInspectManifest = async (backup: TenantBackup) => {
    setManifestModalBackup(backup);
    setManifestData(null);
    setLoadingManifest(true);
    try {
      const res = await authApi.getBackupManifest(backup.id, tenantId);
      setManifestData(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Não foi possível ler o manifesto do backup.');
      setManifestModalBackup(null);
    } finally {
      setLoadingManifest(false);
    }
  };

  const handleOpenRestore = async (backup: TenantBackup) => {
    setRestoreTarget(backup);
    setRestoreReport(null);
    setValidatingRestore(true);
    try {
      const report = await authApi.restoreBackup(backup.id, { dryRun: true, tenantId });
      setRestoreReport(report);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Falha ao validar a integridade do backup.');
      setRestoreTarget(null);
    } finally {
      setValidatingRestore(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setExecutingRestore(true);
    try {
      const report = await authApi.restoreBackup(restoreTarget.id, {
        dryRun: false,
        tenantId,
      });
      setRestoreReport(report);
      toast.success(
        `Restauro concluído com sucesso (${report.total_rows} registos sincronizados).`
      );
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Falha ao restaurar a cópia de segurança.');
    } finally {
      setExecutingRestore(false);
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadReport(null);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setUploadedBase64(reader.result);
      setValidatingRestore(true);
      try {
        const report = await authApi.restoreBackupFromFile({
          file_base64: reader.result,
          file_name: file.name,
          dry_run: true,
        });
        setUploadReport(report);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || 'Ficheiro de backup inválido ou incompatível.');
      } finally {
        setValidatingRestore(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteFileRestore = async () => {
    if (!uploadedBase64) return;
    setExecutingRestore(true);
    try {
      const report = await authApi.restoreBackupFromFile({
        file_base64: uploadedBase64,
        file_name: uploadedFileName,
        dry_run: false,
      });
      setUploadReport(report);
      toast.success(
        `Ficheiro restaurado com sucesso (${report.total_rows} registos sincronizados).`
      );
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Falha ao restaurar o ficheiro de backup.');
    } finally {
      setExecutingRestore(false);
    }
  };

  const handleDelete = (backup: TenantBackup) => {
    const confirmed = window.confirm(
      'Eliminar definitivamente esta cópia de segurança? Esta ação não pode ser revertida.'
    );
    if (confirmed) {
      deleteMutation.mutate(backup.id);
    }
  };

  const backups = data?.items ?? [];

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cópias de Segurança {tenantName ? `— ${tenantName}` : 'da Empresa'}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Exportação e restauro lógico de todos os módulos da empresa (Auth, Faturação,
                Inventário, Tesouraria, Contabilidade, Salários, Integrações e Backoffice) num
                pacote ZIP JSON cifrado com AES-256-GCM.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            {!tenantId && (
              <button
                type="button"
                onClick={() => {
                  setUploadedFileName('');
                  setUploadedBase64('');
                  setUploadReport(null);
                  setUploadModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Upload className="h-4 w-4 text-blue-600" />
                Restaurar de Ficheiro
              </button>
            )}
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              {createMutation.isPending ? 'A gerar...' : 'Gerar agora'}
            </button>
          </div>
        </div>

        {!tenantId && (
          <div className="mt-5 rounded-xl border border-blue-200/70 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Local de Destino &amp; Agendamento Automático:
                    </span>
                    <code className="rounded bg-white px-2 py-0.5 font-mono text-xs font-semibold text-blue-700 shadow-2xs dark:bg-slate-800 dark:text-blue-300">
                      {backupSettings?.storage_location || 'Backups_Kudiba (Padrão)'}
                    </code>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {(backupSettings?.preferred_format || 'ZIP_DECIFRADO') === 'ZIP_DECIFRADO'
                        ? 'Formato: .zip (Decifrado)'
                        : 'Formato: .zip.enc (AES-256-GCM)'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        (data?.schedule_status?.schedule_enabled ??
                        backupSettings?.schedule_enabled ??
                        true)
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {(data?.schedule_status?.schedule_enabled ??
                      backupSettings?.schedule_enabled ??
                      true)
                        ? `Automático (${
                            {
                              HOURLY_1: 'A cada 1h',
                              HOURLY_6: 'A cada 6h',
                              HOURLY_12: 'A cada 12h',
                              DAILY: 'Diário',
                              WEEKLY: 'Semanal',
                              MONTHLY: 'Mensal',
                            }[
                              data?.schedule_status?.schedule_frequency ||
                                backupSettings?.schedule_frequency ||
                                'DAILY'
                            ] || 'Diário'
                          } às ${
                            data?.schedule_status?.schedule_time ||
                            backupSettings?.schedule_time ||
                            '02:00'
                          })`
                        : 'Agendamento Pausado'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Última cópia:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {formatDateTime(data?.schedule_status?.last_backup_at || null)}
                      </strong>
                    </span>
                    {data?.schedule_status?.next_backup_at && (
                      <span>
                        Próxima cópia automática:{' '}
                        <strong className="text-blue-700 dark:text-blue-300">
                          {formatDateTime(data.schedule_status.next_backup_at)}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleChooseLocalFolder}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Escolher Pasta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomLocationInput(backupSettings?.storage_location || 'Backups_Kudiba');
                    setScheduleFreqInput(backupSettings?.schedule_frequency || 'DAILY');
                    setScheduleTimeInput(backupSettings?.schedule_time || '02:00');
                    setScheduleEnabledInput(backupSettings?.schedule_enabled ?? true);
                    setEditingLocation((v) => !v);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Configurar Periodicidade &amp; Local
                </button>
              </div>
            </div>

            {editingLocation && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end border-t border-blue-200/60 pt-3 dark:border-blue-900/40">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Pasta de Destino
                  </label>
                  <input
                    type="text"
                    value={customLocationInput}
                    onChange={(e) => setCustomLocationInput(e.target.value)}
                    placeholder="Ex: C:\Backups\Kudiba"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Periodicidade Automática
                  </label>
                  <select
                    value={scheduleFreqInput}
                    onChange={(e) => setScheduleFreqInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="HOURLY_6">A cada 6 horas</option>
                    <option value="HOURLY_12">A cada 12 horas</option>
                    <option value="DAILY">Diariamente (24h)</option>
                    <option value="WEEKLY">Semanalmente (7 dias)</option>
                    <option value="MONTHLY">Mensalmente (30 dias)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Hora Programada
                  </label>
                  <input
                    type="time"
                    value={scheduleTimeInput}
                    onChange={(e) => setScheduleTimeInput(e.target.value || '02:00')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      updateLocationMutation.mutate({
                        storage_location: customLocationInput,
                        schedule_enabled: scheduleEnabledInput,
                        schedule_frequency: scheduleFreqInput,
                        schedule_time: scheduleTimeInput,
                      })
                    }
                    disabled={updateLocationMutation.isPending}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Cifra AES-256-GCM &amp; Decifra
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pode descarregar o ficheiro cifrado (<code>.zip.enc</code>) ou o pacote decifrado (
              <code>.zip</code>) com manifesto SHA-256.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Clock className="h-4 w-4 text-blue-500" />
              Agendamento diário &amp; Retenção
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              O sistema cria automaticamente um backup diário por empresa ativa e retém o histórico
              por 30 dias.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <RotateCcw className="h-4 w-4 text-violet-500" />
              Restauro Idempotente c/ Dry-Run
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Valida checksums SHA-256 antes do restauro e preserva credenciais sensíveis (hashes
              de palavras-passe).
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Histórico de Cópias de Segurança ({data?.total ?? 0})
          </h4>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar histórico...
          </div>
        ) : backups.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Ainda não existem cópias de segurança. Gere a primeira com o botão acima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Criado</th>
                  <th className="px-5 py-3 font-semibold">Origem</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Tamanho</th>
                  <th className="px-5 py-3 font-semibold">Ficheiro / SHA-256</th>
                  <th className="px-5 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {backups.map((backup) => {
                  const meta = statusMeta(backup.status);
                  const StatusIcon = meta.icon;
                  const encKey = `${backup.id}:enc`;
                  const zipKey = `${backup.id}:zip`;
                  return (
                    <tr key={backup.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatDateTime(backup.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {backup.trigger === 'SCHEDULED' ? 'Automático' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          title={backup.error || undefined}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatBytes(backup.size_bytes)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                          {backup.file_name || '—'}
                        </div>
                        {backup.sha256 && (
                          <div
                            className="font-mono text-[10px] text-slate-400 truncate max-w-[200px]"
                            title={`SHA-256: ${backup.sha256}`}
                          >
                            SHA-256: {backup.sha256.slice(0, 16)}…
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInspectManifest(backup)}
                            disabled={backup.status !== 'COMPLETED'}
                            title="Inspecionar Manifesto e Módulos"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Manifesto
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(backup, false)}
                            disabled={backup.status !== 'COMPLETED' || downloadingKey === encKey}
                            title="Descarregar arquivo cifrado AES-256-GCM (.zip.enc)"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {downloadingKey === encKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            .zip.enc
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(backup, true)}
                            disabled={backup.status !== 'COMPLETED' || downloadingKey === zipKey}
                            title="Descarregar pacote ZIP decifrado (.zip)"
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:border-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/20"
                          >
                            {downloadingKey === zipKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileArchive className="h-3.5 w-3.5" />
                            )}
                            ZIP Decifrado
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRestore(backup)}
                            disabled={backup.status !== 'COMPLETED'}
                            title="Validar e Restaurar esta Cópia de Segurança"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restaurar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(backup)}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* MODAL: INSPECIONAR MANIFESTO */}
      {manifestModalBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  Manifesto da Cópia de Segurança
                </h4>
                <p className="text-xs text-slate-500 font-mono">{manifestModalBackup.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setManifestModalBackup(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {loadingManifest || !manifestData ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> A decifrar e ler manifest.json...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <span className="text-slate-400 block">Empresa</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {manifestData.tenant.company_name || '—'}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <span className="text-slate-400 block">NIF</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {manifestData.tenant.nif || '—'}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <span className="text-slate-400 block">Módulos Exportados</span>
                      <span className="font-bold text-blue-600">
                        {manifestData.totals.module_count} bases de dados
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <span className="text-slate-400 block">Total de Registos</span>
                      <span className="font-bold text-emerald-600">
                        {manifestData.totals.row_count} linhas
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase text-slate-500 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-4 py-2.5">Módulo</th>
                          <th className="px-4 py-2.5">Base de Dados</th>
                          <th className="px-4 py-2.5">Tabelas</th>
                          <th className="px-4 py-2.5">Registos</th>
                          <th className="px-4 py-2.5">Tamanho JSON</th>
                          <th className="px-4 py-2.5">SHA-256</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {manifestData.modules.map((mod) => (
                          <tr key={mod.module}>
                            <td className="px-4 py-2.5 font-bold uppercase text-slate-800 dark:text-slate-200">
                              {mod.module}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                              {mod.database}
                            </td>
                            <td className="px-4 py-2.5">
                              {Object.keys(mod.tables || {}).length}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-emerald-600">
                              {mod.row_count}
                            </td>
                            <td className="px-4 py-2.5">{formatBytes(mod.size_bytes)}</td>
                            <td
                              className="px-4 py-2.5 font-mono text-[10px] text-slate-400"
                              title={mod.sha256}
                            >
                              {mod.sha256.slice(0, 16)}…
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VALIDAR E RESTAURAR BACKUP DO HISTÓRICO */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-emerald-600" />
                  Validar e Restaurar Cópia de Segurança
                </h4>
                <p className="text-xs text-slate-500">
                  Criado em {formatDateTime(restoreTarget.created_at)} ({restoreTarget.file_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {validatingRestore ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> A validar cifra AES-256-GCM e
                  checksums SHA-256 (Dry-Run)...
                </div>
              ) : restoreReport ? (
                <>
                  <div
                    className={`rounded-xl border p-4 text-xs ${
                      restoreReport.dry_run
                        ? 'border-blue-200 bg-blue-50/70 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200'
                        : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                    }`}
                  >
                    <div className="font-bold text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {restoreReport.dry_run
                        ? `Validação Dry-Run Concluída (${restoreReport.total_rows} registos verificados)`
                        : `Restauro Concluído (${restoreReport.total_rows} registos sincronizados)`}
                    </div>
                    <p className="mt-1">
                      Todos os checksums SHA-256 dos módulos foram verificados. O restauro executa
                      atualização idempotente respeitando chaves estrangeiras e preserva palavras-passe
                      atuais.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase text-slate-500 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-4 py-2">Módulo</th>
                          <th className="px-4 py-2">Base de Dados</th>
                          <th className="px-4 py-2">Tabelas</th>
                          <th className="px-4 py-2">Registos</th>
                          <th className="px-4 py-2">Integridade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {restoreReport.modules.map((m) => (
                          <tr key={m.module}>
                            <td className="px-4 py-2 font-bold uppercase">{m.module}</td>
                            <td className="px-4 py-2 font-mono">{m.database}</td>
                            <td className="px-4 py-2">{m.tables_count}</td>
                            <td className="px-4 py-2 font-semibold">{m.row_count}</td>
                            <td className="px-4 py-2 text-emerald-600 font-semibold">
                              {m.status === 'RESTORED' ? 'Restaurado' : 'SHA-256 OK'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Fechar
              </button>
              {restoreReport?.dry_run && (
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={executingRestore}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {executingRestore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  {executingRestore ? 'A restaurar dados...' : 'Confirmar Restauro na Base de Dados'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESTAURAR A PARTIR DE FICHEIRO EXTERNO */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                Restaurar Cópia de Segurança de Ficheiro
              </h4>
              <button
                type="button"
                onClick={() => setUploadModalOpen(null as any)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".enc,.zip"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />
              <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {uploadedFileName || 'Selecione um ficheiro .zip.enc ou .zip do Kudiba ERP'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  O ficheiro será primeiro validado em modo Dry-Run antes de qualquer alteração.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Escolher Ficheiro
                </button>
              </div>

              {validatingRestore && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> A validar pacote de backup...
                </div>
              )}

              {uploadReport && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    {uploadReport.dry_run
                      ? `Ficheiro válido: ${uploadReport.total_rows} registos em ${uploadReport.modules.length} módulos`
                      : `Restauro concluído: ${uploadReport.total_rows} registos sincronizados`}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Fechar
              </button>
              {uploadReport?.dry_run && (
                <button
                  type="button"
                  onClick={handleExecuteFileRestore}
                  disabled={executingRestore}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {executingRestore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Confirmar Restauro
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
