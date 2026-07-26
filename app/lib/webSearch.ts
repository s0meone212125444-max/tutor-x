// Free web search for the tutor — no API key required.
// Uses DuckDuckGo's HTML endpoint and extracts result snippets.
// (Tavily/Serper can be swapped in later for higher quality if a key is added.)

export type SearchResult = { title: string; snippet: string; url: string };

export async function webSearch(query: string, max = 5): Promise<SearchResult[]> {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
      body: `q=${encodeURIComponent(query)}`,
    });
    const html = await res.text();
    return parseResults(html, max);
  } catch {
    return [];
  }
}

// Lightweight scrape of DDG's HTML results (title + snippet + link).
function parseResults(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];
  const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/gis;

  const titles: { url: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null && titles.length < max) {
    titles.push({ url: cleanUrl(m[1]), title: strip(m[2]) });
  }
  const snippets: string[] = [];
  let s: RegExpExecArray | null;
  while ((s = snippetRe.exec(html)) !== null && snippets.length < max) {
    snippets.push(strip(s[1]));
  }
  for (let i = 0; i < titles.length; i++) {
    results.push({ title: titles[i].title, url: titles[i].url, snippet: snippets[i] || "" });
  }
  return results;
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// DDG wraps links in a redirect (//duckduckgo.com/l/?uddg=...) — unwrap it.
function cleanUrl(raw: string): string {
  try {
    if (raw.includes("uddg=")) {
      const u = new URL(raw.startsWith("//") ? "https:" + raw : raw);
      const target = u.searchParams.get("uddg");
      if (target) return decodeURIComponent(target);
    }
  } catch {
    /* ignore */
  }
  return raw;
}
