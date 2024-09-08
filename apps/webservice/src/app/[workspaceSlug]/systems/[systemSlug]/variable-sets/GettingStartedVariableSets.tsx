import { TbVariable } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

// import { CreateRunbookDialog } from "../../../_components/CreateRunbook";

export const VariableSetGettingStarted: React.FC = () => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <TbVariable className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Variable Sets</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Variable Sets in Ctrlplane allow you to manage and organize groups
            of variables for your system. They provide a centralized way to
            store and manage configuration values, environment variables, and
            other settings. By using Variable Sets, you can easily maintain
            different configurations for various environments or deployment
            scenarios, enhancing flexibility and reducing the risk of
            configuration errors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* <CreateVariableSetDialog systemId={systemId}> */}
          <Button size="sm">Create Variable Set</Button>
          {/* </CreateVariableSetDialog> */}
          <Button size="sm" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
