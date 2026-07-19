# Chemical-grade classifier patterns

Generated from `GRADE_REGEX_SOURCE` / `LABELED_GRADE_REGEX` in [science.ts](./science.ts).
Do not hand-edit — regenerate when the `bodies` or `stems` maps change.

Flavor: **ECMAScript (JavaScript)**. The `(?!\.)` in `acronym()` and the named groups
behave differently under PCRE2/Python, so pick the JS flavor in regex101.

## Classifier

Matches a grade token anywhere in the string. Exactly one named group is non-null on a
match, and its name is the grade.

> **Note:** The reason for all the `[Aa][Bb][Cc]` instead of just doing case insensitive is because some grades we require to be uppercase (`USP`, `ACS`, `FCC`, etc)

[Regex101](https://regex101.com/r/BJV88C/4)

```regex
# Word boundary start
\b(?:

  # Analytical Reagent grade
	(?<AR_Grade>(?:(?:AR(?!\.)|A\.R\.)|[Aa][Nn][Aa][Ll][Yy][Tt][Ii][Cc][Aa][Ll](?:\s*[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # American Chemical Society grade
	(?<ACS_Grade>(?:(?:ACS(?!\.)|A\.C\.S\.)|[Aa][Cc][Ss]\s+[Gg][Rr][Aa][Dd][Ee]|[Aa][Mm][Ee][Rr][Ii][Cc][Aa][Nn]\s+[Cc][Hh][Ee][Mm](?:[Ii][Cc][Aa][Ll])?\s+[Ss][Oo][Cc][Ii][Ee][Tt][Yy])(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Guaranteed grade
	(?<Guaranteed_Grade>[Gg][Uu][Aa][Rr][Aa][Nn][Tt][Ee][Ee][Dd]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Cosmetic grade (because apparently, that's a thing..)
	(?<Cosmetic_Grade>[Cc][Oo][Ss][Mm][Ee][Tt][Ii][Cc]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Extraction grade
	(?<Extraction_Grade>[Ee][Xx][Tt][Rr][Aa][Cc][Tt][Ii][Oo][Nn]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # National Formulary grade
	(?<NF_Grade>(?:(?:NF(?!\.)|N\.F\.)|[Nn][Ff]\s+[Gg][Rr][Aa][Dd][Ee]|[Nn][Aa][Tt][Ii][Oo][Nn][Aa][Ll]\s+[Ff][Oo][Rr][Mm][Uu][Ll][Aa][Rr][Yy])(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Food Codex Commission grade
	(?<FCC_Grade>(?:(?:FCC(?!\.)|F\.C\.C\.)|[Ff][Cc][Cc]\s+[Gg][Rr][Aa][Dd][Ee]|[Ff][Oo][Oo][Dd]\s+(?:[Cc][Hh][Ee][Mm](?:[Ii][Cc][Aa][Ll][Ss])?\s+[Cc][Oo][Dd][Ee][Xx]|(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)))(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Practical grade
	(?<Practical_Grade>[Pp][Rr][Aa][Cc][Tt][Ii][Cc][Aa][Ll]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Industrial grade
	(?<Industrial_Grade>[Ii][Nn][Dd][IiUu][Ss][Tt][Rr][Ii][Aa][Ll]\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Technical grade
	(?<Technical_Grade>(?:[Tt][Ee][Cc][Hh](?:[Nn][Ii][Cc][Aa][Ll])?\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)|TECHNICAL(?:\s+GRADE)?))|

  # Reagent grade
	(?<Reagent_Grade>[Rr][Ee][Aa][Gg][Ee][Nn][Tt]\s+[Gg][Rr][Aa][Dd][Ee])|

  # British Pharmacopeia grade
	(?<BP_Grade>(?:(?:BP(?!\.)|B\.P\.)(?!\s*\/\s*(?:USP(?!\.)|U\.S\.P\.))|[Bb][Rr][Ii][Tt][Tt]?[Ii][Ss][Hh]\s+[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?|[Cc][Yy]|[Cc][Ee][Uu][Tt][Ii][Cc][Aa][Ll])?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Japanese Pharmacopeia grade
	(?<JP_Grade>(?:(?:JP(?!\.)|J\.P\.)|[Jj][Aa][Pp][Aa][Nn][Ee][Ss][Ee]\s+[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?|[Cc][Yy]|[Cc][Ee][Uu][Tt][Ii][Cc][Aa][Ll])?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # United States Pharmacopeia grade
	(?<USP_Grade>(?:(?:BP(?!\.)|B\.P\.)\s*\/\s*(?:USP(?!\.)|U\.S\.P\.)|(?:USP(?!\.)|U\.S\.P\.)\s*\/\s*(?:BP(?!\.)|B\.P\.)|(?:USP(?!\.)|U\.S\.P\.)|[Uu][Ss][Pp]\s+[Gg][Rr][Aa][Dd][Ee]|(?:[Uu][Nn][Ii][Tt][Ee][Dd]\s+[Ss][Tt][Aa][Tt][Ee][Ss]|(?:US(?!\.)|U\.S\.))\s+[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?|[Cc][Yy]|[Cc][Ee][Uu][Tt][Ii][Cc][Aa][Ll])?)(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # High Performance Liquid Chromatography grade
	(?<HPLC_Grade>(?:(?:HPLC(?!\.)|H\.P\.L\.C\.)|[Hh][Pp][Ll][Cc]\s+[Gg][Rr][Aa][Dd][Ee]|[Gg][Rr][Aa][Dd][Ii][Ee][Nn][Tt]\s+[Gg][Rr][Aa][Dd][Ee]|[Hh][Ii][Gg][Hh][-\s]+[Pp][Ee][Rr][Ff][Oo][Rr][Mm][Aa][Nn][Cc][Ee]\s+[Ll][Ii][Qq][Uu][Ii][Dd]\s+[Cc][Hh][Rr][Oo][Mm][Aa][Tt][Oo][Gg][Rr][Aa][Pp][Hh][Yy])(?:\s+[Gg][Rr][Aa][Dd][Ee])?)|

  # Laboratory grade
	(?<Lab_Grade>(?:(?:LR(?!\.)|L\.R\.)|[Ll][Aa][Bb](?:[Oo][Rr][Aa][Tt][Oo][Rr][Yy]|[Oo][Rr][Aa][Tt][Ii][Rr][Yy]|[Pp][Rr][Aa][Tt][Oo][Rr][Yy])?\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)))|

  # Pharma grade
	(?<Pharma_Grade>[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?|[Cc][Yy]|[Cc][Ee][Uu][Tt][Ii][Cc][Aa][Ll])?\s+(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?))|

  # Low grade
	(?<Low_Grade>[Ll][Oo][Ww]\s+(?:(?:[Rr][Ee][Aa][Gg][Ee][Nn][Tt](?:\s+[Gg][Rr][Aa][Dd][Ee])?|[Gg][Rr][Aa][Dd][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)|[Pp][Uu][Rr][Ii][Tt][Yy]))|

  # Impure grade
	(?<Impure>[Ii][Mm][Pp][Uu][Rr][Ee](?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)|

  # Ungraded grade
	(?<Ungraded>[Uu][Nn][Gg][Rr][Aa][Dd][Ee][Dd](?:\s+[Pp][Uu][Rr][Ii][Tt][Yy])?(?:\s+[Rr][Ee][Aa][Gg][Ee][Nn][Tt])?)

  # End of grade patterns
)(?!\w)
```

## Labeled fallback

Tried only when the classifier finds nothing. An explicit `Grade:`/`Purity:`/`Quality:`
label licenses a bare word-grade stem that would otherwise be too weak to classify. [Regex101](https://regex101.com/r/oZV9iA/1)

```regex
# Word boundary start
\b(?:

  # Grade\/Purity\/Quality label
  [Gg][Rr][Aa][Dd][Ee]|[Pp][Uu][Rr][Ii][Tt][Yy]|[Qq][Uu][Aa][Ll][Ii][Tt][Yy])\s*[:\-–]\s*(?:

  # Guaranteed
  (?<Guaranteed_Grade>[Gg][Uu][Aa][Rr][Aa][Nn][Tt][Ee][Ee][Dd])|

  # USP
  (?<USP_Grade>(?:USP(?!\.)?|U\.S\.P\.))|

  # ACS
  (?<ACS_Grade>(?:ACS(?!\.)?|A\.C\.S\.))|

  # ACS
  (?<NF_Grade>(?:NF(?!\.)?|N\.F\.))|

  # Cosmetic
  (?<Cosmetic_Grade>[Cc][Oo][Ss][Mm][Ee][Tt][Ii][Cc])|

  # Extraction
  (?<Extraction_Grade>[Ee][Xx][Tt][Rr][Aa][Cc][Tt][Ii][Oo][Nn])|

  # Practical
  (?<Practical_Grade>[Pp][Rr][Aa][Cc][Tt][Ii][Cc][Aa][Ll])|

  # Industrial
  (?<Industrial_Grade>[Ii][Nn][Dd][IiUu][Ss][Tt][Rr][Ii][Aa][Ll])|

  # Technical
  (?<Technical_Grade>[Tt][Ee][Cc][Hh](?:[Nn][Ii][Cc][Aa][Ll])?)|

  # Reagent
  (?<Reagent_Grade>[Rr][Ee][Aa][Gg][Ee][Nn][Tt])|

  # Lab
  (?<Lab_Grade>[Ll][Aa][Bb](?:[Oo][Rr][Aa][Tt][Oo][Rr][Yy]|[Oo][Rr][Aa][Tt][Ii][Rr][Yy]|[Pp][Rr][Aa][Tt][Oo][Rr][Yy])?)|

  # Pure
  (?<Pure_Grade>[Pp][Uu][Rr](?:[Ee]|[Ii][Ff][Ii][Ee][Dd]))|

  # Pharma
  (?<Pharma_Grade>[Pp][Hh][Aa][Rr][Mm][Aa](?:[Cc][Oo][Pp](?:[Oo]?[Ee][Ii][Aa])?)?)|

  # Low
  (?<Low_Grade>[Ll][Oo][Ww])

  # End of grade patterns
)(?!\w)
```


## Sources
- [LabAlley - What are the different grades of chemicals](https://www.laballey.com/blog/chemical-grades)
- [Science Company - Learn Chemical Grade Definitions](https://www.sciencecompany.com/Learn-Chemical-Grade-Definitions-from-Highest-to-Lowest-Purity..aspx)
- [Grades of reagents and chemicals used in the laboratory](https://www.labmanager.com/the-most-common-grades-of-reagents-and-chemicals-2655)
- [makingcosmetics - Purity Grades](https://www.makingcosmetics.com/Purity-Grades_ep_105.html?lang=en_US)