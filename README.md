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
 **vitest** | local testing
 **express** | local server

## Assets Library

The assets have a `rules.json` file in each directory; said file is used to determine the required state of each asset and exporting mechanism.

The `AssetsLibrary` interface allows to navigate among the assets by name and enforce rules.

## ToDo

- [ ] create generic components for rendering
- [ ] create renders modules (only render as factory method)
- [ ] create full page articles (dynamic import of render module)


## Schemas

### Record IDs

as follows:

(?&lt;pluginId\>[A-F0-9]{4})\-(?&lt;companionId\>[A-F0-9]{3})\-(?&lt;localFormId\>[A-F0-9]{6}\|XFE[A-F0-9]{3})


<!-- ## Scripts

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

 -->