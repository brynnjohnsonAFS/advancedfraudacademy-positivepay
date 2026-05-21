#!/usr/bin/env python3
"""
Inject the Google Analytics (GA4) gtag.js snippet into every HTML page on the
Advanced Fraud Academy site.

Idempotent: pages that already contain the Measurement ID are left untouched,
so it is safe to re-run this script anytime — e.g. after creating new pages.

Usage:
    python3 scripts/inject-ga.py

Excluded by convention (these aren't real user-facing pages):
  - emails/*.html                            email templates
  - positivepay/images/sources/*.html        screenshot source templates
  - positivepay/assets/cert-og.html          OG image template
  - handoff/                                 documentation
"""
import re
import sys
from pathlib import Path

GA_ID = "G-330SG25TTK"

SNIPPET = f"""<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', '{GA_ID}');
</script>
"""

# Insert the snippet immediately after the viewport meta tag — that places it
# high in <head> where Google recommends, while sitting cleanly under the
# essential charset + viewport meta tags.
VIEWPORT_RE = re.compile(
    r'(<meta\s+name=["\']viewport["\'][^>]*>\s*\n)',
    re.IGNORECASE,
)
# Fallback for pages without a viewport meta (e.g. a bare redirect page).
HEAD_OPEN_RE = re.compile(r'(<head[^>]*>\s*\n)', re.IGNORECASE)

EXCLUDE_DIRS = {"emails", "handoff", ".git", "node_modules"}
EXCLUDE_FILES = {
    Path("positivepay/assets/cert-og.html"),
}
EXCLUDE_PATH_GLOBS = ("positivepay/images/sources/*",)


def is_excluded(path: Path) -> bool:
    if set(path.parts) & EXCLUDE_DIRS:
        return True
    if path in EXCLUDE_FILES:
        return True
    for glob in EXCLUDE_PATH_GLOBS:
        if path.match(glob):
            return True
    return False


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    candidates = [p for p in root.rglob("*.html") if not is_excluded(p.relative_to(root))]

    skipped = []
    after_viewport = []
    after_head = []
    failed = []

    for p in candidates:
        rel = p.relative_to(root)
        text = p.read_text(encoding="utf-8")
        if GA_ID in text:
            skipped.append(rel)
            continue

        indent_snippet = "\n" + SNIPPET + "\n"
        new_text, n = VIEWPORT_RE.subn(r"\1" + indent_snippet, text, count=1)
        if n == 1:
            p.write_text(new_text, encoding="utf-8")
            after_viewport.append(rel)
            continue

        new_text, n = HEAD_OPEN_RE.subn(r"\1" + indent_snippet, text, count=1)
        if n == 1:
            p.write_text(new_text, encoding="utf-8")
            after_head.append(rel)
            continue

        failed.append(rel)

    print(f"GA4 injection report (ID: {GA_ID})")
    print(f"  Inserted after viewport meta: {len(after_viewport)}")
    print(f"  Inserted after <head> opener: {len(after_head)}")
    print(f"  Already had GA (skipped):     {len(skipped)}")
    print(f"  No <head> found (FAILED):     {len(failed)}")

    if after_head:
        print("\nFiles that used the <head> fallback:")
        for p in after_head:
            print(f"  {p}")

    if failed:
        print("\nFAILED files (no <head> tag found — investigate):")
        for p in failed:
            print(f"  {p}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
