# Must fix before beta release
1) Fix a bug I just found in the search - searching seems to trigger _two_ searches, and thus 2x the requests and 2x the results. I know _why_ this happens now, not yet sure on what the best solution is.
2) Finish up the Settings in the drawer thing - Settings all already exist and are usable, I just need to have them updated when the values in the drawer are updated (also: fix the formatting so it looks better)
3) Add some logic for the context menu (right click options, eg: copy url, copy product name, etc.)
4) Get the TS types organized better - I thought it would be a genius move to just have all types declared and accessible globally, but now I see that was a totally amateur move. But moving them should be easy enough with help from AI
5) Add a few other suppliers that we talked about
6) Fix the speed dial stuff (just need to change the logic to use the new functions, pretty easy)
7) Have the product results sorted by relevancy - The products that are included under each supplier are sorted based on how closely the title matches the search query (using a Levenshtein algorithm in the fuzzball library). Having the Results table itself also sorted based on the Levenshtein values would be the best way to ensure the best results are on top.
8) Maybe fix some of the unit tests - I had like 60% coverage, but then switching to the new template broke nearly every one of the React based unit tests (as expected), so I need to fix them if we want to keep unit tests for react components. I've been putting it off until the end since the template is still in flux.



# Nice to have changes
1) If the supplier lists SDS/MSDS or other documents, then include those in the products meta data and show "open MSDS document" in the context menu for that item
2) Allow users to to blacklist products from search results via the context menu (eg: "Remove from results" and/or "Exclude from future results").
3) Add the ability to group results by CAS, this will allow for easier comparison between different suppliers.
4) Either fix or disable "Dark mode" - AI totally fucked it up when I had it implement the new template/theme.
