# Chemical-grade classifier patterns

Generated from `GRADE_REGEX_SOURCE` / `LABELED_GRADE_REGEX` in [science.ts](./science.ts).
Do not hand-edit — regenerate when the `bodies` or `stems` maps change.

Flavor: **ECMAScript (JavaScript)**. The `(?!\.)` in `acronym()` and the named groups
behave differently under PCRE2/Python, so pick the JS flavor in regex101.

## Classifier

Matches a grade token anywhere in the string. Exactly one named group is non-null on a
match, and its name is the grade.

[Regex101](https://regex101.com/r/BJV88C/12)


```regex
\b(?:
  # Analytical Reagent grade
  (?<AR_Grade>(?:(?:AR(?!\.)|A\.R\.)|(?:analytical|Analytical|ANALYTICAL)(?:\s*(?:reagent|Reagent|REAGENT))?)(?:\s+(?:grade|Grade|GRADE))?)|

  # American Chemical Society grade
  (?<ACS_Grade>(?:(?:ACS(?!\.)|A\.C\.S\.)|(?:acs|Acs|ACS)\s+(?:grade|Grade|GRADE)|(?:american|American|AMERICAN)\s+(?:chem|Chem|CHEM)(?:(?:ical|Ical|ICAL))?\s+(?:society|Society|SOCIETY))(?:\s+(?:grade|Grade|GRADE))?)|

  # Guaranteed grade
  (?<Guaranteed_Grade>(?:guaranteed|Guaranteed|GUARANTEED)\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?))|

  # Cosmetic grade  (because that's a thing..)
  (?<Cosmetic_Grade>(?:cosmetic|Cosmetic|COSMETIC)\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?))|

  # Extraction grade
  (?<Extraction_Grade>(?:extraction|Extraction|EXTRACTION)\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?))|

  # National Formulary grade
  (?<NF_Grade>(?:(?:NF(?!\.)|N\.F\.)|(?:nf|Nf|NF)\s+(?:grade|Grade|GRADE)|(?:national|National|NATIONAL)\s+(?:formulary|Formulary|FORMULARY))(?:\s+(?:grade|Grade|GRADE))?)|

  # Food Chemicals Codex grade
  (?<FCC_Grade>(?:(?:FCC(?!\.)|F\.C\.C\.)|(?:NSF(?!\.)|N\.S\.F\.)|(?:fcc|Fcc|FCC)\s+(?:grade|Grade|GRADE)|(?:food|Food|FOOD)\s+(?:(?:chem|Chem|CHEM)(?:(?:icals|Icals|ICALS))?\s+(?:codex|Codex|CODEX)|(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?)))(?:\s+(?:grade|Grade|GRADE))?)|

  # Practical grade
  (?<Practical_Grade>(?:practical|Practical|PRACTICAL)\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?))|

  # Industrial grade
  (?<Industrial_Grade>(?:ind|Ind|IND)[IiUu](?:strial|Strial|STRIAL)\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?))|

  # Technical grade
  (?<Technical_Grade>(?:(?:tech|Tech|TECH)(?:(?:nical|Nical|NICAL))?\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?)|TECHNICAL(?:\s+GRADE)?))|

  # Reagent grade
  (?<Reagent_Grade>(?<!(CS|SP|CC|AR|BP|JP|PA)\s)(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?(?!.*(ACS|(US|J|B)P|NF|FCC|HPLC).*))|

  # British Pharmacopeia grade
  (?<BP_Grade>(?:(?:BP(?!\.)|B\.P\.)(?!\s*\/\s*(?:USP(?!\.)|U\.S\.P\.))|(?:brit|Brit|BRIT)[Tt]?(?:ish|Ish|ISH)\s+(?:pharma|Pharma|PHARMA)(?:(?:cop|Cop|COP)(?:[Oo]?(?:eia|Eia|EIA))?|(?:cy|Cy|CY)|(?:ceutical|Ceutical|CEUTICAL))?)(?:\s+(?:grade|Grade|GRADE))?)|

  # Japanese Pharmacopeia grade
  (?<JP_Grade>(?:(?:JP(?!\.)|J\.P\.)|(?:japanese|Japanese|JAPANESE)\s+(?:pharma|Pharma|PHARMA)(?:(?:cop|Cop|COP)(?:[Oo]?(?:eia|Eia|EIA))?|(?:cy|Cy|CY)|(?:ceutical|Ceutical|CEUTICAL))?)(?:\s+(?:grade|Grade|GRADE))?)|

  # United States Pharmacopeia grade
  (?<USP_Grade>(?:(?:BP(?!\.)|B\.P\.)\s*\/\s*(?:USP(?!\.)|U\.S\.P\.)|(?:USP(?!\.)|U\.S\.P\.)\s*\/\s*(?:BP(?!\.)|B\.P\.)|(?:USP(?!\.)|U\.S\.P\.)|(?:usp|Usp|USP)\s+(?:grade|Grade|GRADE)|(?:(?:united|United|UNITED)\s+(?:states|States|STATES)|(?:US(?!\.)|U\.S\.))\s+(?:pharma|Pharma|PHARMA)(?:(?:cop|Cop|COP)(?:[Oo]?(?:eia|Eia|EIA))?|(?:cy|Cy|CY)|(?:ceutical|Ceutical|CEUTICAL))?)(?:\s+(?:grade|Grade|GRADE))?)|

  # High Performance Liquid Chromatography grade
  (?<HPLC_Grade>(?:(?:HPLC(?!\.)|H\.P\.L\.C\.)|(?:hplc|Hplc|HPLC)\s+(?:grade|Grade|GRADE)|(?:gradient|Gradient|GRADIENT)\s+(?:grade|Grade|GRADE)|(?:high|High|HIGH)[-\s]+(?:performance|Performance|PERFORMANCE)\s+(?:liquid|Liquid|LIQUID)\s+(?:chromatography|Chromatography|CHROMATOGRAPHY))(?:\s+(?:grade|Grade|GRADE))?)|

  # Laboratory grade
  (?<Lab_Grade>(?:(?:LR(?!\.)|L\.R\.)|(?:lab|Lab|LAB)(?:(?:oratory|Oratory|ORATORY)|(?:oratiry|Oratiry|ORATIRY)|(?:pratory|Pratory|PRATORY))?\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?)))|

  # Pure grade
  (?<Pure_Grade>(?:(?:PA(?!\.)|P\.A\.)|(?:(?:ultra|Ultra|ULTRA)\s+)?(?:high|High|HIGH)\s+(?:(?:purity|Purity|PURITY)|(?:quality|Quality|QUALITY)|(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?))|(?:pur|Pur|PUR)(?:(?:e|E)|(?:ified|Ified|IFIED))\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?)))|

  # Pharma grade
  (?<Pharma_Grade>(?:pharma|Pharma|PHARMA)(?:(?:cop|Cop|COP)(?:[Oo]?(?:eia|Eia|EIA))?|(?:cy|Cy|CY)|(?:ceutical|Ceutical|CEUTICAL))?\s+(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?))|

  # Low grade
  (?<Low_Grade>(?:low|Low|LOW)\s+(?:(?:(?:reagent|Reagent|REAGENT)(?:\s+(?:grade|Grade|GRADE))?|(?:grade|Grade|GRADE)(?:\s+(?:reagent|Reagent|REAGENT))?)|(?:purity|Purity|PURITY)))|

  # Impure
  (?<Impure>(?:impure|Impure|IMPURE)(?:\s+(?:reagent|Reagent|REAGENT))?)|

  # Ungraded
  (?<Ungraded>(?:ungraded|Ungraded|UNGRADED)(?:\s+(?:purity|Purity|PURITY))?(?:\s+(?:reagent|Reagent|REAGENT))?)

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
- [advtechind - Purity and grade](https://www.advtechind.com/grade.htm)