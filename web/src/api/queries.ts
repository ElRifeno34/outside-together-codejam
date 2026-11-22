// Query definitions shared by a route's loader and its component.
// They live outside the route files on purpose: TanStack Router's code splitting
// moves the loader and the component into separate chunks, and a plain `const`
// shared between them inside the route file failed to load ("does not provide an
// export named …"), which stopped the whole app from starting.
import { queryOptions } from "@tanstack/react-query";
import * as api from "./index";

/** Activity types and public places for the create / edit form. */
export const draftOptions = queryOptions({
  queryKey: ["draft-options"],
  queryFn: async () => ({
    types: await api.getActivityTypes(),
    places: await api.getPublicPlaces(),
  }),
});

/** One activity, by id (activity page and edit form share the cache entry). */
export const activityOptions = (id: string) =>
  queryOptions({ queryKey: ["activity", id], queryFn: () => api.getActivity(id) });

/** The catalogue of places to visit. */
export const spotsOptions = queryOptions({ queryKey: ["spots"], queryFn: () => api.getSpots() });
