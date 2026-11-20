const UNIT_CLASS_NAME = (roleSuffix: string) => [
  {filter: {match: false, regex: "Errors$"}, format: ["PascalCase"], selector: "class", suffix: [roleSuffix]}
];

export const ROLE_NAMES = {
  "**/*.controller.ts": UNIT_CLASS_NAME("Controller"),
  "**/*.domainService.ts": UNIT_CLASS_NAME("DomainService"),
  "**/*.dto.ts": [
    {format: ["PascalCase"], selector: ["typeAlias", "interface"], suffix: ["Dto"]},
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["DtoSchema"]}
  ],
  "**/*.entity.ts": [{format: ["PascalCase"], selector: "class", suffix: ["Entity"]}],
  "**/*.errorMessage.ts": UNIT_CLASS_NAME("ErrorMessage"),
  "**/*.infraService.ts": UNIT_CLASS_NAME("InfraService"),
  "**/*.interface.ts": [
    {filter: {match: false, regex: "Errors$"}, format: ["PascalCase"], prefix: ["I"], selector: "class"}
  ],
  "**/*.layer.ts": [{format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["Layer"]}],
  "**/*.middleware.ts": UNIT_CLASS_NAME("Middleware"),
  "**/*.model.ts": [
    {
      filter: {match: false, regex: "^[A-Z0-9_]+$"},
      format: ["PascalCase"],
      modifiers: ["exported"],
      selector: "variable",
      suffix: ["Model"]
    }
  ],
  "**/*.repository.ts": UNIT_CLASS_NAME("Repository"),
  "**/*.service.ts": UNIT_CLASS_NAME("Service"),
  "**/*.transformer.ts": UNIT_CLASS_NAME("Transformer"),
  "**/*.utils.ts": UNIT_CLASS_NAME("Utils"),
  // An enum value object's values go out as an UPPER_CASE constant beside its schema (AGENT_STATUSES).
  "**/*.valueObject.ts": [
    {format: ["PascalCase"], selector: ["typeAlias", "interface"], suffix: ["ValueObject"]},
    {
      filter: {match: true, regex: "^(?![A-Z0-9_]+$)[A-Z]"},
      format: ["PascalCase"],
      modifiers: ["exported"],
      selector: "variable",
      suffix: ["ValueObjectSchema"]
    }
  ],
  "**/*.view.ts": UNIT_CLASS_NAME("View"),
  "infrastructure/config/*.config.ts": UNIT_CLASS_NAME("Config")
};
