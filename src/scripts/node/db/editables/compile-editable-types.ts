import { writeFile } from "fs/promises";
import { DBInitSchemas } from "../data-base-init.js";
import { EditableFieldDescriptor } from "./editable-field.js";
import { _buildEditablesSchema } from "./build-editables-schema.js";

export async function compileEditableTypes() {
    let output = `export interface EditablesFor {\n\n`;

    for (const dbType of Object.keys(DBInitSchemas)) {
        const descriptors = await EditableFieldDescriptor.getAllOrInit(dbType as any);
        const active = descriptors.filter(d => !d.deprecated);
        
        output += `  ${dbType}: {\n`;
        for (const d of active) {
            output += `    ${d.label}?: ${d.getTypeAsString()};\n`;
        }
        output += `  }\n\n`;

    }
    output += `}`;

    await writeFile('src/data/db/editables-types.d.ts', output, 'utf-8');

}
