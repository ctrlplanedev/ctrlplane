import { createContext, forwardRef, useContext, useState } from "react";
import { IconLoader2, IconX } from "@tabler/icons-react";
import { useKey } from "react-use";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";

type CommandPromptContextType = {
  isLoading: boolean;
  promptText: string;
  setPromptText: (text: string) => void;
  onClose?: () => void;
};

const CommandPromptContext = createContext<
  CommandPromptContextType | undefined
>(undefined);

export const CommandPromptInput = forwardRef<
  HTMLInputElement,
  {
    placeholder?: string;
    className?: string;
  }
>(({ placeholder, className }, ref) => {
  const context = useContext(CommandPromptContext);
  return (
    <input
      ref={ref}
      value={context?.promptText ?? ""}
      onChange={(e) => context?.setPromptText(e.target.value)}
      placeholder={placeholder ?? "Command instructions..."}
      className={cn(
        "block w-full rounded-md border-none bg-transparent p-1 text-xs outline-none placeholder:text-neutral-400",
        className,
      )}
    />
  );
});

export const CommandPromptForm: React.FC<{
  onSubmit: (prompt: string) => void;
  children?: React.ReactNode;
}> = ({ onSubmit, children }) => {
  return (
    <form onSubmit={(e) => onSubmit(e.currentTarget.prompt.value)}>
      {children}
    </form>
  );
};

export const CommandFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn("m-2 flex items-center", className)}>{children}</div>
  );
};

export const CommandPromptHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn("m-2 flex items-center justify-between", className)}>
      {children}
    </div>
  );
};

export const CommandPromptCloseButton: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({ className, children }) => {
  const context = useContext(CommandPromptContext);
  return (
    <button
      className={cn("absolute right-2 top-2 hover:text-white", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        context?.onClose?.();
      }}
    >
      {children ?? <IconX className="h-3 w-3 text-neutral-500" />}
    </button>
  );
};

export const CommandPromptSubmitButton: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const context = useContext(CommandPromptContext);
  if (context?.promptText.length === 0)
    return (
      <div className={cn("h-4 text-[0.02em] text-neutral-500", className)}>
        Esc to close
      </div>
    );

  return (
    <Button
      className={cn("m-0 h-4 px-1 text-[0.02em]", className)}
      type="submit"
    >
      {children ?? "Submit"}
    </Button>
  );
};

export const CommandPromptLoader: React.FC<{ className?: string }> = ({
  className,
}) => {
  const context = useContext(CommandPromptContext);
  if (!context?.isLoading) return null;
  return (
    <IconLoader2
      className={cn("h-4 w-4 animate-spin text-blue-200", className)}
    />
  );
};

export const CommandPrompt: React.FC<{
  children?: React.ReactNode;
  className?: string;
  onClose?: () => void;
  onOpen?: () => void;
  isLoading?: boolean;
}> = ({ children, className, isLoading, onClose, onOpen }) => {
  useKey("Escape", (e) => {
    e.preventDefault();
    onClose?.();
  });

  useKey("k", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) onOpen?.();
  });

  const [promptText, setPromptText] = useState("");
  return (
    <CommandPromptContext.Provider
      value={{
        isLoading: isLoading ?? false,
        promptText,
        setPromptText,
        onClose,
      }}
    >
      <div
        className={cn(
          "relative w-[550px] rounded-lg border border-neutral-700 bg-black/20 drop-shadow-2xl backdrop-blur-sm",
          className,
        )}
      >
        {children}
      </div>
    </CommandPromptContext.Provider>
  );
};
