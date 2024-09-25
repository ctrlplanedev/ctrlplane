import { SiAmazon, SiGooglecloud } from "@icons-pack/react-simple-icons";
import {
  IconApi,
  IconBrandAzure,
  IconCaretDownFilled,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

export const TargetProviderSelectCard: React.FC<{
  setValue: (v: string) => void;
}> = ({ setValue }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a target provider.</CardTitle>
        <CardDescription>
          Ctrlplane comes with builtin target providers to help you get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setValue("google")}
        >
          <SiGooglecloud />
          Google
          <IconCaretDownFilled className="text-xs text-neutral-500" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <SiAmazon />
              AWS
              <IconCaretDownFilled className="text-xs text-neutral-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem onClick={() => setValue("kubernetes-job")}>
              Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              disabled
            >
              <IconBrandAzure />
              Azure
              <IconCaretDownFilled className="text-xs text-neutral-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem>Jobs</DropdownMenuItem>
            <DropdownMenuItem>Cloud Function</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setValue("webhook")}
        >
          <IconApi />
          Custom
        </Button>
      </CardContent>
    </Card>
  );
};
