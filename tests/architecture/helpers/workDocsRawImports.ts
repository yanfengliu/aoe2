// Fixed migration boundary: these seven already-tracked raw inputs only.
// Registry text cannot authorize another source, target, or digest.
export type RawBinding = { source: string; sourceGitSha256: string; target: string; targetSha256: string };
export const APPROVED_RAW_IMPORTS: readonly RawBinding[] = [
  {
    source: "aoe2@143ad5116f25393504328056764bcc8706917b9e:" + ["docs","threads","done","full","2026-04-25","1","PROMPT.md"].join("/"),
    sourceGitSha256: "0519c93c09d81e6da91cbd1236966ce32e5b6b988f2982f9a8c4087c6600520a",
    target: ["docs","work","0_full","historical","threads","done","full","2026-04-25","1","PROMPT.md"].join("/"),
    targetSha256: "abc1e427862fd6b3c2e4576c115b4ae422f6ffa51c864cd9e0c2bdc3296dddcc",
  },
  {
    source: "aoe2@143ad5116f25393504328056764bcc8706917b9e:" + ["docs","threads","done","full","2026-04-25","2","PROMPT.md"].join("/"),
    sourceGitSha256: "b1b27fc877b9ae3d901da9a50c13fdc302bb264687a966c1e58eba09621afb43",
    target: ["docs","work","0_full","historical","threads","done","full","2026-04-25","2","PROMPT.md"].join("/"),
    targetSha256: "7fc1515324cf0ef084eb0d6653123f8f5be0de187efd8f184a38beef66ddeca4",
  },
  {
    source: "aoe2@143ad5116f25393504328056764bcc8706917b9e:" + ["docs","threads","done","full","2026-04-25","3","PROMPT.md"].join("/"),
    sourceGitSha256: "8da532ae0d4c72f15587f418da6a3cfd6e80ba51bd1258425893de5fa411bd6c",
    target: ["docs","work","0_full","historical","threads","done","full","2026-04-25","3","PROMPT.md"].join("/"),
    targetSha256: "42d2b008f49f2a6e787136c206953b7d3b38025fa0306b1c43bbc2708231d747",
  },
  {
    source: "aoe2@143ad5116f25393504328056764bcc8706917b9e:" + ["docs","threads","done","full","2026-04-26","2","prompt.txt"].join("/"),
    sourceGitSha256: "5d6b7c867585681e58b87cb678d3f8e95dd76a61b1946b37a281806f935ece2f",
    target: ["docs","work","0_full","historical","threads","done","full","2026-04-26","2","prompt.txt"].join("/"),
    targetSha256: "0d32e8aa3312be4c809479c19c7829d25f6fd7f9815b97fb5a7817153d3e246d",
  },
  {
    source: "aoe2@143ad5116f25393504328056764bcc8706917b9e:" + ["docs","threads","done","full","2026-04-26","2","verify","prompt.txt"].join("/"),
    sourceGitSha256: "93e4a74dce72c0c848613465e73811c440ebbd6e07c48038844db91cfa92b6c4",
    target: ["docs","work","0_full","historical","threads","done","full","2026-04-26","2","verify","prompt.txt"].join("/"),
    targetSha256: "7876bcbe8bc4cbab7cc66544a157bf2bb64285f9d0fa7562acd509a33af12d19",
  },
  {
    source: "aoe2@143ad5116f25393504328056764bcc8706917b9e:" + ["docs","threads","done","construction-hp-ramp","2026-04-26","1","diff.md"].join("/"),
    sourceGitSha256: "b8f6323f0cfa31df4c6f279d788cae310ed28938f642e129fd22d2f0ae07d9b3",
    target: ["docs","work","1_construction-hp-ramp","historical","threads","done","construction-hp-ramp","2026-04-26","1","diff.md"].join("/"),
    targetSha256: "c43158541d91d8acb974135413bb32215c689a81df7ddd5c7ba840a032eb61fe",
  },
  {
    source: "aoe2@143ad5116f25393504328056764bcc8706917b9e:" + ["docs","threads","done","construction-hp-ramp","2026-04-26","2","diff.md"].join("/"),
    sourceGitSha256: "290f3343319f10f87bdbd894604d6281bcfee70bd67b3a192b76d525c50f17d1",
    target: ["docs","work","1_construction-hp-ramp","historical","threads","done","construction-hp-ramp","2026-04-26","2","diff.md"].join("/"),
    targetSha256: "a692a96d1e34b2ef17224408ed70d8e73bb4f10c5b5dc7dd3a0adafdabb427a4",
  },
];
