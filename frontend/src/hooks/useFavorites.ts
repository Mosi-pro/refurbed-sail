import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuth } from "./useAuth";

export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["favorite-ids"],
    queryFn: () => api.get<{ ids: number[] }>("/api/favorites/ids"),
    enabled: !!user,
    staleTime: 30_000,
  });
  const ids = user ? q.data?.ids ?? [] : [];
  const toggle = useMutation({
    mutationFn: (boatId: number) =>
      ids.includes(boatId) ? api.del(`/api/favorites/${boatId}`) : api.put(`/api/favorites/${boatId}`),
    onMutate: async (boatId) => {
      await qc.cancelQueries({ queryKey: ["favorite-ids"] });
      const prev = qc.getQueryData<{ ids: number[] }>(["favorite-ids"]);
      qc.setQueryData(["favorite-ids"], { ids: ids.includes(boatId) ? ids.filter((i) => i !== boatId) : [...ids, boatId] });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["favorite-ids"], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["favorite-ids"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
  return { ids, isFavorite: (id: number) => ids.includes(id), toggle: (id: number) => toggle.mutate(id), error: toggle.error };
}
