
Complex regex pattern meant for matching chemical formula patterns and excluding false positives such as CAS or SMILES patterns.

@author Claude (Thanks, buddy)

@see https://regex101.com/r/h3ZnXX/6
```regex
(?<![^\s])                                                                # LEFT boundary: preceding char must be whitespace, or start-of-string
(                                                                         # capture 1: the whole formula
  (?![^<>]*>)                                                             # guard: don't start inside an HTML tag's attribute list
  (?:                                                                     # ============ HEAD — must look like a formula, not prose ============
    (?:                                                                   #   branch A: two or more element / bracket "units"
      (?:
        (?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rlem]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)  # any element symbol (all 118)
        |[()\[\]]                                                         #   ...or a bracket
      )+
      (?:                                                                 #   then any trailing subscript counts, in ANY encoding or a plain digit:
        (?:
          [₁₂₃₄₅₆₇₈₉][₀₁₂₃₄₅₆₇₈₉]*                                        #     subscript glyphs        H₂
          |[¹²³⁴⁵⁶⁷⁸⁹][⁰¹²³⁴⁵⁶⁷⁸⁹]*                                       #     superscript glyphs      x²
          |\\u208[1-9](?:\\u208[0-9])*                                     #     \u escape, subscript    H\u2082  (unparsed JSON)
          |(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*   #  \u escape, superscript
          |&\#(?:0*832[1-9]|[xX]0*208[1-9]);(?:&\#(?:0*832[0-9]|[xX]0*208[0-9]);)*   # HTML entity, subscript   H&#8322; / H&#x2082;
          |&\#(?:0*(?:178|179|185|830[89]|831[0-3])|[xX]0*(?:[bB][239]|207[4-9]));(?:&\#(?:0*(?:178|179|185|8304|830[89]|831[0-3])|[xX]0*(?:2070|[bB][239]|207[4-9]));)*  # HTML entity, superscript
          |<su[bp]>[1-9][0-9]*<\/su[bp]>                                    #     <sub>/<sup> tag          H<sub>2</sub>
        )
        |[1-9][0-9]*                                                       #     ...or a plain inline integer
      )*
    ){2,}
  |                                                                        #   branch B: a single element carrying a REQUIRED sub/superscript (e.g. "H₂")
    (?:
      (?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rlem]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)
      |[()\[\]]
    )+
    (?:                                                                    #   required sub/superscript number (any encoding; no bare digit here)
      [₁₂₃₄₅₆₇₈₉][₀₁₂₃₄₅₆₇₈₉]*|[¹²³⁴⁵⁶⁷⁸⁹][⁰¹²³⁴⁵⁶⁷⁸⁹]*|\\u208[1-9](?:\\u208[0-9])*|(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*|&\#(?:0*832[1-9]|[xX]0*208[1-9]);(?:&\#(?:0*832[0-9]|[xX]0*208[0-9]);)*|&\#(?:0*(?:178|179|185|830[89]|831[0-3])|[xX]0*(?:[bB][239]|207[4-9]));(?:&\#(?:0*(?:178|179|185|8304|830[89]|831[0-3])|[xX]0*(?:2070|[bB][239]|207[4-9]));)*|<su[bp]>[1-9][0-9]*<\/su[bp]>
    )
  )
  (?:[+-](?![A-Za-z0-9]))?                                                 # optional ionic charge on the head    (K+, …F₃-)
  (?:                                                                      # ============ zero or more salt / hydrate components ============
    (?:\s*[·•‧∙⋅・･*]\s*|\.(?=[A-Za-z(\[]))                                 #   separator: a spaced dot variant, OR a tight "." right before a component
    (?:                                                                    #   optional coefficient: a sub/sup number, an integer/fraction, or x/n
      [₁₂₃₄₅₆₇₈₉][₀₁₂₃₄₅₆₇₈₉]*|[¹²³⁴⁵⁶⁷⁸⁹][⁰¹²³⁴⁵⁶⁷⁸⁹]*|\\u208[1-9](?:\\u208[0-9])*|(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*|&\#(?:0*832[1-9]|[xX]0*208[1-9]);(?:&\#(?:0*832[0-9]|[xX]0*208[0-9]);)*|&\#(?:0*(?:178|179|185|830[89]|831[0-3])|[xX]0*(?:[bB][239]|207[4-9]));(?:&\#(?:0*(?:178|179|185|8304|830[89]|831[0-3])|[xX]0*(?:2070|[bB][239]|207[4-9]));)*|<su[bp]>[1-9][0-9]*<\/su[bp]>|[1-9][0-9]*(?:\/[1-9][0-9]*)?|[xn]
    )?
    (?:                                                                    #   the component's own units (elements/brackets + subscripts), one or more
      (?:
        (?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rlem]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)
        |[()\[\]]
      )+
      (?:
        (?:[₁₂₃₄₅₆₇₈₉][₀₁₂₃₄₅₆₇₈₉]*|[¹²³⁴⁵⁶⁷⁸⁹][⁰¹²³⁴⁵⁶⁷⁸⁹]*|\\u208[1-9](?:\\u208[0-9])*|(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*|&\#(?:0*832[1-9]|[xX]0*208[1-9]);(?:&\#(?:0*832[0-9]|[xX]0*208[0-9]);)*|&\#(?:0*(?:178|179|185|830[89]|831[0-3])|[xX]0*(?:[bB][239]|207[4-9]));(?:&\#(?:0*(?:178|179|185|8304|830[89]|831[0-3])|[xX]0*(?:2070|[bB][239]|207[4-9]));)*|<su[bp]>[1-9][0-9]*<\/su[bp]>)|[1-9][0-9]*
      )*
    )+
    (?:[+-](?![A-Za-z0-9]))?                                               #   optional charge on the component
  )*
)
(?![^\s])                                                                 # RIGHT boundary: following char must be whitespace, or end-of-string
```