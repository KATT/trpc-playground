import type {
  AnyLink,
  CallOptions,
  TRPCClient,
  TRPCLink,
  Type,
} from './core.ts';

/** D-A: curried. `createTRPCClient<AppRouter>()({ links })` */
export declare function createClientA<TRouter>(): <
  TLinks extends readonly TRPCLink<any, TRouter>[],
>(opts: {
  links: TLinks;
}) => TRPCClient<TRouter, CallOptions<TLinks>>;

/** D-B: second generic. `createTRPCClient<AppRouter, typeof links>({ links })` */
export declare function createClientB<
  TRouter,
  TLinks extends readonly AnyLink[] = readonly AnyLink[],
>(opts: { links: TLinks }): TRPCClient<TRouter, CallOptions<TLinks>>;

/** D-C: router inferred from a value. `createTRPCClient({ router: type<AppRouter>(), links })` */
export declare function createClientC<
  TRouter,
  TLinks extends readonly TRPCLink<any, TRouter>[],
>(opts: {
  router: Type<TRouter>;
  links: TLinks;
}): TRPCClient<TRouter, CallOptions<TLinks>>;

/** D-E: return-type annotation (oRPC). `const c: TRPCClient<AppRouter, CallOptions<typeof links>> = createTRPCClient({ links })` */
export declare function createClientE<TClient>(opts: {
  links: readonly AnyLink[];
}): TClient;

/**
 * D-E, checked: `TClient` is inferred from the annotation (return-type
 * inference), `TLinks` from the argument, and `links` is rejected when the
 * annotation declares options no installed link provides.
 */
export declare function createClientEChecked<
  TClient extends TRPCClient<any, any>,
  const TLinks extends readonly AnyLink[] = readonly AnyLink[],
>(opts: {
  links: TLinks & MissingLinkOptions<TLinks, NonNullable<TClient['~opts']>>;
}): TClient;

type MissingLinkOptions<TLinks extends readonly AnyLink[], TOpts> = [
  Exclude<keyof TOpts, keyof CallOptions<TLinks>>,
] extends [never]
  ? unknown
  : { '~missingLinkOptions': Exclude<keyof TOpts, keyof CallOptions<TLinks>> };
