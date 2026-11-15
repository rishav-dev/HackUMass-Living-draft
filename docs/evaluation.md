# Evaluation

Run on 2026-11-13. Every case is fictional and hand-labelled. The set is small, so treat the numbers as a smoke test, not a benchmark.

## Same-event matching

- 30 new captures checked against an archive of 8 memories.
- 16 should match an existing memory; 14 should stay separate.
- Precision of "likely the same memory": 11 correct out of 11 suggested (100%).
- Recall: 11 of 16 real matches were suggested (69%).
- Separate events kept separate: 14 of 14.

| Case                        | Expected | Got      | Score |
| --------------------------- | -------- | -------- | ----- |
| Lunch table, again          | lunch    | separate | 0.42  |
| Promise from the hurt angle | promise  | separate | 0.42  |
| Storm, candles              | storm    | separate | 0.42  |
| Assignments, short          | promise  | separate | 0.39  |
| Lunch from the window       | lunch    | separate | 0.25  |

## Version changes

15 of 16 pairs got the expected headline change (94%).

| Case                     | Expected      | Got           |
| ------------------------ | ------------- | ------------- |
| Added Dad detail         | new           | new           |
| Doubt about promise      | uncertain     | uncertain     |
| Changed perspective      | reflected     | reflected     |
| Flipped attendance       | contradictory | contradictory |
| Different count          | contradictory | contradictory |
| Explicit correction      | corrected     | corrected     |
| Same detail              | consistent    | consistent    |
| Left out a detail        | omitted       | omitted       |
| Hedged location          | uncertain     | uncertain     |
| Turns out                | corrected     | corrected     |
| Never vs did             | contradictory | contradictory |
| Reworded detail          | changed       | consistent ✗  |
| New sensory detail       | new           | new           |
| Now I realize            | reflected     | reflected     |
| Might have been          | uncertain     | uncertain     |
| Different number of kids | contradictory | contradictory |

## Time placement

17 of 17 placed at the expected ages (100%).

| Text                                                       | Expected                   | Got                        |
| ---------------------------------------------------------- | -------------------------- | -------------------------- |
| In sixth grade, around age 12, summer vacation started.    | 12–12                      | 12–12                      |
| I was eight or nine, in summer.                            | 8–9                        | 8–9                        |
| When I was about seven we got a dog.                       | 7–7                        | 7–7                        |
| I don't remember when, but the kitchen was yellow.         | unplaced (not on the path) | unplaced (not on the path) |
| In fourth grade I broke my wrist.                          | 9–10                       | 9–10                       |
| On my tenth birthday it rained.                            | 10–10                      | 10–10                      |
| In high school I was on the debate team.                   | 14–18 (not on the path)    | 14–18 (not on the path)    |
| Two summers ago I learned to swim.                         | 20–21                      | 20–21                      |
| At age 5 I started kindergarten.                           | 5–5                        | 5–5                        |
| The year I turned sixteen I got my license.                | 16–16                      | 16–16                      |
| We moved houses at some point, I really have no idea when. | unplaced (not on the path) | unplaced (not on the path) |
| I must have been 6 or 7 when Grandpa visited.              | 6–7                        | 6–7                        |
| Senior year of high school we went to prom.                | 17–18                      | 17–18                      |
| As a toddler I was scared of the vacuum.                   | 1–3                        | 1–3                        |
| As a kid I was scared of the vacuum.                       | 3–11 (not on the path)     | 3–11 (not on the path)     |
| The winter I was ten an ice storm knocked the power out.   | 10–10                      | 10–10                      |
| At 22 my boss said the raise had to wait.                  | 22–22                      | 22–22                      |
