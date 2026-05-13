import { useState, useEffect, useCallback } from 'react';
import { userApi } from '../api/user';

export function usePromptHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let active = true;

    userApi.getPromptHistory()
      .then((data) => { if (active) setHistory(data); })
      .catch(() => {})
      .finally(() => { /* noop */ });

    return () => { active = false; };
  }, []);

  const save = useCallback((prompt) => {
    if (!prompt?.trim()) return;
    setHistory((prev) => {
      const trimmed = prompt.trim();
      return [trimmed, ...prev.filter((p) => p !== trimmed)].slice(0, 10);
    });
    userApi.addPromptHistory(prompt).catch(() => {});
  }, []);

  return { history, save };
}
