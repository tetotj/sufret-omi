import { useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { trpc } from "@/lib/trpc";

export function useFavorites() {
  const { isAuthenticated } = useAuth();
  const { isGuest } = useApp();
  const canUseFavorites = isAuthenticated && !isGuest;
  const query = trpc.favorites.mine.useQuery(undefined, {
    enabled: canUseFavorites,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const toggleMutation = trpc.favorites.toggle.useMutation({
    onSuccess: () => query.refetch(),
  });
  const mealIds = useMemo(() => new Set(query.data?.mealIds ?? []), [query.data?.mealIds]);
  const kitchenIds = useMemo(() => new Set(query.data?.kitchenIds ?? []), [query.data?.kitchenIds]);

  const toggle = async (entityType: "meal" | "kitchen", entityId: string) => {
    if (!canUseFavorites || toggleMutation.isPending) return false;
    const result = await toggleMutation.mutateAsync({ entityType, entityId });
    return result.isFavorite;
  };

  return { mealIds, kitchenIds, toggle, isPending: toggleMutation.isPending, isLoading: query.isLoading };
}
