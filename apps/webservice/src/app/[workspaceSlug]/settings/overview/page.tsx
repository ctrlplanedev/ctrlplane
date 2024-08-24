import Link from "next/link";
import { TbBook, TbChevronRight, TbTextCaption } from "react-icons/tb";

export default function OverviewPage() {
  return (
    <div className="container mx-auto space-y-6 p-8">
      <div className="space-y-1">
        <h3 className="text-2xl">Workspace</h3>
        <p className="text-sm text-muted-foreground">
          Manage your workspace settings.
        </p>
      </div>
      <div className="border-b" />
      <div className="space-y-4">
        <h4 className="text-lg">Go further</h4>
        <div className="grid grid-cols-4 gap-6 text-sm">
          <Link
            href="https://docs.ctrlplane.dev"
            className="flex items-center gap-3 rounded-md border p-4 hover:border-neutral-600"
          >
            <div className="flex flex-grow gap-3">
              <TbBook className="h-5 w-5 text-purple-400" />
              <div>
                <div>Start guide</div>
                <div className="text-muted-foreground">
                  Quick tips for beginners
                </div>
              </div>
            </div>
            <TbChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
          <Link
            href="https://docs.ctrlplane.dev/glossary"
            className="flex items-center gap-3 rounded-md border p-4 hover:border-neutral-600"
          >
            <div className="flex flex-grow gap-3">
              <TbTextCaption className="h-5 w-5 text-purple-400" />
              <div>
                <div>Glossary</div>
                <div className="text-muted-foreground">
                  Learn what each term means.
                </div>
              </div>
            </div>
            <TbChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  );
}
