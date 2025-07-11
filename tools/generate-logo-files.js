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
import path, { dirname } from "path";
import svg2img from "svg2img";
import { fileURLToPath } from "url";
import util from "util";

/**
 * Environment variables
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __rootDir = path.resolve(__dirname, "..");

/**
 * Constants (specific to this script)
 */
const logoTemplate = "public/static/images/logo/ChemPal-logo-v2-template.xml";

/**
 * Helper functions
 */
const _realpath = (filename) => path.resolve(__rootDir, filename);
const _basename = (filename) => path.basename(filename);
const svg2imgPromisified = util.promisify(svg2img);

// Using ASCII color codes instead of chalk because these show up in github actions output.
const _r = (text) => `\x1b[31m${text}\x1b[0m`; // red
const _g = (text) => `\x1b[32m${text}\x1b[0m`; // green
const _y = (text) => `\x1b[33m${text}\x1b[0m`; // yellow
const _b = (text) => `\x1b[34m${text}\x1b[0m`; // blue
const _m = (text) => `\x1b[35m${text}\x1b[0m`; // magenta
const _c = (text) => `\x1b[36m${text}\x1b[0m`; // cyan
const _w = (text) => `\x1b[37m${text}\x1b[0m`; // white

/**
 * Get the number of suppliers from the ../src/suppliers/*.ts files. This will
 * be used in the atomic weight of the logos that are generated.
 *
 * Right now it's just hardcoded to whatever the count is.
 * @todo Implement this function.
 * @returns {number} The number of suppliers
 */
function getNumberOfSuppliers() {
  const numberOfSuppliers = 26;
  return numberOfSuppliers;
}

/**
 * The SVG files to generate and convert.
 * The key is the path to the SVG file to create.
 * The value is an object that contains the data to use to create the SVG file.
 *
 * @todo Try to grab the color themes from the existing theme files (eg: pull
 * from src/theme/colors.ts)
 */
const svgFilesToConvert = {
  "public/static/images/logo/ChemPal-logo-v2.svg": {
    backgroundColor: "#2C4060",
    primaryColor: "#ffffff",
    secondaryColor: "#D6E3F3",
    atomicNumber: getNumberOfSuppliers(),
  },
  "public/static/images/logo/ChemPal-logo-v2-inverted.svg": {
    backgroundColor: "#ffffff",
    primaryColor: "#2C4060",
    secondaryColor: "#3f5270",
    atomicNumber: getNumberOfSuppliers(),
  },
};

const logoTemplatePath = _realpath(logoTemplate);

if (!(await fs.stat(logoTemplatePath))) {
  console.error(`${_r(logoTemplate)} does not exist`);
  process.exit(1);
}

const templateRaw = await fs.readFile(logoTemplatePath, "utf8");

/**
 * Create an SVG file from the template and the data
 * @todo Instead of hardcoding the replacement strings, maybe match for /%foo%/g
 * and then use the foo key from the svgFileData object.
 * @param {string} svgFile - The path to the SVG file to create
 * @param {Object} svgFileData - The data to use to create the SVG file
 */
async function createSvgFile(svgFile, svgFileData) {
  const templateProcessed = templateRaw
    .replace(/%backgroundColor%/g, svgFileData.backgroundColor)
    .replace(/%primaryColor%/g, svgFileData.primaryColor)
    .replace(/%secondaryColor%/g, svgFileData.secondaryColor)
    .replace(/%atomicNumber%/g, svgFileData.atomicNumber);

  await fs.writeFile(_realpath(svgFile), templateProcessed);
  console.log(`  ${_y(_basename(svgFile))} created successfully`);
}

/**
 * Create a PNG file from the SVG file
 * @param {string} svgFile - The path to the SVG file to convert
 */
async function createPngFile(svgFile) {
  try {
    const pngFilename = svgFile.replace(".svg", ".png");

    const buffer = await svg2imgPromisified(_realpath(svgFile));
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
  await createPngFile(svgFile);
}
