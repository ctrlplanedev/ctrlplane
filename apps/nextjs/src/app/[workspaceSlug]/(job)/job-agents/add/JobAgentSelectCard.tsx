import {
  SiCircleci,
  SiGithub,
  SiGooglecloud,
  SiKubernetes,
} from "react-icons/si";
import { TbCaretDownFilled, TbWebhook } from "react-icons/tb";

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

export const JobAgentSelectCard: React.FC<{
  setValue: (v: string) => void;
}> = ({ setValue }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a job agent.</CardTitle>
        <CardDescription>
          Choose the pipeline agent you would like to connect.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <SiGithub />
              Github
              <TbCaretDownFilled className="text-xs text-neutral-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem onClick={() => setValue("github-app")}>
              Github App
            </DropdownMenuItem>
            <DropdownMenuItem>Github OAuth</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <SiKubernetes />
              Kubernetes
              <TbCaretDownFilled className="text-xs text-neutral-500" />
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
              <SiGooglecloud />
              Google
              <TbCaretDownFilled className="text-xs text-neutral-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem>Workflows</DropdownMenuItem>
            <DropdownMenuItem>Cloud Function</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" className="flex items-center gap-2" disabled>
          <SiCircleci />
          Circle CI
        </Button>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setValue("webhook")}
        >
          <TbWebhook />
          Webook
        </Button>
      </CardContent>
    </Card>
  );
};
