import { useEffect, useState } from "react";
import axios from "axios";

export default function useSummary(baseUrl, refreshToken = 0) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const client = axios.create({ baseURL: baseUrl, timeout: 8000 });
    async function fetchSummary() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await client.get("/stats/summary");
        if (isMounted) setSummary(data);
      } catch (err) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [baseUrl, refreshToken]);

  return { summary, loading, error };
}
