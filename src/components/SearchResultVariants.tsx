import { ProductRow } from "../types";

export default function SearchResultVariants({ row }: ProductRow) {
  return (
    <pre style={{ fontSize: "10px" }}>
      <code>{JSON.stringify(row.original, null, 2)}</code>
    </pre>
  );
}
