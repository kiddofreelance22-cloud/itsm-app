"use client";
import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/lib/api/client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.trim() || undefined;

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket || !_socket.connected) {
    const options = {
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    };
    _socket = WS_URL ? io(WS_URL, options) : io(options);
  }
  return _socket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = getSocket();
    return () => {
      // Don't disconnect – share across components
    };
  }, []);

  const joinIncident = useCallback((incidentId: string) => {
    getSocket().emit("join_incident", incidentId);
    return () => getSocket().emit("leave_incident", incidentId);
  }, []);

  const joinGroupQueue = useCallback((groupId: number) => {
    getSocket().emit("join_group_queue", groupId);
    return () => getSocket().emit("leave_group_queue", groupId);
  }, []);

  const on = useCallback(<T = unknown>(event: string, handler: (data: T) => void) => {
    const s = getSocket();
    s.on(event, handler);
    return () => { s.off(event, handler); };
  }, []);

  return { joinIncident, joinGroupQueue, on, socket: socketRef };
}
