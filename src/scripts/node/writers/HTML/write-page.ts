import path from "path";
import { mkdir, writeFile } from 'node:fs/promises';
import { IllegalArgumentError } from "../../../../errors/common-errors.mjs";
import { Log } from "../../../../tools/console.js";


const HTML = (title: string, content: string, ...headTags: string[]) =>
    ['<html lang="en">',

        '<head>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover">',
        '<title>', title, '</title>',
        ...headTags,
        '</head>',

        '<body>', content, '</body>',
        
        '</html>'
    ].join('');


export async function writePage(title: string, content: string, loc: string, ...headTags: string[]) {
    if (!loc.endsWith('.html'))
        throw new IllegalArgumentError(
            "Cannot write pages other than html\n"
            + loc + " has incorrect format"
        );
    const dest = path.resolve(loc);
    await mkdir(path.dirname(dest), { recursive: true });

    const pageHtml = HTML(title, content, ...headTags);

    return writeFile(dest, pageHtml, 'utf-8')
        .then(() => Log.file(dest));
}