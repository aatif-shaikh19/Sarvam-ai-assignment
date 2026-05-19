// useEdgeAgent.js — React hook wrapping the EdgeAgentService singleton
// Extended with workerStates, recoveryLog, crashWorker, deviceEvents, and failDevice.

import { useState, useEffect, useCallback } from 'react';
import edgeAgentService from '../services/EdgeAgentService.js';

export default function useEdgeAgent() {
  const [state, setState] = useState(() => edgeAgentService.getState());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect on mount
    edgeAgentService.connect();

    const unsubState = edgeAgentService.on('state-update', (newState) => {
      setState({ ...newState });
    });

    const unsubConn = edgeAgentService.on('connected', (val) => {
      setConnected(val);
    });

    // Check initial connection
    setConnected(edgeAgentService.connected);

    return () => {
      unsubState();
      unsubConn();
    };
  }, []);

  const submit = useCallback(async ({ mfeId, priority, prompt }) => {
    return edgeAgentService.submitRequest({ mfeId, priority, prompt });
  }, []);

  const crashWorker = useCallback(async (slotIndex) => {
    return edgeAgentService.crashWorker(slotIndex);
  }, []);

  const failDevice = useCallback(async (deviceId) => {
    return edgeAgentService.failDevice(deviceId);
  }, []);

  return {
    queue: state.queue,
    active: state.active,
    history: state.history,
    slots: state.slots,
    devices: state.devices,
    tokens: state.tokens,
    workerStates: state.workerStates,
    recoveryLog: state.recoveryLog,
    deviceEvents: state.deviceEvents,
    observability: state.observability,
    connected,
    submit,
    crashWorker,
    failDevice,
  };
}
