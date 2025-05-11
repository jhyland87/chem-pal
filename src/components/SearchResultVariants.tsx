import { Row } from '@tanstack/react-table'

import { Person } from '../makeData'

type SearchResultVariantsProps = {
  row: Row<Person>
}

export default function SearchResultVariants({ row }: SearchResultVariantsProps) {
  return (
    <pre style={{ fontSize: '10px' }}>
      <code>{JSON.stringify(row.original, null, 2)}</code>
    </pre>
  )
}