/**
 * Tiny typed request/response protocol for Web Workers.
 *
 * - One request → zero or more `progress` messages → one `result` or `error`.
 * - Cancellation terminates the worker (heavy WASM/JS loops can't be
 *   interrupted cooperatively) and a fresh one is spawned on the next call.
 */

/** Describes a worker API: op name → payload and result types. */
export type RpcApi = Record<string, { payload: unknown; result: unknown }>;

export interface RpcPort {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent) => void) | null;
}

export type RpcRequest = { id: number; op: string; payload: unknown };

export type RpcResponse =
  | { id: number; type: 'progress'; stage: string; fraction: number }
  | { id: number; type: 'result'; result: unknown }
  | { id: number; type: 'error'; name: string; message: string };

export interface HandlerContext {
  progress(stage: string, fraction: number): void;
}

export type HandlerResult<R> = { result: R; transfer?: Transferable[] };

export type RpcHandlers<A extends RpcApi> = {
  [K in keyof A]: (
    payload: A[K]['payload'],
    ctx: HandlerContext,
  ) => Promise<HandlerResult<A[K]['result']>>;
};

/** Worker side: dispatch incoming requests to handlers. */
export function serveRpc<A extends RpcApi>(port: RpcPort, handlers: RpcHandlers<A>): void {
  port.onmessage = async (ev: MessageEvent) => {
    const { id, op, payload } = ev.data as RpcRequest;
    const handler = (handlers as Record<string, RpcHandlers<A>[keyof A]>)[op];
    const post = (msg: RpcResponse, transfer?: Transferable[]) => port.postMessage(msg, transfer);
    if (!handler) {
      post({ id, type: 'error', name: 'Error', message: `unknown op "${op}"` });
      return;
    }
    try {
      const ctx: HandlerContext = {
        progress: (stage, fraction) => post({ id, type: 'progress', stage, fraction }),
      };
      const { result, transfer } = await handler(payload as never, ctx);
      post({ id, type: 'result', result }, transfer);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      post({ id, type: 'error', name: e.name, message: e.message });
    }
  };
}

export interface CallOptions {
  onProgress?: (stage: string, fraction: number) => void;
  signal?: AbortSignal;
  transfer?: Transferable[];
}

interface Pending {
  resolve(v: unknown): void;
  reject(e: unknown): void;
  onProgress?: CallOptions['onProgress'];
  /** detaches the abort listener once the call settles */
  done(): void;
}

/** Main-thread side. `spawn` creates a fresh worker (or port) on demand. */
export class RpcClient<A extends RpcApi> {
  private port: (RpcPort & { terminate?(): void }) | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(private readonly spawn: () => RpcPort & { terminate?(): void }) {}

  call<K extends keyof A & string>(
    op: K,
    payload: A[K]['payload'],
    { onProgress, signal, transfer }: CallOptions = {},
  ): Promise<A[K]['result']> {
    if (signal?.aborted) return Promise.reject(abortError());
    const port = this.ensurePort();
    const id = this.nextId++;
    return new Promise<A[K]['result']>((resolve, reject) => {
      // Aborting terminates the worker, so every in-flight call is cancelled.
      const onAbort = () => this.cancelAll();
      signal?.addEventListener('abort', onAbort, { once: true });
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        onProgress,
        done: () => signal?.removeEventListener('abort', onAbort),
      });
      port.postMessage({ id, op, payload } satisfies RpcRequest, transfer);
    });
  }

  /** Terminate the worker and reject every in-flight call. */
  cancelAll(): void {
    this.port?.terminate?.();
    this.port = null;
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const p of pending) {
      p.done();
      p.reject(abortError());
    }
  }

  dispose(): void {
    this.cancelAll();
  }

  private ensurePort(): RpcPort {
    if (this.port) return this.port;
    const port = this.spawn();
    port.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as RpcResponse;
      const p = this.pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') {
        p.onProgress?.(msg.stage, msg.fraction);
      } else if (msg.type === 'result') {
        this.pending.delete(msg.id);
        p.done();
        p.resolve(msg.result);
      } else {
        this.pending.delete(msg.id);
        p.done();
        const err = new Error(msg.message);
        err.name = msg.name;
        p.reject(err);
      }
    };
    this.port = port;
    return port;
  }
}

function abortError(): Error {
  const e = new Error('The operation was cancelled.');
  e.name = 'AbortError';
  return e;
}
