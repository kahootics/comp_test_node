# Node Enviroment Setup

Documenting Node setup steps for WordPress integration

## Dependencies

- [x] tsx: runs TS live
- [x] glob: file management utility
- [x] sharp: images optimization and editing
- [x] csv-parse: help build structured data from csv
- [x] zod: enforce type validation on parsed csv before turning to JSON

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
>     |   ├── write-csv.ts
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
> └── toShip/ ## Will be shipped; MUST NOT use node scripts
>     ├── DOM/
>     |   ├── modal/
>     |   |   ├── modal.ts # a main class that deals with backdrop, main toggles and focus traps
>     |   |   └── mobile-handle.ts # adds handle on mobile to close modal
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

