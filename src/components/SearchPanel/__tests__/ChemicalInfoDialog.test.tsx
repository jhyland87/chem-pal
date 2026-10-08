import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string, subs?: string[]) => (subs?.length ? `${key}:${subs.join(',')}` : key),
}));

const useChemicalInfo = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useChemicalInfo', () => ({ useChemicalInfo }));

import type { ChemicalInfo } from '@/hooks/useChemicalInfo';
import { ChemicalInfoDialog } from '../ChemicalInfoDialog';

/** A minimal loaded result; tests override what they care about. */
function makeInfo(overrides: Partial<ChemicalInfo> = {}): ChemicalInfo {
  return {
    term: 'acetone',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/acetone',
    synonyms: [],
    imageUrls: [],
    cid: 180 as PubChemCID,
    ...overrides,
  };
}

const FULL = makeInfo({
  cid: 180 as PubChemCID,
  cas: '67-64-1',
  pubchemUrl: 'https://pubchem/180',
  nistUrl: 'https://nist/67641',
  imageUrls: ['https://img/a.png', 'https://img/b.png'],
  synonyms: ['acetone', '2-propanone'],
  properties: {
    title: 'Acetone',
    iupacName: 'propan-2-one',
    molecularFormula: 'C3H6O',
    molecularWeight: '58.08',
    smiles: 'CC(=O)C',
    inchiKey: 'XYZ-INCHI-VALUE',
    xLogP: -0.2,
    tpsa: 17.1,
  },
  description: { description: 'A common solvent.' },
  solubility: ['miscible', 'in water'],
  ghs: {
    pictograms: [{ code: 'GHS02', label: 'Flammable', url: 'https://ghs/02.png' }],
    signal: 'Danger',
    hazardStatements: ['H225: Highly flammable'],
  },
  osha: {
    name: 'ACETONE',
    synonyms: ['dimethyl ketone'],
    physicalDescription: 'Colorless liquid',
    boilingPoint: '133°F',
    freezingPoint: '-137°F',
    flashPoint: '0°F',
    vaporPressure: '180 mmHg',
    specificGravity: '0.79',
    nfpaHealth: '1',
    nfpaFire: '3',
    nfpaReactivity: '0',
    pelTwa: '1000 ppm',
    relTwa: '250 ppm',
    tlvTwa: '500 ppm',
    idlh: '2500 ppm',
    carcinogen: 'No',
    cameoUrl: 'https://cameo/1',
    nioshPocketGuideUrl: 'https://niosh/1',
  },
});

const renderDialog = (term: string | undefined, onClose = vi.fn()) =>
  render(<ChemicalInfoDialog term={term} onClose={onClose} />);

beforeEach(() => {
  useChemicalInfo.mockReset();
  useChemicalInfo.mockReturnValue({ info: undefined, loading: false });
});

