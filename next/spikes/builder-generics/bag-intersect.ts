/**
 * G-A: one options-bag type parameter; each method returns
 * `ProcedureBuilder<Omit<TDef, keyof Patch> & Patch>` (the #6027 shape).
 */
import type {
  ClientInput,
  inferIn,
  inferOut,
  MaybePromise,
  MergeInput,
  MiddlewareResult,
  Next,
  Overwrite,
  ResolverInput,
  Schema,
  Unset,
} from './shared.ts';

export interface BuilderDef {
  ctx: object;
  meta: object;
  ctxOverrides: object;
  inputIn: unknown;
  inputOut: unknown;
  outputIn: unknown;
  outputOut: unknown;
  errors: unknown;
}

export interface ProcedureDef {
  type: 'query' | 'mutation';
  input: unknown;
  output: unknown;
  errors: unknown;
}

export interface Procedure<TDef extends ProcedureDef> {
  '~trpc': TDef;
}

type Patch<TDef, TPatch> = Omit<TDef, keyof TPatch> & TPatch;
type Ctx<TDef extends BuilderDef> = Overwrite<
  TDef['ctx'],
  TDef['ctxOverrides']
>;
type Out<TDef extends BuilderDef, $Output> = TDef['outputIn'] extends Unset
  ? $Output
  : TDef['outputOut'];

export interface ProcedureBuilder<TDef extends BuilderDef> {
  input<$Schema extends Schema<any, any>>(
    schema: $Schema,
  ): ProcedureBuilder<
    Patch<
      TDef,
      {
        inputIn: MergeInput<TDef['inputIn'], inferIn<$Schema>>;
        inputOut: MergeInput<TDef['inputOut'], inferOut<$Schema>>;
      }
    >
  >;
  output<$Schema extends Schema<any, any>>(
    schema: $Schema,
  ): ProcedureBuilder<
    Patch<TDef, { outputIn: inferIn<$Schema>; outputOut: inferOut<$Schema> }>
  >;
  meta(meta: TDef['meta']): ProcedureBuilder<TDef>;
  use<$CtxOut extends object>(
    fn: (opts: {
      ctx: Ctx<TDef>;
      meta: TDef['meta'] | undefined;
      next: Next;
    }) => MaybePromise<MiddlewareResult<$CtxOut>>,
  ): ProcedureBuilder<
    Patch<TDef, { ctxOverrides: Overwrite<TDef['ctxOverrides'], $CtxOut> }>
  >;
  query<$Output>(
    resolver: (opts: {
      ctx: Ctx<TDef>;
      input: ResolverInput<TDef['inputOut']>;
    }) => MaybePromise<Out<TDef, $Output>>,
  ): Procedure<{
    type: 'query';
    input: ClientInput<TDef['inputIn']>;
    output: Out<TDef, $Output>;
    errors: TDef['errors'];
  }>;
  mutation<$Output>(
    resolver: (opts: {
      ctx: Ctx<TDef>;
      input: ResolverInput<TDef['inputOut']>;
    }) => MaybePromise<Out<TDef, $Output>>,
  ): Procedure<{
    type: 'mutation';
    input: ClientInput<TDef['inputIn']>;
    output: Out<TDef, $Output>;
    errors: TDef['errors'];
  }>;
}

export declare function init<TOpts extends { ctx: object; meta: object }>(): {
  procedure: ProcedureBuilder<{
    ctx: TOpts['ctx'];
    meta: TOpts['meta'];
    ctxOverrides: object;
    inputIn: Unset;
    inputOut: Unset;
    outputIn: Unset;
    outputOut: Unset;
    errors: never;
  }>;
};

export type DecorateRouter<T> = {
  [K in keyof T]: T[K] extends Procedure<infer TDef>
    ? TDef['type'] extends 'query'
      ? { query(input: TDef['input']): Promise<Awaited<TDef['output']>> }
      : { mutate(input: TDef['input']): Promise<Awaited<TDef['output']>> }
    : DecorateRouter<T[K]>;
};
export declare function createClient<TRouter>(): DecorateRouter<TRouter>;
