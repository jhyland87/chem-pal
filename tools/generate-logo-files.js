import fs from "fs";
import path, { dirname } from "path";
import svg2img from "svg2img";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __rootDir = path.resolve(__dirname, "..");

const logoTemplate = "./public/static/images/logo/ChemPal-logo-v2-template.xml";

const numberOfSuppliers = 25;

const svgFilesToConvert = {
  "./public/static/images/logo/ChemPal-logo-v2-inverted.svg": {
    backgroundColor: "#2C4060",
    primaryColor: "#ffffff",
    secondaryColor: "#D6E3F3",
    atomicNumber: numberOfSuppliers,
  },
  "./public/static/images/logo/ChemPal-logo-v2.svg": {
    backgroundColor: "#ffffff",
    primaryColor: "#2C4060",
    secondaryColor: "#3f5270",
    atomicNumber: numberOfSuppliers,
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
  console.log(`${svgFile} created successfully`);
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
  console.log(`${svgFile} -> ${pngFilename}`);
}

/**
 * Create the SVG and PNG files
 */
for (const [svgFile, svgFileData] of Object.entries(svgFilesToConvert)) {
  createSvgFile(svgFile, svgFileData);
  createPngFile(svgFile);
  console.log(`--------------------------------`);
}
