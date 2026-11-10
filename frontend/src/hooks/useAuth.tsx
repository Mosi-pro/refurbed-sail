import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { Role, User } from "../types";

export function useAuth() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me"], queryFn: () => api.get<{ user: User | null }>("/api/auth/me"), staleTime: 60_000 });
  const user = q.data?.user ?? null;
  const logout = useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(["me"], { user: null });
    },
  });
  return {
    user,
    loading: q.isLoading,
    hasRole: (r: Role) => !!user?.roles.includes(r),
    isSeller: !!user && (user.roles.includes("private_seller") || user.roles.includes("dealer")),
    setUser: (u: User | null) => qc.setQueryData(["me"], { user: u }),
    logout: () => logout.mutateAsync(),
  };
}
