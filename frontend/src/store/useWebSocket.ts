'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRobotStore } from './useRobotStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectDelay = useRef(1000);
  const { setConnectionMode, setSerialPort, setWsConnected, updateTelemetry, addLog, setLogs, setStats } = useRobotStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsConnected(true);
        reconnectDelay.current = 1000;
        console.log('[WS] Connected');
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'telemetry': updateTelemetry(data); break;
            case 'connection':
              setConnectionMode(data.mode);
              if (data.port) setSerialPort(data.port);
              break;
            case 'log': addLog(data.entry); break;
            case 'logs': setLogs(data.logs || []); break;
            case 'stats': setStats(data.stats || {}); break;
            case 'ack': break;
            case 'error': addLog({ time: new Date().toLocaleTimeString('en-US', { hour12: false }), source: 'error', message: data.message, timestamp: Date.now() }); break;
          }
        } catch {}
      };
      ws.onclose = () => {
        setWsConnected(false);
        setConnectionMode('disconnected');
        const delay = Math.min(reconnectDelay.current, 10000);
        reconnectRef.current = setTimeout(connect, delay);
        reconnectDelay.current = delay * 1.5;
      };
      ws.onerror = () => ws.close();
    } catch { setTimeout(connect, 3000); }
  }, [setConnectionMode, setSerialPort, setWsConnected, updateTelemetry, addLog, setLogs, setStats]);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { sendMessage };
}
