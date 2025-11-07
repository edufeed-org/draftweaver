import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import type { NostrEvent } from "@nostrify/nostrify";

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

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

      // If no relays are configured, fail fast with a clear message
      const relays = (nostr as any)?.relays as string[] | undefined;
      if (Array.isArray(relays) && relays.length === 0) {
        throw new Error("No write-enabled relays configured. Please add wss://jumble.social or another relay.");
      }

      try {
        await nostr.event(event, { signal: AbortSignal.timeout(8000) });
      } catch (err) {
        // Make AggregateError from Promise.any human-readable
        if (err instanceof AggregateError) {
          throw new Error(
            "Could not publish to any configured relays. " +
            "Check that wss://jumble.social (or your selected relays) are reachable and write-enabled."
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
