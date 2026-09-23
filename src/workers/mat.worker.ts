import { matHandlers, type MatApi } from './mat.handlers';
import { serveRpc, type RpcPort } from './rpc';

serveRpc<MatApi>(self as unknown as RpcPort, matHandlers);
