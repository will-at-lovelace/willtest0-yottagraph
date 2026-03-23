# Update Branding

Refresh the Lovelace Brand R2 files from the canonical source repository.

## Overview

Aether's branding files are wholesale copies from the `moongoose/ui/news-ui` directory of the Lovelace repo. This command copies the latest versions and checks for new dependencies.

**Do not hardcode any local paths.** Always ask the user for the Lovelace repo location.

---

## Step 1: Ask for the Lovelace Repo Path

```
AskQuestion({
  title: "Lovelace Repository Path",
  questions: [
    {
      id: "repo-path",
      prompt: "Where is your local clone of the Lovelace repository?",
      options: [
        { id: "home-lovelace", label: "~/lovelace" },
        { id: "custom", label: "Other location (I'll specify)" }
      ]
    }
  ]
})
```

If the user selects "Other location", ask them to provide the full path.

Expand `~` to the user's home directory. Store the result as `{repo}`.

---

## Step 2: Validate the Source Path

Confirm the branding source directory exists:

```bash
ls {repo}/moongoose/ui/news-ui/BRANDING.md
```

**If the file does not exist:** Tell the user the path doesn't contain the expected branding files and ask them to double-check. Stop.

Also verify the other expected source files exist:

```bash
ls {repo}/moongoose/ui/news-ui/composables/useNewsTheme.ts
ls {repo}/moongoose/ui/news-ui/composables/useThemeClasses.ts
ls {repo}/moongoose/ui/news-ui/assets/theme-styles.css
ls {repo}/moongoose/ui/news-ui/assets/fonts.css
ls {repo}/moongoose/ui/news-ui/public/fonts/README.md
ls {repo}/moongoose/ui/news-ui/public/LL-logo-full-wht.svg
```

Report any missing files. If critical files are missing (BRANDING.md, useNewsTheme.ts, theme-styles.css), stop. If optional files are missing (logo, fonts README), warn but continue.

---

## Step 3: Copy the Branding Files

The base source path is `{repo}/moongoose/ui/news-ui`.

Copy these files to their Aether destinations:

| Source (relative to base)        | Destination (relative to Aether root) |
| -------------------------------- | ------------------------------------- |
| `BRANDING.md`                    | `branding/BRANDING.md`                |
| `composables/useNewsTheme.ts`    | `composables/useNewsTheme.ts`         |
| `composables/useThemeClasses.ts` | `composables/useThemeClasses.ts`      |
| `assets/theme-styles.css`        | `assets/theme-styles.css`             |
| `assets/fonts.css`               | `assets/fonts.css`                    |
| `public/fonts/README.md`         | `public/fonts/README.md`              |
| `public/LL-logo-full-wht.svg`    | `public/LL-logo-full-wht.svg`         |

For `app.vue`, extract only the `<style>` block contents (not the `<style>` tags themselves) and write them to `assets/brand-globals.css`. Read the source `app.vue`, find the content between `<style>` and `</style>`, and overwrite `assets/brand-globals.css` with that content.

---

## Step 4: Dependency Audit

After copying, read through each copied file and check for new references that weren't present before:

1. **TypeScript imports**: Check `useNewsTheme.ts` and `useThemeClasses.ts` for any new `import` statements referencing files that don't exist in Aether.

2. **CSS references**: Check `theme-styles.css`, `fonts.css`, and `brand-globals.css` for:
    - `url()` paths pointing to files not in `public/`
    - `@import` statements referencing files not in `assets/`

3. **Documentation references**: Check `BRANDING.md` for references to new files (logos, assets, CSS files) that should be copied.

**If new dependencies are found:**

- Static assets (images, SVGs, fonts) -> copy to `public/` in the equivalent subdirectory
- CSS files -> copy to `assets/`
- TypeScript/JS files -> copy to `composables/` or the equivalent directory
- Report what was copied to the user

---

## Step 5: Verify Integration

Check that the adapter (`composables/useCustomTheme.ts`) is still compatible:

1. Read `composables/useNewsTheme.ts` and check what it exports.
2. Read `composables/useCustomTheme.ts` and confirm it re-exports the expected interface.
3. If `useNewsTheme.ts` has added new named exports that aren't re-exported by the adapter, tell the user:

> `useNewsTheme.ts` has new exports that aren't exposed through `useCustomTheme.ts`: [list them]. You may want to add these to the adapter if components need them.

4. Check that `nuxt.config.ts` still includes the three CSS files:

```typescript
css: ['~/assets/fonts.css', '~/assets/brand-globals.css', '~/assets/theme-styles.css'],
```

---

## Step 6: Commit

Follow the `git-support.mdc` workflow to commit the change.
