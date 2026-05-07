import * as vsc from "vscode";

// import pkg from "../package.json" with {type: "json"};
// console.log(pkg);

const activate = (ctx: vsc.ExtensionContext) => {
  const d1 = vsc.commands.registerCommand("qwe", () => {
    ctx.subscriptions.push(d1);
  });
};

const deactivate = () => {
  /* Empty */
};

export {activate, deactivate};
