# Category thumbnails — 12 November 2026

At the owner's request, the category images have been restored to the original product photos shown before the generated editorial thumbnails. Food and Nutrition subsequently uses the owner's supplied Fish in a Box photograph for the Eedgefoods catalogue. The six original category photographs, including Fashion, Food & groceries, Beauty & care and Sports & fitness, remain unchanged.

`data/category-thumbnails.json` records each category's original reference product, source, checksum, public Supabase URL and local fallback path. Product photos use contain presentation so packaging remains visible. First-party fallback copies remain in `public/images/category-thumbnails`.

All 12 unused editorial images are preserved unchanged in the laptop's Pictures folder, `E-Edge Direct 2U - Generated Category Images - 12 Nov 2026`. That folder includes descriptive filenames, generation prompts and SHA-256 checksums. The project copies also remain in `public/images/category-editorial` for future use; they are no longer referenced by the category manifest.

Production stores absolute Supabase image URLs so another deployment using the same database can render the pictures without receiving new static files. Empty/placeholder values use the matching local fallback; failed custom URLs retry the fallback once, then show an accessible category symbol instead of a broken browser image.

Administrators can override thumbnails at `/admin/categories`, including by uploading a photo in the existing editor. A valid custom image takes precedence over the fallback. Image changes do not change product classification, prices, stock, publication or staff permissions. Mixed legacy categories retain their existing contents.

Migration 047 adds the customer category directory; migration 048 adds an explicit admin visibility checkbox. Imported products — category review and its descendants are always hidden. Explicitly hidden branches, archived categories and categories with no active, unarchived products from approved merchants are hidden; populated ancestors remain visible up to the supported three levels. Out-of-stock published products still count as category contents. Visibility changes automatically when products are published or withdrawn, unless the branch is explicitly hidden. Empty categories' records and photos remain intact, ready to reappear after publication. Food and Beverages is explicitly hidden at the owner's request.

The storefront grid, filters, breadcrumbs, sitemap and category navigation use the public directory even when an administrator shops. Public category RLS follows the same rule. Management category selectors and exports use a separate authorized directory so administrators can still manage empty and review categories. No products are deleted, published or reclassified by this release.

Source was backed up to the separate GitHub copy branch. The original Vercel deployment and its configuration are not changed by this release.
