"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface FeatureFlags {
  [key: string]: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {};

export function useFeatureFlags(): { flags: FeatureFlags; loading: boolean } {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const { data, error } = await supabase
          .from("feature_flags")
          .select("key, value");

        if (error) {
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          const flagMap: FeatureFlags = { ...DEFAULT_FLAGS };
          for (const row of data) {
            flagMap[row.key] = row.value;
          }
          setFlags(flagMap);
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    };

    fetchFlags();
  }, []);

  return { flags, loading };
}
