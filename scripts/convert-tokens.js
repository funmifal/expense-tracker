/**
 * ============================================================================
 * Design Tokens to CSS Custom Properties Converter
 * ============================================================================
 * 
 * @file scripts/convert-tokens.js
 * @description Node.js utility script to parse Figma/Style-Dictionary design
 *              token JSON files and generate clean, standardized CSS custom
 *              properties (:root variables) with clear differentiation between
 *              Primitive Colours (foundation) and Colour Roles (UI semantic).
 * 
 * @author Antigravity AI
 * 
 * ----------------------------------------------------------------------------
 * COLOUR SYSTEM ARCHITECTURE & GUIDELINES:
 * ----------------------------------------------------------------------------
 * 1. PRIMITIVE COLOURS:
 *    - Foundation palette tokens (e.g. key colors, shade scales 0-100).
 *    - MUST NOT be applied directly to UI components.
 *    - Served as the internal reference layer for semantic roles.
 * 
 * 2. COLOUR ROLES:
 *    - Semantic tokens (e.g. primary, surface, on-primary, error-container).
 *    - MUST be used directly in UI component styles.
 *    - Reference primitive variables using CSS `var(...)` references.
 * 
 * ----------------------------------------------------------------------------
 * USAGE:
 * ----------------------------------------------------------------------------
 *   node scripts/convert-tokens.js [inputFile] [outputFile] [options]
 * 
 *   Examples:
 *     node scripts/convert-tokens.js
 *     node scripts/convert-tokens.js "design-tokens.tokens (1).json" "styles/tokens.css"
 *     node scripts/convert-tokens.js --resolve-refs --preserve-hex-alpha
 * 
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION & CLI ARGUMENT PARSING
// ============================================================================

const args = process.argv.slice(2);

// Filter flags vs positional arguments
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positionalArgs = args.filter(arg => !arg.startsWith('--'));

// Input/Output file defaults
const defaultInputFile = 'design-tokens.tokens (1).json';
const defaultOutputFile = path.join('styles', 'tokens.css');

const inputFile = positionalArgs[0] || defaultInputFile;
const outputFile = positionalArgs[1] || defaultOutputFile;

// Operational Flags
const RESOLVE_REFS = flags.has('--resolve-refs'); // If true, resolves {primitives...} to computed hex/rgba values directly
const PRESERVE_HEX_ALPHA = flags.has('--preserve-hex-alpha'); // If true, keeps #rrggbbaa instead of converting to rgba()

console.log('--------------------------------------------------');
console.log(' Design Token to CSS Variables Converter');
console.log('--------------------------------------------------');
console.log(` Input File  : ${inputFile}`);
console.log(` Output File : ${outputFile}`);
console.log(` Resolve Refs: ${RESOLVE_REFS ? 'Yes (Direct values)' : 'No (Use CSS var() aliases)'}`);
console.log('--------------------------------------------------');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converts any string into clean, valid kebab-case for CSS property names.
 * Handles spaces, special characters, camelCase, and multiple dashes.
 * 
 * @param {string} str - Raw string to convert
 * @returns {string} Clean kebab-cased string
 */
function toKebabCase(str) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')    // camelCase to kebab-case
    .replace(/[\s_\/]+/g, '-')              // spaces/slashes/underscores to dashes
    .replace(/[^a-z0-9\-]+/gi, '')          // remove non-alphanumeric except dash
    .replace(/-+/g, '-')                   // collapse multiple dashes
    .toLowerCase();
}

/**
 * Formats a color string.
 * Converts 8-digit hex `#rrggbbaa` to `#rrggbb` when alpha is `ff` (100%),
 * or converts to `rgba(r, g, b, a)` if alpha is present and not preserving hex alpha.
 * 
 * @param {string} colorStr - Raw color hex string (e.g. "#2f6b5fff" or "#00000052")
 * @returns {string} Formatted CSS color string
 */
