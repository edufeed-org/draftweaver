import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import { useAppContext } from "./useAppContext";
import type { NostrEvent } from "@nostrify/nostrify";

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  return useMutation({
    mutationFn: async (t: Omit<NostrEvent, "id" | "pubkey" | "sig">) => {
      if (!user) {
        throw new Error("You must be logged in to publish.");
      }

      const tags = [...(t.tags ?? [])];

      // Ensure a client tag exists so events can be attributed
      if (typeof window !== "undefined") {
        const hasClient = tags.some(([name]) => name === "client");
        if (!hasClient) {
          tags.push(["client", window.location.hostname || "draftweaver"]);
        }
      }

      const event = await user.signer.signEvent({
        kind: t.kind,
        content: t.content ?? "",
        tags,
        created_at: t.created_at ?? Math.floor(Date.now() / 1000),
      });

      // Use current write-enabled relays from config
      const writeRelays = config.relayMetadata.relays
        .filter((r) => r.write)
        .map((r) => r.url);

      if (writeRelays.length === 0) {
        throw new Error("No write-enabled relays configured. Please enable at least one relay in the DraftWeaver relay selector.");
      }

      try {
        // Publish only to the selected write relays
        await nostr.event(event, {
          signal: AbortSignal.timeout(8000),
          relays: writeRelays,
        } as any);
      } catch (err) {
        if (err instanceof AggregateError) {
          throw new Error(
            "Could not publish to any selected relays. " +
            "Check that your chosen relays are reachable and write-enabled."
          );
        }
        throw err;
      }

      return event;
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}
