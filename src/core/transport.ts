export type Fetcher = typeof fetch;

export type FetchTransport = {
  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

/**
 * Keep native fetch's global receiver out of class method calls. Injected
 * fetchers retain the normal fetch-like callable contract, while native and
 * receiver-sensitive implementations are invoked as global fetch methods.
 */
export function createFetchTransport(fetcher: Fetcher = globalThis.fetch): FetchTransport {
  return {
    request: (input, init) => Reflect.apply(fetcher, globalThis, [input, init]) as Promise<Response>
  };
}
