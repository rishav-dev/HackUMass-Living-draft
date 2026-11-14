import { useState } from 'react';

export interface CompareSelection {
  active: boolean;
  ids: string[];
  setActive: (active: boolean) => void;
  toggle: (id: string) => void;
}

export function useCompareSelection(): CompareSelection {
  const [active, setActiveState] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  return {
    active,
    ids,
    setActive: (next) => {
      setActiveState(next);
      if (!next) setIds([]);
    },
    toggle: (id) =>
      setIds((list) =>
        list.includes(id) ? list.filter((x) => x !== id) : list.length >= 6 ? list : [...list, id],
      ),
  };
}
