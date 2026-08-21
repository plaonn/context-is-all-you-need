declare namespace chrome {
  namespace storage {
    const local: StorageArea;
    const session: StorageArea;
  }

  namespace identity {
    function getRedirectURL(path?: string): string;
    function launchWebAuthFlow(details: { url: string; interactive: boolean }): Promise<string | undefined>;
  }

  namespace runtime {
    function getURL(path: string): string;
  }

  namespace tabs {
    function create(createProperties: { url: string }): Promise<{ id?: number }>;
  }

  namespace action {
    const onClicked: {
      addListener(listener: () => void | Promise<void>): void;
    };
  }

  interface StorageArea {
    get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
    set(values: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  }
}
