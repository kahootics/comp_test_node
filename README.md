# Node Enviroment Setup

Documenting Node setup steps for WordPress integration

## Dependencies

- [x] tsx: runs TS live
- [x] glob: file management utility
- [x] sharp: images optimization and editing
- [x] csv-parse: help build structured data from csv
- [x] zod: enforce type validation on parsed csv before turning to JSON

## Workflow

1. [x] port and document node-csv functions (**csv-parse**)
1. [x] port and document independent utilities
1. [ ] port and document enchantments filters
1. [ ] port, polish and document mods-compendium filters
1. [x] implement expandables structures
1. [ ] build expandables of dropdown, modal and popover
1. [x] implement writers copy and json functions
1. [ ] adjust shared constants json
1. [x] srcset maker function with **sharp**
1. [ ] implement popup message non-intrusive window structure
1. [ ] standardize data collections structure on spreadsheets
1. [ ] document types for spreadsheet with **zod**
1. [ ] export zod inferred types to safe use at runtime
1. [ ] implement sitemap function with **glob**
1. [ ] implement hashing function
1. [ ] implement formatting, renaming and cropping of gallery images with **sharp** and **glob** using schema.json header file of gallery sections
1. [ ] &lt;continue workflow&gt;

### Finalize Node

- [ ] Uninstall tsx (?)
- [ ] Remove temporary files
- [ ] Test alongside Wordpress live

## Build

1. [x] tsc
1. [x] hash scripts
1. [x] map scripts
1. [x] copy img
1. [x] make srcsets
1. [x] hash images
1. [x] map images
1. [ ] produce json datasets
1. [ ] hash datasets
1. [ ] map datasets
1. [ ] join maps into manifest & write it

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

