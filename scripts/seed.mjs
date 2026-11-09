import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
  );
  process.exit(1);
}

const seedLeads = JSON.parse(
  readFileSync(resolve(process.cwd(), "lib/seed-data.json"), "utf8"),
);

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const countResponse = await fetch(
  `${url}/rest/v1/leads?select=id&limit=1`,
  { headers },
);

if (!countResponse.ok) {
  console.error(await countResponse.text());
  process.exit(1);
}

const existing = await countResponse.json();
if (Array.isArray(existing) && existing.length > 0) {
  console.log("The leads table already has data, so nothing was inserted.");
  process.exit(0);
}

const insertResponse = await fetch(`${url}/rest/v1/leads`, {
  method: "POST",
  headers: {
    ...headers,
    Prefer: "return=representation",
  },
  body: JSON.stringify(seedLeads),
});

const body = await insertResponse.text();
if (!insertResponse.ok) {
  console.error(body);
  if (body.includes("row-level security")) {
    console.error(
      "\nRow level security blocked the insert. Run supabase/schema.sql in the Supabase SQL editor, then run this script again.",
    );
  }
  process.exit(1);
}

const inserted = JSON.parse(body);
console.log(`Inserted ${Array.isArray(inserted) ? inserted.length : 0} sample leads.`);
