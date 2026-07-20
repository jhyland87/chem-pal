/**
 * This script generates the SVG and PNG files for the logo.
 * It uses a template and a data object to create the files.
 * The template is a XML file that contains the logo design.
 * The data object is an object that contains the data to use to create the files.
 * The script creates the files in the public/static/images/logo directory.
 * The script uses the svg2img library to convert the SVG files to PNG files.
 * The script uses the fs library to read and write the files.
 * The script uses the path library to resolve the paths to the files.
 */
import fs from "fs/promises";
//import p from "../package.json" with { type: "json" };
import { _basename, _c, _r, _readFile, _realpath, _y, getPluginVersion } from "./helpers.js";
import { getSupplierNames } from "./supplierList.js";
import { renderSvg } from "./svg.js";

/**
 * Constants (specific to this script)
 */
const logoTemplate = "public/static/images/logo/ChemPal-logo-template.xml";

/**
 * Square pixel sizes to render PNG icon variants at, from the same SVG template.
 * Each is emitted alongside the full-size PNG as `<name>-<size>.png`
 * (e.g. ChemPal-logo-16.png) for use as manifest icons.
 */
const ICON_SIZES = [16, 32, 48, 128];

/**
 * The SVG files to generate and convert.
 * The key is the path to the SVG file to create.
 * The value is an object that contains the data to use to create the SVG file.
 *
 * @todo Try to grab the color themes from the existing theme files (eg: pull
 * from src/theme/colors.ts)
 */
const supplierList = await getSupplierNames();
const numberOfSuppliers = supplierList.length;
console.log("Details:");
console.log(`  Suppliers (${_y(numberOfSuppliers)}): ${_c(supplierList.join(", "))}`);
console.log(`  Plugin version: ${_c(getPluginVersion())}`);
console.log(`  Icon sizes (px):  ${_c(ICON_SIZES.join(", "))}`);
console.log("");

const svgFilesToConvert = {
  "public/static/images/logo/ChemPal-logo.svg": {
    backgroundColor: "#2C4060",
    primaryColor: "#ffffff",
    secondaryColor: "#D6E3F3",
    atomicNumber: numberOfSuppliers,
    pluginVersion: getPluginVersion(),
    iconSizes: ICON_SIZES,
  },
  "public/static/images/logo/ChemPal-logo-inverted.svg": {
    backgroundColor: "#ffffff",
    primaryColor: "#2C4060",
    secondaryColor: "#3f5270",
    atomicNumber: numberOfSuppliers,
    pluginVersion: getPluginVersion(),
    iconSizes: ICON_SIZES,
  },
  // Browser-tab favicon: the main ChemPal badge, emitted as an SVG plus 16/32px
  // PNGs only (no full-size PNG). Referenced by index.html and the TypeDoc site.
  "public/static/images/logo/favicon.svg": {
    backgroundColor: "#2C4060",
    primaryColor: "#ffffff",
    secondaryColor: "#D6E3F3",
    atomicNumber: supplierList.length,
    pluginVersion: getPluginVersion(),
    iconSizes: [16, 32],
    fullSize: false,
  },
};

const logoTemplatePath = _realpath(logoTemplate);

if (!(await fs.stat(logoTemplatePath))) {
  console.error(`${_r(logoTemplate)} does not exist`);
  process.exit(1);
}

const templateRaw = await _readFile(logoTemplatePath);

/**
 * Create an SVG file from the template and the data
 * @todo Instead of hardcoding the replacement strings, maybe match for /%foo%/g
 * and then use the foo key from the svgFileData object.
 * @param {string} svgFile - The path to the SVG file to create
 * @param {Object} svgFileData - The data to use to create the SVG file
 */
async function createSvgFile(svgFile, svgFileData) {
  const templateProcessed = templateRaw.replace(/%(.*?)%/g, (match, key) => {
    return svgFileData?.hasOwnProperty(key.trim()) ? svgFileData[key.trim()] : match; // Use the object value or keep the original match if key not found
  });

  await fs.writeFile(_realpath(svgFile), templateProcessed);
  console.log(`  ${_y(_basename(svgFile))} created successfully`);
}

/**
 * Create a PNG file from the SVG file.
 * @param {string} svgFile - The path to the SVG file to convert
 * @param {number} [size] - Optional square pixel size. When provided, the PNG is
 *   rendered at `size`×`size` and written as `<name>-<size>.png`; otherwise it is
 *   rendered at the template's intrinsic size and written as `<name>.png`.
 */
async function createPngFile(svgFile, size) {
  try {
    const pngFilename = size
      ? svgFile.replace(".svg", `-${size}.png`)
      : svgFile.replace(".svg", ".png");
    const buffer = await renderSvg(_realpath(svgFile), size);
    await fs.writeFile(_realpath(pngFilename), buffer);
    console.log(`  ${_y(_basename(pngFilename))} created from ${_y(_basename(svgFile))}`);
  } catch (error) {
    console.error(`  ${_r(_basename(svgFile))} failed to convert to PNG: ${error}`);
    process.exit(1);
  }
}

for (const [svgFile, svgFileData] of Object.entries(svgFilesToConvert)) {
  console.log("");
  console.log(`Generating ${_c(svgFile)}...`);
  await createSvgFile(svgFile, svgFileData);
  // Skip the full-size PNG for entries that only need sized variants (favicon).
  if (svgFileData.fullSize !== false) {
    await createPngFile(svgFile);
  }
  if (Array.isArray(svgFileData.iconSizes)) {
    for (const size of svgFileData.iconSizes) {
      await createPngFile(svgFile, size);
    }
  }
}
