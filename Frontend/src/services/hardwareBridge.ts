export type BridgePrintState =
  | 'QUEUED'
  | 'SUBMITTING'
  | 'TRANSPORT_ACCEPTED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'PHYSICAL_OUTPUT_CONFIRMED'
  | 'RESOLVED_BY_OPERATOR';

export interface BridgePrintJob {
  printJobId: string;
  tenantId?: string;
  terminalId?: string | null;
  documentNumber: string;
  payloadHash: string;
  jobClass: string;
  copyType: string;
  copyId?: string;
  printAuthorization?: string;
  envelope: {
    documentType: string;
    documentNumber: string;
    customerName: string;
    customerNif?: string | null;
    hash: string;
    validationChars: string;
    totalAmount: string;
    lines: Array<{
      lineNumber?: number;
      description: string;
      quantity: number | string;
      unitPrice: string;
    }>;
  };
}

export interface BridgePrintResult {
  state: BridgePrintState;
  replay: boolean;
  attempts: number;
}

export interface BridgeSkipped {
  skipped: true;
  reason: string;
}

export interface BridgeStatus {
  paired: boolean;
  awaitingCode: boolean;
  locked?: boolean;
  lockoutUntil?: string | null;
}

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:17842';
const TOKEN_KEY = 'kudiba_hardware_bridge_token';
const TENANT_KEY = 'kudiba_hardware_bridge_tenant';
const PAIRED_AT_KEY = 'kudiba_hardware_bridge_paired_at';

function bridgeConfig(): { url: string; token: string | null } {
  return {
    url: window.localStorage.getItem('kudiba_hardware_bridge_url') || DEFAULT_BRIDGE_URL,
    token: window.localStorage.getItem(TOKEN_KEY),
  };
}

function storeToken(token: string, tenantId: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(TENANT_KEY, tenantId);
  window.localStorage.setItem(PAIRED_AT_KEY, new Date().toISOString());
}

async function bridgeFetch<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const { url } = bridgeConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Agente local devolveu ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function bridgeStatus(): Promise<BridgeStatus> {
  const { url } = bridgeConfig();
  const response = await fetch(`${url}/pair/status`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Agente local indisponível (${response.status}).`);
  return (await response.json()) as BridgeStatus;
}

export async function requestBridgeChallenge(): Promise<void> {
  await bridgeFetch<{ reissued: boolean }>('/pair/challenge', {}, null);
}

export async function pairBridge(
  code: string,
  tenantId: string,
  label: string
): Promise<void> {
  const result = await bridgeFetch<{ token: string; tenantId: string }>(
    '/pair',
    { code, tenantId, label },
    null
  );
  if (result.tenantId !== tenantId) {
    throw new Error('O agente local emparelhou com outra empresa.');
  }
  storeToken(result.token, tenantId);
}

export async function rotateBridgeToken(tenantId: string): Promise<void> {
  const { token } = bridgeConfig();
  if (!token) throw new Error('Agente local sem credencial para rodar.');
  const result = await bridgeFetch<{ token: string }>(
    '/device/token/rotate',
    { tenantId },
    token
  );
  storeToken(result.token, tenantId);
}

export async function revokeBridgeToken(tenantId: string): Promise<void> {
  const { token } = bridgeConfig();
  if (!token) throw new Error('Agente local sem credencial para revogar.');
  await bridgeFetch('/device/token/revoke', { tenantId }, token);
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TENANT_KEY);
  window.localStorage.removeItem(PAIRED_AT_KEY);
}

export async function submitPrintJob(
  job: BridgePrintJob | null | undefined,
  tenantId: string
): Promise<BridgePrintResult | BridgeSkipped> {
  if (!job) {
    return { skipped: true, reason: 'O servidor não devolveu um job de impressão.' };
  }
  const { token } = bridgeConfig();
  if (!token) {
    return { skipped: true, reason: 'Agente local ainda não emparelhado.' };
  }
  if (window.localStorage.getItem(TENANT_KEY) !== tenantId) {
    return { skipped: true, reason: 'A credencial local pertence a outra empresa.' };
  }

  return bridgeFetch<BridgePrintResult>('/device/print', { ...job, tenantId }, token);
}

export async function openCashDrawer(
  printJobId: string,
  tenantId: string,
  reason: string
): Promise<void> {
  const { token } = bridgeConfig();
  if (!token) throw new Error('Agente local ainda não emparelhado.');
  if (window.localStorage.getItem(TENANT_KEY) !== tenantId) {
    throw new Error('A credencial local pertence a outra empresa.');
  }
  await bridgeFetch(
    '/device/drawer/open',
    { printJobId, tenantId, reason, confirm: true },
    token
  );
}
