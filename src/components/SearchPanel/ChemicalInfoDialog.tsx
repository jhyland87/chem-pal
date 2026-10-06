import { NfpaDiamond } from '@/components/NfpaDiamond';
import { useChemicalInfo, type ChemicalInfo } from '@/hooks/useChemicalInfo';
import { i18n } from '@/helpers/i18n';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useState, type ReactNode } from 'react';

/** Props for {@link ChemicalInfoDialog}. */
interface ChemicalInfoDialogProps {
  /** The reagent name or CAS to show, or undefined when closed. */
  term?: string;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
}

/**
 * A labelled value row; renders nothing for empty values.
 * @param props - The row label and value.
 * @returns The row, or null.
 * @source
 */
function Row({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
      <strong>{label}:</strong> {value}
    </Typography>
  );
}

/**
 * Structure image that walks its candidate URLs, moving on when one fails to load.
 * @param props - Candidate URLs and alt text.
 * @returns The image, or null when none loads.
 * @source
 */
function StructureImage({ urls, alt }: { urls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [urls]);
  if (index >= urls.length) return null;
  return (
    <Box
      component="img"
      src={urls[index]}
      alt={alt}
      onError={() => setIndex((current) => current + 1)}
      sx={{ maxWidth: 160, maxHeight: 160, bgcolor: '#fff', borderRadius: 1, p: 0.5 }}
    />
  );
}

/**
 * A site favicon, falling back to a generic "open link" glyph if it fails to load.
 * @param props - The icon URL.
 * @returns The icon.
 * @source
 */
function LinkIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <OpenInNewIcon fontSize="small" />;
  return (
    <Box
      component="img"
      src={src}
      alt=""
      onError={() => setFailed(true)}
      sx={{ width: 20, height: 20 }}
    />
  );
}

/**
 * Body of the dialog once data has loaded.
 * @param props - The merged chemical info.
 * @returns The sections.
 * @source
 */
function ChemicalInfoBody({ info }: { info: ChemicalInfo }) {
  const { osha, properties, ghs } = info;
  const hasNfpa = [osha?.nfpaHealth, osha?.nfpaFire, osha?.nfpaReactivity].some((v) => v != null);
  const formula = properties?.molecularFormula ?? osha?.formula;
  const mass = properties?.molecularWeight ?? osha?.molecularWeight;
  const synonyms = (info.synonyms.length > 0 ? info.synonyms : (osha?.synonyms ?? [])).slice(0, 12);

  if (osha === undefined && info.cid === undefined) {
    return <Typography>{i18n('chem_info_not_found')}</Typography>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <StructureImage urls={info.imageUrls} alt={info.term} />
        <Stack spacing={0.5}>
          <Row label={i18n('chem_info_iupac')} value={properties?.iupacName} />
          <Row label={i18n('chem_info_cas')} value={info.cas} />
          <Row label={i18n('chem_info_formula')} value={formula} />
          <Row label={i18n('chem_info_mass')} value={mass ? `${mass} g/mol` : undefined} />
          <Row label={i18n('chem_info_smiles')} value={properties?.smiles} />
          <Row label={i18n('chem_info_inchikey')} value={properties?.inchiKey} />
          <Row label={i18n('chem_info_synonyms')} value={synonyms.join('; ')} />
        </Stack>
      </Stack>

      {info.description?.description && (
        <Typography variant="body2">{info.description.description}</Typography>
      )}

      <Box>
        <Typography variant="subtitle2">{i18n('chem_info_properties')}</Typography>
        <Row label={i18n('chem_info_appearance')} value={osha?.physicalDescription} />
        <Row label={i18n('chem_info_boiling')} value={osha?.boilingPoint} />
        <Row label={i18n('chem_info_melting')} value={osha?.freezingPoint} />
        <Row label={i18n('chem_info_flash')} value={osha?.flashPoint} />
        <Row label={i18n('chem_info_vapor')} value={osha?.vaporPressure} />
        <Row label={i18n('chem_info_density')} value={osha?.specificGravity} />
        <Row label={i18n('chem_info_solubility')} value={info.solubility?.join('; ')} />
        <Row label="XLogP" value={properties?.xLogP} />
        <Row
          label="TPSA"
          value={properties?.tpsa === undefined ? undefined : `${properties.tpsa} Å²`}
        />
      </Box>

      {(hasNfpa || ghs !== undefined) && (
        <Box>
          <Typography variant="subtitle2">{i18n('chem_info_hazards')}</Typography>
          <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
            {hasNfpa && (
              <NfpaDiamond
                health={osha?.nfpaHealth}
                fire={osha?.nfpaFire}
                reactivity={osha?.nfpaReactivity}
                special={osha?.nfpaSpecial}
              />
            )}
            {ghs?.pictograms.map((pictogram) => (
              <Box
                key={pictogram.code}
                component="img"
                src={pictogram.url}
                alt={pictogram.label}
                title={pictogram.label}
                sx={{ width: 64, height: 64 }}
              />
            ))}
          </Stack>
          <Row label={i18n('chem_info_signal')} value={ghs?.signal} />
          {ghs?.hazardStatements.map((statement) => (
            <Typography key={statement} variant="body2">
              {statement}
            </Typography>
          ))}
        </Box>
      )}

      {osha !== undefined && (
        <Box>
          <Typography variant="subtitle2">{i18n('chem_info_exposure')}</Typography>
          <Row label="OSHA PEL" value={osha.pelTwa} />
          <Row label="NIOSH REL" value={osha.relTwa} />
          <Row label="ACGIH TLV" value={osha.tlvTwa} />
          <Row label="IDLH" value={osha.idlh} />
          <Row label={i18n('chem_info_carcinogen')} value={osha.carcinogen} />
        </Box>
      )}

      <Typography variant="caption" color="text.secondary">
        {i18n('chem_info_sources')}
      </Typography>
    </Stack>
  );
}

