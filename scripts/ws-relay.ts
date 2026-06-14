/**
 * BlueKiwi WebSocket Relay Server
 *
 * 역할: MCP/서버 → Browser 실시간 알림 중계
 *
 * 포트 3001에서 동작:
 * - Browser가 ws://host/ws (또는 직접 :3001) 로 연결 — 세션 쿠키로 인증됨
 * - 서버가 HTTP POST /notify 로 알림 전송 (WS_RELAY_SECRET 공유 시크릿으로 인증)
 * - Relay가 해당 task 소유자(+admin/superuser) 에게만 전달
 *
 * 메시지 형식:
 *   { type: "task_update", task_id: number, user_id?: number|null, event: string, data?: any }
 *
 * 보안:
 * - WS 업그레이드는 session 쿠키 JWT 검증 통과 시에만 허용 (relay 는 app 과 동일한
 *   JWT_SECRET 을 공유해야 함). 미인증 연결은 401 로 거부.
 * - /notify 는 WS_RELAY_SECRET 헤더(x-relay-secret) 일치 시에만 허용.
 * - 전달은 task_update 의 user_id 기준으로 소유자/관리자에게만 스코핑.
 *
 * 실행:
 *   dev:  npx tsx scripts/ws-relay.ts
 *   prod: node scripts/ws-relay.js   (esbuild 번들)
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import type { IncomingMessage } from "http";
import {
  identifyFromCookieHeader,
  canReceive,
  type WsIdentity,
  type TaskUpdateMessage,
} from "../src/lib/ws-auth";

const WS_PORT = Number(process.env.WS_PORT ?? 3001);
const RELAY_SECRET = process.env.WS_RELAY_SECRET ?? "";

if (!RELAY_SECRET) {
  console.warn(
    "[WS] WS_RELAY_SECRET is not set — POST /notify is UNAUTHENTICATED (dev only). Set WS_RELAY_SECRET in production.",
  );
}

// Authenticated identity per connection. WeakMap so closed sockets are GC'd.
const identities = new WeakMap<WebSocket, WsIdentity>();

type AuthedReq = IncomingMessage & { identity?: WsIdentity };

// ─── HTTP: ingress for server-side notifications ───
const httpServer = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/notify") {
    if (RELAY_SECRET && req.headers["x-relay-secret"] !== RELAY_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const message = JSON.parse(body) as TaskUpdateMessage;
        const sent = deliver(message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, delivered: sent }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// ─── WebSocket: browser clients (authenticated via session cookie) ───
const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: (
    info: { req: IncomingMessage },
    cb: (ok: boolean, code?: number, message?: string) => void,
  ) => {
    identifyFromCookieHeader(info.req.headers.cookie)
      .then((identity) => {
        if (!identity) {
          cb(false, 401, "Unauthorized");
          return;
        }
        (info.req as AuthedReq).identity = identity;
        cb(true);
      })
      .catch(() => cb(false, 401, "Unauthorized"));
  },
});

wss.on("connection", (ws, req: AuthedReq) => {
  const identity = req.identity;
  if (identity) identities.set(ws, identity);
  console.log(
    `[WS] Client connected user=${identity?.userId ?? "?"} (total: ${wss.clients.size})`,
  );

  ws.on("close", () => {
    identities.delete(ws);
    console.log(`[WS] Client disconnected (total: ${wss.clients.size})`);
  });
});

function deliver(message: TaskUpdateMessage): number {
  const data = JSON.stringify(message);
  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const identity = identities.get(client);
    if (!identity) return; // unauthenticated sockets never receive
    if (!canReceive(identity, message)) return;
    client.send(data);
    sent++;
  });
  console.log(
    `[WS] ${message.type ?? "?"} task_id=${message.task_id ?? "?"} event=${message.event ?? "?"} user_id=${message.user_id ?? "*"} → ${sent} client(s)`,
  );
  return sent;
}

httpServer.listen(WS_PORT, () => {
  console.log(`[BlueKiwi WS Relay] Running on port ${WS_PORT}`);
  console.log(`  WebSocket: ws://localhost:${WS_PORT} (session-cookie auth)`);
  console.log(`  Notify:    POST http://localhost:${WS_PORT}/notify`);
  console.log(`  Health:    GET  http://localhost:${WS_PORT}/health`);
});
