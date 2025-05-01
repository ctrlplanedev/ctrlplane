import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

export const SystemHeaderSkeleton: React.FC = () => (
  <div className="flex w-full items-center justify-between">
    <Skeleton className="h-6 w-48 rounded-full" />
    <div className="flex items-center gap-2">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  </div>
);

export const SystemTableSkeleton: React.FC = () => (
  <div className="overflow-hidden rounded-md border">
    <Table className="w-full min-w-max rounded-md bg-background">
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[350px] rounded-tl-md py-4 pl-6">
            <Skeleton className="h-4 w-40 rounded-full" />
          </TableHead>
          {[...Array(3)].map((_, i) => (
            <TableHead key={i} className="w-[220px]">
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableHead>
          ))}
          <TableCell className="flex-grow" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(2)].map((_, i) => (
          <TableRow key={i} className="border-0 hover:bg-transparent">
            <TableCell className="h-[70px] w-[350px] max-w-[300px] pl-6">
              <Skeleton className="h-4 w-40 rounded-full" />
            </TableCell>
            {[...Array(3)].map((_, j) => (
              <TableCell key={j} className="h-[70px] w-[220px]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-20 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                </div>
              </TableCell>
            ))}
            <TableCell className="flex-grow" />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

type SystemDeploymentSkeletonProps = {
  header?: React.ReactNode;
  table?: React.ReactNode;
};
export const SystemDeploymentSkeleton: React.FC<
  SystemDeploymentSkeletonProps
> = ({ header, table }) => (
  <div className="space-y-4">
    {header}
    {table}
  </div>
);
