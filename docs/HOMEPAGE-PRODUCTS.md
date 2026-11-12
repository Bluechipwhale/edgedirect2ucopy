# Homepage product selection

The shop catalogue and homepage have separate product selections. The homepage preserves the twelve previous catalogue slots and adds featured Eedgefoods products. At the owner's request, only Soup in a Box MAXI (`eedgefoods-3671`) and Fish in a Box MAXI (`eedgefoods-3673`) are selected. Administrators can change this choice with the existing **Featured on homepage** checkbox in the product editor.

`data/homepage-products.json` records the import group and separate display limits. `homepageCatalogue` excludes that group before limiting the existing-product query, then fetches featured imports through the same public product view. This prevents imports from crowding out the old homepage products. Unpublished, archived and unapproved-merchant products retain the storefront's normal protections. Timed deals also respect the homepage selection.

Theme previews use the same selection as the live homepage. Product search, category pages, brand pages and the full shop continue to show every eligible product. Only the imported products' homepage featured flags are configured; no product is deleted, and stock, prices, category visibility and publication state remain unchanged.
