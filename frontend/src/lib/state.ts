import { INITIAL_CONTRACTS, INITIAL_DISPUTES, VendorContract, DisputeRecord } from './mockData';

// Shared in-memory state for Next.js runtime
export let globalContracts: VendorContract[] = [...INITIAL_CONTRACTS];
export let globalDisputes: DisputeRecord[] = [...INITIAL_DISPUTES];
export let breachActive = false;
export let breachCountdown = 0;

export function triggerSimulatedBreach() {
  breachActive = true;
  breachCountdown = 6;
}

export function resetBreach() {
  breachActive = false;
  breachCountdown = 0;
}

export function decrementBreachCountdown() {
  if (breachActive) {
    breachCountdown -= 1;
    if (breachCountdown <= 0) {
      breachActive = false;
    }
  }
}

export function addDispute(record: DisputeRecord) {
  globalDisputes.unshift(record);
}

export function addContract(contract: VendorContract) {
  globalContracts.unshift(contract);
}
