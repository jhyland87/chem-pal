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
import chalk from "chalk";
import fs from "fs";
import path, { dirname } from "path";
import svg2img from "svg2img";
import { fileURLToPath } from "url";

const _c = chalk.cyan;
const _y = chalk.yellowBright;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __rootDir = path.resolve(__dirname, "..");

const logoTemplate = "public/static/images/logo/ChemPal-logo-v2-template.xml";

/**
 * Get the number of suppliers from the ../src/suppliers/*.ts files. This will
 * be used in the atomic weight of the logos that are generated.
 *
 * Right now it's just hardcoded to 25.
 * @todo Implement this function.
 * @returns {number} The number of suppliers
 */
function getNumberOfSuppliers() {
  const numberOfSuppliers = 25;
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

const templateRaw = fs.readFileSync(path.resolve(__rootDir, logoTemplate), "utf8");

/**
 * Create an SVG file from the template and the data
 * @param {string} svgFile - The path to the SVG file to create
 * @param {Object} svgFileData - The data to use to create the SVG file
 */
function createSvgFile(svgFile, svgFileData) {
  const templateProcessed = templateRaw
    .replace(/%backgroundColor%/g, svgFileData.backgroundColor)
    .replace(/%primaryColor%/g, svgFileData.primaryColor)
    .replace(/%secondaryColor%/g, svgFileData.secondaryColor)
    .replace(/%atomicNumber%/g, svgFileData.atomicNumber);

  fs.writeFileSync(path.resolve(__rootDir, svgFile), templateProcessed);
  console.log(`  ${_y(path.basename(svgFile))} created successfully`);
}

/**
 * Create a PNG file from the SVG file
 * @param {string} svgFile - The path to the SVG file to convert
 */
function createPngFile(svgFile) {
  const pngFilename = svgFile.replace(".svg", ".png");
  svg2img(path.resolve(__rootDir, svgFile), (error, buffer) => {
    fs.writeFileSync(path.resolve(__rootDir, pngFilename), buffer);
  });
  console.log(`  ${_y(path.basename(pngFilename))} created from ${_y(path.basename(svgFile))}`);
}

/**
 * Create the SVG and PNG files
 */
for (const [svgFile, svgFileData] of Object.entries(svgFilesToConvert)) {
  console.log("");
  console.log(`Generating ${_c(svgFile)}...`);
  createSvgFile(svgFile, svgFileData);
  createPngFile(svgFile);
}
