/**
 * Editable field descriptors' configurations interface.
 *
 * This interface serves as a type safety net for the rest of the related script.
 */
interface EditableTypeConfig {
    checklist: { options: string[]; };
    list: { options: string[]; };
    url: {};
    paragraph: {};
    line: {};
    value: { min: number; max: number; };
    int: { min: number; max: number; };
    check: {};
}

export type editableType = keyof EditableTypeConfig;
export type editableConfig<E extends editableType = editableType> = EditableTypeConfig[E];
