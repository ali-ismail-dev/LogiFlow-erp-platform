'use client';

import { useEffect, useRef, useState } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import type { ChannelAuthorizationCallback } from 'pusher-js';

if (typeof window !== 'undefined') {
  // Echo's reverb driver expects a global Pusher reference -- Reverb speaks
  // the Pusher wire protocol, so laravel-echo reuses the pusher-js
  // transport under the hood even though we never call it directly.
  // @ts-expect-error -- window augmentation, not worth a global.d.ts for one line
  window.Pusher = window.Pusher ?? Pusher;
}

type ConnectionState =
  | 'idle'
  | 'initialized'
  | 'connecting'
  | 'connected'
  | 'unavailable'
  | 'failed'
  | 'disconnected';

export interface DispatchStopPayload {
  id: number;
  sequence: number;
  label: string;
  status: string;
  eta: string | null;
}

export interface DispatchDriverPayload {
  id: number;
  name: string;
}

// Mirrors app/Events/DispatchMovementUpdated.php::broadcastWith() field for
// field. Keep these two in lockstep -- this is the wire contract shared by
// the REST DispatchResource payload and the socket payload.
export interface DispatchMovementPayload {
  id: number;
  tenant_id: number;
  status: string;
  reference_number: string;
  current_stop: DispatchStopPayload | null;
  driver: DispatchDriverPayload | null;
  updated_at: string | null;
}

interface UseWebSocketsOptions {
  /** Numeric/resolved tenant identifier. This -- never the slug -- drives
   *  the channel name, since it's the value routes/channels.php actually
   *  checks against on the server. */
  tenantId: string | number | null | undefined;
  /** Human-readable tenant slug from the route, kept only for logging/UI
   *  labeling. Never used to build the channel name: slugs are cosmetic
   *  and shouldn't be trusted for a security-scoped subscription. */
  tenantSlug?: string;
  onMovementUpdate?: (payload: DispatchMovementPayload) => void;
}

interface UseWebSocketsResult {
  connectionState: ConnectionState;
  lastMovement: DispatchMovementPayload | null;
}

const REVERB_EVENT_NAME = '.dispatch.movement.updated';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

// One Echo connection per browser tab, shared by every mounted component.
// Opening a fresh WebSocket per component (e.g. one per cockpit widget) is
// exactly the "memory degradation under high payload density" failure mode
// this hook exists to avoid -- N components should mean N listeners on one
// socket, not N sockets.
let sharedEcho: Echo<'reverb'> | null = null;
const channelRefCounts = new Map<string, number>();

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const row = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.split('=').slice(1).join('=')) : null;
}

async function ensureCsrfCookie(): Promise<void> {
  if (readCookie('XSRF-TOKEN')) return;

  await fetch(`${API_BASE_URL}/sanctum/csrf-cookie`, {
    credentials: 'include',
  });
}

/**
 * Custom authorizer used in place of Echo's default XHR-based auth call.
 * `credentials: 'include'` is fetch's equivalent of axios/XHR's
 * `withCredentials: true` -- both mean "attach the cross-domain Sanctum
 * session cookie to this request." The port-8000 Nginx gateway fronts
 * /broadcasting/auth and /sanctum/csrf-cookie behind the same
 * cross-domain-cookie policy Phase 4 already established, so no bearer
 * token handling is needed here at all.
 *
 * Re-reads the cookie fresh on every call rather than caching a token in a
 * JS variable -- this is what makes reconnects re-authenticate correctly
 * over a long-running session without extra code: the browser's cookie
 * jar is the source of truth, not something that can go stale in memory.
 */
async function authorizeChannel(channelName: string, socketId: string) {
  await ensureCsrfCookie();

  const response = await fetch(`${API_BASE_URL}/broadcasting/auth`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') ?? '',
    },
    body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
  });

  if (!response.ok) {
    throw new Error(`Channel authorization failed (${response.status})`);
  }

  return response.json();
}

function getSharedEcho(): Echo<'reverb'> {
  if (sharedEcho) return sharedEcho;

  sharedEcho = new Echo<'reverb'>({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST,
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize(socketId: string, callback: ChannelAuthorizationCallback) {
        authorizeChannel(channel.name, socketId)
          .then((data) => callback(null, data))
          .catch((error) =>
            callback(
              error instanceof Error ? error : new Error(String(error)),
              null,
            ),
          );
      },
    }),
  });

  return sharedEcho;
}

/**
 * Subscribes the current component to `private-tenant.{tenantId}.ops` for
 * as long as it's mounted, and hands parsed movement-update payloads back
 * via `onMovementUpdate` so Phase 3 components can fold them into their own
 * view state -- flipping a Stop's status to `in_transit`, flashing an
 * alert, whatever makes sense for that component. This hook is
 * transport-layer only; it deliberately doesn't render anything itself.
 */
export function useWebSockets({
  tenantId,
  tenantSlug,
  onMovementUpdate,
}: UseWebSocketsOptions): UseWebSocketsResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [lastMovement, setLastMovement] = useState<DispatchMovementPayload | null>(null);

  // Stash the latest callback/slug in refs so parent re-renders don't force
  // a socket unbind/rebind cycle -- only a genuine tenantId change should
  // do that. Fewer unnecessary rebinds means fewer auth-handshake round
  // trips over a long-running session.
  const onMovementUpdateRef = useRef(onMovementUpdate);
  onMovementUpdateRef.current = onMovementUpdate;
  const tenantSlugRef = useRef(tenantSlug);
  tenantSlugRef.current = tenantSlug;

  useEffect(() => {
    if (!tenantId) return;

    const echo = getSharedEcho();
    const channelName = `tenant.${tenantId}.ops`;

    const handleMovementUpdate = (payload: DispatchMovementPayload) => {
      setLastMovement(payload);
      onMovementUpdateRef.current?.(payload);
    };

    const handleSubscriptionError = (error: unknown) => {
      const slug = tenantSlugRef.current;
      console.error(
        `[useWebSockets] auth failed for ${channelName}${slug ? ` (${slug})` : ''}`,
        error,
      );
      setConnectionState('unavailable');
    };

    const channel = echo.private(channelName);
    channel.listen(REVERB_EVENT_NAME, handleMovementUpdate);
    channel.error(handleSubscriptionError);

    channelRefCounts.set(channelName, (channelRefCounts.get(channelName) ?? 0) + 1);

    // Reverb's Echo connector wraps pusher-js directly, so raw connection
    // state -- reconnects, backoff, all of it -- is already handled for us;
    // we just surface it instead of reimplementing it.
    const pusherConnection = echo.connector.pusher.connection;
    const handleStateChange = ({ current }: { current: string }) => {
      setConnectionState(current as ConnectionState);
    };
    pusherConnection.bind('state_change', handleStateChange);
    setConnectionState(pusherConnection.state as ConnectionState);

    return () => {
      channel.stopListening(REVERB_EVENT_NAME, handleMovementUpdate);
      pusherConnection.unbind('state_change', handleStateChange);

      const remaining = (channelRefCounts.get(channelName) ?? 1) - 1;

      if (remaining <= 0) {
        channelRefCounts.delete(channelName);
        echo.leave(channelName);
      } else {
        channelRefCounts.set(channelName, remaining);
      }
    };
  }, [tenantId]);

  return { connectionState, lastMovement };
}