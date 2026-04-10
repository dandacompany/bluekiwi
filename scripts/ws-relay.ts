/**
 * BlueKiwi WebSocket Relay Server
 *
 * 역할: MCP 서버 → Browser 실시간 알림 중계
 *
 * 포트 3001에서 동작:
 * - Browser가 ws://localhost:3001 로 연결
 * - MCP 서버가 HTTP POST /notify 로 알림 전송
 * - Relay가 연결된 모든 브라우저에 broadcast
 *
 * 메시지 형식:
 *   { type: "task_update", task_id: number, event: string, data?: any }
 *
 * 실행:
 *   npx tsx scripts/ws-relay.ts
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "http";

const WS_PORT = 3001;

// HTTP 서버 — MCP에서 POST /notify 를 받음
const httpServer = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/notify") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const message = JSON.parse(body);
        broadcast(JSON.stringify(message));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", clients: wss.clients.size }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// WebSocket 서버 — 브라우저가 연결
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  const clientCount = wss.clients.size;
  console.log(`[WS] Client connected (total: ${clientCount})`);

  ws.on("close", () => {
    console.log(`[WS] Client disconnected (total: ${wss.clients.size})`);
  });
});

function broadcast(data: string) {
  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sent++;
    }
  });
  const parsed = JSON.parse(data);
  console.log(
    `[WS] Broadcast: ${parsed.type} task_id=${parsed.task_id ?? "?"} event=${parsed.event ?? "?"} → ${sent} clients`,
  );
}

httpServer.listen(WS_PORT, () => {
  console.log(`[BlueKiwi WS Relay] Running on port ${WS_PORT}`);
  console.log(`  WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`  Notify:    POST http://localhost:${WS_PORT}/notify`);
  console.log(`  Health:    GET  http://localhost:${WS_PORT}/health`);
});
