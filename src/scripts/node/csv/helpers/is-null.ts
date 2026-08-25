
const nuller = /^(?:[\s]*|.*(?<![\w&^.])null(?![\w&^.]).*)$/i

export function isNull(value: string): boolean {
    return nuller.test(value);
}