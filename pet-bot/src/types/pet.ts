// src/types/pet.ts
export interface PetState {
    happiness: number;
    activity: 'idle' | 'playing' | 'sleeping' | 'eating';
    lastUpdate: number;
  }
  
  export interface PetUpdate {
    type: 'PET_STATE_UPDATE';
    state: PetState;
    timestamp: number;
  }