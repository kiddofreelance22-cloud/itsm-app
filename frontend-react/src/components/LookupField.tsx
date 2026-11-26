import React, { useCallback } from "react";
import { SearchSelect, type SearchOption } from "./SearchSelect";
import { fetchLookupOptions } from "../lookupSources";

interface Props {
  /** Lookup source key (users, emails, locations, departments, groups). */
  source: string;
  value: string;
  label: string;
  onSelect: (opt: SearchOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Use a caller-supplied (stable) search instead of the shared one, e.g. to surface errors. */
  fetchOverride?: (query: string) => Promise<SearchOption[]>;
}

/** SearchSelect bound to one lookup source, with a search function that stays stable between renders. */
export function LookupField({ source, fetchOverride, ...rest }: Props) {
  const fetchOptions = useCallback((q: string) => fetchLookupOptions(source, q), [source]);
  return <SearchSelect {...rest} fetchOptions={fetchOverride ?? fetchOptions} />;
}