function formatColor(colorStr) {
  if (typeof colorStr !== 'string') return colorStr;
  const trimmed = colorStr.trim();
  
  // Check if string is 8-digit hex (#RRGGBBAA)
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    const rr = parseInt(trimmed.slice(1, 3), 16);
    const gg = parseInt(trimmed.slice(3, 5), 16);
    const bb = parseInt(trimmed.slice(5, 7), 16);
    const aaHex = trimmed.slice(7, 9);
    const alpha = parseFloat((parseInt(aaHex, 16) / 255).toFixed(2));

    // If fully opaque (FF), return standard 6-digit hex
    if (aaHex.toLowerCase() === 'ff') {
      return `#${trimmed.slice(1, 7)}`;
    }

    if (PRESERVE_HEX_ALPHA) {
      return trimmed;
    }

    // Convert to rgba() representation
    return `rgba(${rr}, ${gg}, ${bb}, ${alpha})`;
  }

  return trimmed;
}

/**
 * Parses and formats drop-shadow effect object into a valid CSS `box-shadow` value.
 * 
 * @param {Object} shadowObj - Shadow object containing radius, color, offsetX, offsetY, spread
 * @returns {string} CSS box-shadow string (e.g., "4px 6px 8px 0px rgba(0, 0, 0, 0.32)")
 */
function formatShadowEffect(shadowObj) {
  if (!shadowObj || typeof shadowObj !== 'object') return '';
  const offsetX = shadowObj.offsetX !== undefined ? `${shadowObj.offsetX}px` : '0px';
  const offsetY = shadowObj.offsetY !== undefined ? `${shadowObj.offsetY}px` : '0px';
  const radius = shadowObj.radius !== undefined ? `${shadowObj.radius}px` : '0px';
  const spread = shadowObj.spread !== undefined ? `${shadowObj.spread}px` : '0px';
  const color = formatColor(shadowObj.color || '#000000');

  // Format: <offsetX> <offsetY> <radius> <spread> <color>
  return `${offsetX} ${offsetY} ${radius} ${spread} ${color}`;
}

/**
 * Appends 'px' unit to numeric dimensions for typography & spacing if not unitless.
 * 
 * @param {number|string} val - Dimension numeric value
 * @param {string} propName - Property key name (e.g., "fontWeight", "fontSize")
 * @returns {string} CSS dimension string (e.g., "16px", "500", "0")
 */
function formatDimension(val, propName = '') {
  if (val === 0 || val === '0') return '0';
  const cleanProp = toKebabCase(propName);
  
  // Unitless CSS properties
  if (cleanProp === 'font-weight' || cleanProp === 'opacity') {
    return val.toString();
  }

  if (typeof val === 'number') return `${val}px`;
  if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') return `${val}px`;
  return val;
}

/**
 * Formats font family with sensible CSS fallbacks if not already specified.
 * 
 * @param {string} fontFamily - Raw font family string (e.g. "DM Sans", "Lora")
 * @returns {string} CSS font family string with generic fallback
 */
function formatFontFamily(fontFamily) {
  if (!fontFamily || typeof fontFamily !== 'string') return fontFamily;
  const trimmed = fontFamily.trim();

  // If already contains quotes or generic fallback, return as is
  if (trimmed.includes(',') || trimmed.includes("'") || trimmed.includes('"')) {
    return trimmed;
  }

  // Common font fallbacks
  if (trimmed.toLowerCase() === 'lora') {
    return `'Lora', serif`;
  }
  if (trimmed.toLowerCase() === 'dm sans') {
    return `'DM Sans', sans-serif`;
  }

  return `'${trimmed}', sans-serif`;
}

// ============================================================================
// TOKEN MAP BUILDING & ALIAS RESOLUTION
// ============================================================================

class TokenRegistry {
  constructor() {
    this.pathMap = new Map(); // jsonPath -> TokenEntry
  }

