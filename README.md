# Node Enviroment Setup

Documenting Node setup steps for WordPress integration

## Dependencies

- [x] tsx
- [x] glob
- [ ] sharp
- [ ] csv-parse

## Node Setup

- [x] TS + manifest.json parallel creation
- [ ] Sync Scripts Folder Structure Creation

> ```php
> node/ ## won't be shipped; needed for JSON data creation, MUST NOT use document
> ├── types/ ## type validation for spreadsheet data
> |   ├── ☐ mods-compendium-types.ts // needs to be imported from zod
> |   └── ☐ enchantments-types.ts
> ├── csv/ ## csv management
> |   ├── ☒ fetch-sheet-as-csv.ts
> |   ├── ☒ fetch-sheet-as-structured-data.ts ## dependency to csv-parse module
> |   └── ☒ normalize-cells.ts
> ├── fs/ ## file writing management
> |   ├── ☒ write-structured-data-as-json.ts ## dataset to json written at given directory
> ├── path-finders/
> |   ├── ☐ extract-scripts-paths.ts ## glob => post-transpile script paths {fileName: filePath}
> |   ├── ☐ extract-images-structured-paths.ts ## glob => assets paths { imDir: {
> |   *         # distinguishes                                           imName: imPath
> |                                                                  }        }
> └── sharp/ ## dependency on guess what
>     ├── *
>     *
> ## Hashing somewhere
> ```

## Sync Area Setup

> ```php
> sync/ ## Will be shipped; MUST NOT use node scripts
> ├── scripts/
> |   ├── common/
> |   |   ├── modal/
> |   |   |   ├── modal.ts # a main class that deals with backdrop, main toggles and focus traps
> |   |   |   └── mobile-handle.ts # adds handle on mobile to close modal
> |   |   ├── dropdown.ts
> |   |   ├── 
> |   |   |   └── 
> |   |   |    
> |   |   ├── 
> |   ├── mods-compendium/
> |   |   ├── mods.ts
> |   |   ├── filters.ts
> |   |   ├── checklist.ts
> |   ├── enchantments/
> |   |   ├── enchantments.ts
> |   |   ├── filters.ts
> ```

## Assets

> ```php
> assets/ ## will be optimized, but not shipped (served through build json)
> ├── sprites/
> ├── mods-compendium/
> ├── enchantments/
> ```

## Static Data

> ```
> data/
> ├── companion-datasheets.json
> ├── companion-static-ids.json
> *
> ```

## Main Pipeline Entrypoint

> ```php
> main.mjs ## called at end build to write files and manifest
> ```

