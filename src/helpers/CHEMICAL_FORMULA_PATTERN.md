```regex
(?<![^\s>])                                                               # LEFT boundary: preceding char is whitespace, '>' (end of a tag), or start-of-string
(                                                                         # capture 1: the whole formula
  (?![^<>]*>)                                                             # guard: don't start inside an HTML tag's attribute list
  (?:                                                                     # ============ HEAD — one or more element/bracket "units" ============
    (?:                                                                   #   a "unit": an element/bracket run, then any trailing counts
      (?:
        (?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rlem]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)  # any element symbol (all 118)
        |[()\[\]]                                                         #   ...or a bracket
      )+
      (?:                                                                 #   then any trailing count, in ANY encoding, a plain digit, or a repeat index:
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
        |[ₙₘₓ]                                                            #     ...or a repeat-index glyph        (…)ₙ   ← NEW
        |<su[bp]>[nmx]<\/su[bp]>                                           #     ...or a repeat index in a tag     (…)<sub>n</sub>   ← NEW
      )*
    )+                                                                    #   one or more units (a lone valid element is allowed)
  )
  (?:[+-](?![A-Za-z0-9]))?                                                 # optional ionic charge on the head    (K+, …F₃-)
  (?:                                                                      # ============ zero or more salt / hydrate components ============
    (?:\s*[·•‧∙⋅・･*]\s*|\.(?=[A-Za-z(\[]))                                 #   separator: a spaced dot variant, OR a tight "." right before a component
    (?:                                                                    #   optional coefficient: a sub/sup number, an integer/fraction, or x/n
      [₁₂₃₄₅₆₇₈₉][₀₁₂₃₄₅₆₇₈₉]*|[¹²³⁴⁵⁶⁷⁸⁹][⁰¹²³⁴⁵⁶⁷⁸⁹]*|\\u208[1-9](?:\\u208[0-9])*|(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*|&\#(?:0*832[1-9]|[xX]0*208[1-9]);(?:&\#(?:0*832[0-9]|[xX]0*208[0-9]);)*|&\#(?:0*(?:178|179|185|830[89]|831[0-3])|[xX]0*(?:[bB][239]|207[4-9]));(?:&\#(?:0*(?:178|179|185|8304|830[89]|831[0-3])|[xX]0*(?:2070|[bB][239]|207[4-9]));)*|<su[bp]>[1-9][0-9]*<\/su[bp]>|[1-9][0-9]*(?:\/[1-9][0-9]*)?|[xn]
    )?
    (?:                                                                    #   the component's own units (elements/brackets + counts), one or more
      (?:
        (?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rlem]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)
        |[()\[\]]
      )+
      (?:
        (?:[₁₂₃₄₅₆₇₈₉][₀₁₂₃₄₅₆₇₈₉]*|[¹²³⁴⁵⁶⁷⁸⁹][⁰¹²³⁴⁵⁶⁷⁸⁹]*|\\u208[1-9](?:\\u208[0-9])*|(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*|&\#(?:0*832[1-9]|[xX]0*208[1-9]);(?:&\#(?:0*832[0-9]|[xX]0*208[0-9]);)*|&\#(?:0*(?:178|179|185|830[89]|831[0-3])|[xX]0*(?:[bB][239]|207[4-9]));(?:&\#(?:0*(?:178|179|185|8304|830[89]|831[0-3])|[xX]0*(?:2070|[bB][239]|207[4-9]));)*|<su[bp]>[1-9][0-9]*<\/su[bp]>)|[1-9][0-9]*|[ₙₘₓ]|<su[bp]>[nmx]<\/su[bp]>   # ← NEW: repeat index also allowed on components
      )*
    )+
    (?:[+-](?![A-Za-z0-9]))?                                               #   optional charge on the component
  )*
)
(?![^\s<])                                                                # RIGHT boundary: following char is whitespace, '<' (start of a tag), or end-of-string
```