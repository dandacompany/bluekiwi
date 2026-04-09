"use client";

import { useEffect, useRef, useCallback } from "react";

const WS_URL = "ws://localhost:3001";

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
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
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
        setTimeout(connect, 3000); // 재연결
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
