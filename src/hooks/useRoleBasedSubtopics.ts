import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  data as sidebarData,
  loadRoleBasedSidebarData,
  type Topic,
} from "../data/SideBarData.ts";
import { useUser } from "../contexts/UserContext";

export type RoleSubtopic = {
  id: number;
  name: string;
  repIdNo?: string;
};

type SidebarLocationState = {
  subtopics?: Array<{ id: number; name: string; repIdNo?: string }>;
  selectedSubtopicId?: number;
};

const normalize = (value: string): string =>
  value
    .trim()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();

export const useRoleBasedSubtopics = (categoryNames: string[]) => {
  const location = useLocation();
  const { user } = useUser();
  const epfNo = user?.Userno ?? "";
  const state = (location.state as SidebarLocationState | null) ?? null;
  const [dynamicSubtopics, setDynamicSubtopics] = useState<RoleSubtopic[]>([]);
  const [billMap, setBillMap] = useState<string | null>(null);
  const [levelNo, setLevelNo] = useState<string | null>(null);

  const routeStateSubtopics =
    Array.isArray(state?.subtopics) && state.subtopics.length > 0
      ? state.subtopics
      : null;

  const [loading, setLoading] = useState<boolean>(!routeStateSubtopics);

  const selectedSubtopicId =
    typeof state?.selectedSubtopicId === "number" ? state.selectedSubtopicId : null;

  const normalizedNames = useMemo(
    () => new Set(categoryNames.map(normalize)),
    [categoryNames.join("|")]
  );

  useEffect(() => {
    let cancelled = false;

    const loadFallbackSubtopics = async () => {
      if (!epfNo.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await loadRoleBasedSidebarData(epfNo);
      if (cancelled) {
        return;
      }

      const matchedTopics = result.data.filter((topic) =>
        normalizedNames.has(normalize(topic.name)) || topic.path === "/dashboard"
      );

      const seenSubtopicIds = new Set<number>();
      const subtopics: RoleSubtopic[] = matchedTopics
        .flatMap((topic) => topic.subtopics)
        .filter((subtopic) => {
          if (seenSubtopicIds.has(subtopic.id)) return false;
          seenSubtopicIds.add(subtopic.id);
          return true;
        })
        .map((subtopic) => ({
          id: subtopic.id,
          name: subtopic.name,
          repIdNo: subtopic.repIdNo,
        }));

      setDynamicSubtopics(subtopics);
      setBillMap(result.billMap);
      setLevelNo(result.levelNo);
      setLoading(false);
    };

    void loadFallbackSubtopics();

    return () => {
      cancelled = true;
    };
  }, [epfNo, normalizedNames]);

  const matchedStaticTopic = sidebarData.find((topic: Topic) => normalizedNames.has(normalize(topic.name)));

  const staticSubtopics: RoleSubtopic[] = (matchedStaticTopic?.subtopics ?? []).map((subtopic) => ({
    id: subtopic.id,
    name: subtopic.name,
    repIdNo: subtopic.repIdNo,
  }));

  const fallbackSubtopics =
    dynamicSubtopics.length > 0 ? dynamicSubtopics : staticSubtopics;

  return {
    subtopics: routeStateSubtopics ?? fallbackSubtopics,
    loading: routeStateSubtopics ? false : loading,
    selectedSubtopicId,
    billMap,
    levelNo,
  };
};