  /**
   * Register a token node with its JSON path array.
   */
  registerToken(pathArray, tokenNode, category) {
    const jsonPathStr = pathArray.join('.');
    
    let prefix = category;
    if (category === 'primitives') prefix = 'primitive';
    else if (category === 'color roles') prefix = 'color-role';
    else if (category === 'spacing system') prefix = 'spacing';
    else if (category === 'typography') prefix = 'typography';
    else if (category === 'effect') prefix = 'effect';

    const subPath = pathArray.slice(1).map(toKebabCase).join('-');
    const varName = `--${prefix}${subPath ? '-' + subPath : ''}`;

    let rawValue = tokenNode.value;
    let formattedValue = rawValue;
    const leafPropName = pathArray[pathArray.length - 1];

    // Handle token types
    if (tokenNode.type === 'color' || (typeof rawValue === 'string' && rawValue.startsWith('#'))) {
      formattedValue = formatColor(rawValue);
    } else if (tokenNode.type === 'custom-shadow' || (rawValue && typeof rawValue === 'object' && rawValue.shadowType)) {
      formattedValue = formatShadowEffect(rawValue);
    } else if (tokenNode.type === 'dimension' || typeof rawValue === 'number') {
      formattedValue = formatDimension(rawValue, leafPropName);
    } else if (leafPropName === 'fontFamily') {
      formattedValue = formatFontFamily(rawValue);
    }

    const tokenEntry = {
      jsonPath: jsonPathStr,
      varName,
      rawValue,
      formattedValue,
      type: tokenNode.type,
      category,
      leafPropName,
      description: tokenNode.description || ''
    };

    this.pathMap.set(jsonPathStr, tokenEntry);
    return tokenEntry;
  }

  /**
   * Resolves value references like `{primitives.key colors.primary key color}`.
   * If RESOLVE_REFS is false, converts to `var(--primitive-key-colors-primary-key-color)`.
   * If RESOLVE_REFS is true, fetches the underlying formatted primitive value.
   */
  resolveValue(val, leafPropName = '') {
    if (typeof val !== 'string') return val;
    
    // Regex matches token aliases like {primitives.key colors.primary key color}
    const aliasRegex = /^\{([^}]+)\}$/;
    const match = val.trim().match(aliasRegex);

    if (match) {
      const targetPath = match[1].trim();
      const targetEntry = this.pathMap.get(targetPath);

      if (targetEntry) {
        if (RESOLVE_REFS) {
          // Recursively resolve if target is also a reference
          return this.resolveValue(targetEntry.rawValue, leafPropName);
        } else {
          // Use CSS Variable alias
          return `var(${targetEntry.varName})`;
        }
      } else {
        console.warn(`[WARN] Unresolved token alias reference: "${val}"`);
        return val;
      }
    }

    // Format colors or dimensions
    if (val.startsWith('#')) return formatColor(val);
    return val;
  }
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

