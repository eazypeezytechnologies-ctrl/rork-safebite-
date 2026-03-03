import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const REDUCE_MOTION_KEY = 'safebite_reduce_motion';

export const [ReduceMotionProvider, useReduceMotion] = createContextHook(() => {
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(REDUCE_MOTION_KEY).then((val) => {
      if (val === 'true') setReduceMotion(true);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const toggleReduceMotion = async () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    try {
      await AsyncStorage.setItem(REDUCE_MOTION_KEY, String(next));
    } catch (e) {
      console.warn('[ReduceMotion] Failed to persist:', e);
    }
  };

  return { reduceMotion, toggleReduceMotion, loaded };
});
