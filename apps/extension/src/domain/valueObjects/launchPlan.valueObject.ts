// How to start a harness's agent in a terminal: the program, its arguments, and the variables it gets on top of the
// terminal's own.
export interface LaunchPlanValueObject {
  readonly command: string;
  readonly commandArguments: readonly string[];
  readonly environmentVariables: Readonly<Record<string, string>>;
}
