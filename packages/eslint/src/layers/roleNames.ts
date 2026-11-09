// Each file suffix names a role, and the file's main names carry it.
export const ROLE_NAMES = {
  "**/*.dto.ts": [
    {format: ["PascalCase"], selector: ["typeAlias", "interface"], suffix: ["Dto"]},
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["DtoSchema"]}
  ],
  "**/*.entity.ts": [{format: ["PascalCase"], selector: "class", suffix: ["Entity"]}],
  "**/*.infraService.ts": [
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["InfraService"]}
  ],
  "**/*.interface.ts": [
    {filter: {match: false, regex: "Error$"}, format: ["PascalCase"], prefix: ["I"], selector: "class"}
  ],
  "**/*.layer.ts": [{format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["Layer"]}],
  "**/*.model.ts": [
    {
      filter: {match: false, regex: "^[A-Z0-9_]+$"},
      format: ["PascalCase"],
      modifiers: ["exported"],
      selector: "variable",
      suffix: ["Model"]
    }
  ],
  "**/*.valueObject.ts": [
    {format: ["PascalCase"], selector: ["typeAlias", "interface"], suffix: ["ValueObject"]},
    {
      filter: {match: true, regex: "^[A-Z]"},
      format: ["PascalCase"],
      modifiers: ["exported"],
      selector: "variable",
      suffix: ["ValueObjectSchema"]
    }
  ],
  "**/*.view.ts": [{format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["View"]}],
  "infrastructure/config/*.config.ts": [
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["Config"]}
  ],
  // A repository's layer, or makeBaseRepository, which every repository builds on.
  "infrastructure/repositories/**/*.repository.ts": [
    {
      custom: {match: true, regex: "^(make)?[A-Z]\\w*Repository$"},
      format: null,
      modifiers: ["exported"],
      selector: "variable"
    }
  ]
};
