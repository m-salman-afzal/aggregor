import {TRACE_LOGGING} from "@pkg/constants/src/app.constant.ts";
import {Effect, MutableRef, Predicate, References, Stream} from "effect";

type CallerAnnotations = MutableRef.MutableRef<SpanAnnotations | undefined>;

type SpanAnnotations = Readonly<Record<string, unknown>>;

// These combinators wrap every call into a unit, so they stay plain functions: a span of their own would show in every trace.

// A tagged error or an exit is an effect too, but it is a value passed around, not work that makes spans.
// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
const isEffectToRun = (maybeEffect: unknown) =>
  Effect.isEffect(maybeEffect) && !Predicate.hasProperty(maybeEffect, "_tag");

// Runs when the call starts, so the caller's annotations are known before the unit runs any work it was handed.
// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
const markOwner = (owner: string, callerAnnotations: CallerAnnotations) => (spanAnnotations: SpanAnnotations) => {
  MutableRef.set(callerAnnotations, spanAnnotations);

  return {...spanAnnotations, [TRACE_LOGGING.SPAN_OWNER_ATTRIBUTE]: owner};
};

// An Effect.fn that builds a stream hands it back as its result, and whoever runs that stream is another unit.
// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
const markOwnedResult = (owner: string, callerAnnotations: CallerAnnotations) => (ownedResult: unknown) =>
  Stream.isStream(ownedResult)
    ? Stream.updateService(ownedResult, References.TracerSpanAnnotations, markOwner(owner, callerAnnotations))
    : ownedResult;

// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
const markOwnedValue = (owner: string, callerAnnotations: CallerAnnotations, ownedValue: unknown) => {
  if (Effect.isEffect(ownedValue) && isEffectToRun(ownedValue))
    return Effect.map(
      Effect.updateService(ownedValue, References.TracerSpanAnnotations, markOwner(owner, callerAnnotations)),
      markOwnedResult(owner, callerAnnotations)
    );
  if (Stream.isStream(ownedValue))
    return Stream.updateService(ownedValue, References.TracerSpanAnnotations, markOwner(owner, callerAnnotations));

  return ownedValue;
};

// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
const restoreCallerAnnotations = (callerAnnotations: CallerAnnotations) => (unitAnnotations: SpanAnnotations) => {
  const annotationsAtCall = MutableRef.get(callerAnnotations);

  return annotationsAtCall === undefined ? unitAnnotations : annotationsAtCall;
};

// An effect, a stream or a callback handed to a unit is the caller's work, so its spans keep the caller's owner.
// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
const keepCallerAnnotations = (callerAnnotations: CallerAnnotations, handedValue: unknown): unknown => {
  // A class is a function too, so the proxy changes only what calling it returns.
  if (Predicate.isFunction(handedValue))
    return new Proxy(handedValue, {
      apply: (handedCallback, thisArgument: unknown, callbackArguments: readonly unknown[]) =>
        keepCallerAnnotations(callerAnnotations, Reflect.apply(handedCallback, thisArgument, callbackArguments))
    });
  if (Effect.isEffect(handedValue) && isEffectToRun(handedValue))
    return Effect.updateService(
      handedValue,
      References.TracerSpanAnnotations,
      restoreCallerAnnotations(callerAnnotations)
    );
  if (Stream.isStream(handedValue))
    return Stream.updateService(
      handedValue,
      References.TracerSpanAnnotations,
      restoreCallerAnnotations(callerAnnotations)
    );

  return handedValue;
};

// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
const markOwnedMember = (owner: string, unitMembers: object, unitMember: unknown) =>
  Predicate.isFunction(unitMember)
    ? (...memberArguments: readonly unknown[]) => {
        const callerAnnotations: CallerAnnotations = MutableRef.make(undefined);
        const handedArguments = memberArguments.map((memberArgument) =>
          keepCallerAnnotations(callerAnnotations, memberArgument)
        );

        return markOwnedValue(owner, callerAnnotations, Reflect.apply(unitMember, unitMembers, handedArguments));
      }
    : markOwnedValue(owner, MutableRef.make(undefined), unitMember);

// eslint-disable-next-line no-restricted-syntax -- wraps every call into a unit, so a span of its own would show in every trace
export const ownSpans = <UnitMembers, MakeError, MakeRequirements>(
  owner: string,
  makeUnitMembers: Effect.Effect<UnitMembers, MakeError, MakeRequirements>
) =>
  Effect.map(
    Effect.annotateSpans(makeUnitMembers, TRACE_LOGGING.SPAN_OWNER_ATTRIBUTE, owner),
    // A view's make returns nothing to call, so only its own spans carry the owner.
    (unitMembers) =>
      Predicate.isObject(unitMembers)
        ? new Proxy(unitMembers, {
            get: (proxiedMembers, memberName, receiver) =>
              markOwnedMember(owner, proxiedMembers, Reflect.get(proxiedMembers, memberName, receiver))
          })
        : unitMembers
  );
