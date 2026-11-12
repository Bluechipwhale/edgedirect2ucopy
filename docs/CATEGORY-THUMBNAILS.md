# Category thumbnails — 12 November 2026

Twelve category images now use original, visually reviewed editorial still-life photographs generated with the built-in image_gen tool: baby care, oils, dairy, food and beverages, nutrition, groceries, cleaning, laundry, drinks, personal care, snacks and toiletries. Each photo uses category-appropriate objects, coordinated studio colours and natural light. These are category illustrations, not representations of particular product packaging. The six original category photographs, including Fashion, Food & groceries, Beauty & care and Sports & fitness, remain unchanged.

`data/category-thumbnails.json` records each category, generation provenance, checksum, public Supabase URL, local fallback path and crop position. Generated masters are copied unchanged into `public/images/category-editorial`. They use edge-to-edge cover presentation with intentional crop positions; existing product packshot fallbacks remain available in `public/images/category-thumbnails`. The exact generation prompts and workspace paths are saved in `outputs/category-editorial-20261112/prompts.json` locally.

Production stores absolute Supabase image URLs so another deployment using the same database can render the pictures without receiving new static files. Empty/placeholder values use the matching local fallback; failed custom URLs retry the fallback once, then show an accessible category symbol instead of a broken browser image.

Administrators can override thumbnails at `/admin/categories`, including by uploading a photo in the existing editor. A valid custom image takes precedence over the fallback. Image changes do not change product classification, prices, stock, publication or staff permissions. Mixed legacy categories retain their existing contents.

Migration 047 adds the customer category directory. Imported products — category review and its descendants are always hidden. Archived categories and categories with no active, unarchived products from approved merchants are hidden; populated ancestors remain visible up to the supported three levels. Out-of-stock published products still count as category contents. Visibility changes automatically when products are published or withdrawn. Empty categories' records and photos remain intact, ready to reappear after publication.

The storefront grid, filters, breadcrumbs, sitemap and category navigation use the public directory even when an administrator shops. Public category RLS follows the same rule. Management category selectors and exports use a separate authorized directory so administrators can still manage empty and review categories. No products are deleted, published or reclassified by this release.

Source was backed up to the separate GitHub copy branch. The original Vercel deployment and its configuration are not changed by this release.
