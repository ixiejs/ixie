import { writeFile } from "fs/promises";

async function createPack() {
  const DB: Record<
    string,
    {
      readonly source?: "iana" | "apache" | "nginx";
      readonly extensions?: readonly string[] | undefined;
      readonly compressible?: boolean | undefined;
      readonly charset?: string | undefined;
    }
  > = (await fetch(
    "https://raw.githubusercontent.com/jshttp/mime-db/master/db.json",
  ).then((e) => e.json())) as any;
  const SOURCES = {
    iana: 4,
    apache: 2,
    nginx: 1,
  };
  function compare(prev: string, next: string) {
    let s1 = SOURCES[DB[prev]?.source!] || 3;
    let s2 = SOURCES[DB[next]?.source!] || 3;
    const score = s2 - s1 || prev.length - next.length;
    return score;
  }
  let m: Record<string, string[]> = {};
  for (const [mime, info] of Object.entries(DB)) {
    if (
      mime === "application/dash-patch+xml" ||
      mime === "application/octet-stream" ||
      mime === "text/vnd.dvb.subtitle" ||
      mime === "image/vnd.microsoft.icon" ||
      mime === "application/vnd.lotus-organizer" ||
      mime === "application/xfdf" ||
      mime === "application/fdf"
    )
      continue;
    for (const ext of info?.extensions || []) {
      (m[ext] = m[ext] || []).push(mime);
    }
  }
  return Object.fromEntries(
    Object.entries({
      ...m,
      pdb: ["application/x-ms-pdb"],
    })
      .map((e) => [
        e[0],
        e[1]
          .filter(
            (e) => true, //!filter.text(e)
          )
          .sort(compare)[0],
      ])
      .filter((e) => e[1]),
  );
}
const pack = await createPack();
await writeFile(
  new URL("../dist/mimes.js", import.meta.url),
  `/* Code generated by scripts/mimes.ts. DO NOT EDIT. */\nexport default ${JSON.stringify(
    pack,
  )}`,
);
console.log("wrote mimes.js");
