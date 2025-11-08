import React, { useCallback, useMemo, useState } from "react";
import { useSeoMeta } from "@unhead/react";
import { useMutation } from "@tanstack/react-query";
import { nip19 } from "nostr-tools";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useAppContext } from "@/hooks/useAppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LoginArea } from "@/components/auth/LoginArea";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { markdownToHtml } from "@/lib/markdown";

interface MappedArticle {
  title: string;
  identifier: string;
  summary: string;
  content: string;
  rawHtml: string;
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
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "article").slice(0, 128);
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
  const { config, updateConfig } = useAppContext();

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

  const [tagsInput, setTagsInput] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [newRelayUrl, setNewRelayUrl] = useState<string>("");

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
          if (!slug) throw new Error("Could not infer post slug from URL. Please paste a direct post URL.");
          const base = `${url.protocol}//${url.host}`;
          apiUrl = `${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`;
        }

        const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`WordPress API responded with ${res.status}`);

        const data = await res.json();
        const post = Array.isArray(data) ? data[0] : data;
        if (!post) throw new Error("No post found for that URL.");

        const title = (post.title?.rendered as string | undefined) ?? "";
        const html = (post.content?.rendered as string | undefined) ?? "";
        const excerptHtml = (post.excerpt?.rendered as string | undefined) ?? "";
        const summary = extractText(excerptHtml).slice(0, 280);
        const canonical = typeof post.link === "string" ? post.link : wpUrl.trim();

        let image: string | undefined;
        if (typeof post.jetpack_featured_media_url === "string") {
          image = post.jetpack_featured_media_url;
        } else if (post._embedded?.["wp:featuredmedia"]?.[0]?.source_url) {
          image = String(post._embedded["wp:featuredmedia"][0].source_url);
        }

        const tags: string[] = [];
        if (Array.isArray(post._embedded?.["wp:term"])) {
          for (const termGroup of post._embedded["wp:term"]) {
            if (!Array.isArray(termGroup)) continue;
            for (const term of termGroup) {
              if (term.taxonomy === "post_tag") {
                const value = (term.slug || term.name || "").toString().trim();
                if (value && !tags.includes(value)) tags.push(value);
              }
            }
          }
        }

        const identifier = sanitizeIdentifier(title || canonical);
        const markdown = htmlToMarkdown(html, canonical);

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
        setTagsInput(tags.join(", "));

        setStatus("Imported and converted to markdown. Review and refine before publishing.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error while fetching WordPress content.";
        setError(msg);
        setStatus("");
        throw err;
      }
    },
  });

  const onFieldChange = useCallback((patch: Partial<MappedArticle>) => {
    setArticle((prev) => ({ ...prev, ...patch }));
  }, []);

  const onTagsChange = (value: string) => {
    setTagsInput(value);
    const parsed = value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    setArticle((prev) => ({ ...prev, tags: parsed }));
  };

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

  const relays = config.relayMetadata.relays;
  const writeRelays = relays.filter((r) => r.write);

  const updateRelays = (next: typeof relays) => {
    updateConfig((current) => ({
      ...current,
      relayMetadata: {
        relays: next,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    }));
  };

  const toggleRelayWrite = (url: string) => {
    const next = relays.map((r) =>
      r.url === url ? { ...r, write: !r.write } : r
    );
    updateRelays(next);
  };

  const removeRelay = (url: string) => {
    if (relays.length <= 1) return;
    const next = relays.filter((r) => r.url !== url);
    updateRelays(next);
  };

  const addRelay = () => {
    const raw = newRelayUrl.trim();
    if (!raw) return;
    try {
      const url = new URL(raw.startsWith("ws") ? raw : `wss://${raw}`).toString();
      if (relays.some((r) => r.url === url)) {
        setNewRelayUrl("");
        return;
      }
      updateRelays([...relays, { url, read: true, write: true }]);
      setNewRelayUrl("");
    } catch {
      // ignore invalid input for now; could show toast if desired
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50",
        "flex flex-col"
      )}
    >
      <header className="border-b border-slate-800/80 backdrop-blur-xl bg-slate-950/90 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-2xl bg-gradient-to-br from-violet-500 via-sky-400 to-emerald-400 shadow-lg shadow-violet-500/40">
              <div className="absolute inset-[5px] rounded-2xl bg-slate-950/90" />
              <span className="relative z-10 flex h-full w-full items-center justify-center text-xs font-semibold tracking-[0.18em] text-sky-300">
                DW
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-lg font-semibold tracking-tight">DraftWeaver</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
                  NIP-23 Studio
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Map WordPress stories into markdown-based Nostr long-form.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <a
              href="https://soapbox.pub/mkstack"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/95 border border-slate-700/70 text-[10px] text-slate-300 hover:text-sky-300 hover:border-sky-500/60 hover:bg-slate-900 transition-colors"
            >
              <span className="h-1 w-1 rounded-full bg-sky-400 animate-pulse" />
              Vibed with MKStack
            </a>
            <LoginArea className="max-w-44" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Top row: Import + Mapping */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)] gap-4">
          {/* Import from WordPress */}
          <Card className="bg-slate-950 border-slate-800/80 shadow-xl shadow-black/40 backdrop-blur-xl">
            <CardHeader className="pb-3 flex flex-col gap-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                  Import from WordPress
                </span>
                <span className="text-[10px] text-slate-500">Paste any public post URL</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wp-url" className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  WordPress Post URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="wp-url"
                    placeholder="https://your-site.com/your-post"
                    value={wpUrl}
                    onChange={(e) => setWpUrl(e.target.value)}
                    className="bg-slate-900 border-slate-700/80 text-xs placeholder:text-slate-600 text-slate-100"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => importFromWordPress.mutate()}
                    disabled={!wpUrl || importFromWordPress.isPending}
                    className="text-xs px-3 whitespace-nowrap"
                  >
                    {importFromWordPress.isPending ? "Fetching..." : "Import"}
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="markdown">
                <TabsList className="grid grid-cols-2 mb-2 bg-slate-900/90 border border-slate-800/80">
                  <TabsTrigger value="markdown" className="text-[9px]">Markdown</TabsTrigger>
                  <TabsTrigger value="html" className="text-[9px]">Original HTML</TabsTrigger>
                </TabsList>
                <TabsContent value="markdown">
                  <Label className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
                    Editable markdown (stored as Nostr content)
                  </Label>
                  <Textarea
                    value={article.content}
                    onChange={(e) => onFieldChange({ content: e.target.value })}
                    className="mt-1 bg-slate-900 border-slate-800/80 text-[11px] leading-relaxed h-40 resize-y text-slate-100"
                    placeholder="Markdown converted from your WordPress post will appear here."
                  />
                </TabsContent>
                <TabsContent value="html">
                  <Label className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
                    Read-only source HTML from WordPress
                  </Label>
                  <Textarea
                    value={article.rawHtml}
                    readOnly
                    className="mt-1 bg-slate-900 border-slate-900/80 text-[9px] font-mono h-40 resize-y text-slate-400"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Mapping to NIP-23 */}
          <Card className="bg-slate-950 border-slate-800/80 shadow-xl shadow-black/40 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                <span>Mapping to NIP-23 Long-form</span>
                <span className="text-[9px] text-slate-500">
                  Everything here becomes your Nostr article metadata
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="title" className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={article.title}
                    onChange={(e) =>
                      onFieldChange({ title: e.target.value, identifier: sanitizeIdentifier(e.target.value || article.identifier) })
                    }
                    placeholder="Your long-form title"
                    className="bg-slate-900 border-slate-800/80 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="identifier" className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Identifier (d tag / slug)
                  </Label>
                  <Input
                    id="identifier"
                    value={article.identifier}
                    onChange={(e) => onFieldChange({ identifier: sanitizeIdentifier(e.target.value) })}
                    placeholder="auto-generated-from-title"
                    className="bg-slate-900 border-slate-800/80 text-[10px] font-mono text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="summary" className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  Summary (optional, max ~280 chars)
                </Label>
                <Textarea
                  id="summary"
                  value={article.summary}
                  onChange={(e) => onFieldChange({ summary: e.target.value.slice(0, 420) })}
                  placeholder="Short summary for clients and relays."
                  className="bg-slate-900 border-slate-800/80 text-xs h-16 text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="image" className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  Cover Image URL
                </Label>
                <Input
                  id="image"
                  value={article.image ?? ""}
                  onChange={(e) => onFieldChange({ image: e.target.value || undefined })}
                  placeholder="https://..."
                  className="bg-slate-900 border-slate-800/80 text-xs text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="canonical" className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  Canonical URL (original WordPress link)
                </Label>
                <Input
                  id="canonical"
                  value={article.canonicalUrl ?? ""}
                  onChange={(e) => onFieldChange({ canonicalUrl: e.target.value || undefined })}
                  placeholder="https://your-site.com/your-post"
                  className="bg-slate-900 border-slate-800/80 text-xs text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tags" className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  Tags (comma-separated)
                </Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => onTagsChange(e.target.value)}
                  placeholder="nostr, education, oer, longform"
                  className="bg-slate-900 border-slate-800/80 text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-between pt-2 gap-3">
                <div className="text-[10px] text-slate-500 max-w-xs">
                  We publish markdown as the event content. Tags carry all queryable metadata.
                </div>
                <div className="flex items-center gap-2">
                  {user && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-[9px] px-2 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:border-sky-500 hover:text-sky-300 transition-colors">
                          Relays: {writeRelays.length > 0 ? writeRelays.map((r) => r.url.replace(/^wss:\/\//, "")).join(", ") : "none"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 bg-slate-950 border-slate-800 text-[9px] text-slate-200" align="end">
                        <p className="mb-2 text-slate-400">
                          Choose which relays DraftWeaver publishes to. Changes apply globally for this app.
                        </p>
                        <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
                          {relays.map((r) => (
                            <div key={r.url} className="flex items-center gap-2 py-1">
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{r.url}</div>
                                <div className="flex gap-2 text-[8px] text-slate-500 mt-0.5">
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={r.write}
                                      onChange={() => toggleRelayWrite(r.url)}
                                      className="h-3 w-3 accent-sky-500"
                                    />
                                    <span>publish</span>
                                  </label>
                                </div>
                              </div>
                              <button
                                className="text-slate-500 hover:text-red-400 text-xs"
                                onClick={() => removeRelay(r.url)}
                                disabled={relays.length <= 1}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input
                            placeholder="wss://relay.example.com"
                            value={newRelayUrl}
                            onChange={(e) => setNewRelayUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addRelay();
                              }
                            }}
                            className="h-7 bg-slate-900 border-slate-800 text-[9px]"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={addRelay}
                            className="h-7 px-2 text-[9px]"
                          >
                            Add
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!article.identifier || !article.title || !article.content || !user}
                    onClick={handlePublish}
                    className="text-[10px] px-3 border-sky-500/80 text-sky-300 hover:bg-sky-500/10 hover:text-sky-100"
                  >
                    {user ? "Publish to Nostr" : "Log in to Publish"}
                  </Button>
                </div>
              </div>

              {status && <p className="text-[10px] text-sky-300/90 pt-1">{status}</p>}
              {error && <p className="text-[10px] text-red-400/90 pt-1">{error}</p>}
            </CardContent>
          </Card>
        </section>

        {/* Bottom row: Preview + Event payload */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Article preview */}
          <Card className="bg-slate-950 border-slate-800/80 shadow-xl shadow-black/40 backdrop-blur-xl">
            <CardHeader className="pb-2 flex flex-col gap-1">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Nostr Article Preview</span>
                <span className="text-[9px] text-slate-500">Markdown-rendered view</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 pr-2">
                <article className="space-y-3">
                  {article.image && (
                    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/95">
                      <img src={article.image} alt={article.title || "Cover"} className="w-full h-40 object-cover" />
                    </div>
                  )}
                  <h2 className="text-lg font-semibold tracking-tight text-slate-50">
                    {article.title || "Your long-form title will appear here"}
                  </h2>
                  {article.summary && (
                    <p className="text-xs text-slate-300 leading-relaxed">{article.summary}</p>
                  )}
                  {article.canonicalUrl && (
                    <a
                      href={article.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-sky-300 hover:text-sky-200"
                    >
                      Original: {article.canonicalUrl}
                    </a>
                  )}
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-700/70 to-transparent my-2" />
                  <div
                    className="prose prose-invert prose-sky max-w-none text-[11px] leading-relaxed [&_a]:text-sky-300 [&_a:hover]:text-sky-200"
                    dangerouslySetInnerHTML={{ __html: htmlPreview }}
                  />
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {article.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-[9px] text-sky-300"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Event payload */}
          <Card className="bg-slate-950 border-slate-800/80 shadow-xl shadow-black/40 backdrop-blur-xl">
            <CardHeader className="pb-2 flex flex-col gap-1">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Event Payload</span>
                <span className="text-[9px] text-slate-500">Exact kind 30023 structure</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="json">
                <TabsList className="grid grid-cols-2 mb-2 bg-slate-900/90 border border-slate-800/80">
                  <TabsTrigger value="json" className="text-[9px]">JSON</TabsTrigger>
                  <TabsTrigger value="tags" className="text-[9px]">Tags Only</TabsTrigger>
                </TabsList>
                <TabsContent value="json">
                  <ScrollArea className="h-72">
                    <pre className="text-[9px] leading-relaxed text-sky-300/90 bg-slate-950/95 p-3 rounded-lg border border-slate-900/80 overflow-x-auto">
                      {jsonPreview}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="tags">
                  <ScrollArea className="h-72">
                    <div className="space-y-1 text-[9px] text-sky-200/90 bg-slate-950/95 p-3 rounded-lg border border-slate-900/80">
                      {nostrPreview.tags.map((t, idx) => (
                        <div key={`${t.join("-")}-${idx}`} className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">{t[0]}</span>
                          {t.slice(1).map((v, i) => (
                            <span
                              key={`${idx}-${i}`}
                              className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default DraftWeaverPage;
