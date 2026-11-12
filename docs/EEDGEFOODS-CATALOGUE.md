# Eedgefoods catalogue — 12 November 2026

The owner requested the complete public catalogue from https://eedgefoods.com/ in Food and Nutrition. Both shop pages and the WooCommerce public Store API were checked: 12 source listings represent 10 distinct products after the owner approved consolidating the three identical Fish in a Box (MAXI) listings. Names and NGN prices come from the source; unknown weights and pack contents are not invented.

The owner supplied the opening quantity per distinct product. Each new product starts at zero and receives one authorized `adjust_stock` entry. The three MAXI source records share one destination product and one opening-stock allocation. All 12 source IDs, URLs and snapshots remain in the private `catalogue_external_sources` table. That table is not exposed to anonymous or authenticated application clients. Import reruns preserve existing products and never add opening stock again.

The owner-provided Fish in a Box photo is the Food and Nutrition thumbnail and the main Fish MAXI photo. The supplied Soup in a Box photo is used for Soup MAXI. Other product photos come from the corresponding original listings. Image bytes and checksums are preserved; public Supabase objects and first-party copies support the web catalogue and app wrappers.

All reviewed previous records in Food and Nutrition move to Personal Care and Hygiene as requested, preserving prices, stock, reservations, publication state, principal mappings and historical receipts. Food and Beverages is explicitly hidden from the customer category directory; its records remain available to administrators. Navigation points to Food and Nutrition. Existing order, payment, refund and field-operation records are not changed.

Migration 048 adds the category editor's **Hide category from customers** checkbox. This hides the category branch and its customer navigation links without deleting categories or changing individual products' publication settings. Automatic empty-category hiding and the imported-product review exclusion remain in place. Older editors that omit the new checkbox preserve the saved visibility flag.

`scripts/import-eedgefoods.cjs` validates the reviewed source snapshot, NGN minor units, simple product types, image manifest, confirmed owner and approved flagship merchant. It performs the catalogue change in one audited transaction, compares protected business-data snapshots and validates every opening-stock ledger entry. A dry run is the default; execution requires explicit `--apply`, `--expect`, `--opening-stock` and `--admin-email` arguments. Source snapshots, operational quantities, private receipts and runtime credentials stay outside the source release.

Source backup uses the GitHub copy repository. Vercel's protected backup deployment is not redeployed.
