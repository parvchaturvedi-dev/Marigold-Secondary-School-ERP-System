import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

const moduleStateEventName = (namespace) => `mgps-erp-module-state:${namespace}`;
const AUTH_STORAGE_KEY = 'mgps_erp_auth_session';
const CACHE_TTL_MS = 10_000;
const MAX_CACHE_ENTRIES = 50;
const stateCache = new Map();
const pendingLoads = new Map();
const cacheVersions = new Map();

const getCacheKey = (namespace) => {
  let scope = 'anonymous';
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    if (session?.username && session?.role) {
      scope = `${session.role}:${session.username}:${session.selectedStudentId || ''}`;
    }
  } catch {
    return null;
  }

  return `${scope}:${namespace}`;
};

const bumpCacheVersion = (key) => {
  cacheVersions.set(key, (cacheVersions.get(key) || 0) + 1);
};

const storeCachedValue = (key, value) => {
  stateCache.delete(key);
  stateCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

  while (stateCache.size > MAX_CACHE_ENTRIES) {
    stateCache.delete(stateCache.keys().next().value);
  }
};

const clearStateCache = () => {
  for (const key of new Set([...stateCache.keys(), ...pendingLoads.keys()])) {
    bumpCacheVersion(key);
  }
  stateCache.clear();
};

if (typeof window !== 'undefined') {
  window.addEventListener('mgps-erp-session-updated', clearStateCache);
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY) clearStateCache();
  });
}

export const useMongoState = (namespace, initialValue) => {
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadValue = async () => {
      setIsLoading(true);
      setError('');
      const cacheKey = getCacheKey(namespace);
      const cached = cacheKey ? stateCache.get(cacheKey) : null;

      if (cached && cached.expiresAt > Date.now()) {
        if (isMounted && cached.value !== null && cached.value !== undefined) {
          setValue(cached.value);
        }
        if (isMounted) setIsLoading(false);
        return;
      }

      if (cached) stateCache.delete(cacheKey);

      try {
        const version = cacheKey ? cacheVersions.get(cacheKey) || 0 : 0;
        let request = cacheKey ? pendingLoads.get(cacheKey) : null;

        if (!request) {
          request = apiFetch(`/module-state/${encodeURIComponent(namespace)}`)
            .then((payload) => payload?.value ?? null)
            .finally(() => {
              if (cacheKey && pendingLoads.get(cacheKey) === request) {
                pendingLoads.delete(cacheKey);
              }
            });
          if (cacheKey) pendingLoads.set(cacheKey, request);
        }

        const nextValue = await request;
        const cacheIsCurrent =
          !cacheKey || (cacheVersions.get(cacheKey) || 0) === version;

        if (cacheKey && cacheIsCurrent) storeCachedValue(cacheKey, nextValue);
        if (isMounted && cacheIsCurrent && nextValue !== null && nextValue !== undefined) {
          setValue(nextValue);
        }
      } catch (loadError) {
        if (isMounted) setError(loadError.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const handleNamespaceUpdate = (event) => {
      if (event.detail?.__moduleStateInvalidation === true) {
        const cacheKey = getCacheKey(namespace);
        if (cacheKey) {
          bumpCacheVersion(cacheKey);
          stateCache.delete(cacheKey);
          pendingLoads.delete(cacheKey);
        }
        loadValue();
        return;
      }

      const cacheKey = getCacheKey(namespace);
      if (cacheKey) {
        bumpCacheVersion(cacheKey);
        storeCachedValue(cacheKey, event.detail);
      }
      setValue(event.detail);
    };

    loadValue();
    window.addEventListener(moduleStateEventName(namespace), handleNamespaceUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(moduleStateEventName(namespace), handleNamespaceUpdate);
    };
  }, [namespace]);

  const persistValue = useCallback(
    (updater) => {
      setValue((currentValue) => {
        const nextValue =
          typeof updater === 'function' ? updater(currentValue) : updater;

        const cacheKey = getCacheKey(namespace);
        if (cacheKey) {
          bumpCacheVersion(cacheKey);
          storeCachedValue(cacheKey, nextValue);
        }

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
