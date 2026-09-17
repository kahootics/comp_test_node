import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { BundlersRegistry } from '../bundlers/bundlers-registry.js';
import { DataBaseRegistry } from '../db/data-base.js';
import { EditableFieldDescriptor } from '../db/editables/editable-field.js';
import { RowsBuilder } from '../views/rows-builder.js';
import { NotFoundError, IllegalArgumentError, ValidationError, IllegalAccessError } from '../../../errors/common-errors.mjs';

const app = express();
const PORT = 3000;

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Log } from '../../../tools/console.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve i file statici (index.html, client.js, css) dalla cartella public

export function run() 
{// edit a record

app.use(express.static(path.join('dist')));

app.patch('/db/:type/records', () => { });
// import csv
app.post('/db/:type/import', () => { })


app.get('/db/:type/records', async (req, res, next) => {
    try {
        const db = DataBaseRegistry.get(req.params.type);
        await db.ready;

        const editableDescriptors = (await EditableFieldDescriptor.getAllOrInit(db.type))
            .filter(d => !d.deprecated);

        const builder = new RowsBuilder(
            db.type,
            db.dataShape,
            db.derivedShape,
            editableDescriptors,
            true
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.write('<table><thead>' + builder.getHeaderRow() + '</thead><tbody>');
        for await (const record of db.streamFlatRecords()) {
            for (const row of builder.makeRows(record)) res.write(row);
        }
        res.write('</tbody></table>');
        res.end();
    } catch (err) { next(err); }
});

app.get('/db/views/:name', async (req, res, next) => {
    try {
        console.log('received')
        const bundler = await BundlersRegistry.get(req.params.name);
        console.log('boundler obtained')
        const outputDb = DataBaseRegistry.get(bundler.outputType);
        console.log('db obtained')
        await outputDb.ready;

        console.log('ready')

        const editableDescriptors = (await EditableFieldDescriptor.getAllOrInit(outputDb.type))
            .filter(d => !d.deprecated);

        const builder = new RowsBuilder(
            outputDb.type,
            outputDb.dataShape,
            outputDb.derivedShape,
            editableDescriptors
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.write('<table><thead>' + builder.getHeaderRow() + '</thead><tbody>');
        for await (const record of bundler.run()) {
            for (const row of builder.makeRows(record)) res.write(row);
        }
        res.write('</tbody></table>');
        res.end();
    } catch (err) { next(err); }
});



app.use((err: Error, req: Request, res: Response, next: NextFunction) => {    
    if (err instanceof NotFoundError) 
        return res.status(404).send(err.message);
    if (err instanceof IllegalArgumentError || err instanceof ValidationError) 
        return res.status(400).send(err.message);
    if (err instanceof IllegalAccessError) 
        return res.status(403).send(err.message);
    res.status(500).send('Internal Error');
    console.error(err);
});


app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});

}