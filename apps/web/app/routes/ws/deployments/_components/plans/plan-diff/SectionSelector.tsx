import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export type SectionSelectorProps = {
  sections: string[];
  value: string | undefined;
  onChange: (value: string) => void;
};

export function SectionSelector({
  sections,
  value,
  onChange,
}: SectionSelectorProps) {
  if (sections.length <= 1) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue placeholder="Section" />
      </SelectTrigger>
      <SelectContent>
        {sections.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
