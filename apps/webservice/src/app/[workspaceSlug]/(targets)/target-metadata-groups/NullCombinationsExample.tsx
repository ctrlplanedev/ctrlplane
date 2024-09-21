export const NullCombinationsExample = () => (
  <div className="mt-2 flex flex-col rounded-md bg-neutral-950 px-2 py-1">
    <span className="inline-flex">
      {"{"}&nbsp;
      <p className="text-red-400">"env":&nbsp;</p>
      <p className="text-neutral-500">null,&nbsp;</p>
      <p className="text-red-400">"tier":&nbsp;</p>
      <p className="text-green-400">"3"&nbsp;</p>
      {"}"}
    </span>
    <span className="inline-flex">
      {"{"}&nbsp;
      <p className="text-red-400">"env":&nbsp;</p>
      <p className="text-green-400">"dev",&nbsp;</p>
      <p className="text-red-400">"tier":&nbsp;</p>
      <p className="text-neutral-500">null&nbsp;</p>
      {"}"}
    </span>
    <span className="inline-flex">
      {"{"}&nbsp;
      <p className="text-red-400">"env":&nbsp;</p>
      <p className="text-neutral-500">null,&nbsp;</p>
      <p className="text-red-400">"tier":&nbsp;</p>
      <p className="text-neutral-500">null&nbsp;</p>
      {"}"}
    </span>
  </div>
);