function main() {
  // 1. Read input token file
  const absoluteInputPath = path.isAbsolute(inputFile) 
    ? inputFile 
    : path.resolve(process.cwd(), inputFile);

  if (!fs.existsSync(absoluteInputPath)) {
    console.error(`[ERROR] Input token file not found at: ${absoluteInputPath}`);
    process.exit(1);
  }

  const rawJsonData = fs.readFileSync(absoluteInputPath, 'utf8');
  let tokenData;

  try {
    tokenData = JSON.parse(rawJsonData);
  } catch (err) {
    console.error(`[ERROR] Failed to parse JSON in token file: ${err.message}`);
    process.exit(1);
  }

  const registry = new TokenRegistry();

  // 2. Traversal helper to register all tokens
  function traverse(node, currentPath = [], category = '') {
    if (!node || typeof node !== 'object') return;

    // Check if current node is a leaf token (has 'value' or 'type')
    if (node.value !== undefined || node.type !== undefined) {
      registry.registerToken(currentPath, node, category);
      return;
    }

    for (const key of Object.keys(node)) {
      const nextPath = [...currentPath, key];
      const nextCategory = category || key.toLowerCase();
      traverse(node[key], nextPath, nextCategory);
    }
  }

  traverse(tokenData);

  // 3. Organize generated CSS variables into sections
  const primitivesCSS = [];
  const colorRolesCSS = [];
  const spacingCSS = [];
  const typographyCSS = [];
  const effectsCSS = [];

  for (const [pathStr, entry] of registry.pathMap.entries()) {
    let finalValue = registry.resolveValue(entry.rawValue, entry.leafPropName);
    
    // Apply dimension or font formatting
    if (typeof finalValue === 'number') {
      finalValue = formatDimension(finalValue, entry.leafPropName);
    } else if (typeof finalValue === 'string') {
      if (entry.leafPropName === 'fontFamily') {
        finalValue = formatFontFamily(finalValue);
      } else if (!finalValue.startsWith('var(') && !finalValue.startsWith('#') && !finalValue.includes('rgba')) {
        if (entry.type === 'dimension' || typeof entry.rawValue === 'number') {
          finalValue = formatDimension(finalValue, entry.leafPropName);
        }
      }
    }

    const comment = entry.description ? ` /* ${entry.description} */` : '';
    const cssLine = `  ${entry.varName}: ${finalValue};${comment}`;

    if (entry.category === 'primitives') {
      primitivesCSS.push(cssLine);
    } else if (entry.category === 'color roles') {
      colorRolesCSS.push(cssLine);
    } else if (entry.category === 'spacing system') {
      spacingCSS.push(cssLine);
    } else if (entry.category === 'typography') {
      typographyCSS.push(cssLine);
    } else if (entry.category === 'effect') {
      effectsCSS.push(cssLine);
    }
  }

  // 4. Construct complete output CSS content with detailed comments & documentation
  const now = new Date().toISOString();
  const cssHeader = `/**
 * ============================================================================
 * DESIGN SYSTEM CSS CUSTOM PROPERTIES
 * ============================================================================
 * Automatically generated from: ${path.basename(inputFile)}
 * Generated on: ${now}
 * Total Tokens Processed: ${registry.pathMap.size}
 * 
 * ----------------------------------------------------------------------------
 * ARCHITECTURAL DESIGN SYSTEM RULES:
 * ----------------------------------------------------------------------------
 * 1. PRIMITIVE COLOURS (--primitive-*):
 *    - Foundation palette tokens.
 *    - WARNING: DO NOT USE PRIMITIVE COLOUR VARIABLES DIRECTLY IN UI COMPONENTS.
 *    - These variables serve as internal base definitions.
 * 
 * 2. COLOUR ROLES (--color-role-*):
 *    - Semantic UI tokens.
 *    - AUTHORITATIVE FOR UI: Always apply these variables to UI component styles.
 *    - Color roles map directly to primitives via var(--primitive-*).
 * 
 * 3. SPACING & TYPOGRAPHY:
 *    - Standardized spacing scale and typography tokens for consistent layout.
 * ============================================================================
 */

:root {
  /* ==========================================================================
     1. PRIMITIVE COLOURS (FOUNDATION ONLY)
     WARNING: DO NOT APPLY DIRECTLY TO UI COMPONENTS. USE COLOUR ROLES INSTEAD.
     ========================================================================== */
${primitivesCSS.join('\n')}

  /* ==========================================================================
     2. COLOUR ROLES (SEMANTIC UI COLOURS)
     AUTHORITATIVE: USE THESE IN ALL UI COMPONENTS & STYLESHEETS.
     ========================================================================== */
${colorRolesCSS.join('\n')}

  /* ==========================================================================
     3. SPACING SYSTEM
     ========================================================================== */
${spacingCSS.join('\n')}

  /* ==========================================================================
     4. TYPOGRAPHY SYSTEM
     ========================================================================== */
${typographyCSS.join('\n')}

  /* ==========================================================================
     5. EFFECTS & SHADOWS
     ========================================================================== */
${effectsCSS.join('\n')}
}
`;

  // 5. Ensure output directory exists and write CSS file
  const absoluteOutputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.resolve(process.cwd(), outputFile);

  const outputDir = path.dirname(absoluteOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(absoluteOutputPath, cssHeader, 'utf8');

  console.log(`[SUCCESS] Generated CSS variables written to: ${absoluteOutputPath}`);
  console.log(`[STATS]   Primitive Colors : ${primitivesCSS.length}`);
  console.log(`[STATS]   Color Roles      : ${colorRolesCSS.length}`);
  console.log(`[STATS]   Spacing Tokens   : ${spacingCSS.length}`);
  console.log(`[STATS]   Typography Tokens: ${typographyCSS.length}`);
  console.log(`[STATS]   Effect Tokens    : ${effectsCSS.length}`);
  console.log(`[STATS]   Total Variables  : ${registry.pathMap.size}`);
}

main();
