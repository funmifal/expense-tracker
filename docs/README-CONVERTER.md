# Design Token to CSS Variable Converter Documentation

A high-performance Node.js utility script that converts Figma/Style-Dictionary design token JSON files (`design-tokens.tokens (1).json` / `@design.token.tokens`) into standard CSS custom properties (`:root` variables).

---

## 🎨 Colour System Architecture

The design system enforces a strict distinction between **Primitive Colours** (foundation) and **Colour Roles** (semantic UI variables).

> [!IMPORTANT]
> **Rule of Thumb**: Always style UI elements using **Colour Roles** (`--color-role-*`). Never style UI components directly with **Primitive Colours** (`--primitive-*`).

### 1. Primitive Colours (`--primitive-*`)
* **Role**: Foundational color palette (key colors, 0–100 tint/tone/shade scales for primary, secondary, tertiary, neutral, neutral-variant, error, warning, info, and success).
* **Usage**: Internal foundation layer. These serve as the underlying target values referenced by Colour Roles.
* **CSS Variable Pattern**: `--primitive-<group>-<color-name>-<step>`
* **Example**: `--primitive-primary-colors-primary-40: #3e8e7e;`

### 2. Colour Roles (`--color-role-*`)
* **Role**: Authoritative semantic color tokens designed for UI components (`primary`, `on-primary`, `surface`, `on-surface`, `error-container`, etc.).
* **Usage**: **Apply directly to UI components.**
* **CSS Variable Pattern**: `--color-role-<role-name>`
* **Reference Architecture**: Colour Roles link dynamically to Primitive Colours via CSS `var(...)` aliases.
* **Example**: `--color-role-primary: var(--primitive-key-colors-primary-key-color);`

---

## 🚀 Script Usage

The conversion script is located at [`scripts/convert-tokens.js`](file:///c:/Users/Biggest%20Sam/Desktop/expense%20tracker/scripts/convert-tokens.js).

### Basic Command

```bash
node scripts/convert-tokens.js
```
*Default Input*: `design-tokens.tokens (1).json`  
*Default Output*: `styles/tokens.css`

### Custom Input and Output Paths

```bash
node scripts/convert-tokens.js "path/to/tokens.json" "path/to/output.css"
```

### CLI Options & Flags

| Flag | Description | Default |
|---|---|---|
| `--resolve-refs` | Resolves `{primitives...}` aliases directly to hex/rgba values instead of using `var(...)` references. | `false` (Uses `var(...)` aliases) |
| `--preserve-hex-alpha` | Preserves 8-digit hex `#rrggbbaa` colors instead of converting alpha colors to `rgba(r, g, b, a)` format. | `false` (Formats to `rgba()`) |

---

## 📊 Summary of Generated Variables (365 Total)

| Category | Token Count | Variable Prefix | Example |
|---|---|---|---|
| **Primitive Colours** | 135 | `--primitive-*` | `--primitive-primary-colors-primary-100: #ffffff;` |
| **Colour Roles** | 50 | `--color-role-*` | `--color-role-primary: var(--primitive-key-colors-primary-key-color);` |
| **Spacing System** | 12 | `--spacing-*` | `--spacing-base-spacing: 16px;` |
| **Typography** | 165 | `--typography-*` | `--typography-body-medium-font-size: 14px;` |
| **Effects & Shadows** | 3 | `--effect-*` | `--effect-hard-shadow: 4px 6px 8px 0px rgba(0, 0, 0, 0.32);` |

---

## 💻 CSS Usage & Best Practices

### Importing in Next.js / Global CSS

In your `app/globals.css` or root layout:

```css
@import '../styles/tokens.css';
```

### Component Styling Example

```css
/* ✅ DO: Use Colour Roles for UI Styling */
.card {
  background-color: var(--color-role-surface);
  color: var(--color-role-on-surface);
  border: 1px solid var(--color-role-neutral-variant-container);
  padding: var(--spacing-base-spacing);
  border-radius: 8px;
  box-shadow: var(--effect-soft-shadow);
}

.button-primary {
  background-color: var(--color-role-primary);
  color: var(--color-role-on-primary);
  padding: var(--spacing-medium-spacing) var(--spacing-base-spacing);
  font-family: var(--typography-label-large-font-family);
  font-size: var(--typography-label-large-font-size);
  font-weight: var(--typography-label-large-font-weight);
}

/* ❌ DON'T: Avoid referencing primitives directly in components */
.card-wrong {
  background-color: var(--primitive-neutral-colors-neutral-98); /* DON'T DO THIS */
}
```

---

## 🛠 Script Architecture & Features

The script handles:
1. **Recursion & Traversal**: Traverses nested Figma token collections of arbitrary depth.
2. **Kebab-Case Normalization**: Converts space-separated or camelCase token keys into valid CSS kebab-case identifiers.
3. **Reference Linking**: Regex matches `{primitives...}` token path aliases and converts them to CSS variable references `var(--primitive-...)`.
4. **Color Formatting**: Automatically formats 8-digit hex strings (`#RRGGBBAA`) to 6-digit hex (`#RRGGBB`) when fully opaque or `rgba()` when alpha channels are present.
5. **Dimension Formatting**: Formats spacing and typography numerical values with explicit length units (`px`) while maintaining unitless properties (`fontWeight`, `opacity`).
6. **Effect Serialization**: Serializes shadow objects (`shadowType`, `offsetX`, `offsetY`, `radius`, `spread`, `color`) to standard CSS `box-shadow` property strings.
