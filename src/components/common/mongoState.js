import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

const moduleStateEventName = (namespace) => `mgps-erp-module-state:${namespace}`;

export const useMongoState = (namespace, initialValue) => {
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadValue = async () => {
      setIsLoading(true);
      setError('');

      try {
        const payload = await apiFetch(`/module-state/${encodeURIComponent(namespace)}`);
        if (isMounted && payload?.value !== null && payload?.value !== undefined) {
          setValue(payload.value);
        }
      } catch (loadError) {
        if (isMounted) setError(loadError.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadValue();

    return () => {
      isMounted = false;
    };
  }, [namespace]);

  useEffect(() => {
    const handleNamespaceUpdate = (event) => {
      setValue(event.detail);
    };

    window.addEventListener(moduleStateEventName(namespace), handleNamespaceUpdate);
    return () => window.removeEventListener(moduleStateEventName(namespace), handleNamespaceUpdate);
  }, [namespace]);

  const persistValue = useCallback(
    (updater) => {
      setValue((currentValue) => {
        const nextValue =
          typeof updater === 'function' ? updater(currentValue) : updater;

        apiFetch(`/module-state/${encodeURIComponent(namespace)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value: nextValue }),
        }).catch((saveError) => setError(saveError.message));

        window.dispatchEvent(
          new CustomEvent(moduleStateEventName(namespace), {
            detail: nextValue,
          })
        );

        return nextValue;
      });
    },
    [namespace]
  );

  return [value, persistValue, { isLoading, error }];
};
