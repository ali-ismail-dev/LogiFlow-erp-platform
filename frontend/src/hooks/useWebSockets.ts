'use client';

import { useEffect, useRef, useState } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getBroadcastingAuthUrl } from '@/lib/reverb-auth';

if (typeof window !== 'undefined') {
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

export interface DispatchWarehousePayload {
  id: number | string;
  name: string;
  code: string;
  timezone: string;
}

// FIXED: Aligned field contract parameters to perfectly match your real backend schema structure
export interface DispatchMovementPayload {
  id: number;
  tenant_id: number;
  status: string;
  reference_code: string; 
  vehicle_identifier?: string;
  driver_name?: string;
  current_stop: DispatchStopPayload | null;
  warehouse: DispatchWarehousePayload | null;
  updated_at: string | null;
}

interface UseWebSocketsOptions {
  tenantId: string | number | null | undefined;
  tenantSlug?: string;
  onMovementUpdate?: (payload: DispatchMovementPayload) => void;
}

interface UseWebSocketsResult {
  connectionState: ConnectionState;
  lastMovement: DispatchMovementPayload | null;
}

const REVERB_EVENT_NAME = '.dispatch.movement.updated';
const API_BASE_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000/api/v1`
  : process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

let sharedEcho: Echo<'reverb'> | null = null;
const channelRefCounts = new Map<string, number>();

async function authorizeChannel(channelName: string, socketId: string, tenantSlug: string) {
  const response = await fetch(getBroadcastingAuthUrl(API_BASE_URL), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantSlug,
    },
    body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
  });

  if (!response.ok) {
    throw new Error(`Channel authorization failed (${response.status})`);
  }

  return response.json();
}

function getSharedEcho(tenantSlug: string): Echo<'reverb'> {
  if (sharedEcho) return sharedEcho;

  // FIXED: Explicitly register the authorized token cookie callback loop inside Echo parameters
  sharedEcho = new Echo<'reverb'>({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? 'logiflow_key',
    wsHost: typeof window !== 'undefined' ? window.location.hostname : (process.env.NEXT_PUBLIC_REVERB_HOST ?? 'localhost'),
    wsPort: 8000,
    wssPort: 8000,
    forceTLS: false,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    authorizer: (channel: any) => {
      return {
        authorize: (socketId: string, callback: Function) => {
          authorizeChannel(channel.name, socketId, tenantSlug)
            .then((data) => callback(false, data))
            .catch((err) => callback(true, err));
        },
      };
    },
  });

  return sharedEcho;
}

export function useWebSockets({
  tenantId,
  tenantSlug,
  onMovementUpdate,
}: UseWebSocketsOptions): UseWebSocketsResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [lastMovement, setLastMovement] = useState<DispatchMovementPayload | null>(null);

  const onMovementUpdateRef = useRef(onMovementUpdate);
  onMovementUpdateRef.current = onMovementUpdate;
  const tenantSlugRef = useRef(tenantSlug);
  tenantSlugRef.current = tenantSlug;

  useEffect(() => {
    if (!tenantId || !tenantSlug) return;

    const echo = getSharedEcho(tenantSlug);
    const channelName = `tenant.${tenantId}.ops`;

    const handleMovementUpdate = (payload: any) => {
      // Unpack nested Laravel broadcast layers safely
      const data = payload.dispatch ?? payload;
      setLastMovement(data);
      onMovementUpdateRef.current?.(data);
    };

    const handleSubscriptionError = (error: unknown) => {
      const slug = tenantSlugRef.current;
      console.error(`[useWebSockets] auth failed for ${channelName}${slug ? ` (${slug})` : ''}`, error);
      setConnectionState('unavailable');
    };

    // FIXED: Swapped to .private() to trigger the security validation handshake routing path natively
    const channel = echo.private(channelName);
    channel.listen(REVERB_EVENT_NAME, handleMovementUpdate);
    channel.error(handleSubscriptionError);

    channelRefCounts.set(channelName, (channelRefCounts.get(channelName) ?? 0) + 1);

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
  }, [tenantId, tenantSlug]);

  return { connectionState, lastMovement };
}
