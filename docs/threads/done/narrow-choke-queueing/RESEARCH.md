# Narrow-passage traffic research

## Sources

- Age of Empires II: Definitive Edition update notes repeatedly treat units as moving obstructions rather than durable map topology, including fixes for units moving far away to make space, unnecessary path changes around moving peers, and group regrouping: https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-153015/ and https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-81058/ and https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-90260/ and https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-99311/ and https://www.ageofempires.com/news/aoeiide-update-44725/
- Ensemble's coordinated-movement articles describe a durable route-planning layer plus local movement/coordination rather than putting every moving peer into the expensive global search: https://www.gamedeveloper.com/programming/coordinated-unit-movement and https://www.gamedeveloper.com/programming/implementing-coordinated-movement
- The AIIDE cooperative pathfinding literature likewise separates global route choice from reservation or coordination over time, because treating every agent as a static obstacle causes needless detours and gridlock: https://ojs.aaai.org/index.php/AIIDE/article/download/18726/18503/22369

## Applied conclusion

AoE keeps durable terrain and structures in A*, treats units as soft local traffic, and waits behind a temporarily occupied narrow lane rather than invalidating the terrain route. A deterministic local reservation is enough for this slice; formation regrouping, corridor fairness, and broader cooperative planning remain separate because they need persistent group policy rather than a hidden change to global traversability.
