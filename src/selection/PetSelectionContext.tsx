import React, { createContext, useContext, useState } from 'react';

interface PetSelectionContextValue {
  selectedPetId: string | 'all';
  setSelectedPetId: (id: string | 'all') => void;
}

const PetSelectionContext = createContext<PetSelectionContextValue | undefined>(undefined);

export function PetSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedPetId, setSelectedPetId] = useState<string | 'all'>('all');
  return (
    <PetSelectionContext.Provider value={{ selectedPetId, setSelectedPetId }}>
      {children}
    </PetSelectionContext.Provider>
  );
}

export function usePetSelection(): PetSelectionContextValue {
  const ctx = useContext(PetSelectionContext);
  if (!ctx) throw new Error('usePetSelection must be used within PetSelectionProvider');
  return ctx;
}
