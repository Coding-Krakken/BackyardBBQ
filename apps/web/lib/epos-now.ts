type EposPrimitive = string | number | boolean | null;

type EposJson = EposPrimitive | EposJson[] | { [key: string]: EposJson };

export interface EposTransactionRequest {
  DateTime: string;
  StatusId: number;
  ServiceType: number;
  TotalAmount: number;
  ServiceCharge?: number;
  Gratuity?: number;
  DiscountValue?: number;
  IsTransactionIncTax?: boolean;
  ReferenceCode: string;
  TransactionItems?: EposJson[];
  MiscProductItems?: EposJson[];
  Tenders: Array<{
    TenderTypeId: number;
    Amount: number;
    ChangeGiven?: number;
  }>;
  AdjustStock?: boolean;
}

export interface EposTransactionSummary {
  id: string;
  statusId?: number;
  totalAmount?: number;
  referenceCode?: string;
  raw: EposJson;
}

interface EposConfig {
  baseUrl: string;
  authToken: string;
  authHeaderName: string;
  authScheme: string;
}

function getEposConfig(): EposConfig {
  const baseUrl = process.env.EPOS_NOW_BASE_URL?.trim();
  const authToken = process.env.EPOS_NOW_AUTH_TOKEN?.trim();

  if (!baseUrl) {
    throw new Error("Missing EPOS_NOW_BASE_URL environment variable");
  }

  if (!authToken) {
    throw new Error("Missing EPOS_NOW_AUTH_TOKEN environment variable");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    authToken,
    authHeaderName: process.env.EPOS_NOW_AUTH_HEADER?.trim() || "Authorization",
    authScheme: process.env.EPOS_NOW_AUTH_SCHEME?.trim() || "Bearer",
  };
}

function getAuthHeaderValue(config: EposConfig) {
  if (!config.authScheme) {
    return config.authToken;
  }

  return `${config.authScheme} ${config.authToken}`;
}

function toRecord(value: EposJson | null | undefined): Record<string, EposJson> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value as Record<string, EposJson>;
}

function toNumber(value: EposJson | undefined): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeTransaction(transaction: EposJson | null | undefined): EposTransactionSummary {
  const data = toRecord(transaction);
  const rawId = data.Id ?? data.id;
  const id =
    typeof rawId === "string"
      ? rawId
      : typeof rawId === "number"
      ? String(rawId)
      : "unknown";

  const rawReferenceCode = data.ReferenceCode ?? data.referenceCode;

  return {
    id,
    statusId: toNumber(data.StatusId ?? data.statusId),
    totalAmount: toNumber(data.TotalAmount ?? data.totalAmount),
    referenceCode: typeof rawReferenceCode === "string" ? rawReferenceCode : undefined,
    raw: (transaction ?? {}) as EposJson,
  };
}

function transactionIsCompleted(transaction: EposTransactionSummary) {
  return transaction.statusId === 1;
}

function extractTransactionList(response: EposJson): EposJson[] {
  if (Array.isArray(response)) {
    return response;
  }

  const root = toRecord(response);
  const possibleLists = [
    root.Items,
    root.items,
    root.Data,
    root.data,
    root.Results,
    root.results,
  ];

  for (const candidate of possibleLists) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function selectBestTransaction(response: EposJson): EposTransactionSummary | null {
  const list = extractTransactionList(response);
  if (list.length > 0) {
    const normalized = list.map((item) => normalizeTransaction(item));
    const completed = normalized.find((item) => item.id !== "unknown" && transactionIsCompleted(item));
    if (completed) {
      return completed;
    }

    return normalized.find((item) => item.id !== "unknown") ?? null;
  }

  const single = normalizeTransaction(response);
  return single.id !== "unknown" ? single : null;
}

function getPaginationEnvelope(response: EposJson): { currentPage: number; totalPages: number } | null {
  const root = toRecord(response);
  const currentPage = toNumber(root.Page ?? root.page ?? root.CurrentPage ?? root.currentPage);
  const totalPages = toNumber(root.TotalPages ?? root.totalPages ?? root.PageCount ?? root.pageCount);

  if (
    typeof currentPage === "number" &&
    Number.isInteger(currentPage) &&
    currentPage > 0 &&
    typeof totalPages === "number" &&
    Number.isInteger(totalPages) &&
    totalPages > 0
  ) {
    return { currentPage, totalPages };
  }

  return null;
}

function hasPossibleNextPage(response: EposJson): boolean {
  const envelope = getPaginationEnvelope(response);
  if (envelope) {
    return envelope.currentPage < envelope.totalPages;
  }

  const list = extractTransactionList(response);
  // EPOS docs indicate list endpoints are paginated with 200 records per page.
  return list.length === 200;
}

async function eposRequest<TResponse = EposJson>(
  path: string,
  init: RequestInit = {}
): Promise<TResponse> {
  const config = getEposConfig();
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set(config.authHeaderName, getAuthHeaderValue(config));

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown EPOS error");
    throw new Error(`EPOS request failed (${response.status}): ${errorText || response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return text as TResponse;
  }

  return (await response.json()) as TResponse;
}

export function getEposTenderTypeId(): number {
  const raw = process.env.EPOS_NOW_TENDER_TYPE_ID?.trim();

  if (!raw) {
    throw new Error("Missing EPOS_NOW_TENDER_TYPE_ID environment variable");
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("EPOS_NOW_TENDER_TYPE_ID must be a positive integer");
  }

  return parsed;
}

export async function createEposTransaction(
  request: EposTransactionRequest
): Promise<EposTransactionSummary> {
  if (process.env.EPOS_NOW_SKIP_VALIDATE !== "true") {
    await eposRequest("/api/v4/Transaction/Validate", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  const created = await eposRequest<EposJson>("/api/v4/Transaction", {
    method: "POST",
    body: JSON.stringify(request),
  });

  return normalizeTransaction(created);
}

export async function findEposTransactionByReferenceCode(
  referenceCode: string
): Promise<EposTransactionSummary | null> {
  const encodedReferenceCode = encodeURIComponent(referenceCode);
  const configuredMaxPages = Number(process.env.EPOS_NOW_REFERENCE_LOOKUP_MAX_PAGES ?? "5");
  const maxPages =
    Number.isInteger(configuredMaxPages) && configuredMaxPages > 0
      ? Math.min(configuredMaxPages, 50)
      : 5;
  const candidates: EposJson[] = [];
  let page = 1;

  while (page <= maxPages) {
    const query = page === 1 ? "" : `?page=${page}`;
    let response: EposJson;
    try {
      response = await eposRequest<EposJson>(
        `/api/v4/Transaction/ReferenceCode/${encodedReferenceCode}${query}`,
        { method: "GET" }
      );
    } catch (error) {
      // A non-first page can fail when the provider has no further pages.
      if (page === 1) {
        throw error;
      }
      break;
    }

    if (!response || typeof response !== "object") {
      break;
    }

    const pageItems = extractTransactionList(response);
    if (pageItems.length > 0) {
      candidates.push(...pageItems);
    } else {
      candidates.push(response);
      break;
    }

    if (!hasPossibleNextPage(response)) {
      break;
    }

    page += 1;
  }

  if (candidates.length === 0) {
    return null;
  }

  return selectBestTransaction(candidates);
}
