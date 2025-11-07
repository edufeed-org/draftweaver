import React, { useCallback, useMemo, useState } from "react";
import { useSeoMeta } from "@unhead/react";
import { useMutation } from "@tanstack/react-query";
import { nip19 } from "nostr-tools";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LoginArea } from "@/components/auth/LoginArea";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { markdownToHtml } from "@/lib/markdown";

interface MappedArticle {
  title: string;
  identifier: string;
  summary: string;
  content: string; // markdown
  rawHtml: string; // original HTML from WordPress
  image?: string;
  canonicalUrl?: string;
  tags: string[];
}

interface NostrLongformEventPreview {
  kind: 30023;
  content: string;
  tags: string[][];
}

const sanitizeIdentifier = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "article";
};

const extractText = (html: string): string => {
  if (!html) return "";
  const tmp = globalThis.document?.createElement("div");
  if (!tmp) return html;
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || html;
};

const buildNostrEvent = (article: MappedArticle, pubkey: string | undefined): NostrLongformEventPreview => {
  const tags: string[][] = [];

  tags.push(["d", article.identifier]);
  if (article.title) tags.push(["title", article.title]);
  if (article.summary) tags.push(["summary", article.summary]);
  if (article.image) tags.push(["image", article.image]);
  if (article.canonicalUrl) tags.push(["r", article.canonicalUrl]);

  if (article.tags.length > 0) {
    for (const tag of article.tags) {
      const trimmed = tag.trim();
      if (trimmed) tags.push(["t", trimmed.toLowerCase()]);
    }
  }

  tags.push(["alt", "NIP-23 long-form article mapped from WordPress (markdown content)"]);
  tags.push(["client", "draftweaver"]);

  if (pubkey) {
    try {
      const npub = nip19.npubEncode(pubkey);
      tags.push(["author", npub]);
    } catch {
      // ignore
    }
  }

  return {
    kind: 30023,
    content: article.content,
    tags,
  };
};

const DraftWeaverPage: React.FC = () => {
  useSeoMeta({
    title: "DraftWeaver | Map WordPress Posts to NIP-23 Long-form",
    description:
      "Fetch from WordPress, convert to markdown, preview the final Nostr long-form event, and publish with confidence.",
  });

  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();

  const [wpUrl, setWpUrl] = useState("");
  const [article, setArticle] = useState<MappedArticle>({
    title: "",
    identifier: "",
    summary: "",
    content: "",
    rawHtml: "",
    image: "",
    canonicalUrl: "",
    tags: [],
  });

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const importFromWordPress = useMutation({
    mutationKey: ["import-wp"],
    mutationFn: async () => {
      setError("");
      setStatus("Fetching from WordPress API...");

      try {
        const url = new URL(wpUrl.trim());

        const isPostEndpoint = /wp-json\//.test(url.pathname);

        let apiUrl: string;

        if (isPostEndpoint) {
          apiUrl = url.toString();
        } else {
          const last = url.pathname.replace(/\/$/, "");
          const slug = last.split("/").filter(Boolean).pop();

          if (!slug) {
            throw new Error("Could not infer post slug from URL. Please paste a direct post URL.");
          }

          const base = `${url.protocol}//${url.host}`;
          apiUrl = `${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`;
        }

        const res = await fetch(apiUrl, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`WordPress API responded with ${res.status}`);
        }

        const data = await res.json();

        const post = Array.isArray(data) ? data[0] : data;
        if (!post) {
          throw new Error("No post found for that URL.");
        }

        const title = (post.title?.rendered as string | undefined) ?? "";
        const html = (post.content?.rendered as string | undefined) ?? "";
        const excerptHtml = (post.excerpt?.rendered as string | undefined) ?? "";
        const summary = extractText(excerptHtml).slice(0, 280);
        const canonical = typeof post.link === "string" ? post.link : wpUrl.trim();

        // Extract cover image
        let image: string | undefined;
        if (typeof post.jetpack_featured_media_url === "string") {
          image = post.jetpack_featured_media_url;
        } else if (post._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
          image = String(post._embedded['wp:featuredmedia'][0].source_url);
        }

        // Extract tags from embedded taxonomies when available
        const tags: string[] = [];
        if (Array.isArray(post._embedded?.['wp:term'])) {
          for (const termGroup of post._embedded['wp:term']) {
            if (!Array.isArray(termGroup)) continue;
            for (const term of termGroup) {
              // Only map post_tag taxonomy as "t" tags
              if (term.taxonomy === 'post_tag') {
                const value = (term.slug || term.name || "").toString().trim();
                if (value && !tags.includes(value)) {
                  tags.push(value);
                }
              }
            }
          }
        }

        const identifier = sanitizeIdentifier(title || canonical);
        const markdown = htmlToMarkdown(html);

        setArticle({
          title,
          identifier,
          summary,
          content: markdown,
          rawHtml: html,
          image,
          canonicalUrl: canonical,
          tags,
        });

        setStatus("Imported and converted to markdown. Review and refine before publishing.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error while fetching WordPress content.";
        setError(msg);
        setStatus("");
        throw err;
      }
    },
  });

  const onFieldChange = useCallback(
    (patch: Partial<MappedArticle>) => {
      setArticle((prev) => ({
        ...prev,
        ...patch,
      }));
    },
    []
  );

  const nostrPreview = useMemo(() => buildNostrEvent(article, user?.pubkey), [article, user?.pubkey]);

  const handlePublish = async () => {
    if (!user) {
      setError("You must be logged in to publish.");
      return;
    }

    setError("");
    setStatus("Publishing to Nostr...");

    try {
      await publishEvent({
        kind: nostrPreview.kind,
        content: nostrPreview.content,
        tags: nostrPreview.tags,
      });

      setStatus("Published successfully to Nostr as NIP-23 long-form article.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish event.";
      setError(msg);
      setStatus("");
    }
  };

  const jsonPreview = useMemo(() => JSON.stringify(nostrPreview, null, 2), [nostrPreview]);
  const htmlPreview = useMemo(() => markdownToHtml(article.content), [article.content]);

  return (
    // ... rest of component unchanged
    <div
      className={cn(
        "min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50",
        "flex flex-col"
      )}
    >
      {/* full JSX remains the same as previous version */}
    </div>
  );
};

export default DraftWeaverPage;
