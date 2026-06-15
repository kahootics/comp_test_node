
import {z} from 'zod';
import c from './record-type.js';

const PLUGIN = z.object({
    compPluginId: c.compPluginId(),
    formIdPrefix: c.formIdPrefix(),
    pluginType: z.string().toLowerCase().length(3),
    name: z.string().nonempty(),
    versions: z.array(z.string()),
    mod: z.object({
        name: z.string().nonempty(),
        versions: z.array(z.string())
    }),


})