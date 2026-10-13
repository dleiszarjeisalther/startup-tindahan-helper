// src/presentation/hooks/useIdempotentSubmit.ts
import { useRef, useState, useCallback } from 'react';

/**
 * Prevents accidental double-taps on Complete Sale, Save Product, or Confirm Return
 * using a synchronous useRef lock (<1ms guard before React re-render).
 */
export function useIdempotentSubmit<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>
) {
  const lockRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trigger = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (lockRef.current) return undefined;
      lockRef.current = true;
      setIsSubmitting(true);
      try {
        return await action(...args);
      } finally {
        lockRef.current = false;
        setIsSubmitting(false);
      }
    },
    [action]
  );

  return { trigger, isSubmitting };
}
