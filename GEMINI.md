# Polyglot Reader — Engineering & Design Guidelines

## 1. UI & Component Surface Invariants
- **No Button Borders**: Buttons, interactive chips, and toggle controls must not use outline borders or borders differing from their backgrounds.
- **Tonal Contrast**: Affordance and selection state must be communicated purely through solid or tonal background fills and high-contrast text.
  - Active Primary: Imperial Carmine (`#b32656`) with Pure White text (`#ffffff`, 6.28:1 contrast).
  - Active Secondary / Toggle: Deep Jade (`#297a5f`, exact 180° mathematical complement) with Pure White text (`#ffffff`, 5.21:1 contrast).
  - Inactive / Tonal: Surface Container High (`#eee6e8`) with On-Surface Charcoal (`#211a1c`, 12.77:1 contrast).
- **Mathematical Color Harmony**: Any complementary color introduced for secondary states must be mathematically verified as a 180° diametric complement to the primary brand hue.

## 2. Tooling & JSX Parsing Precautions
- **Avoid Naive JSX Regex**: Never use `/<tag\b[^>]*>/` when scanning JSX attributes, as inline arrow functions (`() => ...`) contain `>` characters that truncate the match. Use balanced brace and quote tokenizers.

## 3. Data & Content Integrity
- **Dual Data Synchronization**: Data residing in both `src/data/` (bundled) and `public/` (static runtime fetch) must always be synchronized in lockstep.
- **Dictionary Grounding**: Theatrical dialogue and pedagogical translations must be verified against formal dictionary lexicons (JMdict / CC-CEDICT).
- **Universal Copy Scope**: Core brand, hero, navigation, and metadata copy must refer to languages in general without regional scoping (e.g. avoid "East Asian" unless referring to a specific language track).
