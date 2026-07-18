Regex pattern for reagent grade strings. Tests saved [here](https://regex101.com/r/KpgeRo/2).
The reason behind doing all the `[Az][Bb][Cc]` instead of just using case insensitive matching is because we would want to match something like `AR` (uppercase) for analytical reagent grade, but not ar (same for other use cases). And There is no `(?i:)` operator yet.
```regex
# Word boundary start
\b(?:

  # Analotical Reagent
  (?<AR_Grade>(?:(?:AR(?!\.)|A\.R\.)|[Aa][Nn][Aa][Ll][Yy][Tt][Ii][Cc][Aa][Ll](?:\s*[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # American Chemical Society
  (?<ACS_Grade>(?:(?:ACS(?!\.)|A\.C\.S\.)|[Aa][Cc][Ss]\s+[Gg][Rr][Aa][Dd][Ee]|[Aa][Mm][Ee][Rr][Ii][Cc][Aa][Nn]\s+[Cc][Hh][Ee][Mm](?:[Ii][Cc][Aa][Ll])?\s+[Ss][Oo][Cc][Ii][Ee][Tt][Yy])(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Guaranteed Grade
  (?<Guaranteed_Grade>[Gg][Uu][Aa][Rr][Aa][Nn][Tt][Ee][Ee][Dd]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Cosmetic Grade (because that's a thing...)
  (?<Cosmetic_Grade>[Cc][Oo][Ss][Mm][Ee][Tt][Ii][Cc]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Extraction Grade
  (?<Extraction_Grade>[Ee][Xx][Tt][Rr][Aa][Cc][Tt][Ii][Oo][Nn]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # National Formulary
  (?<NF_Grade>(?:(?:NF(?!\.)|N\.F\.)|[Nn][Ff]\s+[Gg][Rr][Aa][Dd][Ee]|[Nn][Aa][Tt][Ii][Oo][Nn][Aa][Ll]\s+[Ff][Oo][Rr][Mm][Uu][Ll][Aa][Rr][Yy])(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Food and Drug Administration
  (?<FCC_Grade>(?:(?:FCC(?!\.)|F\.C\.C\.)|[Ff][Cc][Cc]\s+[Gg][Rr][Aa][Dd][Ee]|[Ff][Oo][Oo][Dd]\s+(?:[Cc][Hh][Ee][Mm](?:[Ii][Cc][Aa][Ll][Ss])?\s+[Cc][Oo][Dd][Ee][Xx]|(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)))(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Practical Grade
  (?<Practical_Grade>[Pp][Rr][Aa][Cc][Tt][Ii][Cc][Aa][Ll]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Industrial Grade
  (?<Industrial_Grade>[Ii][Nn][Dd][IiUu][Ss][Tt][Rr][Ii][Aa][Ll]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Technical Grade
  (?<Technical_Grade>(?:[Tt][Ee][Cc][Hh](?:[Nn][Ii][Cc][Aa][Ll])?\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)|TECHNICAL(?:\s+GRADE)?))|

  # Reagent Grade
  (?<Reagent_Grade>[Rr][Ee][Aa][Gg][Ee][Nn][Tt]\s+[Gg][Rr][Aa][Dd][Ee])|

  # British Pharmacopeia
  (?<BP_Grade>(?:(?:BP(?!\.)|B\.P\.)(?!\s*\/\s*(?:USP(?!\.)|U\.S\.P\.))|[Bb][Rr][Ii][Tt][Tt]?[Ii][Ss][Hh]\s+[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?)?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Japanese Pharmacopeia
  (?<JP_Grade>(?:(?:JP(?!\.)|J\.P\.)|[Jj][Aa][Pp][Aa][Nn][Ee][Ss][Ee]\s+[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?)?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # United States Pharmacopeia
  (?<USP_Grade>(?:(?:BP(?!\.)|B\.P\.)\s*\/\s*(?:USP(?!\.)|U\.S\.P\.)|(?:USP(?!\.)|U\.S\.P\.)\s*\/\s*(?:BP(?!\.)|B\.P\.)|(?:USP(?!\.)|U\.S\.P\.)|[Uu][Ss][Pp]\s+[Gg][Rr][Aa][Dd][Ee]|(?:[Uu][Nn][Ii][Tt][Ee][Dd]\s+[Ss][Tt][Aa][Tt][Ee][Ss]|(?:US(?!\.)|U\.S\.))\s+[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?)?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # High Performance Liquid Chromatography
  (?<HPLC_Grade>(?:(?:HPLC(?!\.)|H\.P\.L\.C\.)|[Hh][Pp][Ll][Cc]\s+[Gg][Rr][Aa][Dd][Ee]|[Gg][Rr][Aa][Dd][Ii][Ee][Nn][Tt]\s+[Gg][Rr][Aa][Dd][Ee]|[Hh][Ii][Gg][Hh][-\s]+[Pp][Ee][Rr][Ff][Oo][Rr][Mm][Aa][Nn][Cc][Ee]\s+[Ll][Ii][Qq][Uu][Ii][Dd]\s+[Cc][Hh][Rr][Oo][Mm][Aa][Tt][Oo][Gg][Rr][Aa][Pp][Hh][Yy])(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Lab Grade
  (?<Lab_Grade>(?:(?:LR(?!\.)|L\.R\.)|[Ll][Aa][Bb](?:[Oo][Rr][Aa][Tt][Oo][Rr][Yy]|[Oo][Rr][Aa][Tt][Ii][Rr][Yy]|[Pp][Rr][Aa][Tt][Oo][Rr][Yy])?\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)))|

  # Pure Grade
  (?<Pure_Grade>[Pp][Uu][Rr](?:[Ee]|[Ii][Ff][Ii][Ee][Dd])\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Pharma Grade
  (?<Pharma_Grade>[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?)?\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Low Grade
  (?<Low_Grade>[Ll][Oo][Ww]\s+(?:(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)|[Pp][Uu][Rr][Ii][Tt][Yy]))|

  # Impure
  (?<Impure>[Ii][Mm][Pp][Uu][Rr][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)|

  # Ungraded
  (?<Ungraded>[Uu][Nn][Gg][Rr][Aa][Dd][Ee][Dd](?:\s+[Pp][Uu][Rr][Ii][Tt][Yy])?(?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)

# Word boundary end
)(?!\w)
```

## Sources
- [LabAlley - What are the different grades of chemicals?
](https://www.laballey.com/blog/chemical-grades)
- [Science Company - Learn Chemical Grade Definitions](https://www.sciencecompany.com/Learn-Chemical-Grade-Definitions-from-Highest-to-Lowest-Purity..aspx)
- [Grades of reagents and chemicals used in the laboratory](https://www.labmanager.com/the-most-common-grades-of-reagents-and-chemicals-2655)
- [makingcosmetics - Purity Grades](https://www.makingcosmetics.com/Purity-Grades_ep_105.html?lang=en_US)