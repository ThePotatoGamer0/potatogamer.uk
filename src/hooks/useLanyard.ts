import { useEffect, useMemo, useState } from "react";
import { OWNER_DISCORD_ID } from "../../shared/site";
import { fetchPresence, isPresence, LANYARD_WS, type LanyardPresence } from "../lib/lanyard";

export interface LanyardState {
  users: Record<string, LanyardPresence | null>;
  ready: boolean;
  owner: LanyardPresence | null;
}

function parseIds(idKey: string): string[] {
  return idKey ? idKey.split(",") : [];
}

export function useLanyard(ids: string[]): LanyardState {
  const idKey = ids.join(",");
  const [users, setUsers] = useState<Record<string, LanyardPresence | null>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const list = parseIds(idKey);
    const controller = new AbortController();
    setReady(false);

    void Promise.all(
      list.map(async (id) => {
        try {
          return [id, await fetchPresence(id, controller.signal)] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((rows) => {
      if (controller.signal.aborted) return;
      setUsers((current) => {
        const next = { ...current };
        for (const [id, presence] of rows) next[id] = presence;
        return next;
      });
      setReady(true);
    });

    return () => controller.abort();
  }, [idKey]);

  useEffect(() => {
    const list = parseIds(idKey);
    if (list.length === 0) return;

    let stopped = false;
    let socket: WebSocket | null = null;
    let heartbeat: number | null = null;
    let retry: number | null = null;
    let attempt = 0;

    const clearHeartbeat = () => {
      if (heartbeat !== null) window.clearInterval(heartbeat);
      heartbeat = null;
    };

    const applyPacket = (type: string | undefined, data: unknown) => {
      if (type !== "INIT_STATE" && type !== "PRESENCE_UPDATE") return;
      if (isPresence(data)) {
        setUsers((current) => ({ ...current, [data.discord_user.id]: data }));
        return;
      }
      if (!data || typeof data !== "object") return;
      setUsers((current) => {
        const next = { ...current };
        for (const value of Object.values(data as Record<string, unknown>)) {
          if (isPresence(value)) next[value.discord_user.id] = value;
        }
        return next;
      });
    };

    const connect = () => {
      if (stopped) return;
      const active = new WebSocket(LANYARD_WS);
      socket = active;
      active.onmessage = (event) => {
        let packet: { op?: number; t?: string; d?: unknown };
        try {
          packet = JSON.parse(String(event.data)) as { op?: number; t?: string; d?: unknown };
        } catch {
          return;
        }

        if (packet.op === 1) {
          const interval =
            packet.d && typeof packet.d === "object" && "heartbeat_interval" in packet.d
              ? Number((packet.d as { heartbeat_interval?: number }).heartbeat_interval) || 30000
              : 30000;
          clearHeartbeat();
          heartbeat = window.setInterval(() => {
            if (active.readyState === WebSocket.OPEN) active.send(JSON.stringify({ op: 3 }));
          }, interval);
          const hello =
            list.length === 1
              ? { op: 2, d: { subscribe_to_id: list[0] } }
              : { op: 2, d: { subscribe_to_ids: list } };
          active.send(JSON.stringify(hello));
          attempt = 0;
          return;
        }

        if (packet.op === 0) applyPacket(packet.t, packet.d);
      };
      active.onclose = () => {
        clearHeartbeat();
        if (stopped) return;
        const delay = Math.min(15000, 1000 * 2 ** attempt);
        attempt += 1;
        retry = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearHeartbeat();
      if (retry !== null) window.clearTimeout(retry);
      socket?.close();
    };
  }, [idKey]);

  useEffect(() => {
    const list = parseIds(idKey);
    if (list.length === 0) return;
    const timer = window.setInterval(() => {
      void Promise.all(
        list.map(async (id) => {
          try {
            return [id, await fetchPresence(id)] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      ).then((rows) => {
        setUsers((current) => {
          const next = { ...current };
          for (const [id, presence] of rows) {
            if (presence) next[id] = presence;
          }
          return next;
        });
      });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [idKey]);

  return useMemo(
    () => ({
      users,
      ready,
      owner: users[OWNER_DISCORD_ID] ?? null,
    }),
    [ready, users],
  );
}
