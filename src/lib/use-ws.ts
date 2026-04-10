"use client";

import { useEffect, useRef, useCallback } from "react";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? null;
const WS_URL = WS_BASE ? WS_BASE.replace(/^http/, "ws") : null;

export interface WsMessage {
  type: string;
  task_id?: number;
  event?: string;
  data?: unknown;
}

/**
 * WebSocket 훅 — WS relay에 연결하여 실시간 알림을 수신합니다.
 * 연결 실패 시 3초 후 자동 재연결합니다.
 */
export function useWs(onMessage: (msg: WsMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const connectRef = useRef<() => void>(() => {});
  const retryTimerRef = useRef<number | null>(null);
  const healthCheckedRef = useRef(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!WS_URL || !WS_BASE) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    try {
      const openSocket = () => {
        const ws = new WebSocket(WS_URL);

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as WsMessage;
            onMessageRef.current(msg);
          } catch {
            // 파싱 실패 무시
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current);
          }
          retryTimerRef.current = window.setTimeout(
            () => connectRef.current(),
            3000,
          );
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      };

      if (healthCheckedRef.current) {
        openSocket();
        return;
      }

      fetch(`${WS_BASE}/health`)
        .then((res) => {
          if (!res.ok) throw new Error("ws relay unavailable");
          healthCheckedRef.current = true;
          openSocket();
        })
        .catch(() => {
          healthCheckedRef.current = false;
        });
    } catch {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = window.setTimeout(
        () => connectRef.current(),
        3000,
      );
    }
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
