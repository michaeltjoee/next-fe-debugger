// tsc only emits .js; copy the HTML/CSS that sits next to the sources into dist/.
import { cpSync } from "node:fs";
import { extname } from "node:path";

cpSync("src", "dist", {
  recursive: true,
  filter: (src) => extname(src) !== ".ts",
});
