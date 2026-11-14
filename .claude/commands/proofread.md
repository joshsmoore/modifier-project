---
description: Interactively proofread prose in markdown content (staged files by default)
---

Proofread the prose in the files below. Scope and behavior:

**Files to review** — either the file paths I pass as arguments, or (if none) the staged markdown in `src/content/**/*.md`:

!`if [ -n "$ARGUMENTS" ]; then echo "$ARGUMENTS" | tr ' ' '\n'; else git diff --cached --name-only --diff-filter=ACMR -- 'src/content/**/*.md'; fi`

If the list above is empty, ask me whether to check **all** `src/content/**/*.md` instead. Otherwise:

1. Read each file.
2. Call out real spelling, grammar, punctuation, and clarity issues. **Not** stylistic rewrites — these are my words and I want to keep my voice.
3. Ignore YAML frontmatter *keys* (`name:`, `class:`, `hero:`, etc.) and the `images[]` list. Do check the value of prose fields like `description:` and `configuration:`, and the markdown body.
4. Ignore markdown syntax, URLs, product names (MagMod, Godox, Flashpoint, eVOLV, Adorama, iPhone, etc.), and measurements (`1/16`, `46"`, ISO numbers).

**Output format** — for each file, a short bulleted list:

```
src/content/groups/bare.md
- "duto reflection" → "due to reflection"
- "shadowns" → "shadows"
```

If a file is clean, say `src/content/groups/bare.md: ok`.

After listing issues, ask me **"apply all / pick one by one / skip"**. On "apply all", edit the files directly with the fixes you proposed. On "pick one by one", ask about each in order.
