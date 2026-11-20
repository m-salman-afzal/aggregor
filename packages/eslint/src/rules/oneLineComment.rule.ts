import type {AST, Rule, SourceCode} from "eslint";

type LocatedComment = {readonly loc: AST.SourceLocation} & SourceComment;

type SourceComment = ReturnType<SourceCode["getAllComments"]>[number];

// A directive is read by a tool (ESLint, TypeScript, a triple-slash reference), so it is no part of the prose around it.
const DIRECTIVE_PATTERN = /^\s*(?:eslint-|@ts-|\/\s*<)/u;

const isProse = (comment: SourceComment): comment is LocatedComment =>
  comment.loc !== null && comment.loc !== undefined && !DIRECTIVE_PATTERN.test(comment.value);

// Line comments on consecutive lines read as one comment; no-inline-comments keeps code from sitting beside either.
const isContinuingPreviousComment = (previousComment: LocatedComment | undefined, comment: LocatedComment) =>
  previousComment !== undefined && previousComment.loc.end.line + 1 === comment.loc.start.line;

export const oneLineCommentRule: Rule.RuleModule = {
  create(context) {
    return {
      "ClassDeclaration[superClass.callee.name='TaggedErrors']"(errorsClass: Rule.Node) {
        for (const comment of context.sourceCode.getCommentsInside(errorsClass))
          if (isProse(comment)) context.report({loc: comment.loc, messageId: "errorsClassComment"});
      },
      Program() {
        const proseComments = context.sourceCode.getAllComments().filter((comment) => isProse(comment));
        for (const [commentIndex, comment] of proseComments.entries()) {
          const spansLines = comment.loc.start.line !== comment.loc.end.line;
          if (spansLines || isContinuingPreviousComment(proseComments[commentIndex - 1], comment))
            context.report({loc: comment.loc, messageId: "longComment"});
        }
      }
    };
  },
  meta: {
    docs: {description: "Keep every comment to one line, and an errors class free of them."},
    messages: {
      errorsClassComment:
        "No comment inside an …Errors class: the key is the error's name, and when it is raised shows where it is " +
        "raised. Delete the comment, and rename the error if its name does not say what went wrong.",
      longComment:
        "This comment runs over more than one line. A comment is one line, kept for a hidden side effect or a " +
        "behaviour the code can't show; a longer one narrates what the names already say, and goes stale when the code " +
        "changes. Cut it to the one line a reader can't work out from the code, or delete it and rename what it explains."
    },
    schema: [],
    type: "suggestion"
  }
};
