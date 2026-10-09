import superjson from 'superjson';

export const stringify = (value: unknown) => superjson.stringify(value);
export const parse = (text: string) => superjson.parse(text);
