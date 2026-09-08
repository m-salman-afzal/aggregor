import type {ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes} from "react";

export function VSCodeButton({className = "", ...props}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded px-3 py-1.5 text-sm font-medium text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder)] ${className}`}
      {...props}
    />
  );
}

export function VSCodeCard({children, className = ""}: {children: React.ReactNode; className?: string}) {
  return (
    <section
      className={`rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function VSCodeSecondaryButton({className = "", ...props}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded px-3 py-1.5 text-sm font-medium text-[var(--vscode-button-secondaryForeground)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder)] ${className}`}
      {...props}
    />
  );
}

export function VSCodeTextArea({className = "", ...props}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-3 py-2 text-sm text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder)] ${className}`}
      {...props}
    />
  );
}

export function VSCodeTextField({className = "", ...props}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-3 py-2 text-sm text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder)] ${className}`}
      {...props}
    />
  );
}
