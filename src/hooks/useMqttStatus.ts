import { useSyncExternalStore } from 'react';
import {
  getMqttStatusSnapshot,
  subscribeMqttStatus,
  type MqttStatusSnapshot,
} from '../services/mqtt';

export type { MqttStatusSnapshot };

export function useMqttStatus() {
  return useSyncExternalStore(
    subscribeMqttStatus,
    getMqttStatusSnapshot,
    getMqttStatusSnapshot
  );
}
