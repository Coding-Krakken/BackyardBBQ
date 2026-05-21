import { createEposTransaction, findEposTransactionByReferenceCode } from "../epos-now";

describe("findEposTransactionByReferenceCode", () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.EPOS_NOW_BASE_URL;
  const originalAuthToken = process.env.EPOS_NOW_AUTH_TOKEN;

  function setFetchMock(fetchMock: typeof fetch) {
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true
    });
  }

  function createJsonResponse(payload: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null)
      },
      json: async () => payload,
      text: async () => JSON.stringify(payload)
    } as never;
  }

  beforeEach(() => {
    process.env.EPOS_NOW_BASE_URL = "https://epos.example.com";
    process.env.EPOS_NOW_AUTH_TOKEN = "epos-token";
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true
    });
    if (typeof originalBaseUrl === "undefined") {
      delete process.env.EPOS_NOW_BASE_URL;
    } else {
      process.env.EPOS_NOW_BASE_URL = originalBaseUrl;
    }

    if (typeof originalAuthToken === "undefined") {
      delete process.env.EPOS_NOW_AUTH_TOKEN;
    } else {
      process.env.EPOS_NOW_AUTH_TOKEN = originalAuthToken;
    }

    jest.restoreAllMocks();
  });

  it("selects the completed transaction from a Data envelope using ReferenceCode fields", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      createJsonResponse({
        Data: [
          { Id: 4101, StatusId: 7, ReferenceCode: "order-123" },
          { Id: 4102, StatusId: 1, referenceCode: "order-123", TotalAmount: 22.68 }
        ]
      })
    );
    setFetchMock(fetchMock as typeof fetch);

    const transaction = await findEposTransactionByReferenceCode("order-123");

    expect(transaction).toEqual(
      expect.objectContaining({
        id: "4102",
        statusId: 1,
        totalAmount: 22.68,
        referenceCode: "order-123"
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/v4/Transaction/ReferenceCode/order-123");
  });

  it("keeps the first completed transaction when paging through a Results envelope", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          Results: Array.from({ length: 200 }, (_, index) => ({
            Id: 5000 + index,
            StatusId: index === 0 ? 7 : 7,
            ReferenceCode: "booking:abc-123"
          }))
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          Results: [
            { Id: 6201, StatusId: 7, ReferenceCode: "booking:abc-123" },
            { Id: 6202, StatusId: 1, ReferenceCode: "booking:abc-123" }
          ]
        })
      );
    setFetchMock(fetchMock as typeof fetch);

    const transaction = await findEposTransactionByReferenceCode("booking:abc-123");

    expect(transaction).toEqual(
      expect.objectContaining({
        id: "6202",
        statusId: 1,
        referenceCode: "booking:abc-123"
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("page=2");
  });

  it("validates before creating an EPOS transaction and preserves the request body", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ Result: "ok" }))
      .mockResolvedValueOnce(
        createJsonResponse({
          Id: 7301,
          StatusId: 1,
          ReferenceCode: "order-epos-7301",
          TotalAmount: 19.44
        })
      );
    setFetchMock(fetchMock as typeof fetch);

    const requestBody = {
      DateTime: "2026-05-20T12:00:00.000Z",
      StatusId: 1,
      ServiceType: 1,
      TotalAmount: 19.44,
      ReferenceCode: "order-epos-7301",
      Tenders: [{ TenderTypeId: 3, Amount: 19.44 }]
    };

    const transaction = await createEposTransaction(requestBody);

    expect(transaction).toEqual(
      expect.objectContaining({
        id: "7301",
        statusId: 1,
        totalAmount: 19.44,
        referenceCode: "order-epos-7301"
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/v4/Transaction/Validate");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/v4/Transaction");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual(requestBody);
  });

  it("normalizes string-valued response fields from EPOS", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      createJsonResponse({
        Data: [{ Id: "8123", StatusId: "1", ReferenceCode: "order-string-fields", TotalAmount: "27.50" }]
      })
    );
    setFetchMock(fetchMock as typeof fetch);

    const transaction = await findEposTransactionByReferenceCode("order-string-fields");

    expect(transaction).toEqual(
      expect.objectContaining({
        id: "8123",
        statusId: 1,
        totalAmount: 27.5,
        referenceCode: "order-string-fields"
      })
    );
  });
});