describe('ChemicalInfoDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog(undefined);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useChemicalInfo).toHaveBeenCalledWith(undefined);
  });

  it.each([
    ['loading', { info: FULL, loading: true }],
    ['info is not there yet', { info: undefined, loading: false }],
  ])('shows the spinner while %s', (_label, state) => {
    useChemicalInfo.mockReturnValue(state);
    renderDialog('acetone');

    expect(screen.getByText('chem_info_loading')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('chem_info_sources')).not.toBeInTheDocument();
  });

  it('shows the searched term as the title until data arrives', () => {
    renderDialog('zoutzuur');
    expect(screen.getByRole('dialog', { name: /zoutzuur/ })).toBeInTheDocument();
  });

  it.each([
    [
      'PubChem title',
      makeInfo({ properties: { title: 'Acetone' }, osha: { name: 'ACETONE', synonyms: [] } }),
      'Acetone',
    ],
    ['OSHA name', makeInfo({ osha: { name: 'ACETONE', synonyms: [] } }), 'ACETONE'],
    ['the term', makeInfo(), 'acetone'],
  ])('titles the dialog with the %s', (_label, info, title) => {
    useChemicalInfo.mockReturnValue({ info, loading: false });
    renderDialog('acetone');
    expect(screen.getByRole('dialog', { name: new RegExp(title) })).toBeInTheDocument();
  });

  it('says so when neither OSHA nor PubChem knows the chemical', () => {
    useChemicalInfo.mockReturnValue({
      info: makeInfo({ cid: undefined, osha: undefined }),
      loading: false,
    });
    renderDialog('acetone');

    expect(screen.getByText('chem_info_not_found')).toBeInTheDocument();
    expect(screen.queryByText('chem_info_sources')).not.toBeInTheDocument();
  });

  it('shows identifiers, description, properties, hazards and exposure limits', () => {
    useChemicalInfo.mockReturnValue({ info: FULL, loading: false });
    renderDialog('acetone');

    for (const text of [
      'propan-2-one',
      '67-64-1',
      'C3H6O',
      '58.08 g/mol',
      'CC(=O)C',
      'XYZ-INCHI-VALUE',
      'acetone; 2-propanone',
      'A common solvent.',
      'Colorless liquid',
      '133°F',
      '-137°F',
      '0°F',
      '180 mmHg',
      '0.79',
      'miscible; in water',
      '-0.2',
      '17.1 Å²',
      'Danger',
      'H225: Highly flammable',
      'chem_info_sources',
    ]) {
      expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
    }
    for (const row of [
      'OSHA PEL: 1000 ppm',
      'NIOSH REL: 250 ppm',
      'ACGIH TLV: 500 ppm',
      'IDLH: 2500 ppm',
    ]) {
      expect(
        screen.getByText(row.split(':')[0] + ':', { exact: false }).closest('p'),
      ).toHaveTextContent(row);
    }
    expect(
      screen.getByRole('img', { name: /NFPA 704: health 1, fire 3, reactivity 0/ }),
    ).toBeInTheDocument();
    expect(screen.getByAltText('Flammable')).toHaveAttribute('src', 'https://ghs/02.png');
    expect(screen.getByAltText('acetone')).toHaveAttribute('src', 'https://img/a.png');
  });

  it('falls back to the OSHA formula, weight and synonyms when PubChem has none', () => {
    useChemicalInfo.mockReturnValue({
      info: makeInfo({
        cid: undefined,
        osha: {
          name: 'ACETONE',
          formula: 'C₃H₆O',
          molecularWeight: '58.1',
          synonyms: ['dimethyl ketone'],
        },
      }),
      loading: false,
    });
    renderDialog('acetone');

    expect(screen.getByText('C₃H₆O', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('58.1 g/mol', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('dimethyl ketone', { exact: false })).toBeInTheDocument();
  });

  it('shows at most twelve synonyms', () => {
    const synonyms = Array.from({ length: 15 }, (_, i) => `syn${i}`);
    useChemicalInfo.mockReturnValue({ info: makeInfo({ synonyms }), loading: false });
    renderDialog('acetone');

    const row = screen.getByText('syn0', { exact: false });
    expect(row).toHaveTextContent('syn11');
    expect(row).not.toHaveTextContent('syn12');
  });

  it('omits the hazards section when there is no NFPA or GHS data', () => {
    useChemicalInfo.mockReturnValue({ info: makeInfo(), loading: false });
    renderDialog('acetone');

    expect(screen.queryByText('chem_info_hazards')).not.toBeInTheDocument();
    expect(screen.queryByText('chem_info_exposure')).not.toBeInTheDocument();
  });

  it('shows GHS without an NFPA diamond when OSHA has no ratings', () => {
    useChemicalInfo.mockReturnValue({
      info: makeInfo({ ghs: FULL.ghs }),
      loading: false,
    });
    renderDialog('acetone');

    expect(screen.getByText('chem_info_hazards')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /NFPA 704/ })).not.toBeInTheDocument();
  });

  it('links to every source that has a URL', () => {
    useChemicalInfo.mockReturnValue({ info: FULL, loading: false });
    renderDialog('acetone');

    const hrefs = Object.fromEntries(
      [
        'chem_info_pubchem_link',
        'chem_info_wikipedia_link',
        'chem_info_nist_link',
        'chem_info_cameo_link',
        'chem_info_niosh_link',
      ].map((label) => [label, screen.getByRole('link', { name: label })]),
    );
    expect(hrefs.chem_info_pubchem_link).toHaveAttribute('href', 'https://pubchem/180');
    expect(hrefs.chem_info_nist_link).toHaveAttribute('href', 'https://nist/67641');
    expect(hrefs.chem_info_cameo_link).toHaveAttribute('href', 'https://cameo/1');
    expect(hrefs.chem_info_niosh_link).toHaveAttribute('href', 'https://niosh/1');
    expect(hrefs.chem_info_wikipedia_link).toHaveAttribute('target', '_blank');
  });

  it('only links Wikipedia when nothing else is known', () => {
    useChemicalInfo.mockReturnValue({ info: makeInfo(), loading: false });
    renderDialog('acetone');

    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('shows no links before data arrives', () => {
    renderDialog('acetone');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('swaps a favicon for the generic glyph when it fails to load', () => {
    useChemicalInfo.mockReturnValue({ info: makeInfo(), loading: false });
    renderDialog('acetone');

    const link = screen.getByRole('link', { name: 'chem_info_wikipedia_link' });
    fireEvent.error(link.querySelector('img') as HTMLImageElement);

    expect(link.querySelector('img')).toBeNull();
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('tries the next structure image when one fails, and shows none when all fail', () => {
    useChemicalInfo.mockReturnValue({ info: FULL, loading: false });
    renderDialog('acetone');

    fireEvent.error(screen.getByAltText('acetone'));
    expect(screen.getByAltText('acetone')).toHaveAttribute('src', 'https://img/b.png');

    fireEvent.error(screen.getByAltText('acetone'));
    expect(screen.queryByAltText('acetone')).not.toBeInTheDocument();
  });

  it('closes from the close button and the footer button', () => {
    useChemicalInfo.mockReturnValue({ info: FULL, loading: false });
    const onClose = vi.fn();
    renderDialog('acetone', onClose);

    for (const button of screen.getAllByRole('button', { name: 'chem_info_close' })) {
      fireEvent.click(button);
    }
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
