import { geometryHandlers, type GeometryApi } from './geometry.handlers';
import { serveRpc, type RpcPort } from './rpc';

serveRpc<GeometryApi>(self as unknown as RpcPort, geometryHandlers);
