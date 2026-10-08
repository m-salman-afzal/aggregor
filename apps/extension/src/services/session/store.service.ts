import {Context, Effect, Layer, SubscriptionRef} from "effect";

export interface Session {
  readonly cwd: string;
  readonly id: string;
  readonly name: string;
}

// Plain data only, so it can be persisted later. Terminal handles live in TerminalService.
export class SessionStore extends Context.Service<
  SessionStore,
  {readonly sessions: SubscriptionRef.SubscriptionRef<readonly Session[]>}
>()("aggregor/services/session/store.service/SessionStore") {
  public static readonly layer = Layer.effect(
    SessionStore,
    Effect.map(SubscriptionRef.make<readonly Session[]>([]), (sessions) => SessionStore.of({sessions}))
  );
}
