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

export interface BridgeCapabilities {
  printer: boolean;
  drawer: boolean;
  scanner: boolean;
  qr: boolean;
}

export interface BridgeProfile {
  model: string;
  connectionMode: string;
  columns: number;
}

export interface BridgeStatus {
  paired: boolean;
  awaitingCode: boolean;
  locked?: boolean;
  lockoutUntil?: string | null;
  credentialEpoch?: number;
  seedVersion?: number | null;
  capabilities?: BridgeCapabilities;
  profile?: BridgeProfile;
}

export interface BridgeCloudPairResult {
  paired: true;
  token?: string;
  tenantId?: string;
  terminalId: string;
  credentialEpoch: number;
  seedVersion: number | null;
}

export interface BridgeCatalogProduct {
  barcode: string;
  code: string;
  description: string;
  price: number;
  taxRate: number;
}

export interface BridgeCatalog {
  version: number;
  expiresAt: string;
  products: BridgeCatalogProduct[];
  series: string[];
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

async function bridgeGet<T>(path: string, token: string): Promise<T> {
  const { url } = bridgeConfig();
  const response = await fetch(`${url}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Agente local devolveu ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function bridgeStatus(): Promise<BridgeStatus> {
  const { url } = bridgeConfig();
  const response = await fetch(`${url}/device/status`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) {
    const legacyResponse = await fetch(`${url}/pair/status`, {
      headers: { Accept: 'application/json' },
    });
    if (!legacyResponse.ok) {
      throw new Error(`Agente local indisponível (${legacyResponse.status}).`);
    }
    return (await legacyResponse.json()) as BridgeStatus;
  }
  if (!response.ok) throw new Error(`Agente local indisponível (${response.status}).`);
  return (await response.json()) as BridgeStatus;
}

export async function pairBridgeCloud(
  activationToken: string,
  label: string
): Promise<BridgeCloudPairResult> {
  const result = await bridgeFetch<BridgeCloudPairResult>(
    '/pair/cloud',
    { activationToken, label },
    null
  );
  if (result.token && result.tenantId) {
    storeToken(result.token, result.tenantId);
  }
  return result;
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

export async function printText(
  jobId: string,
  title: string,
  lines: string[],
  reason: string
): Promise<BridgePrintResult | BridgeSkipped> {
  const { token } = bridgeConfig();
  if (!token) {
    return { skipped: true, reason: 'Agente local ainda não emparelhado.' };
  }
  const printableLines = lines.filter((line) => line.trim().length > 0);
  if (!printableLines.length) {
    return { skipped: true, reason: 'O documento não contém linhas para imprimir.' };
  }
  return bridgeFetch<BridgePrintResult>(
    '/device/print/text',
    { jobId, title, lines: printableLines, reason },
    token
  );
}

interface RawBridgeCatalogProduct {
  barcode: string;
  code: string;
  description: string;
  price: number | string;
  taxRate: number | string;
}

interface RawBridgeCatalog {
  version: number;
  expiresAt: string;
  products: RawBridgeCatalogProduct[];
  series: unknown[];
}

export async function bridgeCatalog(): Promise<BridgeCatalog> {
  const { token } = bridgeConfig();
  if (!token) throw new Error('Agente local ainda não emparelhado.');
  const result = await bridgeGet<RawBridgeCatalog>('/device/catalog', token);
  return {
    version: result.version,
    expiresAt: result.expiresAt,
    products: result.products.map((product) => ({
      barcode: product.barcode,
      code: product.code,
      description: product.description,
      price: Number(product.price) || 0,
      taxRate: Number(product.taxRate) || 0,
    })),
    series: (result.series ?? []).map((item) =>
      typeof item === 'string' ? item : JSON.stringify(item)
    ),
  };
}

export async function submitBridgeBarcode(barcode: string): Promise<void> {
  const { token } = bridgeConfig();
  if (!token) return;
  await bridgeFetch('/device/scanner', { barcode }, token);
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
