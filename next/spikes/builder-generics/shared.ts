/**
 * Types shared by every builder variant, so the only difference between the
 * variants is how builder state is threaded through the type parameters.
 */
export interface Schema<TIn, TOut = TIn> {
  '~standard': { types: { input: TIn; output: TOut } };
}
export type inferIn<T> = T extends Schema<infer I, any> ? I : never;
export type inferOut<T> = T extends Schema<any, infer O> ? O : never;
export declare function schema<T>(): Schema<T>;

export declare const unset: unique symbol;
export type Unset = typeof unset;

export type Overwrite<A, B> = Omit<A, keyof B> & B;
export type MaybePromise<T> = T | Promise<T>;

export interface MiddlewareResult<TCtx> {
  readonly '~ctx': TCtx;
}
export type Next = <T extends object = {}>(opts?: {
  ctx: T;
}) => MiddlewareResult<T>;

export type ResolverInput<TIn> = TIn extends Unset ? undefined : TIn;
export type ClientInput<TIn> = TIn extends Unset ? void : TIn;
export type MergeInput<TPrev, TNext> = TPrev extends Unset
  ? TNext
  : Overwrite<TPrev, TNext>;
