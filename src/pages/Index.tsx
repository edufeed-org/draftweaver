import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { LoginArea } from '@/components/auth/LoginArea';

const Index = () => {
  useSeoMeta({
    title: 'DraftWeaver | WordPress → NIP-23 Long-form Studio',
    description:
      'Fetch your WordPress posts, weave them into NIP-23 long-form articles for Nostr, preview precisely, and publish with confidence.',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-930 to-slate-900 text-slate-50 flex flex-col">
      <header className="border-b border-white/5 backdrop-blur-xl bg-slate-950/70 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
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
                Turn WordPress posts into Nostr-native long-form in one flow.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <a
              href="https://soapbox.pub/mkstack"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70 text-[10px] text-slate-300 hover:text-sky-300 hover:border-sky-500/60 hover:bg-slate-900/90 transition-colors"
            >
              <span className="h-1 w-1 rounded-full bg-sky-400 animate-pulse" />
              Vibed with MKStack
            </a>
            <LoginArea className="max-w-44" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 py-10 grid gap-10 md:grid-cols-[1.7fr_1.3fr] items-center">
            <div className="space-y-5">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
                Map WordPress content directly into
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-300"> NIP-23 long-form</span>
                , with a perfect preview before you publish.
              </h2>
              <p className="text-sm md:text-base text-slate-300 leading-relaxed">
                Paste a WordPress URL, let DraftWeaver fetch the post, refine title, summary, tags and body, see the
                exact Nostr event payload, then publish a standards-compliant kind 30023 article to your relays.
              </p>
              <ul className="text-[11px] md:text-xs text-slate-400 space-y-1.5">
                <li>• Direct import from WordPress REST API with embedded media and taxonomies.</li>
                <li>• Automatic HTML → markdown conversion, correct absolute image URLs, and clean d-tag generation.</li>
                <li>• Live long-form + JSON preview so you know exactly what NIP-23 content you are publishing.</li>
              </ul>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/draftweaver"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-sky-500 text-slate-950 text-xs font-semibold shadow-lg shadow-sky-500/30 hover:bg-sky-400 hover:shadow-sky-400/40 transition-all"
                >
                  Open DraftWeaver Studio
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-slate-600 text-[10px] text-slate-200 hover:border-sky-400 hover:text-sky-300 transition-all"
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 bg-gradient-to-tr from-sky-500/10 via-violet-500/5 to-transparent blur-3xl" />
              <div className="relative rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl p-3 shadow-2xl shadow-black/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-slate-500">WordPress → DraftWeaver → Nostr</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="space-y-1.5 text-[9px] text-slate-300">
                  <div className="px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800/90 flex items-center justify-between">
                    <span className="truncate">https://your-site.com/learning-in-public</span>
                    <span className="text-sky-300 ml-2">Import</span>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800/90 flex flex-col gap-0.5">
                    <span className="text-slate-500">kind</span>
                    <span className="text-sky-300">30023</span>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800/90 flex flex-col gap-0.5">
                    <span className="text-slate-500">tags</span>
                    <span className="text-sky-300">["d", "clean-slug"], ["title", "Your Title"], ["t", "oer"], …</span>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800/90 flex flex-col gap-0.5">
                    <span className="text-slate-500">content</span>
                    <span className="text-slate-300 line-clamp-2">
                      Standards-compliant markdown that any NIP-23 client can render beautifully.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-t border-slate-800/70 bg-slate-950/95 backdrop-blur-xl"
        >
          <div className="max-w-6xl mx-auto px-4 py-8 grid gap-4 md:grid-cols-3 text-[10px] text-slate-300">
            <div className="relative p-4 rounded-xl border border-slate-800/80 bg-slate-950/90">
              <div className="absolute -left-2 -top-2 h-5 w-5 rounded-full bg-sky-500/20 border border-sky-500/60 flex items-center justify-center text-[8px] text-sky-300 font-semibold">
                1
              </div>
              <h3 className="text-xs font-semibold text-slate-100 mb-1.5">Import from WordPress</h3>
              <p>
                Paste any public post URL. DraftWeaver calls the WordPress REST API with <code className="font-mono">_embed=1</code>, pulls
                title, content, excerpt, canonical link, featured image, and <code className="font-mono">post_tag</code> taxonomy.
              </p>
            </div>

            <div className="relative p-4 rounded-xl border border-slate-800/80 bg-slate-950/90">
              <div className="absolute -left-2 -top-2 h-5 w-5 rounded-full bg-violet-500/20 border border-violet-500/60 flex items-center justify-center text-[8px] text-violet-300 font-semibold">
                2
              </div>
              <h3 className="text-xs font-semibold text-slate-100 mb-1.5">Weave &amp; Map</h3>
              <p>
                HTML is transformed into clean markdown, relative media URLs are made absolute, the identifier is slugified, and you can
                refine summary, cover image, and tags. The right panel shows the exact NIP-23 (kind 30023) payload we&apos;ll publish.
              </p>
            </div>

            <div className="relative p-4 rounded-xl border border-slate-800/80 bg-slate-950/90">
              <div className="absolute -left-2 -top-2 h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-[8px] text-emerald-300 font-semibold">
                3
              </div>
              <h3 className="text-xs font-semibold text-slate-100 mb-1.5">Publish to Nostr</h3>
              <p>
                Log in with your Nostr key, verify the live preview, then publish directly to your configured relays (default:
                <span className="font-mono"> wss://relay.damus.io</span>). Your long-form article is now available to all NIP-23 capable clients.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
