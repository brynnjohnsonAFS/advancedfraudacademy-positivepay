#!/usr/bin/env python3
"""
Inject the LinkedIn Insight Tag (Partner ID 5763548) site-wide on the
Advanced Fraud Academy site.

Idempotent: pages that already contain the partner ID are left untouched,
so it is safe to re-run after creating new pages (mirrors inject-ga.py).

Usage:
    python3 scripts/inject-linkedin.py

Excluded by convention (these aren't real user-facing pages):
  - emails/*.html                            email templates
  - positivepay/images/sources/*.html        screenshot source templates
  - positivepay/assets/cert-og.html          OG image template
  - handoff/                                 documentation
"""
import re
import sys
from pathlib import Path

PARTNER_ID = "5763548"

SNIPPET = f"""<!-- LinkedIn Insight Tag -->
<script type="text/javascript">
_linkedin_partner_id = "{PARTNER_ID}";
window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
window._linkedin_data_partner_ids.push(_linkedin_partner_id);
</script>
<script type="text/javascript">
(function(l) {{
if (!l){{window.lintrk = function(a,b){{window.lintrk.q.push([a,b])}};
window.lintrk.q=[]}}
var s = document.getElementsByTagName("script")[0];
var b = document.createElement("script");
b.type = "text/javascript";b.async = true;
b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
s.parentNode.insertBefore(b, s);}})(window.lintrk);
</script>
<noscript>
<img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid={PARTNER_ID}&fmt=gif" />
</noscript>
"""

# Insert the snippet immediately before the closing </body> tag — LinkedIn's
# recommended placement and what the existing thank-you page uses.
BODY_CLOSE_RE = re.compile(r'(\n?)(\s*</body>)', re.IGNORECASE)

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
    inserted = []
    failed = []

    for p in candidates:
        rel = p.relative_to(root)
        text = p.read_text(encoding="utf-8")
        if PARTNER_ID in text:
            skipped.append(rel)
            continue

        new_text, n = BODY_CLOSE_RE.subn("\n\n" + SNIPPET + r"\2", text, count=1)
        if n == 1:
            p.write_text(new_text, encoding="utf-8")
            inserted.append(rel)
            continue

        failed.append(rel)

    print(f"LinkedIn Insight Tag injection report (Partner ID: {PARTNER_ID})")
    print(f"  Inserted before </body>:    {len(inserted)}")
    print(f"  Already had tag (skipped):  {len(skipped)}")
    print(f"  No </body> found (FAILED):  {len(failed)}")

    if failed:
        print("\nFAILED files (no </body> tag found — investigate):")
        for p in failed:
            print(f"  {p}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
