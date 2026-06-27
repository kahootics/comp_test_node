# Node Enviroment Setup

Documenting Node setup steps for WordPress integration

## Dependencies

 dependency | purpose
 --- | ---
 **tsx** | runs TS live
 **glob** | file management utility
 **sharp** | images optimization and editing
 **csv-parse** | help build structured data from csv
 **zod** | enforce type validation on parsed csv before turning to JSON
 **esbuild** | bundle & minify scripts

## Workflow

- [x] port and document node-csv functions (**csv-parse**)
- [x] port and document independent utilities
- [ ] port and document enchantments filters
- [ ] port, polish and document mods-compendium filters
- [x] implement expandables structures
- [ ] build expandables of dropdown, modal and popover
- [x] implement writers copy and json functions
- [ ] adjust shared constants json
- [x] srcset maker function with **sharp**
- [ ] implement popup message non-intrusive window structure
- [ ] standardize data collections structure on spreadsheets
- [ ] document types for spreadsheet with **zod**
- [ ] export zod inferred types to safe use at runtime
- [ ] implement sitemap function with **glob**
- [x] implement hashing function
- [x] implement formatting, renaming and cropping of gallery images with **sharp** and **glob** using rules.json header file of gallery sections
- [ ] &lt;continue workflow&gt;

### Finalize Node

- [ ] Uninstall tsx (?)
- [ ] Remove temporary files
- [ ] Test alongside Wordpress live

## Build

1. [ ] run all tests
2. [ ] Optimize assets & hash & move to dist/
3. [ ] Build datesets json & integrate assets
4. [ ] Extract route map & hash it & test it
5. [x] Bundle scripts & hash
6. [ ] Build export.json

## Scripts

### Node Environment

> ```php
> scripts/
> └── node/ ## won't be shipped; needed for JSON data creation and local, MUST NOT use document
>     ├── csv/ ## csv management
>     |   ├── ☒ fetch-sheet-as-csv.ts
>     |   ├── ☒ fetch-sheet-as-structured-data.ts ## dependency to csv-parse module
>     |   └── ☒ normalize-cells.ts
>     ├── writers/ ## file writing management
>     |   ├── ☒ write-structured-data-as-json.ts ## dataset to json written at given directory
>     |   ├── rename-to-list.ts ## renames a list of files to a list of names
>     ├── path-finders/ ## post-initial build runs to create manifest; dependency: glob
>     |   ├── ☐ extract-scripts-paths.ts ## glob => post-transpile script paths {fileName: filePath}
>     |   ├── ☐ extract-images-structured-paths.ts ## glob => assets paths { imDir: {
>     |   *         # distinguishes folder name for namespace                      imName: imPath
>     |   ├── hash-file.ts                                                  }        }
>     └── sharp/ ## dependency on guess what
>         ├── make-webp-srcset.ts ## base function to optimize and generate endpoint urls
>         |                       ## 
>         ├── crop-original.ts ## will crop the original image as specified
>         ├── 
>         *
> ```

### Sync Area

Scripts entrypoints are named main.js and inherit the name of the folder when bundled

> ```php
> scripts/ 
> └── sync/ ## Will be shipped; MUST NOT use node scripts
>     ├── DOM/
>     |   ├── modal.ts # a main class that deals with backdrop, main toggles and focus traps
>     |   ├── mobile-handle.ts # adds handle on mobile to close modal
>     |   ├── dropdown.ts
>     |   ├── *
>     |   |   └── *
>     |   |    
>     |   ├── *
>     ├── mods-compendium/
>     |   ├── mods.ts
>     |   ├── filters.ts
>     |   ├── checklist.ts
>     ├── enchantments/
>     |   ├── enchantments.ts
>     |   ├── filters.ts
> ```

### Shared Scripts

> ```php
> scripts/
> └── shared/ ## NO references to node or document
>     ├── types/ ## type validation for spreadsheet data: zod dependency
>     |   ├── ☐ mods-compendium-types.ts ## needs to be imported from zod
>     |   └── ☐ enchantments-types.ts ## same^
>     ├── utilities/ ## various utilities
>     |   ├── string-parsers.ts
>     |   ├── hex-parsers.ts
>
> ```

## Assets

> ```php
> assets/ ## will be optimized and indexed, but not shipped (served through build json)
> ├── sprites/
> ├── mods-compendium/
> ├── enchantments/
> └── galleries/
>     ├── armors/
>     |   ├── index.txt ## index of images in the folder
>     |   *
>     └── weapons/
>         ├── index.txt
>         *
> ```

## Static Data

> ```php
> config/
> ├── companion-datasheets.json ## contains id and gid of source spreadsheets
> ├── companion-shared-constants.json ## shared constants between Node and Wordpress (for better coordination)
> *
> ```

## Main Pipeline Entrypoint

> ```php
> main.ts ## called at end build to write files and manifest
> live-dev.ts ## called at run dev to write live files in temporary folder to be used in WP dev mode
> ```

