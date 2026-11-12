# Category thumbnails — 12 November 2026

Thirteen empty or placeholder category images now use visually reviewed product photos matched to the category. The six existing, appropriate category photographs remain in place.

`data/category-thumbnails.json` records the category, reference product, source URL, checksum, public Supabase URL and local fallback path. Image bytes are preserved unchanged. Full product labels and bottle tops are displayed with `object-fit: contain`; other category photography retains its existing cover layout.

Production stores absolute Supabase category-thumbnail URLs so another deployment using the same database can render the pictures without receiving new static files. The primary app also has first-party fallback copies in `public/images/category-thumbnails`. Empty/placeholder values use the matching fallback; failed custom URLs retry the fallback once, then show an accessible category symbol instead of a broken browser image.

Administrators can override thumbnails at `/admin/categories`, including by uploading a photo in the existing editor. A valid custom image takes precedence over the fallback. Image changes do not change product classification, prices, stock, publication or permissions. Mixed legacy categories retain their existing contents; thumbnails use a representative item already assigned to that category.

Source was backed up to the separate GitHub copy branch. The original Vercel deployment and its configuration are not changed by this release.