/**
 * Dialog showing merged OSHA OBIS + PubChem details for a searched chemical: identifiers,
 * structure, properties, NFPA diamond, GHS pictograms and exposure limits.
 * @component
 * @category Components
 * @group Chemical Info
 * @param props - See {@link ChemicalInfoDialogProps}.
 * @returns The dialog.
 * @example
 * ```tsx
 * <ChemicalInfoDialog term="acetone" onClose={() => setTerm(undefined)} />
 * ```
 * @source
 */
export function ChemicalInfoDialog({ term, onClose }: ChemicalInfoDialogProps) {
  const { info, loading } = useChemicalInfo(term);
  const links = [
    {
      href: info?.pubchemUrl,
      label: i18n('chem_info_pubchem_link'),
      icon: 'https://pubchem.ncbi.nlm.nih.gov/favicon.ico',
    },
    {
      href: info?.wikipediaUrl,
      label: i18n('chem_info_wikipedia_link'),
      icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
    },
    {
      href: info?.nistUrl,
      label: i18n('chem_info_nist_link'),
      icon: 'https://webbook.nist.gov/favicon.ico',
    },
    {
      href: info?.osha?.cameoUrl,
      label: i18n('chem_info_cameo_link'),
      icon: 'https://cameochemicals.noaa.gov/favicon.ico',
    },
    {
      href: info?.osha?.nioshPocketGuideUrl,
      label: i18n('chem_info_niosh_link'),
      icon: 'https://www.cdc.gov/favicon.ico',
    },
  ].flatMap(({ href, label, icon }) => (href === undefined ? [] : [{ href, label, icon }]));

  return (
    <Dialog
      open={term !== undefined}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="chem-info-title"
    >
      <DialogTitle id="chem-info-title" sx={{ pr: 6 }}>
        {info?.properties?.title ?? info?.osha?.name ?? term}
        <IconButton
          aria-label={i18n('chem_info_close')}
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading || info === undefined ? (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={28} />
            <Typography variant="body2">{i18n('chem_info_loading')}</Typography>
          </Stack>
        ) : (
          <ChemicalInfoBody info={info} />
        )}
      </DialogContent>
      <DialogActions>
        {links.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mr: 'auto', ml: 1 }}>
            {links.map((link) => (
              <Tooltip key={link.href} title={link.label}>
                <IconButton
                  component="a"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  size="small"
                >
                  <LinkIcon src={link.icon} />
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        )}
        <Button onClick={onClose}>{i18n('chem_info_close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
