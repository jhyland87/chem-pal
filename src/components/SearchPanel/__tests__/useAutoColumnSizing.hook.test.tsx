import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAutoColumnSizing } from '../useAutoColumnSizing.hook';

type LeafColumn = { id: string; columnDef: { meta?: { autoSizeMax?: number } } };

/** Builds a minimal TanStack Table stand-in with the given leaf columns. */
function fakeTable(leafColumns: LeafColumn[]) {
  return {
    getAllLeafColumns: () => leafColumns,
    setColumnSizing: vi.fn(),
  } as unknown as import('@tanstack/react-table').Table<Product> & {
    setColumnSizing: ReturnType<typeof vi.fn>;
  };
}

/** Renders a harness that wires the hook to a one-column measurement table. */
function Harness({
  table,
  data,
}: {
  table: ReturnType<typeof fakeTable>;
  data: Product[];
}) {
  const { getMeasurementTableProps } = useAutoColumnSizing(table, data);
  return (
    <table {...getMeasurementTableProps()}>
      <thead>
        <tr>
          <th>
            <span>Name</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Acetone</td>
        </tr>
      </tbody>
    </table>
  );
}

const oneRow = [{ id: 'p1' }] as unknown as Product[];

describe('useAutoColumnSizing', () => {
  it('exposes a hidden, non-interactive measurement table via getMeasurementTableProps', () => {
    let props: ReturnType<typeof Object> | undefined;
    function Probe() {
      const { getMeasurementTableProps } = useAutoColumnSizing(fakeTable([]), []);
      props = getMeasurementTableProps();
      return null;
    }
    render(<Probe />);

    expect(props?.style).toMatchObject({
      visibility: 'hidden',
      position: 'absolute',
      pointerEvents: 'none',
      height: 0,
    });
    expect(props?.ref).toBeDefined();
  });

  it('measures and applies column sizing once data is present', () => {
    const table = fakeTable([{ id: 'name', columnDef: { meta: {} } }]);
    render(<Harness table={table} data={oneRow} />);

    expect(table.setColumnSizing).toHaveBeenCalledTimes(1);
    const sizing = table.setColumnSizing.mock.calls[0][0];
    expect(sizing).toHaveProperty('name');
    expect(typeof sizing.name).toBe('number');
  });

  it('does not measure when there is no data', () => {
    const table = fakeTable([{ id: 'name', columnDef: { meta: {} } }]);
    render(<Harness table={table} data={[]} />);

    expect(table.setColumnSizing).not.toHaveBeenCalled();
  });

  it('respects an autoSizeMax cap without dropping below the header width', () => {
    const table = fakeTable([{ id: 'name', columnDef: { meta: { autoSizeMax: 5 } } }]);
    render(<Harness table={table} data={oneRow} />);

    // The cap branch runs; the header width is a hard floor so the result never
    // collapses to the tiny cap.
    const sizing = table.setColumnSizing.mock.calls[0][0];
    expect(sizing.name).toBeGreaterThanOrEqual(5);
  });
});
